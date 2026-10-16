// Koçun program tahmini (GDD D4): gerçek değerler bilinmez. Gözlem aralıklarının ORTASIYLA beklenen
// uyum hesaplanır; belirsizlik, her değerin aralık yarı genişliği · ağırlığı bağımsız hata sayılarak
// logit üzerinde ±Z·σ olarak eklenir. Öğrenci tanındıkça aralık daralır.

import { BALANCE } from "../content/balance";
import { INSIGHT } from "../content/interventions";
import { observe } from "./insight";
import { complianceTerms, sigmoid, type ProgramBlock, type StateStat, type Student } from "./student";

/** Tahmin aralığının genişliği (σ katı). */
const Z = 1.75;

/** Gözlem ortalarıyla kurulmuş varsayımsal öğrenci (değiştiriciler gözlemin içinde zaten var). */
function midStudent(s: Student, now: number): Student {
  const base = { ...s.base };
  for (const k of Object.keys(base) as StateStat[]) {
    const o = observe(s, k, now);
    base[k] = (o.lo + o.hi) / 2;
  }
  // kişilik doğrudan görülmez: rutin gözlemiyle aynı varsayılır
  return { ...s, base, mods: [], personality: { ...s.personality, conscientiousness: base.routine } };
}

const half = (s: Student, k: StateStat, now: number) => {
  const o = observe(s, k, now);
  return (o.hi - o.lo) / 2;
};

/** Logit belirsizliği (σ): uyum terimlerine giren değerlerin aralıklarından. */
function logitSigma(s: Student, now: number): number {
  const w = BALANCE.compliance;
  const parts = [
    w.motivation * half(s, "motivation", now),
    w.trust * half(s, "trust", now),
    w.goalOwnership * half(s, "goalOwnership", now),
    w.fatigue * half(s, "fatigue", now),
    w.distraction * half(s, "distraction", now),
    // disiplin = (vicdanlılık + rutin)/2, ikisi de rutin gözleminden: tam ağırlık
    w.discipline * half(s, "routine", now),
  ];
  // gözlem merkezi gerçek değerden en çok yarı genişlik · centerBias kadar, düzgün dağılımla sapar:
  // σ(sapma) = yarı genişlik · centerBias / √3
  return (Math.sqrt(parts.reduce((a, p) => a + p * p, 0)) * INSIGHT.centerBias) / Math.sqrt(3);
}

export function sustainableRange(s: Student, now: number, weekday = 0): { lo: number; hi: number } {
  const l = BALANCE.load;
  const r = observe(s, "routine", now);
  const bonus = weekday >= 5 ? l.weekendSustainableBonus : 0;
  const f = (d: number) => l.sustainableBase + (d / 100) * l.sustainableFromDiscipline + bonus;
  return { lo: Math.round(f(r.lo) * 10) / 10, hi: Math.round(f(r.hi) * 10) / 10 };
}

export interface ProgramEstimate {
  /** Gün başına toplam saat */
  perDay: number[];
  /** Gün yükü: "ok" | "risky" (sürdürülebilir aralığın içinde) | "over" */
  dayLoad: ("ok" | "risky" | "over")[];
  /** Haftalık beklenen uyum: orta tahmin ve aralık (0–1) */
  compliance: { lo: number; mid: number; hi: number };
}

export function estimateProgram(s: Student, blocks: ProgramBlock[], now: number): ProgramEstimate {
  const free = (d: number) => (d >= 5 ? BALANCE.load.freeHoursWeekend : BALANCE.load.freeHoursWeekday);
  const mid = midStudent(s, now);
  const sigma = logitSigma(s, now);
  const perDay = [0, 1, 2, 3, 4, 5, 6].map((d) => blocks.filter((b) => b.weekday === d).reduce((a, b) => a + b.hours, 0));
  const dayLoad = perDay.map((h, d) => {
    const sus = sustainableRange(s, now, d);
    return h > free(d) || h > sus.hi ? "over" : h > sus.lo ? "risky" : "ok";
  });

  let lo = 0, m = 0, hi = 0, n = 0;
  for (let d = 0; d < 7; d++) {
    const sus = sustainableRange(s, now, d);
    const susMid = (sus.lo + sus.hi) / 2;
    const over = Math.max(0, perDay[d] / susMid - 1);
    let used = 0;
    for (const b of blocks.filter((x) => x.weekday === d)) {
      n++;
      if (used + b.hours > free(d)) continue; // zaman yetmez: kesin kaçar
      used += b.hours;
      const logit = Object.values(complianceTerms(mid, b, over, now)).reduce((a, v) => a + v, 0);
      lo += sigmoid(logit - Z * sigma);
      m += sigmoid(logit);
      hi += sigmoid(logit + Z * sigma);
    }
  }
  return { perDay, dayLoad, compliance: n ? { lo: lo / n, mid: m / n, hi: hi / n } : { lo: 0, mid: 0, hi: 0 } };
}
