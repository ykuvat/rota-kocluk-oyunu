// Olay günlüğü kayıtlarını oyuncuya gösterilecek tek satırlık metne çevirir (bildirim, geçmiş paneli).

import { EVENT_BY_ID } from "../content/events";
import { tf, tk } from "../platform/i18n";
import { findStudent, type GameState, type SimEvent } from "../sim/state";

export const fmtMoney = (v: number) => Math.round(v).toLocaleString("tr-TR");

/** Değişkenleri metne uygun biçimle (para birimleri binlik ayraçlı). */
export function fmtVars(vars: Record<string, number | string> | undefined): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [k, v] of Object.entries(vars ?? {})) out[k] = typeof v === "number" && v >= 1000 ? fmtMoney(v) : v;
  return out;
}

const nameOf = (state: GameState, d: Record<string, unknown>) => String(d.name ?? findStudent(state, String(d.id))?.name ?? "");

/** İlgisiz kayıtlar için null. */
export function noticeText(state: GameState, e: SimEvent): string | null {
  const d = e.data as Record<string, unknown>;
  const vars = fmtVars(d.vars as Record<string, number | string> | undefined);
  const title = () => tk(`ev.${d.def}.title`);
  switch (e.type) {
    case "eventArrived":
      return EVENT_BY_ID[String(d.def)] ? tf("inbox.new", { title: title() }) : null;
    case "eventResolved":
      return `${title()}: ${tf(`ev.${d.def}.out.${d.outcome}`, vars)}`;
    case "eventExpired":
      return tf("notice.eventExpired", { title: title() });
    case "eventFollowUp":
      return tf(`ev.${d.def}.out.${d.outcome}`, vars);
    case "certEarned":
      return tf("notice.certEarned", { cert: tk(`cert.${d.cert}`) });
    case "stageReached":
      return tk(`notice.stage${d.stage}`);
    case "staffQuit":
      return tf("notice.staffQuit", { name: String(d.name) });
    case "staffHired":
      // rolsüz eski kayıtlar yardımcı koçtur
      return tf("notice.staffHired", { name: String(d.name), role: tk(`role.${String(d.role ?? "coach")}`) });
    case "branchOpened":
      return tf("notice.branchOpened", { branch: tk(`branch.${d.branch}`) });
    case "staffFired":
      return tf("notice.staffFired", { name: String(d.name) });
    case "studentLeft":
      return tf("notice.studentLeft", { name: nameOf(state, d) });
    case "studentEnrolled":
      return tf("feedback.enrolled", { name: nameOf(state, d), fee: fmtMoney(Number(d.fee)) });
    case "parentWarning":
      return tf("notice.parentWarning", { name: nameOf(state, d) });
    case "personalDebt":
      return tf("notice.personalDebt", { v: fmtMoney(Number(d.personal)) });
    case "coachOverloaded":
      return tf("notice.coachOverloaded", { covered: Number(d.covered), total: Number(d.total) });
    case "examResult":
      return tf(d.goalMet ? "notice.examMet" : "notice.examMissed", {
        name: nameOf(state, d),
        net: Number(d.net).toFixed(2),
        rank: Number(d.rank).toLocaleString("tr-TR"),
        target: Number(d.target),
      });
    case "studentPromoted":
      return tf("notice.studentPromoted", { name: nameOf(state, d) });
    case "preferenceOpened":
      return tf("notice.preferenceOpened", { n: Number(d.requests) });
    case "preferenceClosed":
      return tf("notice.preferenceClosed", { sold: Number(d.sold), income: fmtMoney(Number(d.income)) });
    case "preferenceSold":
      return tf("notice.prefSold", { name: String(d.name), price: fmtMoney(Number(d.price)) });
    case "preferenceLost":
      return tf("notice.prefLost", { name: String(d.name) });
    case "rivalMove":
      return tf(`notice.rivalMove.${d.move}`, { rival: String(d.rival) });
    case "rivalsBeaten":
      return tf("notice.rivalsBeaten", { rate: Math.round(Number(d.rate) * 100) });
    case "rivalsLastPlace":
      return tf("notice.rivalsLastPlace", { rate: Math.round(Number(d.rate) * 100) });
    case "questDone":
      return tf("notice.questDone", { quest: tk(`quest.${d.quest}`) });
    case "gameOver":
      return tf("notice.gameOver", { worth: fmtMoney(Number(d.worth)) });
    case "seasonEnded":
      return tf("notice.seasonEnded", { n: Number(d.season) + 1, hits: Number(d.hits), total: Number(d.graduated) });
    default:
      return null;
  }
}

/** Kötü haber mi (renk için)? */
export function isBadNotice(e: SimEvent): boolean {
  const d = e.data as Record<string, unknown>;
  if (e.type === "examResult") return !d.goalMet;
  return ["studentLeft", "parentWarning", "personalDebt", "coachOverloaded", "staffQuit", "eventExpired", "rivalMove", "rivalsLastPlace"].includes(e.type)
    || (e.type === "eventFollowUp" && ["broken", "lost", "brokeAgain", "declined"].includes(String(d.outcome)));
}
