import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { COACHING } from "../src/content/business";
import { EVENTS } from "../src/content/events";
import { balancedProgram } from "../src/content/programs";
import { STAFF, type StaffRole } from "../src/content/staff";
import { createRng } from "../src/core/rng";
import { HOURS_PER_DAY, HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { caseload, marketSalary, refreshCandidates, staffPreferenceBonus } from "../src/sim/staff";
import { SPECIALISTS } from "../src/content/staff";
import { BRANCH_BY_ID, OFFICE_BY_ID } from "../src/content/growth";
import { branchBlocker, capacity, conversionBonus } from "../src/sim/growth";
import { makeLead } from "../src/sim/funnel";
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

function hireOne(s: GameState, skill?: number, role: StaffRole = "coach") {
  refreshCandidates(s, createRng(s.staff.nextId));
  const c = s.staff.candidates.at(-1)!;
  c.role = role;
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

  it("roller: uzman yer başına sınırlı, öğrenci yalnız yardımcı koça atanır", () => {
    const s = officeState(10);
    const sec = hireOne(s, 60, "secretary");
    applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    expect(applyCommand(s, { type: "assignCoach", studentId: s.students[0].id, coachId: sec.id })).toEqual({ ok: false, error: "staff.notCoach" });
    refreshCandidates(s, createRng(3));
    const c = s.staff.candidates.at(-1)!;
    c.role = "secretary";
    expect(applyCommand(s, { type: "hireStaff", candidateId: c.id })).toEqual({ ok: false, error: "staff.roleFull" });
    // yeri dolu rolün başvurusu gelmez, eskisi haftalık yenilemede düşer
    for (let i = 0; i < 20; i++) refreshCandidates(s, createRng(100 + i));
    expect(s.staff.candidates.some((x) => x.role === "secretary")).toBe(false);
    // şube açılınca ikinci sekreterin yeri olur
    s.branches.push("harbor");
    const c2 = s.staff.candidates.at(-1)!;
    c2.role = "secretary";
    expect(applyCommand(s, { type: "hireStaff", candidateId: c2.id })).toEqual({ ok: true });
  });

  it("sekreter: adaylar daha uzun bekler, kayıt olasılığı artar, veliler memnun", () => {
    const base = officeState(11);
    const withSec = officeState(11);
    hireOne(withSec, 60, "secretary");
    expect(conversionBonus(withSec)).toBeCloseTo(conversionBonus(base) + SPECIALISTS.secretary.conversion, 5);
    const a = makeLead(base, "network", createRng(1));
    const b = makeLead(withSec, "network", createRng(1));
    expect(b.expiresHour - withSec.hour).toBeGreaterThan(a.expiresHour - base.hour);
    for (const s of [base, withSec]) {
      applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
      s.students[0].parent.style = "calm";
    }
    advance(base, HOURS_PER_WEEK * 4);
    advance(withSec, HOURS_PER_WEEK * 4);
    expect(withSec.students[0].parent.satisfaction).toBeGreaterThan(base.students[0].parent.satisfaction);
  });

  it("rehber öğretmen: kaygıyı düşüren haftalık görüşme, tercih danışmanlığına katkı", () => {
    const s = officeState(12);
    expect(staffPreferenceBonus(s)).toBe(0);
    hireOne(s, 90, "counselor");
    applyCommand(s, { type: "addStudent", archetype: "anxious_perfectionist" });
    advance(s, HOURS_PER_WEEK);
    const st = s.students[0];
    expect(st.mods.some((x) => x.source === "staff.counselor" && x.stat === "anxiety" && (x.add ?? 0) < 0)).toBe(true);
    expect(staffPreferenceBonus(s)).toBeCloseTo(SPECIALISTS.counselor.preference * 1.5, 5);
  });

  it("branş öğretmeni: en zayıf öğrencilerin ustalığını artırır, kapasitesi sınırlı", () => {
    const run = (teacher: boolean) => {
      const s = officeState(13);
      if (teacher) hireOne(s, 60, "teacher");
      for (let i = 0; i < SPECIALISTS.teacher.students + 2; i++) applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
      const before = s.students.map((x) => ({ ...x.mastery }));
      advance(s, HOURS_PER_WEEK);
      return s.students.map((x, i) => Object.keys(x.mastery).filter((k) => x.mastery[k] > before[i][k]).length);
    };
    // programsız öğrenci kendi başına çalışmaz: artış yalnız etütten gelir
    expect(run(false).every((n) => n === 0)).toBe(true);
    const gains = run(true);
    expect(gains.filter((n) => n > 0).length).toBe(SPECIALISTS.teacher.students);
  });

  it("şube: koşullar, Aşama 4, kapasite ve aylık kira", () => {
    const s = officeState(14);
    expect(branchBlocker(s, "harbor")).toBe("branch.trust");
    s.reputation.trust = 70;
    expect(branchBlocker(s, "harbor")).toBe("branch.students");
    const cap = capacity(s);
    for (let i = 0; i < Math.ceil(cap * 0.75); i++) applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    s.economy.business = 1_000;
    expect(applyCommand(s, { type: "openBranch", branchId: "harbor" })).toEqual({ ok: false, error: "branch.noMoney" });
    s.economy.business = 300_000;
    // her yerde iki koç (Buse biri sayılır): ofis + şube için 3 yardımcı koç
    expect(branchBlocker(s, "harbor")).toBe("branch.coaches");
    for (let i = 0; i < 3; i++) hireOne(s, 60);
    expect(applyCommand(s, { type: "openBranch", branchId: "harbor" })).toEqual({ ok: true });
    expect(s.stage).toBe(4);
    expect(capacity(s)).toBe(cap + BRANCH_BY_ID.harbor.capacity);
    expect(s.log.some((e) => e.type === "stageReached" && e.data.stage === 4)).toBe(true);
    expect(applyCommand(s, { type: "openBranch", branchId: "harbor" })).toEqual({ ok: false, error: "branch.already" });
    // ikinci şube hemen açılmaz: önce yarım yıl beklemeli
    expect(branchBlocker(s, "campus")).toBe("branch.tooSoon");
    const rentBefore = s.economy.totals.officeRent ?? 0;
    advance(s, 32 * HOURS_PER_DAY);
    expect(rentBefore - (s.economy.totals.officeRent ?? 0)).toBe(OFFICE_BY_ID.central.rent + BRANCH_BY_ID.harbor.rent);
  });

  it("denge: kalabalık kurumda uzman ekip (sekreter, rehber, branş) memnuniyeti ve ustalığı artırır (16 hafta, 8 tohum)", () => {
    const run = (seed: number, specialists: boolean) => {
      const s = officeState(seed);
      s.economy.business = 80_000;
      hireOne(s, 60);
      if (specialists) for (const r of ["secretary", "counselor", "teacher"] as StaffRole[]) hireOne(s, 60, r);
      for (let i = 0; i < 16; i++) applyCommand(s, { type: "addStudent", archetype: i % 2 ? "quiet_drifter" : "anxious_perfectionist" });
      for (const st of s.students) {
        st.parent.style = "calm";
        st.program = balancedProgram(st);
      }
      const m = s.staff.members.find((x) => x.role === "coach")!;
      for (const st of s.students.slice(0, 8)) applyCommand(s, { type: "assignCoach", studentId: st.id, coachId: m.id });
      advance(s, HOURS_PER_WEEK * 16);
      const active = s.students.filter((x) => !x.left);
      // ustalık bütün öğrencilerde (ayrılanın ustalığı ayrıldığı gün donar): yalnız kalanlara bakmak seçim yanlılığı olur
      const mastery = s.students.reduce((a, x) => a + Object.values(x.mastery).reduce((p, q) => p + q, 0) / Object.keys(x.mastery).length, 0) / s.students.length;
      return {
        left: s.students.length - active.length,
        sat: active.reduce((a, x) => a + x.parent.satisfaction, 0) / Math.max(1, active.length),
        mastery,
        worth: s.economy.business + s.economy.personal,
      };
    };
    const avg = (sp: boolean) => {
      const rs = Array.from({ length: 8 }, (_, i) => run(8000 + i, sp));
      const k = (f: (r: (typeof rs)[number]) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
      return { left: k((r) => r.left), sat: k((r) => r.sat), mastery: k((r) => r.mastery), worth: k((r) => r.worth) };
    };
    const lean = avg(false), full = avg(true);
    const f = (o: typeof lean) => `ayrılan ${o.left.toFixed(1)}, veli ${o.sat.toFixed(0)}, ustalık ${o.mastery.toFixed(1)}, servet ${Math.round(o.worth)} ₺`;
    console.log(`yalnız koç: ${f(lean)}`);
    console.log(`uzman ekip: ${f(full)}`);
    expect(full.sat).toBeGreaterThan(lean.sat);
    expect(full.mastery).toBeGreaterThan(lean.mastery);
    expect(full.left).toBeLessThanOrEqual(lean.left);
  });

  it("sürüm 10 kaydı 11'e göç eder (eski ekip yardımcı koç olur)", () => {
    const s = officeState(15);
    hireOne(s, 60);
    const raw = JSON.parse(serialize(s));
    raw.version = 10;
    delete raw.branches;
    for (const m of raw.staff.members) delete m.role;
    for (const c of raw.staff.candidates) delete c.role;
    const m = migrate(raw);
    expect(m.branches).toEqual([]);
    expect(m.staff.members.every((x) => x.role === "coach")).toBe(true);
    advance(m, HOURS_PER_WEEK);
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
