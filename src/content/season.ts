// Yıl sonu ÜYS (Üniversiteye Yerleştirme Sınavı) ve sezon döngüsü (GDD D8, H). Değerler ÖRNEKTİR.

export const UYS = {
  /** her sezonun sınavı: ilk sezon 2027, sonra her yıl aynı gün */
  firstYear: 2027,
  month: 6,
  day: 19,
  hour: 10,
  /** sınava giren aday sayısı (sıralama hesabı) */
  candidates: 2_400_000,
  /** sıralama: üstte kalan aday oranı = 1 − sigmoid((net − orta) / ölçek) */
  rankMidNet: 32,
  rankScale: 9,
  /** sınav günü gerginliği (kaygıya geçici ek) */
  examDayAnxiety: 8,
  /** velinin hedef neti = taban + beklenti × çarpan */
  // 18 → 24: 3 sezon botunda iyi oyuncu 2. sezondan itibaren %100 tutturuyordu
  targetBase: 22,
  targetPerExpectation: 0.32,
  /** sonuçların kuruma etkisi */
  trustPerSuccess: 2,
  trustPerMiss: -2,
  trustCap: 4,
  awarenessPerSuccess: 3,
  /** hedefini tutturan ailenin yaz kaydı dönemi tavsiye olasılığı */
  referralChance: 0.5,
} as const;

/** Sınıf düzeyi: 11. sınıf öğrenci iki sezon kalır (ilk sezon sonunda 12'ye geçer). */
export const GRADES = {
  /** adayların 11. sınıf olma olasılığı; aylara göre (Haziran–Eylül 11'ler kayıt olur, sınav yaklaşınca azalır) */
  eleventhShareByMonth: [0.15, 0.15, 0.1, 0.1, 0.1, 0.4, 0.45, 0.45, 0.35, 0.3, 0.25, 0.2],
  /** 11. sınıf başlangıç ustalığı çarpanı (müfredatın bir kısmını henüz görmedi) */
  eleventhMasteryFactor: 0.75,
  /** 12'ye geçen öğrencinin velisi: kurumda kalma memnuniyeti */
  promotionSatisfaction: 4,
} as const;

/** ÜYS sonrası tercih danışmanlığı (sonuçlar açıklanınca iki haftalık pencere). */
export const PREFERENCE = {
  /** sınavdan kaç gün sonra açılır, kaç gün sürer */
  opensAfterDays: 24,
  lengthDays: 14,
  /** görüşme başına koç saati */
  hours: 2,
  suggestedPrice: 3_000,
  /** dışarıdan gelen talepler: bilinirlik başına beklenen sayı */
  externalPerAwareness: 0.08,
  /** ödeme isteği (₺): normal dağılım */
  willingnessMean: 3_200,
  willingnessSd: 900,
  /** kabul logit = bias + (istek − fiyat)/1000 · priceW + (memnuniyet − 50)/50 · satW + kaynak */
  bias: 0.4,
  priceW: 1.1,
  satW: 1.0,
  graduateBonus: 0.8,
  /** iyi giden danışmanlık: tavsiye adayı ve güven */
  referralChance: 0.25,
  trustPerSession: 0.4,
} as const;

/** Rakip kurumlar: sezon sonunda başarı oranı ilan eder ve bir hamle yapar. */
export const RIVALS = {
  successMin: 0.45,
  successMax: 0.72,
  /** tüm rakiplerden başarılıysak kurum güveni; en sondaysak ceza */
  beatAllTrust: 4,
  lastPlaceTrust: -3,
  moves: {
    /** fiyat savaşı: kayıt olasılığına logit cezası */
    priceWar: { weeks: 10, conversion: -0.4, weight: 3 },
    /** reklam bombardımanı: talep çarpanı */
    adBlitz: { weeks: 8, demand: 0.75, weight: 3 },
    /** yeni şube: bilinirlik kaybı */
    newBranch: { awareness: -8, weight: 2 },
    /** yardımcı koçu ayartma (ekip varsa) */
    poachStaff: { weight: 3 },
  },
} as const;
