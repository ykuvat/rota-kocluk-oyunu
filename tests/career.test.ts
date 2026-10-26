// KUVAT LABS — Rota
import { describe, expect, it } from "vitest";
import { CAREER } from "../src/content/career";
import { careerProgress, careerResult } from "../src/sim/career";
import { createState } from "../src/sim/state";
import { closeReport, runFinalExam } from "../src/sim/season";
import { createRng } from "../src/core/rng";

const fresh = () => createState(1, 20);
const card = (s: ReturnType<typeof fresh>, id: string, rate?: number | null) => careerProgress(s, rate).find((c) => c.id === id)!;

describe("kariyer kartları", () => {
  it("başarı: tam eşik geçer, altı geçmez", () => {
    const s = fresh();
    expect(card(s, "success", CAREER.successRate).done).toBe(true);
    expect(card(s, "success", CAREER.successRate - 0.01).done).toBe(false);
    expect(card(s, "success", null).done).toBe(false);
  });
  it("güven: tam eşik geçer, altı geçmez", () => {
    const s = fresh();
    s.reputation.trust = CAREER.trust;
    expect(card(s, "trust").done).toBe(true);
    s.reputation.trust = CAREER.trust - 0.1;
    expect(card(s, "trust").done).toBe(false);
  });
  it("büyüme: şube sayısı", () => {
    const s = fresh();
    expect(card(s, "growth").done).toBe(false);
    s.branches = ["x"];
    expect(card(s, "growth").done).toBe(true);
  });
  it("kademe = tutturulan kart sayısı", () => {
    const s = fresh();
    s.reputation.trust = 0;
    expect(careerResult(s, 0).tier).toBe("coach");
    expect(careerResult(s, 0.6).tier).toBe("bronze");
    s.reputation.trust = 90;
    expect(careerResult(s, 0.6).tier).toBe("silver");
    s.branches = ["x"];
    const r = careerResult(s, 0.6);
    expect(r.tier).toBe("gold");
    expect(r.done).toBe(3);
    expect(r.cards.map((c) => c.id)).toEqual(["success", "trust", "growth"]);
  });
  it("saf: aynı girdi aynı sonuç, durumu değiştirmez", () => {
    const s = fresh();
    const before = JSON.stringify(s);
    expect(careerResult(s, 0.7)).toEqual(careerResult(s, 0.7));
    expect(JSON.stringify(s)).toBe(before);
  });
});

describe("sezon raporunda kariyer", () => {
  it("yalnız final sezonunda dolu ve careerEnded bir kez yayılır", () => {
    const s = fresh();
    const rng = createRng(5);
    const reports = [];
    for (let i = 0; i < CAREER.seasons; i++) {
      reports.push(runFinalExam(s, rng));
      closeReport(s);
    }
    expect(reports.slice(0, -1).every((r) => r.career === undefined)).toBe(true);
    const last = reports.at(-1)!;
    expect(last.career).toBeDefined();
    expect(last.career!.done).toBe(last.career!.cards.filter((c) => c.done).length);
    // 4. sezon: final tekrar çıkmaz
    expect(runFinalExam(s, rng).career).toBeUndefined();
    expect(s.log.filter((e) => e.type === "careerEnded").length).toBe(1);
    expect(s.history.filter((e) => e.type === "careerEnded").length).toBe(1);
  });
});
