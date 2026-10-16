// Yol gösteren ilk hafta: Buse oyuncuya ne yapacağını adım adım söyler. Her adım bir koşul gerçekleşince
// (ya da "Anladım" ile) ilerler. İlerleme tarayıcıda saklanır; yeni oyunda baştan başlar.

import { getLocale, tk } from "../../platform/i18n";
import type { GameState } from "../../sim/state";

const css = `
#tut{position:fixed;left:50%;transform:translateX(-50%);top:14px;width:min(560px,calc(100vw - 760px));min-width:320px;z-index:30;
  display:flex;gap:12px;align-items:flex-start;padding:12px 14px;background:#fff6e6;color:#2a1d2e;border-radius:14px;
  border:3px solid #f0b85a;box-shadow:0 8px 24px rgba(0,0,0,.4);font:15px/1.45 system-ui,sans-serif}
#tut img{width:48px;image-rendering:pixelated;flex:none}
#tut .txt{flex:1}
#tut .btns{display:flex;gap:6px;justify-content:flex-end;margin-top:8px}
#tut button{font:600 13px system-ui;border-radius:8px;padding:6px 10px;cursor:pointer;border:1px solid #c79a4c;background:#f0b85a;color:#2a1d12}
#tut button.skip{background:transparent;border-color:transparent;color:#8a7a8f}
.tut-glow{box-shadow:0 0 0 3px #f0b85a,0 0 24px 6px rgba(240,184,90,.7)!important;border-radius:12px}
`;

const KEY = "rota.tutorial.v1";
export const TUTORIAL_DONE = 99;

export interface TutorialCtx {
  state: GameState;
  /** bu hafta verilen öğrenci kararı sayısı */
  decisions(): number;
  /** hafta sonu ekranı açık mı (eğitim beklesin) */
  summaryOpen(): boolean;
  /** kaç hafta tamamlandı (bu oturumda) */
  weeksPlayed(): number;
}

interface Step {
  text: string;
  /** vurgulanacak öğe */
  glow?: string;
  /** koşul gerçekleşince sonraki adıma geçer; yoksa "Anladım" düğmesi */
  done?: (c: TutorialCtx) => boolean;
}

const STEPS: Step[] = [
  { text: "tut.1", glow: "#decisions", done: (c) => c.state.students.length >= 1 },
  { text: "tut.2", glow: "#strip" },
  { text: "tut.3", glow: "#decisions .main", done: (c) => c.weeksPlayed() >= 1 },
  { text: "tut.4", glow: "#decisions", done: (c) => c.decisions() >= 1 },
  { text: "tut.5", glow: "#phud" },
];

export class Tutorial {
  private readonly el: HTMLDivElement;
  private step: number;
  private lastKey = "";
  private glowEl: Element | null = null;

  constructor(private readonly ctx: TutorialCtx, buseUrl: string | null, fresh: boolean) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "tut";
    this.el.className = "pl-only";
    document.body.appendChild(this.el);
    this.step = fresh ? 0 : load();
    this.el.addEventListener("pointerdown", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-t]");
      if (!b) return;
      e.preventDefault();
      if (b.dataset.t === "skip") this.go(TUTORIAL_DONE);
      else this.go(this.step + 1);
    });
    this.buse = buseUrl;
  }

  private readonly buse: string | null;

  get active(): boolean {
    return this.step < STEPS.length;
  }

  private go(n: number): void {
    this.step = n >= STEPS.length ? TUTORIAL_DONE : n;
    save(this.step);
    this.render(true);
  }

  render(force = false): void {
    // koşullu adım tamamlandıysa ilerle (hafta sonu ekranı açıkken bekle)
    const st = STEPS[this.step];
    if (st?.done && !this.ctx.summaryOpen() && st.done(this.ctx)) {
      this.go(this.step + 1);
      return;
    }
    const key = `${this.step}|${getLocale()}|${this.ctx.summaryOpen()}`;
    if (!force && key === this.lastKey) return;
    this.lastKey = key;
    this.glowEl?.classList.remove("tut-glow");
    this.glowEl = null;
    if (!st || this.ctx.summaryOpen()) {
      this.el.style.display = "none";
      return;
    }
    this.el.style.display = "flex";
    this.el.innerHTML = `${this.buse ? `<img src="${this.buse}" alt="">` : ""}<div class="txt">${tk(st.text)}
      <div class="btns"><button class="skip" data-t="skip">${tk("tut.skip")}</button>${st.done ? "" : `<button data-t="next">${tk(this.step === STEPS.length - 1 ? "tut.start" : "tut.ok")}</button>`}</div></div>`;
    if (st.glow) {
      this.glowEl = document.querySelector(st.glow);
      this.glowEl?.classList.add("tut-glow");
    }
  }
}

function load(): number {
  try {
    return Number(localStorage.getItem(KEY) ?? 0);
  } catch {
    return 0;
  }
}

function save(n: number): void {
  try {
    localStorage.setItem(KEY, String(n));
  } catch {
    /* depo yoksa her oturumda baştan */
  }
}

export function resetTutorial(): void {
  save(0);
}
