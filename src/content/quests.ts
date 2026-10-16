// Kısa vadeli hedefler (oyuncuya "sıradaki adım" hissi verir). Sırayla açılır; aynı anda en fazla 3 görünür.
// Koşullar yalnız durumu okur; ödül sim/quests.ts'de komut gibi uygulanır.

import type { GameState } from "../sim/state";

export interface QuestDef {
  id: string;
  /** ödül: kişisel hesaba para ve/veya kurum güveni */
  money?: number;
  trust?: number;
  done: (s: GameState) => boolean;
}

const active = (s: GameState) => s.students.filter((x) => !x.left);
const everEnrolled = (s: GameState) => s.students.length;

export const QUESTS: QuestDef[] = [
  { id: "firstStudent", money: 2_000, done: (s) => everEnrolled(s) >= 1 },
  // müdahale değiştiricileri en az 7 gün sürer; her saat denetlendiği için kaçmaz
  { id: "firstDecision", trust: 2, done: (s) => s.students.some((x) => x.mods.some((m) => m.source.startsWith("iv."))) },
  { id: "meetParent", trust: 2, done: (s) => s.students.some((x) => x.parent.known) },
  { id: "firstMock", money: 1_000, done: (s) => s.students.some((x) => x.mocks.length > 0) },
  { id: "threeStudents", money: 3_000, done: (s) => active(s).length >= 3 },
  { id: "savings", trust: 3, done: (s) => s.economy.business >= 15_000 },
  { id: "fiveStudents", money: 5_000, done: (s) => active(s).length >= 5 },
  { id: "firstCert", trust: 3, done: (s) => s.coach.certs.length >= 1 },
  { id: "stage2", money: 5_000, done: (s) => s.stage >= 2 },
  { id: "office", trust: 4, done: (s) => s.office !== null },
  { id: "firstHire", money: 5_000, done: (s) => s.staff.members.length >= 1 },
  { id: "firstSeason", trust: 5, done: (s) => s.season.reports.length >= 1 },
  { id: "firstSpecialist", trust: 3, done: (s) => s.staff.members.some((m) => m.role !== "coach") },
  { id: "stage4", money: 10_000, done: (s) => s.branches.length >= 1 },
];

export const QUEST_BY_ID: Record<string, QuestDef> = Object.fromEntries(QUESTS.map((q) => [q.id, q]));
export const VISIBLE_QUESTS = 3;
