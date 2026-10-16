// Denge katsayıları. Kod bu değerleri okur; ayar burada yapılır, denge testleri (tests/balance.test.ts) kontrol eder.

export const BALANCE = {
  compliance: {
    // P(yap) = σ(w·girdiler + c) — GDD D3
    motivation: 0.045,
    discipline: 0.04,
    trust: 0.02,
    goalOwnership: 0.02,
    fatigue: 0.035,
    flowMismatch: 0.035, // |zorluk − ustalık|
    distraction: 0.025,
    overload: 2.2, // (günlük yük / sürdürülebilir yük − 1)+ başına
    bias: -2.6,
  },
  mastery: {
    gainPerHour: 3.0, // ustalık puanı / saat (öğrenme hızı 1, kalite 1, boş konu)
    diminishingExponent: 0.7, // (1 − U/100)^e
    prereqThreshold: 55, // ön koşul bu ustalığın altındaysa kazanç orantılı düşer
    prereqFloor: 0.25, // ön koşul 0 olsa bile kazancın alt sınırı
    taskQuality: { study: 1.0, practice: 0.85, review: 0.6 },
    reviewSlowsForgetting: 0.5,
    /** Kazanç çarpanı (1 − yorgunluk / fatigueDivisor) */
    fatigueDivisor: 120,
  },
  forgetting: {
    // haftalık: U ← U − rate · U · (gün_çalışılmadan / 7), en fazla maxPerWeek
    // ilk ayarda %6/hafta ve 4 gün tolerans dengeli programda bile ortalamayı düşürüyordu (denge testi yakaladı)
    ratePerWeek: 0.02,
    graceDays: 7,
    maxPerWeek: 3,
  },
  fatigue: {
    // hedef: ~3 saat/gün dengede kalır (5·3 = 15 ≈ toparlanma), 6 saat birikir ve tükenmeye götürür
    perHour: 5,
    /** Gece toparlanması = nightlyRecovery · (0,5 + uyku/200) */
    nightlyRecovery: 22,
    weekendBonusRecovery: 10,
  },
  load: {
    /** Okul günü ders sonrası boş saat; hafta sonu daha fazla. */
    freeHoursWeekday: 4,
    freeHoursWeekend: 8,
    /** Sürdürülebilir günlük çalışma = taban + disiplin/100 * ek */
    sustainableBase: 2,
    sustainableFromDiscipline: 2.5,
    /** Okul olmayan günlerde sürdürülebilir yüke eklenir. */
    weekendSustainableBonus: 1.5,
  },
  feedback: {
    // günlük sonuca göre psikolojik durum değişimi
    doneSelfEfficacy: 0.6,
    missedSelfEfficacy: -0.8,
    tooHardMotivation: -1.2, // zorluk ustalığı 30+ aşıyorsa
    progressMotivation: 0.5, // günde bir kez, en az bir görev yapıldıysa
    weeklyMotivationDriftToBase: 0.15,
  },
  burnout: {
    // gün sonunda yorgunluk eşiği aşıyorsa (toparlanmadan önce)
    fatigueThreshold: 70,
    motivation: -2.5,
    anxietyAtNeuroticism50: 1.5, // nevrotiklik/50 ile ölçeklenir
    sleep: -1,
  },
  coach: {
    weeklyHours: 50,
  },
  exam: {
    // deneme sınavı (GDD D8): her soru ayrı zar → tek deneme gürültülü, eğilim güvenilir
    questionsPerSubject: 20,
    /** P(doğru) = σ((U − Z) / scale + offset) */
    scale: 14,
    offset: 0.4,
    anxietyPenalty: 0.25, // kaygı 100'de doğruların %25'i kaybolur
    fatiguePenalty: 0.2,
    wrongPenalty: 0.25, // net = doğru − yanlış · 0,25
    everyWeeks: 2,
    weekday: 5, // cumartesi
    hour: 10,
    /** sonuç bir önceki denemeye göre: öz yeterlik değişimi = fark · bu katsayı (sınırlı) */
    selfEfficacyPerNet: 0.5,
    anxietyBeforeExam: 2,
  },
  parent: {
    // GDD D7: veli gerçek değil ALGILANAN gelişimi görür
    initialSatisfaction: 58,
    /** algılanan gelişim − beklenti farkının haftalık memnuniyete etkisi */
    gapWeight: 0.08,
    masteryDeltaWeight: 5, // 4 haftalık ortalama ustalık artışı başına
    complianceCenter: 0.6,
    complianceWeight: 50,
    mockUp: 8,
    mockDown: -8,
    /** kaygılı/talepkâr veli bu kadar hafta aranmazsa her hafta düşer */
    contactWeeks: 3,
    noContactPenalty: -3,
    meetingHours: 1,
    meetingSatisfaction: 8,
    /** son görüşmeden bu kadar hafta geçmeden yapılan görüşme yarım etki eder */
    meetingFreshWeeks: 4,
    meetingStaleFactor: 0.5,
    meetingExpectationAdjust: -4,
    expectationFloor: 40,
    /** memnuniyetsiz kaygılı/talepkâr veli çocuğa baskı yapar */
    pressureBelow: 50,
    pressureAnxiety: 2,
    warnBelow: 25,
    leaveAt: 10,
  },
  sessions: {
    // müdahale kartları content/interventions.ts'te; burada yalnız ders desteğinin ustalık etkisi
    subject: { masteryBoost: 6 },
  },
} as const;
