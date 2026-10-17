// Müdahale kartları (GDD D6). Her kart bir kök nedene hedeflenir; neden tutarsa tam etki,
// tutmazsa yarım etki + güven kaybı. Aynı kart üst üste kullanıldıkça etkisi azalır.

import type { MissCause, StateStat } from "../sim/student";

export type InterventionId =
  | "trustTalk"
  | "studentSetsGoal"
  | "smallGoals"
  | "simplifyProgram"
  | "focusPlan"
  | "restPlan"
  | "subjectSupport";

export interface InterventionDef {
  id: InterventionId;
  nameKey: string;
  /** Koç saati */
  hours: number;
  /** Bu müdahalenin çözdüğü kök nedenler */
  targets: MissCause[];
  /** Geçici durum etkileri (değiştirici olarak eklenir) */
  effects: Partial<Record<StateStat, number>>;
  /** Kalıcı (taban) etkiler: ör. yorgunluğu hemen düşürmek */
  baseEffects?: Partial<Record<StateStat, number>>;
  durationDays: number;
  /** Ön koşul: en az bu güven (gözlenen değil, gerçek) */
  minTrust?: number;
}

export const INTERVENTIONS: Record<InterventionId, InterventionDef> = {
  trustTalk: {
    id: "trustTalk", nameKey: "iv.trustTalk", hours: 1.5, targets: ["trust"],
    effects: { trust: 15, goalOwnership: 6, motivation: 5 }, durationDays: 21,
  },
  studentSetsGoal: {
    id: "studentSetsGoal", nameKey: "iv.studentSetsGoal", hours: 1.5, targets: ["trust", "motivation"],
    effects: { goalOwnership: 20, motivation: 8 }, durationDays: 28, minTrust: 30,
  },
  smallGoals: {
    id: "smallGoals", nameKey: "iv.smallGoals", hours: 1, targets: ["motivation"],
    effects: { motivation: 14, selfEfficacy: 8 }, durationDays: 14,
  },
  simplifyProgram: {
    id: "simplifyProgram", nameKey: "iv.simplifyProgram", hours: 1, targets: ["overload", "time"],
    effects: { motivation: 5 }, durationDays: 7,
  },
  focusPlan: {
    id: "focusPlan", nameKey: "iv.focusPlan", hours: 1, targets: ["distraction"],
    effects: { distraction: -20, routine: 10 }, durationDays: 21,
  },
  restPlan: {
    id: "restPlan", nameKey: "iv.restPlan", hours: 0.5, targets: ["fatigue"],
    effects: { sleep: 15 }, baseEffects: { fatigue: -25 }, durationDays: 14,
  },
  subjectSupport: {
    id: "subjectSupport", nameKey: "iv.subjectSupport", hours: 2, targets: ["difficulty"],
    effects: { selfEfficacy: 8 }, durationDays: 14,
  },
};

export const INSIGHT = {
  initial: 20,
  /** Görüşme başına tanıma artışı, güven çarpanıyla: kazanç · (0,4 + güven/100) */
  interviewGain: 25,
  interviewHours: 1,
  /** Sohbette öğrencinin asıl sorunu ima etmesi için gereken en az güven (altında "pek açılmadı") */
  clueMinTrust: 30,
  /** Program takibiyle her hafta tüm değerlerde pasif artış */
  weeklyPassive: 3,
  /** Aralık yarı genişliği = minHalfWidth + (100 − tanıma) · widthPerMissingInsight */
  minHalfWidth: 4,
  widthPerMissingInsight: 0.25,
  /** Merkez sapması = yarı genişlik · bu oran · (−1..1 arası deterministik) */
  centerBias: 0.6,
  /** Uyumsuz müdahalede güven kaybı ve etki çarpanı */
  mismatchTrust: -3,
  mismatchFactor: 0.5,
  matchTrust: 2,
  /** Doğru teşhisle yapılan müdahalenin bu oranı kalıcı olur (alışkanlık değişimi). */
  matchPermanentShare: 0.3,
  /** Aynı hafta k. müdahalenin etki çarpanı = 1 / (1 + crowding · (k − 1)) */
  crowding: 0.6,
  /** Haftada bu sayıyı aşan her müdahale baskı yaratır */
  pressureAfter: 2,
  pressureAnxiety: 3,
  pressureTrust: -3,
};

/** Sinyalin en olası çaresi (oyun modunda karar kartının "doğru" seçeneği; sinyaller belirsiz olduğu için her zaman tutmaz). */
export const SIGNAL_TO_IV: Record<string, InterventionId> = {
  "signal.shortAnswers": "trustTalk", "signal.cancels": "trustTalk", "signal.dontKnow": "smallGoals",
  "signal.lowEnergy": "restPlan", "signal.morningBlank": "restPlan", "signal.lateOnline": "focusPlan",
  "signal.halfDone": "focusPlan", "signal.tasksPileUp": "simplifyProgram", "signal.schoolLoad": "simplifyProgram",
  "signal.blankInSubject": "subjectSupport", "signal.asksSameQuestion": "subjectSupport",
};

/** Görüşme kartları: hangi değerleri aydınlatır */
export const INTERVIEW_TOPICS: Record<string, StateStat[]> = {
  motivation: ["motivation", "goalOwnership", "selfEfficacy"],
  habits: ["routine", "distraction", "sleep"],
  feelings: ["anxiety", "trust", "fatigue"],
};
