// Hafta sonu ekranı: oyuncu bu hafta ne yaptı, ne oldu? Her kararın sonucu (doğru çare mi, asıl sorun neydi),
// öğrencilerin ilerleyişi, olanlar ve para. Oyuncunun neden-sonuç ilişkisini görmesi için oyunun ana öğretmeni.

import { tf, tk } from "../../platform/i18n";
import { calendarAt } from "../../sim/calendar";
import type { TxCategory } from "../../sim/economy";
import type { GameState } from "../../sim/state";
import { isBadNotice, noticeText } from "../notices";
import { fmt, MOOD_ICON, moodOf, parentFace } from "./common";
import type { DecisionRecord } from "./decisions";

const css = `
#wsum{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(15,10,20,.55);z-index:35}
#wsum .box{width:min(520px,calc(100vw - 32px));max-height:calc(100vh - 40px);overflow:auto;padding:18px 20px;background:var(--panel);border:1px solid var(--accent);border-radius:14px;box-shadow:0 10px 40px rgba(0,0,0,.5)}
#wsum h2{margin:0 0 4px;font-size:20px;color:#ffd98a}
#wsum h4{margin:12px 0 4px;font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:var(--accent)}
#wsum .line{display:flex;justify-content:space-between;gap:10px;padding:4px 0;border-bottom:1px solid var(--line)}
#wsum .ok{color:var(--good)}
#wsum .bad{color:var(--bad)}
#wsum .foot{display:flex;justify-content:flex-end;margin-top:14px}
#wsum .foot button{font-size:16px;padding:10px 18px}
`;

interface Snapshot {
  hour: number;
  worth: number;
  totals: Partial<Record<TxCategory, number>>;
  students: Record<string, { tasks: number | null; mocks: number; sat: number }>;
}

const OWNER: TxCategory[] = ["ownerDraw", "ownerDeposit"];

export class WeekSummary {
  private readonly el: HTMLDivElement;
  private open = false;
  private snap: Snapshot | null = null;

  constructor(private readonly state: GameState, private readonly onClose: () => void) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "wsum";
    this.el.className = "pl pl-only";
    this.el.style.display = "none";
    document.body.appendChild(this.el);
    this.el.addEventListener("pointerdown", (e) => {
      if ((e.target as HTMLElement).closest("button[data-close]")) this.close();
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  close(): void {
    this.open = false;
    this.el.style.display = "none";
    this.onClose();
  }

  /** Hafta başlarken durumu kaydet (hafta sonunda farklar gösterilir). */
  begin(): void {
    if (this.snap) return; // kesintili haftada ilk başlangıç geçerli
    const s = this.state;
    const students: Snapshot["students"] = {};
    for (const st of s.students) {
      const w = st.history.at(-1);
      students[st.id] = { tasks: w && w.assigned ? w.done / w.assigned : null, mocks: st.mocks.length, sat: st.parent.satisfaction };
    }
    this.snap = { hour: s.hour, worth: s.economy.personal + s.economy.business, totals: { ...s.economy.totals }, students };
  }

  /** Hafta bitti: sonuçları göster. */
  show(decisions: DecisionRecord[], pendingCards: number): void {
    const s = this.state;
    const snap = this.snap;
    this.snap = null;
    if (!snap) return;
    const week = calendarAt(s.hour).weekIndex;

    // kararların sonucu
    const decHtml = decisions.length
      ? decisions
          .map((d) => {
            const what = `${d.name} · ${tk(`card.iv.${d.iv}`)}`;
            const res =
              d.matched === true
                ? `<span class="ok">✓ ${tk("week.worked")}</span>`
                : d.matched === false
                  ? `<span class="bad">✗ ${tf("week.missed", { cause: tk(`cause.${d.cause}`) })}</span>`
                  : `<span class="muted">${tk("week.tooEarly")}</span>`;
            return `<div class="line"><span>${what}</span>${res}</div>`;
          })
          .join("")
      : `<div class="muted">${tk("week.noDecisions")}</div>`;

    // öğrenciler
    const active = s.students.filter((x) => !x.left);
    const stHtml = active.length
      ? active
          .map((st) => {
            const prev = snap.students[st.id];
            const w = st.history.at(-1);
            const p = w && w.assigned ? w.done / w.assigned : null;
            const parts: string[] = [];
            if (p !== null) {
              const arrow = prev?.tasks == null ? "" : p > prev.tasks + 0.05 ? " ↑" : p < prev.tasks - 0.05 ? " ↓" : "";
              parts.push(tf("week.studentLine", { p: Math.round(p * 100) }) + arrow);
            }
            if (prev && st.mocks.length > prev.mocks) {
              const m = st.mocks.at(-1)!;
              const before = st.mocks.at(-2);
              parts.push(tf("week.mock", { net: m.total.toFixed(1) }) + (before ? ` (${m.total >= before.total ? "+" : ""}${(m.total - before.total).toFixed(1)})` : ""));
            }
            if (!prev) parts.push(tk("week.newStudent"));
            const face = st.parent.known ? ` · ${tk("week.parent")} ${parentFace(st.parent.satisfaction)}` : "";
            return `<div class="line"><span>${MOOD_ICON[moodOf(st, s.hour)]} ${st.name.split(" ")[0]}</span><span class="muted">${parts.join(" · ") || "—"}${face}</span></div>`;
          })
          .join("")
      : `<div class="muted">${tk("week.none")}</div>`;

    // olanlar
    const happened = s.history
      .filter((e) => e.hour > snap.hour && !["eventArrived", "studentEnrolled"].includes(e.type))
      .map((e) => {
        const t = noticeText(s, e);
        return t ? `<div class="line"><span class="${isBadNotice(e) ? "bad" : ""}">${t}</span></div>` : "";
      })
      .filter(Boolean)
      .slice(-8)
      .join("");

    // para: ay başı tahsilat ve giderler ayrıca
    const delta = (k: TxCategory) => (s.economy.totals[k] ?? 0) - (snap.totals[k] ?? 0);
    const income = (Object.keys(s.economy.totals) as TxCategory[]).filter((k) => !OWNER.includes(k)).reduce((a, k) => a + Math.max(0, delta(k)), 0);
    const spend = (Object.keys(s.economy.totals) as TxCategory[]).filter((k) => !OWNER.includes(k)).reduce((a, k) => a + Math.min(0, delta(k)), 0);
    const worth = s.economy.personal + s.economy.business;
    const change = worth - snap.worth;
    const moneyHtml = `<div class="line"><span>${tk("week.income")}</span><span class="ok">+${fmt(income)} ₺</span></div>
      <div class="line"><span>${tk("week.spend")}</span><span class="bad">${fmt(spend)} ₺</span></div>
      <div class="line"><span><b>${tk("week.net")}</b></span><b class="${change >= 0 ? "ok" : "bad"}">${change >= 0 ? "+" : ""}${fmt(change)} ₺</b></div>`;

    this.el.innerHTML = `<div class="box"><h2>${tf("week.title", { n: week })}</h2>
      <h4>${tk("week.yourDecisions")}</h4>${decHtml}
      <h4>${tk("week.students")}</h4>${stHtml}
      ${happened ? `<h4>${tk("week.happened")}</h4>${happened}` : ""}
      <h4>${tk("week.moneyTitle")}</h4>${moneyHtml}
      ${pendingCards ? `<div class="muted" style="margin-top:10px">${tf("week.next", { n: pendingCards })}</div>` : ""}
      <div class="foot"><button class="primary" data-close="1">${tk("week.continue")} ▶</button></div></div>`;
    this.el.style.display = "flex";
    this.open = true;
  }
}
