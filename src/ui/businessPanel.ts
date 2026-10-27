// İşletme paneli (sol alt): adaylar, pazarlama, para. Durumu yalnız komutlarla değiştirir.

import { COACHING, ECONOMY, FUNNEL } from "../content/business";
import { BRANCHES, CERTS, OFFICES, STAGES } from "../content/growth";
import { MACHINES, MACHINE_BY_ID, MACHINE_SELL_RATIO } from "../content/machines";
import { errorText, roleDesc } from "./play/decisions";
import { machineBlocker, machineNet, machineSlots } from "../sim/machines";
import { activeCount, branchBlocker, branchTrust, capacity } from "../sim/growth";
import { STAFF } from "../content/staff";
import { caseload, visibleSkill } from "../sim/staff";
import { PREFERENCE } from "../content/season";
import { getLocale, tf, tk } from "../platform/i18n";
import { HOURS_PER_DAY } from "../sim/calendar";
import { applyCommand, type Command } from "../sim/commands";
import { coachHours, type GameState } from "../sim/state";

const css = `
#business-panel{position:fixed;left:12px;bottom:12px;width:340px;max-height:calc(100vh - 150px);overflow:auto;padding:10px 12px;
  color:#f3e9dc;background:rgba(30,24,34,.92);font:13px/1.45 system-ui,sans-serif;border-radius:8px;box-sizing:border-box}
#business-panel h3{margin:8px 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#c9a96e}
#business-panel .lead{background:#30273a;border-radius:6px;padding:6px 8px;margin-bottom:6px}
#business-panel .row{display:flex;gap:6px;align-items:center;margin-top:4px;flex-wrap:wrap}
#business-panel input{width:76px;background:#1d1722;color:#f3e9dc;border:1px solid #5a4a66;border-radius:4px;font:12px system-ui;padding:2px 4px}
#business-panel button{background:#4a3b52;color:#f3e9dc;border:1px solid #6b5876;border-radius:5px;padding:3px 8px;font:12px system-ui,sans-serif;cursor:pointer}
#business-panel button:hover{background:#5d4a68}
#business-panel .muted{color:#a99ab0}
#business-panel .tabs{display:flex;gap:4px}
#business-panel .tabs button.on{background:#c9a96e;color:#1d1722;border-color:#c9a96e}
#business-panel .eff{margin:2px 0}
#business-panel .lead.now{outline:2px solid #c9a96e}
#business-panel .tag.ok{color:#9be8ae;font-weight:700}
#business-panel .prog{flex:1}
#business-panel .pbar{height:8px;background:rgba(0,0,0,.3);border-radius:4px;overflow:hidden;margin-top:4px}
#business-panel .pbar span{display:block;height:100%;background:#f4bd62;border-radius:4px}
/* oyun modu "İşletme" sekmesi: kartlar, büyük adımlı seçimler, haftalık saat puantajı */
body.play #business-panel.open .bz{display:flex;flex-direction:column;gap:10px;margin-top:4px}
body.play #business-panel.open .bz .cd{background:var(--card);border-radius:14px;padding:12px 14px;min-width:0}
body.play #business-panel.open .bz .cd h4{margin:0 0 4px;font-size:15px;font-weight:800;color:var(--ink)}
body.play #business-panel.open .bz .what{margin:0 0 10px;color:var(--soft);font-size:13px}
body.play #business-panel.open .bz .note{margin:8px 0 0;font-size:13px;color:var(--muted)}
body.play #business-panel.open .bz .note.bad{color:var(--bad)}
body.play #business-panel.open .bz h3{margin:6px 0 0}
body.play #business-panel.open .bz .seg{display:flex;gap:6px}
body.play #business-panel.open .bz .seg button{flex:1 1 0;min-width:0;min-height:44px;padding:8px 4px;white-space:nowrap}
body.play #business-panel.open .bz .seg button.on{background:var(--accent);color:#3a2410}
body.play #business-panel.open .bz .row2{display:flex;justify-content:space-between;align-items:baseline;gap:8px}
body.play #business-panel.open .bz .row2 b{font-size:15px}
body.play #business-panel.open .bz .cap{height:10px;background:rgba(0,0,0,.28);border-radius:6px;overflow:hidden;margin-top:6px}
body.play #business-panel.open .bz .cap span{display:block;height:100%;background:var(--accent);border-radius:6px}
body.play #business-panel.open .bz .cap.full span{background:var(--bad)}
body.play #business-panel.open .bz .hrs{display:grid;grid-template-columns:repeat(20,1fr);gap:3px;margin:10px 0 8px}
body.play #business-panel.open .bz .hrs i{display:block;aspect-ratio:1;border-radius:3px;background:rgba(255,240,225,.10);transition:background .25s}
body.play #business-panel.open .bz .hrs i.f{background:var(--accent)}
body.play #business-panel.open .bz .hrs i.n{background:var(--good)}
body.play #business-panel.open .bz .hrs i.c{background:var(--soft)}
body.play #business-panel.open .bz .hrs i.x{background:repeating-linear-gradient(45deg,var(--bad) 0 3px,transparent 3px 6px);outline:1px solid var(--bad)}
body.play #business-panel.open .bz .lg{display:flex;flex-wrap:wrap;gap:4px 12px;font-size:12px;color:var(--soft)}
body.play #business-panel.open .bz .lg span::before{content:"";display:inline-block;width:9px;height:9px;border-radius:2px;margin-right:5px;vertical-align:-1px;background:var(--k)}
body.play #business-panel.open .bz .acc{display:grid;grid-template-columns:1fr 1fr;gap:8px}
body.play #business-panel.open .bz .acc > div{background:rgba(0,0,0,.18);border-radius:12px;padding:10px 12px;min-width:0}
body.play #business-panel.open .bz .acc .v{display:block;font-size:19px;font-weight:800;color:var(--ink);margin:2px 0}
body.play #business-panel.open .bz .acc .v.neg{color:var(--bad)}
body.play #business-panel.open .bz .acc small{display:block;color:var(--muted);font-size:12px;line-height:1.35}
body.play #business-panel.open .bz .mv{display:flex;flex-direction:column;gap:6px;margin-top:10px}
body.play #business-panel.open .bz .mv button{min-height:44px;text-align:left}
body.play #business-panel.open .bz .mach button{min-height:44px;width:100%;text-align:center}
body.play #business-panel.open .tabs button{min-height:40px}
@media (max-width:760px){body.play #business-panel.open .bz .seg button{font-size:13px}}
@media (prefers-reduced-motion:reduce){body.play #business-panel.open .bz .hrs i{transition:none}}
`;

const fmt = (v: number) => Math.round(v).toLocaleString("tr-TR");

/** Oyun modunda büyük adımlı pazarlama seçenekleri. */
const ORGANIC_STEPS = [0, 2, 4, 6] as const;
const PAID_STEPS = [0, 1_000, 2_500, 5_000] as const;
/** Kayıttaki değere en yakın seçenek (değer kendiliğinden değiştirilmez, yalnız "on" gösterilir). */
const nearest = (steps: readonly number[], v: number) => steps.reduce((a, b) => (Math.abs(b - v) < Math.abs(a - v) ? b : a));
const isPlay = () => document.body.classList.contains("play");

export class BusinessPanel {
  private readonly el: HTMLDivElement;
  private lastKey = "";
  private tab: "biz" | "growth" = "biz";
  /** aday başına oyuncunun yazdığı fiyat (yeniden çizimde kaybolmasın) */
  private readonly prices = new Map<string, number>();

  constructor(private readonly state: GameState, private readonly onFeedback: (text: string, bad: boolean) => void) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "business-panel";
    document.body.appendChild(this.el);
    this.el.addEventListener("click", (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-act]");
      if (!btn) return;
      e.preventDefault();
      this.act(btn.dataset);
    });
    this.el.addEventListener("input", (e) => {
      const inp = e.target as HTMLInputElement;
      if (inp.dataset.lead) this.prices.set(inp.dataset.lead, Number(inp.value));
    });
  }

  private act(d: DOMStringMap): void {
    const m = this.state.marketing;
    let cmd: Command | null = null;
    switch (d.act) {
      case "intro": {
        const lead = this.state.leads.find((l) => l.id === d.lead);
        const price = this.prices.get(d.lead!) ?? ECONOMY.suggestedFee;
        const r = applyCommand(this.state, { type: "introMeeting", leadId: d.lead!, price });
        if (!r.ok) this.onFeedback(tk(r.error === "coach.noTime" ? "error.coach.noTime.intro" : `error.${r.error}`), true);
        else if (r.enrolled) this.onFeedback(tf("feedback.enrolled", { name: lead!.name, fee: fmt(price) }), false);
        else this.onFeedback(tf("feedback.notEnrolled", { name: lead!.name }), true);
        this.render(true);
        return;
      }
      case "decline":
        cmd = { type: "declineLead", leadId: d.lead! };
        break;
      case "pref": {
        const req = this.state.preference?.requests.find((x) => x.id === d.lead);
        const price = this.prices.get(d.lead!) ?? PREFERENCE.suggestedPrice;
        const r = applyCommand(this.state, { type: "preferenceSession", requestId: d.lead!, price });
        if (!r.ok) this.onFeedback(tk(`error.${r.error}`), true);
        else if (req) this.onFeedback(tf(r.enrolled ? "notice.prefSold" : "notice.prefLost", { name: req.name, price: fmt(price) }), !r.enrolled);
        this.render(true);
        return;
      }
      case "prefDecline":
        cmd = { type: "declinePreference", requestId: d.lead! };
        break;
      case "network":
        cmd = { type: "setMarketing", networkActive: !m.networkActive, organicHours: m.organicHours, paidBudget: m.paidBudget };
        break;
      case "organic":
        cmd = { type: "setMarketing", networkActive: m.networkActive, organicHours: Math.max(0, Math.min(20, m.organicHours + Number(d.delta))), paidBudget: m.paidBudget };
        break;
      case "paid":
        cmd = { type: "setMarketing", networkActive: m.networkActive, organicHours: m.organicHours, paidBudget: Math.max(0, m.paidBudget + Number(d.delta)) };
        break;
      // oyun modu: segment düğmeleri doğrudan hedef değeri verir
      case "mkNet":
        cmd = { type: "setMarketing", networkActive: d.v === "1", organicHours: m.organicHours, paidBudget: m.paidBudget };
        break;
      case "mkOrg":
        cmd = { type: "setMarketing", networkActive: m.networkActive, organicHours: Number(d.v), paidBudget: m.paidBudget };
        break;
      case "mkPaid":
        cmd = { type: "setMarketing", networkActive: m.networkActive, organicHours: m.organicHours, paidBudget: Number(d.v) };
        break;
      case "draw":
        cmd = { type: "transfer", amount: 5_000 };
        break;
      case "deposit":
        cmd = { type: "transfer", amount: -5_000 };
        break;
      case "tab":
        this.tab = d.tab === "growth" ? "growth" : "biz";
        break;
      case "cert":
        cmd = { type: "startCert", certId: d.cert! };
        break;
      case "office":
        cmd = { type: "rentOffice", officeId: d.office! };
        break;
      case "branch":
        cmd = { type: "openBranch", branchId: d.branch! };
        break;
      case "mBuy":
        cmd = { type: "buyMachine", def: d.def! };
        break;
      case "mSell":
        cmd = { type: "sellMachine", id: d.mid! };
        break;
      case "hire":
        cmd = { type: "hireStaff", candidateId: d.cand! };
        break;
      case "fire":
        cmd = { type: "fireStaff", staffId: d.staff! };
        break;
      case "raise":
        cmd = { type: "raiseSalary", staffId: d.staff!, amount: 1_000 };
        break;
    }
    if (d.act === "close") this.el.classList.remove("open");
    if (cmd) {
      const r = applyCommand(this.state, cmd);
      if (!r.ok) this.onFeedback(errorText(r.error), true);
      else if (cmd.type === "startCert") {
        const c = CERTS.find((x) => x.id === (cmd as { certId: string }).certId)!;
        this.onFeedback(tf("res.certStarted", { cert: tk(`cert.${c.id}`), n: c.weeks, h: c.hoursPerWeek }), false);
      } else if (cmd.type === "buyMachine") this.onFeedback(tf("mach.bought", { name: tk(`machine.${cmd.def}`) }), false);
      else if (cmd.type === "sellMachine") {
        const def = MACHINE_BY_ID[d.def!];
        if (def) this.onFeedback(tf("mach.soldMsg", { name: tk(`machine.${def.id}`), v: fmt(def.price * MACHINE_SELL_RATIO) }), false);
      }
    }
    this.render(true);
  }

  render(force = false): void {
    const s = this.state;
    const m = s.marketing;
    const play = isPlay();
    // oyun modunda bakiye, kapasite ve takipçi de görünür: değişince yeniden çizilsin
    const extra = play
      ? `|p|${s.economy.business}|${s.economy.personal}|${capacity(s)}|${activeCount(s)}|${m.networkLeft}|${Math.round(m.followers)}|${coachHours(s)}|${s.machines.map((x) => x.def).join()}`
      : "";
    const key = `${this.tab}|${s.hour}|${s.leads.length}|${s.coach.usedThisWeek}|${m.organicHours}|${m.paidBudget}|${m.networkActive}|${getLocale()}${extra}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    // odakta bir fiyat kutusu varsa yazarken yeniden çizme
    if (!force && this.el.contains(document.activeElement) && document.activeElement?.tagName === "INPUT") return;

    const tabs = `<div class="tabs"><button data-act="tab" data-tab="biz" class="${this.tab === "biz" ? "on" : ""}">${tk(play ? "bizp.tab" : "biz.leads")}</button>
      <button data-act="tab" data-tab="growth" class="${this.tab === "growth" ? "on" : ""}">${tk("growth.title")}</button>
      <button data-act="close" class="x" aria-label="✕">✕</button></div>`;
    if (this.tab === "growth") {
      this.el.innerHTML = tabs + this.growthHtml();
      return;
    }
    if (play) {
      this.el.innerHTML = tabs + this.playBizHtml();
      return;
    }

    const active = s.students.filter((x) => !x.left).length;
    const leads = s.leads.length
      ? s.leads
          .map((l) => {
            const days = Math.max(0, Math.ceil((l.expiresHour - s.hour) / HOURS_PER_DAY));
            const price = this.prices.get(l.id) ?? ECONOMY.suggestedFee;
            return `<div class="lead"><b>${l.name}</b> · <span class="muted">${tf("panel.grade", { n: l.grade })} · ${tk(`source.${l.source}`)} · ${tf("biz.expires", { n: days })}</span>
              <div class="row"><input data-lead="${l.id}" type="number" min="${ECONOMY.minFee}" max="${ECONOMY.maxFee}" step="250" value="${price}">
              <span class="muted">${tk("biz.pricePerMonth")}</span>
              <button data-act="intro" data-lead="${l.id}">${tk("biz.intro")}</button>
              <button data-act="decline" data-lead="${l.id}">${tk("biz.decline")}</button></div></div>`;
          })
          .join("")
      : `<div class="muted">${tk("biz.noLeads")}</div>`;

    this.el.innerHTML = `${tabs}${this.preferenceHtml()}${this.rivalHtml()}
      <h3>${tk("biz.leads")} (${s.leads.length}) · ${tk("growth.capacity")} ${active}/${capacity(s)}</h3>${leads}
      <h3>${tk("biz.marketing")}</h3>
      <div class="row"><button data-act="network">${m.networkActive ? "☑" : "☐"} ${tk("biz.network")}</button>
        <span class="muted">${m.networkLeft} ${tk("biz.networkLeft")}</span></div>
      <div class="row">${tk("biz.organic")}: <button data-act="organic" data-delta="-1">−</button> ${m.organicHours} ${tk("panel.hours")}
        <button data-act="organic" data-delta="1">+</button> <span class="muted">${fmt(m.followers)} ${tk("biz.followers")}</span></div>
      <div class="row">${tk("biz.paid")}: <button data-act="paid" data-delta="-250">−</button> ${fmt(m.paidBudget)} ₺
        <button data-act="paid" data-delta="250">+</button></div>
      <div class="row muted">${tk("biz.capacity")}: ${caseload(s, undefined)} × ${COACHING.followUpHours} ${tk("panel.hours")} (${tk("hud.coachHours")} ${coachHours(s)})</div>
      <div class="row"><button data-act="draw">${tk("biz.draw")}</button><button data-act="deposit">${tk("biz.deposit")}</button></div>`;
  }

  /** Oyun modu "İşletme" sekmesi: kapasite + haftalık saat puantajı, pazarlama kartları, para, tercih/rakip. */
  private playBizHtml(): string {
    const s = this.state;
    const m = s.marketing;

    // haftalık saat puantajı: her kare bir koç saati
    const total = coachHours(s);
    const follow = caseload(s, undefined) * COACHING.followUpHours;
    const net = m.networkActive && m.networkLeft > 0 ? FUNNEL.networkHours : 0;
    const content = m.organicHours;
    const planned = follow + net + content;
    const over = Math.max(0, planned - total);
    const cells: string[] = [];
    for (let i = 0; i < Math.max(total, planned); i++) {
      const c = i >= total ? "x" : i < follow ? "f" : i < follow + net ? "n" : i < planned ? "c" : "";
      cells.push(`<i class="${c}"></i>`);
    }
    const legend = `<div class="lg"><span style="--k:var(--accent)">${tf("bizp.follow", { h: follow })}</span>
      <span style="--k:var(--good)">${tf("bizp.network", { h: net })}</span><span style="--k:var(--soft)">${tf("bizp.content", { h: content })}</span>
      <span style="--k:rgba(255,240,225,.22)">${tf("bizp.free", { h: Math.max(0, total - planned) })}</span></div>`;

    const active = activeCount(s);
    const cap = capacity(s);
    const full = active >= cap;
    const leads = s.leads.length ? tf("bizp.leadsWaiting", { n: s.leads.length }) : tk("bizp.leadsNone");
    const week = `<div class="cd">
      <div class="row2"><h4>${tk("bizp.seats")}</h4><b>${tf("bizp.seatsVal", { n: active, max: cap })}</b></div>
      <div class="cap ${full ? "full" : ""}" role="img" aria-label="${tf("bizp.seatsVal", { n: active, max: cap })}"><span style="width:${Math.min(100, Math.round((active / Math.max(1, cap)) * 100))}%"></span></div>
      ${full ? `<p class="note bad">${tk("bizp.full")}</p>` : ""}<p class="note">${leads}</p>
      <h4 style="margin-top:14px">${tk("bizp.week")}</h4><p class="what">${tk("bizp.weekHint")}</p>
      <div class="hrs" aria-hidden="true">${cells.join("")}</div>${legend}
      ${over ? `<p class="note bad">${tf("bizp.over", { h: over })}</p>` : ""}</div>`;

    // segment düğmeleri: kayıttaki değer seçeneklerden biri değilse en yakını "on"
    const seg = (act: string, steps: readonly number[], cur: number, label: (v: number) => string) => {
      const on = nearest(steps, cur);
      return `<div class="seg" role="group">${steps
        .map((v) => `<button data-act="${act}" data-v="${v}" class="${v === on ? "on" : ""}" aria-pressed="${v === on}">${label(v)}</button>`)
        .join("")}</div>`;
    };
    const offStep = (steps: readonly number[], cur: number, text: string) => (steps.includes(cur) ? "" : `<p class="note">${tf("bizp.current", { v: text })}</p>`);

    const netCard = `<div class="cd"><h4>${tk("bizp.netTitle")}</h4><p class="what">${tk("bizp.netWhat")}</p>
      <div class="seg" role="group"><button data-act="mkNet" data-v="1" class="${m.networkActive ? "on" : ""}" aria-pressed="${m.networkActive}">${tk("bizp.on")}</button>
      <button data-act="mkNet" data-v="0" class="${m.networkActive ? "" : "on"}" aria-pressed="${!m.networkActive}">${tk("bizp.off")}</button></div>
      <p class="note">${m.networkLeft > 0 ? tf("bizp.netLeft", { n: m.networkLeft }) : tk("bizp.netEmpty")}</p></div>`;
    const orgCard = `<div class="cd"><h4>${tk("bizp.contentTitle")}</h4><p class="what">${tk("bizp.contentWhat")}</p>
      ${seg("mkOrg", ORGANIC_STEPS, m.organicHours, (v) => tf("bizp.hoursOpt", { h: v }))}
      ${offStep(ORGANIC_STEPS, m.organicHours, tf("bizp.hoursOpt", { h: m.organicHours }))}
      <p class="note">${tf("bizp.followers", { n: fmt(m.followers) })}</p></div>`;
    const paidCard = `<div class="cd"><h4>${tk("bizp.adsTitle")}</h4><p class="what">${tk("bizp.adsWhat")}</p>
      ${seg("mkPaid", PAID_STEPS, m.paidBudget, (v) => `${fmt(v)} ₺`)}
      ${offStep(PAID_STEPS, m.paidBudget, `${fmt(m.paidBudget)} ₺`)}
      ${m.paidBudget > 0 ? `<p class="note">${tf("bizp.adsMonth", { v: fmt(m.paidBudget * 4.3) })}</p>` : ""}</div>`;

    const e = s.economy;
    const money = `<div class="cd"><div class="acc">
      <div><small>${tk("bizp.bizAcc")}</small><span class="v ${e.business < 0 ? "neg" : ""}">${fmt(e.business)} ₺</span><small>${tk("bizp.bizAccWhat")}</small></div>
      <div><small>${tk("bizp.meAcc")}</small><span class="v ${e.personal < 0 ? "neg" : ""}">${fmt(e.personal)} ₺</span><small>${tk("bizp.meAccWhat")}</small></div></div>
      ${e.personal < 0 ? `<p class="note bad">${tk("bizp.debt")}</p>` : ""}
      <div class="mv"><button data-act="draw">${tk("bizp.draw")}</button><button data-act="deposit">${tk("bizp.deposit")}</button></div></div>`;

    return `<div class="bz">${week}<h3>${tk("bizp.marketing")}</h3>${netCard}${orgCard}${paidCard}
      <h3>${tk("bizp.money")}</h3>${money}${this.machinesHtml()}${this.playPrefHtml()}${this.playRivalHtml()}</div>`;
  }

  /** Makineler: yuva göstergesi, her makine için kart (ne yapar, bedel, şu anki öğrenci sayısıyla haftalık net), Al / Sat. */
  private machinesHtml(): string {
    const s = this.state;
    const slots = machineSlots(s);
    if (!slots) return `<h3>${tk("mach.title")}</h3><div class="cd"><p class="note" style="margin:0">${tk("mach.home")}</p></div>`;
    const students = activeCount(s);
    const head = `<div class="cd"><div class="row2"><h4>${tk("mach.title")}</h4><b>${tf("mach.slots", { n: s.machines.length, max: slots })}</b></div>
      <div class="cap ${s.machines.length >= slots ? "full" : ""}" role="img" aria-label="${tf("mach.slots", { n: s.machines.length, max: slots })}"><span style="width:${Math.round((s.machines.length / slots) * 100)}%"></span></div></div>`;
    const cards = MACHINES.filter((def) => !def.onlyOffice || def.onlyOffice === s.office)
      .map((def) => {
        const own = s.machines.find((x) => x.def === def.id);
        const net = Math.round(machineNet(def, students));
        const netText = net >= 0 ? tf("mach.net", { v: fmt(net) }) : tf("mach.netNeg", { v: fmt(-net) });
        const payback = !own && net > 0 ? `<br>${tf("mach.payback", { n: Math.ceil(def.price / net) })}` : "";
        let action: string;
        if (own) action = `<button data-act="mSell" data-mid="${own.id}" data-def="${def.id}">${tf("mach.sell", { v: fmt(def.price * MACHINE_SELL_RATIO) })}</button>`;
        else {
          const err = machineBlocker(s, def.id);
          action = err ? `<p class="note bad" style="margin:0">${tk(`error.${err}`)}</p>` : `<button data-act="mBuy" data-def="${def.id}">${tk("mach.buy")} · ${fmt(def.price)} ₺</button>`;
        }
        return `<div class="cd mach ${own ? "own" : ""}"><div class="row2"><h4>${tk(`machine.${def.id}`)}</h4>${own ? `<span class="tag ok">✔ ${tk("mach.mine")}</span>` : ""}</div>
          <p class="what">${tk(`machine.what.${def.id}`)}</p>
          <p class="note" style="margin:0 0 8px">${tf("mach.price", { v: fmt(def.price), u: fmt(def.upkeepWeekly) })}<br>${netText}${payback}</p>${action}</div>`;
      })
      .join("");
    return `<h3>${tk("mach.title")}</h3>${head}${cards}`;
  }

  /** Tercih dönemi özeti (talepler Kararlar kartlarında; burada fiyat kutusu yok). */
  private playPrefHtml(): string {
    const s = this.state;
    const p = s.preference;
    if (!p) return "";
    if (!p.open) return `<h3>${tk("pref.title")}</h3><div class="cd"><p class="note" style="margin:0">${tf("pref.waiting", { n: Math.ceil((p.opensAt - s.hour) / HOURS_PER_DAY) })}</p></div>`;
    const left = Math.max(0, Math.ceil((p.closesAt - s.hour) / HOURS_PER_DAY));
    return `<h3>${tk("pref.title")}</h3><div class="cd"><div class="row2"><b>${tf("pref.summary", { sold: p.sold, income: fmt(p.income) })}</b>
      <span class="muted">${tf("pref.closes", { n: left })}</span></div>
      <p class="note">${p.requests.length ? tf("bizp.prefOpen", { n: p.requests.length }) : tk("pref.none")}</p></div>`;
  }

  private playRivalHtml(): string {
    const s = this.state;
    const live = s.market.effects.filter((e) => e.until > s.hour);
    if (!live.length) return "";
    return `<h3>${tk("rival.effects")}</h3>${live
      .map((e) => `<div class="cd"><p class="note" style="margin:0;color:var(--soft)">${tf(`rival.effect.${e.kind}`, { rival: e.rival, n: Math.ceil((e.until - s.hour) / (7 * HOURS_PER_DAY)) })}</p></div>`)
      .join("")}`;
  }

  private growthHtml(): string {
    const s = this.state;
    const st = STAGES.stage2;
    const next = s.stage === 1 ? `<div class="muted">${tf("growth.nextStage", { students: st.activeStudents, trust: st.trust, tuition: fmt(st.tuitionTotal) })}</div>` : "";
    const certs = CERTS.map((c) => {
      const owned = s.coach.certs.includes(c.id);
      const tr = s.coach.training;
      const inTraining = tr?.cert === c.id;
      let action: string;
      if (owned) action = `<span class="tag ok">✔ ${tk("growth.owned")}</span>`;
      else if (inTraining) {
        const doneWeeks = c.weeks - tr!.weeksLeft;
        action = `<div class="prog"><div class="pl-l">${tf("growth.trainingBar", { done: doneWeeks, total: c.weeks, n: tr!.weeksLeft })}</div>
          <div class="pbar"><span style="width:${Math.round((doneWeeks / c.weeks) * 100)}%"></span></div></div>`;
      } else if (tr) action = `<span class="muted">${tk("growth.oneAtATime")}</span>`;
      else action = `<button data-act="cert" data-cert="${c.id}">${tk("growth.start")}</button>`;
      return `<div class="lead ${inTraining ? "now" : ""}"><b>${tk(`cert.${c.id}`)}</b><div class="eff">${tk(`cert.effect.${c.id}`)}</div>
        <div class="muted">${tf("growth.certInfo", { cost: fmt(c.cost), hours: c.hoursPerWeek, weeks: c.weeks })}</div><div class="row">${action}</div></div>`;
    }).join("");
    let office: string;
    if (s.office) office = `<div>${tf("growth.officeNow", { office: tk(`office.${s.office}`) })}</div>`;
    else if (s.stage < 2) office = `<div class="muted">${tk("growth.officeLocked")}</div>`;
    else
      office = OFFICES.map(
        (o) => `<div class="lead"><b>${tk(`office.${o.id}`)}</b>
          <div class="row"><span class="muted">${tf("growth.officeInfo", { rent: fmt(o.rent), util: fmt(o.utilities), upfront: fmt(o.rent * o.depositMonths + o.setup), cap: o.capacity })}</span>
          <button data-act="office" data-office="${o.id}">${tk("growth.rent")}</button></div></div>`,
      ).join("");
    // sertifikalar en sık bakılan bölüm: üstte
    return `<h3>${tk("growth.stage")}</h3><div>${tk(`growth.stage.${s.stage}`)} · ${tk("growth.capacity")} ${activeCount(s)}/${capacity(s)}</div>${next}
      <h3>${tk("growth.certs")}</h3><div class="muted">${tk("growth.certHow")}</div>${certs}
      <h3>${tk("growth.office")}</h3>${office}${this.branchHtml()}<h3>${tk("staff.title")}</h3>${this.staffHtml()}`;
  }

  /** Şubeler (Aşama 4): açılanlar ve açılış koşulları. */
  private branchHtml(): string {
    const s = this.state;
    if (!s.office) return "";
    const t = STAGES.branch;
    const rows = BRANCHES.map((b) => {
      if (s.branches.includes(b.id)) return `<div class="lead"><b>${tk(`branch.${b.id}`)}</b> · <span class="muted">${tf("growth.branchOpen", { cap: b.capacity })}</span></div>`;
      const err = branchBlocker(s, b.id);
      const action = err ? `<span class="muted">${tk(`error.${err}`)}</span>` : `<button data-act="branch" data-branch="${b.id}">${tk("play.openBranch")}</button>`;
      return `<div class="lead"><b>${tk(`branch.${b.id}`)}</b>
        <div class="row"><span class="muted">${tf("growth.officeInfo", { rent: fmt(b.rent), util: fmt(b.utilities), upfront: fmt(b.rent * b.depositMonths + b.setup), cap: b.capacity })}</span>${action}</div></div>`;
    }).join("");
    return `<h3>${tk("growth.branches")}</h3><div class="muted">${tf("growth.branchRule", { trust: branchTrust(s), fill: Math.round(t.fillRatio * 100), months: t.reserveMonths })}</div>${rows}`;
  }

  /** ÜYS sonrası tercih danışmanlığı talepleri. */
  private preferenceHtml(): string {
    const s = this.state;
    const p = s.preference;
    if (!p) return "";
    if (!p.open) return `<h3>${tk("pref.title")}</h3><div class="muted">${tf("pref.waiting", { n: Math.ceil((p.opensAt - s.hour) / HOURS_PER_DAY) })}</div>`;
    const left = Math.max(0, Math.ceil((p.closesAt - s.hour) / HOURS_PER_DAY));
    const reqs = p.requests.length
      ? p.requests
          .map((r) => {
            const price = this.prices.get(r.id) ?? PREFERENCE.suggestedPrice;
            return `<div class="lead"><b>${r.name}</b> · <span class="muted">${tk(r.source === "graduate" ? "pref.graduate" : "pref.external")} · ${tf("pref.rank", { rank: r.rank.toLocaleString("tr-TR") })}</span>
              <div class="row"><input data-lead="${r.id}" type="number" min="500" max="20000" step="250" value="${price}"><span class="muted">₺</span>
              <button data-act="pref" data-lead="${r.id}">${tk("pref.session")}</button><button data-act="prefDecline" data-lead="${r.id}">${tk("biz.decline")}</button></div></div>`;
          })
          .join("")
      : `<div class="muted">${tk("pref.none")}</div>`;
    return `<h3>${tk("pref.title")} · ${tf("pref.closes", { n: left })}</h3><div class="muted">${tf("pref.summary", { sold: p.sold, income: fmt(p.income) })}</div>${reqs}`;
  }

  private rivalHtml(): string {
    const s = this.state;
    const live = s.market.effects.filter((e) => e.until > s.hour);
    if (!live.length) return "";
    return `<h3>${tk("rival.effects")}</h3>${live
      .map((e) => `<div class="muted">• ${tf(`rival.effect.${e.kind}`, { rival: e.rival, n: Math.ceil((e.until - s.hour) / (7 * HOURS_PER_DAY)) })}</div>`)
      .join("")}`;
  }

  private staffHtml(): string {
    const s = this.state;
    if (!s.office) return `<div class="muted">${tk("staff.locked")}</div>`;
    const skill = (lo: number, hi: number) => (lo === hi ? `${lo}` : `${lo}–${hi}`);
    const moraleWord = (v: number) => tk(v >= 70 ? "staff.morale.high" : v >= 45 ? "staff.morale.ok" : v >= STAFF.quitBelow ? "staff.morale.low" : "staff.morale.critical");
    const members = s.staff.members.length
      ? s.staff.members
          .map((m) => {
            const v = visibleSkill(m);
            const work = m.role === "coach" ? tf("staff.load", { n: caseload(s, m.id), h: m.usedThisWeek, max: STAFF.weeklyHours }) : roleDesc(m.role);
            return `<div class="lead"><b>${m.name}</b> · ${tk(`role.${m.role}`)} · <span class="muted">${tk("staff.skill")} ${skill(v.lo, v.hi)} · ${tf("staff.salary", { v: fmt(m.salary) })}</span>
              <div class="muted">${work} · ${tk("staff.morale")}: ${moraleWord(m.morale)}</div>
              <div class="row"><button data-act="raise" data-staff="${m.id}">${tk("staff.raise")}</button><button data-act="fire" data-staff="${m.id}">${tk("staff.fire")}</button></div></div>`;
          })
          .join("")
      : `<div class="muted">${tk("staff.none")}</div>`;
    const total = s.staff.members.reduce((a, m) => a + m.salary * (1 + STAFF.employerCostRate), 0);
    const cands = s.staff.candidates.length
      ? s.staff.candidates
          .map(
            (c) => `<div class="lead"><b>${c.name}</b> · ${tk(`role.${c.role}`)} · <span class="muted">${tk("staff.skill")} ${skill(c.skillLo, c.skillHi)} · ${tf("staff.ask", { v: fmt(c.askSalary) })}</span>
              <div class="row"><button data-act="hire" data-cand="${c.id}">${tk("staff.hire")}</button></div></div>`,
          )
          .join("")
      : `<div class="muted">${tk("staff.noCandidates")}</div>`;
    return `${members}${total ? `<div class="muted">${tf("staff.cost", { v: fmt(total) })}</div>` : ""}
      <div style="margin-top:6px"><b>${tk("staff.candidates")}</b></div>${cands}`;
  }
}
