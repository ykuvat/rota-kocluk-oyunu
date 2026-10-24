// İşletme dengesi (GDD E, F). Tutarlar ₺ cinsinden ÖRNEKTİR; enflasyon kapalıyken sabittir.
// Hedef his: Aşama 1'de başa baş için ~4 öğrenci gerekir; ilk öğrenciyi bulmak garanti değildir.

export const ECONOMY = {
  startPersonal: 25_000,
  startBusiness: 0,
  /** Aylık kişisel giderler (ayın 1'i 09:00) */
  monthlyPersonal: {
    rent: 12_000,
    food: 8_000,
    transport: 2_500,
    phoneInternet: 1_000,
  },
  /** İş günü başına kahve/yol (öğrenci görüşmesi olan günler) */
  dailyWorkCost: 120,
  /** Kişisel hesap eksideyse aylık faiz (kredi kartı) */
  creditCardMonthlyInterest: 0.045,
  /** Önerilen ilk fiyat (aylık birebir koçluk) */
  suggestedFee: 6_000,
  /** net varlık (kişisel + kasa) ayın 1'inde bunun altındaysa iflas: oyun biter */
  bankruptcyLimit: -75_000,
  minFee: 2_000,
  maxFee: 20_000,
} as const;

export const COACHING = {
  /** Her aktif öğrencinin haftalık takip saati (1 sa birebir görüşme + hazırlık, ödev kontrolü, mesajlar). */
  followUpHours: 3,
  /** Takip edilemeyen öğrencinin haftalık güven kaybı */
  neglectTrust: -6,
  neglectMotivation: -3,
  /** GDD: ideal vaka sayısının üstünde her öğrenci TÜM öğrencilerin takip kalitesini düşürür */
  idealCaseload: 8,
  caseloadTrustPerExtra: -3,
  caseloadMotivationPerExtra: -2,
  /** veli tarafı: "koça ulaşılamıyor" — fazla öğrenci başına haftalık memnuniyet kaybı */
  caseloadParentPerExtra: -1.5,
} as const;

export type LeadSource = "network" | "organic" | "paidSocial" | "referral";

export const FUNNEL = {
  /** Kişisel çevredeki potansiyel aday sayısı (tükenir) */
  networkPool: 6,
  /** Çevreyi aramaya ayrılan haftalık koç saati ve haftalık aday olasılığı */
  networkHours: 1,
  networkLeadChance: 0.45,
  /** Organik içerik: saat başına takipçi artışı ve takipçi başına haftalık aday */
  organicFollowersPerHour: 8,
  organicFollowerDecay: 0.03,
  organicLeadsPerFollower: 1 / 500,
  /** Ücretli reklam: aday = √(bütçe / 100) · çarpan (azalan getiri) */
  paidLeadFactor: 0.25,
  /** Memnun velinin haftalık tavsiye olasılığı */
  referralSatisfaction: 65,
  referralChance: 0.04,
  /** Tavsiye için öğrencinin kurumdaki en az hafta sayısı */
  referralMinWeeks: 4,
  /** Aday bu kadar gün içinde görüşülmezse soğur */
  leadTtlDays: 7,
  introMeetingHours: 1,
  /** Ödeme isteği (₺/ay): normal dağılım */
  willingnessMean: 6_500,
  willingnessSd: 1_800,
  /** Kayıt olasılığı logit = bias + (istek − fiyat)/1000 · priceW + (güven − 50)/50 · trustW + kaynak bonusu */
  // priceW 0.9 → 1.3: 3 sezon botunda 11.000 ₺ fiyat en kârlı stratejiydi (fiyat duyarsız pazar)
  conversion: { bias: -0.3, priceW: 1.3, trustW: 0.8 },
  sourceBonus: { network: 0.6, organic: 0, paidSocial: -0.3, referral: 1.2 } as Record<LeadSource, number>,
} as const;

/** Aylık talep çarpanı (GDD E7): kayıt sezonları. İndeks 0 = Ocak. */
export const SEASONALITY = [
  1.1, // Ocak: yarıyıl, "ilk dönem kötü geçti" aileleri
  1.1, // Şubat
  0.6, // Mart: son düzlük, yeni kayıt az
  0.55, // Nisan
  0.5, // Mayıs
  1.5, // Haziran: sınav sonuçları, gelecek sezon kararları
  1.4, // Temmuz
  1.4, // Ağustos: ana kayıt dalgası
  1.3, // Eylül
  0.9, // Ekim
  0.8, // Kasım
  0.8, // Aralık
] as const;

export const REPUTATION = {
  /** Bilinirlik haftalık sönümü ve kaynak katkıları */
  awarenessDecay: 0.05,
  awarenessPerLead: 1.5,
  /** Güven: aktif öğrencilerin veli memnuniyeti ortalamasına doğru haftalık yakınsama; ayrılan her öğrenci ceza */
  trustConvergence: 0.15,
  trustPerLeave: -8,
  startTrust: 45,
} as const;
