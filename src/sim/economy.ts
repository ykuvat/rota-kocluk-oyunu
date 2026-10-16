// Ekonomi (GDD F): iki hesap (kişisel / işletme), çift taraflı olmayan basit defter.
// Her para hareketi bir işlemdir; bakiye = başlangıç + işlemler toplamı (testle korunur).

import { ECONOMY } from "../content/business";
import { BRANCH_BY_ID, OFFICE_BY_ID } from "../content/growth";
import { STAFF } from "../content/staff";
import { emit, type GameState } from "./state";

export type AccountId = "personal" | "business";

export type TxCategory =
  | "tuition"
  | "rent"
  | "food"
  | "transport"
  | "phoneInternet"
  | "workDay"
  | "interest"
  | "advertising"
  | "ownerDraw"
  | "ownerDeposit"
  | "equipment"
  | "sideJob"
  | "refund"
  | "certification"
  | "officeRent"
  | "officeDeposit"
  | "officeSetup"
  | "utilities"
  | "salaries"
  | "severance"
  | "preferenceCounseling"
  | "questReward"
  | "tutoring";

export interface Transaction {
  hour: number;
  account: AccountId;
  amount: number;
  category: TxCategory;
}

export interface Economy {
  personal: number;
  business: number;
  /** Son işlemler (en fazla LEDGER_LIMIT); bakiye her zaman alanlarda tutulur. */
  ledger: Transaction[];
  /** Başlangıçtan bu yana kategori bazlı toplamlar (rapor ve testler için; defter kırpılsa da korunur). */
  totals: Partial<Record<TxCategory, number>>;
}

export const LEDGER_LIMIT = 400;

export function createEconomy(): Economy {
  return { personal: ECONOMY.startPersonal, business: ECONOMY.startBusiness, ledger: [], totals: {} };
}

const r2 = (v: number) => Math.round(v * 100) / 100;

export function post(state: GameState, account: AccountId, amount: number, category: TxCategory): void {
  const e = state.economy;
  e[account] = r2(e[account] + amount);
  e.totals[category] = r2((e.totals[category] ?? 0) + amount);
  e.ledger.push({ hour: state.hour, account, amount: r2(amount), category });
  if (e.ledger.length > LEDGER_LIMIT) e.ledger.splice(0, e.ledger.length - LEDGER_LIMIT);
}

/** Ödeme önce işletme kasasından, yetmezse kişisel hesaptan (Aşama 1: serbest çalışan, gevşek ayrım). */
export function payFromBusinessFirst(state: GameState, amount: number, category: TxCategory): void {
  const fromBusiness = Math.min(amount, Math.max(0, state.economy.business));
  if (fromBusiness > 0) post(state, "business", -fromBusiness, category);
  if (amount - fromBusiness > 0) post(state, "personal", -(amount - fromBusiness), category);
}

/** Ayın 1'i: öğrenci ücretleri tahsil, kişisel giderler ödenir, eksi bakiyeye faiz işler. */
export function monthlySettlement(state: GameState): void {
  for (const s of state.students) {
    if (s.left) continue;
    post(state, "business", s.fee, "tuition");
  }
  if (state.economy.personal < 0) {
    post(state, "personal", r2(state.economy.personal * ECONOMY.creditCardMonthlyInterest), "interest");
  }
  const m = ECONOMY.monthlyPersonal;
  post(state, "personal", -m.rent, "rent");
  post(state, "personal", -m.food, "food");
  post(state, "personal", -m.transport, "transport");
  post(state, "personal", -m.phoneInternet, "phoneInternet");
  if (state.economy.personal < 0) emit(state, "personalDebt", { personal: state.economy.personal });
}

/** Ay sonu: net varlık iflas sınırının altındaysa oyun biter. */
export function checkBankruptcy(state: GameState): void {
  const worth = state.economy.personal + state.economy.business;
  if (state.gameOver || worth >= ECONOMY.bankruptcyLimit) return;
  state.gameOver = { hour: state.hour, reason: "bankrupt", worth };
  emit(state, "gameOver", { reason: "bankrupt", worth });
}

/** Öğrencisi olan iş günü: kahve ve yol. */
export function workDayCost(state: GameState): void {
  if (state.students.some((s) => !s.left)) post(state, "personal", -ECONOMY.dailyWorkCost, "workDay");
}

/** İşletmeden kendine maaş çekmek (pozitif) ya da işletmeye para koymak (negatif tutar). */
export function transfer(state: GameState, amount: number): boolean {
  if (amount > 0) {
    if (amount > state.economy.business) return false;
    post(state, "business", -amount, "ownerDraw");
    post(state, "personal", amount, "ownerDraw");
  } else if (amount < 0) {
    if (-amount > state.economy.personal) return false;
    post(state, "personal", amount, "ownerDeposit");
    post(state, "business", -amount, "ownerDeposit");
  }
  return true;
}

/** Aylık gelir ve gider tahmini (arayüz için). */
export function monthlyForecast(state: GameState): { income: number; personalCosts: number; advertising: number; office: number } {
  const income = state.students.filter((s) => !s.left).reduce((a, s) => a + s.fee, 0);
  const m = ECONOMY.monthlyPersonal;
  const personalCosts = m.rent + m.food + m.transport + m.phoneInternet + ECONOMY.dailyWorkCost * 21;
  const places = state.office ? [OFFICE_BY_ID[state.office], ...state.branches.map((id) => BRANCH_BY_ID[id])].filter(Boolean) : [];
  const salaries = state.staff.members.reduce((a, m) => a + Math.round(m.salary * (1 + STAFF.employerCostRate)), 0);
  return { income, personalCosts, advertising: state.marketing.paidBudget * 4.3, office: places.reduce((a, o) => a + o.rent + o.utilities, 0) + salaries };
}
