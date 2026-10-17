// Haftalık yaşam olayları (content/lifeEvents.ts): hafta kapanışında öğrenci başına zar atılır.

import { LIFE, LIFE_EVENTS } from "../content/lifeEvents";
import type { Rng } from "../core/rng";
import { HOURS_PER_DAY } from "./calendar";
import { emit, type GameState } from "./state";

const PREFIX = "life.";

/** Öğrencinin şu an süren yaşam olayı (yoksa null). */
export function activeLifeEvent(s: { mods: { source: string; until?: number }[] }, now: number): string | null {
  const m = s.mods.find((x) => x.source.startsWith(PREFIX) && (x.until ?? Infinity) > now);
  return m ? m.source.slice(PREFIX.length) : null;
}

export function lifeEventsWeekly(state: GameState, rng: Rng): void {
  const total = LIFE_EVENTS.reduce((a, e) => a + e.weight, 0);
  for (const s of state.students) {
    if (s.left || activeLifeEvent(s, state.hour)) continue;
    if (rng.next() >= LIFE.chancePerWeek) continue;
    let r = rng.next() * total;
    const def = LIFE_EVENTS.find((e) => (r -= e.weight) < 0) ?? LIFE_EVENTS[0];
    const until = state.hour + rng.int(def.days[0], def.days[1]) * HOURS_PER_DAY;
    for (const [stat, add] of Object.entries(def.effects) as [string, number][]) {
      s.mods.push({ stat, source: `${PREFIX}${def.id}`, add, until });
    }
    emit(state, "lifeEvent", { id: s.id, event: def.id });
  }
}
