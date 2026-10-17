import { describe, expect, it } from "vitest";
import { ARCHETYPES, firstNames } from "../src/content/archetypes";
import { ROLE_GENDER, STAFF_FIRST_NAMES_F, STAFF_FIRST_NAMES_M } from "../src/content/staff";
import { createRng } from "../src/core/rng";
import { makeLead } from "../src/sim/funnel";
import { refreshCandidates } from "../src/sim/staff";
import { createState } from "../src/sim/state";
import { migrate, serialize } from "../src/platform/save";

const first = (name: string) => name.split(" ")[0];

describe("isim ve görünüm uyumu", () => {
  it("aday ve öğrenci adları arşetipin çizildiği cinsiyete uyar; aynı ad-soyad tekrar etmez", () => {
    const s = createState(5, 50);
    const rng = createRng(5);
    for (let i = 0; i < 60; i++) makeLead(s, "network", rng);
    for (const l of s.leads) expect(firstNames(ARCHETYPES[l.archetype].gender)).toContain(first(l.name));
    // 10 × 10 ad-soyad uzayında 60 adayda tekrar olmamalı
    expect(new Set(s.leads.map((l) => l.name)).size).toBeGreaterThan(55);
  });

  it("personel adları rol sprite'ının cinsiyetine uyar", () => {
    const s = createState(6, 50);
    s.office = "central";
    for (let i = 0; i < 40; i++) {
      s.staff.candidates = [];
      refreshCandidates(s, createRng(100 + i));
      const c = s.staff.candidates[0];
      const list: readonly string[] = ROLE_GENDER[c.role] === "f" ? STAFF_FIRST_NAMES_F : STAFF_FIRST_NAMES_M;
      expect(list).toContain(first(c.name));
    }
  });

  it("eski kayıttaki uyumsuz isim yüklemede düzelir, uyumlu isim değişmez", () => {
    const s = createState(7, 50);
    makeLead(s, "network", createRng(7));
    const lead = s.leads[0];
    const good = lead.name;
    const wrong = ARCHETYPES[lead.archetype].gender === "f" ? "Mert" : "Zeynep";
    lead.name = `${wrong} Kaya`;
    const fixed = migrate(JSON.parse(serialize(s)));
    expect(firstNames(ARCHETYPES[lead.archetype].gender)).toContain(first(fixed.leads[0].name));
    expect(fixed.leads[0].name.endsWith("Kaya")).toBe(true);
    lead.name = good;
    expect(migrate(JSON.parse(serialize(s))).leads[0].name).toBe(good);
  });
});
