// KUVAT LABS — Rota
// Odanın arkasındaki atmosfer: mevsime göre renk geçişi, odanın arkasında yumuşak ışık ve süzülen parçacıklar
// (sonbaharda yaprak, kışın kar, baharda çiçek, yazın ışık zerreleri). Ekran uzayında çizilir; simülasyonu yalnız okur.
// Rastgelelik yalnız görsel (Math.random): oyun durumunu etkilemez.

import { Container, Graphics, Sprite, Texture } from "pixi.js";

export type SeasonKind = "autumn" | "winter" | "spring" | "summer";

interface Look {
  /** renk geçişi: üst, orta, alt */
  sky: [string, string, string];
  /** odanın arkasındaki ışık */
  glow: number;
  glowAlpha: number;
  /** parçacık renkleri */
  colors: number[];
  shape: "leaf" | "flake" | "petal" | "mote";
  /** düşüş hızı (px/sn; negatifse yükselir) ve yatay sürüklenme */
  fall: [number, number];
  drift: number;
  size: [number, number];
}

const LOOKS: Record<SeasonKind, Look> = {
  autumn: { sky: ["#3b2b3f", "#4a2f3c", "#5c3a36"], glow: 0xffb36b, glowAlpha: 0.34, colors: [0xe9a14a, 0xd9673a, 0xf4c95d, 0xb9512f], shape: "leaf", fall: [18, 34], drift: 14, size: [5, 9] },
  winter: { sky: ["#232a44", "#2c3552", "#3c4763"], glow: 0xbcd4ff, glowAlpha: 0.28, colors: [0xffffff, 0xdfe9ff, 0xc9d8f5], shape: "flake", fall: [14, 30], drift: 8, size: [1.5, 3.5] },
  spring: { sky: ["#2e2a48", "#3f3355", "#5a3f5c"], glow: 0xffc6dc, glowAlpha: 0.3, colors: [0xffc2d6, 0xffdbe6, 0xf7a8c4, 0xfff0f4], shape: "petal", fall: [12, 24], drift: 18, size: [3.5, 6] },
  summer: { sky: ["#1f2a45", "#2d3350", "#4a3a4e"], glow: 0xffe39a, glowAlpha: 0.34, colors: [0xffe9a8, 0xfff4cf, 0xffd27a], shape: "mote", fall: [-10, -3], drift: 6, size: [1.5, 3] },
};

/** Takvim ayından mevsim (1–12). */
export function seasonOf(month: number): SeasonKind {
  if (month >= 9 && month <= 11) return "autumn";
  if (month === 12 || month <= 2) return "winter";
  if (month <= 5) return "spring";
  return "summer";
}

let disc: Texture | null = null;
/** Yumuşak beyaz daire (ortadan kenara saydamlaşır): ışık, gölge ve zerreler için ortak doku. */
export function softDisc(): Texture {
  if (disc) return disc;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const r = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  r.addColorStop(0, "rgba(255,255,255,1)");
  r.addColorStop(0.45, "rgba(255,255,255,.45)");
  r.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = r;
  g.fillRect(0, 0, 128, 128);
  disc = Texture.from(c);
  disc.source.scaleMode = "linear";
  return disc;
}

function skyTexture(stops: [string, string, string]): Texture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const lin = g.createLinearGradient(0, 0, 0, 256);
  lin.addColorStop(0, stops[0]);
  lin.addColorStop(0.55, stops[1]);
  lin.addColorStop(1, stops[2]);
  g.fillStyle = lin;
  g.fillRect(0, 0, 4, 256);
  const t = Texture.from(c);
  t.source.scaleMode = "linear";
  return t;
}

interface Particle {
  g: Container;
  x: number;
  y: number;
  vy: number;
  sway: number;
  phase: number;
  spin: number;
  /** derinlik (0 uzak … 1 yakın): boy, hız ve saydamlık */
  depth: number;
}

export class Backdrop extends Container {
  private readonly sky = new Sprite();
  private readonly glow = new Sprite(softDisc());
  private readonly layer = new Container();
  private particles: Particle[] = [];
  private season: SeasonKind | null = null;
  private w = 0;
  private h = 0;
  private time = 0;
  /** mevsim değişiminde eski görünüm üstte saydamlaşır */
  private fading: Sprite | null = null;

  constructor() {
    super();
    this.glow.anchor.set(0.5);
    this.glow.blendMode = "add";
    this.addChild(this.sky, this.glow, this.layer);
  }

  /** Ekran boyutu (CSS pikseli). */
  resize(w: number, h: number): void {
    if (w === this.w && h === this.h) return;
    this.w = w;
    this.h = h;
    this.sky.width = w;
    this.sky.height = h;
    if (this.fading) {
      this.fading.width = w;
      this.fading.height = h;
    }
    if (this.season) this.populate(LOOKS[this.season]);
  }

  /** Işığın merkezi: odanın ekrandaki ortası; çap odanın görünen genişliğine göre. */
  setFocus(x: number, y: number, span: number): void {
    this.glow.position.set(x, y);
    this.glow.width = span * 1.9;
    this.glow.height = span * 1.5;
  }

  setSeason(kind: SeasonKind): void {
    if (kind === this.season) return;
    const look = LOOKS[kind];
    if (this.season && this.sky.texture) {
      this.fading?.destroy();
      this.fading = new Sprite(this.sky.texture);
      this.fading.width = this.w;
      this.fading.height = this.h;
      this.addChildAt(this.fading, 1);
    }
    this.season = kind;
    this.sky.texture = skyTexture(look.sky);
    this.sky.width = this.w;
    this.sky.height = this.h;
    this.glow.tint = look.glow;
    this.glow.alpha = look.glowAlpha;
    this.populate(look);
  }

  private populate(look: Look): void {
    for (const p of this.particles) p.g.destroy();
    this.particles = [];
    if (!this.w || !this.h) return;
    // ekran alanına göre sayı; küçük ekranda az (yük ve kalabalık olmasın)
    const n = Math.round(Math.min(46, Math.max(14, (this.w * this.h) / 26_000)));
    for (let i = 0; i < n; i++) {
      const depth = Math.random();
      const size = look.size[0] + (look.size[1] - look.size[0]) * depth;
      const color = look.colors[Math.floor(Math.random() * look.colors.length)];
      const g = shapeOf(look.shape, size, color);
      g.alpha = (look.shape === "mote" ? 0.25 : 0.3) + depth * 0.5;
      this.layer.addChild(g);
      this.particles.push({
        g,
        x: Math.random() * this.w,
        y: Math.random() * this.h,
        vy: look.fall[0] + (look.fall[1] - look.fall[0]) * depth,
        sway: look.drift * (0.5 + Math.random()),
        phase: Math.random() * Math.PI * 2,
        spin: look.shape === "flake" || look.shape === "mote" ? 0 : (Math.random() - 0.5) * 2.4,
        depth,
      });
    }
  }

  update(dt: number): void {
    this.time += dt;
    if (this.fading) {
      this.fading.alpha -= dt / 1.2;
      if (this.fading.alpha <= 0) {
        this.fading.destroy();
        this.fading = null;
      }
    }
    const mote = this.season === "summer";
    for (const p of this.particles) {
      p.y += p.vy * dt;
      const sx = Math.sin(this.time * 0.9 + p.phase);
      p.x += (sx * p.sway + (mote ? 0 : 6 + p.depth * 8)) * dt;
      p.g.rotation += p.spin * dt;
      if (mote) p.g.alpha = 0.2 + (0.35 + p.depth * 0.3) * (0.5 + 0.5 * Math.sin(this.time * 1.7 + p.phase * 3));
      // ekrandan çıkan karşı kenardan döner
      if (p.y > this.h + 12) (p.y = -12), (p.x = Math.random() * this.w);
      if (p.y < -12) (p.y = this.h + 12), (p.x = Math.random() * this.w);
      if (p.x > this.w + 12) p.x = -12;
      if (p.x < -12) p.x = this.w + 12;
      p.g.position.set(p.x, p.y);
    }
  }
}

function shapeOf(shape: Look["shape"], size: number, color: number): Container {
  if (shape === "flake" || shape === "mote") {
    const s = new Sprite(softDisc());
    s.anchor.set(0.5);
    s.width = s.height = size * (shape === "mote" ? 5 : 3);
    s.tint = color;
    if (shape === "mote") s.blendMode = "add";
    return s;
  }
  const g = new Graphics();
  if (shape === "leaf") {
    // sivri uçlu yaprak + orta damar
    g.moveTo(-size, 0).quadraticCurveTo(0, -size * 0.75, size, 0).quadraticCurveTo(0, size * 0.75, -size, 0).fill(color);
    g.moveTo(-size * 0.8, 0).lineTo(size * 0.8, 0).stroke({ width: 1, color: 0x5a2f1f, alpha: 0.45 });
  } else {
    g.ellipse(0, 0, size, size * 0.6).fill(color);
  }
  g.rotation = Math.random() * Math.PI * 2;
  return g;
}
