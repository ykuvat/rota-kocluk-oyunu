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
#wsum{position:fixed;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(20,12,24,.5);backdrop-filter:blur(3px);-webkit-backdrop-filter:blur(3px);z-index:35;padding:12px}
#wsum .box{width:min(520px,100%);max-height:calc(100vh - 24px);max-height:calc(100dvh - 24px);overflow:auto;padding:20px 22px;background:var(--panel-solid);border:1px solid var(--line);border-radius:22px;box-shadow:0 16px 50px rgba(0,0,0,.5);animation:pop .25s ease-out}
#wsum h2{margin:0 0 4px;font-size:21px;font-weight:800;color:#ffdc9a}
#wsum h4{margin:14px 0 6px;font-size:14px;font-weight:800;color:#f6d39a}
#wsum .line{display:flex;justify-content:space-between;gap:10px;padding:8px 10px;margin-bottom:4px;background:var(--card);border-radius:12px}
#wsum .line.col{flex-direction:column;gap:2px}
#wsum .ok{color:var(--good)}
#wsum .bad{color:var(--bad)}
#wsum .foot{display:flex;justify-content:flex-end;margin-top:16px}
#wsum .foot button{font-size:16px;padding:12px 22px;border-radius:14px}
@media (max-width:760px){#wsum .box{padding:16px}#wsum .foot button{width:100%}}
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
    // "click" (pointerdown değil): parmak kalkınca dokunuş alttaki "Haftayı başlat"a düşmesin
    this.el.addEventListener("click", (e) => {
      if ((e.target as HTMLElement).closest("button[data-close]")) this.close();
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** son kapanış anı (ms): hemen ardından gelen dokunuş haftayı başlatmasın */
  closedAt = 0;

  close(): void {
    this.open = false;
    this.closedAt = performance.now();
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
            if (d.note) return `<div class="line col"><span>${d.name} · ${d.note[0]}</span><span class="muted">${d.note[1]}</span></div>`;
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
