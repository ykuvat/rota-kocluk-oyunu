// Öğrenci modeli (GDD D1–D3). Saf veri + saf fonksiyonlar; durum JSON olarak serileştirilebilir.

import { ARCHETYPES, firstNames, LAST_NAMES, type Range } from "../content/archetypes";
import { BALANCE } from "../content/balance";
import { ECONOMY } from "../content/business";
import { TOPIC_BY_ID, TOPICS } from "../content/curriculum";
import type { Rng } from "../core/rng";
import type { MockResult } from "./exam";
import { evaluate, type Breakdown, type Modifier } from "./modifiers";
import { generateParent, type Parent } from "./parent";

/** Psikolojik durum ve alışkanlık değerleri (0–100). Sim bunları değiştirir; seanslar geçici değiştirici ekler. */
export type StateStat =
  | "motivation"
  | "selfEfficacy"
  | "anxiety"
  | "fatigue"
  | "goalOwnership"
  | "trust"
  | "routine"
  | "distraction"
  | "sleep";

export type TaskKind = "study" | "practice" | "review";

export interface ProgramBlock {
  /** 0 = Pazartesi … 6 = Pazar */
  weekday: number;
  topicId: string;
  hours: number;
  kind: TaskKind;
}

/** Kaçırılan görevin baskın nedeni (GDD D5 kök neden adayları). */
export type MissCause = "time" | "motivation" | "fatigue" | "difficulty" | "distraction" | "overload" | "trust";

export interface WeekRecord {
  week: number;
  assigned: number;
  done: number;
  hours: number;
  avgMastery: number;
  missCauses: Partial<Record<MissCause, number>>;
}

export interface Student {
  id: string;
  name: string;
  archetype: string;
  personality: { conscientiousness: number; neuroticism: number; openness: number; learningSpeed: number };
  base: Record<StateStat, number>;
  mods: Modifier[];
  mastery: Record<string, number>;
  /** Konunun en son çalışıldığı gün (dayIndex) */
  lastStudiedDay: Record<string, number>;
  context: { familySupport: number; parentExpectation: number };
  program: ProgramBlock[];
  week: WeekRecord;
  history: WeekRecord[];
  /** Deneme sonuçları (eskiden yeniye). */
  mocks: MockResult[];
  /** Koçun bu öğrenciyi ne kadar tanıdığı, değer bazında (0–100). Gözlem sisinin genişliğini belirler. */
  insight: Partial<Record<StateStat, number>>;
  /** Bu hafta yapılan müdahale sayısı (aşırı müdahale cezası için; hafta kapanışında sıfırlanır). */
  ivThisWeek?: number;
  parent: Parent;
  /** Aylık ücret (₺), kayıt görüşmesinde belirlenir. */
  fee: number;
  /** Kurumdan ayrıldı (veli memnuniyetsizliği vb.); simülasyonda artık çalışmaz. */
  left?: boolean;
  /** Rutin takibi yapan yardımcı koç; yoksa oyuncunun kendisi. */
  coachId?: string;
  /** 11 ya da 12. sınıf; ÜYS'ye yalnız 12'ler girer */
  grade: 11 | 12;
  /** ÜYS'ye girip mezun oldu (left ile birlikte true) */
  graduated?: boolean;
  examResult?: import("./season").ExamResult;
}

const pick = (rng: Rng, [a, b]: Range) => a + rng.next() * (b - a);
const round1 = (v: number) => Math.round(v * 10) / 10;

export function emptyWeek(week: number): WeekRecord {
  return { week, assigned: 0, done: 0, hours: 0, avgMastery: 0, missCauses: {} };
}

export function generateStudent(id: string, archetypeId: string, rng: Rng, week = 0): Student {
  const a = ARCHETYPES[archetypeId];
  if (!a) throw new Error(`bilinmeyen arşetip: ${archetypeId}`);
  const base = Object.fromEntries(
    (Object.keys(a.state) as (keyof typeof a.state)[]).map((k) => [k, round1(pick(rng, a.state[k]))]),
  ) as Record<StateStat, number>;
  base.fatigue = 15;
  const mastery: Record<string, number> = {};
  for (const t of TOPICS) {
    // zor konular başlangıçta daha zayıf
    const subj = pick(rng, a.mastery[t.subject]);
    mastery[t.id] = round1(Math.max(0, subj - (t.difficulty - 40) * 0.5));
  }
  const context = {
    familySupport: round1(pick(rng, a.context.familySupport)),
    parentExpectation: round1(pick(rng, a.context.parentExpectation)),
  };
  return {
    id,
    name: `${firstNames(a.gender)[rng.int(0, firstNames(a.gender).length - 1)]} ${LAST_NAMES[rng.int(0, LAST_NAMES.length - 1)]}`,
    archetype: archetypeId,
    personality: {
      conscientiousness: round1(pick(rng, a.personality.conscientiousness)),
      neuroticism: round1(pick(rng, a.personality.neuroticism)),
      openness: round1(pick(rng, a.personality.openness)),
      learningSpeed: Math.round(pick(rng, a.personality.learningSpeed) * 100) / 100,
    },
    base,
    mods: [],
    mastery,
    lastStudiedDay: {},
    context,
    parent: generateParent(context, rng),
    fee: ECONOMY.suggestedFee,
    program: [],
    week: emptyWeek(week),
    history: [],
    mocks: [],
    insight: {},
    grade: 12,
  };
}

/** Bir durum değerinin değiştiricilerle birlikte etkin hâli ve kırılımı ("Neden?"). */
export function stat(s: Student, key: StateStat, now: number): Breakdown {
  return evaluate(key, s.base[key], s.mods, now);
}

const v = (s: Student, key: StateStat, now: number) => stat(s, key, now).value;

export const discipline = (s: Student, now: number) => (s.personality.conscientiousness + v(s, "routine", now)) / 2;

export function sustainableHours(s: Student, now: number, weekday = 0): number {
  const l = BALANCE.load;
  return l.sustainableBase + (discipline(s, now) / 100) * l.sustainableFromDiscipline + (weekday >= 5 ? l.weekendSustainableBonus : 0);
}

export function averageMastery(s: Student): number {
  const vals = Object.values(s.mastery);
  return vals.reduce((a, b) => a + b, 0) / vals.length;
}

/** Ön koşul çarpanı: en zayıf ön koşul eşik altındaysa kazanç orantılı düşer. */
export function prereqFactor(s: Student, topicId: string): number {
  const t = TOPIC_BY_ID[topicId];
  const { prereqThreshold, prereqFloor } = BALANCE.mastery;
  let f = 1;
  for (const p of t.prereqs) f = Math.min(f, Math.max(prereqFloor, (s.mastery[p] ?? 0) / prereqThreshold));
  return Math.min(1, f);
}

export interface ComplianceTerms {
  motivation: number;
  discipline: number;
  trust: number;
  goalOwnership: number;
  fatigue: number;
  flowMismatch: number;
  distraction: number;
  overload: number;
  bias: number;
}

/** Görevi yapma olasılığının terimleri (logit katkıları). Toplamın sigmoid'i = olasılık. */
export function complianceTerms(s: Student, block: ProgramBlock, overload: number, now: number): ComplianceTerms {
  const w = BALANCE.compliance;
  const topic = TOPIC_BY_ID[block.topicId];
  return {
    motivation: w.motivation * v(s, "motivation", now),
    discipline: w.discipline * discipline(s, now),
    trust: w.trust * v(s, "trust", now),
    goalOwnership: w.goalOwnership * v(s, "goalOwnership", now),
    fatigue: -w.fatigue * v(s, "fatigue", now),
    flowMismatch: -w.flowMismatch * Math.abs(topic.difficulty - (s.mastery[block.topicId] ?? 0)),
    distraction: -w.distraction * v(s, "distraction", now),
    overload: -w.overload * overload,
    bias: w.bias,
  };
}

export const sigmoid = (x: number) => 1 / (1 + Math.exp(-x));

export function complianceProbability(terms: ComplianceTerms): number {
  return sigmoid(Object.values(terms).reduce((a, b) => a + b, 0));
}

/** Kaçırmanın baskın nedeni: ortalama bir öğrenciye göre en çok düşüren terim. */
export function dominantMissCause(terms: ComplianceTerms): MissCause {
  const w = BALANCE.compliance;
  // nötr referans: tüm durum değerleri 50, yorgunluk 20, uyumsuzluk 15, yük yok
  const deficit: Record<Exclude<MissCause, "time">, number> = {
    motivation: w.motivation * 50 - terms.motivation,
    trust: w.trust * 50 - terms.trust + (w.goalOwnership * 50 - terms.goalOwnership),
    fatigue: -terms.fatigue - w.fatigue * 20,
    difficulty: -terms.flowMismatch - w.flowMismatch * 15,
    distraction: -terms.distraction - w.distraction * 50 + (w.discipline * 50 - terms.discipline),
    overload: -terms.overload,
  };
  let best: MissCause = "motivation";
  let bestV = -Infinity;
  for (const [k, val] of Object.entries(deficit) as [Exclude<MissCause, "time">, number][]) {
    if (val > bestV) {
      bestV = val;
      best = k;
    }
  }
  return best;
}

/** Yapılan görevin ustalık kazancı (GDD D3). */
export function masteryGain(s: Student, block: ProgramBlock, now: number): number {
  const m = BALANCE.mastery;
  const u = s.mastery[block.topicId] ?? 0;
  const fatigue = v(s, "fatigue", now);
  return (
    block.hours *
    m.gainPerHour *
    s.personality.learningSpeed *
    m.taskQuality[block.kind] *
    prereqFactor(s, block.topicId) *
    Math.max(0, 1 - fatigue / m.fatigueDivisor) *
    Math.pow(1 - u / 100, m.diminishingExponent)
  );
}

const clamp = (x: number) => Math.min(100, Math.max(0, x));
const nudge = (s: Student, key: StateStat, d: number) => (s.base[key] = round1(clamp(s.base[key] + d)));

export interface DayResult {
  done: ProgramBlock[];
  missed: { block: ProgramBlock; cause: MissCause }[];
}

/** Bir günün çalışmasını simüle eder (günün sonunda çağrılır). */
export function simulateDay(s: Student, weekday: number, dayIndex: number, now: number, rng: Rng): DayResult {
  const today = s.program.filter((b) => b.weekday === weekday);
  const result: DayResult = { done: [], missed: [] };
  const free = weekday >= 5 ? BALANCE.load.freeHoursWeekend : BALANCE.load.freeHoursWeekday;
  const assignedHours = today.reduce((a, b) => a + b.hours, 0);
  const overload = Math.max(0, assignedHours / sustainableHours(s, now, weekday) - 1);
  let used = 0;

  for (const block of today) {
    s.week.assigned++;
    if (used + block.hours > free) {
      result.missed.push({ block, cause: "time" });
      continue;
    }
    const terms = complianceTerms(s, block, overload, now);
    if (rng.next() < complianceProbability(terms)) {
      const gain = masteryGain(s, block, now);
      s.mastery[block.topicId] = round1(clamp((s.mastery[block.topicId] ?? 0) + gain));
      s.lastStudiedDay[block.topicId] = dayIndex;
      used += block.hours;
      s.week.done++;
      s.week.hours += block.hours;
      nudge(s, "fatigue", block.hours * BALANCE.fatigue.perHour);
      result.done.push(block);
    } else {
      result.missed.push({ block, cause: dominantMissCause(terms) });
    }
  }

  // psikolojik geri besleme
  const fb = BALANCE.feedback;
  nudge(s, "selfEfficacy", result.done.length * fb.doneSelfEfficacy + result.missed.length * fb.missedSelfEfficacy);
  const tooHard = result.done.filter((b) => TOPIC_BY_ID[b.topicId].difficulty - (s.mastery[b.topicId] ?? 0) > 30).length;
  nudge(s, "motivation", tooHard * fb.tooHardMotivation + (result.done.length > tooHard ? fb.progressMotivation : 0));
  for (const m of result.missed) s.week.missCauses[m.cause] = (s.week.missCauses[m.cause] ?? 0) + 1;

  // tükenme: sürdürülemeyen yük psikolojik bedel ödetir (GDD D3: daha fazla saat ≠ daha iyi)
  const bo = BALANCE.burnout;
  if (s.base.fatigue > bo.fatigueThreshold) {
    nudge(s, "motivation", bo.motivation);
    nudge(s, "anxiety", bo.anxietyAtNeuroticism50 * (s.personality.neuroticism / 50));
    nudge(s, "sleep", bo.sleep);
  }

  // gece toparlanması
  const recovery =
    BALANCE.fatigue.nightlyRecovery * (0.5 + v(s, "sleep", now) / 200) + (weekday >= 5 ? BALANCE.fatigue.weekendBonusRecovery : 0);
  nudge(s, "fatigue", -recovery);
  return result;
}

/** Hafta sonu: unutma, motivasyonun kişiliğe doğru kayması, haftalık kaydın arşivlenmesi. */
export function closeWeek(s: Student, dayIndex: number, nextWeek: number): WeekRecord {
  const f = BALANCE.forgetting;
  for (const t of TOPICS) {
    const last = s.lastStudiedDay[t.id];
    const idle = last === undefined ? 7 : dayIndex - last;
    if (idle <= f.graceDays) continue;
    const u = s.mastery[t.id];
    const loss = Math.min(f.maxPerWeek, f.ratePerWeek * u * Math.min(1, idle / 7));
    s.mastery[t.id] = round1(clamp(u - loss));
  }
  const anchor = (s.personality.conscientiousness + s.base.goalOwnership) / 2;
  nudge(s, "motivation", (anchor - s.base.motivation) * BALANCE.feedback.weeklyMotivationDriftToBase);

  s.ivThisWeek = 0;
  s.week.avgMastery = round1(averageMastery(s));
  const closed = s.week;
  s.history.push(closed);
  s.week = emptyWeek(nextWeek);
  return closed;
}
