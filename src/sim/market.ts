// Sezon sonu pazarı (GDD E7, G): ÜYS sonrası tercih danışmanlığı penceresi ve rakip kurumların hamleleri.

import { COMPETITORS, EVENT_BY_ID } from "../content/events";
import { FIRST_NAMES, LAST_NAMES } from "../content/archetypes";
import { PREFERENCE, RIVALS } from "../content/season";
import type { Rng } from "../core/rng";
import { HOURS_PER_DAY, HOURS_PER_WEEK } from "./calendar";
import { post } from "./economy";
import { repAwareness, repTrust } from "./effects";
import { fireEvent } from "./events";
import { makeLead } from "./funnel";
import { emit, spendCoachHours, type GameState } from "./state";
import { sigmoid } from "./student";
import type { ExamResult } from "./season";

export interface PrefRequest {
  id: string;
  name: string;
  source: "graduate" | "external";
  studentId?: string;
  /** ödeme isteği (₺) — oyuncuya görünmez */
  willingness: number;
  /** velinin memnuniyeti (mezunlarda kurumdaki son değer) */
  satisfaction: number;
  rank: number;
}

export interface PreferenceState {
  opensAt: number;
  closesAt: number;
  open: boolean;
  graduates: { studentId: string; name: string; satisfaction: number; rank: number; goalMet: boolean }[];
  requests: PrefRequest[];
  nextId: number;
  sold: number;
  income: number;
}

function normal(rng: Rng): number {
  const u = Math.max(1e-9, rng.next()), v = rng.next();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do {
    k++;
    p *= rng.next();
  } while (p > L && k < 50);
  return k - 1;
}

const round100 = (v: number) => Math.round(v / 100) * 100;

/** ÜYS günü: sonuçlar açıklanınca açılacak tercih penceresini planla. */
export function schedulePreference(state: GameState, results: ExamResult[]): void {
  const opensAt = state.hour + PREFERENCE.opensAfterDays * HOURS_PER_DAY;
  state.preference = {
    opensAt,
    closesAt: opensAt + PREFERENCE.lengthDays * HOURS_PER_DAY,
    open: false,
    graduates: results.map((r) => {
      const s = state.students.find((x) => x.id === r.studentId);
      return { studentId: r.studentId, name: r.name, satisfaction: s?.parent.satisfaction ?? 50, rank: r.rank, goalMet: r.goalMet };
    }),
    requests: [],
    nextId: 1,
    sold: 0,
    income: 0,
  };
}

export function preferenceHourly(state: GameState, rng: Rng): void {
  const p = state.preference;
  if (!p) return;
  if (!p.open && state.hour >= p.opensAt) {
    p.open = true;
    for (const g of p.graduates) {
      p.requests.push({
        id: `p${p.nextId++}`,
        name: g.name,
        source: "graduate",
        studentId: g.studentId,
        willingness: round100(PREFERENCE.willingnessMean + normal(rng) * PREFERENCE.willingnessSd + (g.goalMet ? 500 : 0)),
        satisfaction: g.satisfaction,
        rank: g.rank,
      });
    }
    for (let i = poisson(rng, state.reputation.awareness * PREFERENCE.externalPerAwareness); i > 0; i--) {
      p.requests.push({
        id: `p${p.nextId++}`,
        name: `${FIRST_NAMES[rng.int(0, FIRST_NAMES.length - 1)]} ${LAST_NAMES[rng.int(0, LAST_NAMES.length - 1)]}`,
        source: "external",
        willingness: round100(PREFERENCE.willingnessMean + normal(rng) * PREFERENCE.willingnessSd),
        satisfaction: 50,
        rank: Math.round(50_000 + rng.next() * 900_000),
      });
    }
    emit(state, "preferenceOpened", { requests: p.requests.length });
  }
  if (p.open && state.hour >= p.closesAt) {
    emit(state, "preferenceClosed", { sold: p.sold, income: p.income });
    state.preference = null;
  }
}

export function preferenceProbability(r: PrefRequest, price: number): number {
  const c = PREFERENCE;
  return sigmoid(c.bias + ((r.willingness - price) / 1000) * c.priceW + ((r.satisfaction - 50) / 50) * c.satW + (r.source === "graduate" ? c.graduateBonus : 0));
}

/** Tercih danışmanlığı görüşmesi: kabul ederse ücret işletmeye. */
export function preferenceSession(state: GameState, requestId: string, price: number, rng: Rng): { error: string } | { sold: boolean } {
  const p = state.preference;
  if (!p?.open) return { error: "pref.closed" };
  const r = p.requests.find((x) => x.id === requestId);
  if (!r) return { error: "pref.unknown" };
  if (!(price >= 500 && price <= 20_000)) return { error: "lead.badPrice" };
  if (!spendCoachHours(state, PREFERENCE.hours)) return { error: "coach.noTime" };
  p.requests = p.requests.filter((x) => x !== r);
  const sold = rng.next() < preferenceProbability(r, price);
  if (sold) {
    post(state, "business", price, "preferenceCounseling");
    p.sold++;
    p.income += price;
    repTrust(state, PREFERENCE.trustPerSession);
    if (rng.next() < PREFERENCE.referralChance) makeLead(state, "referral", rng);
  }
  emit(state, sold ? "preferenceSold" : "preferenceLost", { name: r.name, price });
  return { sold };
}

export function declinePreference(state: GameState, requestId: string): string | null {
  const p = state.preference;
  if (!p?.requests.some((x) => x.id === requestId)) return "pref.unknown";
  p.requests = p.requests.filter((x) => x.id !== requestId);
  return null;
}

/** Sezon sonu: rakipler başarı oranını ilan eder, iki rakip birer hamle yapar. */
export function rivalsSeasonEnd(state: GameState, rng: Rng, ourRate: number | null): void {
  const rates = COMPETITORS.map((name) => ({ name, rate: Math.round((RIVALS.successMin + rng.next() * (RIVALS.successMax - RIVALS.successMin)) * 100) / 100 }));
  state.market.rivalRates = rates;
  if (ourRate !== null) {
    if (rates.every((r) => ourRate > r.rate)) {
      repTrust(state, RIVALS.beatAllTrust);
      emit(state, "rivalsBeaten", { rate: ourRate });
    } else if (rates.every((r) => ourRate < r.rate)) {
      repTrust(state, RIVALS.lastPlaceTrust);
      emit(state, "rivalsLastPlace", { rate: ourRate });
    }
  }

  const pool = [...COMPETITORS];
  for (let i = 0; i < 2; i++) {
    const rival = pool.splice(rng.int(0, pool.length - 1), 1)[0];
    const moves = Object.entries(RIVALS.moves).filter(([k]) => k !== "poachStaff" || state.staff.members.length > 0) as [keyof typeof RIVALS.moves, { weight: number }][];
    const total = moves.reduce((a, [, m]) => a + m.weight, 0);
    let x = rng.next() * total;
    let move = moves[moves.length - 1][0];
    for (const [k, m] of moves) {
      x -= m.weight;
      if (x <= 0) {
        move = k;
        break;
      }
    }
    if (move === "poachStaff" && state.events.pending.some((p) => p.def === "staffPoach")) move = "adBlitz";
    applyMove(state, rng, rival, move);
  }
}

function applyMove(state: GameState, rng: Rng, rival: string, move: keyof typeof RIVALS.moves): void {
  const m = RIVALS.moves;
  switch (move) {
    case "priceWar":
      state.market.effects.push({ kind: "priceWar", rival, until: state.hour + m.priceWar.weeks * HOURS_PER_WEEK, value: m.priceWar.conversion });
      break;
    case "adBlitz":
      state.market.effects.push({ kind: "adBlitz", rival, until: state.hour + m.adBlitz.weeks * HOURS_PER_WEEK, value: m.adBlitz.demand });
      break;
    case "newBranch":
      repAwareness(state, m.newBranch.awareness);
      break;
    case "poachStaff": {
      const p = fireEvent(state, EVENT_BY_ID.staffPoach, rng);
      if (p) p.vars.rival = rival;
      break;
    }
  }
  emit(state, "rivalMove", { rival, move });
}
