// Kurgusal ÜYS (Üniversiteye Yerleştirme Sınavı) müfredatı — MVP: 4 ders, ders başına 4–5 konu.
// Her konu bir zorluk (0–100) ve ön koşullar taşır; ön koşulu zayıf konuya çalışmak verimsizdir.

export interface Topic {
  id: string;
  subject: SubjectId;
  /** i18n anahtarı (arayüz metni) */
  nameKey: string;
  difficulty: number;
  prereqs: string[];
}

export type SubjectId = "mat" | "fiz" | "kim" | "tur";

export const SUBJECTS: SubjectId[] = ["mat", "fiz", "kim", "tur"];

const T = (id: string, subject: SubjectId, difficulty: number, prereqs: string[] = []): Topic => ({
  id,
  subject,
  nameKey: `topic.${id}`,
  difficulty,
  prereqs,
});

export const TOPICS: Topic[] = [
  T("mat.sayilar", "mat", 25),
  T("mat.denklemler", "mat", 40, ["mat.sayilar"]),
  T("mat.fonksiyonlar", "mat", 55, ["mat.denklemler"]),
  T("mat.turev", "mat", 72, ["mat.fonksiyonlar"]),
  T("mat.integral", "mat", 80, ["mat.turev"]),
  T("fiz.hareket", "fiz", 40, ["mat.denklemler"]),
  T("fiz.kuvvet", "fiz", 52, ["fiz.hareket"]),
  T("fiz.enerji", "fiz", 60, ["fiz.kuvvet"]),
  T("fiz.elektrik", "fiz", 70, ["fiz.enerji"]),
  T("kim.atom", "kim", 35),
  T("kim.baglar", "kim", 48, ["kim.atom"]),
  T("kim.tepkimeler", "kim", 60, ["kim.baglar"]),
  T("kim.organik", "kim", 72, ["kim.tepkimeler"]),
  T("tur.paragraf", "tur", 35),
  T("tur.dilbilgisi", "tur", 45),
  T("tur.anlam", "tur", 50, ["tur.paragraf"]),
  T("tur.yazim", "tur", 30),
];

export const TOPIC_BY_ID: Record<string, Topic> = Object.fromEntries(TOPICS.map((t) => [t.id, t]));

// ÜYS tarihi sezona bağlıdır: content/season.ts (UYS) ve sim/season.ts (examIso).
