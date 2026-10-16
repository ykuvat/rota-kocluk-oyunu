// Olay motoru (GDD G). Her sabah 08:00'de anlatıcı bir olay çıkarıp çıkarmayacağına karar verir:
// olaysız geçen her gün gerilimi artırır, üst üste kötü olaylar seyreltilir. Olaylar oyuncuya seçenek sunar;
// yanıtlanmazsa süre dolunca varsayılan sonuç işler. Bazı seçenekler haftalar sonra geri döner (gecikmeli sonuç).
// Olay tanımları içerikte (content/events.ts); durumda yalnız düz veri (tanım kimliği + değişkenler) tutulur.

import { EVENT_PACING, EVENTS, EVENT_BY_ID } from "../content/events";
import type { Rng } from "../core/rng";
import { createRng } from "../core/rng";
import { calendarAt, HOURS_PER_DAY } from "./calendar";
import { emit, findStudent, spendCoachHours, type GameState, type PendingEvent } from "./state";
import type { Student } from "./student";

export type EventVars = Record<string, number | string>;
export type EventTone = "good" | "bad" | "dilemma";

export interface EventCtx {
  state: GameState;
  /** olay bir öğrenciye bağlıysa o öğrenci */
  s: Student | undefined;
  rng: Rng;
  vars: EventVars;
  /** gecikmeli sonuç planla (content'teki `delayed[key]` çalışır) */
  later(days: number, key: string): void;
  /** oyuncuya gösterilecek sonucu seç: `ev.<id>.out.<key>` */
  outcome(key: string): void;
}

export interface EventOption {
  id: string;
  /** koç saati maliyeti (bu haftadan) */
  hours?: number;
  /** yalnız arayüz ipucu: yaklaşık para maliyeti (₺); asıl ödeme apply içinde */
  cost?: (ctx: Pick<EventCtx, "state" | "s" | "vars">) => number;
  apply(ctx: EventCtx): void;
}

export interface EventDef {
  id: string;
  tone: EventTone;
  weight: number;
  cooldownDays: number;
  /** yanıt için gün */
  deadlineDays: number;
  /** en erken hafta (sezon başından) */
  minWeek?: number;
  /** varsa olay bu koşulu sağlayan bir öğrenciye bağlanır */
  student?: (s: Student, state: GameState) => boolean;
  when?: (state: GameState) => boolean;
  vars?: (ctx: EventCtx) => EventVars;
  options: EventOption[];
  onExpire: (ctx: EventCtx) => void;
  delayed?: Record<string, (ctx: EventCtx) => void>;
}

function makeCtx(state: GameState, def: EventDef, s: Student | undefined, rng: Rng, vars: EventVars) {
  let out: string | null = null;
  const ctx: EventCtx = {
    state,
    s,
    rng,
    vars,
    later(days, key) {
      state.events.delayed.push({ at: state.hour + days * HOURS_PER_DAY, def: def.id, key, studentId: s?.id, vars: { ...vars } });
    },
    outcome(key) {
      out = key;
    },
  };
  return { ctx, outcome: () => out };
}

function eligibleStudents(def: EventDef, state: GameState): Student[] {
  return state.students.filter((s) => !s.left && def.student!(s, state));
}

/** Şu an tetiklenebilecek olaylar ve ağırlıkları (anlatıcı ayarı dahil). */
export function eligibleEvents(state: GameState): { def: EventDef; weight: number }[] {
  const ev = state.events;
  const week = calendarAt(state.hour).weekIndex;
  const badStreak = ev.recentTones.slice(-2).filter((t) => t === "bad").length;
  const out: { def: EventDef; weight: number }[] = [];
  for (const def of EVENTS) {
    if (ev.pending.some((p) => p.def === def.id)) continue;
    const last = ev.lastFired[def.id];
    if (last !== undefined && state.hour - last < def.cooldownDays * HOURS_PER_DAY) continue;
    if (def.minWeek !== undefined && week < def.minWeek) continue;
    if (def.when && !def.when(state)) continue;
    if (def.student && eligibleStudents(def, state).length === 0) continue;
    // anlatıcı: üst üste iki kötü olaydan sonra yeni kötü olay seyrek gelir
    const weight = def.tone === "bad" ? def.weight * EVENT_PACING.badStreakFactor ** badStreak : def.weight;
    // ağırlığı 0 olan olaylar yalnız başka sistemlerce tetiklenir (ör. rakip hamlesi)
    if (weight > 0) out.push({ def, weight });
  }
  return out;
}

/** Olayı başlat (testler ve hata ayıklama için de kullanılır). */
export function fireEvent(state: GameState, def: EventDef, rng: Rng, student?: Student): PendingEvent | null {
  const ev = state.events;
  let s = student;
  if (def.student && !s) {
    const c = eligibleStudents(def, state);
    if (!c.length) return null;
    s = c[rng.int(0, c.length - 1)];
  }
  const base: EventVars = s ? { name: s.name } : {};
  const { ctx } = makeCtx(state, def, s, rng, base);
  const vars = { ...base, ...(def.vars?.(ctx) ?? {}) };
  const p: PendingEvent = {
    id: `e${ev.nextId++}`,
    def: def.id,
    studentId: s?.id,
    hour: state.hour,
    expiresHour: state.hour + def.deadlineDays * HOURS_PER_DAY,
    vars,
  };
  ev.pending.push(p);
  ev.lastFired[def.id] = state.hour;
  ev.recentTones = [...ev.recentTones, def.tone].slice(-4);
  ev.quietDays = 0;
  emit(state, "eventArrived", { id: p.id, def: def.id, studentId: p.studentId ?? null });
  return p;
}

/** Her sabah: süresi dolan olaylar, vadesi gelen gecikmeli sonuçlar, yeni olay zarı. */
export function eventsDaily(state: GameState, rng: Rng): void {
  const ev = state.events;

  for (const p of ev.pending.filter((x) => x.expiresHour <= state.hour)) {
    ev.pending = ev.pending.filter((x) => x !== p);
    const def = EVENT_BY_ID[p.def];
    const s = p.studentId ? findStudent(state, p.studentId) : undefined;
    if (!def || (p.studentId && (!s || s.left))) continue;
    const { ctx } = makeCtx(state, def, s, rng, p.vars);
    def.onExpire(ctx);
    emit(state, "eventExpired", { id: p.id, def: p.def, studentId: p.studentId ?? null, vars: p.vars });
  }

  const due = ev.delayed.filter((d) => d.at <= state.hour);
  ev.delayed = ev.delayed.filter((d) => d.at > state.hour);
  for (const d of due) {
    const def = EVENT_BY_ID[d.def];
    const s = d.studentId ? findStudent(state, d.studentId) : undefined;
    if (!def?.delayed?.[d.key] || (d.studentId && (!s || s.left))) continue;
    const { ctx, outcome } = makeCtx(state, def, s, rng, d.vars);
    def.delayed[d.key](ctx);
    const out = outcome();
    if (out) emit(state, "eventFollowUp", { def: d.def, outcome: out, vars: d.vars });
  }

  if (ev.pending.length >= EVENT_PACING.maxPending) return;
  const chance = Math.min(EVENT_PACING.maxChance, EVENT_PACING.base + EVENT_PACING.perQuietDay * ev.quietDays);
  if (rng.next() >= chance) {
    ev.quietDays++;
    return;
  }
  const pool = eligibleEvents(state);
  const total = pool.reduce((a, e) => a + e.weight, 0);
  if (total <= 0) {
    ev.quietDays++;
    return;
  }
  let r = rng.next() * total;
  for (const e of pool) {
    r -= e.weight;
    if (r <= 0) {
      fireEvent(state, e.def, rng);
      return;
    }
  }
  fireEvent(state, pool[pool.length - 1].def, rng);
}

export type ResolveResult = { ok: true; outcome: string } | { ok: false; error: string };

/** Oyuncunun seçimi. Koç saati yetmiyorsa seçenek reddedilir; olay beklemeye devam eder. */
export function resolveEvent(state: GameState, eventId: string, optionId: string): ResolveResult {
  const ev = state.events;
  const p = ev.pending.find((x) => x.id === eventId);
  if (!p) return { ok: false, error: "event.unknown" };
  const def = EVENT_BY_ID[p.def];
  const opt = def?.options.find((o) => o.id === optionId);
  if (!def || !opt) return { ok: false, error: "event.badOption" };
  const s = p.studentId ? findStudent(state, p.studentId) : undefined;
  if (p.studentId && (!s || s.left)) {
    ev.pending = ev.pending.filter((x) => x !== p);
    return { ok: false, error: "student.left" };
  }
  if (opt.hours && !spendCoachHours(state, opt.hours)) return { ok: false, error: "coach.noTime" };
  ev.pending = ev.pending.filter((x) => x !== p);
  const rng = createRng(state.rng);
  const { ctx, outcome } = makeCtx(state, def, s, rng, p.vars);
  opt.apply(ctx);
  state.rng = rng.state();
  const out = outcome() ?? opt.id;
  emit(state, "eventResolved", { id: p.id, def: p.def, option: opt.id, outcome: out, studentId: p.studentId ?? null, vars: p.vars });
  return { ok: true, outcome: out };
}
