// KUVAT LABS — Rota
import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { EVENTS } from "../src/content/events";
import { MACHINES, MACHINE_BY_ID, MACHINE_SELL_RATIO } from "../src/content/machines";
import { deserialize, migrate, serialize } from "../src/platform/save";
import { HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { machineNet, weeklyMachines } from "../src/sim/machines";
import { createState, STATE_VERSION, type GameState } from "../src/sim/state";
import { advance, stateHash } from "../src/sim/step";

function officeState(office: "district" | "central", business = 300_000): GameState {
  const s = createState(21, BALANCE.coach.weeklyHours);
  for (const e of EVENTS) s.events.lastFired[e.id] = s.hour + 100_000;
  s.stage = 2;
  s.economy.business = business;
  expect(applyCommand(s, { type: "rentOffice", officeId: office }).ok).toBe(true);
  applyCommand(s, { type: "setMarketing", networkActive: false, organicHours: 0, paidBudget: 0 });
  return s;
}

const snapshot = (s: GameState) => JSON.stringify(s);

describe("ofis makineleri", () => {
  it("M2: geçersiz alışta durum değişmez", () => {
    const home = createState(3, BALANCE.coach.weeklyHours);
    home.economy.business = 100_000;
    const before = snapshot(home);
    expect(applyCommand(home, { type: "buyMachine", def: "coffee" })).toEqual({ ok: false, error: "machine.noOffice" });
    expect(snapshot(home)).toBe(before);

    const d = officeState("district");
    let b = snapshot(d);
    expect(applyCommand(d, { type: "buyMachine", def: "nope" })).toEqual({ ok: false, error: "machine.unknown" });
    expect(applyCommand(d, { type: "buyMachine", def: "studyBooth" })).toEqual({ ok: false, error: "machine.place" });
    expect(snapshot(d)).toBe(b);

    // yuva dolu (semt ofisi: 2)
    expect(applyCommand(d, { type: "buyMachine", def: "coffee" }).ok).toBe(true);
    expect(applyCommand(d, { type: "buyMachine", def: "vending" }).ok).toBe(true);
    b = snapshot(d);
    expect(applyCommand(d, { type: "buyMachine", def: "printer" })).toEqual({ ok: false, error: "machine.full" });
    expect(snapshot(d)).toBe(b);

    // aynı makine ikinci kez alınmaz
    const c = officeState("central");
    expect(applyCommand(c, { type: "buyMachine", def: "coffee" }).ok).toBe(true);
    b = snapshot(c);
    expect(applyCommand(c, { type: "buyMachine", def: "coffee" })).toEqual({ ok: false, error: "machine.owned" });
    expect(snapshot(c)).toBe(b);

    // para yetmez
    const poor = officeState("central");
    poor.economy.business = 1_000;
    b = snapshot(poor);
    expect(applyCommand(poor, { type: "buyMachine", def: "coffee" })).toEqual({ ok: false, error: "machine.noMoney" });
    expect(snapshot(poor)).toBe(b);
  });

  it("M2: merkez ofiste 4 yuva ve çalışma kabini; satış %40 geri öder, bilinmeyen kimlik durumu değiştirmez", () => {
    const s = officeState("central");
    for (const m of MACHINES) expect(applyCommand(s, { type: "buyMachine", def: m.id }).ok).toBe(true);
    expect(s.machines.length).toBe(4);
    const before = snapshot(s);
    expect(applyCommand(s, { type: "sellMachine", id: "yok" })).toEqual({ ok: false, error: "machine.unknownId" });
    expect(snapshot(s)).toBe(before);

    const target = s.machines.find((m) => m.def === "printer")!;
    const money = s.economy.business;
    expect(applyCommand(s, { type: "sellMachine", id: target.id }).ok).toBe(true);
    expect(s.machines.length).toBe(3);
    expect(s.economy.business).toBeCloseTo(money + MACHINE_BY_ID.printer.price * MACHINE_SELL_RATIO, 2);
    // yuva boşaldı: yeniden alınabilir
    expect(applyCommand(s, { type: "buyMachine", def: "printer" }).ok).toBe(true);
  });

  it("M3: haftalık gelir ve bakım kendi kategorileriyle işlenir", () => {
    const s = officeState("central");
    applyCommand(s, { type: "buyMachine", def: "vending" });
    applyCommand(s, { type: "buyMachine", def: "studyBooth" });
    for (let i = 0; i < 4; i++) applyCommand(s, { type: "addStudent", archetype: "talented_messy" });
    const bought = s.economy.totals.machinePurchase;
    expect(bought).toBe(-(MACHINE_BY_ID.vending.price + MACHINE_BY_ID.studyBooth.price));
    advance(s, HOURS_PER_WEEK * 3);
    const weeks = s.log.filter((e) => e.type === "machineIncome");
    expect(weeks.length).toBeGreaterThanOrEqual(2);
    const income = weeks.reduce((a, e) => a + (e.data.income as number), 0);
    const upkeep = weeks.reduce((a, e) => a + (e.data.upkeep as number), 0);
    expect(s.economy.totals.machines).toBeCloseTo(income, 2);
    expect(s.economy.totals.machineUpkeep).toBeCloseTo(-upkeep, 2);
    const first = weeks[0].data;
    const n = first.students as number;
    expect(first.income).toBe(MACHINE_BY_ID.vending.perStudentWeekly * n + MACHINE_BY_ID.studyBooth.flatWeekly);
    expect(first.upkeep).toBe(MACHINE_BY_ID.vending.upkeepWeekly + MACHINE_BY_ID.studyBooth.upkeepWeekly);
  });

  it("M3: öğrenci yokken otomat zarar eder (yalnız bakım), kabin yine kazanır", () => {
    const s = officeState("district");
    applyCommand(s, { type: "buyMachine", def: "vending" });
    const money = s.economy.business;
    weeklyMachines(s);
    expect(s.economy.business).toBe(money - MACHINE_BY_ID.vending.upkeepWeekly);
    expect(s.economy.totals.machines).toBeUndefined();
    expect(machineNet(MACHINE_BY_ID.vending, 0)).toBeLessThan(0);
    expect(machineNet(MACHINE_BY_ID.studyBooth, 0)).toBeGreaterThan(0);
  });

  it("kahve makinesi velilerin memnuniyetini küçük adımla artırır ve 100'ü aşmaz", () => {
    const s = officeState("district");
    applyCommand(s, { type: "buyMachine", def: "coffee" });
    applyCommand(s, { type: "addStudent", archetype: "talented_messy" });
    applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    s.students[0].parent.satisfaction = 50;
    s.students[1].parent.satisfaction = 99.9;
    s.students[1].left = true; // ayrılmış öğrencinin velisine dokunulmaz
    weeklyMachines(s);
    expect(s.students[0].parent.satisfaction).toBeCloseTo(50.2, 5);
    expect(s.students[1].parent.satisfaction).toBe(99.9);
    s.students[0].parent.satisfaction = 99.9;
    weeklyMachines(s);
    expect(s.students[0].parent.satisfaction).toBe(100);
  });

  it("geri ödeme: 10 öğrencili kurumda 12–20 hafta (kabin hariç öğrenci başına gelirli makineler)", () => {
    for (const m of MACHINES) {
      const weeks = m.price / machineNet(m, 10);
      expect(weeks).toBeGreaterThanOrEqual(12);
      expect(weeks).toBeLessThanOrEqual(20);
    }
  });

  it("aynı tohum ve komutlarla sonuç aynıdır; kaydet-yükle sonrası devam eder", () => {
    const run = () => {
      const s = officeState("central");
      applyCommand(s, { type: "buyMachine", def: "coffee" });
      applyCommand(s, { type: "addStudent", archetype: "talented_messy" });
      advance(s, HOURS_PER_WEEK * 2);
      return s;
    };
    const a = run();
    expect(stateHash(run())).toBe(stateHash(a));
    const b = deserialize(serialize(a));
    advance(a, HOURS_PER_WEEK);
    advance(b, HOURS_PER_WEEK);
    expect(stateHash(b)).toBe(stateHash(a));
  });

  it("M4: sürüm 11 kaydı 12'ye göç eder ve oynanır", () => {
    const s = officeState("district");
    const raw = JSON.parse(serialize(s));
    raw.version = 11;
    delete raw.machines;
    const m = migrate(raw);
    expect(m.version).toBe(STATE_VERSION);
    expect(m.machines).toEqual([]);
    expect(applyCommand(m, { type: "buyMachine", def: "coffee" }).ok).toBe(true);
    advance(m, HOURS_PER_WEEK * 2);
  });
});
