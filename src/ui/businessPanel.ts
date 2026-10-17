// İşletme paneli (sol alt): adaylar, pazarlama, para. Durumu yalnız komutlarla değiştirir.

import { COACHING, ECONOMY } from "../content/business";
import { BRANCHES, CERTS, OFFICES, STAGES } from "../content/growth";
import { errorText, roleDesc } from "./play/decisions";
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
`;

const fmt = (v: number) => Math.round(v).toLocaleString("tr-TR");

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
      }
    }
    this.render(true);
  }

  render(force = false): void {
    const s = this.state;
    const m = s.marketing;
    const key = `${this.tab}|${s.hour}|${s.leads.length}|${s.coach.usedThisWeek}|${m.organicHours}|${m.paidBudget}|${m.networkActive}|${getLocale()}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    // odakta bir fiyat kutusu varsa yazarken yeniden çizme
    if (!force && this.el.contains(document.activeElement) && document.activeElement?.tagName === "INPUT") return;

    const tabs = `<div class="tabs"><button data-act="tab" data-tab="biz" class="${this.tab === "biz" ? "on" : ""}">${tk("biz.leads")}</button>
      <button data-act="tab" data-tab="growth" class="${this.tab === "growth" ? "on" : ""}">${tk("growth.title")}</button>
      <button data-act="close" class="x" aria-label="✕">✕</button></div>`;
    if (this.tab === "growth") {
      this.el.innerHTML = tabs + this.growthHtml();
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
