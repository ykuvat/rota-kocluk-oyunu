import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { balancedProgram } from "../src/content/programs";
import { HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { causesLastWeek } from "../src/sim/insight";
import { createState } from "../src/sim/state";
import { advance } from "../src/sim/step";

function run(archetype: string, seed: number, weeks: number, each: (s: ReturnType<typeof createState>["students"][0], hour: number) => void) {
  const state = createState(seed, BALANCE.coach.weeklyHours);
  const r = applyCommand(state, { type: "addStudent", archetype });
  const s = state.students[0];
  applyCommand(state, { type: "setProgram", studentId: r.ok ? r.id! : "", blocks: balancedProgram(s) });
  for (let w = 0; w < weeks && !s.left; w++) {
    if (w % 3 === 0) applyCommand(state, { type: "parentMeeting", studentId: s.id });
    advance(state, HOURS_PER_WEEK);
    each(s, state.hour);
  }
  return state;
}

describe("yaşam olayları ve kaçırma nedenleri", () => {
  it("öğrencinin haftalık sinyalleri tek bir nedene sıkışmaz (ikincil nedenler ve olaylar da görünür)", () => {
    // en az iki kez kaçırılan (sinyal üreten) nedenler
    const min: Record<string, number> = { anxious_perfectionist: 1, talented_messy: 3, quiet_drifter: 3 };
    for (const archetype of Object.keys(min)) {
      const seen = new Set<string>();
      for (const seed of [3, 7, 21]) {
        run(archetype, seed, 20, (s) => {
          const last = s.history.at(-1)!;
          for (const c of causesLastWeek(s)) if ((last.missCauses[c] ?? 0) >= 2) seen.add(c);
        });
      }
      expect(seen.size, `${archetype}: ${[...seen].join(",")}`).toBeGreaterThanOrEqual(min[archetype]);
    }
  });

  it("olay değiştirici olarak eklenir, süren olay varken yenisi gelmez, süresi dolunca kalkar", () => {
    const state = run("anxious_perfectionist", 5, 12, (s, hour) => {
      const live = new Set(s.mods.filter((x) => x.source.startsWith("life.") && x.until! > hour).map((x) => x.source));
      expect(live.size).toBeLessThanOrEqual(1);
      for (const m of s.mods.filter((x) => x.source.startsWith("life."))) expect(m.until!).toBeGreaterThan(hour - HOURS_PER_WEEK);
    });
    expect(state.log.some((e) => e.type === "lifeEvent")).toBe(true);
  });
});
