// Oyun durumu: düz, serileştirilebilir veri. Sınıf örneği, fonksiyon veya döngüsel referans içermez.

import { START_HOUR } from "./calendar";
import { createEconomy, type Economy } from "./economy";
import { createMarketing, createReputation, type Lead, type Marketing, type Reputation } from "./funnel";
import { createStaff, type StaffState } from "./staff";
import { createSeason, type SeasonState } from "./season";
import { REPUTATION } from "../content/business";
import { SPECIALISTS } from "../content/staff";
import { createMarket, type MarketState } from "./marketEffects";
import type { PreferenceState } from "./market";
import type { Student } from "./student";

/** Şema sürümü. Değişince platform/save.ts'e göç eklenir. 2: veli · 3: ekonomi, huni, itibar, öğrenci ücreti · 4: olaylar, koç saat cezaları · 5: sertifikalar, aşama, ofis · 6: personel · 7: bildirim geçmişi, sezon ve ÜYS · 8: sınıf düzeyi, tercih dönemi, rakip pazarı · 9: iflas (oyun sonu) · 10: hedef görevleri · 11: personel rolleri, şubeler. */
export const STATE_VERSION = 11;

/** Oyuncuyu ilgilendiren olaylar ayrıca kalıcı geçmişte tutulur (günlük kırpılsa da kaybolmaz). */
export const NOTABLE = new Set([
  "studentEnrolled", "studentLeft", "parentWarning", "eventArrived", "eventResolved", "eventExpired", "eventFollowUp",
  "certEarned", "stageReached", "branchOpened", "staffHired", "staffQuit", "staffFired", "personalDebt", "coachOverloaded",
  "examResult", "seasonEnded", "studentPromoted", "preferenceOpened", "preferenceClosed", "preferenceSold", "preferenceLost", "rivalMove", "rivalsBeaten", "rivalsLastPlace", "gameOver", "questDone", "careerEnded",
]);
export const HISTORY_LIMIT = 300;

/** Koçun haftalık saatinden düşen geçici yük (ek iş, bozuk bilgisayar vb.). */
export interface CoachPenalty {
  hours: number;
  /** bu haftadan sonra kalan hafta sayısı */
  weeksLeft: number;
  source: string;
}

export interface PendingEvent {
  id: string;
  def: string;
  studentId?: string;
  hour: number;
  expiresHour: number;
  vars: Record<string, number | string>;
}

export interface DelayedEffect {
  at: number;
  def: string;
  key: string;
  studentId?: string;
  vars: Record<string, number | string>;
}

export interface EventsState {
  pending: PendingEvent[];
  delayed: DelayedEffect[];
  /** olaysız geçen gün sayısı (anlatıcı gerilimi) */
  quietDays: number;
  /** olay türü → son tetiklenme saati */
  lastFired: Record<string, number>;
  /** son tetiklenen olayların tonu (anlatıcı: üst üste kötü olay sınırı) */
  recentTones: string[];
  nextId: number;
}

export const createEvents = (): EventsState => ({ pending: [], delayed: [], quietDays: 0, lastFired: {}, recentTones: [], nextId: 1 });

export interface SimEvent {
  hour: number;
  type: string;
  data: Record<string, unknown>;
}

export interface GameState {
  version: number;
  seed: number;
  /** RNG'nin anlık durumu; her ilerletmede güncellenir. */
  rng: number;
  /** Başlangıçtan bu yana saat (tick). */
  hour: number;
  coach: {
    weeklyHours: number;
    usedThisWeek: number;
    penalties: CoachPenalty[];
    /** tamamlanan sertifikalar */
    certs: string[];
    /** süren eğitim */
    training: { cert: string; weeksLeft: number } | null;
  };
  students: Student[];
  events: EventsState;
  /** 1: evden serbest koç · 2: tanınan koç · 3: ofisli kurum · 4: şubeli kurum */
  stage: number;
  office: string | null;
  /** açılan şubeler (açılış sırasıyla) */
  branches: string[];
  /** son şubenin açıldığı saat (şubeler arası bekleme için) */
  lastBranchHour: number | null;
  staff: StaffState;
  season: SeasonState;
  /** önemli olayların kalıcı geçmişi (en fazla HISTORY_LIMIT) */
  history: SimEvent[];
  /** ÜYS sonrası tercih danışmanlığı penceresi (yoksa null) */
  preference: PreferenceState | null;
  market: MarketState;
  /** oyun bitti (iflas); zaman artık ilerlemez */
  gameOver: { hour: number; reason: "bankrupt"; worth: number } | null;
  /** tamamlanan hedef görevleri */
  quests: string[];
  nextId: number;
  economy: Economy;
  marketing: Marketing;
  reputation: Reputation;
  leads: Lead[];
  nextLeadId: number;
  /** Son olaylar (en fazla LOG_LIMIT). */
  log: SimEvent[];
}

export const LOG_LIMIT = 500;

export function createState(seed: number, weeklyHours: number): GameState {
  return {
    version: STATE_VERSION,
    seed,
    rng: seed >>> 0,
    hour: START_HOUR,
    coach: { weeklyHours, usedThisWeek: 0, penalties: [], certs: [], training: null },
    students: [],
    events: createEvents(),
    stage: 1,
    office: null,
    branches: [],
    lastBranchHour: null,
    staff: createStaff(),
    season: createSeason(0, START_HOUR, {}, REPUTATION.startTrust),
    history: [],
    preference: null,
    market: createMarket(),
    gameOver: null,
    quests: [],
    nextId: 1,
    economy: createEconomy(),
    marketing: createMarketing(),
    reputation: createReputation(),
    leads: [],
    nextLeadId: 1,
    log: [],
  };
}

export function emit(state: GameState, type: string, data: Record<string, unknown> = {}): void {
  state.log.push({ hour: state.hour, type, data });
  if (state.log.length > LOG_LIMIT) state.log.splice(0, state.log.length - LOG_LIMIT);
  if (NOTABLE.has(type)) {
    state.history.push({ hour: state.hour, type, data });
    if (state.history.length > HISTORY_LIMIT) state.history.splice(0, state.history.length - HISTORY_LIMIT);
  }
}

/** Koçun bu haftaki toplam saati: kendi saati + sekreterin üstlendiği evrak/telefon işi. */
export function coachHours(state: GameState): number {
  return state.coach.weeklyHours + (state.staff.members.some((m) => m.role === "secretary") ? SPECIALISTS.secretary.adminHours : 0);
}

export function spendCoachHours(state: GameState, hours: number): boolean {
  if (state.coach.usedThisWeek + hours > coachHours(state)) return false;
  state.coach.usedThisWeek += hours;
  return true;
}

/** Haftalık koç saatinden `weeks` hafta boyunca düşer; içinde bulunulan hafta birinci haftadır. */
export function addCoachPenalty(state: GameState, hours: number, weeks: number, source: string): void {
  if (weeks > 1) state.coach.penalties.push({ hours, weeksLeft: weeks - 1, source });
  state.coach.usedThisWeek += hours;
}

export function findStudent(state: GameState, id: string): Student | undefined {
  return state.students.find((s) => s.id === id);
}
