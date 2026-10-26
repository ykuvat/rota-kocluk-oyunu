// KUVAT LABS — Rota
// Sade üst bilgi: tarih, para (tek bakiye), itibar yıldızı, sezon amacı, hedefler ve küçük menü.
// Zaman düğmesi yok: hafta, sağdaki "Haftayı başlat" ile oynar.

import { CAREER } from "../../content/career";
import { CERT_BY_ID } from "../../content/growth";
import { QUEST_BY_ID } from "../../content/quests";
import { getLocale, tf, tk } from "../../platform/i18n";
import { careerProgress } from "../../sim/career";
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
#phud .career{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:8px}
#phud .career .cs{grid-column:1/-1;font-size:12.5px;font-weight:800;color:#f6d39a}
#phud .career .cc{font-size:14px;font-weight:800;background:var(--card);border-radius:12px;padding:5px 9px;color:var(--ink);line-height:1.25}
#phud .career .cc b{display:block;font-size:11.5px;font-weight:700;color:var(--muted)}
#phud .career .cc.ok{background:rgba(155,232,174,.16);color:var(--good)}
#phud .career .cc.ok b{color:var(--good)}
#phud .career .cc .pend{font-size:12px;font-weight:600;font-style:italic;color:var(--muted)}
#phud .career .cc .t{font-size:12px;font-weight:600;color:var(--muted)}
#phud .career .sh{display:none}
#phud .career .cc.tier{grid-column:1/-1;color:#3a2410;background:var(--c,var(--accent))}
#phud .career .cc.tier.t-coach{--c:#c8b6c9}#phud .career .cc.tier.t-bronze{--c:#e09a63}#phud .career .cc.tier.t-silver{--c:#dfe4ee}#phud .career .cc.tier.t-gold{--c:#f4bd62}
#phud .train{margin-top:8px;background:var(--card);border-radius:12px;padding:6px 10px;font-size:12.5px}
#phud .train .tl{display:flex;justify-content:space-between;gap:8px}
#phud .train .tb{height:6px;background:rgba(0,0,0,.28);border-radius:4px;overflow:hidden;margin-top:4px}
#phud .train .tb span{display:block;height:100%;background:#9fc6ff;border-radius:4px}
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
  #phud .career{display:flex;align-items:center;gap:4px;margin-top:4px;white-space:nowrap}
  #phud .career .cs{font-size:11.5px;margin-right:2px}
  #phud .career .cc{padding:1px 7px;font-size:11.5px;border-radius:999px;min-width:0}
  #phud .career .cc b{display:inline;font-size:11.5px;margin-right:3px}
  #phud .career .cc .pend{font-size:11.5px}
  #phud .career .cc .t,#phud .career .lg{display:none}
  #phud .career .sh{display:inline}
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
  /** ayarlar menüsü (dil, tarz, kaydet, yeni oyun) */
  onSettings(): void;
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
    this.el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-a]");
      if (!b) return;
      e.preventDefault();
      const a = b.dataset.a!;
      if (a === "company") this.c.onCompany();
      if (a === "history") this.c.onHistory();
      if (a === "details") this.c.onDetails();
      if (a === "goals") this.el.classList.toggle("gopen");
      if (a === "settings") this.c.onSettings();
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
    const tr = s.coach.training;
    const cert = tr ? CERT_BY_ID[tr.cert] : undefined;
    const key = `${cal.dayIndex}|${Math.round(money)}|${s.quests.length}|${stars}|${company}|${tr?.cert}:${tr?.weeksLeft}|${Math.round(s.reputation.trust)}|${s.branches.length}|${s.season.reports.length}|${s.season.index}|${getLocale()}`;
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
          <button data-a="history" class="ghost">${tk("play.history")}</button>
          <button data-a="settings" class="ghost" title="${tk("set.title")}" aria-label="${tk("set.title")}">☰</button>
        </div></div>
      <div class="bal"><span class="money ${money < 0 ? "neg" : ""}">💰 ${fmt(money)} ₺</span><span class="stars" title="${tk("play.rep")}">${"★".repeat(stars)}${"☆".repeat(5 - stars)}</span></div>
      <div class="sub">${tf("play.monthTrend", { v: `${trend >= 0 ? "+" : ""}${fmt(trend)}` })}</div>
      ${careerHtml(s)}
      ${tr && cert ? `<div class="train" title="${tk(`cert.effect.${cert.id}`)}"><div class="tl"><span>📖 ${tk(`cert.${cert.id}`)}</span><span>${tf("play.trainWeeks", { done: cert.weeks - tr.weeksLeft, total: cert.weeks })}</span></div>
        <div class="tb"><span style="width:${Math.round(((cert.weeks - tr.weeksLeft) / cert.weeks) * 100)}%"></span></div></div>` : ""}
      <div class="season">🎯 ${tf("season.goal", { n: Math.max(0, daysUntil(s.hour, examIso(s.season.index))) })}</div>
      ${goals.length ? `<div class="goals"><div class="gt">${tk("play.goals")}</div>${goals
        .map((q) => `<div class="g"><span>○ ${tk(`quest.${q.id}`)}</span><span class="r">${reward(q.id)}</span></div>`)
        .join("")}</div>` : ""}`;
  }
}

/** Kariyer göstergesi: "Sezon n/3" + üç küçük kart (eşik geçilince yeşil); final sonrası kazanılan kademe. Telefonda tek satır. */
function careerHtml(s: GameState): string {
  const fin = s.season.reports.find((r) => r.career)?.career;
  if (fin) {
    return `<div class="career" title="${tk("career.hud.tip")}"><span class="cs">${tf("career.hud.endless", { n: s.season.index + 1 })}</span>
      <span class="cc tier t-${fin.tier}">${tf("career.hud.tier", { tier: tk(`career.tier.${fin.tier}`) })}</span></div>`;
  }
  if (s.season.index >= CAREER.seasons) return "";
  const noExam = s.season.reports.length === 0;
  const val = (id: string, v: number) => tf(`career.val.${id}`, { v: id === "success" ? Math.round(v * 100) : Math.round(v) });
  const chips = careerProgress(s)
    .map((c) => {
      const label = tk(`career.card.${c.id}`);
      if (c.id === "success" && noExam) {
        return `<span class="cc" title="${label}: ${tk("career.hud.pending")}"><b>${label}</b><span class="pend"><span class="lg">${tk("career.hud.pending")}</span><span class="sh">${tk("career.hud.pendingShort")}</span></span></span>`;
      }
      const tip = `${label}: ${val(c.id, c.value)} / ${val(c.id, c.target)}`;
      return `<span class="cc ${c.done ? "ok" : ""}" title="${tip}" aria-label="${tip}"><b>${label}</b>${c.done ? "✓ " : ""}${c.id === "growth" ? Math.round(c.value) : val(c.id, c.value)}<span class="t"> / ${val(c.id, c.target)}</span></span>`;
    })
    .join("");
  return `<div class="career" title="${tk("career.hud.tip")}"><span class="cs">${tf("career.hud.season", { n: s.season.index + 1, total: CAREER.seasons })}</span>${chips}</div>`;
}