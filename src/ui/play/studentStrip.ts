// Öğrenci şeridi (alt): her öğrenci bir kart — ruh hâli, kısa ipucu, son deneme eğilimi.
// Karta tıklayınca küçük bir pencere: sohbet, veliyle görüşme, takip koçu, ayrıntılar.

import { BALANCE } from "../../content/balance";
import { INSIGHT, INTERVIEW_TOPICS } from "../../content/interventions";
import { getLocale, tf, tk } from "../../platform/i18n";
import { errorText, interviewClueHtml, parentBefore, parentMeetingText } from "./decisions";
import { calendarAt } from "../../sim/calendar";
import { applyCommand } from "../../sim/commands";
import { insightOf, weeklySignals } from "../../sim/insight";
import { expectedNet } from "../../sim/exam";
import { targetNet } from "../../sim/season";
import { coaches } from "../../sim/staff";
import type { GameState } from "../../sim/state";
import type { StateStat, Student } from "../../sim/student";
import { moodLabel, moodOf, MOOD_ICON, parentFace } from "./common";

const css = `
#strip{position:fixed;left:12px;right:364px;bottom:12px;display:flex;gap:8px;overflow-x:auto;padding:8px;min-height:58px;align-items:stretch;z-index:15;
  scrollbar-width:none;overscroll-behavior-x:contain}
#strip::-webkit-scrollbar{display:none}
#strip .st{flex:none;width:170px;background:var(--card);border:2px solid transparent;border-radius:14px;padding:7px 10px;cursor:pointer;transition:border-color .15s,background .15s}
#strip .st:hover{background:var(--card-hi)}
#strip .st.sel{border-color:var(--accent);background:var(--card-hi)}
#strip .st .n{font-weight:800}
#strip .st .m{font-size:20px;float:right;line-height:1}
#strip .st .h{font-size:12px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#strip .empty{color:var(--muted);padding:8px 10px;align-self:center}
#strip .gb{height:6px;background:rgba(0,0,0,.28);border-radius:4px;overflow:hidden;margin-top:6px}
#strip .gb span{display:block;height:100%;border-radius:4px}
#strip .gl{font-size:11px;color:var(--muted);margin-top:3px}
#stpop{position:fixed;bottom:120px;width:330px;padding:14px;z-index:25;background:var(--panel-solid);max-height:calc(100vh - 140px);overflow:auto;overscroll-behavior:contain}
#stpop .t{font-weight:800;font-size:17px}
#stpop .row{margin:4px 0}
#stpop .btns{display:flex;flex-wrap:wrap;gap:6px;margin-top:10px}
#stpop .btns button{display:inline-flex;align-items:center}
#stpop button.on{background:var(--accent);color:#3a2410}
#stpop .mt{margin:6px 0}
#stpop .ml{display:flex;gap:6px;font-size:13px}
#stpop .gb{height:7px;background:rgba(0,0,0,.28);border-radius:4px;overflow:hidden;margin-top:3px}
#stpop .gb span{display:block;height:100%;border-radius:4px;transition:width .4s}
#stpop .res{margin-top:10px;background:var(--card-hi);border-radius:12px;padding:8px 10px;font-size:13px;font-weight:600}
#stpop .res.bad{color:var(--bad)}
#stpop .clue{margin-top:6px;font-weight:500;border-left:3px solid var(--good);padding-left:8px}
#stpop .clue.closed{border-left-color:var(--bad)}
#stpop .how{margin-top:10px;font-size:12px;color:var(--muted);line-height:1.4}
#strip .wk{font-size:11px;color:var(--muted);margin-top:3px;display:flex;gap:4px;align-items:center}
#strip .wk .gb{flex:1;margin:0;height:4px}
@media (max-width:760px){
  #strip{left:8px;right:8px;bottom:calc(var(--sheet-h,120px) + 14px);min-height:0;padding:6px;border-radius:16px}
  #strip:has(.empty){display:none}
  #strip .st{width:128px;padding:6px 8px}
  #strip .st .gl{display:none}
  #strip .st .h{font-size:11px}
  #stpop{left:8px!important;right:8px;width:auto;bottom:calc(var(--sheet-h,120px) + 14px);max-height:calc(100dvh - var(--sheet-h,120px) - 80px)}  #stpop .btns .det{display:none}
}
`;

/** Ortalama tanıma (%): koçun öğrenciyi ne kadar tanıdığı. */
function avgInsight(s: Student): number {
  const keys = [...new Set(Object.values(INTERVIEW_TOPICS).flat())];
  return Math.round(keys.reduce((a, k) => a + insightOf(s, k), 0) / keys.length);
}

/** Etiketli küçük ilerleme çubuğu. */
function meter(icon: string, label: string, pct: number, color = "var(--accent)"): string {
  return `<div class="mt"><div class="ml"><span>${icon}</span><span>${label}</span></div><div class="gb"><span style="width:${Math.max(0, Math.min(100, pct))}%;background:${color}"></span></div></div>`;
}

/** Görüşme konusu: en az tanınan alan (oyuncu konu seçmez). */
function bestTopic(s: Student): string {
  let best = "feelings", low = Infinity;
  for (const [topic, keys] of Object.entries(INTERVIEW_TOPICS)) {
    const v = keys.reduce((a, k) => a + insightOf(s, k as StateStat), 0) / keys.length;
    if (v < low) {
      low = v;
      best = topic;
    }
  }
  return best;
}

export class StudentStrip {
  private readonly el: HTMLDivElement;
  private readonly pop: HTMLDivElement;
  private selected: string | null = null;
  private lastKey = "";

  constructor(private readonly state: GameState, private readonly onDetails: (id: string) => void) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "strip";
    this.el.className = "pl pl-only";
    document.body.appendChild(this.el);
    this.pop = document.createElement("div");
    this.pop.id = "stpop";
    this.pop.className = "pl pl-only";
    this.pop.style.display = "none";
    document.body.appendChild(this.pop);

    this.el.addEventListener("click", (e) => {
      const c = (e.target as HTMLElement).closest<HTMLElement>("[data-st]");
      if (!c) return;
      this.selected = this.selected === c.dataset.st ? null : c.dataset.st!;
      this.result = null;
      this.render(true);
    });
    this.pop.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-a]");
      if (!b || !this.selected) return;
      e.preventDefault();
      this.act(b.dataset.a!, b.dataset.v);
      this.render(true);
    });
  }

  /** Şeritte seçili öğrenci (odada onunla seans gösterilir). */
  get selectedId(): string | null {
    return this.selected;
  }

  /** Odadaki karaktere tıklanınca: kartını aç. */
  select(id: string): void {
    if (this.selected !== id) this.result = null;
    this.selected = id;
    this.render(true);
  }

  /** Pencerede son eylemin sonucu (öğrenci değişince silinir; anlık bildirim gibi kaybolmaz). */
  private result: { id: string; html: string; bad: boolean } | null = null;

  private act(a: string, v?: string): void {
    const s = this.state;
    const id = this.selected!;
    const st = s.students.find((x) => x.id === id)!;
    const first = st.name.split(" ")[0];
    const week = calendarAt(s.hour).weekIndex;
    let r;
    switch (a) {
      case "chat": {
        const before = avgInsight(st);
        r = applyCommand(s, { type: "interview", studentId: id, topic: bestTopic(st) as keyof typeof INTERVIEW_TOPICS });
        if (r.ok) {
          const clue = interviewClueHtml(s, st, week);
          this.result = {
            id,
            bad: false,
            html: `${tf("res.chat", { name: first, from: before, to: avgInsight(st) })}${clue || `<div class="clue">💬 ${tk("clue.none")}</div>`}`,
          };
        }
        break;
      }
      case "parent": {
        const before = parentBefore(st, week);
        r = applyCommand(s, { type: "parentMeeting", studentId: id });
        if (r.ok) this.result = { id, bad: before.stale, html: parentMeetingText(st, before) };
        break;
      }
      case "coach":
        r = applyCommand(s, { type: "assignCoach", studentId: id, coachId: v === "me" ? null : v! });
        break;
      case "details":
        this.selected = null;
        this.onDetails(id);
        return;
      case "close":
        this.selected = null;
        return;
    }
    if (r && !r.ok) this.result = { id, bad: true, html: `⚠ ${errorText(r.error)}` };
  }

  render(force = false): void {
    const s = this.state;
    const now = s.hour;
    const active = s.students.filter((x) => !x.left);
    const day = Math.floor(now / 24);
    const key = `${active.map((x) => `${x.id}:${x.week.done}`).join(",")}|${day}|${this.selected}|${s.coach.usedThisWeek}|${this.result?.html}|${getLocale()}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;

    this.el.innerHTML = active.length
      ? active
          .map((st) => {
            const m = moodOf(st, now);
            const sig = weeklySignals(st)[0];
            const mocks = st.mocks;
            const trend = mocks.length >= 2 ? (mocks.at(-1)!.total >= mocks.at(-2)!.total ? "↗" : "↘") : "";
            const target = targetNet(st);
            const nowNet = Math.max(0, Math.round(expectedNet(st, now)));
            const pct = Math.min(100, Math.round((nowNet / target) * 100));
            return `<div class="st ${this.selected === st.id ? "sel" : ""}" data-st="${st.id}"><span class="m">${MOOD_ICON[m]}</span>
              <div class="n">${st.name.split(" ")[0]} ${trend}</div><div class="h">${sig ? `“${tk(sig)}”` : tk(`mood.${m}`)}</div>
              <div class="gb" title="${tf("goal.bar", { target, now: nowNet })}"><span style="width:${pct}%;background:${pct >= 100 ? "var(--good)" : "var(--accent)"}"></span></div>
              <div class="gl">${tf("goal.bar", { target, now: nowNet })}</div>
              <div class="wk" title="${tk("play.weekTasksTip")}">📚<div class="gb"><span style="width:${st.program.length ? Math.min(100, (st.week.done / st.program.length) * 100) : 0}%;background:#9fc6ff"></span></div>${st.week.done}/${st.program.length}</div></div>`;
          })
          .join("")
      : `<div class="empty">${tk("play.noStudents")}</div>`;

    const st = active.find((x) => x.id === this.selected);
    if (!st) {
      this.pop.style.display = "none";
      return;
    }
    // açılır pencere, seçili kartın üstünde
    const cardEl = this.el.querySelector<HTMLElement>(`[data-st="${st.id}"]`);
    const left = cardEl ? Math.min(cardEl.getBoundingClientRect().left, window.innerWidth - 380) : 12;
    this.pop.style.left = `${Math.max(12, left)}px`;
    this.pop.style.display = "block";
    const m = moodOf(st, now);
    const last = st.mocks.at(-1);
    const par = st.parent;
    const week = calendarAt(now).weekIndex;
    const staff = coaches(s);
    const coachBtns = staff.length
      ? `<div class="row muted">${tk("play.assign")}:</div><div class="btns">
          <button data-a="coach" data-v="me" class="${st.coachId ? "" : "on"}">${tk("panel.coachSelf")}</button>
          ${staff.map((x) => `<button data-a="coach" data-v="${x.id}" class="${st.coachId === x.id ? "on" : ""}">${x.name.split(" ")[0]}</button>`).join("")}</div>`
      : "";
    const chatted = st.lastInterviewWeek === week;
    const met = par.lastMeetingWeek === week;
    const stale = par.lastMeetingWeek !== null && week - par.lastMeetingWeek < BALANCE.parent.meetingFreshWeeks;
    const ins = avgInsight(st);
    const res = this.result?.id === st.id ? `<div class="res ${this.result.bad ? "bad" : ""}">${this.result.html}</div>` : "";
    this.pop.innerHTML = `<div class="t">${st.name}</div>
      <div class="row muted">${tf("play.grade", { n: st.grade })} · ${tk(`archetype.${st.archetype}`)}</div>
      <div class="row">${moodLabel(m)} · ${last ? tf("play.lastMock", { net: last.total.toFixed(1) }) : tk("play.noMock")}</div>
      ${meter("📚", tf("play.weekTasks", { done: st.week.done, total: st.program.length }), st.program.length ? (st.week.done / st.program.length) * 100 : 0)}
      ${meter("🔍", tf("play.insight", { v: ins }), ins, "#9fc6ff")}
      ${par.known ? meter(parentFace(par.satisfaction), tf("play.parentSat", { style: tk(`parent.style.${par.style}`), v: Math.round(par.satisfaction) }), par.satisfaction, par.satisfaction < 40 ? "var(--bad)" : "var(--good)") : `<div class="row muted">${tk("play.parentUnknown")}</div>`}
      ${coachBtns}
      <div class="btns">
        <button data-a="chat" ${chatted ? "disabled" : ""}>${tk("play.chat")}<span class="hint">${chatted ? tk("play.doneThisWeek") : tf("play.hours", { h: INSIGHT.interviewHours })}</span></button>
        <button data-a="parent" ${met ? "disabled" : ""}>${tk("play.meetParent")}<span class="hint">${met ? tk("play.doneThisWeek") : stale ? tk("play.halfEffect") : tf("play.hours", { h: BALANCE.parent.meetingHours })}</span></button>
        <button data-a="details" class="ghost det">${tk("play.details")}</button>
        <button data-a="close" class="ghost">✕</button>
      </div>
      ${res}
      <div class="how">${tk("play.howChat")}<br>${tf("play.howParent", { n: BALANCE.parent.meetingFreshWeeks })}</div>`;
  }
}
