// Sezon döngüsü: Haziran'da ÜYS → sonuçlar, kurum itibarı, mezuniyet, sezon raporu → yeni sezon.
// Öğrenciler 12. sınıftır; sınavdan sonra mezun olur, kurum yaz kayıt dalgasıyla yeni sezona hazırlanır.

import { CAREER } from "../content/career";
import { GRADES, UYS } from "../content/season";
import { careerResult, type CareerResult } from "./career";
import type { Rng } from "../core/rng";
import { calendarAt, HOURS_PER_DAY, type CalendarInfo } from "./calendar";
import type { TxCategory } from "./economy";
import { repAwareness } from "./effects";
import { takeMockExam } from "./exam";
import { makeLead } from "./funnel";
import { rivalsSeasonEnd, schedulePreference } from "./market";
import { emit, type GameState } from "./state";
import { sigmoid, type Student } from "./student";

export interface ExamResult {
  studentId: string;
  name: string;
  net: number;
  /** ilk denemedeki net (yoksa null) */
  firstNet: number | null;
  targetNet: number;
  rank: number;
  goalMet: boolean;
}

export interface SeasonReport {
  season: number;
  examIso: string;
  results: ExamResult[];
  /** 11'den 12'ye geçip kurumda kalan */
  promoted: number;
  /** hedefini tutturan oranı (sınava giren yoksa null) */
  ourRate: number | null;
  rivals: { name: string; rate: number }[];
  rivalMoves: { rival: string; move: string }[];
  leftEarly: number;
  enrolled: number;
  income: number;
  expenses: number;
  /** kategori bazlı sezon hareketleri (kâr/zarar; sahip transferleri hariç) */
  byCategory: Partial<Record<TxCategory, number>>;
  trustStart: number;
  trustEnd: number;
  awareness: number;
  stage: number;
  staff: number;
  certs: number;
  /** Yalnız final sezonunun (CAREER.seasons) raporunda dolu; eski kayıtlarda ve önceki sezonlarda yok. */
  career?: CareerResult;
}

export interface SeasonState {
  index: number;
  startHour: number;
  totalsAtStart: Partial<Record<TxCategory, number>>;
  trustAtStart: number;
  reports: SeasonReport[];
  /** oyuncu kapatana kadar gösterilecek rapor */
  pendingReport: SeasonReport | null;
}

export const createSeason = (index: number, startHour: number, totals: Partial<Record<TxCategory, number>>, trust: number): SeasonState => ({
  index,
  startHour,
  totalsAtStart: { ...totals },
  trustAtStart: trust,
  reports: [],
  pendingReport: null,
});

export const examIso = (season: number) =>
  `${UYS.firstYear + season}-${String(UYS.month).padStart(2, "0")}-${String(UYS.day).padStart(2, "0")}`;

/** Sıralama: netin üstünde kalan aday sayısı (1 = birinci). */
export function rankFor(net: number): number {
  const above = 1 - sigmoid((net - UYS.rankMidNet) / UYS.rankScale);
  return Math.max(1, Math.round(above * UYS.candidates));
}

/** Ailenin kayıtta koyduğu hedef (veli görüşmeleri beklentiyi yumuşatsa da sınav hedefi değişmez). */
export const targetNet = (s: Student) => Math.round(UYS.targetBase + s.context.parentExpectation * UYS.targetPerExpectation);

/** Saatlik denetim: ÜYS günü ve saati geldiyse sınav, sonuç ve sezon geçişi. */
export function seasonHourly(state: GameState, cal: CalendarInfo, rng: Rng): void {
  if (cal.hourOfDay !== UYS.hour || cal.iso !== examIso(state.season.index)) return;
  runFinalExam(state, rng);
}

const OWNER: TxCategory[] = ["ownerDraw", "ownerDeposit"];

export function runFinalExam(state: GameState, rng: Rng): SeasonReport {
  const week = calendarAt(state.hour).weekIndex;
  const results: ExamResult[] = [];
  const active = state.students.filter((x) => !x.left);
  const sitters = active.filter((x) => x.grade === 12);
  // 11. sınıflar sınava girmez, 12'ye geçer ve kurumda kalır
  for (const s of active.filter((x) => x.grade === 11)) {
    s.grade = 12;
    s.parent.satisfaction = Math.min(100, Math.round((s.parent.satisfaction + GRADES.promotionSatisfaction) * 10) / 10);
    emit(state, "studentPromoted", { id: s.id, name: s.name });
  }
  for (const s of sitters) {
    // sınav günü gerginliği
    s.mods.push({ stat: "anxiety", source: "exam.day", add: UYS.examDayAnxiety, until: state.hour + HOURS_PER_DAY });
    const r = takeMockExam(s, week, state.hour, rng);
    const net = r.total;
    const res: ExamResult = {
      studentId: s.id,
      name: s.name,
      net,
      firstNet: s.mocks[0]?.total ?? null,
      targetNet: targetNet(s),
      rank: rankFor(net),
      goalMet: net >= targetNet(s),
    };
    results.push(res);
    s.graduated = true;
    s.left = true;
    s.examResult = res;
    emit(state, "examResult", { id: s.id, name: s.name, net, rank: res.rank, goalMet: res.goalMet, target: res.targetNet });
  }

  // kurum itibarı: başarı oranı herkesin konuştuğu şeydir
  const hits = results.filter((r) => r.goalMet).length;
  const misses = results.length - hits;
  const d = Math.max(-UYS.trustCap, Math.min(UYS.trustCap, hits * UYS.trustPerSuccess + misses * UYS.trustPerMiss));
  state.reputation.trust = Math.round(Math.min(100, Math.max(0, state.reputation.trust + d)) * 10) / 10;
  repAwareness(state, hits * UYS.awarenessPerSuccess);
  for (let i = 0; i < hits; i++) if (rng.next() < UYS.referralChance) makeLead(state, "referral", rng);

  // rakipler sonuç ilan eder ve hamle yapar; sonuçlar açıklanınca tercih dönemi başlar
  const ourRate = results.length ? Math.round((hits / results.length) * 100) / 100 : null;
  rivalsSeasonEnd(state, rng, ourRate);
  schedulePreference(state, results);

  const report = buildReport(state, results, active.length - sitters.length, ourRate);
  const season = state.season;
  if (season.index === CAREER.seasons - 1) report.career = careerResult(state, ourRate);
  season.reports.push(report);
  season.pendingReport = report;
  emit(state, "seasonEnded", { season: season.index, graduated: results.length, hits });
  if (report.career) emit(state, "careerEnded", { tier: report.career.tier, done: report.career.done });

  // yeni sezon
  season.index++;
  season.startHour = state.hour;
  season.totalsAtStart = { ...state.economy.totals };
  season.trustAtStart = state.reputation.trust;
  return report;
}

function buildReport(state: GameState, results: ExamResult[], promoted: number, ourRate: number | null): SeasonReport {
  const season = state.season;
  const byCategory: Partial<Record<TxCategory, number>> = {};
  let income = 0, expenses = 0;
  for (const [k, v] of Object.entries(state.economy.totals) as [TxCategory, number][]) {
    if (OWNER.includes(k)) continue;
    const delta = Math.round((v - (season.totalsAtStart[k] ?? 0)) * 100) / 100;
    if (!delta) continue;
    byCategory[k] = delta;
    if (delta > 0) income += delta;
    else expenses += -delta;
  }
  const inSeason = state.history.filter((e) => e.hour >= season.startHour);
  return {
    season: season.index,
    examIso: examIso(season.index),
    results,
    promoted,
    ourRate,
    rivals: state.market.rivalRates.map((r) => ({ ...r })),
    rivalMoves: state.history
      .filter((e) => e.type === "rivalMove" && e.hour === state.hour)
      .map((e) => ({ rival: String(e.data.rival), move: String(e.data.move) })),
    leftEarly: inSeason.filter((e) => e.type === "studentLeft").length,
    enrolled: inSeason.filter((e) => e.type === "studentEnrolled").length,
    income: Math.round(income),
    expenses: Math.round(expenses),
    byCategory,
    trustStart: season.trustAtStart,
    trustEnd: state.reputation.trust,
    awareness: state.reputation.awareness,
    stage: state.stage,
    staff: state.staff.members.length,
    certs: state.coach.certs.length,
  };
}

export function closeReport(state: GameState): void {
  state.season.pendingReport = null;
}
