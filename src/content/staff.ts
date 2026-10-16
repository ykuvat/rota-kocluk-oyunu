// Personel (GDD E9): yardımcı koç, sekreter, rehber öğretmen, branş öğretmeni. Ofisle (Aşama 3) açılır. Tutarlar ÖRNEKTİR.
// Yardımcı koç rutin takibi üstlenir; oyuncu (Buse) görüşme, müdahale ve veli işlerini yine kendi saatiyle yapar.
// Uzmanlar öğrenci almaz; kurumun tamamına haftalık etki verir (etki gücü beceri / ROLE_SKILL_REF).

export type StaffRole = "coach" | "secretary" | "counselor" | "teacher";

export interface RoleDef {
  /** beceri → piyasa maaşı (₺/ay): taban + beceri başına */
  salaryBase: number;
  salaryPerSkill: number;
  /** yer (ofis + her şube) başına en fazla kişi; 0 = sınırsız */
  perSite: number;
  /** başvuru havuzunda görülme ağırlığı */
  weight: number;
  /** bu rol için başvuru ancak kurumda en az bu kadar aktif öğrenci varken gelir (küçük kurumda uzman kârsızdır) */
  minStudents: number;
}

export const ROLES: Record<StaffRole, RoleDef> = {
  // denge (3 sezon botu): 8 öğrenci × ~7.000 ₺ gelirin ~%55'i işveren maliyeti olsun
  coach: { salaryBase: 13_000, salaryPerSkill: 150, perSite: 0, weight: 3, minStudents: 0 },
  secretary: { salaryBase: 5_000, salaryPerSkill: 30, perSite: 1, weight: 1, minStudents: 12 },
  counselor: { salaryBase: 8_000, salaryPerSkill: 80, perSite: 1, weight: 1, minStudents: 20 },
  teacher: { salaryBase: 10_000, salaryPerSkill: 110, perSite: 2, weight: 1, minStudents: 14 },
};

export const ROLE_IDS = Object.keys(ROLES) as StaffRole[];

/** Uzman etkileri bu beceride tam (1×) güçtedir; 30 beceri yarım, 90 beceri 1,5 kat. */
export const ROLE_SKILL_REF = 60;

export const SPECIALISTS = {
  secretary: {
    /** evrak, telefon, randevu: Buse'nin haftalık saatine eklenen saat (beceriden bağımsız) */
    adminHours: 6,
    /** adayların karar süresi çarpanı (randevu, geri arama) */
    leadTtlFactor: 1.5,
    /** kayıt olasılığına logit katkısı (düzenli karşılama) */
    conversion: 0.25,
    /** her öğrencinin velisine haftalık memnuniyet */
    parentWeekly: 0.6,
  },
  counselor: {
    /** bir rehber öğretmenin haftada ilgilenebildiği öğrenci (en kaygılılardan başlar) */
    students: 16,
    anxiety: -5,
    motivation: 3,
    parentWeekly: 0.8,
    /** tercih danışmanlığı kabulüne logit katkısı */
    preference: 0.8,
  },
  teacher: {
    /** bir branş öğretmeninin haftalık etüt kapasitesi (en zayıf öğrencilerden başlar) */
    students: 12,
    /** en zayıf ön koşul konusuna haftalık ustalık (azalan getiriyle) */
    mastery: 3,
    /** etüde alınan her öğrencinin ailesinden haftalık etüt ücreti (₺) */
    weeklyFee: 350,
  },
} as const;

export const STAFF = {
  /** tam zamanlı haftalık saat */
  weeklyHours: 40,
  /** her koç için ideal vaka sayısı; üstünde o koçun öğrencilerinde takip kalitesi düşer */
  idealCaseload: 8,
  /** işveren maliyeti (SGK + vergi) brüt maaş üstüne */
  employerCostRate: 0.225,
  /** işten çıkarmada kıdem/ihbar (ay maaşı) */
  severanceMonths: 1,
  /** aday havuzu: haftada bir yenilenir, en fazla bu kadar aday, ilan süresi (gün) */
  maxCandidates: 4,
  candidateTtlDays: 14,
  /** beceri tahmini belirsizliği (± puan), oyuncu adayı yalnız aralık olarak görür */
  skillFog: 15,
  /** takip kalitesi: (beceri − 60) / bölen kadar haftalık güven/motivasyon etkisi */
  qualityDivisor: 8,
  /** haftalık veli memnuniyeti etkisi: (beceri − 60) / bölen */
  parentQualityDivisor: 20,
  /** moral: maaş piyasanın altındaysa ve vaka fazlaysa düşer; eşiğin altında istifa riski */
  moralePerUnderpaidPct: 0.4,
  moralePerExtraCase: 4,
  moraleRecovery: 3,
  quitBelow: 25,
  quitChance: 0.35,
} as const;

export const STAFF_FIRST_NAMES = ["Elif", "Mert", "Zeynep", "Can", "Ayşe", "Emre", "Deniz", "Selin", "Burak", "İrem", "Kaan", "Nehir"] as const;
export const STAFF_LAST_NAMES = ["Arslan", "Kara", "Öztürk", "Aydın", "Polat", "Kılıç", "Erdem", "Yalçın", "Taş", "Güneş"] as const;
