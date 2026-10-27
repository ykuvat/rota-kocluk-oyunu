// KUVAT LABS — Rota
// Ofis makineleri: alış/satış komutları ve haftalık gelir + bakım. Saf ve deterministik (rastgelelik yok).

import { MACHINE_BY_ID, MACHINE_SELL_RATIO, MACHINE_SLOTS, type MachineDef } from "../content/machines";
import { payFromBusinessFirst, post } from "./economy";
import { emit, type GameState } from "./state";

export interface OwnedMachine {
  id: string;
  def: string;
  boughtHour: number;
}

const activeStudents = (state: GameState) => state.students.filter((s) => !s.left).length;
const r2 = (v: number) => Math.round(v * 100) / 100;

/** Bu mekândaki toplam makine yuvası (ev: 0). */
export const machineSlots = (state: GameState): number => (state.office ? (MACHINE_SLOTS[state.office] ?? 0) : 0);

/** Haftalık brüt gelir (verilen aktif öğrenci sayısıyla). */
export const machineIncome = (def: MachineDef, students: number): number => def.perStudentWeekly * students + def.flatWeekly;

/** Haftalık net (gelir − bakım); arayüz tahmini ve geri ödeme hesabı için. */
export const machineNet = (def: MachineDef, students: number): number => machineIncome(def, students) - def.upkeepWeekly;

/** Makine alınabilir mi? Alınabiliyorsa null, değilse engelin hata anahtarı. */
export function machineBlocker(state: GameState, defId: string): string | null {
  const def = MACHINE_BY_ID[defId];
  if (!def) return "machine.unknown";
  if (!state.office) return "machine.noOffice";
  if (def.onlyOffice && def.onlyOffice !== state.office) return "machine.place";
  if (state.machines.some((m) => m.def === def.id)) return "machine.owned";
  if (state.machines.length >= machineSlots(state)) return "machine.full";
  if (state.economy.business < def.price) return "machine.noMoney";
  return null;
}

export function buyMachine(state: GameState, defId: string): string | null {
  const err = machineBlocker(state, defId);
  if (err) return err;
  const def = MACHINE_BY_ID[defId];
  payFromBusinessFirst(state, def.price, "machinePurchase");
  state.machines.push({ id: `mc${state.nextId++}`, def: def.id, boughtHour: state.hour });
  emit(state, "machineBought", { def: def.id });
  return null;
}

export function sellMachine(state: GameState, id: string): string | null {
  const i = state.machines.findIndex((m) => m.id === id);
  if (i < 0) return "machine.unknownId";
  const defId = state.machines[i].def;
  const def = MACHINE_BY_ID[defId];
  state.machines.splice(i, 1);
  if (def) post(state, "business", r2(def.price * MACHINE_SELL_RATIO), "machineSale");
  emit(state, "machineSold", { def: defId });
  return null;
}

/** Hafta kapanışı: gelir ve bakım işletme kasasına; kahve makinesi velilere küçük bir memnuniyet katkısı verir. */
export function weeklyMachines(state: GameState): void {
  if (!state.machines.length) return;
  const students = activeStudents(state);
  let income = 0;
  let upkeep = 0;
  let parentBonus = 0;
  for (const m of state.machines) {
    const def = MACHINE_BY_ID[m.def];
    if (!def) continue;
    income += machineIncome(def, students);
    upkeep += def.upkeepWeekly;
    parentBonus += def.parentSatisfactionWeekly;
  }
  if (income > 0) post(state, "business", r2(income), "machines");
  if (upkeep > 0) payFromBusinessFirst(state, upkeep, "machineUpkeep");
  if (parentBonus > 0) {
    for (const s of state.students) {
      if (s.left) continue;
      s.parent.satisfaction = Math.round(Math.min(100, s.parent.satisfaction + parentBonus) * 10) / 10;
    }
  }
  emit(state, "machineIncome", { income, upkeep, students });
}
