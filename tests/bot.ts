// Tam oyun denge botu: bir oyuncunun yapacağı kararları komutlarla verir ve sezon bazında ölçer.
// Strateji "good": makul oyuncu (sinyal okur, veliyle görüşür, büyür, ofis ve ekip kurar).
// Strateji "passive": aday kabul eder, program yazar, başka hiçbir şey yapmaz.

import { BALANCE } from "../src/content/balance";
import { EVENT_BY_ID } from "../src/content/events";
import { OFFICE_BY_ID } from "../src/content/growth";
import type { InterventionId } from "../src/content/interventions";
import { balancedProgram } from "../src/content/programs";
import { PREFERENCE } from "../src/content/season";
import { STAFF } from "../src/content/staff";
import { createRng } from "../src/core/rng";
import { calendarAt, HOURS_PER_DAY } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { startCareer } from "../src/sim/funnel";
import { activeCount, capacity } from "../src/sim/growth";
import { weeklySignals } from "../src/sim/insight";
import { caseload } from "../src/sim/staff";
import { createState, type GameState } from "../src/sim/state";
import { advance } from "../src/sim/step";

export type Strategy = "good" | "passive" | "cheap" | "greedy";

const SIGNAL_TO_IV: Record<string, InterventionId> = {
  "signal.shortAnswers": "trustTalk", "signal.cancels": "trustTalk", "signal.dontKnow": "smallGoals",
  "signal.lowEnergy": "restPlan", "signal.morningBlank": "restPlan", "signal.lateOnline": "focusPlan",
  "signal.halfDone": "focusPlan", "signal.tasksPileUp": "simplifyProgram", "signal.schoolLoad": "simplifyProgram",
  "signal.blankInSubject": "subjectSupport", "signal.asksSameQuestion": "subjectSupport",
};

/** Makul oyuncunun olay seçimleri. */
const EVENT_CHOICE: Record<string, string> = {
  scoreGuarantee: "process", competitorOffer: "showProgress", lateNight: "answerNow", viralPost: "ride",
  weekendGig: "accept", laptopBroken: "repair", publicComplaint: "meet", siblingEnroll: "discount", staffPoach: "counter",
};

export interface SeasonMetrics {
  season: number;
  active: number;
  graduated: number;
  hitRate: number | null;
  avgNet: number | null;
  personal: number;
  business: number;
  worth: number;
  trust: number;
  stage: number;
  staff: number;
  certs: number;
  leftEarly: number;
  debtWeeks: number;
  prefIncome: number;
  minWorth: number;
  bankrupt: number;
}

function price(state: GameState, strategy: Strategy): number {
  if (strategy === "cheap") return 3_500;
  if (strategy === "greedy") return 11_000;
  if (strategy === "passive") return 6_000;
  return state.stage >= 3 ? 8_000 : state.stage === 2 ? 7_000 : 6_000;
}

function daily(state: GameState, strategy: Strategy, day: number): void {
  const smart = strategy !== "passive";
  // sezon raporu
  if (state.season.pendingReport) applyCommand(state, { type: "closeReport" });
  // olaylar
  if (smart) {
    for (const p of [...state.events.pending]) {
      const want = EVENT_CHOICE[p.def];
      const r = applyCommand(state, { type: "resolveEvent", eventId: p.id, optionId: want });
      if (!r.ok) {
        // saat yetmiyorsa saat istemeyen ilk seçenek
        const alt = EVENT_BY_ID[p.def].options.find((o) => !o.hours && o.id !== want);
        if (alt) applyCommand(state, { type: "resolveEvent", eventId: p.id, optionId: alt.id });
      }
    }
  }
  // adaylar: kapasite ve saat varsa tanış
  for (const lead of [...state.leads]) {
    if (activeCount(state) >= capacity(state)) break;
    const free = state.coach.weeklyHours - state.coach.usedThisWeek;
    if (smart && free < 6 && state.staff.members.length === 0) break;
    const r = applyCommand(state, { type: "introMeeting", leadId: lead.id, price: price(state, strategy) });
    if (r.ok && r.enrolled && r.id) {
      const s = state.students.find((x) => x.id === r.id)!;
      // ekibe dağıt: Buse'nin yükü idealdeyse boş kapasitesi olan yardımcıya
      if (smart && caseload(state, undefined) >= 7) {
        const m = state.staff.members.find((x) => caseload(state, x.id) < STAFF.idealCaseload);
        if (m) applyCommand(state, { type: "assignCoach", studentId: s.id, coachId: m.id });
      }
    }
  }
  // tercih dönemi
  if (smart && state.preference?.open) {
    for (const r of [...state.preference.requests]) applyCommand(state, { type: "preferenceSession", requestId: r.id, price: PREFERENCE.suggestedPrice });
  }
  void day;
}

function weekly(state: GameState, strategy: Strategy, week: number): void {
  const smart = strategy !== "passive";
  for (const s of state.students.filter((x) => !x.left)) {
    if (!s.program.length || (smart && week % 4 === 0)) applyCommand(state, { type: "setProgram", studentId: s.id, blocks: balancedProgram(s) });
    if (!smart) continue;
    const sig = weeklySignals(s)[0];
    if (sig && SIGNAL_TO_IV[sig]) applyCommand(state, { type: "intervene", studentId: s.id, intervention: SIGNAL_TO_IV[sig] });
    if (week % 3 === 0) applyCommand(state, { type: "parentMeeting", studentId: s.id });
  }
  if (!smart) return;
  const e = state.economy;
  // maaş çek: kişisel hesap yaşam giderini karşılasın, işletmede 2 aylık yedek kalsın
  const reserve = 20_000 + (state.office ? 2 * (OFFICE_BY_ID[state.office].rent + OFFICE_BY_ID[state.office].utilities) : 0)
    + state.staff.members.reduce((a, m) => a + m.salary * (1 + STAFF.employerCostRate), 0);
  if (e.personal < 15_000 && e.business > reserve + 5_000) {
    applyCommand(state, { type: "transfer", amount: Math.round(Math.min(e.business - reserve, 30_000 - e.personal) / 1000) * 1000 });
  }
  // pazarlama
  const paid = state.stage >= 2 && e.business > reserve ? 1_000 : state.stage >= 1 && e.business > 10_000 ? 500 : 0;
  applyCommand(state, { type: "setMarketing", networkActive: state.marketing.networkLeft > 0, organicHours: 3, paidBudget: paid });
  // sertifika
  if (!state.coach.training && e.business > reserve + 15_000) {
    for (const id of ["parentComm", "coachingCert", "learningPsych", "interviewSkills"]) {
      if (!state.coach.certs.includes(id) && applyCommand(state, { type: "startCert", certId: id }).ok) break;
    }
  }
  // ofis: Aşama 2 ve 4 aylık işletme gideri kadar yedek
  if (state.stage === 2 && !state.office && activeCount(state) >= 8) {
    const o = OFFICE_BY_ID.district;
    if (e.business > o.rent * o.depositMonths + o.setup + 4 * (o.rent + o.utilities)) applyCommand(state, { type: "rentOffice", officeId: "district" });
  }
  // ekip: oyuncunun yükü dolunca, iyi görünen aday ve parası varsa
  if (state.office && caseload(state, undefined) >= 7 && state.staff.members.every((m) => caseload(state, m.id) >= 6)) {
    const c = [...state.staff.candidates].sort((a, b) => b.skillLo + b.skillHi - a.skillLo - a.skillHi)[0];
    if (c && (c.skillLo + c.skillHi) / 2 >= 55 && e.business > c.askSalary * 3) applyCommand(state, { type: "hireStaff", candidateId: c.id });
  }
}

/** Son oynanan oyunun durumu (hata ayıklama ve ayrıntılı rapor için). */
export let lastState: GameState | null = null;

export function playGame(seed: number, strategy: Strategy, seasons = 3): SeasonMetrics[] {
  const state = createState(seed, BALANCE.coach.weeklyHours);
  lastState = state;
  const rng = createRng(seed);
  startCareer(state, rng);
  state.rng = rng.state();
  const out: SeasonMetrics[] = [];
  let day = 0, debtWeeks = 0, minWorth = Infinity, prefIncome = 0;
  while (out.length < seasons && day < 400 * seasons) {
    if (state.gameOver) {
      // iflas: kalan sezonlar iflas olarak sayılır
      const m: SeasonMetrics = {
        season: out.length, active: 0, graduated: 0, hitRate: null, avgNet: null, personal: state.economy.personal,
        business: state.economy.business, worth: state.economy.personal + state.economy.business, trust: state.reputation.trust,
        stage: state.stage, staff: 0, certs: state.coach.certs.length, leftEarly: 0, debtWeeks, prefIncome: 0, minWorth, bankrupt: 1,
      };
      while (out.length < seasons) out.push({ ...m, season: out.length });
      break;
    }
    daily(state, strategy, day);
    if (calendarAt(state.hour).weekday === 0) {
      weekly(state, strategy, Math.floor(day / 7));
      if (state.economy.personal < 0) debtWeeks++;
      minWorth = Math.min(minWorth, state.economy.personal + state.economy.business);
    }
    const before = state.season.reports.length;
    advance(state, HOURS_PER_DAY);
    day++;
    if (state.preference?.open) prefIncome = state.preference.income;
    if (state.season.reports.length > before) {
      const r = state.season.reports.at(-1)!;
      const nets = r.results.map((x) => x.net);
      out.push({
        season: r.season,
        active: activeCount(state),
        graduated: r.results.length,
        hitRate: r.ourRate,
        avgNet: nets.length ? nets.reduce((a, b) => a + b, 0) / nets.length : null,
        personal: state.economy.personal,
        business: state.economy.business,
        worth: state.economy.personal + state.economy.business,
        trust: state.reputation.trust,
        stage: state.stage,
        staff: state.staff.members.length,
        certs: state.coach.certs.length,
        leftEarly: r.leftEarly,
        debtWeeks,
        prefIncome,
        minWorth,
        bankrupt: 0,
      });
      debtWeeks = 0;
      minWorth = Infinity;
    }
  }
  return out;
}

/** Tohumlar üzerinde sezon bazında ortalama. */
export function averageRuns(strategy: Strategy, seeds: number[], seasons = 3) {
  const runs = seeds.map((s) => playGame(s, strategy, seasons));
  const per: Record<string, number | string>[] = [];
  for (let i = 0; i < seasons; i++) {
    const rows = runs.map((r) => r[i]).filter(Boolean);
    const m = (f: (x: SeasonMetrics) => number | null) => {
      const v = rows.map(f).filter((x): x is number => x !== null);
      return v.length ? v.reduce((a, b) => a + b, 0) / v.length : NaN;
    };
    per.push({
      season: i + 1,
      bankrupt: m((x) => x.bankrupt),
      active: m((x) => x.active),
      graduated: m((x) => x.graduated),
      hitRate: m((x) => x.hitRate),
      avgNet: m((x) => x.avgNet),
      worth: m((x) => x.worth),
      minWorth: m((x) => x.minWorth),
      debtWeeks: m((x) => x.debtWeeks),
      trust: m((x) => x.trust),
      stage: m((x) => x.stage),
      office: rows.filter((x) => x.stage >= 3).length / rows.length,
      staff: m((x) => x.staff),
      certs: m((x) => x.certs),
      leftEarly: m((x) => x.leftEarly),
      prefIncome: m((x) => x.prefIncome),
    });
  }
  return per;
}

export function formatTable(name: string, rows: Record<string, number | string>[]): string {
  const f = (v: number | string) => (typeof v === "number" ? (Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("tr-TR") : v.toFixed(2)) : v);
  return [`== ${name}`, ...rows.map((r) => Object.entries(r).map(([k, v]) => `${k}=${f(v)}`).join("  "))].join("\n");
}
