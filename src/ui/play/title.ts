// KUVAT LABS — Rota
// Açılış ekranı: oyunun adı, Devam et / Yeni oyun, dil ve imza. Oyun arkada (bulanık) görünür.
// Yeni oyun ya da tarz değişimi sayfayı yeniler; o yenilemede açılış bir kez atlanır (iki kez "başla" denmesin).

import { getLocale, tk, type Locale } from "../../platform/i18n";

const css = `
#ptitle{position:fixed;inset:0;z-index:60;display:flex;align-items:center;justify-content:center;padding:16px;
  background:radial-gradient(120% 90% at 50% 40%,rgba(46,35,52,.55),rgba(20,12,24,.9));backdrop-filter:blur(7px);-webkit-backdrop-filter:blur(7px);
  transition:opacity .35s ease}
#ptitle.out{opacity:0;pointer-events:none}
#ptitle .box{width:min(440px,100%);text-align:center;animation:trise .5s ease-out}
#ptitle .hero{height:150px;display:flex;justify-content:center;align-items:flex-end;margin-bottom:6px}
#ptitle .hero img{height:150px;filter:drop-shadow(0 10px 14px rgba(0,0,0,.45));animation:tbob 3.2s ease-in-out infinite}
#ptitle h1{margin:0;font:800 54px/1 var(--font);letter-spacing:-.02em;color:#ffdc9a;text-shadow:0 3px 0 #b97a2e,0 10px 26px rgba(233,161,74,.35)}
#ptitle .tag{font:700 17px var(--font);color:var(--soft);margin:8px 0 4px}
#ptitle .desc{color:var(--muted);font-size:14px;margin-bottom:20px}
#ptitle .btns{display:flex;flex-direction:column;gap:8px;max-width:300px;margin:0 auto}
#ptitle .btns button{font-size:17px;padding:13px;border-radius:14px}
#ptitle .confirm{background:rgba(255,170,165,.1);border-radius:14px;padding:12px;font-size:13.5px;max-width:300px;margin:0 auto}
#ptitle .confirm .row{display:flex;gap:6px;margin-top:10px}
#ptitle .confirm .row button{flex:1}
#ptitle .lang{display:flex;justify-content:center;gap:6px;margin-top:16px}
#ptitle .lang button{padding:5px 12px;font-size:12.5px}
#ptitle .lang button.on{background:var(--accent);color:#3a2410}
#ptitle .sign{display:flex;align-items:center;justify-content:center;gap:8px;margin-top:22px;color:var(--muted);font:800 11px var(--font);letter-spacing:.14em}
#ptitle .sign img{height:22px;opacity:.9}
@keyframes trise{from{transform:translateY(14px);opacity:0}to{transform:none;opacity:1}}
@keyframes tbob{0%,100%{transform:translateY(0)}50%{transform:translateY(-5px)}}
@media (max-width:760px){#ptitle h1{font-size:44px}#ptitle .hero,#ptitle .hero img{height:120px}}
@media (prefers-reduced-motion:reduce){#ptitle .box,#ptitle .hero img{animation:none}}
`;

const SKIP_KEY = "rota.skipTitle";

/** Bir sonraki yüklemede açılışı atla (yeni oyun, tarz değişimi). */
export function skipTitleOnce(): void {
  try {
    sessionStorage.setItem(SKIP_KEY, "1");
  } catch {
    /* depo yok: açılış yeniden görünür */
  }
}

export interface TitleControls {
  hasSave: boolean;
  /** kayıtlı oyunun kısa özeti (ör. "12. hafta · 5 öğrenci"); kayıt yoksa boş */
  saveLine: string;
  heroUrl: string | null;
  logoUrl: string;
  onLocale(l: Locale): void;
  onNewGame(): void;
}

export class TitleScreen {
  private readonly el: HTMLDivElement;
  private open = true;
  private confirmNew = false;

  constructor(private readonly c: TitleControls) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "ptitle";
    this.el.className = "pl";
    document.body.appendChild(this.el);
    let skip = false;
    try {
      skip = sessionStorage.getItem(SKIP_KEY) === "1";
      sessionStorage.removeItem(SKIP_KEY);
    } catch {
      /* depo yok */
    }
    if (skip) {
      this.open = false;
      this.el.remove();
      return;
    }
    this.el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-t]");
      if (!b) return;
      const a = b.dataset.t!;
      if (a === "go") return this.close();
      if (a === "tr" || a === "en") this.c.onLocale(a);
      if (a === "new") {
        if (!this.c.hasSave) return this.close();
        this.confirmNew = true;
      }
      if (a === "newNo") this.confirmNew = false;
      if (a === "newYes") return this.c.onNewGame();
      this.render();
    });
    this.render();
  }

  get isOpen(): boolean {
    return this.open;
  }

  /** Oyuna geç (Enter/Boşluk da buraya düşer). */
  close(): void {
    if (!this.open) return;
    this.open = false;
    this.el.classList.add("out");
    window.setTimeout(() => this.el.remove(), 400);
  }

  private render(): void {
    const loc = getLocale();
    const c = this.c;
    const buttons = this.confirmNew
      ? `<div class="confirm">${tk("play.confirmNew")}<div class="row"><button data-t="newNo">${tk("set.cancel")}</button><button data-t="newYes" class="primary">${tk("set.newYes")}</button></div></div>`
      : `<div class="btns">${
          c.hasSave
            ? `<button class="primary" data-t="go">▶ ${tk("title.continue")}<div class="hint" style="margin:2px 0 0;padding:0">${c.saveLine}</div></button><button data-t="new">${tk("set.newGame")}</button>`
            : `<button class="primary" data-t="go">▶ ${tk("title.start")}</button>`
        }</div>`;
    this.el.innerHTML = `<div class="box">
      <div class="hero">${c.heroUrl ? `<img src="${c.heroUrl}" alt="">` : ""}</div>
      <h1>Rota</h1>
      <div class="tag">${tk("title.tag")}</div>
      <div class="desc">${tk("title.desc")}</div>
      ${buttons}
      <div class="lang"><button data-t="tr" class="${loc === "tr" ? "on" : "ghost"}">Türkçe</button><button data-t="en" class="${loc === "en" ? "on" : "ghost"}">English</button></div>
      <div class="sign"><img src="${c.logoUrl}" alt=""><span>KUVAT LABS</span></div></div>`;
  }
}
