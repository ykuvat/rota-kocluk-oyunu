// Hazır program şablonları (GDD D4). Oyuncu ileride kendi şablonlarını kaydedecek; bunlar başlangıç örnekleri
// ve denge testlerinin "bot" stratejileridir.

import type { ProgramBlock, Student } from "../sim/student";
import { TOPIC_BY_ID, TOPICS } from "./curriculum";

/** Ön koşulu yeterli, ustalığı en düşük konular (çalışmaya hazır olanlar önce). */
export function weakestReadyTopics(s: Student, count: number): string[] {
  const ready = TOPICS.filter((t) => t.prereqs.every((p) => (s.mastery[p] ?? 0) >= 45));
  return ready
    .map((t) => t.id)
    .sort((a, b) => (s.mastery[a] ?? 0) - (s.mastery[b] ?? 0))
    .slice(0, count);
}

/** Gerçekçi program: hafta içi günde ~2,5 saat, hafta sonu ~4 saat, zayıf ve hazır konulara. */
export function balancedProgram(s: Student): ProgramBlock[] {
  const topics = weakestReadyTopics(s, 6);
  const blocks: ProgramBlock[] = [];
  for (let d = 0; d < 7; d++) {
    const weekend = d >= 5;
    const a = topics[(d * 2) % topics.length];
    const b = topics[(d * 2 + 1) % topics.length];
    blocks.push({ weekday: d, topicId: a, hours: weekend ? 2 : 1.5, kind: "study" });
    blocks.push({ weekday: d, topicId: b, hours: weekend ? 2 : 1, kind: d % 3 === 2 ? "review" : "practice" });
  }
  return blocks;
}

/** Aşırı yüklü program: her gün 6+ saat, zorluğa bakmadan en zor konular dahil. */
export function overloadedProgram(_s: Student): ProgramBlock[] {
  const hardest = [...TOPICS].sort((a, b) => b.difficulty - a.difficulty).slice(0, 5).map((t) => t.id);
  const blocks: ProgramBlock[] = [];
  for (let d = 0; d < 7; d++) {
    for (let k = 0; k < 3; k++) blocks.push({ weekday: d, topicId: hardest[(d + k) % hardest.length], hours: 2, kind: "study" });
  }
  return blocks;
}

export const topicDifficulty = (id: string) => TOPIC_BY_ID[id].difficulty;
