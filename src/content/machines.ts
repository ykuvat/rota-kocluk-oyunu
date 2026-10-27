// KUVAT LABS — Rota
// Ofis makineleri (otomat, kahve, baskı, çalışma kabini): bir kez alınır, haftalık gelir getirir. Tutarlar ÖRNEKTİR; denge değerleri yalnız burada.

export type MachineId = "vending" | "coffee" | "printer" | "studyBooth";

export interface MachineDef {
  id: MachineId;
  /** alış bedeli (₺) */
  price: number;
  /** haftalık bakım / sarf (₺) */
  upkeepWeekly: number;
  /** haftalık gelir: aktif öğrenci başına (₺) */
  perStudentWeekly: number;
  /** haftalık gelir: öğrenciden bağımsız sabit (₺) */
  flatWeekly: number;
  /** haftalık, her aktif öğrencinin velisinin memnuniyetine katkı (0–100 ölçeğinde puan; tavan 100) */
  parentSatisfactionWeekly: number;
  /** yalnız bu ofiste kurulabilir (yoksa her ofiste) */
  onlyOffice?: string;
}

export const MACHINES: MachineDef[] = [
  { id: "vending", price: 18_000, upkeepWeekly: 75, perStudentWeekly: 120, flatWeekly: 0, parentSatisfactionWeekly: 0 },
  { id: "coffee", price: 9_000, upkeepWeekly: 50, perStudentWeekly: 60, flatWeekly: 0, parentSatisfactionWeekly: 0.2 },
  { id: "printer", price: 14_000, upkeepWeekly: 100, perStudentWeekly: 90, flatWeekly: 0, parentSatisfactionWeekly: 0 },
  { id: "studyBooth", price: 30_000, upkeepWeekly: 150, perStudentWeekly: 0, flatWeekly: 1_800, parentSatisfactionWeekly: 0, onlyOffice: "central" },
];

export const MACHINE_BY_ID: Record<string, MachineDef> = Object.fromEntries(MACHINES.map((m) => [m.id, m]));

/** Satışta alış bedelinin geri dönen oranı. */
export const MACHINE_SELL_RATIO = 0.4;

/** Ofise göre makine yuvası (ev: 0). */
export const MACHINE_SLOTS: Record<string, number> = { district: 2, central: 4 };

/** Kararlar sütununda makine önerisi kaç haftada bir gelir. */
export const MACHINE_OFFER_EVERY_WEEKS = 4;

/** Odada görünen sprite adı (sanat sonradan eklenir; doku yoksa çizilmez). */
export const machineSprite = (def: MachineId | string) => `obj_machine_${def}_cartoon_se`;
