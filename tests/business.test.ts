import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { COACHING, ECONOMY, FUNNEL } from "../src/content/business";
import { createRng } from "../src/core/rng";
import { HOURS_PER_DAY, HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { conversionProbability, expectedPaidLeads, makeLead, startCareer } from "../src/sim/funnel";
import { createState, type GameState } from "../src/sim/state";
import { advance } from "../src/sim/step";
import { deserialize, migrate, serialize } from "../src/platform/save";
import { weeklySignals } from "../src/sim/insight";
import type { InterventionId } from "../src/content/interventions";
import { STAGES } from "../src/content/growth";

const newState = (seed = 1) => createState(seed, BALANCE.coach.weeklyHours);

function netWorth(s: GameState) {
  return s.economy.personal + s.economy.business;
}

describe("ekonomi", () => {
  it("para korunur: bakiyeler = başlangıç + tüm işlemler", () => {
    const s = newState(4);
    applyCommand(s, { type: "addStudent", archetype: "talented_messy" });
    applyCommand(s, { type: "setMarketing", networkActive: true, organicHours: 2, paidBudget: 500 });
    advance(s, HOURS_PER_WEEK * 10);
    applyCommand(s, { type: "transfer", amount: Math.floor(s.economy.business / 2) });
    advance(s, HOURS_PER_WEEK * 5);
    const sum = Object.values(s.economy.totals).reduce((a, b) => a + (b ?? 0), 0);
    expect(netWorth(s)).toBeCloseTo(ECONOMY.startPersonal + ECONOMY.startBusiness + sum, 2);
  });

  it("ayın 1'inde ücret tahsil edilir, kişisel giderler ödenir", () => {
    const s = newState(5);
    applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    // 1 Ekim 2026 = 24. gün; 09:00'u geç
    advance(s, 24 * HOURS_PER_DAY + 9 - s.hour + 1);
    expect(s.economy.totals.tuition).toBe(ECONOMY.suggestedFee);
    expect(s.economy.totals.rent).toBe(-ECONOMY.monthlyPersonal.rent);
    expect(s.economy.business).toBe(ECONOMY.suggestedFee);
  });

  it("kişisel hesap eksideyken faiz işler", () => {
    const s = newState(6);
    s.economy.personal = -10_000;
    advance(s, 24 * HOURS_PER_DAY + 10 - s.hour);
    expect(s.economy.totals.interest).toBeCloseTo(-10_000 * ECONOMY.creditCardMonthlyInterest, 2);
  });

  it("işletmede olmayan parayı çekemezsin", () => {
    const s = newState(7);
    expect(applyCommand(s, { type: "transfer", amount: 1_000 })).toEqual({ ok: false, error: "transfer.insufficient" });
  });
});

describe("huni", () => {
  it("reklamın azalan getirisi: 4 kat bütçe 2 kat aday", () => {
    expect(expectedPaidLeads(4000, 50) / expectedPaidLeads(1000, 50)).toBeCloseTo(2, 5);
  });

  it("reklam bütçesi haftalık harcanır ve aday getirir", () => {
    let leads = 0;
    for (let seed = 0; seed < 20; seed++) {
      const s = newState(100 + seed);
      applyCommand(s, { type: "setMarketing", networkActive: false, organicHours: 0, paidBudget: 2000 });
      advance(s, HOURS_PER_WEEK * 4);
      expect(s.economy.totals.advertising).toBe(-2000 * 4);
      leads += s.log.filter((e) => e.type === "leadArrived").length;
    }
    expect(leads / 20).toBeGreaterThan(2);
  });

  it("aday 7 gün sonra soğur", () => {
    const s = newState(8);
    startCareer(s, createRng(1));
    expect(s.leads.length).toBe(2);
    advance(s, FUNNEL.leadTtlDays * HOURS_PER_DAY + 24);
    expect(s.leads.filter((l) => l.source === "network" && l.createdHour === 8).length).toBe(0);
  });

  it("yüksek fiyat kaydı zorlaştırır; tavsiye kolaylaştırır", () => {
    const s = newState(9);
    const rng = createRng(2);
    const lead = makeLead(s, "paidSocial", rng);
    expect(conversionProbability(lead, 12_000, 50)).toBeLessThan(conversionProbability(lead, 5_000, 50));
    expect(conversionProbability({ ...lead, source: "referral" }, 6_000, 50)).toBeGreaterThan(conversionProbability(lead, 6_000, 50));
  });

  it("tanışma görüşmesi: kayıt olursa ücret ve program atanır, olmazsa aday düşer", () => {
    let enrolled = 0, lost = 0;
    for (let seed = 0; seed < 30; seed++) {
      const s = newState(200 + seed);
      startCareer(s, createRng(seed));
      const r = applyCommand(s, { type: "introMeeting", leadId: s.leads[0].id, price: 6_000 });
      expect(r.ok).toBe(true);
      if (r.ok && r.enrolled) {
        enrolled++;
        expect(s.students[0].fee).toBe(6_000);
        expect(s.students[0].program.length).toBeGreaterThan(0);
      } else lost++;
      expect(s.leads.length).toBe(1);
    }
    expect(enrolled).toBeGreaterThan(10);
    expect(lost).toBeGreaterThan(0); // ilk öğrenci garanti değil
  });

  it("koç saati yetmezse fazla öğrenciler ihmal edilir", () => {
    const s = createState(10, 4); // haftada 4 saat
    for (let i = 0; i < 4; i++) applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    applyCommand(s, { type: "setMarketing", networkActive: false, organicHours: 0, paidBudget: 0 });
    advance(s, HOURS_PER_WEEK);
    const neglected = s.students.filter((st) => st.mods.some((m) => m.source === "coach.neglect"));
    expect(neglected.length).toBe(4 - Math.floor(4 / COACHING.followUpHours));
    expect(s.log.some((e) => e.type === "coachOverloaded")).toBe(true);
  });

  it("sürüm 2 kaydı ekonomiyle sürüm 3'e göç eder", () => {
    const s = newState(11);
    applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    const raw = JSON.parse(serialize(s));
    raw.version = 2;
    for (const k of ["economy", "marketing", "reputation", "leads", "nextLeadId"]) delete raw[k];
    for (const st of raw.students) delete st.fee;
    const m = migrate(raw);
    expect(m.economy.personal).toBe(ECONOMY.startPersonal);
    expect(m.students[0].fee).toBe(ECONOMY.suggestedFee);
    const again = deserialize(serialize(m));
    advance(again, HOURS_PER_WEEK);
    expect(again.students[0].history.length).toBe(1);
  });
});

// --- işletme denge botları -------------------------------------------------------------

const SIGNAL_TO_IV: Record<string, InterventionId> = {
  "signal.shortAnswers": "trustTalk", "signal.cancels": "trustTalk", "signal.dontKnow": "smallGoals",
  "signal.lowEnergy": "restPlan", "signal.morningBlank": "restPlan", "signal.lateOnline": "focusPlan",
  "signal.halfDone": "focusPlan", "signal.tasksPileUp": "simplifyProgram", "signal.schoolLoad": "simplifyProgram",
  "signal.blankInSubject": "subjectSupport", "signal.asksSameQuestion": "subjectSupport",
};

function runBusiness(seed: number, price: number, weeks = 16) {
  const s = newState(seed);
  startCareer(s, createRng(seed));
  applyCommand(s, { type: "setMarketing", networkActive: true, organicHours: 3, paidBudget: 750 });
  for (let w = 0; w < weeks; w++) {
    for (const lead of [...s.leads]) applyCommand(s, { type: "introMeeting", leadId: lead.id, price });
    for (const st of s.students.filter((x) => !x.left)) {
      const sig = weeklySignals(st)[0];
      if (sig) applyCommand(s, { type: "intervene", studentId: st.id, intervention: SIGNAL_TO_IV[sig] });
      if (w % 3 === 0) applyCommand(s, { type: "parentMeeting", studentId: st.id });
    }
    advance(s, HOURS_PER_WEEK);
  }
  const active = s.students.filter((x) => !x.left).length;
  return { active, left: s.students.length - active, worth: netWorth(s), trust: s.reputation.trust };
}

describe("işletme dengesi: 16 hafta, 3 fiyat stratejisi", () => {
  it("makul fiyat sürdürülebilir; aşırı pahalı az öğrenci, aşırı ucuz az kazanç", () => {
    const seeds = Array.from({ length: 16 }, (_, i) => 4000 + i);
    const avg = (price: number) => {
      const rs = seeds.map((sd) => runBusiness(sd, price));
      const m = (f: (r: (typeof rs)[number]) => number) => rs.reduce((a, r) => a + f(r), 0) / rs.length;
      return { active: m((r) => r.active), left: m((r) => r.left), worth: m((r) => r.worth), trust: m((r) => r.trust) };
    };
    const cheap = avg(3_000), fair = avg(6_000), pricey = avg(12_000);
    const f = (o: typeof fair) => `öğrenci ${o.active.toFixed(1)}, ayrılan ${o.left.toFixed(1)}, servet ${Math.round(o.worth)} ₺, güven ${o.trust.toFixed(0)}`;
    console.log(`ucuz 3.000 ₺:  ${f(cheap)}`);
    console.log(`makul 6.000 ₺: ${f(fair)}`);
    console.log(`pahalı 12.000 ₺: ${f(pricey)}`);
    expect(fair.active).toBeGreaterThanOrEqual(2);
    expect(pricey.active).toBeLessThan(fair.active);
    expect(pricey.worth).toBeLessThan(fair.worth);
    // ev kapasitesi (10) büyümeyi sınırlar: ucuz fiyat odayı aynı hızla doldurur ama kazancın çoğunu bırakır
    expect(cheap.active).toBeLessThanOrEqual(STAGES.homeCapacity);
    expect(fair.worth).toBeGreaterThan(cheap.worth * 2);
  });
});
