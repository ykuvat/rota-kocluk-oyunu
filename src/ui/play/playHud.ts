// Sade üst bilgi: tarih, para (tek bakiye), itibar yıldızı, sezon amacı, hedefler ve küçük menü.
// Zaman düğmesi yok: hafta, sağdaki "Haftayı başlat" ile oynar.

import { QUEST_BY_ID } from "../../content/quests";
import { getLocale, tf, tk } from "../../platform/i18n";
import { calendarAt, daysUntil } from "../../sim/calendar";
import { monthlyForecast } from "../../sim/economy";
import { openQuests } from "../../sim/quests";
import { examIso } from "../../sim/season";
import type { GameState } from "../../sim/state";
import { fmt } from "./common";

const css = `
#phud{position:fixed;left:12px;top:12px;width:360px;padding:10px 12px;background:var(--panel);border-radius:12px;z-index:20}
#phud .top{display:flex;justify-content:space-between;align-items:baseline}
#phud .date{font-weight:700}
#phud .money{font-size:22px;font-weight:800;margin:4px 0 0}
#phud .money.neg{color:var(--bad)}
#phud .row{display:flex;gap:6px;align-items:center;flex-wrap:wrap;margin-top:6px}
#phud .season{margin-top:6px;font-size:12px;color:#e6d9ea}
#phud .goals{margin-top:8px;border-top:1px solid var(--line);padding-top:6px}
#phud .goals .g{display:flex;justify-content:space-between;gap:8px;margin:3px 0}
#phud .goals .r{color:var(--accent);font-size:12px;white-space:nowrap}
#phud .gt{font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
#phud .menu{position:absolute;right:10px;top:34px;display:flex;gap:4px}
#phud .menu button{padding:3px 7px;font-size:12px}
`;

export interface HudControls {
  /** Kurum menüsü erken oyunda gizli (oyuncuyu boğmasın) */
  showCompany(): boolean;
  onCompany(): void;
  onHistory(): void;
  onDetails(): void;
}

export class PlayHud {
  private readonly el: HTMLDivElement;
  private lastKey = "";

  constructor(private readonly state: GameState, private readonly c: HudControls) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "phud";
    this.el.className = "pl pl-only";
    document.body.appendChild(this.el);
    this.el.addEventListener("pointerdown", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-a]");
      if (!b) return;
      e.preventDefault();
      const a = b.dataset.a!;
      if (a === "company") this.c.onCompany();
      if (a === "history") this.c.onHistory();
      if (a === "details") this.c.onDetails();
      this.render(true);
    });
  }

  render(force = false): void {
    const s = this.state;
    const cal = calendarAt(s.hour);
    const money = s.economy.personal + s.economy.business;
    const f = monthlyForecast(s);
    const trend = f.income - f.personalCosts - f.advertising - f.office;
    const stars = Math.max(1, Math.round(s.reputation.trust / 20));
    const goals = openQuests(s);
    const company = this.c.showCompany();
    const key = `${cal.dayIndex}|${Math.round(money)}|${s.quests.length}|${stars}|${company}|${getLocale()}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    const reward = (id: string) => {
      const q = QUEST_BY_ID[id];
      return q.money ? tf("quest.reward.money", { v: fmt(q.money) }) : tf("quest.reward.trust", { v: q.trust ?? 0 });
    };
    this.el.innerHTML = `
      <div class="top"><span class="date">${tk(`day.${cal.weekday}`)} · ${cal.day}.${cal.month}.${cal.year}</span>
        <span class="muted">${tf("play.week", { n: cal.weekIndex + 1 })}</span></div>
      <div class="menu">
        ${company ? `<button data-a="company">${tk("play.company")}</button>` : ""}
        <button data-a="history" class="ghost">${tk("play.history")}</button>
        <button data-a="details" class="ghost" title="${tk("play.details")}">⚙</button>
      </div>
      <div class="money ${money < 0 ? "neg" : ""}">💰 ${fmt(money)} ₺</div>
      <div class="muted">${tf("play.monthTrend", { v: `${trend >= 0 ? "+" : ""}${fmt(trend)}` })} · ${tk("play.rep")} ${"★".repeat(stars)}${"☆".repeat(5 - stars)}</div>
      <div class="season">🎯 ${tf("season.goal", { n: Math.max(0, daysUntil(s.hour, examIso(s.season.index))) })}</div>
      ${goals.length ? `<div class="goals"><div class="gt">${tk("play.goals")}</div>${goals
        .map((q) => `<div class="g"><span>☐ ${tk(`quest.${q.id}`)}</span><span class="r">${reward(q.id)}</span></div>`)
        .join("")}</div>` : ""}`;
  }
}
