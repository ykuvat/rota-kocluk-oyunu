import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { EVENTS } from "../src/content/events";
import { balancedProgram } from "../src/content/programs";
import { GRADES, PREFERENCE, UYS } from "../src/content/season";
import { createRng } from "../src/core/rng";
import { daysUntil, HOURS_PER_DAY, HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { enrollFromLead, makeLead } from "../src/sim/funnel";
import { preferenceProbability, rivalsSeasonEnd, type PrefRequest } from "../src/sim/market";
import { marketConversion, marketDemand } from "../src/sim/marketEffects";
import { examIso, runFinalExam } from "../src/sim/season";
import { createState, STATE_VERSION, type GameState } from "../src/sim/state";
import { advance } from "../src/sim/step";
import { migrate, serialize } from "../src/platform/save";
import { EXTRA_EN, EXTRA_TR } from "../src/platform/i18n.extra";

const examHour = (season: number) => daysUntil(0, examIso(season)) * HOURS_PER_DAY + UYS.hour;

function calmState(seed: number): GameState {
  const s = createState(seed, BALANCE.coach.weeklyHours);
  for (const e of EVENTS) s.events.lastFired[e.id] = s.hour + 1_000_000;
  applyCommand(s, { type: "setMarketing", networkActive: false, organicHours: 0, paidBudget: 0 });
  return s;
}

const enroll = (s: GameState, grade: 11 | 12, seed: number) => {
  const st = enrollFromLead(s, { name: `Öğrenci ${seed}`, archetype: "anxious_perfectionist", willingness: 7_000, source: "network", grade }, 6_000, createRng(seed));
  st.program = balancedProgram(st);
  st.parent.style = "calm";
  return st;
};

describe("sınıf düzeyi", () => {
  it("11. sınıf daha düşük ustalıkla başlar, ÜYS'de 12'ye geçer ve kalır; ertesi yıl sınava girer", () => {
    const a = calmState(1), b = calmState(1);
    const s11 = enroll(a, 11, 7);
    const s12 = enroll(b, 12, 7);
    const avg = (x: typeof s11) => Object.values(x.mastery).reduce((p, q) => p + q, 0);
    expect(avg(s11)).toBeCloseTo(avg(s12) * GRADES.eleventhMasteryFactor, 0);

    const s = calmState(2);
    const young = enroll(s, 11, 3);
    const old = enroll(s, 12, 4);
    s.hour = examHour(0) - 1;
    advance(s, 2);
    expect(old.graduated).toBe(true);
    expect(young.left).toBeFalsy();
    expect(young.grade).toBe(12);
    expect(s.season.pendingReport!.promoted).toBe(1);
    expect(s.season.pendingReport!.results.map((r) => r.studentId)).toEqual([old.id]);
    s.hour = examHour(1) - 1;
    advance(s, 2);
    expect(young.graduated).toBe(true);
  });

  it("yaz adaylarında 11. sınıf payı bahardan yüksek", () => {
    const share = (month: number) => {
      const s = calmState(3);
      s.hour = daysUntil(0, `2027-${String(month).padStart(2, "0")}-10`) * HOURS_PER_DAY + 12;
      const rng = createRng(month);
      let n11 = 0;
      for (let i = 0; i < 400; i++) if (makeLead(s, "organic", rng).grade === 11) n11++;
      return n11 / 400;
    };
    expect(share(7)).toBeGreaterThan(share(4) * 2);
  });
});

describe("tercih dönemi", () => {
  it("sonuçlar açıklanınca açılır, danışmanlık geliri yazılır, iki hafta sonra kapanır", () => {
    const s = calmState(4);
    for (let i = 0; i < 4; i++) enroll(s, 12, 10 + i);
    s.hour = examHour(0) - 1;
    advance(s, 2);
    expect(s.preference?.open).toBe(false);
    advance(s, PREFERENCE.opensAfterDays * HOURS_PER_DAY);
    const p = s.preference!;
    expect(p.open).toBe(true);
    expect(p.requests.filter((r) => r.source === "graduate").length).toBe(4);
    let sold = 0;
    for (const r of [...p.requests]) {
      const res = applyCommand(s, { type: "preferenceSession", requestId: r.id, price: 2_500 });
      if (res.ok && res.enrolled) sold++;
      if (!res.ok) expect(res.error).toBe("coach.noTime");
    }
    expect(sold).toBeGreaterThan(0);
    expect(s.economy.totals.preferenceCounseling).toBe(sold * 2_500);
    advance(s, (PREFERENCE.lengthDays + 1) * HOURS_PER_DAY);
    expect(s.preference).toBeNull();
    expect(s.history.some((e) => e.type === "preferenceClosed")).toBe(true);
  });

  it("yüksek fiyat kabulü düşürür; mezun dışarıdan gelenden kolay ikna olur", () => {
    const r: PrefRequest = { id: "p1", name: "x", source: "external", willingness: 3_000, satisfaction: 50, rank: 100_000 };
    expect(preferenceProbability(r, 6_000)).toBeLessThan(preferenceProbability(r, 2_000));
    expect(preferenceProbability({ ...r, source: "graduate" }, 3_000)).toBeGreaterThan(preferenceProbability(r, 3_000));
  });
});

describe("rakipler", () => {
  it("sezon sonunda başarı oranı ilan eder ve iki hamle yapar; etkiler süre sonunda biter", () => {
    let priceWar = false, blitz = false, poach = false;
    for (let seed = 0; seed < 30; seed++) {
      const s = calmState(100 + seed);
      s.staff.members.push({ id: "t1", name: "Elif Kara", skill: 70, skillLo: 60, skillHi: 80, salary: 32_000, morale: 60, usedThisWeek: 0, weeksEmployed: 8 });
      rivalsSeasonEnd(s, createRng(seed), 0.6);
      expect(s.market.rivalRates.length).toBe(4);
      expect(s.history.filter((e) => e.type === "rivalMove").length).toBe(2);
      if (marketConversion(s) < 0) priceWar = true;
      if (marketDemand(s) < 1) blitz = true;
      if (s.events.pending.some((p) => p.def === "staffPoach")) poach = true;
      s.hour += 12 * HOURS_PER_WEEK;
      expect(marketConversion(s)).toBe(0);
      expect(marketDemand(s)).toBe(1);
    }
    expect(priceWar && blitz && poach).toBe(true);
  });

  it("tüm rakipleri geçmek kurum güvenini artırır", () => {
    const s = calmState(5);
    const t = s.reputation.trust;
    rivalsSeasonEnd(s, createRng(1), 0.95);
    expect(s.reputation.trust).toBeGreaterThan(t);
    expect(s.history.some((e) => e.type === "rivalsBeaten")).toBe(true);
  });

  it("rapor rakip tablosunu ve metinleri içerir", () => {
    const s = calmState(6);
    enroll(s, 12, 1);
    s.hour = examHour(0) - 1;
    const r = runFinalExam(s, createRng(2));
    expect(r.rivals.length).toBe(4);
    expect(r.rivalMoves.length).toBe(2);
    for (const m of r.rivalMoves) {
      for (const k of [`report.move.${m.move}`, `notice.rivalMove.${m.move}`]) {
        expect(EXTRA_TR[k], k).toBeTruthy();
        expect(EXTRA_EN[k], k).toBeTruthy();
      }
    }
  });
});

it("sürüm 7 kaydı güncel sürüme göç eder (eski öğrenciler 12. sınıf)", () => {
  const s = calmState(7);
  enroll(s, 12, 1);
  const raw = JSON.parse(serialize(s));
  raw.version = 7;
  for (const st of raw.students) delete st.grade;
  delete raw.preference;
  delete raw.market;
  const m = migrate(raw);
  expect(m.version).toBe(STATE_VERSION);
  expect(m.students[0].grade).toBe(12);
  advance(m, HOURS_PER_WEEK);
});
