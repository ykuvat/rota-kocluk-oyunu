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
#phud{position:fixed;left:12px;top:12px;width:340px;padding:12px 14px;z-index:20}
#phud .top{display:flex;justify-content:space-between;align-items:center;gap:8px}
#phud .date{font-weight:800;color:var(--soft)}
#phud .wk{font-size:12px;color:var(--muted);background:var(--card);border-radius:999px;padding:2px 9px}
#phud .bal{display:flex;align-items:center;justify-content:space-between;gap:8px;margin-top:6px}
#phud .money{font-size:24px;font-weight:800;letter-spacing:-.01em}
#phud .money.neg{color:var(--bad)}
#phud .sub{font-size:12.5px;color:var(--muted)}
#phud .stars{color:var(--accent);letter-spacing:1px}
#phud .season{margin-top:8px;font-size:12.5px;color:var(--soft);background:var(--card);border-radius:12px;padding:6px 10px}
#phud .goals{margin-top:8px}
#phud .goals .g{display:flex;justify-content:space-between;gap:8px;padding:5px 2px;border-radius:10px}
#phud .goals .r{color:var(--accent);font-size:12px;font-weight:700;white-space:nowrap}
#phud .gt{font-size:13px;font-weight:800;color:#f6d39a;margin-bottom:2px}
#phud .menu{display:flex;gap:4px}
#phud .menu button{padding:5px 10px;font-size:12px}
#phud .gbtn{display:none}
@media (max-width:760px){
  #phud{left:8px;right:8px;top:8px;width:auto;padding:8px 10px;border-radius:16px}
  #phud .top{flex-wrap:nowrap}
  #phud .date{font-size:12.5px;white-space:nowrap}
  #phud .wk{display:none}
  #phud .bal{margin-top:2px}
  #phud .money{font-size:19px}
  #phud .menu{gap:2px;flex:none}
  #phud .menu button{padding:5px 7px}
  #phud .date .wd{display:none}
  #phud .menu .det{display:none}
  #phud .gbtn{display:inline-block}
  #phud:not(.gopen) .season,#phud:not(.gopen) .goals{display:none}
}
`;

export interface HudControls {
  /** Kurum menüsü erken oyunda gizli (oyuncuyu boğmasın) */
  showCompany(): boolean;
  onCompany(): void;
  onHistory(): void;
  onDetails(): void;
  /** HUD yüksekliği değişti (mobilde hedefler açılıp kapandı): kamera yeniden ortalansın */
  onLayout?(): void;
  /** görsel tarz denemesi: şu anki tarz ve değiştir */
  artStyle?: string;
  onStyle?(): void;
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
      if (a === "goals") this.el.classList.toggle("gopen");
      if (a === "style") this.c.onStyle?.();
      this.render(true);
      this.c.onLayout?.();
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
      <div class="top"><span class="date"><span class="wd">${tk(`day.${cal.weekday}`)} · </span>${cal.day}.${cal.month}.${cal.year}</span>
        <span class="wk">${tf("play.week", { n: cal.weekIndex + 1 })}</span>
        <div class="menu">
          <button data-a="goals" class="gbtn ghost" title="${tk("play.goals")}">🎯${goals.length ? ` ${goals.length}` : ""}</button>
          ${company ? `<button data-a="company">${tk("play.company")}</button>` : ""}
          ${this.c.onStyle ? `<button data-a="style" class="ghost" title="${tk(this.c.artStyle === "cartoon" ? "play.style.toPixel" : "play.style.toCartoon")}">🎨</button>` : ""}
          <button data-a="history" class="ghost">${tk("play.history")}</button>
          <button data-a="details" class="ghost det" title="${tk("play.details")}">⚙</button>
        </div></div>
      <div class="bal"><span class="money ${money < 0 ? "neg" : ""}">💰 ${fmt(money)} ₺</span><span class="stars" title="${tk("play.rep")}">${"★".repeat(stars)}${"☆".repeat(5 - stars)}</span></div>
      <div class="sub">${tf("play.monthTrend", { v: `${trend >= 0 ? "+" : ""}${fmt(trend)}` })}</div>
      <div class="season">🎯 ${tf("season.goal", { n: Math.max(0, daysUntil(s.hour, examIso(s.season.index))) })}</div>
      ${goals.length ? `<div class="goals"><div class="gt">${tk("play.goals")}</div>${goals
        .map((q) => `<div class="g"><span>○ ${tk(`quest.${q.id}`)}</span><span class="r">${reward(q.id)}</span></div>`)
        .join("")}</div>` : ""}`;
  }
}
