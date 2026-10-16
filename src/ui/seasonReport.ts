// Sezon sonu raporu: ÜYS sonuçları, başarı oranı, sezonun gelir-gideri, itibar. Açıkken oyun durur.

import { getLocale, tf, tk } from "../platform/i18n";
import { calendarAt, daysUntil } from "../sim/calendar";
import { applyCommand } from "../sim/commands";
import type { TxCategory } from "../sim/economy";
import { examIso, type SeasonReport } from "../sim/season";
import type { GameState } from "../sim/state";
import { fmtMoney } from "./notices";

const css = `
#season-report{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,10,20,.6);z-index:20}
#season-report .box{width:min(620px,calc(100vw - 32px));max-height:calc(100vh - 48px);overflow:auto;padding:18px 22px;color:#f3e9dc;
  background:#2a2131;border:1px solid #c9a96e;border-radius:10px;font:13px/1.5 system-ui,sans-serif;box-shadow:0 10px 40px rgba(0,0,0,.5)}
#season-report h2{margin:0 0 2px;font-size:18px;color:#ffd98a}
#season-report h3{margin:14px 0 6px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#c9a96e}
#season-report table{width:100%;border-collapse:collapse;font-size:12px}
#season-report th,#season-report td{text-align:left;padding:3px 6px;border-bottom:1px solid #3a3140}
#season-report td.num,#season-report th.num{text-align:right}
#season-report .ok{color:#9be3a6}
#season-report .bad{color:#ffb0b0}
#season-report .muted{color:#a99ab0}
#season-report .kpis{display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:8px}
#season-report .kpi{background:#352a3d;border-radius:6px;padding:6px 8px}
#season-report .kpi b{display:block;font-size:16px}
#season-report button{margin-top:14px;background:#c9a96e;color:#1d1722;border:0;border-radius:6px;padding:7px 14px;font:600 13px system-ui;cursor:pointer}
`;

export class SeasonReportView {
  private readonly el: HTMLDivElement;
  private shown: SeasonReport | null = null;
  private locale = getLocale();

  constructor(private readonly state: GameState, private readonly onClose: () => void) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "season-report";
    this.el.style.display = "none";
    this.el.addEventListener("click", (e) => {
      if (!(e.target as HTMLElement).closest("button[data-close]")) return;
      applyCommand(this.state, { type: "closeReport" });
      this.render();
      this.onClose();
    });
    document.body.appendChild(this.el);
  }

  get isOpen(): boolean {
    return this.state.season.pendingReport !== null || this.state.gameOver !== null;
  }

  render(): void {
    const go = this.state.gameOver;
    if (go) {
      if (this.el.dataset.over === "1" && this.locale === getLocale()) return;
      this.el.dataset.over = "1";
      this.locale = getLocale();
      this.el.style.display = "flex";
      this.el.innerHTML = `<div class="box"><h2>${tk("gameOver.title")}</h2>
        <div>${tf("gameOver.body", { date: calendarAt(go.hour).iso, worth: fmtMoney(go.worth) })}</div>
        <div class="muted" style="margin-top:8px">${tk("gameOver.hint")}</div></div>`;
      return;
    }
    const r = this.state.season.pendingReport;
    if (r === this.shown && this.locale === getLocale()) return;
    this.shown = r;
    this.locale = getLocale();
    this.el.style.display = r ? "flex" : "none";
    if (r) this.el.innerHTML = `<div class="box">${reportHtml(this.state, r)}</div>`;
  }
}

function rivalsHtml(r: SeasonReport): string {
  if (!r.rivals?.length) return "";
  const rows = [...r.rivals, ...(r.ourRate !== null ? [{ name: tk("report.us"), rate: r.ourRate, us: true }] : [])]
    .sort((a, b) => b.rate - a.rate)
    .map((x) => `<tr${"us" in x ? ' style="color:#ffd98a;font-weight:600"' : ""}><td>${x.name}</td><td class="num">%${Math.round(x.rate * 100)}</td></tr>`)
    .join("");
  const moves = (r.rivalMoves ?? []).map((m) => `<div>• <b>${m.rival}</b> ${tk(`report.move.${m.move}`)}</div>`).join("");
  return `<h3>${tk("report.rivals")}</h3><table>${rows}</table>${moves ? `<h3>${tk("report.rivalMoves")}</h3>${moves}` : ""}`;
}

export function reportHtml(state: GameState, r: SeasonReport): string {
  const hits = r.results.filter((x) => x.goalMet).length;
  const rate = r.results.length ? Math.round((hits / r.results.length) * 100) : 0;
  const gains = r.results.filter((x) => x.firstNet !== null).map((x) => x.net - x.firstNet!);
  const avgGain = gains.length ? gains.reduce((a, b) => a + b, 0) / gains.length : 0;
  const profit = r.income - r.expenses;

  const rows = [...r.results]
    .sort((a, b) => b.net - a.net)
    .map(
      (x) => `<tr><td>${x.name}</td><td class="num">${x.net.toFixed(2)}</td><td class="num">${x.firstNet === null ? "—" : (x.net - x.firstNet >= 0 ? "+" : "") + (x.net - x.firstNet).toFixed(1)}</td>
        <td class="num">${x.targetNet}</td><td class="num">${x.rank.toLocaleString("tr-TR")}</td><td class="${x.goalMet ? "ok" : "bad"}">${x.goalMet ? "✓" : "✗"}</td></tr>`,
    )
    .join("");
  const results = r.results.length
    ? `<table><tr><th>${tk("report.student")}</th><th class="num">${tk("report.net")}</th><th class="num">${tk("report.gain")}</th>
        <th class="num">${tk("report.target")}</th><th class="num">${tk("report.rank")}</th><th></th></tr>${rows}</table>`
    : `<div class="muted">${tk("report.noStudents")}</div>`;

  const cats = (Object.entries(r.byCategory) as [TxCategory, number][])
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .map(([k, v]) => `<tr><td>${tk(`cat.${k}`)}</td><td class="num ${v < 0 ? "bad" : "ok"}">${v > 0 ? "+" : ""}${fmtMoney(v)} ₺</td></tr>`)
    .join("");

  const next = examIso(state.season.index);
  const kpi = (label: string, value: string, cls = "") => `<div class="kpi"><span class="muted">${label}</span><b class="${cls}">${value}</b></div>`;
  return `
    <h2>${tf("report.title", { n: r.season + 1 })}</h2>
    <div class="muted">${tf("report.subtitle", { date: r.examIso })}</div>
    <h3>${tk("report.summary")}</h3>
    <div class="kpis">
      ${kpi(tk("report.successRate"), `${rate}%`, rate >= 60 ? "ok" : rate < 40 ? "bad" : "")}
      ${kpi(tk("report.avgGain"), `${avgGain >= 0 ? "+" : ""}${avgGain.toFixed(1)} net`)}
      ${kpi(tk("report.profit"), `${fmtMoney(profit)} ₺`, profit >= 0 ? "ok" : "bad")}
      ${kpi(tk("report.trust"), `${Math.round(r.trustStart)} → ${Math.round(r.trustEnd)}`, r.trustEnd >= r.trustStart ? "ok" : "bad")}
      ${kpi(tk("report.enrolled"), `${r.enrolled}`)}
      ${kpi(tk("report.leftEarly"), `${r.leftEarly}`, r.leftEarly ? "bad" : "")}
      ${kpi(tk("report.promoted"), `${r.promoted ?? 0}`)}
    </div>
    <h3>${tk("report.results")}</h3>${results}
    ${rivalsHtml(r)}
    <h3>${tk("report.finance")}</h3>
    <div class="muted">${tf("report.financeLine", { income: fmtMoney(r.income), expenses: fmtMoney(r.expenses) })}</div>
    <table>${cats}</table>
    <h3>${tk("report.next")}</h3>
    <div>${tf("report.nextLine", { date: next, days: daysUntil(state.hour, next), stage: tk(`growth.stage.${r.stage}`), staff: r.staff, certs: r.certs })}</div>
    <div class="muted">${tk("report.nextHint")} · ${calendarAt(state.hour).iso}</div>
    ${state.preference && !state.preference.open ? `<div>${tf("report.preference", { date: calendarAt(state.preference.opensAt).iso })}</div>` : ""}
    <button data-close="1">${tk("report.close")}</button>`;
}
