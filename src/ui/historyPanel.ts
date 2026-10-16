// Bildirim geçmişi (H): önemli olayların tarihli listesi, yeniden eskiye. Simülasyonu yalnız okur.

import { getLocale, tf, tk } from "../platform/i18n";
import { calendarAt } from "../sim/calendar";
import type { GameState } from "../sim/state";
import { isBadNotice, noticeText } from "./notices";

const css = `
#history-btn{position:fixed;left:50%;transform:translateX(-50%);bottom:12px;background:rgba(30,24,34,.92);color:#f3e9dc;
  border:1px solid #6b5876;border-radius:16px;padding:5px 14px;font:12px system-ui,sans-serif;cursor:pointer}
#history-btn:hover{background:#4a3b52}
#history-btn .dot{display:inline-block;min-width:16px;margin-left:6px;padding:0 4px;border-radius:8px;background:#c9822b;color:#1d1722;font-weight:600}
#history{position:fixed;left:50%;transform:translateX(-50%);bottom:48px;width:440px;max-height:55vh;overflow:auto;padding:10px 12px;
  color:#f3e9dc;background:rgba(30,24,34,.96);border:1px solid #6b5876;border-radius:8px;font:12px/1.45 system-ui,sans-serif;box-sizing:border-box}
#history h3{margin:0 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#c9a96e}
#history .item{display:flex;gap:8px;padding:3px 0;border-bottom:1px solid #3a3140}
#history .when{flex:none;width:96px;color:#a99ab0}
#history .bad{color:#ffb0b0}
#history .filters button{background:#3a3140;color:#d8cbe0;border:1px solid #5a4a66;border-radius:4px;padding:2px 6px;margin:0 4px 6px 0;font:11px system-ui;cursor:pointer}
#history .filters button.on{background:#c9a96e;color:#1d1722}
`;

type Filter = "all" | "students" | "business" | "events";
const GROUPS: Record<Exclude<Filter, "all">, string[]> = {
  students: ["studentEnrolled", "studentLeft", "parentWarning", "examResult", "coachOverloaded"],
  business: ["certEarned", "stageReached", "staffHired", "staffQuit", "staffFired", "personalDebt", "seasonEnded"],
  events: ["eventArrived", "eventResolved", "eventExpired", "eventFollowUp"],
};

export class HistoryPanel {
  private readonly btn: HTMLButtonElement;
  private readonly el: HTMLDivElement;
  private open = false;
  private filter: Filter = "all";
  private seen: number;
  private lastKey = "";

  constructor(private readonly state: GameState) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.btn = document.createElement("button");
    this.btn.id = "history-btn";
    this.btn.addEventListener("click", () => this.toggle());
    document.body.appendChild(this.btn);
    this.el = document.createElement("div");
    this.el.id = "history";
    this.el.style.display = "none";
    this.el.addEventListener("pointerdown", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-filter]");
      if (!b) return;
      this.filter = b.dataset.filter as Filter;
      this.render(true);
    });
    document.body.appendChild(this.el);
    this.seen = state.history.length;
  }

  toggle(): void {
    this.open = !this.open;
    if (this.open) this.seen = this.state.history.length;
    this.render(true);
  }

  render(force = false): void {
    const h = this.state.history;
    if (this.open) this.seen = h.length;
    // kırpılmış geçmişte sayaç taşmasın
    if (this.seen > h.length) this.seen = h.length;
    const unread = h.length - this.seen;
    const key = `${h.length}|${this.open}|${this.filter}|${unread}|${getLocale()}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    this.btn.innerHTML = `${tk("history.title")} (H)${unread ? `<span class="dot">${unread}</span>` : ""}`;
    this.el.style.display = this.open ? "block" : "none";
    if (!this.open) return;

    const allowed = this.filter === "all" ? null : new Set(GROUPS[this.filter]);
    const items = h
      .filter((e) => !allowed || allowed.has(e.type))
      .slice(-120)
      .reverse()
      .map((e) => {
        const text = noticeText(this.state, e);
        if (!text) return "";
        const c = calendarAt(e.hour);
        const date = `${String(c.day).padStart(2, "0")}.${String(c.month).padStart(2, "0")}.${String(c.year).slice(2)}`;
        return `<div class="item"><span class="when">${date} ${String(c.hourOfDay).padStart(2, "0")}:00</span><span class="${isBadNotice(e) ? "bad" : ""}">${text}</span></div>`;
      })
      .join("");
    const filters = (["all", "students", "business", "events"] as Filter[])
      .map((f) => `<button data-filter="${f}" class="${f === this.filter ? "on" : ""}">${tk(`history.filter.${f}`)}</button>`)
      .join("");
    this.el.innerHTML = `<h3>${tk("history.title")}</h3><div class="filters">${filters}</div>${items || `<div class="item">${tf("history.empty", {})}</div>`}`;
  }
}
