// Öğrencinin hayatından geçici olaylar: aynı öğrenci her hafta aynı nedenle görev kaçırmasın.
// Her olay birkaç günlük değiştirici olarak eklenir (kaynak `life.<id>`); oyuncu olayı değil, yol açtığı
// davranış sinyallerini görür (sohbette öğrenci anlatabilir).

import type { StateStat } from "../sim/student";

export interface LifeEventDef {
  id: string;
  /** seçilme ağırlığı */
  weight: number;
  /** süre (gün), [en az, en çok] */
  days: [number, number];
  /** durum değerlerine ve "freeHours"a (günlük boş saat) geçici ekler */
  effects: Partial<Record<StateStat | "freeHours", number>>;
}

export const LIFE_EVENTS: LifeEventDef[] = [
  { id: "newGame", weight: 3, days: [7, 12], effects: { distraction: 30, routine: -10 } },
  { id: "schoolExams", weight: 3, days: [6, 10], effects: { freeHours: -2, fatigue: 15, anxiety: 6 } },
  { id: "illness", weight: 2, days: [4, 7], effects: { fatigue: 40, sleep: -10 } },
  { id: "friendFight", weight: 2, days: [6, 10], effects: { motivation: -25, anxiety: 8 } },
  { id: "familyTension", weight: 2, days: [7, 12], effects: { trust: -22, goalOwnership: -18 } },
  { id: "goodNews", weight: 3, days: [5, 9], effects: { motivation: 12, selfEfficacy: 8 } },
];

export const LIFE = {
  /** Haftalık olay olasılığı (öğrenci başına; süren olay varken yeni olay yok) */
  chancePerWeek: 0.3,
};
