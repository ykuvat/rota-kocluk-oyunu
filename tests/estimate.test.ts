import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "../src/content/archetypes";
import { BALANCE } from "../src/content/balance";
import { balancedProgram, overloadedProgram } from "../src/content/programs";
import { applyCommand } from "../src/sim/commands";
import { estimateProgram } from "../src/sim/estimate";
import { createState } from "../src/sim/state";
import { complianceProbability, complianceTerms, sustainableHours, type ProgramBlock, type Student } from "../src/sim/student";

function setup(archetype = "quiet_drifter", seed = 31) {
  const state = createState(seed, BALANCE.coach.weeklyHours);
  applyCommand(state, { type: "addStudent", archetype });
  return { state, s: state.students[0] };
}

/** Gerçek değerlerle beklenen uyum (simülasyonla aynı mantık). */
function realCompliance(s: Student, blocks: ProgramBlock[], now: number): number {
  let sum = 0;
  for (let d = 0; d < 7; d++) {
    const today = blocks.filter((b) => b.weekday === d);
    const hours = today.reduce((a, b) => a + b.hours, 0);
    const over = Math.max(0, hours / sustainableHours(s, now, d) - 1);
    for (const b of today) sum += complianceProbability(complianceTerms(s, b, over, now));
  }
  return sum / blocks.length;
}

describe("program tahmini", () => {
  it("tahmin aralığı gerçek uyumu çoğu öğrencide içerir ve işe yarar genişliktedir", () => {
    let inside = 0, total = 0, width = 0;
    for (const archetype of Object.keys(ARCHETYPES)) {
      for (let seed = 0; seed < 10; seed++) {
        const { state, s } = setup(archetype, 500 + seed);
        const blocks = balancedProgram(s);
        const est = estimateProgram(s, blocks, state.hour).compliance;
        const real = realCompliance(s, blocks, state.hour);
        if (real >= est.lo - 0.02 && real <= est.hi + 0.02) inside++;
        width += est.hi - est.lo;
        total++;
      }
    }
    expect(inside / total).toBeGreaterThanOrEqual(0.8);
    expect(width / total).toBeLessThan(0.6); // ilk tanışmada bile %2–%98 gibi anlamsız değil
  });

  it("öğrenci tanındıkça aralık daralır", () => {
    const { state, s } = setup();
    const blocks = balancedProgram(s);
    const before = estimateProgram(s, blocks, state.hour).compliance;
    for (const topic of ["motivation", "habits", "feelings", "habits", "motivation"] as const) {
      applyCommand(state, { type: "interview", studentId: s.id, topic });
    }
    const after = estimateProgram(s, blocks, state.hour).compliance;
    expect(after.hi - after.lo).toBeLessThan(before.hi - before.lo);
  });

  it("aşırı yüklü program daha düşük uyum ve aşım günleri gösterir", () => {
    const { state, s } = setup();
    const bal = estimateProgram(s, balancedProgram(s), state.hour);
    const ovr = estimateProgram(s, overloadedProgram(s), state.hour);
    expect(ovr.compliance.mid).toBeLessThan(bal.compliance.mid);
    expect(ovr.dayLoad.filter((x) => x === "over").length).toBeGreaterThan(0);
  });

  it("dengeli şablon hiçbir günü aşırı yüklemez", () => {
    const { state, s } = setup("anxious_perfectionist");
    expect(estimateProgram(s, balancedProgram(s), state.hour).dayLoad).not.toContain("over");
  });
});
