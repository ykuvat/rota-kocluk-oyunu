// Komut deseni: arayüz ve girdi durumu yalnız komutlarla değiştirir. Aynı tohum + aynı komut dizisi = aynı sonuç;
// tekrar oynatma, hata ayıklama ve ileride simülasyonu Web Worker'a taşımak bu sayede kolaydır.

import { ARCHETYPES } from "../content/archetypes";
import { BALANCE } from "../content/balance";
import { TOPIC_BY_ID } from "../content/curriculum";
import { INSIGHT, INTERVENTIONS, INTERVIEW_TOPICS, type InterventionId } from "../content/interventions";
import { createRng } from "../core/rng";
import { calendarAt } from "./calendar";
import { addInsight } from "./insight";
import { holdParentMeeting } from "./parent";
import { ECONOMY, FUNNEL } from "../content/business";
import { transfer } from "./economy";
import { resolveEvent } from "./events";
import { activeCount, capacity, certEffect, conversionBonus, openBranch, rentOffice, startCert } from "./growth";
import { buyMachine, sellMachine } from "./machines";
import { assignCoach,fireStaff, hireStaff, raiseSalary } from "./staff";
import { closeReport } from "./season";
import { declinePreference, preferenceSession } from "./market";
import { marketConversion } from "./marketEffects";
import { conversionProbability, enrollFromLead } from "./funnel";
import { emit, findStudent, spendCoachHours, type GameState } from "./state";
import { applyIntervention } from "./intervention";
import { generateStudent, stat, type ProgramBlock } from "./student";

export type Command =
  | { type: "addStudent"; archetype: string }
  | { type: "setProgram"; studentId: string; blocks: ProgramBlock[] }
  | { type: "interview"; studentId: string; topic: keyof typeof INTERVIEW_TOPICS }
  | { type: "intervene"; studentId: string; intervention: InterventionId }
  | { type: "parentMeeting"; studentId: string }
  | { type: "introMeeting"; leadId: string; price: number }
  | { type: "declineLead"; leadId: string }
  | { type: "setMarketing"; networkActive: boolean; organicHours: number; paidBudget: number }
  | { type: "transfer"; amount: number }
  | { type: "resolveEvent"; eventId: string; optionId: string }
  | { type: "startCert"; certId: string }
  | { type: "rentOffice"; officeId: string }
  | { type: "openBranch"; branchId: string }
  | { type: "buyMachine"; def: string }
  | { type: "sellMachine"; id: string }
  | { type: "hireStaff"; candidateId: string }
  | { type: "fireStaff"; staffId: string }
  | { type: "raiseSalary"; staffId: string; amount: number }
  | { type: "assignCoach"; studentId: string; coachId: string | null }
  | { type: "closeReport" }
  | { type: "preferenceSession"; requestId: string; price: number }
  | { type: "declinePreference"; requestId: string };

export type CommandResult =
  | { ok: true; id?: string; matched?: boolean; enrolled?: boolean; outcome?: string }
  | { ok: false; error: string };

const fail = (error: string): CommandResult => ({ ok: false, error });

export function applyCommand(state: GameState, cmd: Command): CommandResult {
  if ("studentId" in cmd && findStudent(state, cmd.studentId)?.left) return fail("student.left");
  switch (cmd.type) {
    case "introMeeting": {
      const lead = state.leads.find((l) => l.id === cmd.leadId);
      if (!lead) return fail("lead.unknown");
      if (!(cmd.price >= ECONOMY.minFee && cmd.price <= ECONOMY.maxFee)) return fail("lead.badPrice");
      if (activeCount(state) >= capacity(state)) return fail("capacity.full");
      if (!spendCoachHours(state, FUNNEL.introMeetingHours)) return fail("coach.noTime");
      state.leads = state.leads.filter((l) => l !== lead);
      const rng = createRng(state.rng);
      const p = conversionProbability(lead, cmd.price, state.reputation.trust, conversionBonus(state) + marketConversion(state));
      const enrolled = rng.next() < p;
      if (!enrolled) {
        state.rng = rng.state();
        emit(state, "leadLost", { id: lead.id, price: cmd.price });
        return { ok: true, enrolled: false };
      }
      const s = enrollFromLead(state, lead, cmd.price, rng);
      state.rng = rng.state();
      return { ok: true, id: s.id, enrolled: true };
    }

    case "resolveEvent": {
      const r = resolveEvent(state, cmd.eventId, cmd.optionId);
      return r.ok ? { ok: true, outcome: r.outcome } : fail(r.error);
    }

    case "startCert": {
      const err = startCert(state, cmd.certId);
      return err ? fail(err) : { ok: true };
    }

    case "rentOffice": {
      const err = rentOffice(state, cmd.officeId);
      return err ? fail(err) : { ok: true };
    }

    case "openBranch": {
      const err = openBranch(state, cmd.branchId);
      return err ? fail(err) : { ok: true };
    }

    case "buyMachine": {
      const err = buyMachine(state, cmd.def);
      return err ? fail(err) : { ok: true };
    }

    case "sellMachine": {
      const err = sellMachine(state, cmd.id);
      return err ? fail(err) : { ok: true };
    }

    case "hireStaff": {
      const err = hireStaff(state, cmd.candidateId);
      return err ? fail(err) : { ok: true };
    }

    case "fireStaff": {
      const err = fireStaff(state, cmd.staffId);
      return err ? fail(err) : { ok: true };
    }

    case "raiseSalary": {
      const err = raiseSalary(state, cmd.staffId, cmd.amount);
      return err ? fail(err) : { ok: true };
    }

    case "preferenceSession": {
      const rng = createRng(state.rng);
      const r = preferenceSession(state, cmd.requestId, cmd.price, rng);
      state.rng = rng.state();
      return "error" in r ? fail(r.error) : { ok: true, enrolled: r.sold };
    }

    case "declinePreference": {
      const err = declinePreference(state, cmd.requestId);
      return err ? fail(err) : { ok: true };
    }

    case "closeReport": {
      closeReport(state);
      return { ok: true };
    }

    case "assignCoach": {
      const err = assignCoach(state, cmd.studentId, cmd.coachId);
      return err ? fail(err) : { ok: true };
    }

    case "declineLead": {
      if (!state.leads.some((l) => l.id === cmd.leadId)) return fail("lead.unknown");
      state.leads = state.leads.filter((l) => l.id !== cmd.leadId);
      return { ok: true };
    }

    case "setMarketing": {
      if (cmd.organicHours < 0 || cmd.organicHours > 20 || cmd.paidBudget < 0 || cmd.paidBudget > 50_000) return fail("marketing.invalid");
      state.marketing.networkActive = cmd.networkActive;
      state.marketing.organicHours = cmd.organicHours;
      state.marketing.paidBudget = cmd.paidBudget;
      return { ok: true };
    }

    case "transfer": {
      if (!Number.isFinite(cmd.amount) || cmd.amount === 0) return fail("transfer.invalid");
      return transfer(state, cmd.amount) ? { ok: true } : fail("transfer.insufficient");
    }

    case "parentMeeting": {
      const s = findStudent(state, cmd.studentId);
      if (!s) return fail("student.unknown");
      if (!spendCoachHours(state, BALANCE.parent.meetingHours)) return fail("coach.noTime");
      holdParentMeeting(s, calendarAt(state.hour).weekIndex, certEffect(state, "parentMeetingFactor"));
      emit(state, "parentMeeting", { id: s.id, satisfaction: s.parent.satisfaction });
      return { ok: true };
    }

    case "addStudent": {
      if (!ARCHETYPES[cmd.archetype]) return fail("archetype.unknown");
      const rng = createRng(state.rng);
      const id = `s${state.nextId++}`;
      const s = generateStudent(id, cmd.archetype, rng, calendarAt(state.hour).weekIndex);
      state.rng = rng.state();
      state.students.push(s);
      emit(state, "studentAdded", { id, name: s.name, archetype: s.archetype });
      return { ok: true, id };
    }

    case "setProgram": {
      const s = findStudent(state, cmd.studentId);
      if (!s) return fail("student.unknown");
      for (const b of cmd.blocks) {
        if (!TOPIC_BY_ID[b.topicId]) return fail("topic.unknown");
        if (b.weekday < 0 || b.weekday > 6 || b.hours <= 0 || b.hours > 8) return fail("program.invalidBlock");
      }
      s.program = cmd.blocks.map((b) => ({ ...b }));
      emit(state, "programSet", { id: s.id, blocks: s.program.length, hours: s.program.reduce((a, b) => a + b.hours, 0) });
      return { ok: true };
    }

    case "interview": {
      const s = findStudent(state, cmd.studentId);
      if (!s) return fail("student.unknown");
      const keys = INTERVIEW_TOPICS[cmd.topic];
      if (!keys) return fail("interview.unknownTopic");
      if (!spendCoachHours(state, INSIGHT.interviewHours)) return fail("coach.noTime");
      // güven düşükse öğrenci az açılır (GDD D5)
      const trust = stat(s, "trust", state.hour).value;
      addInsight(s, keys, INSIGHT.interviewGain * (0.4 + trust / 100) * certEffect(state, "insightFactor"));
      s.lastInterviewWeek = calendarAt(state.hour).weekIndex;
      emit(state, "interview", { id: s.id, topic: cmd.topic });
      return { ok: true };
    }

    case "intervene": {
      const s = findStudent(state, cmd.studentId);
      if (!s) return fail("student.unknown");
      const def = INTERVENTIONS[cmd.intervention];
      if (!def) return fail("intervention.unknown");
      if (def.minTrust !== undefined && stat(s, "trust", state.hour).value < def.minTrust) return fail("intervention.lowTrust");
      if (!spendCoachHours(state, def.hours)) return fail("coach.noTime");

      const { matched, cause } = applyIntervention(state, s, def, certEffect(state, "interventionFactor"));
      emit(state, "intervention", { id: s.id, intervention: def.id, matched, cause });
      return { ok: true, matched };
    }
  }
}
