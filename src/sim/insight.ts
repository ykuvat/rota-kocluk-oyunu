// Gözlem sisi (GDD "Teşhis ve Gözlem"): oyuncu öğrencinin iç durumunu kesin değil, aralık olarak görür.
// Aralığın merkezi gerçek değerden deterministik bir miktar sapar; tanıma arttıkça hem aralık hem sapma daralır.

import { INSIGHT, INTERVIEW_TOPICS } from "../content/interventions";
import { stat, type MissCause, type StateStat, type Student } from "./student";

export interface Observed {
  lo: number;
  hi: number;
  /** 0–100: koçun bu değeri ne kadar tanıdığı */
  insight: number;
}

export const insightOf = (s: Student, key: StateStat) => s.insight[key] ?? INSIGHT.initial;

/** Ortalama tanıma (0–100): görüşme konularının kapsadığı tüm değerler üzerinden. */
export function averageInsight(s: Student): number {
  const keys = [...new Set(Object.values(INTERVIEW_TOPICS).flat())];
  return Math.round(keys.reduce((a, k) => a + insightOf(s, k), 0) / keys.length);
}

/** Geçen haftanın kaçırma nedenleri, sıklığa göre (en sık önce). */
export function causesLastWeek(s: Student): MissCause[] {
  const last = s.history.at(-1);
  if (!last) return [];
  return (Object.entries(last.missCauses) as [MissCause, number][]).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([c]) => c);
}

/** Öğrenci kimliği + değer adından −1..1 arası sabit sayı (kayıt gerektirmez, tekrar üretilebilir). */
function bias(id: string, key: string): number {
  let h = 2166136261;
  for (const ch of `${id}:${key}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) / 4294967295) * 2 - 1;
}

export function observe(s: Student, key: StateStat, now: number): Observed {
  const insight = insightOf(s, key);
  const half = INSIGHT.minHalfWidth + (100 - insight) * INSIGHT.widthPerMissingInsight;
  const center = stat(s, key, now).value + bias(s.id, key) * half * INSIGHT.centerBias;
  return {
    lo: Math.max(0, Math.round(center - half)),
    hi: Math.min(100, Math.round(center + half)),
    insight,
  };
}

export function addInsight(s: Student, keys: StateStat[], amount: number): void {
  for (const k of keys) s.insight[k] = Math.min(100, Math.round(insightOf(s, k) + amount));
}

/**
 * Gözlemlenebilir sinyaller: kaçırma nedenleri adlarıyla değil, koçun göreceği davranışlarla.
 * Her nedenin birden fazla sinyali olabilir; birden fazla neden aynı sinyali paylaşabilir (belirsizlik).
 */
export const SIGNALS: Record<MissCause, string[]> = {
  time: ["signal.tasksPileUp", "signal.schoolLoad"],
  motivation: ["signal.dontKnow", "signal.lowEnergy"],
  fatigue: ["signal.morningBlank", "signal.lowEnergy"],
  difficulty: ["signal.blankInSubject", "signal.asksSameQuestion"],
  distraction: ["signal.lateOnline", "signal.halfDone"],
  overload: ["signal.tasksPileUp", "signal.halfDone"],
  trust: ["signal.shortAnswers", "signal.cancels"],
};

/** Geçen haftanın kaçırma nedenlerinden sinyal listesi (en sık önce, tekrarsız). */
export function weeklySignals(s: Student): string[] {
  const last = s.history.at(-1);
  if (!last) return [];
  const out: string[] = [];
  const causes = (Object.entries(last.missCauses) as [MissCause, number][]).sort((a, b) => b[1] - a[1]);
  for (const [cause, n] of causes) {
    if (n < 2) continue; // tek seferlik kaçırma sinyal üretmez
    for (const sig of SIGNALS[cause]) if (!out.includes(sig)) out.push(sig);
  }
  return out.slice(0, 4);
}

/** Geçen haftanın gerçek baskın nedeni (gizli; müdahale uyumunu belirler). */
export function dominantCauseLastWeek(s: Student): MissCause | null {
  const last = s.history.at(-1);
  if (!last) return null;
  let best: MissCause | null = null;
  let n = 0;
  for (const [k, v] of Object.entries(last.missCauses) as [MissCause, number][]) {
    if (v > n) {
      n = v;
      best = k;
    }
  }
  return best;
}
