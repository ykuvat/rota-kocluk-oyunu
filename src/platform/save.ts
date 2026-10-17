// Kayıt sistemi (GDD I. Kayıt): durum düz JSON; sürümlü şema + göç zinciri.
// Şimdilik tarayıcı deposu (localStorage, tek yuva); ileride IndexedDB + birden çok yuva + dosyaya dışa aktarma.

import { BALANCE } from "../content/balance";
import { ARCHETYPES, firstNames } from "../content/archetypes";
import { ROLE_GENDER, STAFF_FIRST_NAMES_F, STAFF_FIRST_NAMES_M } from "../content/staff";
import { ECONOMY } from "../content/business";
import { createEconomy } from "../sim/economy";
import { createMarketing, createReputation } from "../sim/funnel";
import { createStaff } from "../sim/staff";
import { createSeason } from "../sim/season";
import { createMarket } from "../sim/marketEffects";
import { START_HOUR } from "../sim/calendar";
import { REPUTATION } from "../content/business";
import { createEvents, STATE_VERSION, type GameState } from "../sim/state";

const KEY = "rota.save.slot1";

/** Sürüm n'den n+1'e göçler. Şema değiştikçe buraya eklenir; eski kayıtlar sırayla yükseltilir. */
type Raw = Record<string, unknown>;

const MIGRATIONS: Record<number, (s: Raw) => Raw> = {
  // 1 → 2: öğrencilere veli. RNG durumunu bozmamak için deterministik varsayılan: sakin veli.
  1: (s) => ({
    ...s,
    version: 2,
    students: (s.students as Raw[]).map((st) => ({
      ...st,
      parent: {
        style: "calm",
        expectation: (st.context as { parentExpectation: number }).parentExpectation,
        satisfaction: BALANCE.parent.initialSatisfaction,
        lastMeetingWeek: null,
        known: false,
      },
    })),
  }),
  // 2 → 3: ekonomi, huni, itibar; öğrencilere önerilen ücret
  2: (s) => ({
    ...s,
    version: 3,
    economy: createEconomy(),
    marketing: createMarketing(),
    reputation: createReputation(),
    leads: [],
    nextLeadId: 1,
    students: (s.students as Raw[]).map((st) => ({ ...st, fee: ECONOMY.suggestedFee })),
  }),
  // 3 → 4: olay motoru, koçun geçici saat yükleri
  3: (s) => ({
    ...s,
    version: 4,
    events: createEvents(),
    coach: { ...(s.coach as Raw), penalties: [] },
  }),
  // 4 → 5: sertifikalar, aşama, ofis
  4: (s) => ({
    ...s,
    version: 5,
    stage: 1,
    office: null,
    coach: { ...(s.coach as Raw), certs: [], training: null },
  }),
  // 5 → 6: personel
  5: (s) => ({ ...s, version: 6, staff: createStaff() }),
  // 6 → 7: bildirim geçmişi, sezon (ilk sezon oyun başında başlamış sayılır)
  6: (s) => ({ ...s, version: 7, history: [], season: createSeason(0, START_HOUR, {}, REPUTATION.startTrust) }),
  // 7 → 8: sınıf düzeyi (eski öğrenciler ve adaylar 12. sınıf), tercih dönemi, rakip pazarı
  7: (s) => ({
    ...s,
    version: 8,
    students: (s.students as Raw[]).map((st) => ({ ...st, grade: 12 })),
    leads: (s.leads as Raw[]).map((l) => ({ ...l, grade: 12 })),
    preference: null,
    market: createMarket(),
  }),
  // 8 → 9: iflas durumu
  8: (s) => ({ ...s, version: 9, gameOver: null }),
  // 9 → 10: hedef görevleri (eski kayıtta hepsi açık; koşulu sağlananlar ilk denetimde tamamlanır)
  9: (s) => ({ ...s, version: 10, quests: [] }),
  // 10 → 11: personel rolleri (eski ekip ve başvurular yardımcı koç), şubeler
  10: (s) => {
    const staff = s.staff as { members: Raw[]; candidates: Raw[] };
    return {
      ...s,
      version: 11,
      branches: [],
      lastBranchHour: null,
      staff: { ...staff, members: staff.members.map((m) => ({ ...m, role: "coach" })), candidates: staff.candidates.map((c) => ({ ...c, role: "coach" })) },
    };
  },
};

export function migrate(raw: Record<string, unknown>): GameState {
  let s = raw;
  let v = Number(s.version ?? 0);
  while (v < STATE_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`kayıt sürümü ${v} için göç yok`);
    s = step(s);
    v = Number(s.version);
  }
  if (v > STATE_VERSION) throw new Error(`kayıt daha yeni bir sürümden (${v})`);
  const state = s as unknown as GameState;
  fixNameGenders(state);
  return state;
}

/**
 * Eski kayıtlarda isimler cinsiyetten bağımsız seçiliyordu (kız çizimine "Mert" gibi). Görünümle uyuşmayan ilk adı
 * kimlikten türetilen uygun bir adla değiştirir; uyumlu kayıtta hiçbir şey değişmez (her yüklemede güvenle çalışır).
 */
function fixNameGenders(state: GameState): void {
  const pick = (list: readonly string[], id: string) => list[[...id].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7) % list.length];
  const fix = (name: string, list: readonly string[], id: string) => {
    const [first, ...rest] = name.split(" ");
    return list.includes(first) ? name : [pick(list, id), ...rest].join(" ");
  };
  for (const p of [...state.students, ...state.leads]) {
    const g = ARCHETYPES[p.archetype]?.gender;
    if (g) p.name = fix(p.name, firstNames(g), p.id);
  }
  for (const m of [...state.staff.members, ...state.staff.candidates]) {
    const role = m.role ?? "coach";
    m.name = fix(m.name, ROLE_GENDER[role] === "f" ? STAFF_FIRST_NAMES_F : STAFF_FIRST_NAMES_M, m.id);
  }
}

export function serialize(state: GameState): string {
  return JSON.stringify(state);
}

export function deserialize(json: string): GameState {
  return migrate(JSON.parse(json) as Record<string, unknown>);
}

/** Depo erişimi gizli pencerede veya engellenmiş sitede hata verebilir; oyun yine de çalışmalı. */
export function saveToStorage(state: GameState): boolean {
  try {
    localStorage.setItem(KEY, serialize(state));
    return true;
  } catch {
    return false;
  }
}

export function loadFromStorage(): GameState | null {
  try {
    const json = localStorage.getItem(KEY);
    return json ? deserialize(json) : null;
  } catch (err) {
    console.warn("kayıt yüklenemedi, yeni oyun başlıyor:", err);
    return null;
  }
}

export function clearStorage(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* yok say */
  }
}
