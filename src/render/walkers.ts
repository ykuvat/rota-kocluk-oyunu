// Odada dolaşan karakterler (Buse, yardımcı koçlar): iş noktaları arasında yürür, varınca bir süre
// "iş yapar" (başında eylem simgesi, küçük çalışma hareketi), sonra başka bir noktaya geçer.
// Çizime dokunulmaz: hareket yalnız konum, aynalama ve 1 piksellik adım/nefes ile verilir.
// Görsel katmandır; simülasyon durumunu okumaz/yazmaz, bu yüzden Math.random kullanılabilir.

import { Container, Sprite, Text } from "pixi.js";
import type { WorkSpot } from "../content/types";
import { depthKey, footprintAnchorOffsetX, footprintBottom } from "../core/iso";

const FOOT = 0.4; // karakter taban izi (m)
const SPEED = 0.85; // karo/sn
const HUB_DETOUR = 1.1; // bu uzaklıktan fazlaysa açık zemin noktasından geçerek yürü

interface Pt {
  x: number;
  y: number;
}

/** Birden çok yürüyenin aynı noktayı seçmemesi için ortak rezervasyon. */
export class SpotBook {
  private readonly taken = new Map<WorkSpot, Walker>();
  claim(spot: WorkSpot, w: Walker): void {
    for (const [s, owner] of this.taken) if (owner === w) this.taken.delete(s);
    this.taken.set(spot, w);
  }
  isFree(spot: WorkSpot, w: Walker): boolean {
    const owner = this.taken.get(spot);
    return !owner || owner === w;
  }
}

export class Walker {
  private x: number;
  private y: number;
  private path: Pt[] = [];
  private spot: WorkSpot | null = null;
  private wait: number;
  private t = 0;
  private readonly icon: Text;
  private faceLeft: boolean;

  constructor(
    private readonly s: Sprite,
    start: Pt,
    private readonly h: number,
    private readonly spots: WorkSpot[],
    private readonly hub: Pt | undefined,
    private readonly book: SpotBook,
    layer: Container,
  ) {
    this.x = start.x;
    this.y = start.y;
    this.faceLeft = s.scale.x < 0;
    this.wait = 1 + Math.random() * 2;
    this.icon = new Text({ text: "", style: { fontSize: 18, fontFamily: "system-ui, sans-serif" } });
    this.icon.anchor.set(0.5, 1);
    this.icon.resolution = 2;
    this.icon.zIndex = 1e9;
    layer.addChild(this.icon);
    this.place(0);
  }

  update(dt: number): void {
    this.t += dt;
    if (this.path.length) {
      this.walk(dt);
      return;
    }
    this.wait -= dt;
    if (this.wait <= 0) this.pickNext();
    // iş başında: nefes + işe göre küçük hareket (yazarken başın 1 px inip kalkması gibi)
    const breath = Math.sin(this.t * 2.2) > 0.35;
    const work = this.spot && Math.sin(this.t * 7) > 0.6 ? 1 : 0;
    this.s.scale.y = breath ? (this.h + 1) / this.h : 1;
    this.place(work);
    this.icon.text = this.spot ? this.spot.icon : "";
    this.icon.position.set(this.s.x, this.s.y - this.h - 4 - Math.round(Math.sin(this.t * 2) * 2));
  }

  private pickNext(): void {
    const options = this.spots.filter((sp) => sp !== this.spot && this.book.isFree(sp, this));
    if (!options.length) {
      this.wait = 2;
      return;
    }
    const next = options[Math.floor(Math.random() * options.length)];
    this.book.claim(next, this);
    const far = Math.hypot(next.x - this.x, next.y - this.y) > HUB_DETOUR;
    this.path = far && this.hub ? [this.hub, next] : [next];
    this.spot = null;
    this.icon.text = "";
    this.pendingSpot = next;
  }

  private pendingSpot: WorkSpot | null = null;

  private walk(dt: number): void {
    const target = this.path[0];
    const dx = target.x - this.x;
    const dy = target.y - this.y;
    const dist = Math.hypot(dx, dy);
    const step = SPEED * dt;
    if (dist <= step) {
      this.x = target.x;
      this.y = target.y;
      this.path.shift();
      if (!this.path.length && this.pendingSpot) {
        this.spot = this.pendingSpot;
        this.pendingSpot = null;
        this.faceLeft = !!this.spot.faceLeft;
        this.wait = 3 + Math.random() * 5;
      }
    } else {
      this.x += (dx / dist) * step;
      this.y += (dy / dist) * step;
      // ekranda sola giderken aynala (SE çizim → SW)
      const screenDx = dx - dy;
      if (Math.abs(screenDx) > 0.01) this.faceLeft = screenDx < 0;
    }
    this.s.scale.y = 1;
    // adım: her yarım adımda 1 px yukarı
    this.place(Math.sin(this.t * 14) > 0 ? 1 : 0);
    this.icon.text = "";
  }

  private place(lift: number): void {
    const b = footprintBottom(this.x, this.y, FOOT, FOOT);
    this.s.scale.x = this.faceLeft ? -1 : 1;
    this.s.position.set(Math.round(b.x + footprintAnchorOffsetX(FOOT, FOOT)), Math.round(b.y) - lift);
    this.s.zIndex = depthKey(this.x, this.y, FOOT, FOOT);
  }
}
