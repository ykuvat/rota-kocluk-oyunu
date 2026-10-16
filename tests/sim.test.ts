import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { balancedProgram } from "../src/content/programs";
import { createRng } from "../src/core/rng";
import { calendarAt, daysUntil, HOURS_PER_WEEK, START_HOUR } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { evaluate } from "../src/sim/modifiers";
import { createState, type GameState } from "../src/sim/state";
import { advance, stateHash } from "../src/sim/step";
import {
  complianceProbability,
  complianceTerms,
  generateStudent,
  masteryGain,
  prereqFactor,
  stat,
  type ProgramBlock,
} from "../src/sim/student";

describe("takvim", () => {
  it("sezon 7 Eylül 2026 Pazartesi 08:00'de başlar", () => {
    const c = calendarAt(START_HOUR);
    expect(c.iso).toBe("2026-09-07");
    expect(c.weekday).toBe(0);
    expect(c.hourOfDay).toBe(8);
  });

  it("hafta ve ay geçişleri doğru", () => {
    expect(calendarAt(HOURS_PER_WEEK).weekIndex).toBe(1);
    expect(calendarAt(24 * 24).iso).toBe("2026-10-01");
  });

  it("sınava kalan gün", () => {
    expect(daysUntil(0, "2026-09-08")).toBe(1);
  });
});

describe("değiştirici yığını", () => {
  it("çarpan önce, toplanan sonra uygulanır ve her katkı raporlanır", () => {
    const b = evaluate("motivation", 50, [
      { stat: "motivation", source: "a", add: 10 },
      { stat: "motivation", source: "b", mul: 0.5 },
      { stat: "fatigue", source: "c", add: 99 },
    ], 0);
    expect(b.value).toBe(35);
    expect(b.parts).toEqual([{ source: "b", delta: -25 }, { source: "a", delta: 10 }]);
  });

  it("süresi dolan değiştirici etkisizdir; değer sınırlanır", () => {
    expect(evaluate("x", 50, [{ stat: "x", source: "s", add: 10, until: 5 }], 5).value).toBe(50);
    expect(evaluate("x", 95, [{ stat: "x", source: "s", add: 20 }], 0).value).toBe(100);
  });
});

function newGame(seed = 1234): { state: GameState; id: string } {
  const state = createState(seed, BALANCE.coach.weeklyHours);
  const r = applyCommand(state, { type: "addStudent", archetype: "quiet_drifter" });
  if (!r.ok || !r.id) throw new Error("öğrenci eklenemedi");
  const s = state.students[0];
  applyCommand(state, { type: "setProgram", studentId: r.id, blocks: balancedProgram(s) });
  return { state, id: r.id };
}

describe("determinizm", () => {
  it("aynı tohum + aynı komutlar = aynı durum", () => {
    const a = newGame(99), b = newGame(99);
    advance(a.state, HOURS_PER_WEEK * 3);
    advance(b.state, HOURS_PER_WEEK * 3);
    expect(stateHash(a.state)).toBe(stateHash(b.state));
  });

  it("parça parça ilerletmek tek seferde ilerletmekle aynı", () => {
    const a = newGame(7), b = newGame(7);
    advance(a.state, 500);
    for (let i = 0; i < 50; i++) advance(b.state, 10);
    expect(stateHash(a.state)).toBe(stateHash(b.state));
  });

  it("durum JSON'a gidip gelince aynı kalır (kayıt dosyası)", () => {
    const a = newGame(5);
    advance(a.state, 200);
    const copy: GameState = JSON.parse(JSON.stringify(a.state));
    advance(a.state, 300);
    advance(copy, 300);
    expect(stateHash(copy)).toBe(stateHash(a.state));
  });

  it("farklı tohum farklı öğrenci üretir", () => {
    expect(newGame(1).state.students[0].mastery).not.toEqual(newGame(2).state.students[0].mastery);
  });
});

describe("öğrenci formülleri", () => {
  const s = generateStudent("t", "anxious_perfectionist", createRng(3));
  const block: ProgramBlock = { weekday: 0, topicId: "mat.fonksiyonlar", hours: 2, kind: "study" };

  it("aşırı yük uyum olasılığını düşürür", () => {
    const light = complianceProbability(complianceTerms(s, block, 0, 0));
    const heavy = complianceProbability(complianceTerms(s, block, 1.5, 0));
    expect(heavy).toBeLessThan(light);
  });

  it("ustalık arttıkça kazanç azalır (azalan getiri)", () => {
    const low = { ...s, mastery: { ...s.mastery, "mat.fonksiyonlar": 20 } };
    const high = { ...s, mastery: { ...s.mastery, "mat.fonksiyonlar": 80 } };
    expect(masteryGain(high, block, 0)).toBeLessThan(masteryGain(low, block, 0));
  });

  it("zayıf ön koşul kazancı düşürür", () => {
    const weak = { ...s, mastery: { ...s.mastery, "mat.denklemler": 10 } };
    const strong = { ...s, mastery: { ...s.mastery, "mat.denklemler": 80 } };
    expect(prereqFactor(weak, "mat.fonksiyonlar")).toBeLessThan(prereqFactor(strong, "mat.fonksiyonlar"));
    expect(prereqFactor(strong, "mat.fonksiyonlar")).toBe(1);
  });
});

describe("komutlar", () => {
  it("müdahale geçici değiştirici ekler; tekrarı daha az etkilidir; süresi dolunca biter", () => {
    const { state, id } = newGame();
    const s = state.students[0];
    const before = stat(s, "trust", state.hour).value;
    applyCommand(state, { type: "intervene", studentId: id, intervention: "trustTalk" });
    const after1 = stat(s, "trust", state.hour).value;
    applyCommand(state, { type: "intervene", studentId: id, intervention: "trustTalk" });
    const after2 = stat(s, "trust", state.hour).value;
    expect(after1 - before).toBeGreaterThan(after2 - after1);
    expect(stat(s, "trust", state.hour).parts.every((p) => p.source === "iv.trustTalk")).toBe(true);
    advance(state, 24 * 22);
    expect(stat(s, "trust", state.hour).parts.some((p) => p.source === "iv.trustTalk")).toBe(false);
  });

  it("koçun haftalık saati aşılamaz", () => {
    const { state, id } = newGame();
    let lastOk = true;
    for (let i = 0; i < 60 && lastOk; i++) lastOk = applyCommand(state, { type: "interview", studentId: id, topic: "habits" }).ok;
    const r = applyCommand(state, { type: "interview", studentId: id, topic: "habits" });
    expect(r).toEqual({ ok: false, error: "coach.noTime" });
    expect(state.coach.usedThisWeek).toBeLessThanOrEqual(state.coach.weeklyHours);
  });

  it("geçersiz komut durumu değiştirmez", () => {
    const { state, id } = newGame();
    const h = stateHash(state);
    expect(applyCommand(state, { type: "setProgram", studentId: id, blocks: [{ weekday: 9, topicId: "mat.sayilar", hours: 1, kind: "study" }] }).ok).toBe(false);
    expect(applyCommand(state, { type: "addStudent", archetype: "yok" }).ok).toBe(false);
    expect(stateHash(state)).toBe(h);
  });

  it("hafta kapanınca kayıt arşivlenir ve olay yazılır", () => {
    const { state } = newGame();
    advance(state, HOURS_PER_WEEK);
    expect(state.students[0].history.length).toBe(1);
    expect(state.log.some((e) => e.type === "weekClosed")).toBe(true);
  });
});
