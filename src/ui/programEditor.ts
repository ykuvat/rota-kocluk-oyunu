// Program düzenleyici (GDD D4): 7 günlük ızgara, blok ekle/çıkar, konu-süre-tür seçimi.
// Taslak üzerinde canlı tahmin gösterir (gözlem aralıklarına dayalı); "Programı ver" setProgram komutunu gönderir.

import { TOPIC_BY_ID, TOPICS } from "../content/curriculum";
import { balancedProgram } from "../content/programs";
import { tk } from "../platform/i18n";
import { applyCommand } from "../sim/commands";
import { estimateProgram, sustainableRange } from "../sim/estimate";
import type { GameState } from "../sim/state";
import type { ProgramBlock, Student, TaskKind } from "../sim/student";

const KINDS: TaskKind[] = ["study", "practice", "review"];

const css = `
#program-editor{position:fixed;inset:0;background:rgba(10,8,12,.6);display:flex;align-items:center;justify-content:center;z-index:10}
#program-editor .box{background:#241d29;color:#f3e9dc;font:13px/1.45 system-ui,sans-serif;border-radius:10px;padding:16px 18px;
  width:min(1200px,96vw);max-height:92vh;overflow:auto;box-shadow:0 10px 40px #0008}
#program-editor .days{display:grid;grid-template-columns:repeat(7,1fr);gap:8px;margin:10px 0}
#program-editor .day{background:#30273a;border-radius:6px;padding:6px;min-width:0}
#program-editor .day h4{margin:0 0 4px;font-size:12px;display:flex;justify-content:space-between}
#program-editor .block{background:#3d3248;border-radius:5px;padding:5px;margin-bottom:5px}
#program-editor select,#program-editor input{width:100%;box-sizing:border-box;background:#1d1722;color:#f3e9dc;border:1px solid #5a4a66;
  border-radius:4px;font:12px system-ui,sans-serif;padding:2px;margin-bottom:3px}
#program-editor .inline{display:flex;gap:4px}
#program-editor button{background:#4a3b52;color:#f3e9dc;border:1px solid #6b5876;border-radius:5px;padding:4px 10px;cursor:pointer;font:12px system-ui,sans-serif}
#program-editor button.primary{background:#c9822b;border-color:#e9a23b;color:#1d1722;font-weight:600}
#program-editor .ok{color:#8fd694}#program-editor .risky{color:#e9c46a}#program-editor .over{color:#ff8a8a}
#program-editor .muted{color:#a99ab0}
`;

export class ProgramEditor {
  private root: HTMLDivElement | null = null;
  private draft: ProgramBlock[] = [];
  private student: Student | null = null;

  constructor(private readonly state: GameState, private readonly onClose: (message?: string) => void) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  get isOpen(): boolean {
    return this.root !== null;
  }

  open(studentId: string): void {
    const s = this.state.students.find((x) => x.id === studentId);
    if (!s) return;
    this.student = s;
    this.draft = s.program.map((b) => ({ ...b }));
    this.root = document.createElement("div");
    this.root.id = "program-editor";
    document.body.appendChild(this.root);
    this.root.addEventListener("click", (e) => this.onClick(e));
    this.root.addEventListener("change", (e) => this.onChange(e));
    this.render();
  }

  close(message?: string): void {
    this.root?.remove();
    this.root = null;
    this.onClose(message);
  }

  private onClick(e: Event): void {
    const t = e.target as HTMLElement;
    if (t === this.root) return this.close(); // dışarı tıklama
    const act = t.closest<HTMLElement>("[data-act]")?.dataset;
    if (!act || !this.student) return;
    switch (act.act) {
      case "add": {
        const day = Number(act.day);
        const topic = this.draft.filter((b) => b.weekday === day).at(-1)?.topicId ?? TOPICS[0].id;
        this.draft.push({ weekday: day, topicId: topic, hours: 1, kind: "study" });
        break;
      }
      case "remove":
        this.draft.splice(Number(act.i), 1);
        break;
      case "template":
        this.draft = balancedProgram(this.student);
        break;
      case "clear":
        this.draft = [];
        break;
      case "cancel":
        return this.close();
      case "save": {
        const r = applyCommand(this.state, { type: "setProgram", studentId: this.student.id, blocks: this.draft });
        return this.close(r.ok ? tk("feedback.programSet") : tk(`error.${r.error}`));
      }
    }
    this.render();
  }

  private onChange(e: Event): void {
    const el = e.target as HTMLInputElement | HTMLSelectElement;
    const i = Number(el.dataset.i);
    const b = this.draft[i];
    if (!b) return;
    if (el.dataset.f === "topic") b.topicId = el.value;
    if (el.dataset.f === "kind") b.kind = el.value as TaskKind;
    if (el.dataset.f === "hours") b.hours = Math.min(6, Math.max(0.5, Math.round(Number(el.value) * 2) / 2 || 0.5));
    this.render();
  }

  private render(): void {
    if (!this.root || !this.student) return;
    const s = this.student;
    const now = this.state.hour;
    const est = estimateProgram(s, this.draft, now);
    const sus = sustainableRange(s, now, 0);
    const susWe = sustainableRange(s, now, 5);
    const pct = (v: number) => `%${Math.round(v * 100)}`;

    const topicOptions = (selected: string) =>
      TOPICS.map((t) => {
        const label = `${tk(`subject.${t.subject}`)} · ${tk(t.nameKey)} (${tk("editor.mastery")} ${Math.round(s.mastery[t.id] ?? 0)} / ${tk("editor.difficulty")} ${t.difficulty})`;
        return `<option value="${t.id}" ${t.id === selected ? "selected" : ""}>${label}</option>`;
      }).join("");

    const days = [0, 1, 2, 3, 4, 5, 6].map((d) => {
      const blocks = this.draft.map((b, i) => ({ b, i })).filter((x) => x.b.weekday === d);
      const load = est.dayLoad[d];
      return `<div class="day"><h4><span>${tk(`day.${d}`)}</span><span class="${load}">${est.perDay[d].toFixed(1)} ${tk("panel.hours")}</span></h4>
        ${blocks.map(({ b, i }) => `<div class="block">
          <select data-i="${i}" data-f="topic">${topicOptions(b.topicId)}</select>
          <div class="inline">
            <select data-i="${i}" data-f="kind">${KINDS.map((k) => `<option value="${k}" ${k === b.kind ? "selected" : ""}>${tk(`kind.${k}`)}</option>`).join("")}</select>
            <input data-i="${i}" data-f="hours" type="number" min="0.5" max="6" step="0.5" value="${b.hours}" style="width:56px">
            <button data-act="remove" data-i="${i}" title="×">×</button>
          </div>
          <div class="muted" style="font-size:11px">${TOPIC_BY_ID[b.topicId].prereqs.map((p) => `${tk(`topic.${p}`)} ${Math.round(s.mastery[p] ?? 0)}`).join(" · ")}</div>
        </div>`).join("")}
        <button data-act="add" data-day="${d}">${tk("editor.add")}</button>
        <div class="${load}" style="font-size:11px;margin-top:4px">${tk(`editor.load.${load}`)}</div></div>`;
    }).join("");

    const total = est.perDay.reduce((a, b) => a + b, 0);
    this.root.innerHTML = `<div class="box">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div style="font-size:16px;font-weight:600">${tk("editor.title")} — ${s.name}</div>
        <div><button data-act="template">${tk("editor.template")}</button> <button data-act="clear">${tk("editor.clear")}</button></div>
      </div>
      <div class="muted">${tk("editor.sustainable")}: ${sus.lo}–${sus.hi} ${tk("panel.hours")} (${tk("day.5")}/${tk("day.6")}: ${susWe.lo}–${susWe.hi}) · ${total.toFixed(1)} ${tk("panel.hoursPerWeek")}</div>
      <div class="days">${days}</div>
      <div style="display:flex;justify-content:space-between;align-items:center">
        <div style="font-size:14px">${tk("editor.estimate")}: <b>${pct(est.compliance.mid)}</b> <span class="muted">(${pct(est.compliance.lo)}–${pct(est.compliance.hi)})</span></div>
        <div><button data-act="cancel">${tk("editor.cancel")}</button> <button class="primary" data-act="save">${tk("editor.save")}</button></div>
      </div></div>`;
  }
}
