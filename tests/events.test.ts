import { describe, expect, it } from "vitest";
import { BALANCE } from "../src/content/balance";
import { COACHING, ECONOMY } from "../src/content/business";
import { EVENT_BY_ID, EVENTS } from "../src/content/events";
import { CERT_BY_ID, OFFICE_BY_ID, STAGES } from "../src/content/growth";
import { createRng } from "../src/core/rng";
import { HOURS_PER_DAY, HOURS_PER_WEEK } from "../src/sim/calendar";
import { applyCommand } from "../src/sim/commands";
import { fireEvent } from "../src/sim/events";
import { makeLead, seasonFactor, startCareer } from "../src/sim/funnel";
import { certEffect } from "../src/sim/growth";
import { createState, STATE_VERSION } from "../src/sim/state";
import { advance, stateHash } from "../src/sim/step";
import { migrate, serialize } from "../src/platform/save";
import { EXTRA_EN, EXTRA_TR } from "../src/platform/i18n.extra";

const newState = (seed = 1) => createState(seed, BALANCE.coach.weeklyHours);
/** Rastgele olayları kapat (yalnız test edilen olay çalışsın). */
const calm = (s: ReturnType<typeof newState>) => {
  for (const e of EVENTS) s.events.lastFired[e.id] = s.hour + 100_000;
  return s;
};

describe("hafta ortası kayıt", () => {
  it("yeni öğrencinin takip saati kayıt haftasında ayrılır", () => {
    for (let seed = 0; seed < 20; seed++) {
      const s = newState(300 + seed);
      startCareer(s, createRng(seed));
      advance(s, 50); // Çarşamba
      const before = s.coach.usedThisWeek;
      const r = applyCommand(s, { type: "introMeeting", leadId: s.leads[0].id, price: 5_000 });
      if (r.ok && r.enrolled) {
        expect(s.coach.usedThisWeek).toBe(before + 1 + COACHING.followUpHours);
        return;
      }
    }
    throw new Error("20 tohumda kayıt olmadı");
  });
});

describe("mevsimsellik", () => {
  it("yaz kayıt dalgası bahardan yüksek", () => {
    const june = Date.UTC(2027, 5, 15), may = Date.UTC(2027, 4, 15), start = Date.UTC(2026, 8, 7, 8);
    const h = (t: number) => Math.round((t - start) / 3_600_000) + 8;
    expect(seasonFactor(h(june))).toBeGreaterThan(seasonFactor(h(may)) * 2);
  });
});

describe("olay motoru", () => {
  it("anlatıcı ≈ haftada bir olay çıkarır ve deterministiktir", () => {
    const run = (seed: number) => {
      const s = newState(seed);
      startCareer(s, createRng(seed));
      for (let i = 0; i < 4; i++) applyCommand(s, { type: "addStudent", archetype: "anxious_perfectionist" });
      advance(s, HOURS_PER_WEEK * 20);
      return s;
    };
    let total = 0;
    for (let seed = 0; seed < 10; seed++) total += run(seed).log.filter((e) => e.type === "eventArrived").length;
    expect(total / 10).toBeGreaterThan(8);
    expect(total / 10).toBeLessThan(30);
    expect(stateHash(run(5))).toBe(stateHash(run(5)));
  });

  it("fireEvent + resolveEvent: viral paylaşım takipçi getirir; saat yoksa reddedilir", () => {
    const s = newState(3);
    s.marketing.followers = 100;
    const p = fireEvent(s, EVENT_BY_ID.viralPost, createRng(1))!;
    s.coach.usedThisWeek = s.coach.weeklyHours - 1;
    expect(applyCommand(s, { type: "resolveEvent", eventId: p.id, optionId: "ride" })).toEqual({ ok: false, error: "coach.noTime" });
    expect(s.events.pending.length).toBe(1);
    s.coach.usedThisWeek = 0;
    const r = applyCommand(s, { type: "resolveEvent", eventId: p.id, optionId: "ride" });
    expect(r).toEqual({ ok: true, outcome: "ride" });
    expect(s.marketing.followers).toBeGreaterThanOrEqual(250);
    expect(s.events.pending.length).toBe(0);
  });

  it("yanıtlanmayan olay süre dolunca varsayılan sonuçla kapanır", () => {
    const s = calm(newState(4));
    applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    const st = s.students[0];
    st.parent.satisfaction = 30;
    const trust = s.reputation.trust;
    fireEvent(s, EVENT_BY_ID.publicComplaint, createRng(1), st);
    advance(s, (EVENT_BY_ID.publicComplaint.deadlineDays + 1) * HOURS_PER_DAY);
    expect(s.log.some((e) => e.type === "eventExpired")).toBe(true);
    expect(s.reputation.trust).toBeLessThan(trust);
  });

  it("puan garantisi sözü 6 hafta sonra geri döner", () => {
    const s = calm(newState(5));
    applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    const st = s.students[0];
    st.parent.style = "demanding";
    const p = fireEvent(s, EVENT_BY_ID.scoreGuarantee, createRng(1), st)!;
    applyCommand(s, { type: "resolveEvent", eventId: p.id, optionId: "promise" });
    expect(s.events.delayed.length).toBe(1);
    advance(s, 43 * HOURS_PER_DAY);
    const f = s.log.find((e) => e.type === "eventFollowUp");
    expect(f?.data.def).toBe("scoreGuarantee");
    expect(["kept", "broken"]).toContain(f?.data.outcome);
  });

  it("hafta sonu dersi: 4 hafta koç saati düşer, 4 ödeme gelir", () => {
    const s = calm(newState(6));
    const p = fireEvent(s, EVENT_BY_ID.weekendGig, createRng(1))!;
    applyCommand(s, { type: "resolveEvent", eventId: p.id, optionId: "accept" });
    expect(s.coach.usedThisWeek).toBe(6);
    advance(s, HOURS_PER_WEEK);
    expect(s.coach.usedThisWeek).toBeGreaterThanOrEqual(6);
    advance(s, HOURS_PER_WEEK * 4);
    expect(s.economy.totals.sideJob).toBe(4 * 3_500);
    expect(s.coach.penalties.length).toBe(0);
  });

  it("her olayın tüm seçenekleri hatasız uygulanır", () => {
    for (const def of EVENTS) {
      for (const opt of def.options) {
        const s = calm(newState(7));
        s.marketing.followers = 100;
        applyCommand(s, { type: "addStudent", archetype: "talented_messy" });
        const st = s.students[0];
        st.mocks.push({ week: 1, total: 30 } as never);
        // ekip gerektiren olaylar için bir yardımcı koç
        s.staff.members.push({ id: "t1", name: "Elif Kara", role: "coach", skill: 60, skillLo: 50, skillHi: 70, salary: 30_000, morale: 60, usedThisWeek: 0, weeksEmployed: 5 });
        const p = fireEvent(s, def, createRng(1), def.student ? st : undefined)!;
        const r = applyCommand(s, { type: "resolveEvent", eventId: p.id, optionId: opt.id });
        expect(r.ok, `${def.id}.${opt.id}`).toBe(true);
        // oyuncuya gösterilen sonuç metni iki dilde de var
        const out = `ev.${def.id}.out.${r.ok ? r.outcome : ""}`;
        expect(EXTRA_TR[out], out).toBeTruthy();
        expect(EXTRA_EN[out], out).toBeTruthy();
        advance(s, 70 * HOURS_PER_DAY); // gecikmeli sonuçlar da çalışsın
        for (const e of s.log.filter((x) => x.type === "eventFollowUp")) {
          const k = `ev.${e.data.def}.out.${e.data.outcome}`;
          expect(EXTRA_TR[k], k).toBeTruthy();
        }
      }
    }
  });
});

describe("metinler", () => {
  it("her olayın başlık, gövde, seçenek ve sonuç metni TR ve EN'de var", () => {
    const outcomes: Record<string, string[]> = {
      scoreGuarantee: ["kept", "broken"], competitorOffer: ["kept", "lost", "stayed"],
      laptopBroken: ["brokeAgain"], siblingEnroll: ["enrolled", "declined"], staffPoach: ["stayed", "left", "gone"],
    };
    const keys: string[] = [];
    for (const def of EVENTS) {
      keys.push(`ev.${def.id}.title`, `ev.${def.id}.body`);
      for (const o of def.options) keys.push(`ev.${def.id}.opt.${o.id}`);
      for (const out of outcomes[def.id] ?? []) keys.push(`ev.${def.id}.out.${out}`);
    }
    for (const c of Object.keys(CERT_BY_ID)) keys.push(`cert.${c}`, `cert.effect.${c}`);
    for (const o of Object.keys(OFFICE_BY_ID)) keys.push(`office.${o}`);
    for (const k of keys) {
      expect(EXTRA_TR[k], k).toBeTruthy();
      expect(EXTRA_EN[k], k).toBeTruthy();
    }
  });
});

describe("sertifika, aşama, ofis", () => {
  it("sertifika parası ödenir, süre sonunda etkisi başlar", () => {
    const s = calm(newState(8));
    const c = CERT_BY_ID.learningPsych;
    expect(applyCommand(s, { type: "startCert", certId: c.id })).toEqual({ ok: true });
    expect(s.economy.totals.certification).toBe(-c.cost);
    expect(applyCommand(s, { type: "startCert", certId: "parentComm" })).toEqual({ ok: false, error: "cert.busy" });
    expect(certEffect(s, "interventionFactor")).toBe(1);
    advance(s, HOURS_PER_WEEK * (c.weeks + 1));
    expect(s.coach.certs).toContain(c.id);
    expect(certEffect(s, "interventionFactor")).toBeCloseTo(1.15, 5);
  });

  it("ev kapasitesi dolunca yeni tanışma yapılamaz", () => {
    const s = newState(9);
    for (let i = 0; i < STAGES.homeCapacity; i++) applyCommand(s, { type: "addStudent", archetype: "quiet_drifter" });
    const lead = makeLead(s, "network", createRng(1));
    expect(applyCommand(s, { type: "introMeeting", leadId: lead.id, price: 6_000 })).toEqual({ ok: false, error: "capacity.full" });
  });

  it("Aşama 2'den önce ofis kiralanamaz; sonra kira her ay işletmeden çıkar", () => {
    const s = calm(newState(10));
    s.economy.business = 200_000;
    expect(applyCommand(s, { type: "rentOffice", officeId: "district" })).toEqual({ ok: false, error: "office.stage" });
    s.stage = 2;
    expect(applyCommand(s, { type: "rentOffice", officeId: "district" })).toEqual({ ok: true });
    expect(s.stage).toBe(3);
    const o = OFFICE_BY_ID.district;
    advance(s, 24 * HOURS_PER_DAY + 2);
    expect(s.economy.totals.officeRent).toBe(-o.rent);
    expect(s.economy.totals.officeDeposit).toBe(-o.rent * o.depositMonths);
  });

  it("Aşama 2: yeterli öğrenci, güven ve tahsilat", () => {
    const s = calm(newState(11));
    for (let i = 0; i < 4; i++) applyCommand(s, { type: "addStudent", archetype: "anxious_perfectionist" });
    s.reputation.trust = 70;
    s.economy.totals.tuition = 50_000;
    advance(s, HOURS_PER_WEEK);
    expect(s.stage).toBe(2);
    expect(s.log.some((e) => e.type === "stageReached")).toBe(true);
  });

  it("sürüm 3 kaydı güncel sürüme göç eder", () => {
    const s = newState(12);
    const raw = JSON.parse(serialize(s));
    raw.version = 3;
    delete raw.events;
    delete raw.stage;
    delete raw.office;
    raw.coach = { weeklyHours: 50, usedThisWeek: 0 };
    const m = migrate(raw);
    expect(m.version).toBe(STATE_VERSION);
    expect(m.events.pending).toEqual([]);
    expect(m.coach.certs).toEqual([]);
    expect(m.stage).toBe(1);
    advance(m, HOURS_PER_WEEK * 3);
    expect(m.economy.personal).toBeLessThanOrEqual(ECONOMY.startPersonal);
  });
});
