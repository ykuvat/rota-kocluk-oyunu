// Sertifikalar, aşama ilerlemesi ve ofis (GDD A, E8). Etkiler küçük ama kalıcıdır; bedeli para + haftalarca koç saati.

import { CERT_BY_ID, OFFICE_BY_ID, STAGES, type CertDef } from "../content/growth";
import { payFromBusinessFirst } from "./economy";
import { repAwareness, repTrust } from "./effects";
import { addCoachPenalty, emit, type GameState } from "./state";

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

export function capacity(state: GameState): number {
  return state.office ? OFFICE_BY_ID[state.office].capacity : STAGES.homeCapacity;
}

/** Kurumsal görünümün kayıt olasılığına katkısı (sertifika + ofis). */
export function conversionBonus(state: GameState): number {
  return certEffect(state, "conversion") + (state.office ? OFFICE_BY_ID[state.office].conversion : 0);
}

export function startCert(state: GameState, certId: string): string | null {
  const c = CERT_BY_ID[certId];
  if (!c) return "cert.unknown";
  if (state.coach.certs.includes(certId)) return "cert.owned";
  if (state.coach.training) return "cert.busy";
  if (state.coach.weeklyHours - state.coach.usedThisWeek < c.hoursPerWeek) return "coach.noTime";
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

/** Ayın 1'i: ofis kirası ve faturalar işletmeden. */
export function officeMonthly(state: GameState): void {
  if (!state.office) return;
  const o = OFFICE_BY_ID[state.office];
  payFromBusinessFirst(state, o.rent, "officeRent");
  payFromBusinessFirst(state, o.utilities, "utilities");
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
  if (state.office) repAwareness(state, OFFICE_BY_ID[state.office].awarenessWeekly);
}
