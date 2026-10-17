// Öğrenci arşetipleri (GDD D2). Arşetip sabit sınıf değil, üretim için başlangıç dağılımıdır:
// her değer [min, max] aralığından tohumlu rastgeleyle çekilir.

export type Range = [number, number];
export type Gender = "f" | "m";

export interface ArchetypeDef {
  id: string;
  nameKey: string;
  /** görünüm (sprite) ve isim için: arşetipin karakter çizimi bu cinsiyette */
  gender: Gender;
  personality: { conscientiousness: Range; neuroticism: Range; openness: Range; learningSpeed: Range };
  state: {
    motivation: Range;
    selfEfficacy: Range;
    anxiety: Range;
    goalOwnership: Range;
    trust: Range;
    routine: Range;
    distraction: Range;
    sleep: Range;
  };
  /** Başlangıç ustalığı: ders bazlı aralık */
  mastery: Record<"mat" | "fiz" | "kim" | "tur", Range>;
  context: { familySupport: Range; parentExpectation: Range };
}

export const ARCHETYPES: Record<string, ArchetypeDef> = {
  anxious_perfectionist: {
    id: "anxious_perfectionist",
    nameKey: "archetype.anxious_perfectionist",
    gender: "f",
    personality: { conscientiousness: [70, 90], neuroticism: [70, 90], openness: [40, 60], learningSpeed: [0.9, 1.1] },
    state: {
      motivation: [55, 70], selfEfficacy: [30, 45], anxiety: [65, 85], goalOwnership: [60, 75],
      trust: [35, 50], routine: [65, 80], distraction: [15, 30], sleep: [45, 60],
    },
    mastery: { mat: [40, 60], fiz: [35, 55], kim: [35, 55], tur: [50, 70] },
    context: { familySupport: [60, 80], parentExpectation: [75, 95] },
  },
  talented_messy: {
    id: "talented_messy",
    nameKey: "archetype.talented_messy",
    gender: "m",
    personality: { conscientiousness: [20, 40], neuroticism: [25, 45], openness: [65, 85], learningSpeed: [1.2, 1.4] },
    state: {
      motivation: [45, 60], selfEfficacy: [60, 75], anxiety: [20, 35], goalOwnership: [35, 50],
      trust: [40, 55], routine: [15, 30], distraction: [60, 80], sleep: [40, 55],
    },
    mastery: { mat: [45, 65], fiz: [40, 60], kim: [30, 50], tur: [40, 60] },
    context: { familySupport: [40, 60], parentExpectation: [55, 75] },
  },
  quiet_drifter: {
    id: "quiet_drifter",
    nameKey: "archetype.quiet_drifter",
    gender: "m",
    personality: { conscientiousness: [40, 55], neuroticism: [45, 65], openness: [35, 55], learningSpeed: [0.85, 1.05] },
    state: {
      motivation: [25, 40], selfEfficacy: [30, 45], anxiety: [40, 55], goalOwnership: [15, 30],
      trust: [25, 40], routine: [35, 50], distraction: [50, 70], sleep: [45, 60],
    },
    mastery: { mat: [20, 35], fiz: [15, 30], kim: [20, 35], tur: [35, 50] },
    context: { familySupport: [30, 50], parentExpectation: [60, 80] },
  },
};

/** Kurgusal öğrenci adları (iki dilde de Türkçe kalır). */
export const FIRST_NAMES_F = ["Zeynep", "Ece", "Defne", "Elif", "Selin", "Nehir", "Ada", "Duru", "Asya", "İpek"];
export const FIRST_NAMES_M = ["Mert", "Can", "Emir", "Kaan", "Arda", "Berk", "Efe", "Yusuf", "Deniz", "Ali"];
export const FIRST_NAMES = [...FIRST_NAMES_F, ...FIRST_NAMES_M];
/** Cinsiyete uygun ilk ad listesi. */
export const firstNames = (g: Gender) => (g === "f" ? FIRST_NAMES_F : FIRST_NAMES_M);
export const LAST_NAMES = ["Aydın", "Kaya", "Şahin", "Çelik", "Yıldız", "Öztürk", "Arslan", "Doğan", "Kurt", "Koç"];
