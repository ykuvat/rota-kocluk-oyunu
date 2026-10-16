// Personel (GDD E9): işe alım (beceri sisli), maaş + işveren maliyeti, moral ve istifa.
// Yardımcı koçlara öğrenci atanır; uzmanlar (sekreter, rehber, branş öğretmeni) kurumun tamamına haftalık etki verir.

import { TOPICS } from "../content/curriculum";
import { ROLE_IDS, ROLE_SKILL_REF, ROLES, SPECIALISTS, STAFF, STAFF_FIRST_NAMES, STAFF_LAST_NAMES, type StaffRole } from "../content/staff";
import type { Rng } from "../core/rng";
import { calendarAt, HOURS_PER_DAY } from "./calendar";
import { payFromBusinessFirst, post } from "./economy";
import { emit, findStudent, type GameState } from "./state";
import { stat, type Student } from "./student";

export interface StaffMember {
  id: string;
  name: string;
  role: StaffRole;
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
  role: StaffRole;
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
const round1 = (v: number) => Math.round(v * 10) / 10;
const round250 = (v: number) => Math.round(v / 250) * 250;

export const marketSalary = (skill: number, role: StaffRole = "coach") => round250(ROLES[role].salaryBase + skill * ROLES[role].salaryPerSkill);

/** Oyuncunun görebileceği beceri bilgisi. */
export function visibleSkill(m: StaffMember): { lo: number; hi: number } {
  return m.weeksEmployed >= 4 ? { lo: m.skill, hi: m.skill } : { lo: m.skillLo, hi: m.skillHi };
}

export function caseload(state: GameState, staffId: string | undefined): number {
  return state.students.filter((s) => !s.left && (s.coachId ?? undefined) === staffId).length;
}

export const coaches = (state: GameState) => state.staff.members.filter((m) => m.role === "coach");
export const membersOf = (state: GameState, role: StaffRole) => state.staff.members.filter((m) => m.role === role);

/** Ofis + açık şubeler. */
export const siteCount = (state: GameState) => (state.office ? 1 + state.branches.length : 0);

/** Bu rolde bir kişi daha alınabilir mi (yer başına sınır)? */
export function roleHasRoom(state: GameState, role: StaffRole): boolean {
  const cap = ROLES[role].perSite;
  return cap === 0 || membersOf(state, role).length < cap * siteCount(state);
}

/** Başvurusu gelebilecek roller: yeri olan, kurum büyüklüğü yeten, havuzda zaten adayı olmayan uzmanlar. */
function pickRole(state: GameState, rng: Rng): StaffRole {
  const active = state.students.filter((s) => !s.left).length;
  const open = ROLE_IDS.filter(
    (r) => roleHasRoom(state, r) && active >= ROLES[r].minStudents && !state.staff.candidates.some((c) => c.role === r && r !== "coach"),
  );
  const total = open.reduce((a, r) => a + ROLES[r].weight, 0);
  let x = rng.next() * total;
  for (const r of open) {
    x -= ROLES[r].weight;
    if (x <= 0) return r;
  }
  return "coach";
}

function makeCandidate(state: GameState, rng: Rng): Candidate {
  const role = pickRole(state, rng);
  const skill = Math.round(clamp(30 + rng.next() * 60));
  // sis: aralık gerçeği içerir ama merkezi kaymış olabilir
  const shift = (rng.next() - 0.5) * STAFF.skillFog;
  const lo = Math.round(clamp(skill + shift - STAFF.skillFog));
  const hi = Math.round(clamp(skill + shift + STAFF.skillFog));
  // aday kendini biraz pazarlar: istenen maaş görünen aralığın ortasına göre
  const askSalary = round250(marketSalary((lo + hi) / 2, role) * (0.95 + rng.next() * 0.15));
  return {
    id: `c${state.staff.nextId++}`,
    name: `${STAFF_FIRST_NAMES[rng.int(0, STAFF_FIRST_NAMES.length - 1)]} ${STAFF_LAST_NAMES[rng.int(0, STAFF_LAST_NAMES.length - 1)]}`,
    role,
    skill,
    skillLo: lo,
    skillHi: hi,
    askSalary,
    expiresHour: state.hour + STAFF.candidateTtlDays * HOURS_PER_DAY,
  };
}

/** Haftalık: ofis varsa iş ilanına yeni başvuru gelir; süresi dolan ya da yeri dolmuş role ait başvuru düşer. */
export function refreshCandidates(state: GameState, rng: Rng): void {
  const st = state.staff;
  st.candidates = st.candidates.filter((c) => c.expiresHour > state.hour && roleHasRoom(state, c.role));
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
  if (!roleHasRoom(state, c.role)) return "staff.roleFull";
  st.candidates = st.candidates.filter((x) => x !== c);
  st.members.push({
    id: `t${st.nextId++}`,
    name: c.name,
    role: c.role,
    skill: c.skill,
    skillLo: c.skillLo,
    skillHi: c.skillHi,
    salary: c.askSalary,
    morale: 70,
    usedThisWeek: 0,
    weeksEmployed: 0,
  });
  emit(state, "staffHired", { name: c.name, role: c.role, salary: c.askSalary });
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
  emit(state, reason === "fired" ? "staffFired" : "staffQuit", { name: m.name, role: m.role });
  return null;
}

export function assignCoach(state: GameState, studentId: string, coachId: string | null): string | null {
  const s = findStudent(state, studentId);
  if (!s) return "student.unknown";
  if (coachId !== null) {
    const m = state.staff.members.find((x) => x.id === coachId);
    if (!m) return "staff.unknown";
    if (m.role !== "coach") return "staff.notCoach";
  }
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
    const market = marketSalary(m.skill, m.role);
    const underpaid = Math.max(0, (market - m.salary) / market) * 100;
    const extra = m.role === "coach" ? Math.max(0, caseload(state, m.id) - STAFF.idealCaseload) : 0;
    const d = STAFF.moraleRecovery - underpaid * STAFF.moralePerUnderpaidPct - extra * STAFF.moralePerExtraCase;
    m.morale = round1(clamp(m.morale + d));
    if (m.morale < STAFF.quitBelow && rng.next() < STAFF.quitChance) fireStaff(state, m.id, "quit");
  }
}

/** Maaş artışı: moral hemen toparlanır. */
export function raiseSalary(state: GameState, staffId: string, amount: number): string | null {
  const m = state.staff.members.find((x) => x.id === staffId);
  if (!m) return "staff.unknown";
  if (!(amount > 0 && amount <= 20_000)) return "staff.badRaise";
  m.salary += amount;
  m.morale = round1(clamp(m.morale + (amount / m.salary) * 200));
  return null;
}

// --- uzmanlar ---

/** Uzmanın etki gücü (beceri / referans). */
export const roleStrength = (m: StaffMember) => m.skill / ROLE_SKILL_REF;

/** Bir roldeki en güçlü kişinin gücü (yoksa 0). Sekreter gibi kurum çapında tek etki verenler için. */
export function bestStrength(state: GameState, role: StaffRole): number {
  return membersOf(state, role).reduce((a, m) => Math.max(a, roleStrength(m)), 0);
}

/** Sekreter: adayların karar süresi çarpanı. */
export const leadTtlFactor = (state: GameState) => (membersOf(state, "secretary").length ? SPECIALISTS.secretary.leadTtlFactor : 1);

/** Uzmanların kayıt olasılığına katkısı (sekreterin karşılaması). */
export const staffConversion = (state: GameState) => Math.round(SPECIALISTS.secretary.conversion * bestStrength(state, "secretary") * 100) / 100;

/** Rehber öğretmenin tercih danışmanlığı kabulüne katkısı. */
export const staffPreferenceBonus = (state: GameState) => Math.round(SPECIALISTS.counselor.preference * bestStrength(state, "counselor") * 100) / 100;

/** Öğrencinin en zayıf konusu: zorluk ile ustalık arasındaki fark en büyük olan. */
function weakestTopic(s: Student): string {
  let best = TOPICS[0].id;
  let bestGap = -Infinity;
  for (const t of TOPICS) {
    const gap = t.difficulty - (s.mastery[t.id] ?? 0);
    if (gap > bestGap) {
      bestGap = gap;
      best = t.id;
    }
  }
  return best;
}

const avgMastery = (s: Student) => Object.values(s.mastery).reduce((a, b) => a + b, 0) / Math.max(1, Object.keys(s.mastery).length);

/** Hafta başı (planlamadan sonra): uzmanların bu haftaki etkileri. Değiştiriciler bir hafta sürer. */
export function specialistsWeekly(state: GameState): void {
  const active = state.students.filter((s) => !s.left);
  if (!active.length || !state.staff.members.length) return;
  const until = state.hour + 7 * HOURS_PER_DAY;
  const parent = (s: Student, d: number) => (s.parent.satisfaction = round1(clamp(s.parent.satisfaction + d)));

  // sekreter: telefonlar açılır, randevular aksamaz → bütün velilerde küçük memnuniyet
  const sec = bestStrength(state, "secretary");
  if (sec > 0) for (const s of active) parent(s, SPECIALISTS.secretary.parentWeekly * sec);

  // rehber öğretmen: en kaygılı öğrencilerden başlayarak birer görüşme
  const counselors = [...membersOf(state, "counselor")].sort((a, b) => b.skill - a.skill);
  if (counselors.length) {
    const c = SPECIALISTS.counselor;
    const queue = [...active].sort((a, b) => stat(b, "anxiety", state.hour).value - stat(a, "anxiety", state.hour).value);
    let i = 0;
    for (const m of counselors) {
      const k = roleStrength(m);
      for (let n = 0; n < c.students && i < queue.length; n++, i++) {
        const s = queue[i];
        s.mods.push({ stat: "anxiety", source: "staff.counselor", add: round1(c.anxiety * k), until });
        s.mods.push({ stat: "motivation", source: "staff.counselor", add: round1(c.motivation * k), until });
        parent(s, c.parentWeekly * k);
      }
    }
  }

  // branş öğretmeni: en zayıf öğrencilere etüt (en zayıf konuya, azalan getiriyle)
  const teachers = [...membersOf(state, "teacher")].sort((a, b) => b.skill - a.skill);
  if (teachers.length) {
    const t = SPECIALISTS.teacher;
    const queue = [...active].sort((a, b) => avgMastery(a) - avgMastery(b));
    const day = calendarAt(state.hour).dayIndex;
    let i = 0;
    for (const m of teachers) {
      const k = roleStrength(m);
      for (let n = 0; n < t.students && i < queue.length; n++, i++) {
        const s = queue[i];
        const topic = weakestTopic(s);
        const u = s.mastery[topic] ?? 0;
        s.mastery[topic] = round1(clamp(u + t.mastery * k * (1 - u / 100) * 2));
        s.lastStudiedDay[topic] = day;
      }
    }
    // etüt ücretli: aileler haftalık öder (öğretmenin maaşının bir kısmını karşılar)
    if (i > 0) post(state, "business", i * t.weeklyFee, "tutoring");
  }
}
