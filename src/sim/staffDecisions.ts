// KUVAT LABS — Rota
// Yardımcı koçun haftalık kararları: öğrencisi ona atanmışsa müdahaleyi ve veli görüşmesini o yapar (kendi saatiyle).
// Doğru çareyi seçme olasılığı koçun becerisine bağlıdır (content/staff.ts DELEGATION); rastgelelik yalnız verilen rng'den.

import { BALANCE } from "../content/balance";
import { INTERVENTIONS, type InterventionDef } from "../content/interventions";
import { DELEGATION, STAFF } from "../content/staff";
import type { Rng } from "../core/rng";
import { calendarAt } from "./calendar";
import { causesLastWeek, dominantCauseLastWeek, weeklySignals } from "./insight";
import { applyIntervention } from "./intervention";
import { holdParentMeeting, parentCallSignals } from "./parent";
import type { StaffMember } from "./staff";
import { emit, type GameState } from "./state";
import { stat, type MissCause, type Student } from "./student";

/** Öğrencisi bir yardımcı koça atanmış mı (haftalık müdahale ve veli işini o yürütür, oyuncuya kart gelmez)? */
export function isStaffHandled(state: GameState, s: Student): boolean {
  return !!s.coachId && state.staff.members.some((m) => m.id === s.coachId && m.role === "coach");
}

/** Koçun doğru çareyi seçme olasılığı: beceriyle doğrusal artar. */
export function staffHitChance(skill: number): number {
  const d = DELEGATION;
  const t = Math.min(1, Math.max(0, (skill - d.skillLow) / (d.skillHigh - d.skillLow)));
  return d.hitLow + (d.hitHigh - d.hitLow) * t;
}

const ALL = Object.values(INTERVENTIONS);

function pickIntervention(state: GameState, s: Student, cause: MissCause, hit: boolean, rng: Rng): InterventionDef | null {
  const trust = stat(s, "trust", state.hour).value;
  const usable = ALL.filter((d) => d.minTrust === undefined || trust >= d.minTrust);
  let pool: InterventionDef[];
  if (hit) pool = usable.filter((d) => d.targets.includes(cause));
  else {
    // makul yanlış: haftada görülen diğer nedenlerden birine yönelik; yoksa herhangi başka bir çare
    const others = causesLastWeek(s).filter((c) => c !== cause);
    pool = usable.filter((d) => !d.targets.includes(cause) && d.targets.some((t) => others.includes(t)));
    if (!pool.length) pool = usable.filter((d) => !d.targets.includes(cause));
  }
  return pool.length ? pool[rng.int(0, pool.length - 1)] : null;
}

/** Hafta başı (planlamadan sonra): atanmış öğrenciler için koçların müdahale ve veli görüşmesi. */
export function staffWeeklyDecisions(state: GameState, rng: Rng): void {
  const week = calendarAt(state.hour).weekIndex + 1; // kapanan haftanın ardından başlayan hafta
  for (const s of state.students) {
    if (s.left || !isStaffHandled(state, s)) continue;
    const m = state.staff.members.find((x) => x.id === s.coachId) as StaffMember;
    const free = () => STAFF.weeklyHours - m.usedThisWeek;

    if (weeklySignals(s).length) {
      const cause = dominantCauseLastWeek(s);
      if (cause !== null) {
        const hit = rng.next() < staffHitChance(m.skill);
        const def = pickIntervention(state, s, cause, hit, rng);
        if (def && def.hours <= free()) {
          m.usedThisWeek += def.hours;
          const r = applyIntervention(state, s, def, 1);
          emit(state, "staffIntervention", { id: s.id, staffId: m.id, staff: m.name, intervention: def.id, matched: r.matched, cause: r.cause });
        }
      }
    }

    const since = s.parent.lastMeetingWeek === null ? Infinity : week - s.parent.lastMeetingWeek;
    if (parentCallSignals(s, week).length && since >= BALANCE.parent.meetingFreshWeeks && BALANCE.parent.meetingHours <= free()) {
      m.usedThisWeek += BALANCE.parent.meetingHours;
      holdParentMeeting(s, week, 1);
      emit(state, "staffParentMeeting", { id: s.id, staffId: m.id, staff: m.name, satisfaction: s.parent.satisfaction });
    }
  }
}
