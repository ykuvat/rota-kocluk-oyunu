import { describe, expect, it } from "vitest";
import { averageRuns, formatTable } from "./bot";

// 3 sezonluk tam oyun (≈ 2,8 yıl oyun zamanı). Tohum sayısı FULLGAME_SEEDS ile artırılabilir.
const N = Number((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env.FULLGAME_SEEDS ?? 12); // 6 tohumda tutturma oranı ±%10 oynuyordu
const seeds = Array.from({ length: N }, (_, i) => 9000 + i);

describe("tam oyun dengesi: 3 sezon", () => {
  it("makul oyuncu büyür ve kazanır; pasif ve uç fiyatlar geride kalır", () => {
    const good = averageRuns("good", seeds);
    const passive = averageRuns("passive", seeds);
    const cheap = averageRuns("cheap", seeds);
    const greedy = averageRuns("greedy", seeds);
    console.log([formatTable("good", good), formatTable("passive", passive), formatTable("cheap", cheap), formatTable("greedy", greedy)].join("\n"));
    const v = (rows: typeof good, i: number, k: string) => Number(rows[i][k]);
    expect(good.length).toBe(3);
    // makul oyuncu iflas etmez, her sezon büyür
    for (let i = 0; i < 3; i++) expect(v(good, i, "bankrupt")).toBeLessThanOrEqual(0.2);
    expect(v(good, 2, "worth")).toBeGreaterThan(v(good, 0, "worth"));
    expect(v(good, 2, "worth")).toBeGreaterThan(100_000);
    // sınav zorlu ama ulaşılabilir: oturmuş bir kurumda tutturma %50–95
    expect(v(good, 2, "hitRate")).toBeGreaterThan(0.5);
    expect(v(good, 2, "hitRate")).toBeLessThan(0.95);
    // ilgisiz oyuncu çoğunlukla ilk yıl batar
    expect(v(passive, 0, "bankrupt")).toBeGreaterThanOrEqual(0.5);
    // uç fiyatlar makul fiyatın gerisinde: pahalı az öğrenci/iflas riski, ucuz kalite çöküşü
    expect(v(greedy, 2, "worth")).toBeLessThan(v(good, 2, "worth"));
    expect(v(cheap, 2, "worth")).toBeLessThan(v(good, 2, "worth"));
    expect(v(cheap, 2, "hitRate")).toBeLessThan(v(good, 2, "hitRate"));
  }, 120_000);
});
