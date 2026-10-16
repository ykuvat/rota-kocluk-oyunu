// Öğrenci kartı (GDD D11): oyuncu öğrenciyi gözlem aralıkları, sinyaller ve denemeler üzerinden okur;
// durumu YALNIZ komutlarla değiştirir. Panel her kare yeniden çizilmez; değişiklik olunca (saat, komut, dil) çizilir.

import { SUBJECTS } from "../content/curriculum";
import { examIso } from "../sim/season";
import { INTERVENTIONS, INTERVIEW_TOPICS, type InterventionId } from "../content/interventions";
import { balancedProgram } from "../content/programs";
import { getLocale, tf, tk } from "../platform/i18n";
import { calendarAt, daysUntil } from "../sim/calendar";
import { parentSignals, satisfactionWord } from "../sim/parent";
import { applyCommand, type Command } from "../sim/commands";
import { observe, weeklySignals } from "../sim/insight";
import { coaches } from "../sim/staff";
import type { GameState } from "../sim/state";
import { stat, type StateStat, type Student } from "../sim/student";

/** Panel düğmelerinin eylemleri: simülasyon komutları + yalnız arayüze ait iki eylem. */
type PanelAction = Command | { type: "balanced"; studentId: string } | { type: "editProgram"; studentId: string };

const STATS: StateStat[] = ["motivation", "selfEfficacy", "goalOwnership", "trust", "anxiety", "fatigue", "routine", "distraction", "sleep"];

const css = `
#student-panel{position:fixed;right:12px;top:12px;bottom:12px;width:340px;overflow:auto;padding:12px 14px;color:#f3e9dc;
  background:rgba(30,24,34,.92);font:13px/1.45 system-ui,sans-serif;border-radius:8px;box-sizing:border-box}
#student-panel h3{margin:10px 0 4px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#c9a96e}
#student-panel .row{display:flex;align-items:center;gap:8px;margin:2px 0}
#student-panel .lbl{width:118px;flex:none}
#student-panel .track{position:relative;flex:1;height:8px;background:#3a3140;border-radius:4px}
#student-panel .band{position:absolute;top:0;height:8px;background:#e9a23b88;border-radius:4px}
#student-panel .true{position:absolute;top:-2px;width:2px;height:12px;background:#7de3ff}
#student-panel .ins{width:34px;text-align:right;color:#a99ab0;font-size:11px}
#student-panel button{background:#4a3b52;color:#f3e9dc;border:1px solid #6b5876;border-radius:5px;padding:4px 8px;margin:2px 2px 2px 0;
  font:12px system-ui,sans-serif;cursor:pointer}
#student-panel button:hover{background:#5d4a68}
#student-panel .muted{color:#a99ab0}
#student-panel .toast{margin-top:8px;padding:6px 8px;border-radius:5px;background:#2f4a3a}
#student-panel .toast.bad{background:#5a2f36}
#student-panel .spark{display:flex;align-items:flex-end;gap:3px;height:40px;margin:4px 0}
#student-panel .spark span{width:14px;background:#e9a23b;border-radius:2px 2px 0 0}
`;

export class StudentPanel {
  private readonly el: HTMLDivElement;
  private toast: { text: string; bad: boolean } | null = null;
  private lastKey = "";
  debug = false;

  constructor(private readonly state: GameState, private readonly onEditProgram: (studentId: string) => void) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "student-panel";
    document.body.appendChild(this.el);
    // olay devri: içerik yeniden çizilse de düğmeler çalışır; pointerdown, yeniden çizim arasında tıklama kaybolmasın diye
    this.el.addEventListener("pointerdown", (e) => {
      const tab = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-tab]");
      if (tab) {
        this.selected = tab.dataset.tab!;
        this.toast = null;
        this.render(true);
        return;
      }
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-cmd]");
      if (!btn) return;
      e.preventDefault();
      this.run(JSON.parse(btn.dataset.cmd!) as PanelAction);
    });
  }

  /** Dışarıdan bir öğrenciyi seç (oyun modundan "Ayrıntılar"). */
  select(id: string): void {
    this.selected = id;
    this.render(true);
  }

  /** Panel dışından (ör. program düzenleyici) geri bildirim göstermek için. */
  showToast(text: string, bad = false): void {
    this.toast = { text, bad };
    this.render(true);
  }

  private run(cmd: PanelAction): void {
    const s = this.state.students.find((x) => "studentId" in cmd && x.id === cmd.studentId);
    if (!s) return;
    if (cmd.type === "editProgram") return this.onEditProgram(s.id);
    const real: Command = cmd.type === "balanced" ? { type: "setProgram", studentId: s.id, blocks: balancedProgram(s) } : cmd;
    const r = applyCommand(this.state, real);
    if (!r.ok) this.toast = { text: tk(`error.${r.error}`), bad: true };
    else if (real.type === "interview") this.toast = { text: tf("feedback.interview", { name: s.name }), bad: false };
    else if (real.type === "setProgram") this.toast = { text: tk("feedback.programSet"), bad: false };
    else if (real.type === "parentMeeting") this.toast = { text: tk("feedback.parentMeeting"), bad: false };
    else if (real.type === "intervene") {
      const key = r.matched === true ? "feedback.matched" : r.matched === false && s.history.length ? "feedback.mismatched" : "feedback.neutral";
      this.toast = { text: tf(key, { name: s.name }), bad: key === "feedback.mismatched" };
    }
    this.render(true);
  }

  /** Seçili öğrenci (sekmeler); yoksa ilk aktif öğrenci. */
  private selected: string | null = null;

  render(force = false): void {
    const students = this.state.students;
    const key = `${this.state.hour}|${this.state.coach.usedThisWeek}|${students.length}|${this.selected}|${getLocale()}|${this.debug}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    if (!students.length) {
      this.el.innerHTML = `<div class="muted">${tk("panel.noStudents")}</div>${this.toast ? `<div class="toast ${this.toast.bad ? "bad" : ""}">${this.toast.text}</div>` : ""}`;
      return;
    }
    const current = students.find((s) => s.id === this.selected) ?? students.find((s) => !s.left) ?? students[0];
    this.selected = current.id;
    const tabs = students
      .map((s) => `<button data-tab="${s.id}" style="${s.id === current.id ? "background:#c9822b;color:#1d1722" : ""}${s.left ? ";opacity:.5" : ""}">${s.name.split(" ")[0]}</button>`)
      .join("");
    this.el.innerHTML = `<div style="margin-bottom:6px">${tabs}</div>${this.card(current)}`;
  }

  /** Takip koçu seçimi (yalnız ekip varsa). */
  private coachHtml(s: Student, cmd: (c: object) => string): string {
    const members = coaches(this.state);
    if (!members.length) return "";
    const opt = (id: string | null, label: string) => {
      const on = (s.coachId ?? null) === id;
      return `<button ${cmd({ type: "assignCoach", studentId: s.id, coachId: id })} style="${on ? "background:#c9822b;color:#1d1722" : ""}">${label}</button>`;
    };
    return `<h3>${tk("panel.coach")}</h3>${opt(null, tk("panel.coachSelf"))}${members.map((m) => opt(m.id, m.name.split(" ")[0])).join("")}`;
  }

  private card(s: Student): string {
    const now = this.state.hour;
    const cmd = (c: object) => `data-cmd='${JSON.stringify(c)}'`;
    if (s.graduated && s.examResult) {
      const r = s.examResult;
      return `<div class="toast ${r.goalMet ? "" : "bad"}">${tf(r.goalMet ? "panel.gradMet" : "panel.gradMissed", { name: s.name, net: r.net.toFixed(2), rank: r.rank.toLocaleString("tr-TR"), target: r.targetNet })}</div>`;
    }
    if (s.left) return `<div class="toast bad">${tf("panel.left", { name: s.name })}</div>`;

    const week = calendarAt(now).weekIndex;
    const par = s.parent;
    const parentSig = parentSignals(s, week);
    const parentHtml = `
      <div>${par.known ? `${tk(`parent.style.${par.style}`)} · ${tk(satisfactionWord(par.satisfaction))}` : `<span class="muted">${tk("panel.parentUnknown")}</span>`}</div>
      ${parentSig.map((x) => `<div>• ${tk(x)}</div>`).join("")}
      <button ${cmd({ type: "parentMeeting", studentId: s.id })}>${tk("panel.parentMeeting")}</button>`;

    const rows = STATS.map((k) => {
      const o = observe(s, k, now);
      const real = stat(s, k, now).value;
      return `<div class="row"><span class="lbl">${tk(`stat.${k}`)}</span><span class="track">
        <span class="band" style="left:${o.lo}%;width:${Math.max(2, o.hi - o.lo)}%"></span>
        ${this.debug ? `<span class="true" style="left:${real}%"></span>` : ""}</span><span class="ins">${o.insight}%</span></div>`;
    }).join("");

    const signals = weeklySignals(s);
    const sigHtml = signals.length ? signals.map((x) => `<div>• ${tk(x)}</div>`).join("") : `<div class="muted">${tk("panel.noSignals")}</div>`;

    const mocks = s.mocks.slice(-8);
    const max = 80;
    const mockHtml = mocks.length
      ? `<div class="spark">${mocks.map((m) => `<span title="${m.total}" style="height:${Math.max(2, (m.total / max) * 40)}px"></span>`).join("")}</div>
         <div class="muted">${SUBJECTS.map((sub) => `${sub.toUpperCase()} ${mocks.at(-1)!.nets[sub]}`).join(" · ")} · Σ ${mocks.at(-1)!.total}</div>`
      : `<div class="muted">${tk("panel.noMocks")}</div>`;

    const perDay = [0, 1, 2, 3, 4, 5, 6].map((d) => s.program.filter((b) => b.weekday === d).reduce((a, b) => a + b.hours, 0));
    const total = perDay.reduce((a, b) => a + b, 0);

    const interviews = Object.keys(INTERVIEW_TOPICS)
      .map((topic) => `<button ${cmd({ type: "interview", studentId: s.id, topic })}>${tk(`interview.${topic}`)}</button>`)
      .join("");
    const ivs = (Object.keys(INTERVENTIONS) as InterventionId[])
      .map((id) => `<button ${cmd({ type: "intervene", studentId: s.id, intervention: id })}>${tk(INTERVENTIONS[id].nameKey)} · ${INTERVENTIONS[id].hours} ${tk("panel.hours")}</button>`)
      .join("");

    return `
      <div style="font-size:15px;font-weight:600">${s.name}</div>
      <div class="muted">${tf("panel.grade", { n: s.grade })} · ${tk("panel.firstImpression")}: ${tk(`archetype.${s.archetype}`)} · ${tk("panel.daysToExam")}: ${daysUntil(now, examIso(this.state.season.index + (s.grade === 11 ? 1 : 0)))}</div>
      <h3>${tk("panel.observed")}</h3>${rows}
      <h3>${tk("panel.signals")}</h3>${sigHtml}
      <h3>${tk("panel.mocks")}</h3>${mockHtml}
      <h3>${tk("panel.program")}</h3>
      <div class="muted">${perDay.map((h) => h.toFixed(1)).join(" · ")} = ${total.toFixed(1)} ${tk("panel.hoursPerWeek")}</div>
      <button ${cmd({ type: "editProgram", studentId: s.id })}>${tk("panel.editProgram")}</button>
      <button ${cmd({ type: "balanced", studentId: s.id })}>${tk("panel.writeBalanced")}</button>
      ${this.coachHtml(s, cmd)}
      <h3>${tk("panel.parent")}</h3>${parentHtml}
      <h3>${tk("panel.interview")}</h3>${interviews}
      <h3>${tk("panel.interventions")}</h3>${ivs}
      ${this.toast ? `<div class="toast ${this.toast.bad ? "bad" : ""}">${this.toast.text}</div>` : ""}
      <div class="muted" style="margin-top:8px">${tk("panel.debug")}</div>`;
  }
}
