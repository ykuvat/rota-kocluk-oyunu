// KUVAT LABS — Rota
// Müdahale uygulaması: oyuncunun `intervene` komutu ve yardımcı koçun haftalık kararı aynı kuralları kullanır.
// Saat harcama ve ön koşul kontrolü çağırana aittir (oyuncu: Buse'nin saati, yardımcı koç: kendi haftalık saati).

import { BALANCE } from "../content/balance";
import { TOPIC_BY_ID, TOPICS } from "../content/curriculum";
import { INSIGHT, type InterventionDef } from "../content/interventions";
import { calendarAt, HOURS_PER_DAY } from "./calendar";
import { dominantCauseLastWeek } from "./insight";
import type { GameState } from "./state";
import { sustainableHours, type MissCause, type ProgramBlock, type StateStat, type Student } from "./student";

const round1 = (v: number) => Math.round(v * 10) / 10;
const clamp = (v: number) => Math.min(100, Math.max(0, v));

/** Programı günlük sürdürülebilir yükün altına indirir: her gün en uzun bloklardan kırpar. */
export function simplifiedProgram(s: Student, now: number): ProgramBlock[] {
  const out: ProgramBlock[] = [];
  for (let d = 0; d < 7; d++) {
    let left = Math.max(1, Math.floor(sustainableHours(s, now, d) * 2) / 2);
    for (const b of s.program.filter((x) => x.weekday === d)) {
      if (left <= 0) break;
      const hours = Math.min(b.hours, left);
      out.push({ ...b, hours });
      left -= hours;
    }
  }
  return out;
}

/** Ön koşulu en zayıf olan konu (ders desteği buraya yapılır). */
function weakestFoundation(s: Student): string {
  const studied = new Set(s.program.map((b) => b.topicId));
  let best = TOPICS[0].id;
  let bestGap = -Infinity;
  for (const t of TOPICS) {
    if (!studied.has(t.id)) continue;
    for (const p of [t.id, ...t.prereqs]) {
      const gap = TOPIC_BY_ID[p].difficulty - (s.mastery[p] ?? 0);
      if (gap > bestGap) {
        bestGap = gap;
        best = p;
      }
    }
  }
  return best;
}

/** Müdahaleyi öğrenciye uygular (etki, tekrar/kalabalık azalması, baskı, güven değişimi). `certFactor`: sertifika çarpanı. */
export function applyIntervention(state: GameState, s: Student, def: InterventionDef, certFactor: number): { matched: boolean; cause: MissCause | null } {
  const cause = dominantCauseLastWeek(s);
  // ilk haftada henüz veri yok: nötr kabul edilir (ceza yok, tam etki yok)
  const matched = cause !== null && def.targets.includes(cause);
  const factorFit = cause === null ? 0.75 : matched ? 1 : INSIGHT.mismatchFactor;
  const source = `iv.${def.id}`;
  const repeats = s.mods.filter((m) => m.source === source && (m.until ?? 0) > state.hour).length;
  // aynı hafta üst üste müdahale: etki azalır, belli sayıdan sonra baskıya dönüşür
  const k = (s.ivThisWeek ?? 0) + 1;
  s.ivThisWeek = k;
  const crowd = 1 / (1 + INSIGHT.crowding * (k - 1));
  if (k > INSIGHT.pressureAfter) {
    s.base.anxiety = round1(clamp(s.base.anxiety + INSIGHT.pressureAnxiety));
    s.base.trust = round1(clamp(s.base.trust + INSIGHT.pressureTrust));
  }
  const factor = ((factorFit * crowd) / (1 + repeats)) * certFactor;
  const until = state.hour + def.durationDays * HOURS_PER_DAY;

  for (const [key, amount] of Object.entries(def.effects) as [StateStat, number][]) {
    s.mods.push({ stat: key, source, add: round1(amount * factor), until });
    // doğru teşhis birikir: etkinin bir kısmı kalıcı alışkanlık değişimine dönüşür
    if (matched) s.base[key] = round1(clamp(s.base[key] + amount * factor * INSIGHT.matchPermanentShare));
  }
  for (const [key, amount] of Object.entries(def.baseEffects ?? {}) as [StateStat, number][]) {
    s.base[key] = round1(clamp(s.base[key] + amount * factor));
  }
  if (def.id === "simplifyProgram") s.program = simplifiedProgram(s, state.hour);
  if (def.id === "subjectSupport") {
    const topic = weakestFoundation(s);
    const u = s.mastery[topic] ?? 0;
    s.mastery[topic] = round1(clamp(u + BALANCE.sessions.subject.masteryBoost * factor * (1 - u / 100) * 2));
    s.lastStudiedDay[topic] = calendarAt(state.hour).dayIndex;
  }
  if (cause !== null) {
    s.mods.push({
      stat: "trust",
      source: matched ? "iv.matched" : "iv.mismatched",
      add: matched ? INSIGHT.matchTrust : INSIGHT.mismatchTrust,
      until: state.hour + 14 * HOURS_PER_DAY,
    });
  }
  return { matched, cause };
}
