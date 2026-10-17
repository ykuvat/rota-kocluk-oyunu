// Odadaki hayat (görsel): öğrenciler her gün odada durmaz. Her öğrencinin haftada bir koçluk günü vardır
// (kimliğinden türetilir, sim durumu değişmez). Hafta oynarken o gün odaya gelir; gece Buse masasında çalışır.

export const VISITS = {
  /** koçluk günleri: 0 = Pazartesi … 5 = Cumartesi (Pazar boş) */
  days: 6,
  /** gündüz saatleri: bu aralıkta Buse odada dolaşır / seans yapar; dışında masasında çalışır */
  dayStart: 8,
  dayEnd: 22,
  /** eğitim (sertifika) sürerken Buse bu saatlerde masasında ders çalışır */
  studyStart: 9,
  studyEnd: 12,
} as const;
