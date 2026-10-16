// Denge botları (GDD I. Test yaklaşımı): stratejileri başsız oynatır, bir değişiklik "aşırı yükleme"yi
// baskın strateji yaparsa test kırmızıya döner.

import { describe, expect, it } from "vitest";
import { ARCHETYPES } from "../src/content/archetypes";
import { BALANCE } from "../src/content/balance";
import { balancedProgram, overloadedProgram } from "../src/content/programs";
import { HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { createState } from "../src/sim/state";
import { advance } from "../src/sim/step";
import { averageMastery, type Student } from "../src/sim/student";
import { weeklySignals } from "../src/sim/insight";
import { INTERVENTIONS, type InterventionId } from "../src/content/interventions";

const WEEKS = 10;
const SEEDS = 12;

type Strategy = (s: Student) => ReturnType<typeof balancedProgram>;

function run(archetype: string, strategy: Strategy, seed: number) {
  const state = createState(seed, BALANCE.coach.weeklyHours);
  const r = applyCommand(state, { type: "addStudent", archetype });
  const s = state.students[0];
  const start = averageMastery(s);
  for (let w = 0; w < WEEKS; w++) {
    // her hafta başında programı yeniden yaz (gerçek bir koç gibi)
    applyCommand(state, { type: "setProgram", studentId: r.ok ? r.id! : "", blocks: strategy(s) });
    advance(state, HOURS_PER_WEEK);
  }
  const assigned = s.history.reduce((a, w) => a + w.assigned, 0);
  const done = s.history.reduce((a, w) => a + w.done, 0);
  return { gain: averageMastery(s) - start, compliance: done / assigned, motivation: s.base.motivation };
}

function mean(xs: number[]) {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

// Oyuncunun gördüğü bilgiyle (sinyaller) karar veren bot: gizli nedeni bilmez.
const SIGNAL_TO_INTERVENTION: Record<string, InterventionId> = {
  "signal.shortAnswers": "trustTalk",
  "signal.cancels": "trustTalk",
  "signal.dontKnow": "smallGoals",
  "signal.lowEnergy": "restPlan",
  "signal.morningBlank": "restPlan",
  "signal.lateOnline": "focusPlan",
  "signal.halfDone": "focusPlan",
  "signal.tasksPileUp": "simplifyProgram",
  "signal.schoolLoad": "simplifyProgram",
  "signal.blankInSubject": "subjectSupport",
  "signal.asksSameQuestion": "subjectSupport",
};

function runCoach(archetype: string, seed: number, active: boolean | "spam") {
  const state = createState(seed, BALANCE.coach.weeklyHours);
  applyCommand(state, { type: "addStudent", archetype });
  const s = state.students[0];
  applyCommand(state, { type: "setProgram", studentId: s.id, blocks: balancedProgram(s) });
  const start = averageMastery(s);
  for (let w = 0; w < 12; w++) {
    if (active === "spam") {
      // istismar denemesi: teşhis yok, her hafta tüm kartlar
      for (const iv of Object.keys(INTERVENTIONS) as InterventionId[]) applyCommand(state, { type: "intervene", studentId: s.id, intervention: iv });
    } else if (active) {
      const sig = weeklySignals(s)[0];
      if (sig) applyCommand(state, { type: "intervene", studentId: s.id, intervention: SIGNAL_TO_INTERVENTION[sig] });
    }
    advance(state, HOURS_PER_WEEK);
  }
  const assigned = s.history.reduce((a, w) => a + w.assigned, 0);
  const done = s.history.reduce((a, w) => a + w.done, 0);
  return { gain: averageMastery(s) - start, compliance: done / assigned };
}

describe("denge: sinyalleri okuyan koç fark yaratır (M1 kabul vekili)", () => {
  for (const archetype of ["quiet_drifter", "talented_messy"]) {
    it(archetype, () => {
      const seeds = Array.from({ length: SEEDS }, (_, i) => 2000 + i);
      const act = seeds.map((sd) => runCoach(archetype, sd, true));
      const pas = seeds.map((sd) => runCoach(archetype, sd, false));
      const g = (xs: { gain: number }[]) => mean(xs.map((x) => x.gain));
      const c = (xs: { compliance: number }[]) => mean(xs.map((x) => x.compliance));
      console.log(`${archetype.padEnd(22)} ilgili koç: kazanç ${g(act).toFixed(1)}, uyum %${(c(act) * 100).toFixed(0)} | pasif: kazanç ${g(pas).toFixed(1)}, uyum %${(c(pas) * 100).toFixed(0)}`);
      expect(c(act)).toBeGreaterThan(c(pas) + 0.1);
      expect(g(act)).toBeGreaterThan(g(pas));
      // her kartı her hafta kullanmak teşhisli koçu yenmemeli
      const spam = seeds.map((sd) => runCoach(archetype, sd, "spam"));
      console.log(`${archetype.padEnd(22)} her şeyi dene: kazanç ${g(spam).toFixed(1)}, uyum %${(c(spam) * 100).toFixed(0)}`);
      expect(g(spam)).toBeLessThan(g(act));
    });
  }
});

describe("denge: dengeli program aşırı yüklemeyi yener", () => {
  for (const archetype of Object.keys(ARCHETYPES)) {
    it(archetype, () => {
      const res = (st: Strategy) => {
        const runs = Array.from({ length: SEEDS }, (_, i) => run(archetype, st, 1000 + i));
        return { gain: mean(runs.map((r) => r.gain)), compliance: mean(runs.map((r) => r.compliance)), motivation: mean(runs.map((r) => r.motivation)) };
      };
      const balanced = res(balancedProgram);
      const overloaded = res(overloadedProgram);
      const fmt = (o: typeof balanced) => `kazanç ${o.gain.toFixed(1)}, uyum %${(o.compliance * 100).toFixed(0)}, motivasyon ${o.motivation.toFixed(0)}`;
      console.log(`${archetype.padEnd(22)} dengeli: ${fmt(balanced)} | aşırı: ${fmt(overloaded)}`);

      expect(balanced.gain).toBeGreaterThan(0);
      expect(balanced.compliance).toBeGreaterThan(overloaded.compliance);
      expect(balanced.gain).toBeGreaterThan(overloaded.gain);
    });
  }
});
