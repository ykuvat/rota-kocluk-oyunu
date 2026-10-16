import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { COACHING } from "../src/content/business";
import { EVENTS } from "../src/content/events";
import { balancedProgram } from "../src/content/programs";
import { STAFF } from "../src/content/staff";
import { createRng } from "../src/core/rng";
import { HOURS_PER_DAY, HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { caseload, marketSalary, refreshCandidates } from "../src/sim/staff";
import { createState, type GameState } from "../src/sim/state";
import { advance } from "../src/sim/step";
import { migrate, serialize } from "../src/platform/save";

function officeState(seed: number): GameState {
  const s = createState(seed, BALANCE.coach.weeklyHours);
  for (const e of EVENTS) s.events.lastFired[e.id] = s.hour + 100_000;
  s.stage = 2;
  s.economy.business = 300_000;
  applyCommand(s, { type: "rentOffice", officeId: "central" });
  applyCommand(s, { type: "setMarketing", networkActive: false, organicHours: 0, paidBudget: 0 });
  return s;
}

function hireOne(s: GameState, skill?: number) {
  refreshCandidates(s, createRng(1));
  const c = s.staff.candidates[0];
  if (skill !== undefined) c.skill = skill;
  expect(applyCommand(s, { type: "hireStaff", candidateId: c.id })).toEqual({ ok: true });
  return s.staff.members.at(-1)!;
}

describe("personel", () => {
  it("ofis olmadan işe alım yok; ofisle aday gelir", () => {
    const s = createState(1, 50);
    refreshCandidates(s, createRng(1));
    expect(s.staff.candidates.length).toBe(0);
    const o = officeState(2);
    advance(o, HOURS_PER_WEEK * 2);
    expect(o.staff.candidates.length).toBeGreaterThan(0);
    const c = o.staff.candidates[0];
    expect(c.skillLo).toBeLessThanOrEqual(c.skill + 1);
    expect(c.skillHi).toBeGreaterThanOrEqual(c.skill - 1);
  });

  it("maaş + işveren maliyeti ayın 1'inde işletmeden çıkar", () => {
    const s = officeState(3);
    const m = hireOne(s);
    advance(s, 24 * HOURS_PER_DAY + 2);
    expect(s.economy.totals.salaries).toBe(-Math.round(m.salary * (1 + STAFF.employerCostRate)));
  });

  it("atanan öğrencinin takibi yardımcı koçun saatinden düşer", () => {
    const s = officeState(4);
    const m = hireOne(s, 70);
    for (let i = 0; i < 4; i++) applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    for (const st of s.students.slice(0, 3)) applyCommand(s, { type: "assignCoach", studentId: st.id, coachId: m.id });
    advance(s, HOURS_PER_WEEK);
    expect(m.usedThisWeek).toBe(3 * COACHING.followUpHours);
    expect(s.coach.usedThisWeek).toBe(1 * COACHING.followUpHours);
    expect(caseload(s, m.id)).toBe(3);
    expect(s.students[0].mods.some((x) => x.source === "staff.quality" && (x.add ?? 0) > 0)).toBe(true);
  });

  it("zayıf yardımcı koç güveni düşürür", () => {
    const s = officeState(5);
    const m = hireOne(s, 30);
    applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    applyCommand(s, { type: "assignCoach", studentId: s.students[0].id, coachId: m.id });
    advance(s, HOURS_PER_WEEK);
    expect(s.students[0].mods.some((x) => x.source === "staff.quality" && (x.add ?? 0) < 0)).toBe(true);
  });

  it("vaka yükü koç başına: işi dağıtmak cezayı kaldırır", () => {
    const crowded = officeState(6);
    for (let i = 0; i < 12; i++) applyCommand(crowded, { type: "addStudent", archetype: "quiet_drifter" });
    advance(crowded, HOURS_PER_WEEK);
    expect(crowded.students[0].mods.some((x) => x.source === "coach.caseload")).toBe(true);

    const shared = officeState(6);
    const m = hireOne(shared, 60);
    for (let i = 0; i < 12; i++) applyCommand(shared, { type: "addStudent", archetype: "quiet_drifter" });
    for (const st of shared.students.slice(0, 6)) applyCommand(shared, { type: "assignCoach", studentId: st.id, coachId: m.id });
    advance(shared, HOURS_PER_WEEK);
    expect(shared.students.some((st) => st.mods.some((x) => x.source === "coach.caseload"))).toBe(false);
  });

  it("düşük maaş ve aşırı yük moral düşürür, sonunda istifa eder; öğrencileri oyuncuya döner", () => {
    const s = officeState(7);
    const m = hireOne(s, 80);
    m.salary = Math.round(marketSalary(80) * 0.6);
    for (let i = 0; i < 13; i++) applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    for (const st of s.students) applyCommand(s, { type: "assignCoach", studentId: st.id, coachId: m.id });
    advance(s, HOURS_PER_WEEK * 20);
    expect(s.staff.members.length).toBe(0);
    expect(s.log.some((e) => e.type === "staffQuit")).toBe(true);
    expect(s.students.every((st) => st.coachId === undefined)).toBe(true);
  });

  it("işten çıkarmada kıdem ödenir", () => {
    const s = officeState(8);
    const m = hireOne(s);
    expect(applyCommand(s, { type: "fireStaff", staffId: m.id })).toEqual({ ok: true });
    expect(s.economy.totals.severance).toBe(-m.salary * STAFF.severanceMonths);
  });

  it("denge: ofiste 16 öğrenci, tek başına vs. iki yardımcı koçla (12 hafta, 8 tohum)", () => {
    const run = (seed: number, staffCount: number) => {
      const s = officeState(seed);
      s.economy.business = 50_000;
      for (let i = 0; i < staffCount; i++) hireOne(s, 60);
      for (let i = 0; i < 16; i++) applyCommand(s, { type: "addStudent", archetype: i % 2 ? "quiet_drifter" : "talented_messy" });
      for (const st of s.students) {
        st.parent.style = "calm";
        st.program = balancedProgram(st);
      }
      s.students.forEach((st, i) => {
        const m = s.staff.members[i % (staffCount + 1) - 1];
        if (m) applyCommand(s, { type: "assignCoach", studentId: st.id, coachId: m.id });
      });
      advance(s, HOURS_PER_WEEK * 12);
      const active = s.students.filter((x) => !x.left);
      return {
        left: s.students.length - active.length,
        sat: active.reduce((a, x) => a + x.parent.satisfaction, 0) / Math.max(1, active.length),
        worth: s.economy.business + s.economy.personal,
      };
    };
    const avg = (n: number) => {
      const rs = Array.from({ length: 8 }, (_, i) => run(7000 + i, n));
      return { left: rs.reduce((a, r) => a + r.left, 0) / 8, sat: rs.reduce((a, r) => a + r.sat, 0) / 8, worth: rs.reduce((a, r) => a + r.worth, 0) / 8 };
    };
    const solo = avg(0), team = avg(2);
    const f = (o: typeof solo) => `ayrılan ${o.left.toFixed(1)}, veli memnuniyeti ${o.sat.toFixed(0)}, servet ${Math.round(o.worth)} ₺`;
    console.log(`tek başına: ${f(solo)}`);
    console.log(`2 yardımcı: ${f(team)}`);
    expect(team.left).toBeLessThan(solo.left);
    expect(team.sat).toBeGreaterThan(solo.sat);
  });

  it("sürüm 5 kaydı 6'ya göç eder", () => {
    const s = officeState(9);
    const raw = JSON.parse(serialize(s));
    raw.version = 5;
    delete raw.staff;
    const m = migrate(raw);
    expect(m.staff.members).toEqual([]);
    advance(m, HOURS_PER_WEEK);
  });
});
