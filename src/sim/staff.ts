// Yardımcı koçlar (GDD E9): işe alım (beceri sisli), maaş + işveren maliyeti, öğrenci ataması, moral ve istifa.

import { STAFF, STAFF_FIRST_NAMES, STAFF_LAST_NAMES } from "../content/staff";
import type { Rng } from "../core/rng";
import { HOURS_PER_DAY } from "./calendar";
import { payFromBusinessFirst } from "./economy";
import { emit, findStudent, type GameState } from "./state";

export interface StaffMember {
  id: string;
  name: string;
  /** 0–100 gerçek beceri (oyuncu işe aldıktan 4 hafta sonra görür) */
  skill: number;
  /** oyuncunun ilk gördüğü aralık */
  skillLo: number;
  skillHi: number;
  salary: number;
  morale: number;
  usedThisWeek: number;
  weeksEmployed: number;
}

export interface Candidate {
  id: string;
  name: string;
  skill: number;
  skillLo: number;
  skillHi: number;
  askSalary: number;
  expiresHour: number;
}

export interface StaffState {
  members: StaffMember[];
  candidates: Candidate[];
  nextId: number;
}

export const createStaff = (): StaffState => ({ members: [], candidates: [], nextId: 1 });

const clamp = (v: number) => Math.min(100, Math.max(0, v));
const round250 = (v: number) => Math.round(v / 250) * 250;

export const marketSalary = (skill: number) => round250(STAFF.salaryBase + skill * STAFF.salaryPerSkill);

/** Oyuncunun görebileceği beceri bilgisi. */
export function visibleSkill(m: StaffMember): { lo: number; hi: number } {
  return m.weeksEmployed >= 4 ? { lo: m.skill, hi: m.skill } : { lo: m.skillLo, hi: m.skillHi };
}

export function caseload(state: GameState, staffId: string | undefined): number {
  return state.students.filter((s) => !s.left && (s.coachId ?? undefined) === staffId).length;
}

function makeCandidate(state: GameState, rng: Rng): Candidate {
  const skill = Math.round(clamp(30 + rng.next() * 60));
  // sis: aralık gerçeği içerir ama merkezi kaymış olabilir
  const shift = (rng.next() - 0.5) * STAFF.skillFog;
  const lo = Math.round(clamp(skill + shift - STAFF.skillFog));
  const hi = Math.round(clamp(skill + shift + STAFF.skillFog));
  // aday kendini biraz pazarlar: istenen maaş görünen aralığın ortasına göre
  const askSalary = round250(marketSalary((lo + hi) / 2) * (0.95 + rng.next() * 0.15));
  return {
    id: `c${state.staff.nextId++}`,
    name: `${STAFF_FIRST_NAMES[rng.int(0, STAFF_FIRST_NAMES.length - 1)]} ${STAFF_LAST_NAMES[rng.int(0, STAFF_LAST_NAMES.length - 1)]}`,
    skill,
    skillLo: lo,
    skillHi: hi,
    askSalary,
    expiresHour: state.hour + STAFF.candidateTtlDays * HOURS_PER_DAY,
  };
}

/** Haftalık: ofis varsa iş ilanına yeni başvuru gelir; süresi dolan başvuru düşer. */
export function refreshCandidates(state: GameState, rng: Rng): void {
  const st = state.staff;
  st.candidates = st.candidates.filter((c) => c.expiresHour > state.hour);
  if (!state.office) return;
  if (st.candidates.length < STAFF.maxCandidates) {
    st.candidates.push(makeCandidate(state, rng));
    emit(state, "candidateArrived", {});
  }
}

export function hireStaff(state: GameState, candidateId: string): string | null {
  if (!state.office) return "staff.noOffice";
  const st = state.staff;
  const c = st.candidates.find((x) => x.id === candidateId);
  if (!c) return "staff.unknown";
  st.candidates = st.candidates.filter((x) => x !== c);
  st.members.push({
    id: `t${st.nextId++}`,
    name: c.name,
    skill: c.skill,
    skillLo: c.skillLo,
    skillHi: c.skillHi,
    salary: c.askSalary,
    morale: 70,
    usedThisWeek: 0,
    weeksEmployed: 0,
  });
  emit(state, "staffHired", { name: c.name, salary: c.askSalary });
  return null;
}

/** İşten çıkarma: kıdem/ihbar ödenir, öğrencileri oyuncuya döner. */
export function fireStaff(state: GameState, staffId: string, reason: "fired" | "quit" = "fired"): string | null {
  const st = state.staff;
  const m = st.members.find((x) => x.id === staffId);
  if (!m) return "staff.unknown";
  if (reason === "fired") payFromBusinessFirst(state, m.salary * STAFF.severanceMonths, "severance");
  st.members = st.members.filter((x) => x !== m);
  for (const s of state.students) if (s.coachId === m.id) s.coachId = undefined;
  emit(state, reason === "fired" ? "staffFired" : "staffQuit", { name: m.name });
  return null;
}

export function assignCoach(state: GameState, studentId: string, coachId: string | null): string | null {
  const s = findStudent(state, studentId);
  if (!s) return "student.unknown";
  if (coachId !== null && !state.staff.members.some((m) => m.id === coachId)) return "staff.unknown";
  s.coachId = coachId ?? undefined;
  return null;
}

/** Ayın 1'i: maaşlar ve işveren maliyeti işletmeden. */
export function payroll(state: GameState): void {
  for (const m of state.staff.members) payFromBusinessFirst(state, Math.round(m.salary * (1 + STAFF.employerCostRate)), "salaries");
}

/** Hafta kapanışı: moral (maaş, vaka yükü) ve istifa. */
export function staffWeekly(state: GameState, rng: Rng): void {
  for (const m of [...state.staff.members]) {
    m.weeksEmployed++;
    const underpaid = Math.max(0, (marketSalary(m.skill) - m.salary) / marketSalary(m.skill)) * 100;
    const extra = Math.max(0, caseload(state, m.id) - STAFF.idealCaseload);
    const d = STAFF.moraleRecovery - underpaid * STAFF.moralePerUnderpaidPct - extra * STAFF.moralePerExtraCase;
    m.morale = Math.round(clamp(m.morale + d) * 10) / 10;
    if (m.morale < STAFF.quitBelow && rng.next() < STAFF.quitChance) fireStaff(state, m.id, "quit");
  }
}

/** Maaş artışı: moral hemen toparlanır. */
export function raiseSalary(state: GameState, staffId: string, amount: number): string | null {
  const m = state.staff.members.find((x) => x.id === staffId);
  if (!m) return "staff.unknown";
  if (!(amount > 0 && amount <= 20_000)) return "staff.badRaise";
  m.salary += amount;
  m.morale = Math.round(clamp(m.morale + (amount / m.salary) * 200) * 10) / 10;
  return null;
}
