// Deneme ve sınav modeli (GDD D8). Puan = konu ustalığından beklenen net + soru bazlı gürültü,
// kaygı ve yorgunluk doğru sayısını düşürür. Gerçek sınav ileride aynı modeli kullanacak (+ sınav günü koşulları).

import { BALANCE } from "../content/balance";
import { SUBJECTS, TOPICS, type SubjectId } from "../content/curriculum";
import type { Rng } from "../core/rng";
import { sigmoid, stat, type Student } from "./student";

export interface MockResult {
  week: number;
  hour: number;
  correct: Record<SubjectId, number>;
  wrong: Record<SubjectId, number>;
  nets: Record<SubjectId, number>;
  total: number;
}

/** Bir konudan gelen sorunun doğru cevaplanma olasılığı (performans çarpanı hariç). */
export function questionProbability(mastery: number, difficulty: number): number {
  const e = BALANCE.exam;
  return sigmoid((mastery - difficulty) / e.scale + e.offset);
}

/** Kaygı ve yorgunluğun doğru sayısına çarpanı (0–1). */
export function performanceFactor(s: Student, now: number): number {
  const e = BALANCE.exam;
  const anxiety = stat(s, "anxiety", now).value / 100;
  const fatigue = stat(s, "fatigue", now).value / 100;
  return Math.max(0.3, 1 - anxiety * e.anxietyPenalty - fatigue * e.fatiguePenalty);
}

/** Beklenen toplam net (gürültüsüz) — analiz ve testler için. */
export function expectedNet(s: Student, now: number): number {
  const e = BALANCE.exam;
  const perf = performanceFactor(s, now);
  let total = 0;
  for (const subj of SUBJECTS) {
    const topics = TOPICS.filter((t) => t.subject === subj);
    const per = e.questionsPerSubject / topics.length;
    for (const t of topics) {
      const p = questionProbability(s.mastery[t.id] ?? 0, t.difficulty) * perf;
      total += per * (p - (1 - p) * e.wrongPenalty);
    }
  }
  return total;
}

export function takeMockExam(s: Student, week: number, now: number, rng: Rng): MockResult {
  const e = BALANCE.exam;
  const perf = performanceFactor(s, now);
  const correct = {} as Record<SubjectId, number>;
  const wrong = {} as Record<SubjectId, number>;
  const nets = {} as Record<SubjectId, number>;
  let total = 0;
  for (const subj of SUBJECTS) {
    const topics = TOPICS.filter((t) => t.subject === subj);
    let c = 0;
    for (let q = 0; q < e.questionsPerSubject; q++) {
      const t = topics[q % topics.length]; // sorular konulara eşit dağılır
      if (rng.next() < questionProbability(s.mastery[t.id] ?? 0, t.difficulty) * perf) c++;
    }
    correct[subj] = c;
    wrong[subj] = e.questionsPerSubject - c;
    nets[subj] = Math.round((c - wrong[subj] * e.wrongPenalty) * 100) / 100;
    total += nets[subj];
  }
  return { week, hour: now, correct, wrong, nets, total: Math.round(total * 100) / 100 };
}
