// KUVAT LABS — Rota
import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { INTERVENTIONS } from "../src/content/interventions";
import { DELEGATION, STAFF } from "../src/content/staff";
import { createRng } from "../src/core/rng";
import { applyCommand } from "../src/sim/commands";
import type { StaffMember } from "../src/sim/staff";
import { isStaffHandled, staffHitChance, staffWeeklyDecisions } from "../src/sim/staffDecisions";
import { createState, type GameState } from "../src/sim/state";

function member(skill: number): StaffMember {
  return { id: "t1", name: "Elif", role: "coach", skill, skillLo: skill, skillHi: skill, salary: 20_000, morale: 70, usedThisWeek: 0, weeksEmployed: 10 };
}

function setup(skill: number): { s: GameState; m: StaffMember } {
  const s = createState(77, BALANCE.coach.weeklyHours);
  const m = member(skill);
  s.staff.members.push(m);
  applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
  applyCommand(s, { type: "assignCoach", studentId: s.students[0].id, coachId: m.id });
  return { s, m };
}

/** Geçen hafta baskın neden "motivation" olan, sinyal veren öğrenci. */
function giveSignals(s: GameState): void {
  s.students[0].history = [{ week: 1, assigned: 6, done: 2, hours: 5, avgMastery: 30, missCauses: { motivation: 4 } }];
  s.students[0].ivThisWeek = 0;
}

function hitRate(skill: number, weeks: number): number {
  const { s, m } = setup(skill);
  const rng = createRng(1234);
  let hits = 0, total = 0;
  for (let i = 0; i < weeks; i++) {
    giveSignals(s);
    m.usedThisWeek = 0;
    s.log = [];
    staffWeeklyDecisions(s, rng);
    for (const e of s.log) if (e.type === "staffIntervention") { total++; if (e.data.matched) hits++; }
  }
  expect(total).toBe(weeks);
  return hits / total;
}

describe("yardımcı koçun haftalık kararları", () => {
  it("S1: atanmış öğrenci koçun işidir; atama kalkınca oyuncuya döner", () => {
    const { s } = setup(60);
    const st = s.students[0];
    expect(isStaffHandled(s, st)).toBe(true);
    applyCommand(s, { type: "assignCoach", studentId: st.id, coachId: null });
    expect(isStaffHandled(s, st)).toBe(false);
  });

  it("S2: müdahale Buse'nin saatinden değil koçun saatinden düşer; saat yetmezse yapılmaz", () => {
    const { s, m } = setup(60);
    giveSignals(s);
    const buse = s.coach.usedThisWeek;
    staffWeeklyDecisions(s, createRng(5));
    expect(s.coach.usedThisWeek).toBe(buse);
    expect(m.usedThisWeek).toBeGreaterThan(0);
    expect(s.log.some((e) => e.type === "staffIntervention")).toBe(true);

    giveSignals(s);
    s.log = [];
    m.usedThisWeek = STAFF.weeklyHours - 0.25;
    const before = m.usedThisWeek;
    staffWeeklyDecisions(s, createRng(6));
    expect(m.usedThisWeek).toBe(before);
    expect(s.log.some((e) => e.type === "staffIntervention")).toBe(false);
    expect(s.coach.usedThisWeek).toBe(buse);
  });

  it("S3: isabet beceriyle artar ve deterministiktir", () => {
    expect(staffHitChance(DELEGATION.skillLow)).toBeCloseTo(DELEGATION.hitLow);
    expect(staffHitChance(DELEGATION.skillHigh)).toBeCloseTo(DELEGATION.hitHigh);
    const low = hitRate(30, 100);
    const high = hitRate(90, 100);
    expect(high).toBeGreaterThan(low + 0.2);
    expect(hitRate(90, 100)).toBe(high);
    // doğru çare müdahalenin hedefleri arasındadır
    const def = Object.values(INTERVENTIONS).filter((d) => d.targets.includes("motivation"));
    expect(def.length).toBeGreaterThan(0);
  });

  it("veli sinyali varsa koç kendi saatiyle veliyle görüşür", () => {
    const { s, m } = setup(60);
    s.students[0].parent.style = "anxious";
    s.students[0].parent.lastMeetingWeek = null;
    staffWeeklyDecisions(s, createRng(9));
    expect(s.log.some((e) => e.type === "staffParentMeeting")).toBe(true);
    expect(m.usedThisWeek).toBe(BALANCE.parent.meetingHours);
    expect(s.coach.usedThisWeek).toBe(0);
  });
});
