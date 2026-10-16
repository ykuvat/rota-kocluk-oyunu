import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { balancedProgram, overloadedProgram } from "../src/content/programs";
import { createRng } from "../src/core/rng";
import { HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { expectedNet, questionProbability, takeMockExam } from "../src/sim/exam";
import { dominantCauseLastWeek, observe, weeklySignals } from "../src/sim/insight";
import { createState } from "../src/sim/state";
import { advance } from "../src/sim/step";
import { generateStudent, stat, sustainableHours } from "../src/sim/student";

function game(archetype: string, seed = 11) {
  const state = createState(seed, BALANCE.coach.weeklyHours);
  const r = applyCommand(state, { type: "addStudent", archetype });
  const id = r.ok ? r.id! : "";
  applyCommand(state, { type: "setProgram", studentId: id, blocks: balancedProgram(state.students[0]) });
  return { state, id, s: state.students[0] };
}

describe("deneme sınavı", () => {
  it("ustalık zorluğu aştıkça doğru olasılığı artar", () => {
    expect(questionProbability(80, 50)).toBeGreaterThan(questionProbability(40, 50));
  });

  it("iki haftada bir cumartesi yapılır ve kaydedilir", () => {
    const { state, s } = game("anxious_perfectionist");
    advance(state, HOURS_PER_WEEK * 4);
    expect(s.mocks.length).toBe(2);
    expect(state.log.filter((e) => e.type === "mockExam").length).toBe(2);
  });

  it("tek deneme gürültülüdür ama ortalaması beklenen nete yakındır", () => {
    const s = generateStudent("x", "talented_messy", createRng(4));
    const rng = createRng(77);
    const totals = Array.from({ length: 400 }, () => takeMockExam(s, 0, 0, rng).total);
    const mean = totals.reduce((a, b) => a + b, 0) / totals.length;
    const sd = Math.sqrt(totals.reduce((a, b) => a + (b - mean) ** 2, 0) / totals.length);
    expect(Math.abs(mean - expectedNet(s, 0))).toBeLessThan(1);
    expect(sd).toBeGreaterThan(2);
  });

  it("kaygı neti düşürür", () => {
    const calm = generateStudent("c", "talented_messy", createRng(4));
    const anxious = { ...calm, base: { ...calm.base, anxiety: 95 } };
    expect(expectedNet(anxious, 0)).toBeLessThan(expectedNet(calm, 0));
  });
});

describe("gözlem sisi", () => {
  it("aralık gerçek değeri içerir ve görüşmeyle daralır", () => {
    const { state, id, s } = game("quiet_drifter");
    const before = observe(s, "routine", state.hour);
    const real = stat(s, "routine", state.hour).value;
    expect(before.lo).toBeLessThanOrEqual(real);
    expect(before.hi).toBeGreaterThanOrEqual(real);
    applyCommand(state, { type: "interview", studentId: id, topic: "habits" });
    applyCommand(state, { type: "interview", studentId: id, topic: "habits" });
    const after = observe(s, "routine", state.hour);
    expect(after.hi - after.lo).toBeLessThan(before.hi - before.lo);
    expect(after.lo).toBeLessThanOrEqual(real + 1);
    expect(after.hi).toBeGreaterThanOrEqual(real - 1);
  });

  it("güveni düşük öğrenciden görüşme daha az bilgi verir", () => {
    const a = game("quiet_drifter", 3);
    const b = game("quiet_drifter", 3);
    b.s.base.trust = 90;
    applyCommand(a.state, { type: "interview", studentId: a.id, topic: "habits" });
    applyCommand(b.state, { type: "interview", studentId: b.id, topic: "habits" });
    expect(a.s.insight.routine!).toBeLessThan(b.s.insight.routine!);
  });

  it("aşırı yük sinyal üretir ve baskın neden olarak görünür", () => {
    const { state, id, s } = game("talented_messy");
    applyCommand(state, { type: "setProgram", studentId: id, blocks: overloadedProgram(s) });
    advance(state, HOURS_PER_WEEK);
    expect(weeklySignals(s).length).toBeGreaterThan(0);
    expect(dominantCauseLastWeek(s)).not.toBeNull();
  });
});

describe("müdahale uyumu", () => {
  it("doğru nedene müdahale güveni artırır, yanlış müdahale düşürür", () => {
    const a = game("quiet_drifter", 21);
    const b = game("quiet_drifter", 21);
    advance(a.state, HOURS_PER_WEEK);
    advance(b.state, HOURS_PER_WEEK);
    const cause = dominantCauseLastWeek(a.s);
    expect(cause).not.toBeNull();
    const right = cause === "trust" ? "trustTalk" : cause === "distraction" ? "focusPlan" : cause === "fatigue" ? "restPlan" : "smallGoals";
    const wrong = cause === "fatigue" ? "focusPlan" : "restPlan";
    const ra = applyCommand(a.state, { type: "intervene", studentId: a.id, intervention: right });
    const rb = applyCommand(b.state, { type: "intervene", studentId: b.id, intervention: wrong });
    expect(ra).toMatchObject({ ok: true, matched: true });
    expect(rb).toMatchObject({ ok: true, matched: false });
    expect(stat(a.s, "trust", a.state.hour).parts.some((p) => p.source === "iv.matched")).toBe(true);
    expect(stat(b.s, "trust", b.state.hour).parts.some((p) => p.source === "iv.mismatched")).toBe(true);
  });

  it("programı sadeleştirmek günlük yükü sürdürülebilir sınıra indirir", () => {
    const { state, id, s } = game("talented_messy");
    applyCommand(state, { type: "setProgram", studentId: id, blocks: overloadedProgram(s) });
    applyCommand(state, { type: "intervene", studentId: id, intervention: "simplifyProgram" });
    for (let d = 0; d < 7; d++) {
      const day = s.program.filter((b) => b.weekday === d).reduce((a, b) => a + b.hours, 0);
      expect(day).toBeLessThanOrEqual(sustainableHours(s, state.hour, d));
    }
  });

  it("güven yetersizse öğrencinin kendi hedefini koyması reddedilir", () => {
    const { state, id, s } = game("quiet_drifter");
    s.base.trust = 10;
    expect(applyCommand(state, { type: "intervene", studentId: id, intervention: "studentSetsGoal" })).toEqual({ ok: false, error: "intervention.lowTrust" });
  });
});
