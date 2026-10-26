// KUVAT LABS — Rota
// Sezon sonu raporu: ÜYS sonuçları, başarı oranı, sezonun gelir-gideri, itibar. Açıkken oyun durur.

import { CAREER } from "../content/career";
import { getLocale, tf, tk } from "../platform/i18n";
import { careerProgress, type CareerCard, type CareerResult } from "../sim/career";
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
#season-report button:focus-visible{outline:2px solid #ffd98a;outline-offset:2px}
/* kariyer: ara durum (1.-2. sezon raporu) */
#season-report .crow{display:flex;flex-wrap:wrap;gap:6px}
#season-report .crow span{background:#352a3d;border-radius:999px;padding:3px 10px;font-size:12px}
#season-report .crow span.ok{background:rgba(155,227,166,.14)}
/* kariyer finali: üç sezonun karnesi + kademe mührü */
#season-report:has(.fin){z-index:37}
#season-report .box.fin{width:min(560px,calc(100vw - 24px));padding:22px 24px 16px;font:500 14px/1.5 var(--font,system-ui),sans-serif;
  background:var(--panel-solid,#2e2334);border:1px solid var(--line,rgba(255,235,215,.1));border-radius:var(--radius,18px)}
#season-report .fhead{position:relative;min-height:128px;padding-right:138px}
#season-report .fhead h2{font-size:24px;line-height:1.15;margin:2px 0 6px;color:#f6d39a;letter-spacing:-.01em}
#season-report .fhead .muted{font-size:13px}
#season-report .stamp{--c:#f4bd62;position:absolute;right:4px;top:-4px;width:124px;height:124px;border-radius:50%;display:flex;flex-direction:column;
  align-items:center;justify-content:center;color:var(--c);border:3px solid var(--c);box-shadow:inset 0 0 0 5px var(--panel-solid,#2e2334),inset 0 0 0 7px var(--c);
  transform:rotate(-9deg);text-align:center;animation:stamp-in .5s cubic-bezier(.3,1.4,.5,1) .25s both}
#season-report .stamp .tn{font-size:23px;font-weight:900;line-height:1;text-transform:uppercase;letter-spacing:.06em}
#season-report .stamp .tc{font-size:11px;font-weight:800;margin-top:4px;opacity:.85}
#season-report .stamp.t-coach{--c:#c8b6c9}#season-report .stamp.t-bronze{--c:#e09a63}#season-report .stamp.t-silver{--c:#dfe4ee}#season-report .stamp.t-gold{--c:#f4bd62}
@keyframes stamp-in{0%{opacity:0;transform:rotate(-9deg) scale(2.1)}70%{opacity:1;transform:rotate(-9deg) scale(.95)}100%{opacity:1;transform:rotate(-9deg) scale(1)}}
#season-report .karne{width:100%;margin-top:10px;font-size:14px}
#season-report .karne th{font-size:12px;font-weight:700;color:var(--muted,#c8b6c9);border-bottom:1px solid var(--line,#3a3140)}
#season-report .karne td{padding:9px 6px;border-bottom:1px solid var(--line,#3a3140)}
#season-report .karne td.lb{font-weight:800}
#season-report .karne td.you{font-size:17px;font-weight:900}
#season-report .karne .mk{display:inline-flex;width:24px;height:24px;border-radius:50%;align-items:center;justify-content:center;font-weight:900;
  background:rgba(255,240,225,.07);color:var(--muted,#c8b6c9)}
#season-report .karne tr.ok .mk{background:rgba(155,232,174,.18);color:var(--good,#9be8ae)}
#season-report .karne tr.ok td.you{color:var(--good,#9be8ae)}
#season-report .note{margin-top:14px;padding:10px 14px;border-left:3px solid var(--accent,#f4bd62);background:rgba(255,240,225,.05);border-radius:0 12px 12px 0}
#season-report .note b{display:block;font-size:12px;color:var(--accent,#f4bd62);margin-bottom:2px}
#season-report .note p{margin:0;font-style:italic;color:var(--soft,#e9dcea)}
#season-report .tally{display:flex;gap:22px;margin-top:12px;flex-wrap:wrap}
#season-report .tally div{font-size:12.5px;color:var(--muted,#c8b6c9)}
#season-report .tally b{display:block;font-size:17px;color:var(--ink,#fbf1e4)}
#season-report .acts{display:flex;flex-wrap:wrap;gap:8px;margin-top:16px}
#season-report .acts button{margin:0;min-height:44px;font:800 14px var(--font,system-ui),sans-serif;border-radius:12px;padding:9px 16px}
#season-report .acts button.go{background:linear-gradient(180deg,#f8ca78,#e9a14a);color:#3a2410;box-shadow:0 3px 0 #b97a2e}
#season-report .acts button.alt{background:rgba(255,240,225,.12);color:var(--ink,#fbf1e4)}
#season-report .acts .cf{flex-basis:100%;font-size:13px;color:var(--soft,#e9dcea)}
#season-report details{margin-top:14px;border-top:1px solid var(--line,#3a3140);padding-top:8px}
#season-report summary{cursor:pointer;font-weight:700;color:var(--muted,#c8b6c9)}
#season-report .sign{display:flex;align-items:center;justify-content:flex-end;gap:6px;margin-top:14px;font-size:10.5px;color:var(--muted,#c8b6c9);opacity:.8}
#season-report .sign img{height:20px;width:auto;border-radius:3px}
@media (max-width:760px){
  #season-report:has(.fin){z-index:37}
#season-report .box.fin{padding:16px 16px 12px;max-height:calc(100vh - 24px)}
  #season-report .fhead{padding-right:100px;min-height:100px}
  #season-report .fhead h2{font-size:20px}
  #season-report .stamp{width:92px;height:92px;right:0}
  #season-report .stamp .tn{font-size:17px}
  #season-report .karne{font-size:13px}
  #season-report .karne td{padding:8px 4px}
  #season-report .acts button{flex:1 1 100%}
}
#season-report .stamp.still{animation:none}
@media (prefers-reduced-motion:reduce){#season-report .stamp{animation:none}}
`;

export class SeasonReportView {
  private readonly el: HTMLDivElement;
  private shown: SeasonReport | null = null;
  private locale = getLocale();
  /** final ekranında "Yeni oyun" onayı açık mı */
  private confirmNew = false;
  /** mühür yalnız ilk açılışta basılır (onay açılıp kapanınca tekrar oynamasın) */
  private stampedFor: SeasonReport | null = null;

  constructor(
    private readonly state: GameState,
    private readonly onClose: () => void,
    /** final ekranındaki "Yeni oyun" (ayarlar menüsüyle aynı akış) */
    private readonly onNewGame?: () => void,
  ) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "season-report";
    this.el.style.display = "none";
    this.el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button");
      if (!b) return;
      if (b.dataset.new) {
        this.confirmNew = b.dataset.new === "ask";
        if (b.dataset.new === "yes") return this.onNewGame?.();
        this.shown = null;
        this.render();
        this.el.querySelector<HTMLButtonElement>(this.confirmNew ? "button[data-new=no]" : "button[data-new=ask]")?.focus();
        return;
      }
      if (!b.dataset.close) return;
      this.confirmNew = false;
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
    if (!r) return;
    const still = this.stampedFor === r;
    this.stampedFor = r;
    this.el.innerHTML = r.career
      ? `<div class="box fin" role="dialog" aria-modal="true" aria-labelledby="fin-title">${finalHtml(this.state, r, r.career, this.confirmNew && !!this.onNewGame, !!this.onNewGame, still)}</div>`
      : `<div class="box">${reportHtml(this.state, r)}</div>`;
  }
}

/** Kartın değeri (oran yüzde, güven puan, büyüme şube sayısı). */
function cardVal(c: CareerCard, v: number): string {
  return tf(`career.val.${c.id}`, { v: c.id === "success" ? Math.round(v * 100) : Math.round(v) });
}

/** Kariyer finali: üç sezonun karnesi, kademe mührü, Buse'nin notu; altında bu sezonun raporu katlı. */
function finalHtml(state: GameState, r: SeasonReport, cr: CareerResult, confirm: boolean, canNew: boolean, still: boolean): string {
  const grads = state.season.reports.reduce((a, x) => a + x.results.length, 0);
  const worth = state.economy.personal + state.economy.business;
  const rows = cr.cards
    .map(
      (c) => `<tr class="${c.done ? "ok" : ""}"><td class="lb">${tk(`career.card.${c.id}`)}</td><td class="num">${cardVal(c, c.target)}</td>
        <td class="num you">${cardVal(c, c.value)}</td><td class="num"><span class="mk" aria-label="${tk(c.done ? "career.final.met" : "career.final.missed")}">${c.done ? "✓" : "–"}</span></td></tr>`,
    )
    .join("");
  const acts = confirm
    ? `<div class="cf" role="alert">${tk("play.confirmNew")}</div>
       <button class="alt" data-new="no">${tk("career.final.newNo")}</button><button class="go" data-new="yes">${tk("career.final.newYes")}</button>`
    : `<button class="go" data-close="1">${tf("career.final.continue", { n: state.season.index + 1 })}</button>
       ${canNew ? `<button class="alt" data-new="ask">${tk("career.final.new")}</button>` : ""}`;
  return `
    <div class="fhead">
      <div class="muted">${tf("career.final.kicker", { date: r.examIso })}</div>
      <h2 id="fin-title">${tk("career.final.title")}</h2>
      <div class="muted">${tk(`career.final.lead.${cr.tier}`)}</div>
      <div class="stamp t-${cr.tier}${still ? " still" : ""}" role="img" aria-label="${tf("career.final.stampAria", { tier: tk(`career.tier.${cr.tier}`), done: cr.done })}">
        <span class="tn">${tk(`career.tier.${cr.tier}`)}</span><span class="tc">${tf("career.final.cards", { done: cr.done, total: cr.cards.length })}</span></div>
    </div>
    <table class="karne"><tr><th>${tk("career.final.colCard")}</th><th class="num">${tk("career.final.colTarget")}</th><th class="num">${tk("career.final.colYou")}</th><th></th></tr>${rows}</table>
    <div class="note"><b>${tk("career.final.noteLabel")}</b><p>${tk(`career.final.note.${cr.tier}`)}</p></div>
    <div class="tally"><div><b>${grads}</b>${tk("career.final.graduates")}</div><div><b>${fmtMoney(worth)} ₺</b>${tk("career.final.worth")}</div></div>
    <div class="acts">${acts}</div>
    <div class="muted" style="font-size:12px;margin-top:8px">${tk("career.final.endless")}</div>
    <details><summary>${tf("career.final.details", { n: r.season + 1 })}</summary>${reportHtml(state, r, false)}</details>
    <div class="sign"><img src="${import.meta.env.BASE_URL}brand/kuvat-labs-logo.png" alt="${tk("career.sign")}" width="59" height="20"></div>`;
}

/** 1.-2. sezon raporunda kariyer kartlarının ara durumu. */
function interimHtml(state: GameState, r: SeasonReport): string {
  if (r.career || r.season >= CAREER.seasons - 1) return "";
  const cards = careerProgress(state, r.ourRate);
  const chips = cards.map((c) => `<span class="${c.done ? "ok" : ""}">${c.done ? "✓ " : ""}${tk(`career.card.${c.id}`)} ${c.id === "growth" ? Math.round(c.value) : cardVal(c, c.value)} / ${cardVal(c, c.target)}</span>`).join("");
  return `<h3>${tk("career.interim.title")}</h3><div class="crow">${chips}</div>
    <div class="muted" style="margin-top:4px">${tf("career.interim.left", { n: CAREER.seasons, date: examIso(CAREER.seasons - 1) })}</div>`;
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

export function reportHtml(state: GameState, r: SeasonReport, withClose = true): string {
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
    ${interimHtml(state, r)}
    <h3>${tk("report.finance")}</h3>
    <div class="muted">${tf("report.financeLine", { income: fmtMoney(r.income), expenses: fmtMoney(r.expenses) })}</div>
    <table>${cats}</table>
    <h3>${tk("report.next")}</h3>
    <div>${tf("report.nextLine", { date: next, days: daysUntil(state.hour, next), stage: tk(`growth.stage.${r.stage}`), staff: r.staff, certs: r.certs })}</div>
    <div class="muted">${tk("report.nextHint")} · ${calendarAt(state.hour).iso}</div>
    ${state.preference && !state.preference.open ? `<div>${tf("report.preference", { date: calendarAt(state.preference.opensAt).iso })}</div>` : ""}
    ${withClose ? `<button data-close="1">${tk("report.close")}</button>` : ""}`;
}
