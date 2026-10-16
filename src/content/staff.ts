// Personel (GDD E9): yardımcı koçlar. Ofisle (Aşama 3) açılır. Tutarlar ÖRNEKTİR.
// Yardımcı koç rutin takibi üstlenir; oyuncu (Buse) görüşme, müdahale ve veli işlerini yine kendi saatiyle yapar.

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
  maxCandidates: 3,
  candidateTtlDays: 14,
  /** beceri → piyasa maaşı (₺/ay): taban + beceri başına */
  // denge (3 sezon botu): 8 öğrenci × ~7.000 ₺ gelirin ~%55'i işveren maliyeti olsun
  salaryBase: 13_000,
  salaryPerSkill: 150,
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
