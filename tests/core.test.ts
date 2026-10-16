import { describe, expect, it } from "vitest";
import { depthKey, footprintAnchorOffsetX, screenToTile, tileToScreen } from "../src/core/iso";
import { createRng } from "../src/core/rng";
import { sortKeys } from "../src/render/RoomScene";
import { homeStudio } from "../src/content/rooms/homeStudio";

describe("iso", () => {
  it("karo köşeleri 128x64 baklava oluşturur", () => {
    expect(tileToScreen(0, 0)).toEqual({ x: 0, y: 0 });
    expect(tileToScreen(1, 0)).toEqual({ x: 64, y: 32 });
    expect(tileToScreen(0, 1)).toEqual({ x: -64, y: 32 });
    expect(tileToScreen(1, 1)).toEqual({ x: 0, y: 64 });
  });

  it("ekran -> karo dönüşümü tersini verir", () => {
    for (const [tx, ty] of [[0, 0], [2.5, 1], [0.3, 2.7], [3, 3]]) {
      const s = tileToScreen(tx, ty);
      const back = screenToTile(s.x, s.y);
      expect(back.x).toBeCloseTo(tx, 9);
      expect(back.y).toBeCloseTo(ty, 9);
    }
  });

  it("kare taban izinde çapa kaymaz, dikdörtgende uzun kenara doğru kayar", () => {
    expect(footprintAnchorOffsetX(0.5, 0.5)).toBe(0);
    expect(footprintAnchorOffsetX(0.6, 1.2)).toBeLessThan(0);
  });

  it("öndeki nesne daha sonra çizilir", () => {
    expect(depthKey(1, 1, 0.5, 0.5)).toBeGreaterThan(depthKey(0, 0, 0.5, 0.5));
  });
});

describe("rng", () => {
  it("aynı tohum aynı diziyi verir", () => {
    const a = createRng(42), b = createRng(42);
    const sa = Array.from({ length: 50 }, () => a.next());
    const sb = Array.from({ length: 50 }, () => b.next());
    expect(sa).toEqual(sb);
    expect(sa.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("farklı tohum farklı dizi verir", () => {
    expect(createRng(1).next()).not.toEqual(createRng(2).next());
  });

  it("int sınırlar içinde kalır", () => {
    const r = createRng(7);
    for (let i = 0; i < 1000; i++) {
      const v = r.int(3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });
});

describe("oda yerleşimi", () => {
  it("masa üstündeki eşyalar masadan hemen sonra, öndeki nesnelerden önce çizilir", () => {
    const keys = sortKeys(homeStudio.placements);
    const desk = keys.get("desk")!;
    expect(keys.get("laptop")!).toBeGreaterThan(desk);
    expect(keys.get("lamp")!).toBeGreaterThan(desk);
    expect(keys.get("laptop")!).toBeLessThan(keys.get("chair")!);
  });

  it("tüm nesneler oda sınırları içinde", () => {
    for (const p of homeStudio.placements) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.fx).toBeLessThanOrEqual(homeStudio.tilesX);
      expect(p.y + p.fy).toBeLessThanOrEqual(homeStudio.tilesY);
    }
  });
});
