// Olay gelen kutusu (üst orta): bekleyen olaylar ve seçenekleri, son gelişmeler. Durumu yalnız komutla değiştirir.

import { EVENT_BY_ID } from "../content/events";
import { getLocale, tf, tk } from "../platform/i18n";
import { HOURS_PER_DAY } from "../sim/calendar";
import { applyCommand } from "../sim/commands";
import { findStudent, type GameState } from "../sim/state";

const css = `
#inbox{position:fixed;left:50%;transform:translateX(-50%);top:12px;width:400px;max-height:calc(100vh - 40px);overflow:auto;
  color:#f3e9dc;font:13px/1.45 system-ui,sans-serif;box-sizing:border-box;pointer-events:none}
#inbox .card{pointer-events:auto;background:rgba(48,36,54,.96);border:1px solid #c9a96e;border-radius:8px;padding:10px 12px;margin-bottom:8px;
  box-shadow:0 4px 16px rgba(0,0,0,.35)}
#inbox .card h4{margin:0 0 4px;font-size:14px;color:#ffd98a}
#inbox .card .meta{color:#a99ab0;font-size:12px;margin-bottom:6px}
#inbox .opts{display:flex;flex-direction:column;gap:4px;margin-top:8px}
#inbox button{text-align:left;background:#4a3b52;color:#f3e9dc;border:1px solid #6b5876;border-radius:5px;padding:5px 8px;font:12px system-ui,sans-serif;cursor:pointer}
#inbox button:hover{background:#5d4a68}
#inbox .hint{color:#c9a96e;margin-left:6px}
#inbox .recent{pointer-events:auto;background:rgba(30,24,34,.85);border-radius:8px;padding:6px 10px;font-size:12px;color:#d8cbe0}
#inbox .recent div{margin:2px 0}
`;

import { fmtMoney as fmt, fmtVars, noticeText } from "./notices";

/** Oyun akarken bildirim olarak da gösterilen geçmiş kayıtları (diğerleri zaten anlık geri bildirimle gösterilir). */
const TOAST_TYPES = new Set(["eventFollowUp", "certEarned", "stageReached", "staffQuit", "staffHired", "studentLeft", "seasonEnded",
  "preferenceOpened", "preferenceClosed", "rivalMove", "rivalsBeaten", "questDone"]);

export class InboxPanel {
  private readonly el: HTMLDivElement;
  private lastKey = "";
  private seenLog = 0;

  constructor(private readonly state: GameState, private readonly onFeedback: (text: string, bad: boolean) => void) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "inbox";
    document.body.appendChild(this.el);
    this.seenLog = state.log.length;
    this.el.addEventListener("pointerdown", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-ev]");
      if (!btn) return;
      e.preventDefault();
      const p = this.state.events.pending.find((x) => x.id === btn.dataset.ev);
      const r = applyCommand(this.state, { type: "resolveEvent", eventId: btn.dataset.ev!, optionId: btn.dataset.opt! });
      if (!r.ok) this.onFeedback(tk(`error.${r.error}`), true);
      else if (p && r.outcome) this.onFeedback(tf(`ev.${p.def}.out.${r.outcome}`, fmtVars(p.vars)), false);
      this.render(true);
    });
  }

  /** Son çağrıdan bu yana gelen yeni olaylar ve bildirimler (oyun bunlarla duraklar / bildirim gösterir). */
  drainNew(): { arrived: string[]; notices: string[] } {
    const log = this.state.log;
    // günlük kırpıldıysa göstergeyi sınırla
    if (this.seenLog > log.length) this.seenLog = log.length;
    const fresh = log.slice(this.seenLog);
    this.seenLog = log.length;
    const arrived: string[] = [];
    const notices: string[] = [];
    for (const e of fresh) {
      if (e.type === "eventArrived") arrived.push(tf("inbox.new", { title: tk(`ev.${(e.data as { def: string }).def}.title`) }));
      const n = TOAST_TYPES.has(e.type) ? noticeText(this.state, e) : null;
      if (n) notices.push(n);
    }
    return { arrived, notices };
  }

  render(force = false): void {
    const s = this.state;
    const ev = s.events;
    const key = `${ev.pending.map((p) => p.id).join(",")}|${Math.floor(s.hour / HOURS_PER_DAY)}|${s.log.length}|${s.coach.usedThisWeek}|${getLocale()}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;

    const cards = ev.pending
      .map((p) => {
        const def = EVENT_BY_ID[p.def];
        if (!def) return "";
        const st = p.studentId ? findStudent(s, p.studentId) : undefined;
        const vars = fmtVars(p.vars);
        const days = Math.ceil((p.expiresHour - s.hour) / HOURS_PER_DAY);
        const deadline = days <= 1 ? tk("inbox.today") : tf("inbox.deadline", { n: days });
        const opts = def.options
          .map((o) => {
            const hints: string[] = [];
            if (o.hours) hints.push(`${o.hours} ${tk("panel.hours")}`);
            const cost = o.cost?.({ state: s, s: st, vars: p.vars });
            if (cost) hints.push(tf("inbox.cost", { v: fmt(cost) }));
            return `<button data-ev="${p.id}" data-opt="${o.id}">${tf(`ev.${def.id}.opt.${o.id}`, vars)}${hints.length ? `<span class="hint">· ${hints.join(" · ")}</span>` : ""}</button>`;
          })
          .join("");
        return `<div class="card"><h4>${tk(`ev.${def.id}.title`)}</h4><div class="meta">${deadline}</div>
          <div>${tf(`ev.${def.id}.body`, vars)}</div><div class="opts">${opts}</div></div>`;
      })
      .join("");

    // geçmiş ayrı panelde (H); burada yalnız süren eğitim hatırlatması
    const training = s.coach.training
      ? `<div class="recent">${tf("growth.training", { cert: tk(`cert.${s.coach.training.cert}`), n: s.coach.training.weeksLeft })}</div>`
      : "";
    this.el.innerHTML = cards + training;
  }
}
