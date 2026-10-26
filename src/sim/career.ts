// KUVAT LABS — Rota
// Kariyer hedefi: durumdan türetilir, state'e yazılmaz. Saf ve deterministik.

import { CAREER, CAREER_TIERS, type CareerCardId, type CareerTierId } from "../content/career";
import type { GameState } from "./state";

/** Tek kart. Başarı için value/target oran (0–1), Güven için puan, Büyüme için şube sayısı. */
export interface CareerCard {
  id: CareerCardId;
  value: number;
  target: number;
  /** value >= target (tam eşik geçer) */
  done: boolean;
}

export interface CareerResult {
  /** her zaman sırayla success, trust, growth */
  cards: CareerCard[];
  /** tutturulan kart sayısı (0–3) */
  done: number;
  tier: CareerTierId;
}

/**
 * Kartların anlık durumu (HUD ve final için).
 * - success: `ourRate` verilirse o, yoksa son sezon raporunun ourRate'i (yoksa/null ise 0).
 *   Final hesabında runFinalExam, raporu henüz yazılmamış 3. sezonun oranını `ourRate` olarak geçirir.
 * - trust: anlık `reputation.trust`. growth: anlık `branches.length`.
 */
export function careerProgress(state: GameState, ourRate?: number | null): CareerCard[] {
  const rate = (ourRate !== undefined ? ourRate : state.season.reports.at(-1)?.ourRate) ?? 0;
  const card = (id: CareerCardId, value: number, target: number): CareerCard => ({ id, value, target, done: value >= target });
  return [
    card("success", rate, CAREER.successRate),
    card("trust", state.reputation.trust, CAREER.trust),
    card("growth", state.branches.length, CAREER.branches),
  ];
}

/** Kartlardan kademe: 0 Koç, 1 Bronz, 2 Gümüş, 3 Altın. */
export function careerResult(state: GameState, ourRate?: number | null): CareerResult {
  const cards = careerProgress(state, ourRate);
  const done = cards.filter((c) => c.done).length;
  return { cards, done, tier: CAREER_TIERS[done] };
}
