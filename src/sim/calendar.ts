// Oyun zamanı: başlangıçtan bu yana geçen tam saat sayısı (tick = 1 saat).
// Takvim hesapları Date.UTC ile yapılır (saf ve deterministik; Date.now kullanılmaz).

export const HOURS_PER_DAY = 24;
export const DAYS_PER_WEEK = 7;
export const HOURS_PER_WEEK = HOURS_PER_DAY * DAYS_PER_WEEK;

/** Sezon başlangıcı: 7 Eylül 2026 Pazartesi 00:00 (UTC takvimi). */
export const SEASON_START_UTC = Date.UTC(2026, 8, 7);
/** Oyun bu saatte başlar (ilk pazartesi 08:00). */
export const START_HOUR = 8;

export interface CalendarInfo {
  /** 0 = Pazartesi … 6 = Pazar */
  weekday: number;
  hourOfDay: number;
  /** Başlangıçtan bu yana gün sayısı */
  dayIndex: number;
  /** Başlangıçtan bu yana hafta sayısı (0'dan) */
  weekIndex: number;
  year: number;
  /** 1–12 */
  month: number;
  /** 1–31 */
  day: number;
  /** YYYY-MM-DD */
  iso: string;
}

export function calendarAt(hour: number): CalendarInfo {
  const dayIndex = Math.floor(hour / HOURS_PER_DAY);
  const d = new Date(SEASON_START_UTC + dayIndex * 86_400_000);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1;
  const day = d.getUTCDate();
  return {
    weekday: dayIndex % DAYS_PER_WEEK,
    hourOfDay: hour % HOURS_PER_DAY,
    dayIndex,
    weekIndex: Math.floor(dayIndex / DAYS_PER_WEEK),
    year,
    month,
    day,
    iso: `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`,
  };
}

/** Verilen takvim gününe (UTC) kadar kalan gün sayısı; geçmişse negatif. */
export function daysUntil(hour: number, targetIso: string): number {
  const [y, m, d] = targetIso.split("-").map(Number);
  const target = Math.floor((Date.UTC(y, m - 1, d) - SEASON_START_UTC) / 86_400_000);
  return target - Math.floor(hour / HOURS_PER_DAY);
}

export const isWeekend = (weekday: number) => weekday >= 5;
