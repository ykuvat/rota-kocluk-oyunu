// Sahnede yükselip kaybolan kısa geri bildirimler ("+6.000 ₺", "Yeni öğrenci!", ❤).
// Her eylemin dünyada görünür bir karşılığı olsun diye; simülasyonu yalnız okur.

import { Container, Text } from "pixi.js";
import type { WorldPoint } from "./RoomScene";

interface Floater {
  t: Text;
  age: number;
  life: number;
  y0: number;
}

export class Floaters extends Container {
  private items: Floater[] = [];

  constructor() {
    super();
    this.zIndex = 1_000_000;
  }

  spawn(at: WorldPoint, text: string, color = 0xffe39a): void {
    // aynı anda çıkanlar üst üste binmesin
    const stack = this.items.filter((f) => f.age < 0.4).length;
    const t = new Text({
      text,
      style: { fontFamily: "system-ui, sans-serif", fontSize: 18, fontWeight: "800", fill: color, stroke: { color: 0x241a2c, width: 4 } },
    });
    t.anchor.set(0.5, 1);
    t.resolution = 2;
    const y0 = at.y - 6 - stack * 22;
    t.position.set(Math.round(at.x), y0);
    this.addChild(t);
    this.items.push({ t, age: 0, life: 1.8, y0 });
  }

  update(dtSeconds: number): void {
    for (const f of this.items) {
      f.age += dtSeconds;
      const k = f.age / f.life;
      f.t.y = f.y0 - 38 * Math.min(1, k * 1.4);
      f.t.alpha = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
    }
    for (const f of this.items.filter((x) => x.age >= x.life)) {
      this.removeChild(f.t);
      f.t.destroy();
    }
    this.items = this.items.filter((x) => x.age < x.life);
  }
}
