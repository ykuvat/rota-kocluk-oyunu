// Oyun modunda oyuncunun uğraşmaması gereken rutin işler (asistan gibi): haftalık program,
// kişisel hesap ile kasa arasında para aktarma. Durumu yalnız komutlarla değiştirir.

import { balancedProgram } from "../../content/programs";
import { calendarAt } from "../../sim/calendar";
import { applyCommand } from "../../sim/commands";
import type { GameState } from "../../sim/state";

export class Autopilot {
  private lastWeek = -1;

  constructor(private readonly state: GameState) {}

  tick(): void {
    const s = this.state;
    const week = calendarAt(s.hour).weekIndex;
    const newWeek = week !== this.lastWeek;
    this.lastWeek = week;

    for (const st of s.students) {
      if (st.left) continue;
      // programı olmayan öğrenciye hemen, diğerlerine 3 haftada bir güncel dengeli program
      if (!st.program.length || (newWeek && week % 3 === 0)) {
        applyCommand(s, { type: "setProgram", studentId: st.id, blocks: balancedProgram(st) });
      }
    }

    // oyuncu tek bir "para" görür: kişisel hesap eksiye düşmesin diye kasadan maaş çekilir
    const e = s.economy;
    if (e.personal < 3_000 && e.business >= 1_000) {
      const amount = Math.floor(Math.min(e.business, 15_000 - e.personal) / 500) * 500;
      if (amount > 0) applyCommand(s, { type: "transfer", amount });
    }
  }
}
