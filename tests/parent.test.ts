import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "../src/content/archetypes";
import { BALANCE } from "../src/content/balance";
import { balancedProgram } from "../src/content/programs";
import { HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { parentSignals, perceivedProgress } from "../src/sim/parent";
import { createState } from "../src/sim/state";
import { advance } from "../src/sim/step";

function game(archetype: string, seed: number) {
  const state = createState(seed, BALANCE.coach.weeklyHours);
  applyCommand(state, { type: "addStudent", archetype });
  const s = state.students[0];
  applyCommand(state, { type: "setProgram", studentId: s.id, blocks: balancedProgram(s) });
  return { state, s };
}

describe("veli", () => {
  it("veli görüşmesi tarzı görünür kılar, memnuniyeti artırır, beklentiyi ayarlar", () => {
    const { state, s } = game("anxious_perfectionist", 1);
    const before = { ...s.parent };
    expect(s.parent.known).toBe(false);
    applyCommand(state, { type: "parentMeeting", studentId: s.id });
    expect(s.parent.known).toBe(true);
    expect(s.parent.satisfaction).toBeGreaterThan(before.satisfaction);
    expect(s.parent.expectation).toBeLessThanOrEqual(before.expectation);
    expect(state.coach.usedThisWeek).toBe(BALANCE.parent.meetingHours);
  });

  it("aranmayan talepkâr veli huzursuzlanır ve sinyal verir; görüşülen daha memnun kalır", () => {
    const a = game("quiet_drifter", 2);
    const b = game("quiet_drifter", 2);
    for (const g of [a, b]) {
      g.s.parent.style = "demanding";
      g.s.parent.expectation = 90;
    }
    for (let w = 0; w < 8; w++) {
      if (w % 2 === 0) applyCommand(b.state, { type: "parentMeeting", studentId: b.s.id });
      advance(a.state, HOURS_PER_WEEK);
      advance(b.state, HOURS_PER_WEEK);
    }
    expect(b.s.parent.satisfaction).toBeGreaterThan(a.s.parent.satisfaction);
    expect(parentSignals(a.s, 8)).toContain("signal.parentCalls");
  });

  it("algılanan gelişim veri yokken nötrdür", () => {
    const { s } = game("talented_messy", 3);
    expect(perceivedProgress(s)).toBe(50);
  });

  it("ayrılan öğrenci simülasyondan çıkar ve komut almaz", () => {
    const { state, s } = game("quiet_drifter", 4);
    s.parent.satisfaction = 12;
    s.parent.style = "demanding";
    s.parent.expectation = 95;
    advance(state, HOURS_PER_WEEK * 3);
    expect(s.left).toBe(true);
    expect(state.log.some((e) => e.type === "studentLeft")).toBe(true);
    const weeks = s.history.length;
    advance(state, HOURS_PER_WEEK * 2);
    expect(s.history.length).toBe(weeks);
    expect(applyCommand(state, { type: "intervene", studentId: s.id, intervention: "trustTalk" })).toEqual({ ok: false, error: "student.left" });
  });
});

describe("denge: veliyle iletişim öğrenci kaybını azaltır", () => {
  it("20 hafta, tüm arşetipler", () => {
    let lostPassive = 0, lostActive = 0, n = 0;
    for (const archetype of Object.keys(ARCHETYPES)) {
      for (let seed = 0; seed < 12; seed++) {
        const p = game(archetype, 3000 + seed);
        const a = game(archetype, 3000 + seed);
        for (let w = 0; w < 20; w++) {
          if (w % 3 === 0) applyCommand(a.state, { type: "parentMeeting", studentId: a.s.id });
          advance(p.state, HOURS_PER_WEEK);
          advance(a.state, HOURS_PER_WEEK);
        }
        lostPassive += p.s.left ? 1 : 0;
        lostActive += a.s.left ? 1 : 0;
        n++;
      }
    }
    console.log(`20 hafta öğrenci kaybı — veliyle görüşmeyen: ${lostPassive}/${n}, 3 haftada bir görüşen: ${lostActive}/${n}`);
    expect(lostActive).toBeLessThan(lostPassive);
  });
});
