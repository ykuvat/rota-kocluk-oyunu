// Kararlar sütunu (sağ): oyunun asıl etkileşimi. Her kart bir durum ve 2–4 net seçenek.
// Adaylar, öğrencinin haftalık durumu, huzursuz veli, olaylar, tercih talepleri ve iş başvuruları burada.
// Hesap (saat, program, ücret detayı) oyuncuya bırakılmaz; seçim komuta çevrilir.

import { EVENT_BY_ID } from "../../content/events";
import { INTERVENTIONS, SIGNAL_TO_IV, type InterventionId } from "../../content/interventions";
import { getLocale, tf, tk } from "../../platform/i18n";
import { calendarAt, HOURS_PER_DAY } from "../../sim/calendar";
import { applyCommand, type CommandResult } from "../../sim/commands";
import { dominantCauseLastWeek, weeklySignals } from "../../sim/insight";
import type { MissCause } from "../../sim/student";
import { parentSignals } from "../../sim/parent";
import { findStudent, type GameState } from "../../sim/state";
import { fmtVars } from "../notices";
import { fmt, hash, toast } from "./common";

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
  options: Option[];
}

const css = `
#decisions{position:fixed;right:12px;top:12px;bottom:12px;width:340px;overflow:auto;padding:10px 12px;background:var(--panel);border-radius:12px}
#decisions h3{margin:2px 0 8px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
#decisions .card{background:var(--card);border-radius:10px;padding:10px 11px;margin-bottom:10px;border:1px solid var(--line);animation:pop .25s ease-out}
#decisions .card .t{font-weight:700;font-size:15px;margin-bottom:3px}
#decisions .card .b{color:#e6d9ea;margin-bottom:8px}
#decisions .opts{display:flex;flex-direction:column;gap:5px}
#decisions .opts button{text-align:left}
#decisions .empty{color:var(--muted);padding:8px 2px}
#decisions .main{position:sticky;bottom:0;padding-top:8px;background:linear-gradient(transparent,var(--panel) 30%)}
#decisions .main button{width:100%;font-size:17px;padding:12px}
#decisions .main .sub{text-align:center;color:var(--muted);font-size:12px;margin-top:4px}
#decisions .main .bar{height:6px;background:#2a2030;border-radius:4px;overflow:hidden;margin-top:6px}
#decisions .main .bar span{display:block;height:100%;background:var(--accent)}
#decisions .card.locked{opacity:.45;pointer-events:none}
@keyframes pop{from{transform:translateY(6px);opacity:0}to{transform:none;opacity:1}}
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
    this.cardsEl = document.createElement("div");
    this.footerEl = document.createElement("div");
    this.footerEl.className = "main";
    this.el.append(this.cardsEl, this.footerEl);
    document.body.appendChild(this.el);
    this.el.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest("button[data-main]")) {
        e.preventDefault();
        this.onMain();
        return;
      }
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-card]");
      if (!b) return;
      e.preventDefault();
      const card = this.cards[Number(b.dataset.card)];
      card?.options[Number(b.dataset.opt)]?.act();
      this.render(true);
    });
  }

  /** Karar bekleyen kart sayısı. */
  get count(): number {
    return this.cards.length;
  }

  /** Hafta oynarken akışı durduran kartlar: olaylar (cevap verilmeden hafta devam etmez). */
  get urgentCount(): number {
    return this.state.events.pending.length;
  }

  private feedback(r: CommandResult, okText: string, bad = false): void {
    if (!r.ok) toast(r.error === "coach.noTime" ? tk("play.busy") : tk(`error.${r.error}`), true);
    else toast(okText, bad);
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
              if (!r.ok) this.feedback(r, "");
              else if (r.enrolled) toast(tf("feedback.enrolled", { name: l.name, fee: fmt(t.price) }));
              else toast(tf("feedback.notEnrolled", { name: l.name }), true);
            },
          })),
          { label: tk("play.notNow"), act: () => void applyCommand(s, { type: "declineLead", leadId: l.id }) },
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
            { label: tk("play.later"), act: () => void this.dismissed.add(key) },
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
              act: () => this.feedback(applyCommand(s, { type: "parentMeeting", studentId: st.id }), tk("feedback.parentMeeting")),
            },
            { label: tk("play.later"), act: () => void this.dismissed.add(pkey) },
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
                if (!res.ok) this.feedback(res, "");
                else toast(tf(res.enrolled ? "notice.prefSold" : "notice.prefLost", { name: r.name, price: fmt(price) }), !res.enrolled);
              },
            })),
            { label: tk("play.skip"), act: () => void applyCommand(s, { type: "declinePreference", requestId: r.id }) },
          ],
        });
      }
    }

    // iş başvuruları (ofis varsa)
    if (s.office) {
      for (const c of s.staff.candidates) {
        const key = `cand:${c.id}`;
        if (this.dismissed.has(key)) continue;
        cards.push({
          key,
          icon: "🧑‍💼",
          title: tf("play.candTitle", { name: c.name }),
          body: tf("play.candBody", { lo: c.skillLo, hi: c.skillHi, salary: fmt(c.askSalary) }),
          options: [
            {
              label: tk("play.hire"),
              primary: true,
              act: () => this.feedback(applyCommand(s, { type: "hireStaff", candidateId: c.id }), tf("notice.staffHired", { name: c.name })),
            },
            { label: tk("play.skip"), act: () => void this.dismissed.add(key) },
          ],
        });
      }
    }
    return cards;
  }

  render(force = false): void {
    this.cards = this.build();
    // alt düğme kartlardan ayrı güncellenir (hafta akarken kartlar yeniden çizilip titremesin)
    if (this.footerEl.innerHTML !== this.footer) this.footerEl.innerHTML = this.footer;
    const key = `${this.cards.map((c) => c.key).join(",")}|${getLocale()}|${this.state.coach.usedThisWeek}|${this.running}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    const body = this.cards.length
      ? this.cards
          .map(
            (c, ci) => `<div class="card ${this.running && !c.key.startsWith("ev:") ? "locked" : ""}"><div class="t">${c.icon} ${c.title}</div><div class="b">${c.body}</div><div class="opts">${c.options
              .map((o, oi) => `<button data-card="${ci}" data-opt="${oi}" class="${o.primary ? "primary" : ""}">${o.label}${o.hint ? `<span class="hint">${o.hint}</span>` : ""}</button>`)
              .join("")}</div></div>`,
          )
          .join("")
      : `<div class="empty">${tk("play.noDecisions")}</div>`;
    this.cardsEl.innerHTML = `<h3>${tk("play.decisions")}${this.cards.length ? ` (${this.cards.length})` : ""}</h3>${body}`;
  }
}
