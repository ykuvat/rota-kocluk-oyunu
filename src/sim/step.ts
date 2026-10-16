// Simülasyon döngüsü: 1 tick = 1 oyun saati. Sistem sırası sabittir (GDD I. Simülasyon döngüsü).
//   her saat: takvim
//   22:00  : öğrencilerin günlük çalışması
//   Pazar 23:00 : haftayı kapat (unutma, kayıt), koç saatlerini sıfırla

import { BALANCE } from "../content/balance";
import { createRng } from "../core/rng";
import { calendarAt } from "./calendar";
import { takeMockExam } from "./exam";
import { INSIGHT } from "../content/interventions";
import { addInsight } from "./insight";
import { updateParentWeekly } from "./parent";
import { REPUTATION } from "../content/business";
import { checkBankruptcy, monthlySettlement, workDayCost } from "./economy";
import { eventsDaily } from "./events";
import { officeMonthly, weeklyGrowth } from "./growth";
import { payroll, refreshCandidates, staffWeekly } from "./staff";
import { seasonHourly } from "./season";
import { preferenceHourly } from "./market";
import { checkQuests } from "./quests";
import { pruneMarket } from "./marketEffects";
import { expireLeads, updateReputation, weeklyPlanning } from "./funnel";
import type { StateStat } from "./student";
import { pruneExpired } from "./modifiers";
import { emit, type GameState } from "./state";
import { closeWeek, simulateDay } from "./student";

export const DAILY_HOUR = 22;
/** Anlatıcının günlük olay kararı */
export const EVENT_HOUR = 8;
export const WEEKLY_HOUR = 23;

/** Durumu `hours` saat ilerletir (yerinde değiştirir). */
export function advance(state: GameState, hours: number): void {
  const rng = createRng(state.rng);
  for (let i = 0; i < hours; i++) {
    if (state.gameOver) break; // iflas: zaman durur
    state.hour++;
    const cal = calendarAt(state.hour);
    // ÜYS günü: sınava giren öğrenciler mezun olur (aynı saatteki deneme artık onlara uygulanmaz)
    seasonHourly(state, cal, rng);
    preferenceHourly(state, rng);
    checkQuests(state);
    const active = state.students.filter((s) => !s.left);

    // ekonomi ve huni zamanlaması
    if (cal.hourOfDay === 0) expireLeads(state);
    if (cal.hourOfDay === EVENT_HOUR) eventsDaily(state, rng);
    if (cal.hourOfDay === 9 && cal.weekday < 5) workDayCost(state);
    if (cal.hourOfDay === 9 && cal.day === 1) {
      monthlySettlement(state);
      officeMonthly(state);
      payroll(state);
      checkBankruptcy(state);
    }

    const ex = BALANCE.exam;
    if (cal.weekday === ex.weekday && cal.weekIndex % ex.everyWeeks === ex.everyWeeks - 1) {
      if (cal.hourOfDay === ex.hour - 1) {
        // sınav öncesi gerginlik
        for (const s of active) s.base.anxiety = Math.min(100, s.base.anxiety + ex.anxietyBeforeExam);
      }
      if (cal.hourOfDay === ex.hour) {
        for (const s of active) {
          const prev = s.mocks.at(-1);
          const r = takeMockExam(s, cal.weekIndex, state.hour, rng);
          s.mocks.push(r);
          if (prev) {
            const d = Math.max(-6, Math.min(6, (r.total - prev.total) * ex.selfEfficacyPerNet));
            s.base.selfEfficacy = Math.round(Math.min(100, Math.max(0, s.base.selfEfficacy + d)) * 10) / 10;
          }
          s.base.anxiety = Math.max(0, s.base.anxiety - ex.anxietyBeforeExam);
          emit(state, "mockExam", { id: s.id, total: r.total, prev: prev?.total ?? null });
        }
      }
    }

    if (cal.hourOfDay === DAILY_HOUR) {
      for (const s of active) {
        const r = simulateDay(s, cal.weekday, cal.dayIndex, state.hour, rng);
        if (r.done.length || r.missed.length) {
          emit(state, "dayStudied", { id: s.id, done: r.done.length, missed: r.missed.length });
        }
      }
    }

    if (cal.weekday === 6 && cal.hourOfDay === WEEKLY_HOUR) {
      for (const s of active) {
        s.mods = pruneExpired(s.mods, state.hour);
        const w = closeWeek(s, cal.dayIndex, cal.weekIndex + 1);
        // programı takip eden koç öğrenciyi zamanla tanır
        if (s.program.length) addInsight(s, Object.keys(s.base) as StateStat[], INSIGHT.weeklyPassive);
        emit(state, "weekClosed", { id: s.id, week: w.week, assigned: w.assigned, done: w.done, avgMastery: w.avgMastery });
        const outcome = updateParentWeekly(s, w.week);
        if (outcome === "warning") emit(state, "parentWarning", { id: s.id, satisfaction: s.parent.satisfaction });
        if (outcome === "left") {
          s.left = true;
          state.reputation.trust = Math.max(0, state.reputation.trust + REPUTATION.trustPerLeave);
          emit(state, "studentLeft", { id: s.id, name: s.name, reason: "parent" });
        }
      }
      updateReputation(state);
      weeklyGrowth(state);
      staffWeekly(state, rng);
      pruneMarket(state);
      refreshCandidates(state, rng);
      // yeni hafta: koç saatlerini sıfırla, öğrenci takibini ve pazarlamayı planla, adayları üret
      weeklyPlanning(state, rng);
    }
  }
  state.rng = rng.state();
}

/** Durumun deterministik özeti (testler ve kayıt doğrulaması için). */
export function stateHash(state: GameState): string {
  const json = JSON.stringify(state);
  let h = 2166136261;
  for (let i = 0; i < json.length; i++) {
    h ^= json.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, "0");
}
