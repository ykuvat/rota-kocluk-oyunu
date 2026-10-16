// İlk olay seti (GDD G). Her olay bir ikilemdir: kısa vadeli rahatlama ile uzun vadeli bedel arasında seçim.
// Metinler platform/i18n.events.ts'te: ev.<id>.title / body / opt.<seçenek> / out.<sonuç>.

import type { EventDef } from "../sim/events";
import { ARCHETYPES, FIRST_NAMES } from "./archetypes";
import { payFromBusinessFirst, post } from "../sim/economy";
import { baseShift, parentSat, repAwareness, repTrust, studentLeaves, tempMod } from "../sim/effects";
import { enrollFromLead } from "../sim/funnel";
import { activeCount, capacity } from "../sim/growth";
import { fireStaff } from "../sim/staff";
import { addCoachPenalty } from "../sim/state";
import { sigmoid, stat } from "../sim/student";

/** Anlatıcı temposu: olaysız her gün olasılığı artırır (≈ haftada bir olay). */
export const EVENT_PACING = {
  base: 0.03,
  perQuietDay: 0.03,
  maxChance: 0.45,
  maxPending: 2,
  /** son iki olaydaki her kötü olay için yeni kötü olayın ağırlık çarpanı */
  badStreakFactor: 0.3,
} as const;

export const COMPETITORS = ["Zirve Akademi", "Pusula Koçluk", "Hedef Noktası", "Atlas"] as const;

const roundFee = (v: number) => Math.round(v / 250) * 250;
const lastMock = (s: { mocks: { total: number }[] }) => s.mocks.at(-1)?.total ?? 0;

export const EVENTS: EventDef[] = [
  {
    // Veli puan garantisi istiyor: söz vermek bugün rahatlatır, tutmazsa itibar yanar.
    id: "scoreGuarantee",
    tone: "dilemma",
    weight: 3,
    cooldownDays: 28,
    deadlineDays: 3,
    minWeek: 2,
    student: (s) => (s.parent.style === "demanding" || s.parent.style === "anxious") && s.history.length >= 2,
    options: [
      {
        id: "promise",
        apply: (c) => {
          parentSat(c.s!, 12);
          c.vars.startNet = lastMock(c.s!);
          c.later(42, "check");
        },
      },
      { id: "honest", apply: (c) => { parentSat(c.s!, -5); repTrust(c.state, 1.5); } },
      { id: "process", hours: 1, apply: (c) => { parentSat(c.s!, 3); c.s!.parent.known = true; } },
    ],
    onExpire: (c) => parentSat(c.s!, -8),
    delayed: {
      check: (c) => {
        if (lastMock(c.s!) - Number(c.vars.startNet) >= 8) {
          parentSat(c.s!, 4);
          c.outcome("kept");
        } else {
          parentSat(c.s!, -25);
          repTrust(c.state, -6);
          c.outcome("broken");
        }
      },
    },
  },
  {
    // Rakip kurum daha ucuz teklif verdi.
    id: "competitorOffer",
    tone: "bad",
    weight: 2,
    cooldownDays: 35,
    deadlineDays: 4,
    minWeek: 4,
    student: (s) => s.fee >= 4_500 && s.parent.satisfaction < 70 && s.history.length >= 3,
    vars: (c) => ({ rival: COMPETITORS[c.rng.int(0, COMPETITORS.length - 1)], newFee: roundFee(c.s!.fee * 0.85) }),
    options: [
      {
        id: "match",
        cost: (c) => (c.s ? c.s.fee - Number(c.vars.newFee) : 0),
        apply: (c) => { c.s!.fee = Number(c.vars.newFee); parentSat(c.s!, 6); },
      },
      {
        id: "showProgress",
        hours: 1,
        apply: (c) => {
          if (c.rng.next() < sigmoid((c.s!.parent.satisfaction - 45) / 8)) {
            parentSat(c.s!, 5);
            c.outcome("kept");
          } else {
            studentLeaves(c.state, c.s!, "competitor");
            c.outcome("lost");
          }
        },
      },
      { id: "letGo", apply: (c) => letGo(c) },
    ],
    onExpire: (c) => letGo(c),
  },
  {
    // Gece yarısı kaygılı mesaj.
    id: "lateNight",
    tone: "dilemma",
    weight: 3,
    cooldownDays: 14,
    deadlineDays: 1,
    student: (s, state) => stat(s, "anxiety", state.hour).value >= 55,
    options: [
      { id: "answerNow", hours: 1, apply: (c) => { tempMod(c.state, c.s!, "anxiety", -10, 7, "ev.lateNight"); tempMod(c.state, c.s!, "trust", 6, 14, "ev.lateNight"); } },
      { id: "nextMorning", apply: (c) => tempMod(c.state, c.s!, "trust", -2, 7, "ev.lateNight") },
      {
        id: "boundaries",
        apply: (c) => {
          tempMod(c.state, c.s!, "trust", -4, 7, "ev.lateNight");
          baseShift(c.s!, "routine", 3);
          baseShift(c.s!, "anxiety", -1);
        },
      },
    ],
    onExpire: (c) => tempMod(c.state, c.s!, "trust", -2, 7, "ev.lateNight"),
  },
  {
    // Bir paylaşım beklenmedik ilgi gördü.
    id: "viralPost",
    tone: "good",
    weight: 2,
    cooldownDays: 42,
    deadlineDays: 2,
    when: (s) => s.marketing.followers >= 40,
    options: [
      {
        id: "ride",
        hours: 3,
        apply: (c) => {
          c.state.marketing.followers += 150 + c.rng.int(0, 150);
          repAwareness(c.state, 8);
        },
      },
      { id: "ignore", apply: (c) => { c.state.marketing.followers += 40; repAwareness(c.state, 2); } },
    ],
    onExpire: (c) => { c.state.marketing.followers += 40; repAwareness(c.state, 2); },
  },
  {
    // Para sıkışıkken hafta sonu dershane dersi teklifi: nakit karşılığında koç saati.
    id: "weekendGig",
    tone: "dilemma",
    weight: 2,
    cooldownDays: 56,
    deadlineDays: 3,
    minWeek: 1,
    // ofisi olan kurum sahibine hafta sonu dersi teklif edilmez
    when: (s) => s.economy.personal < 20_000 && s.stage < 3,
    vars: () => ({ pay: 3_500, weeks: 4, hours: 6 }),
    options: [
      {
        id: "accept",
        apply: (c) => {
          addCoachPenalty(c.state, Number(c.vars.hours), Number(c.vars.weeks), "sideJob");
          for (let w = 1; w <= Number(c.vars.weeks); w++) c.later(7 * w - 2, "pay");
        },
      },
      { id: "decline", apply: () => {} },
    ],
    onExpire: () => {},
    delayed: {
      pay: (c) => post(c.state, "personal", Number(c.vars.pay), "sideJob"),
    },
  },
  {
    // Bilgisayar bozuldu.
    id: "laptopBroken",
    tone: "bad",
    weight: 1,
    cooldownDays: 120,
    deadlineDays: 2,
    minWeek: 3,
    vars: () => ({ repair: 9_000, used: 4_500 }),
    options: [
      { id: "repair", cost: (c) => Number(c.vars.repair), apply: (c) => payFromBusinessFirst(c.state, Number(c.vars.repair), "equipment") },
      {
        id: "used",
        cost: (c) => Number(c.vars.used),
        apply: (c) => {
          payFromBusinessFirst(c.state, Number(c.vars.used), "equipment");
          c.later(60, "usedCheck");
        },
      },
      { id: "phone", apply: (c) => addCoachPenalty(c.state, 6, 3, "laptop") },
    ],
    onExpire: (c) => addCoachPenalty(c.state, 6, 3, "laptop"),
    delayed: {
      usedCheck: (c) => {
        if (c.rng.next() < 0.5) {
          addCoachPenalty(c.state, 6, 2, "laptop");
          c.outcome("brokeAgain");
        }
      },
    },
  },
  {
    // Memnuniyetsiz veli sosyal medyada şikâyet etmekle tehdit ediyor.
    id: "publicComplaint",
    tone: "bad",
    weight: 3,
    cooldownDays: 21,
    deadlineDays: 2,
    student: (s) => s.parent.satisfaction < 40,
    options: [
      { id: "meet", hours: 1, apply: (c) => parentSat(c.s!, 10) },
      {
        id: "refund",
        cost: (c) => (c.s ? Math.round(c.s.fee / 2) : 0),
        apply: (c) => {
          payFromBusinessFirst(c.state, Math.round(c.s!.fee / 2), "refund");
          parentSat(c.s!, 15);
          repTrust(c.state, 1);
        },
      },
      { id: "ignore", apply: (c) => { repTrust(c.state, -6); repAwareness(c.state, 2); } },
    ],
    onExpire: (c) => { repTrust(c.state, -6); repAwareness(c.state, 2); },
  },
  {
    // Memnun veli kardeşini de kaydettirmek istiyor, aile indirimi soruyor.
    id: "siblingEnroll",
    tone: "good",
    weight: 2,
    cooldownDays: 60,
    deadlineDays: 4,
    when: (state) => activeCount(state) < capacity(state),
    student: (s) => s.parent.satisfaction >= 70 && s.history.length >= 4,
    vars: (c) => {
      const ids = Object.keys(ARCHETYPES);
      const last = c.s!.name.split(" ").at(-1) ?? "";
      return {
        sibling: `${FIRST_NAMES[c.rng.int(0, FIRST_NAMES.length - 1)]} ${last}`,
        archetype: ids[c.rng.int(0, ids.length - 1)],
        grade: c.rng.next() < 0.5 ? 11 : 12,
        fee: c.s!.fee,
        discountFee: roundFee(c.s!.fee * 0.8),
      };
    },
    options: [
      {
        id: "discount",
        apply: (c) => {
          enrollSibling(c, Number(c.vars.discountFee));
          parentSat(c.s!, 5);
        },
      },
      {
        id: "fullPrice",
        apply: (c) => {
          if (c.rng.next() < 0.5) {
            enrollSibling(c, Number(c.vars.fee));
            c.outcome("enrolled");
          } else {
            parentSat(c.s!, -3);
            c.outcome("declined");
          }
        },
      },
      { id: "decline", apply: (c) => parentSat(c.s!, -2) },
    ],
    onExpire: (c) => parentSat(c.s!, -2),
  },
  {
    // Rakip kurum yardımcı koçunuzu ayartıyor (yalnız rakip hamlesiyle tetiklenir).
    id: "staffPoach",
    tone: "bad",
    weight: 0,
    cooldownDays: 60,
    deadlineDays: 3,
    when: (s) => s.staff.members.length > 0,
    vars: (c) => {
      const m = [...c.state.staff.members].sort((a, b) => b.skill - a.skill)[0];
      return { staffId: m.id, staffName: m.name, raise: Math.round((m.salary * 0.15) / 250) * 250, rival: COMPETITORS[0] };
    },
    options: [
      {
        id: "counter",
        cost: (c) => Number(c.vars.raise),
        apply: (c) => {
          const m = c.state.staff.members.find((x) => x.id === c.vars.staffId);
          if (!m) return c.outcome("gone");
          m.salary += Number(c.vars.raise);
          m.morale = Math.min(100, m.morale + 20);
        },
      },
      {
        id: "talk",
        hours: 1,
        apply: (c) => {
          const m = c.state.staff.members.find((x) => x.id === c.vars.staffId);
          if (!m) return c.outcome("gone");
          if (c.rng.next() < 0.3 + m.morale / 200) {
            m.morale = Math.min(100, m.morale + 10);
            c.outcome("stayed");
          } else {
            fireStaff(c.state, m.id, "quit");
            c.outcome("left");
          }
        },
      },
      { id: "letGo", apply: (c) => poachLeave(c) },
    ],
    onExpire: (c) => poachLeave(c),
  },
];

function poachLeave(c: Parameters<EventDef["onExpire"]>[0]): void {
  if (c.state.staff.members.some((x) => x.id === c.vars.staffId)) fireStaff(c.state, String(c.vars.staffId), "quit");
  c.outcome("left");
}

function letGo(c: Parameters<EventDef["onExpire"]>[0]): void {
  if (c.s!.parent.satisfaction < 55) {
    studentLeaves(c.state, c.s!, "competitor");
    c.outcome("lost");
  } else {
    parentSat(c.s!, -3);
    c.outcome("stayed");
  }
}

function enrollSibling(c: Parameters<EventDef["onExpire"]>[0], fee: number): void {
  enrollFromLead(c.state, { name: String(c.vars.sibling), archetype: String(c.vars.archetype), willingness: Number(c.vars.fee), source: "referral", grade: Number(c.vars.grade) === 11 ? 11 : 12 }, fee, c.rng);
}

export const EVENT_BY_ID: Record<string, EventDef> = Object.fromEntries(EVENTS.map((e) => [e.id, e]));
