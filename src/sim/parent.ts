// Veli modeli (GDD D7). Veli gerçek gelişimi değil algıladığını görür: deneme eğilimi, görev uyumu,
// koçla iletişim. İletişim tarzı ve memnuniyeti ilk veli görüşmesine kadar bilinmez (sis).

import { BALANCE } from "../content/balance";
import type { Rng } from "../core/rng";
import { averageMastery, type Student } from "./student";

export type ParentStyle = "calm" | "anxious" | "demanding" | "distant";

export interface Parent {
  style: ParentStyle;
  /** 0–100: velinin beklentisi (öğrencinin context.parentExpectation'ından başlar) */
  expectation: number;
  /** 0–100 */
  satisfaction: number;
  /** son veli görüşmesinin haftası; hiç yoksa null */
  lastMeetingWeek: number | null;
  /** koç veliyle tanıştı mı (tarz ve memnuniyet görünür olur) */
  known: boolean;
}

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number) => Math.min(100, Math.max(0, v));

export function generateParent(context: Student["context"], rng: Rng): Parent {
  // yüksek beklenti + düşük destek → talepkâr; yüksek beklenti → kaygılı; düşük destek → ilgisiz
  const r = rng.next();
  let style: ParentStyle = "calm";
  if (context.parentExpectation > 75 && context.familySupport < 60) style = r < 0.7 ? "demanding" : "anxious";
  else if (context.parentExpectation > 70) style = r < 0.6 ? "anxious" : "calm";
  else if (context.familySupport < 45) style = r < 0.6 ? "distant" : "calm";
  return {
    style,
    expectation: context.parentExpectation,
    satisfaction: BALANCE.parent.initialSatisfaction,
    lastMeetingWeek: null,
    known: false,
  };
}

/** Velinin algıladığı gelişim (0–100 ölçek, 50 = "yerinde sayıyor"). */
export function perceivedProgress(s: Student): number {
  const p = BALANCE.parent;
  const h = s.history;
  const last = h.at(-1);
  if (!last) return 50;
  const past = h.at(-5) ?? h[0];
  const masteryDelta = last.avgMastery - past.avgMastery;
  const doneRate = last.assigned ? last.done / last.assigned : 0;
  let v = 50 + masteryDelta * p.masteryDeltaWeight + (doneRate - p.complianceCenter) * p.complianceWeight;
  const m = s.mocks;
  if (m.length >= 2 && m.at(-1)!.week === last.week) v += m.at(-1)!.total >= m.at(-2)!.total ? p.mockUp : p.mockDown;
  return clamp(v);
}

export type ParentOutcome = "ok" | "warning" | "left";

/** Hafta kapanışında velinin memnuniyetini günceller; baskıyı ve ayrılmayı uygular. */
export function updateParentWeekly(s: Student, week: number): ParentOutcome {
  const p = BALANCE.parent;
  const par = s.parent;
  // beklentisi yüksek veli için hedef de yüksektir: algılanan 50 + (beklenti − 50) · 0,5
  const target = 50 + (par.expectation - 50) * 0.5;
  let d = (perceivedProgress(s) - target) * p.gapWeight;
  const needsContact = par.style === "anxious" || par.style === "demanding";
  const sinceMeeting = par.lastMeetingWeek === null ? week + 1 : week - par.lastMeetingWeek;
  if (needsContact && sinceMeeting >= p.contactWeeks) d += p.noContactPenalty;
  if (par.style === "distant") d *= 0.5; // ilgisiz veli az tepki verir
  par.satisfaction = round1(clamp(par.satisfaction + d));

  if (needsContact && par.satisfaction < p.pressureBelow) {
    s.base.anxiety = round1(clamp(s.base.anxiety + p.pressureAnxiety));
  }
  if (par.satisfaction <= p.leaveAt) return "left";
  if (par.satisfaction < p.warnBelow) return "warning";
  return "ok";
}

/** Veli görüşmesi: beklenti ayarı (dürüst iletişim) ve memnuniyet. */
export function holdParentMeeting(s: Student, week: number, factor = 1): void {
  const p = BALANCE.parent;
  const par = s.parent;
  // çok sık görüşme değerini yitirir (denge botu: 3 haftada bir görüşmek memnuniyeti hep 100'de tutuyordu)
  const since = par.lastMeetingWeek === null ? Infinity : week - par.lastMeetingWeek;
  const fresh = since >= p.meetingFreshWeeks ? 1 : p.meetingStaleFactor;
  par.known = true;
  par.lastMeetingWeek = week;
  par.satisfaction = round1(clamp(par.satisfaction + p.meetingSatisfaction * factor * fresh));
  par.expectation = round1(Math.max(p.expectationFloor, par.expectation + p.meetingExpectationAdjust));
}

/** Görüşme olmadan da görülebilen veli sinyalleri. */
export function parentSignals(s: Student, week: number): string[] {
  const par = s.parent;
  const out: string[] = [];
  const sinceMeeting = par.lastMeetingWeek === null ? week + 1 : week - par.lastMeetingWeek;
  if ((par.style === "anxious" || par.style === "demanding") && sinceMeeting >= 2) out.push("signal.parentCalls");
  if (par.satisfaction < 40) out.push("signal.parentCold");
  if (par.style === "distant" && sinceMeeting >= 3) out.push("signal.parentSilent");
  if (averageMastery(s) < 30 && par.expectation > 75) out.push("signal.parentComparesSibling");
  return out;
}

export function satisfactionWord(v: number): string {
  return v >= 70 ? "parent.happy" : v >= 45 ? "parent.unsure" : v >= 25 ? "parent.uneasy" : "parent.angry";
}
