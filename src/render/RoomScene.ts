import { AnimatedSprite, Container, Graphics, Sprite, Text, Texture } from "pixi.js";
import { depthKey, footprintAnchorOffsetX, footprintBottom, tileToScreen } from "../core/iso";
import type { Placement, ProceduralRoom, RoomDef, SpriteManifest } from "../content/types";
import { SpotBook, Walker } from "./walkers";

/** Yerleşim için çizim sırası anahtarları; bir yüzeyin üstündekiler o yüzeyin hemen ardından çizilir. */
export function sortKeys(placements: Placement[]): Map<string, number> {
  const keys = new Map<string, number>();
  for (const p of placements) if (!p.on) keys.set(p.id, depthKey(p.x, p.y, p.fx, p.fy));
  placements.forEach((p, i) => {
    if (!p.on) return;
    const parent = keys.get(p.on);
    if (parent === undefined) throw new Error(`"${p.id}" bilinmeyen yüzeyin üstünde: ${p.on}`);
    // üstteki eşyalar kendi aralarında da arkadan öne
    keys.set(p.id, parent + 0.1 + depthKey(p.x, p.y, p.fx, p.fy) / 1e7 + i / 1e9);
  });
  return keys;
}

/** Odanın tamamı: arka plan, ızgara (hata ayıklama) ve derinlik sıralı nesneler. Dünya orijini = (0,0) karosunun üst köşesi. */
export class RoomScene extends Container {
  readonly grid: Graphics;
  private readonly objects = new Container();
  /** nefes alan karakterler: çizime dokunmadan, ayaklar sabit 1 px uzayıp kısalır */
  private readonly breathers: { s: Sprite; h: number; phase: number; flip: number }[] = [];
  private time = 0;
  private readonly walkers: Walker[] = [];
  /** öğrenciler arada etrafa bakar (kısa süre ters yöne döner) */
  private readonly fidgets: { s: Sprite; base: number; next: number; until: number }[] = [];

  private bg: Sprite | null = null;
  /** arka plan geçişinde eski görüntü (üstte, saydamlaşarak kaybolur) */
  private fading: Sprite | null = null;

  /**
   * Arka planı aynı odanın poz varyantıyla değiştirir (Buse masada, seans masasında öğrenciyle...).
   * Varyantlar aynı kırpma ve ızgarayla üretildiği için yer değişmez; geçiş kısa bir kararmayla yumuşar.
   */
  setBackground(tex: Texture | undefined): void {
    if (!this.bg || !tex || this.bg.texture === tex) return;
    this.fading?.destroy();
    const old = new Sprite(this.bg.texture);
    old.position.copyFrom(this.bg.position);
    this.addChildAt(old, this.getChildIndex(this.bg) + 1);
    this.fading = old;
    this.bg.texture = tex;
  }

  /** Yürüyen karakteri (ör. Buse) gizle/göster: oturma pozu arka plandayken ikinci bir Buse görünmesin. */
  setWalkerVisible(id: string, v: boolean): void {
    for (const w of this.walkers) if (w.label === id) w.setVisible(v);
  }

  /** Her karede çağrılır (saniye). */
  update(dt: number): void {
    this.time += dt;
    if (this.fading) {
      this.fading.alpha -= dt / 0.3;
      if (this.fading.alpha <= 0) {
        this.fading.destroy();
        this.fading = null;
      }
    }
    for (const b of this.breathers) {
      const up = Math.sin((this.time + b.phase) * 2.2) > 0.35;
      b.s.scale.y = up ? (b.h + 1) / b.h : 1;
    }
    for (const w of this.walkers) w.update(dt);
    for (const f of this.fidgets) {
      if (this.time >= f.next) {
        f.until = this.time + 1.2 + Math.random() * 1.5;
        f.next = this.time + 6 + Math.random() * 8;
      }
      f.s.scale.x = this.time < f.until ? -f.base : f.base;
    }
  }

  private breathe(s: Sprite, id: string, h: number): void {
    this.breathers.push({ s, h, phase: (Math.abs(hashId(id)) % 100) / 30, flip: s.scale.x });
  }
  get objectsLayer(): Container {
    return this.objects;
  }

  constructor(
    room: RoomDef,
    manifest: SpriteManifest,
    textures: Map<string, Texture>,
    /** odada gösterilecek personelin sprite'ları, yuva sırasıyla (bkz. `Placement.minStaff`) */
    staff: string[] = [],
    actors: Actor[] = [],
    onActorTap?: (id: string) => void,
  ) {
    super();

    if (room.background) {
      const bg = new Sprite(textures.get(room.background));
      bg.position.set(-room.floorOrigin[0], -room.floorOrigin[1]);
      this.addChild(bg);
      this.bg = bg;
    } else if (room.procedural) {
      this.addChild(drawProceduralRoom(room.tilesX, room.tilesY, room.procedural));
    }

    this.grid = drawGrid(room.tilesX, room.tilesY);
    this.grid.visible = false;
    this.addChild(this.grid);

    this.objects.sortableChildren = true;
    this.addChild(this.objects);

    const keys = sortKeys(room.placements);
    const book = new SpotBook();
    for (const p of room.placements) {
      if (p.minStaff !== undefined && staff.length < p.minStaff) continue;
      const roleSprite = p.minStaff !== undefined ? staff[p.minStaff - 1] : undefined;
      const sprite = roleSprite && manifest.sprites[roleSprite] && textures.has(roleSprite) ? roleSprite : p.sprite;
      const info = manifest.sprites[sprite];
      if (!info) throw new Error(`manifest'te sprite yok: ${sprite}`);
      const s = new Sprite(textures.get(sprite));
      s.anchor.set(info.anchor[0] / info.size[0], info.anchor[1] / info.size[1]);
      if (p.flip) s.scale.x = -1;
      const bottom = footprintBottom(p.x, p.y, p.fx, p.fy);
      // tam piksele yuvarla: pixel art titremesin
      s.position.set(Math.round(bottom.x + footprintAnchorOffsetX(p.fx, p.fy)), Math.round(bottom.y - (p.lift ?? 0)));
      s.zIndex = keys.get(p.id)!;
      s.label = p.id;
      this.objects.addChild(s);
      if (p.walker && room.workSpots?.length) {
        this.walkers.push(new Walker(s, { x: p.x, y: p.y }, info.size[1], room.workSpots, room.hub, book, this.objects));
      } else if (sprite.startsWith("char_")) this.breathe(s, p.id, info.size[1]);
    }

    // öğrenciler: odadaki sabit yerlerde, başlarının üstünde ruh hâli; tıklanınca kartı açılır
    for (const a of actors) {
      const info = manifest.sprites[a.sprite];
      const tex = textures.get(a.sprite);
      if (!info || !tex) continue;
      const frames = a.frames?.map((f) => textures.get(f)).filter((t): t is Texture => !!t) ?? [];
      const s = frames.length > 1 ? new AnimatedSprite(frames) : new Sprite(tex);
      if (s instanceof AnimatedSprite) {
        s.animationSpeed = 0.08;
        // aynı anda kıpırdamasınlar
        s.gotoAndPlay(Math.abs(hashId(a.id)) % frames.length);
      }
      s.anchor.set(info.anchor[0] / info.size[0], info.anchor[1] / info.size[1]);
      if (a.flip) s.scale.x = -1;
      const bottom = footprintBottom(a.x, a.y, 0.4, 0.4);
      s.position.set(Math.round(bottom.x + footprintAnchorOffsetX(0.4, 0.4)), Math.round(bottom.y));
      s.zIndex = depthKey(a.x, a.y, 0.4, 0.4);
      s.label = a.id;
      if (onActorTap) {
        s.eventMode = "static";
        s.cursor = "pointer";
        s.on("pointertap", () => onActorTap(a.id));
      }
      this.objects.addChild(s);
      if (!(s instanceof AnimatedSprite)) this.breathe(s, a.id, info.size[1]);
      this.fidgets.push({ s, base: s.scale.x, next: 3 + (Math.abs(hashId(a.id)) % 7), until: 0 });
      if (a.mood) {
        const t = new Text({ text: a.mood, style: { fontSize: 20, fontFamily: "system-ui, sans-serif" } });
        t.anchor.set(0.5, 1);
        t.resolution = 2;
        t.position.set(s.x, s.y - info.size[1] - 2);
        t.zIndex = 1e9;
        this.objects.addChild(t);
      }
    }
  }
}

/** Odada duran bir öğrenci. */
export interface Actor {
  id: string;
  sprite: string;
  /** bekleme animasyonu kareleri (sprite adları); yoksa tek kare */
  frames?: string[];
  x: number;
  y: number;
  flip?: boolean;
  mood?: string;
}

function hashId(id: string): number {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.charCodeAt(0)) | 0;
  return h;
}

type Pt = { x: number; y: number };
const P = (x: number, y: number, h = 0): Pt => {
  const p = tileToScreen(x, y);
  return { x: Math.round(p.x), y: Math.round(p.y - h) };
};
const poly = (g: Graphics, pts: Pt[], color: number) => g.poly(pts.flatMap((p) => [p.x, p.y])).fill(color);

/** Kodla çizilen oda kabuğu: iki arka duvar (pencere, kapı, süpürgelik) ve tahta zemin. */
function drawProceduralRoom(tx: number, ty: number, r: ProceduralRoom): Graphics {
  const g = new Graphics();
  const H = r.wallHeight;
  const T = 10; // duvar kalınlığı (üst kenar)
  // sağ-arka duvar: x ekseni boyunca (y = 0)
  poly(g, [P(0, 0), P(tx, 0), P(tx, 0, H), P(0, 0, H)], r.wallRight);
  // sol-arka duvar: y ekseni boyunca (x = 0)
  poly(g, [P(0, 0), P(0, ty), P(0, ty, H), P(0, 0, H)], r.wallLeft);
  // duvar üst kalınlığı
  poly(g, [P(0, 0, H), P(tx, 0, H), { x: P(tx, 0, H).x, y: P(tx, 0, H).y - T }, { x: P(0, 0, H).x, y: P(0, 0, H).y - T }], r.trim);
  poly(g, [P(0, 0, H), P(0, ty, H), { x: P(0, ty, H).x, y: P(0, ty, H).y - T }, { x: P(0, 0, H).x, y: P(0, 0, H).y - T }], r.trim);

  const sill = 70, top = 175;
  for (const [a, b] of r.windowsX) {
    poly(g, [P(a, 0, sill - 6), P(b, 0, sill - 6), P(b, 0, top + 6), P(a, 0, top + 6)], r.trim);
    poly(g, [P(a + 0.06, 0, sill), P(b - 0.06, 0, sill), P(b - 0.06, 0, top), P(a + 0.06, 0, top)], 0x9fd4ef);
    poly(g, [P(a + 0.06, 0, (sill + top) / 2 + 30), P(b - 0.06, 0, (sill + top) / 2 + 30), P(b - 0.06, 0, top), P(a + 0.06, 0, top)], 0xc4e6f6);
    const m = (a + b) / 2;
    poly(g, [P(m - 0.02, 0, sill), P(m + 0.02, 0, sill), P(m + 0.02, 0, top), P(m - 0.02, 0, top)], r.trim);
  }
  for (const [a, b] of r.windowsY) {
    poly(g, [P(0, a, sill - 6), P(0, b, sill - 6), P(0, b, top + 6), P(0, a, top + 6)], r.trim);
    poly(g, [P(0, a + 0.06, sill), P(0, b - 0.06, sill), P(0, b - 0.06, top), P(0, a + 0.06, top)], 0x8cc3df);
    const m = (a + b) / 2;
    poly(g, [P(0, m - 0.02, sill), P(0, m + 0.02, sill), P(0, m + 0.02, top), P(0, m - 0.02, top)], r.trim);
  }
  if (r.doorY) {
    const [a, b] = r.doorY;
    poly(g, [P(0, a - 0.06, 0), P(0, b + 0.06, 0), P(0, b + 0.06, 168), P(0, a - 0.06, 168)], r.trim);
    poly(g, [P(0, a, 0), P(0, b, 0), P(0, b, 160), P(0, a, 160)], 0x7a5236);
    poly(g, [P(0, b - 0.15, 72), P(0, b - 0.1, 72), P(0, b - 0.1, 78), P(0, b - 0.15, 78)], 0xe8c26a);
  }
  // süpürgelik
  poly(g, [P(0, 0), P(tx, 0), P(tx, 0, 8), P(0, 0, 8)], r.trim);
  poly(g, [P(0, 0), P(0, ty), P(0, ty, 8), P(0, 0, 8)], r.trim);

  // zemin: karolar arası hafif ton farkı + tahta çizgileri (+x yönünde)
  for (let i = 0; i < tx; i++)
    for (let j = 0; j < ty; j++) poly(g, [P(i, j), P(i + 1, j), P(i + 1, j + 1), P(i, j + 1)], r.floor[(i + j) % 2]);
  for (let j = 0.25; j < ty; j += 0.25) {
    const a = P(0, j), b = P(tx, j);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  g.stroke({ width: 1, color: r.floorLine, alpha: 0.55 });
  return g;
}

export interface WorldPoint {
  x: number;
  y: number;
}

/** Yerleşimdeki bir sprite'ın tepe noktası (dünya koordinatı); yoksa null. */
export function spriteTop(scene: RoomScene, id: string): WorldPoint | null {
  const s = scene.objectsLayer.children.find((c) => c.label === id);
  if (!s) return null;
  return { x: s.x, y: s.y - s.height };
}

function drawGrid(tx: number, ty: number): Graphics {
  const g = new Graphics();
  for (let i = 0; i <= tx; i++) {
    const a = tileToScreen(i, 0), b = tileToScreen(i, ty);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  for (let j = 0; j <= ty; j++) {
    const a = tileToScreen(0, j), b = tileToScreen(tx, j);
    g.moveTo(a.x, a.y).lineTo(b.x, b.y);
  }
  g.stroke({ width: 1, color: 0x7de3ff, alpha: 0.8 });
  g.circle(0, 0, 3).fill(0xff4d6d); // orijin
  return g;
}
