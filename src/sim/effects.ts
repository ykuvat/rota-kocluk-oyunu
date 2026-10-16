// Olay sonuçlarının ortak etkileri. Değerler sınırlanır (0–100) ve kaynak etiketiyle kaydedilir.

import { REPUTATION } from "../content/business";
import { HOURS_PER_DAY } from "./calendar";
import { emit, type GameState } from "./state";
import type { StateStat, Student } from "./student";

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number) => Math.min(100, Math.max(0, v));

export function parentSat(s: Student, delta: number): void {
  s.parent.satisfaction = round1(clamp(s.parent.satisfaction + delta));
}

/** Geçici değiştirici (gün sayısı kadar sürer). */
export function tempMod(state: GameState, s: Student, stat: StateStat, add: number, days: number, source: string): void {
  s.mods.push({ stat, source, add, until: state.hour + days * HOURS_PER_DAY });
}

export function baseShift(s: Student, stat: StateStat, delta: number): void {
  s.base[stat] = round1(clamp(s.base[stat] + delta));
}

export function repTrust(state: GameState, delta: number): void {
  state.reputation.trust = round1(clamp(state.reputation.trust + delta));
}

export function repAwareness(state: GameState, delta: number): void {
  state.reputation.awareness = round1(clamp(state.reputation.awareness + delta));
}

/** Öğrenci kurumdan ayrılır (veli kararı, rakibe geçiş vb.). */
export function studentLeaves(state: GameState, s: Student, reason: string): void {
  if (s.left) return;
  s.left = true;
  repTrust(state, REPUTATION.trustPerLeave);
  emit(state, "studentLeft", { id: s.id, name: s.name, reason });
}
