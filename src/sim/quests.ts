// Hedef görevleri: koşulu sağlanan görev tamamlanır, ödülü verilir. Her saat denetlenir (ucuz).

import { QUESTS, VISIBLE_QUESTS } from "../content/quests";
import { post } from "./economy";
import { repTrust } from "./effects";
import { emit, type GameState } from "./state";

/** Sıradaki (tamamlanmamış) görevler, en fazla VISIBLE_QUESTS. */
export function openQuests(state: GameState) {
  return QUESTS.filter((q) => !state.quests.includes(q.id)).slice(0, VISIBLE_QUESTS);
}

export function checkQuests(state: GameState): void {
  // yalnız görünen görevler tamamlanabilir: hedefler sırayla açılır
  for (const q of openQuests(state)) {
    if (!q.done(state)) continue;
    state.quests.push(q.id);
    if (q.money) post(state, "personal", q.money, "questReward");
    if (q.trust) repTrust(state, q.trust);
    emit(state, "questDone", { quest: q.id, money: q.money ?? 0, trust: q.trust ?? 0 });
  }
}
