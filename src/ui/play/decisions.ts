// Kararlar sütunu (sağ): oyunun asıl etkileşimi. Her kart bir durum ve 2–4 net seçenek.
// Adaylar, öğrencinin haftalık durumu, huzursuz veli, olaylar, tercih talepleri ve iş başvuruları burada.
// Hesap (saat, program, ücret detayı) oyuncuya bırakılmaz; seçim komuta çevrilir.

import { BALANCE } from "../../content/balance";
import { EVENT_BY_ID } from "../../content/events";
import { INSIGHT, INTERVENTIONS, SIGNAL_TO_IV, type InterventionId } from "../../content/interventions";
import { getLocale, tf, tk } from "../../platform/i18n";
import { calendarAt, HOURS_PER_DAY } from "../../sim/calendar";
import { applyCommand, type CommandResult } from "../../sim/commands";
import { dominantCauseLastWeek, weeklySignals } from "../../sim/insight";
import { stat, type MissCause, type Student } from "../../sim/student";
import { parentSignals } from "../../sim/parent";
import { coachHours, findStudent, type GameState } from "../../sim/state";
import { BRANCHES } from "../../content/growth";
import { SPECIALISTS, type StaffRole } from "../../content/staff";
import { branchBlocker } from "../../sim/growth";
import { fmtVars } from "../notices";
import { fmt, hash } from "./common";

export const ROLE_ICON: Record<StaffRole, string> = { coach: "🧑‍💼", secretary: "☎️", counselor: "🫂", teacher: "📐" };

/** Rolün oyuncuya tek cümlelik açıklaması. */
export const roleDesc = (role: StaffRole) => tf(`role.desc.${role}`, { h: SPECIALISTS.secretary.adminHours });

interface Option {
  label: string;
  hint?: string;
  primary?: boolean;
  act: () => void;
}

interface Card {
  key: string;
  icon: string;
  title: string;
  body: string;
  /** gövdenin altında ek bilgi (ör. sohbetten çıkan ipucu) */
  extra?: string;
  options: Option[];
}

/** Saat (0,5'lik adımlar): 1,5 */
export const fmtH = (h: number) => (Math.round(h * 10) / 10).toLocaleString(getLocale() === "tr" ? "tr-TR" : "en-US");

/** Komut hatasının oyuncuya açıklaması (neden olmadı + ne yapılabilir). */
export function errorText(error: string): string {
  return error === "coach.noTime" ? tk("play.busy") : tk(`error.${error}`);
}

/** Veli görüşmesinden önceki durum (sonrasıyla karşılaştırmak için). */
export function parentBefore(st: Student, week: number) {
  const p = st.parent;
  const since = p.lastMeetingWeek === null ? Infinity : week - p.lastMeetingWeek;
  return { known: p.known, sat: p.satisfaction, stale: since < BALANCE.parent.meetingFreshWeeks };
}

/** Veli görüşmesinin sonucu: memnuniyet önce → sonra, sık görüşme uyarısı. */
export function parentMeetingText(st: Student, before: ReturnType<typeof parentBefore>): string {
  const p = st.parent;
  const parts = [tf("res.parent", { from: Math.round(before.sat), to: Math.round(p.satisfaction), style: tk(`parent.style.${p.style}`) })];
  if (!before.known) parts.push(tk("res.parentFirst"));
  if (before.stale) parts.push(tf("res.parentStale", { n: BALANCE.parent.meetingFreshWeeks }));
  return parts.join(" ");
}

/** Bu hafta sohbet edildiyse öğrencinin ağzından asıl sorunu ima eden cümle; güveni düşükse açılmaz. */
export function interviewClueHtml(state: GameState, st: Student, week: number): string {
  if (st.lastInterviewWeek !== week) return "";
  const cause = dominantCauseLastWeek(st);
  if (!cause) return "";
  if (stat(st, "trust", state.hour).value < INSIGHT.clueMinTrust) return `<div class="clue closed">💬 ${tk("clue.closed")}</div>`;
  return `<div class="clue">💬 “${tk(`clue.${cause}`)}”</div>`;
}

const css = `
#decisions{position:fixed;right:12px;top:12px;bottom:12px;width:340px;display:flex;flex-direction:column;padding:12px 12px 12px;z-index:20}
#decisions .head{display:flex;align-items:center;gap:8px;padding:2px 4px 10px;font-weight:800;font-size:15px;color:#f6d39a;user-select:none}
#decisions .head .cnt{background:var(--accent);color:#3a2410;border-radius:999px;min-width:22px;height:22px;display:inline-grid;place-items:center;font-size:12px;padding:0 6px}
#decisions .head .chev{display:none;margin-left:auto;width:10px;height:10px;border-right:2.5px solid var(--muted);border-bottom:2.5px solid var(--muted);transform:rotate(45deg);margin-top:-4px}
#decisions .cards{flex:1;overflow:auto;overscroll-behavior:contain;padding:0 2px;margin:0 -2px;scrollbar-width:thin;scrollbar-color:rgba(255,235,215,.2) transparent}
#decisions .card{background:var(--card);border-radius:16px;padding:12px;margin-bottom:10px;animation:pop .25s ease-out}
#decisions .card .t{display:flex;align-items:center;gap:8px;font-weight:800;font-size:15px;margin-bottom:4px}
#decisions .card .ic{flex:none;width:32px;height:32px;border-radius:50%;display:grid;place-items:center;background:rgba(244,189,98,.16);font-size:17px}
#decisions .card .b{color:var(--soft);margin-bottom:10px;font-size:13.5px}
#decisions .opts{display:flex;flex-direction:column;gap:6px}
#decisions .opts button{display:flex;align-items:center;text-align:left;padding:10px 12px;border-radius:12px}
#decisions .empty{color:var(--muted);padding:10px 4px}
#decisions .main{padding-top:10px}
#decisions .main button{width:100%;font-size:17px;padding:13px;border-radius:14px}
#decisions .main .sub{text-align:center;color:var(--muted);font-size:12px;margin-top:6px}
#decisions .main .bar{height:6px;background:rgba(0,0,0,.25);border-radius:4px;overflow:hidden;margin-top:8px}
#decisions .main .bar span{display:block;height:100%;background:var(--accent);border-radius:4px}
#decisions .card.locked{opacity:.45;pointer-events:none}
#decisions .main .run{display:flex;gap:6px}
#decisions .main .run button{width:auto;flex:none;font-size:14px;padding:10px 12px}
#decisions .main .run button.primary{flex:1;min-width:0;font-size:15px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#decisions .main .days{display:flex;justify-content:space-between;font-size:11px;color:var(--muted);margin-top:4px;padding:0 2px}
#decisions .main .days .past{opacity:.5}
#decisions .main .days .now{color:var(--accent);font-weight:800}
#decisions .head .hrs{margin-left:auto;font-size:12px;font-weight:700;color:var(--muted);background:var(--card);border-radius:999px;padding:3px 9px;white-space:nowrap}
#decisions .head .hrs.low{color:var(--bad)}
#decisions .card.done{background:rgba(255,240,225,.035);border:1px dashed var(--line);animation:none}
#decisions .card.done .b{margin-bottom:6px}
#decisions .chosen{display:flex;gap:8px;align-items:flex-start;background:var(--card-hi);border-radius:12px;padding:8px 10px;font-weight:700}
#decisions .chosen .ok{color:var(--good)}
#decisions .res{font-size:13px;margin-top:6px;color:var(--soft)}
#decisions .res.bad{color:var(--bad)}
#decisions .err{font-size:13px;color:var(--bad);margin:-4px 0 8px}
#decisions .clue{font-size:13px;background:rgba(155,232,174,.1);border-left:3px solid var(--good);border-radius:8px;padding:6px 8px;margin:-4px 0 10px}
#decisions .clue.closed{background:rgba(255,170,165,.08);border-left-color:var(--bad)}@keyframes pop{from{transform:translateY(6px)}to{transform:none}}
@media (max-width:760px){
  #decisions{left:8px;right:8px;top:auto;bottom:8px;width:auto;max-height:48vh;max-height:48dvh;padding:6px 10px 10px;border-radius:20px 20px 18px 18px;
    padding-bottom:max(10px,env(safe-area-inset-bottom))}
  #decisions::before{content:"";display:block;width:40px;height:4px;border-radius:2px;background:rgba(255,235,215,.25);margin:2px auto 6px}
  #decisions .head{padding:0 4px 8px;cursor:pointer}
  #decisions .head .chev{display:block;margin-left:8px}
  #decisions.collapsed .head .chev{transform:rotate(-135deg);margin-top:4px}
  #decisions.collapsed .cards{display:none}
  #decisions.collapsed .head{padding-bottom:4px}
  #decisions .main{padding-top:6px}
  #decisions .main button{padding:11px;font-size:16px}
  #decisions .card{padding:10px}
}
`;

/** Fiyat seçenekleri (ofisli kurumda biraz yukarı). */
export function priceTiers(state: GameState) {
  const k = state.office ? 1.2 : 1;
  const r = (v: number) => Math.round((v * k) / 250) * 250;
  return [
    { id: "low", price: r(4_500) },
    { id: "mid", price: r(6_000) },
    { id: "high", price: r(8_500) },
  ];
}

/** Oyuncunun bu hafta verdiği öğrenci kararı (hafta sonunda sonucu gösterilir). */
export interface DecisionRecord {
  studentId: string;
  name: string;
  iv: InterventionId;
  matched: boolean | undefined;
  /** kararın verildiği andaki gerçek kök neden (yanlış seçimde oyuncuya açıklanır) */
  cause: MissCause | null;
}

export class DecisionPanel {
  private readonly el: HTMLDivElement;
  private cards: Card[] = [];
  /** bu hafta verilen öğrenci kararları; hafta sonu ekranı okuyup sıfırlar */
  readonly weekDecisions: DecisionRecord[] = [];
  /** kartların altındaki ana düğme (hafta başlat / devam) */
  footer = "";
  onMain: () => void = () => undefined;
  /** hafta ilerleyişi (%), çubuk düğmeler yeniden çizilmeden güncellenir */
  progress = 0;
  private lastFooter = "";
  /** alt bölümdeki küçük düğmeler (hız, duraklat) */
  onFooter: (act: string) => void = () => undefined;
  /** hafta oynarken yalnız olay kartlarına dokunulabilir */
  running = false;
  /** bu oturumda "sonra" denen kartlar (hafta değişince öğrenci kartları yeniden gelir) */
  private readonly dismissed = new Set<string>();
  private lastKey = "";
  private readonly cardsEl: HTMLDivElement;
  private readonly footerEl: HTMLDivElement;

  constructor(private readonly state: GameState) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "decisions";
    this.el.className = "pl pl-only";
    this.headEl = document.createElement("div");
    this.headEl.className = "head";
    this.cardsEl = document.createElement("div");
    this.cardsEl.className = "cards";
    this.footerEl = document.createElement("div");
    this.footerEl.className = "main";
    this.el.append(this.headEl, this.cardsEl, this.footerEl);
    document.body.appendChild(this.el);
    // "click": kaydırırken (dokunmatik) yanlışlıkla seçim yapılmasın
    this.el.addEventListener("click", (e) => {
      const t = e.target as HTMLElement;
      if (t.closest("button[data-main]")) {
        this.onMain();
        return;
      }
      const foot = t.closest<HTMLButtonElement>("button[data-foot]");
      if (foot) {
        this.onFooter(foot.dataset.foot!);
        return;
      }
      if (t.closest(".head")) {
        this.setCollapsed(!this.collapsed);
        return;
      }
      const b = t.closest<HTMLButtonElement>("button[data-card]");
      if (!b) return;
      // çift dokunuş / hızlı art arda tıklama: ikinci tık başka bir karta düşmesin
      const now = performance.now();
      if (now - this.lastClick < 450) return;
      this.lastClick = now;
      const card = this.cards.find((c) => c.key === b.dataset.card);
      const opt = card?.options[Number(b.dataset.opt)];
      if (!card || !opt) return;
      this.last = null;
      opt.act();
      const res = this.last as { ok: boolean; text: string; bad: boolean } | null;
      if (res && !res.ok) this.errors.set(card.key, res.text);
      else {
        this.errors.delete(card.key);
        this.resolved.set(card.key, { card, choice: opt.label, text: res?.text ?? "", bad: res?.bad ?? false });
      }
      this.render(true);
    });
  }

  private readonly headEl: HTMLDivElement;
  /** mobil alt sayfa kapalı mı (yalnız başlık ve ana düğme görünür) */
  private collapsed = false;
  private lastCardKeys = "";
  /** sayfa açılıp kapanınca (oda görünür alanı değişir) */
  onLayout: () => void = () => undefined;

  private setCollapsed(v: boolean): void {
    if (this.collapsed === v) return;
    this.collapsed = v;
    this.el.classList.toggle("collapsed", v);
    this.onLayout();
  }

  /** Karar bekleyen kart sayısı. */
  get count(): number {
    return this.cards.length;
  }

  /** Hafta oynarken akışı durduran kartlar: olaylar (cevap verilmeden hafta devam etmez). */
  get urgentCount(): number {
    return this.state.events.pending.length;
  }

  /** Son seçimin sonucu: kartın içinde gösterilir (anlık bildirim kaybolup gidiyordu). */
  private last: { ok: boolean; text: string; bad: boolean } | null = null;
  /** Bu hafta seçilmiş kartlar: hafta başlatılana kadar seçilen seçenek ve sonucuyla yerinde kalır. */
  private readonly resolved = new Map<string, { card: Card; choice: string; text: string; bad: boolean }>();
  /** Geçersiz seçim (saat yetmedi, güven az…): kart açık kalır, nedeni kartın içinde yazar. */
  private readonly errors = new Map<string, string>();
  /** kartların ekrandaki sırası: seçilen kart yerinde kalır, alttaki kart yukarı kaymaz (art arda yanlış dokunuş) */
  private order: string[] = [];
  private wasRunning = false;
  private lastClick = 0;

  private feedback(r: CommandResult, okText: string, bad = false): void {
    this.last = r.ok ? { ok: true, text: okText, bad } : { ok: false, text: errorText(r.error), bad: true };
  }

  build(): Card[] {
    const s = this.state;
    const week = calendarAt(s.hour).weekIndex;
    const cards: Card[] = [];

    // olaylar (en acil)
    for (const p of s.events.pending) {
      const def = EVENT_BY_ID[p.def];
      if (!def) continue;
      const st = p.studentId ? findStudent(s, p.studentId) : undefined;
      const vars = fmtVars(p.vars);
      cards.push({
        key: `ev:${p.id}`,
        icon: "⚡",
        title: tk(`ev.${def.id}.title`),
        body: tf(`ev.${def.id}.body`, vars),
        options: def.options.map((o) => {
          const hints: string[] = [];
          if (o.hours) hints.push(tf("play.hours", { h: o.hours }));
          const cost = o.cost?.({ state: s, s: st, vars: p.vars });
          if (cost) hints.push(`${fmt(cost)} ₺`);
          return {
            label: tf(`ev.${def.id}.opt.${o.id}`, vars),
            hint: hints.join(" · "),
            act: () => {
              const r = applyCommand(s, { type: "resolveEvent", eventId: p.id, optionId: o.id });
              this.feedback(r, r.ok && r.outcome ? tf(`ev.${def.id}.out.${r.outcome}`, vars) : "");
            },
          };
        }),
      });
    }

    // adaylar
    for (const l of s.leads) {
      const days = Math.max(0, Math.ceil((l.expiresHour - s.hour) / HOURS_PER_DAY));
      cards.push({
        key: `lead:${l.id}`,
        icon: "👋",
        title: tf("play.leadTitle", { name: l.name }),
        body: tf("play.leadBody", { grade: l.grade, source: tk(`source.${l.source}`), n: days }),
        options: [
          ...priceTiers(s).map((t) => ({
            label: tk(`play.price.${t.id}`),
            hint: tf("play.price.hint", { v: fmt(t.price) }),
            primary: t.id === "mid",
            act: () => {
              const r = applyCommand(s, { type: "introMeeting", leadId: l.id, price: t.price });
              this.feedback(r, r.ok && r.enrolled ? tf("feedback.enrolled", { name: l.name, fee: fmt(t.price) }) : tf("feedback.notEnrolled", { name: l.name }), r.ok && !r.enrolled);
            },
          })),
          { label: tk("play.notNow"), act: () => this.feedback(applyCommand(s, { type: "declineLead", leadId: l.id }), tk("res.leadDeclined")) },
        ],
      });
    }

    for (const st of s.students) {
      if (st.left) continue;
      // öğrencinin haftalık kararı: geçen haftanın sinyalleri ve üç olası çare
      const signals = weeklySignals(st);
      const key = `st:${st.id}:${week}`;
      if (signals.length && !st.ivThisWeek && !this.dismissed.has(key)) {
        const best = SIGNAL_TO_IV[signals[0]];
        const second = signals.map((x) => SIGNAL_TO_IV[x]).find((x) => x && x !== best);
        const pool = (Object.keys(INTERVENTIONS) as InterventionId[]).filter((x) => x !== best && x !== second);
        const distractor = pool[hash(key) % pool.length];
        const ivs = [best, second ?? distractor, second ? distractor : pool[(hash(key) + 3) % pool.length]].filter(Boolean) as InterventionId[];
        // sırayı sabit ama tahmin edilemez karıştır
        const order = ivs.map((iv, i) => ({ iv, k: hash(`${key}:${i}`) })).sort((a, b) => a.k - b.k).map((x) => x.iv);
        cards.push({
          key,
          icon: "🎒",
          title: tf("play.studentTitle", { name: st.name.split(" ")[0] }),
          body: signals.slice(0, 2).map((x) => `“${tk(x)}”`).join(" · "),
          extra: interviewClueHtml(s, st, week),
          options: [
            ...order.map((iv) => ({
              label: tk(`card.iv.${iv}`),
              hint: tf("play.hours", { h: INTERVENTIONS[iv].hours }),
              act: () => {
                const cause = dominantCauseLastWeek(st);
                const r = applyCommand(s, { type: "intervene", studentId: st.id, intervention: iv });
                if (r.ok) this.weekDecisions.push({ studentId: st.id, name: st.name.split(" ")[0], iv, matched: r.matched, cause });
                const k = r.ok && r.matched === true ? "feedback.matched" : r.ok && r.matched === false ? "feedback.mismatched" : "feedback.neutral";
                this.feedback(r, tf(k, { name: st.name.split(" ")[0] }), k === "feedback.mismatched");
              },
            })),
            { label: tk("play.later"), act: () => this.note(key, tk("res.later")) },
          ],
        });
      }

      // huzursuz veli
      const pkey = `par:${st.id}:${week}`;
      const psig = parentSignals(st, week).filter((x) => x === "signal.parentCalls" || x === "signal.parentCold" || x === "signal.parentComparesSibling");
      if (psig.length && st.parent.lastMeetingWeek !== week && !this.dismissed.has(pkey)) {
        cards.push({
          key: pkey,
          icon: "☎️",
          title: tf("play.parentTitle", { name: st.name.split(" ")[0] }),
          body: `${psig.map((x) => `“${tk(x)}”`).join(" · ")} ${tk("play.parentBody")}`,
          options: [
            {
              label: tk("play.callParent"),
              hint: tf("play.hours", { h: 1 }),
              primary: true,
              act: () => {
                const before = parentBefore(st, week);
                const r = applyCommand(s, { type: "parentMeeting", studentId: st.id });
                this.feedback(r, parentMeetingText(st, before));
              },
            },
            { label: tk("play.later"), act: () => this.note(pkey, tk("res.parentLater")) },
          ],
        });
      }
    }

    // tercih dönemi talepleri
    if (s.preference?.open) {
      for (const r of s.preference.requests) {
        cards.push({
          key: `pref:${r.id}`,
          icon: "🎓",
          title: tf("play.prefTitle", { name: r.name }),
          body: tf("play.prefBody", { source: tk(r.source === "graduate" ? "pref.graduate" : "pref.external"), rank: r.rank.toLocaleString("tr-TR") }),
          options: [
            ...[2_000, 3_000, 4_500].map((price, i) => ({
              label: `${fmt(price)} ₺`,
              hint: tf("play.hours", { h: 2 }),
              primary: i === 1,
              act: () => {
                const res = applyCommand(s, { type: "preferenceSession", requestId: r.id, price });
                this.feedback(res, tf(res.ok && res.enrolled ? "notice.prefSold" : "notice.prefLost", { name: r.name, price: fmt(price) }), res.ok && !res.enrolled);
              },
            })),
            { label: tk("play.skip"), act: () => this.feedback(applyCommand(s, { type: "declinePreference", requestId: r.id }), tk("res.skipped")) },
          ],
        });
      }
    }

    // iş başvuruları (ofis varsa)
    if (s.office) {
      for (const c of s.staff.candidates) {
        const key = `cand:${c.id}`;
        if (this.dismissed.has(key)) continue;
        const role = tk(`role.${c.role}`);
        cards.push({
          key,
          icon: ROLE_ICON[c.role],
          title: tf("play.candTitle", { name: c.name, role }),
          body: `${roleDesc(c.role)}<br>${tf("play.candBody", { lo: c.skillLo, hi: c.skillHi, salary: fmt(c.askSalary) })}`,
          options: [
            {
              label: tk("play.hire"),
              primary: true,
              act: () => this.feedback(applyCommand(s, { type: "hireStaff", candidateId: c.id }), tf("notice.staffHired", { name: c.name, role })),
            },
            { label: tk("play.skip"), act: () => this.note(key, tk("res.candSkipped")) },
          ],
        });
      }
    }

    // şube: koşullar sağlanınca bir sonraki şube önerilir (Aşama 4)
    const next = BRANCHES.find((b) => !s.branches.includes(b.id));
    if (next && branchBlocker(s, next.id) === null) {
      const key = `branch:${next.id}:${s.branches.length}`;
      if (!this.dismissed.has(key)) {
        cards.push({
          key,
          icon: "🏢",
          title: tf(s.branches.length ? "play.branchTitleMore" : "play.branchTitle", { branch: tk(`branch.${next.id}`) }),
          body: tf("play.branchBody", { upfront: fmt(next.rent * next.depositMonths + next.setup), monthly: fmt(next.rent + next.utilities), cap: next.capacity }),
          options: [
            {
              label: tk("play.openBranch"),
              primary: true,
              act: () => this.feedback(applyCommand(s, { type: "openBranch", branchId: next.id }), tf("notice.branchOpened", { branch: tk(`branch.${next.id}`) })),
            },
            { label: tk("play.later"), act: () => this.note(key, tk("res.branchLater")) },
          ],
        });
      }
    }
    return cards;
  }

  /** Komutsuz seçim ("sonra", "geç"): kart bu hafta gizlenir, seçim kartta görünür. */
  private note(key: string, text: string): void {
    this.dismissed.add(key);
    this.last = { ok: true, text, bad: false };
  }

  render(force = false): void {
    this.cards = this.build();
    // hafta başlatılınca geçen seçimler temizlenir (o ana kadar ne seçildiği görünür kalır)
    if (this.running && !this.wasRunning) {
      this.resolved.clear();
      this.errors.clear();
    }
    this.wasRunning = this.running;
    // alt düğme kartlardan ayrı güncellenir (hafta akarken kartlar yeniden çizilip titremesin)
    if (this.footer !== this.lastFooter) {
      this.footerEl.innerHTML = this.footer;
      this.lastFooter = this.footer;
    }
    const bar = this.footerEl.querySelector<HTMLElement>(".bar span");
    if (bar) bar.style.width = `${Math.round(this.progress)}%`;
    // ekrandaki sıra: bilinen kartlar yerinde, yeni olaylar en üstte, diğer yeni kartlar sonda
    const live = new Map(this.cards.map((c) => [c.key, c]));
    const order = this.order.filter((k) => live.has(k) || this.resolved.has(k));
    for (const c of this.cards) {
      if (order.includes(c.key)) continue;
      if (c.key.startsWith("ev:")) order.unshift(c.key);
      else order.push(c.key);
    }
    this.order = order;
    // mobil sayfa: hafta oynarken kapanır (oda görünsün); yeni karar gelince (ya da olay çıkınca) açılır
    const cardKeys = this.cards.map((c) => c.key).join(",");
    const urgent = this.cards.some((c) => c.key.startsWith("ev:"));
    if ((this.running && !urgent) || !order.length) this.setCollapsed(true);
    else if (cardKeys !== this.lastCardKeys && this.cards.length) this.setCollapsed(false);
    this.lastCardKeys = cardKeys;
    const s = this.state;
    const total = coachHours(s);
    const free = Math.max(0, total - s.coach.usedThisWeek);
    const key = `${order.join(",")}|${this.resolved.size}|${this.errors.size}|${getLocale()}|${s.coach.usedThisWeek}|${this.running}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    const n = this.cards.length;
    this.headEl.innerHTML = `<span class="ttl">${tk("play.decisions")}</span>${n ? `<span class="cnt">${n}</span>` : ""}
      <span class="hrs ${free < 1.5 ? "low" : ""}" title="${tk("play.hoursTip")}">⏱ ${tf("play.hoursFree", { free: fmtH(free), total: fmtH(total) })}</span><span class="chev" aria-hidden="true"></span>`;
    const cardHtml = (k: string) => {
      const done = this.resolved.get(k);
      if (done) {
        const c = done.card;
        return `<div class="card done"><div class="t"><span class="ic">${c.icon}</span><span>${c.title}</span></div>
          <div class="chosen"><span class="ok">✔</span><span>${done.choice}</span></div>${done.text ? `<div class="res ${done.bad ? "bad" : ""}">${done.text}</div>` : ""}</div>`;
      }
      const c = live.get(k)!;
      const err = this.errors.get(k);
      return `<div class="card ${this.running && !k.startsWith("ev:") ? "locked" : ""}"><div class="t"><span class="ic">${c.icon}</span><span>${c.title}</span></div><div class="b">${c.body}</div>${c.extra ?? ""}${err ? `<div class="err">⚠ ${err}</div>` : ""}<div class="opts">${c.options
        .map((o, oi) => `<button data-card="${k}" data-opt="${oi}" class="${o.primary ? "primary" : ""}"><span>${o.label}</span>${o.hint ? `<span class="hint">${o.hint}</span>` : ""}</button>`)
        .join("")}</div></div>`;
    };
    const pending = order.filter((k) => !this.resolved.has(k));
    const chosen = order.filter((k) => this.resolved.has(k));
    // seçilenler yerinde kalır; bekleyen kart kalmadıysa üstte kısa bir not
    this.cardsEl.innerHTML =
      (!pending.length ? `<div class="empty">${tk(chosen.length ? "play.allChosen" : "play.noDecisions")}</div>` : "") + order.map(cardHtml).join("");
  }
}
