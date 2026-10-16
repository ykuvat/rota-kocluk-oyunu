// Aday hunisi ve itibar (GDD E2, E6). Kanal → aday → tanışma görüşmesi → kayıt.
// İlk öğrenciyi bulmak garanti değildir: fiyat, güven ve kaynak kayıt olasılığını belirler.

import { ARCHETYPES, FIRST_NAMES, LAST_NAMES } from "../content/archetypes";
import { COACHING, FUNNEL, REPUTATION, SEASONALITY, type LeadSource } from "../content/business";
import { calendarAt, HOURS_PER_DAY } from "./calendar";
import type { Rng } from "../core/rng";
import { balancedProgram } from "../content/programs";
import { STAFF } from "../content/staff";
import { GRADES } from "../content/season";
import { marketDemand } from "./marketEffects";
import { payFromBusinessFirst } from "./economy";
import { certEffect } from "./growth";
import { emit, spendCoachHours, type GameState } from "./state";
import { generateStudent, sigmoid, type Student } from "./student";

export interface Lead {
  id: string;
  name: string;
  archetype: string;
  source: LeadSource;
  /** Ailenin aylık ödeme isteği (₺) — oyuncuya görünmez */
  willingness: number;
  grade: 11 | 12;
  createdHour: number;
  expiresHour: number;
}

export interface Marketing {
  /** Kişisel çevreyi aramaya haftada 1 saat ayır */
  networkActive: boolean;
  /** Haftalık organik içerik üretimi (koç saati) */
  organicHours: number;
  /** Haftalık ücretli sosyal medya bütçesi (₺) */
  paidBudget: number;
  followers: number;
  networkLeft: number;
}

export interface Reputation {
  /** 0–100 bilinirlik */
  awareness: number;
  /** 0–100 veli güveni (kurum düzeyinde) */
  trust: number;
}

export function createMarketing(): Marketing {
  return { networkActive: true, organicHours: 0, paidBudget: 0, followers: 0, networkLeft: FUNNEL.networkPool };
}

export function createReputation(): Reputation {
  return { awareness: 5, trust: REPUTATION.startTrust };
}

function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > L && k < 50);
  return k - 1;
}

function normal(rng: Rng): number {
  // Box–Muller
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function makeLead(state: GameState, source: LeadSource, rng: Rng): Lead {
  const ids = Object.keys(ARCHETYPES);
  const lead: Lead = {
    id: `l${state.nextLeadId++}`,
    name: `${FIRST_NAMES[rng.int(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[rng.int(0, LAST_NAMES.length - 1)]}`,
    archetype: ids[rng.int(0, ids.length - 1)],
    source,
    willingness: Math.round(Math.max(2_500, FUNNEL.willingnessMean + normal(rng) * FUNNEL.willingnessSd) / 100) * 100,
    grade: rng.next() < GRADES.eleventhShareByMonth[calendarAt(state.hour).month - 1] ? 11 : 12,
    createdHour: state.hour,
    expiresHour: state.hour + FUNNEL.leadTtlDays * HOURS_PER_DAY,
  };
  state.leads.push(lead);
  state.reputation.awareness = Math.min(100, state.reputation.awareness + REPUTATION.awarenessPerLead);
  emit(state, "leadArrived", { id: lead.id, source });
  return lead;
}

/** O ayın talep çarpanı (kayıt sezonu). */
export const seasonFactor = (hour: number) => SEASONALITY[calendarAt(hour).month - 1];

/** Ücretli reklamın beklenen haftalık aday sayısı (azalan getiri, güvenle ölçeklenir). */
export const expectedPaidLeads = (budget: number, trust: number) =>
  Math.sqrt(Math.max(0, budget) / 100) * FUNNEL.paidLeadFactor * (0.5 + trust / 100);

/** Haftalık koç saatini ayır: önce öğrenci takibi, sonra pazarlama. Takip edilemeyenler ihmal cezası alır. */
export function weeklyPlanning(state: GameState, rng: Rng): void {
  const coach = state.coach;
  // geçici yükler (ek iş, ekipman sorunu) haftanın başında saatten düşer
  coach.usedThisWeek = coach.penalties.reduce((a, p) => a + p.hours, 0);
  for (const p of coach.penalties) p.weeksLeft--;
  coach.penalties = coach.penalties.filter((p) => p.weeksLeft > 0);
  const active = state.students.filter((s) => !s.left);
  const members = state.staff.members;
  for (const m of members) m.usedThisWeek = 0;
  const until = state.hour + 7 * HOURS_PER_DAY;
  let covered = 0;
  for (const s of active) {
    const m = s.coachId ? members.find((x) => x.id === s.coachId) : undefined;
    let ok: boolean;
    if (m) {
      ok = m.usedThisWeek + COACHING.followUpHours <= STAFF.weeklyHours;
      if (ok) m.usedThisWeek += COACHING.followUpHours;
    } else {
      ok = coach.usedThisWeek + COACHING.followUpHours <= coach.weeklyHours;
      if (ok) coach.usedThisWeek += COACHING.followUpHours;
    }
    if (ok) covered++;
    else {
      // GDD: fazla öğrenci → takip kalitesi düşer → güven ve motivasyon erir
      s.mods.push({ stat: "trust", source: "coach.neglect", add: COACHING.neglectTrust, until });
      s.mods.push({ stat: "motivation", source: "coach.neglect", add: COACHING.neglectMotivation, until });
    }
    if (m && ok) {
      // yardımcı koçun becerisi takibin kalitesini belirler (iyi koç artı, zayıf koç eksi)
      const q = Math.round(((m.skill - 60) / STAFF.qualityDivisor) * 10) / 10;
      s.mods.push({ stat: "trust", source: "staff.quality", add: q, until });
      s.mods.push({ stat: "motivation", source: "staff.quality", add: Math.round(q * 5) / 10, until });
      s.parent.satisfaction = Math.min(100, Math.max(0, Math.round((s.parent.satisfaction + (m.skill - 60) / STAFF.parentQualityDivisor) * 10) / 10));
    }
  }
  if (covered < active.length) emit(state, "coachOverloaded", { covered, total: active.length });
  // vaka yükü (koç başına): ideal sayının üstünde o koçun bütün öğrencilerinde takip kalitesi düşer
  for (const owner of [undefined, ...members.map((m) => m.id)]) {
    const group = active.filter((s) => s.coachId === owner);
    const extra = group.length - (owner ? STAFF.idealCaseload : COACHING.idealCaseload);
    if (extra <= 0) continue;
    for (const s of group) {
      s.mods.push({ stat: "trust", source: "coach.caseload", add: COACHING.caseloadTrustPerExtra * extra, until });
      s.mods.push({ stat: "motivation", source: "coach.caseload", add: COACHING.caseloadMotivationPerExtra * extra, until });
      s.parent.satisfaction = Math.max(0, Math.round((s.parent.satisfaction + COACHING.caseloadParentPerExtra * extra) * 10) / 10);
    }
  }

  const m = state.marketing;
  const free = () => coach.weeklyHours - coach.usedThisWeek;
  // kayıt sezonu × rakip reklamlarının pazardan aldığı pay
  const season = seasonFactor(state.hour) * marketDemand(state);

  // kişisel çevre
  if (m.networkActive && m.networkLeft > 0 && free() >= FUNNEL.networkHours) {
    coach.usedThisWeek += FUNNEL.networkHours;
    if (rng.next() < FUNNEL.networkLeadChance) {
      m.networkLeft--;
      makeLead(state, "network", rng);
    }
  }
  // organik içerik
  const organic = Math.min(m.organicHours, Math.max(0, free()));
  coach.usedThisWeek += organic;
  m.followers = Math.round(m.followers * (1 - FUNNEL.organicFollowerDecay) + organic * FUNNEL.organicFollowersPerHour * certEffect(state, "organicFactor"));
  for (let i = poisson(rng, m.followers * FUNNEL.organicLeadsPerFollower * season); i > 0; i--) makeLead(state, "organic", rng);
  // ücretli reklam
  if (m.paidBudget > 0) {
    payFromBusinessFirst(state, m.paidBudget, "advertising");
    for (let i = poisson(rng, expectedPaidLeads(m.paidBudget, state.reputation.trust) * season); i > 0; i--) makeLead(state, "paidSocial", rng);
  }
  // tavsiye: memnun veliler
  for (const s of active) {
    if (s.history.length < FUNNEL.referralMinWeeks) continue;
    if (s.parent.satisfaction >= FUNNEL.referralSatisfaction && rng.next() < FUNNEL.referralChance * season) makeLead(state, "referral", rng);
  }
}

/** Haftalık itibar güncellemesi. */
export function updateReputation(state: GameState): void {
  const r = state.reputation;
  r.awareness = Math.round(r.awareness * (1 - REPUTATION.awarenessDecay) * 10) / 10;
  const active = state.students.filter((s) => !s.left);
  if (active.length) {
    const avg = active.reduce((a, s) => a + s.parent.satisfaction, 0) / active.length;
    r.trust = Math.round((r.trust + (avg - r.trust) * REPUTATION.trustConvergence) * 10) / 10;
  }
}

export function expireLeads(state: GameState): void {
  const before = state.leads.length;
  state.leads = state.leads.filter((l) => l.expiresHour > state.hour);
  if (state.leads.length < before) emit(state, "leadsExpired", { count: before - state.leads.length });
}

/** Kariyer başlangıcı: kişisel çevreden iki ilk aday (oyuncunun ilk görevi). */
export function startCareer(state: GameState, rng: Rng): void {
  for (let i = 0; i < 2; i++) {
    state.marketing.networkLeft--;
    makeLead(state, "network", rng);
  }
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Adayı öğrenci olarak kaydeder: ücret, veli başlangıcı, dengeli program, ilk haftanın takibi. */
export function enrollFromLead(state: GameState, lead: Pick<Lead, "name" | "archetype" | "willingness" | "source" | "grade">, price: number, rng: Rng): Student {
  const id = `s${state.nextId++}`;
  const s = generateStudent(id, lead.archetype, rng, calendarAt(state.hour).weekIndex);
  s.name = lead.name;
  s.grade = lead.grade;
  // 11. sınıf müfredatın bir kısmını henüz görmedi
  if (s.grade === 11) for (const k of Object.keys(s.mastery)) s.mastery[k] = round1(s.mastery[k] * GRADES.eleventhMasteryFactor);
  s.fee = price;
  // ödeme isteğinin üstünde fiyat ödeyen veli daha eleştirel başlar
  s.parent.satisfaction = round1(clamp(s.parent.satisfaction + (lead.willingness - price) / 200));
  if (lead.source === "referral") s.parent.satisfaction = round1(clamp(s.parent.satisfaction + 6));
  s.program = balancedProgram(s);
  state.students.push(s);
  // kayıt haftasının takibi hemen ayrılır; saat yoksa öğrenci ilk haftasında ihmal edilir
  if (!spendCoachHours(state, COACHING.followUpHours)) {
    const until = state.hour + 7 * HOURS_PER_DAY;
    s.mods.push({ stat: "trust", source: "coach.neglect", add: COACHING.neglectTrust, until });
    s.mods.push({ stat: "motivation", source: "coach.neglect", add: COACHING.neglectMotivation, until });
  }
  emit(state, "studentEnrolled", { id, name: s.name, fee: s.fee, source: lead.source });
  return s;
}

/** Tanışma görüşmesinde kayıt olasılığı (oyuncu görmez; arayüz yalnız kaba ipucu verir). */
export function conversionProbability(lead: Lead, price: number, trust: number, bonus = 0): number {
  const c = FUNNEL.conversion;
  return sigmoid(c.bias + ((lead.willingness - price) / 1000) * c.priceW + ((trust - 50) / 50) * c.trustW + FUNNEL.sourceBonus[lead.source] + bonus);
}
