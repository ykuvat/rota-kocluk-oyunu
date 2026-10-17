// Odadaki hayat: o an odada kim var, Buse ne yapıyor (yalnız görüntü; sim durumu değişmez).
// - Hafta oynarken: gündüz koçluk günü gelen öğrenci Buse'yle seans masasında oturur (diğer gelenler bekler);
//   kimse gelmezse Buse odada dolaşıp iş yapar; gece ve eğitim saatlerinde masasında çalışır.
// - Hafta dururken (kararlar): seçili öğrenciyle (yoksa ilk öğrenciyle) seansta; eğitim sürüyorsa masasında ders çalışır.

import { VISITS } from "../content/visits";
import type { RoomDef } from "../content/types";
import { calendarAt } from "../sim/calendar";
import type { GameState } from "../sim/state";
import type { Student } from "../sim/student";
import { hash } from "./play/common";

export interface RoomLife {
  /** arka plan poz varyantı (yoksa odanın kendi arka planı) */
  background?: string;
  /** yürüyen Buse gizlensin (poz arka planda) */
  hideBuse: boolean;
  /** odada ayakta duran öğrenciler */
  visitors: Student[];
}

/** Öğrencinin haftalık koçluk günü (0 = Pazartesi). */
export const visitDay = (s: Student) => hash(`visit:${s.id}`) % VISITS.days;

export function roomLife(state: GameState, room: RoomDef, running: boolean, focusId: string | null, has: (sprite: string) => boolean): RoomLife {
  const active = state.students.filter((s) => !s.left);
  const cal = calendarAt(state.hour);
  const desk = room.poses?.desk && has(room.poses.desk) ? room.poses.desk : undefined;
  const sessionBg = (s: Student) => {
    const n = room.poses?.session?.[s.archetype];
    return n && has(n) ? n : undefined;
  };
  const atDesk: RoomLife = { background: desk, hideBuse: !!desk, visitors: [] };
  const withStudents = (list: Student[]): RoomLife => {
    if (!list.length) return { hideBuse: false, visitors: [] };
    const bg = sessionBg(list[0]);
    return bg ? { background: bg, hideBuse: true, visitors: list.slice(1) } : { hideBuse: false, visitors: list };
  };
  const studying = !!state.coach.training;

  if (!running) {
    if (studying && desk) return atDesk;
    const focus = active.find((s) => s.id === focusId) ?? active[0];
    return withStudents(focus ? [focus] : []);
  }
  const h = cal.hourOfDay;
  if (h < VISITS.dayStart || h >= VISITS.dayEnd) return desk ? atDesk : { hideBuse: false, visitors: [] };
  if (studying && desk && h >= VISITS.studyStart && h < VISITS.studyEnd) return atDesk;
  return withStudents(active.filter((s) => visitDay(s) === cal.weekday));
}
