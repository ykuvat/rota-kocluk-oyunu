// Ayarlar (☰): dil, görsel tarz, kaydet, rehberi yeniden göster, yeni oyun, ayrıntılı paneller.
// Önceden yalnız klavye kısayolları vardı (L, S, N); telefonda hiçbirine ulaşılamıyordu.

import { getLocale, tk, type Locale } from "../../platform/i18n";

export interface SettingsControls {
  artStyle: string;
  onLocale(l: Locale): void;
  onStyle(): void;
  onSave(): void;
  onTutorial(): void;
  onNewGame(): void;
  onDetails(): void;
}

const css = `
#psettings{position:fixed;left:12px;top:12px;width:340px;padding:14px 16px;z-index:36;background:var(--panel-solid)}
#psettings .hd{display:flex;justify-content:space-between;align-items:center;font-weight:800;font-size:17px;color:#f6d39a;margin-bottom:6px}
#psettings .hd .x{background:transparent;color:var(--muted);font-size:18px;padding:4px 8px}
#psettings .grp{margin-top:10px}
#psettings .lb{font-size:12.5px;color:var(--muted);margin-bottom:4px;font-weight:700}
#psettings .seg{display:flex;gap:6px}
#psettings .seg button{flex:1}
#psettings .seg button.on{background:var(--accent);color:#3a2410}
#psettings .act{display:flex;flex-direction:column;gap:6px;margin-top:12px}
#psettings .act button{text-align:left;padding:10px 12px}
#psettings .act button.danger{color:var(--bad)}
#psettings .confirm{background:rgba(255,170,165,.1);border-radius:12px;padding:10px;font-size:13px}
#psettings .confirm .row{display:flex;gap:6px;margin-top:8px}
#psettings .confirm .row button{flex:1;text-align:center}
#psettings .ok{color:var(--good);font-size:13px;margin-top:6px}
@media (max-width:760px){#psettings{left:8px;right:8px;top:8px;width:auto;max-height:calc(100dvh - 16px);overflow:auto}#psettings .det{display:none}}
`;

export class SettingsMenu {
  private readonly el: HTMLDivElement;
  private open = false;
  private confirmNew = false;
  private saved = false;

  constructor(private readonly c: SettingsControls) {
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
    this.el = document.createElement("div");
    this.el.id = "psettings";
    this.el.className = "pl pl-only glass";
    this.el.style.display = "none";
    document.body.appendChild(this.el);
    this.el.addEventListener("click", (e) => {
      const b = (e.target as HTMLElement).closest<HTMLButtonElement>("button[data-s]");
      if (!b) return;
      const a = b.dataset.s!;
      if (a === "close") return this.close();
      if (a === "tr" || a === "en") this.c.onLocale(a);
      if (a === "style") return this.c.onStyle();
      if (a === "save") {
        this.c.onSave();
        this.saved = true;
      }
      if (a === "tutorial") {
        this.c.onTutorial();
        return this.close();
      }
      if (a === "details") {
        this.c.onDetails();
        return this.close();
      }
      if (a === "new") this.confirmNew = true;
      if (a === "newNo") this.confirmNew = false;
      if (a === "newYes") return this.c.onNewGame();
      this.render();
    });
  }

  get isOpen(): boolean {
    return this.open;
  }

  toggle(): void {
    if (this.open) this.close();
    else {
      this.open = true;
      this.confirmNew = false;
      this.saved = false;
      this.render();
    }
  }

  close(): void {
    this.open = false;
    this.el.style.display = "none";
  }

  private render(): void {
    const loc = getLocale();
    const cartoon = this.c.artStyle === "cartoon";
    this.el.style.display = "block";
    this.el.innerHTML = `<div class="hd"><span>${tk("set.title")}</span><button class="x" data-s="close" aria-label="✕">✕</button></div>
      <div class="grp"><div class="lb">${tk("set.language")}</div><div class="seg">
        <button data-s="tr" class="${loc === "tr" ? "on" : ""}">Türkçe</button><button data-s="en" class="${loc === "en" ? "on" : ""}">English</button></div></div>
      <div class="grp"><div class="lb">${tk("set.style")}</div><div class="seg">
        <button data-s="${cartoon ? "" : "style"}" class="${cartoon ? "on" : ""}">${tk("set.cartoon")}</button>
        <button data-s="${cartoon ? "style" : ""}" class="${cartoon ? "" : "on"}">${tk("set.pixel")}</button></div></div>
      <div class="act">
        <button data-s="save">💾 ${tk("set.save")}</button>${this.saved ? `<div class="ok">✔ ${tk("set.saved")}</div>` : ""}
        <button data-s="tutorial">📘 ${tk("set.tutorial")}</button>
        <button data-s="details" class="det">🔍 ${tk("set.details")}</button>
        ${
          this.confirmNew
            ? `<div class="confirm">${tk("play.confirmNew")}<div class="row"><button data-s="newNo">${tk("set.cancel")}</button><button data-s="newYes" class="primary">${tk("set.newYes")}</button></div></div>`
            : `<button data-s="new" class="danger">🗑 ${tk("set.newGame")}</button>`
        }
      </div>`;
  }
}
