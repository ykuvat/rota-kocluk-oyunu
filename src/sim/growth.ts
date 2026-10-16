// Sertifikalar, aşama ilerlemesi, ofis ve şubeler (GDD A, E8). Etkiler küçük ama kalıcıdır; bedeli para + haftalarca koç saati.

import { BRANCH_BY_ID, CERT_BY_ID, OFFICE_BY_ID, STAGES, type BranchDef, type CertDef } from "../content/growth";
import { payFromBusinessFirst } from "./economy";
import { repAwareness, repTrust } from "./effects";
import { STAFF } from "../content/staff";
import { daysUntil, HOURS_PER_WEEK } from "./calendar";
import { examIso } from "./season";
import { coaches, marketSalary, siteCount, staffConversion } from "./staff";
import { addCoachPenalty, coachHours, emit, type GameState } from "./state";

type NumericCertKey = "conversion" | "interventionFactor" | "parentMeetingFactor" | "insightFactor" | "organicFactor";

/** Tamamlanmış sertifikaların toplam etkisi: katkılar toplanır, çarpanlar çarpılır. */
export function certEffect(state: GameState, key: NumericCertKey): number {
  const additive = key === "conversion";
  let v = additive ? 0 : 1;
  for (const id of state.coach.certs) {
    const x = (CERT_BY_ID[id] as CertDef | undefined)?.[key];
    if (x === undefined) continue;
    v = additive ? v + x : v * x;
  }
  return v;
}

export const activeCount = (state: GameState) => state.students.filter((s) => !s.left).length;

const branchDefs = (state: GameState) => state.branches.map((id) => BRANCH_BY_ID[id]).filter((b): b is BranchDef => !!b);
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);

export function capacity(state: GameState): number {
  if (!state.office) return STAGES.homeCapacity;
  return OFFICE_BY_ID[state.office].capacity + sum(branchDefs(state).map((b) => b.capacity));
}

/** Kurumsal görünümün kayıt olasılığına katkısı (sertifika + ofis + şubeler + sekreter). */
export function conversionBonus(state: GameState): number {
  const place = state.office ? OFFICE_BY_ID[state.office].conversion + sum(branchDefs(state).map((b) => b.conversion)) : 0;
  return certEffect(state, "conversion") + place + staffConversion(state);
}

/** Ofis ve şubelerin aylık kira + faturası. */
export function placesMonthly(state: GameState): number {
  if (!state.office) return 0;
  const o = OFFICE_BY_ID[state.office];
  return o.rent + o.utilities + sum(branchDefs(state).map((b) => b.rent + b.utilities));
}

/**
 * Şubenin peşinatı ve kasada kalması gereken yedek: yeni yer dolana kadar birkaç aylık gideri
 * (kira + fatura + orada çalışacak bir yardımcı koçun piyasa maaşı, işveren maliyeti dahil).
 */
export function branchMoneyNeeded(b: BranchDef): number {
  const coach = marketSalary(STAGES.branch.coachSkillRef) * (1 + STAFF.employerCostRate);
  return Math.round(b.rent * b.depositMonths + b.setup + STAGES.branch.reserveMonths * (b.rent + b.utilities + coach));
}

/** Sıradaki şube için gereken kurum güveni. */
export const branchTrust = (state: GameState) => STAGES.branch.trust + STAGES.branch.trustPerBranch * state.branches.length;

/** Sıradaki şube açıldıktan sonra gereken yardımcı koç sayısı (her yere `coachesPerSite` koç; Buse biri sayılır). */
export const branchCoaches = (state: GameState) => (siteCount(state) + 1) * STAGES.branch.coachesPerSite - 1;

/** Şube açılabilir mi? Açılabiliyorsa null, değilse engelin hata anahtarı. */
export function branchBlocker(state: GameState, branchId: string): string | null {
  const b = BRANCH_BY_ID[branchId];
  if (!b) return "branch.unknown";
  if (state.branches.includes(branchId)) return "branch.already";
  if (!state.office || state.stage < 3) return "branch.stage";
  const t = STAGES.branch;
  // sınav dönemi: mezunlar ayrılmak üzere, doluluk yanıltıcıdır (yeni şube yaz boşluğuna açılırdı)
  if (daysUntil(state.hour, examIso(state.season.index)) <= t.examBlackoutWeeks * 7) return "branch.season";
  // yeni yer oturmadan bir sonraki açılmaz
  if (state.lastBranchHour !== null && state.hour - state.lastBranchHour < t.minWeeksBetween * HOURS_PER_WEEK) return "branch.tooSoon";
  if (state.reputation.trust < branchTrust(state)) return "branch.trust";
  if (activeCount(state) < Math.ceil(capacity(state) * t.fillRatio)) return "branch.students";
  if (state.economy.business < branchMoneyNeeded(b)) return "branch.noMoney";
  if (coaches(state).length < branchCoaches(state)) return "branch.coaches";
  return null;
}

export function openBranch(state: GameState, branchId: string): string | null {
  const err = branchBlocker(state, branchId);
  if (err) return err;
  const b = BRANCH_BY_ID[branchId];
  payFromBusinessFirst(state, b.rent * b.depositMonths, "officeDeposit");
  payFromBusinessFirst(state, b.setup, "officeSetup");
  state.branches.push(b.id);
  state.lastBranchHour = state.hour;
  repTrust(state, b.trustOnce);
  if (state.stage < 4) {
    state.stage = 4;
    emit(state, "stageReached", { stage: 4, branch: b.id });
  } else emit(state, "branchOpened", { branch: b.id });
  return null;
}

export function startCert(state: GameState, certId: string): string | null {
  const c = CERT_BY_ID[certId];
  if (!c) return "cert.unknown";
  if (state.coach.certs.includes(certId)) return "cert.owned";
  if (state.coach.training) return "cert.busy";
  if (coachHours(state) - state.coach.usedThisWeek < c.hoursPerWeek) return "coach.noTime";
  payFromBusinessFirst(state, c.cost, "certification");
  addCoachPenalty(state, c.hoursPerWeek, c.weeks, `cert.${c.id}`);
  state.coach.training = { cert: c.id, weeksLeft: c.weeks };
  emit(state, "certStarted", { cert: c.id });
  return null;
}

export function rentOffice(state: GameState, officeId: string): string | null {
  const o = OFFICE_BY_ID[officeId];
  if (!o) return "office.unknown";
  if (state.office) return "office.already";
  if (state.stage < 2) return "office.stage";
  const upfront = o.rent * o.depositMonths + o.setup;
  if (state.economy.business < upfront) return "office.noMoney";
  payFromBusinessFirst(state, o.rent * o.depositMonths, "officeDeposit");
  payFromBusinessFirst(state, o.setup, "officeSetup");
  state.office = o.id;
  state.stage = 3;
  repTrust(state, o.trustOnce);
  emit(state, "stageReached", { stage: 3, office: o.id });
  return null;
}

/** Ayın 1'i: ofis ve şubelerin kirası ve faturaları işletmeden. */
export function officeMonthly(state: GameState): void {
  if (!state.office) return;
  for (const o of [OFFICE_BY_ID[state.office], ...branchDefs(state)]) {
    payFromBusinessFirst(state, o.rent, "officeRent");
    payFromBusinessFirst(state, o.utilities, "utilities");
  }
}

/** Hafta kapanışı: eğitim ilerler, aşama eşikleri denetlenir, ofis bilinirlik getirir. */
export function weeklyGrowth(state: GameState): void {
  const tr = state.coach.training;
  if (tr) {
    tr.weeksLeft--;
    if (tr.weeksLeft <= 0) {
      state.coach.certs.push(tr.cert);
      state.coach.training = null;
      const c = CERT_BY_ID[tr.cert];
      if (c?.trustOnce) repTrust(state, c.trustOnce);
      emit(state, "certEarned", { cert: tr.cert });
    }
  }
  if (state.stage === 1) {
    const t = STAGES.stage2;
    if (activeCount(state) >= t.activeStudents && state.reputation.trust >= t.trust && (state.economy.totals.tuition ?? 0) >= t.tuitionTotal) {
      state.stage = 2;
      emit(state, "stageReached", { stage: 2 });
    }
  }
  if (state.office) repAwareness(state, OFFICE_BY_ID[state.office].awarenessWeekly + sum(branchDefs(state).map((b) => b.awarenessWeekly)));
}
