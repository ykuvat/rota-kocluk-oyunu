// Sahnede yükselip kaybolan kısa geri bildirimler ("+6.000 ₺", "Yeni öğrenci!", ❤).
// Her eylemin dünyada görünür bir karşılığı olsun diye; simülasyonu yalnız okur.

import { Container, Graphics, Text } from "pixi.js";
import type { WorldPoint } from "./RoomScene";

interface Floater {
  t: Text;
  age: number;
  life: number;
  y0: number;
}

interface Bit {
  g: Graphics;
  vx: number;
  vy: number;
  spin: number;
  age: number;
  life: number;
}

const CONFETTI = [0xf4bd62, 0xff8fb1, 0x9be8ae, 0x9fc6ff, 0xfff1c9, 0xe9a14a];

export class Floaters extends Container {
  private items: Floater[] = [];
  private bits: Bit[] = [];
  /** yazılar ekranda sabit boyda kalsın: dünya ölçeğinin tersi (kamera yakınlaşınca dev yazı olmasın) */
  textScale = 1;

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
    const y0 = at.y - (6 + stack * 22) * this.textScale;
    t.scale.set(this.textScale);
    t.position.set(Math.round(at.x), y0);
    this.addChild(t);
    this.items.push({ t, age: 0, life: 1.8, y0 });
  }

  /** Kutlama: noktadan saçılan konfeti (yeni öğrenci, hedef, taşınma). */
  burst(at: WorldPoint, count = 26): void {
    for (let i = 0; i < count; i++) {
      const g = new Graphics().rect(-3, -1.5, 6, 3).fill(CONFETTI[i % CONFETTI.length]);
      g.position.set(at.x, at.y);
      g.rotation = Math.random() * Math.PI;
      this.addChild(g);
      const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.2;
      const v = 90 + Math.random() * 150;
      this.bits.push({ g, vx: Math.cos(a) * v, vy: Math.sin(a) * v, spin: (Math.random() - 0.5) * 14, age: 0, life: 1.1 + Math.random() * 0.6 });
    }
  }

  update(dtSeconds: number): void {
    for (const b of this.bits) {
      b.age += dtSeconds;
      b.vy += 320 * dtSeconds; // yer çekimi
      b.vx *= 1 - 1.2 * dtSeconds;
      b.g.x += b.vx * dtSeconds * this.textScale;
      b.g.y += b.vy * dtSeconds * this.textScale;
      b.g.rotation += b.spin * dtSeconds;
      b.g.scale.set(Math.cos(b.age * 9) * this.textScale, this.textScale); // dönerken yassılaşır
      b.g.alpha = Math.min(1, (b.life - b.age) / 0.35);
    }
    for (const b of this.bits.filter((x) => x.age >= x.life)) b.g.destroy();
    this.bits = this.bits.filter((x) => x.age < x.life);
    for (const f of this.items) {
      f.age += dtSeconds;
      const k = f.age / f.life;
      f.t.scale.set(this.textScale);
      f.t.y = f.y0 - 38 * this.textScale * Math.min(1, k * 1.4);
      f.t.alpha = k < 0.7 ? 1 : Math.max(0, 1 - (k - 0.7) / 0.3);
    }
    for (const f of this.items.filter((x) => x.age >= x.life)) {
      this.removeChild(f.t);
      f.t.destroy();
    }
    this.items = this.items.filter((x) => x.age < x.life);
  }
}
