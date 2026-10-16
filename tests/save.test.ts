import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { balancedProgram } from "../src/content/programs";
import { deserialize, migrate, serialize } from "../src/platform/save";
import { HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { createState, STATE_VERSION } from "../src/sim/state";
import { advance, stateHash } from "../src/sim/step";

describe("kayıt", () => {
  it("kaydet-yükle sonrası oyun aynen devam eder", () => {
    const a = createState(9, BALANCE.coach.weeklyHours);
    applyCommand(a, { type: "addStudent", archetype: "talented_messy" });
    applyCommand(a, { type: "setProgram", studentId: "s1", blocks: balancedProgram(a.students[0]) });
    advance(a, HOURS_PER_WEEK * 3);
    applyCommand(a, { type: "intervene", studentId: "s1", intervention: "focusPlan" });

    const b = deserialize(serialize(a));
    advance(a, HOURS_PER_WEEK * 2);
    advance(b, HOURS_PER_WEEK * 2);
    expect(stateHash(b)).toBe(stateHash(a));
  });

  it("sürüm 1 kaydı veli eklenerek sürüm 2'ye göç eder ve oynanır", () => {
    const a = createState(9, BALANCE.coach.weeklyHours);
    applyCommand(a, { type: "addStudent", archetype: "quiet_drifter" });
    const v1 = JSON.parse(serialize(a));
    v1.version = 1;
    for (const st of v1.students) delete st.parent;
    const b = migrate(v1);
    expect(b.version).toBe(STATE_VERSION);
    expect(b.students[0].parent.style).toBe("calm");
    advance(b, HOURS_PER_WEEK * 2);
    expect(b.students[0].history.length).toBe(2);
  });

  it("gelecekteki bir sürümün kaydı reddedilir, göçü olmayan eski sürüm de", () => {
    expect(() => migrate({ version: STATE_VERSION + 1 })).toThrow();
    expect(() => migrate({ version: 0 })).toThrow();
  });
});
