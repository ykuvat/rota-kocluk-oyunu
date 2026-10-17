// Oyun modu (sade arayüz) ortak parçaları: stil, ruh hâli, küçük yardımcılar.
// Oyuncu ham sayı görmez: öğrencinin iç durumu tek bir ruh hâline, para tek bir bakiyeye indirgenir.

import { tk } from "../../platform/i18n";
import { stat, type Student } from "../../sim/student";

export const fmt = (v: number) => Math.round(v).toLocaleString("tr-TR");

// Görünüm: yumuşak, sıcak "oyun" paneli — yuvarlak köşe, yarı saydam buzlu cam, başlıkta büyük harf yok, düğmeler hap biçimli.
// Mobil (≤ 760 px): üstte ince bilgi çubuğu, altta açılır-kapanır karar sayfası; oda arada görünür.
const css = `
:root{--ink:#fbf1e4;--muted:#c8b6c9;--soft:#e9dcea;--panel:rgba(46,35,52,.78);--panel-solid:#2e2334;--card:rgba(255,240,225,.07);
  --card-hi:rgba(255,240,225,.12);--accent:#f4bd62;--accent-2:#e9a14a;--good:#9be8ae;--bad:#ffaaa5;--line:rgba(255,235,215,.10);
  --font:"Nunito",system-ui,-apple-system,"Segoe UI",sans-serif;--radius:18px;--shadow:0 10px 30px rgba(10,5,15,.35)}
.pl{color:var(--ink);font:500 14px/1.45 var(--font);box-sizing:border-box;-webkit-font-smoothing:antialiased}
.pl *{box-sizing:border-box}
.pl .glass,#phud,#decisions,#strip,#stpop{background:var(--panel);backdrop-filter:blur(10px) saturate(1.1);-webkit-backdrop-filter:blur(10px) saturate(1.1);
  border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow)}
.pl button{font:700 13px/1.2 var(--font);color:var(--ink);background:var(--card-hi);border:0;border-radius:12px;padding:8px 12px;cursor:pointer;
  transition:background .15s,transform .08s;-webkit-tap-highlight-color:transparent}
.pl button:hover{background:rgba(255,240,225,.18)}
.pl button:active{transform:scale(.98)}
.pl button.primary{background:linear-gradient(180deg,#f8ca78,var(--accent-2));color:#3a2410;box-shadow:0 3px 0 #b97a2e,0 6px 14px rgba(233,161,74,.25)}
.pl button.primary:hover{background:linear-gradient(180deg,#ffd68e,#f0ab55)}
.pl button.primary .hint{color:#7a5222}
.pl button.ghost{background:transparent;color:var(--muted)}
.pl button.ghost:hover{background:var(--card)}
.pl button:disabled{opacity:.75;cursor:default}
.pl .muted{color:var(--muted)}
.pl .hint{font-weight:600;color:var(--muted);margin-left:auto;padding-left:8px;font-size:12px;white-space:nowrap}
.pl .toast{position:fixed;left:50%;transform:translateX(-50%);top:14px;z-index:40;background:#3c5f4a;color:var(--ink);max-width:calc(100vw - 24px);
  padding:10px 16px;border-radius:999px;box-shadow:var(--shadow);font:700 14px var(--font);transition:opacity .4s;text-align:center}
.pl .toast.bad{background:#7a3f47}
body.play #student-panel, body.play #inbox, body.play #history-btn, body.play #old-hud{display:none!important}
body.play #back-to-game{display:none}
#back-to-game{position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:40}
body.play #business-panel:not(.open){display:none!important}
body.play #business-panel.open{z-index:30;bottom:132px;width:380px;font:500 14px/1.5 var(--font);background:var(--panel-solid);border-radius:var(--radius);
  border:1px solid var(--line);box-shadow:var(--shadow);padding:14px 16px;overscroll-behavior:contain}
body.play #business-panel.open h3{text-transform:none;letter-spacing:0;font-size:16px;color:#f6d39a;margin:16px 0 6px}
body.play #business-panel.open .lead{background:var(--card);border-radius:14px;padding:12px 14px;margin-bottom:8px}
body.play #business-panel.open .lead b{font-size:15px}
body.play #business-panel.open .lead.now{outline:2px solid var(--accent)}
body.play #business-panel.open .muted{color:var(--muted)}
body.play #business-panel.open button{font-family:var(--font);font-weight:700;font-size:14px;border:0;border-radius:10px;padding:8px 12px;background:var(--card-hi)}
body.play #business-panel.open .tabs{position:sticky;top:-14px;background:var(--panel-solid);padding:2px 0 8px;z-index:1}
body.play #business-panel.open .tabs button{flex:1}
body.play #business-panel.open .tabs button.x{flex:none;background:transparent;color:var(--muted)}
body:not(.play) #business-panel .tabs button.x{display:none}
body.play #business-panel.open .tabs button.on{background:var(--accent);color:#3a2410}
body.play #business-panel.open input{font:600 14px var(--font);padding:6px 8px;width:96px}
body.play #business-panel.open .pbar span{background:var(--accent)}
body:not(.play) .pl-only{display:none!important}
body.play #history.open{left:auto;right:364px;transform:none;bottom:12px;top:auto;width:420px;max-height:calc(100vh - 24px);z-index:30;padding:14px 16px;
  font:500 14px/1.5 var(--font);background:var(--panel-solid);border:1px solid var(--line);border-radius:var(--radius);box-shadow:var(--shadow);overscroll-behavior:contain}
body.play #history.open h3{text-transform:none;letter-spacing:0;font-size:17px;color:#f6d39a;margin:0}
body.play #history.open .hh{position:sticky;top:-14px;background:var(--panel-solid);padding:2px 0 8px;z-index:1}
body.play #history.open .hh .x{font-size:20px;padding:4px 8px}
body.play #history.open .filters{display:flex;flex-wrap:wrap;gap:6px;margin-bottom:8px}
body.play #history.open .filters button{font:700 13px var(--font);border:0;border-radius:999px;padding:6px 12px;margin:0;background:var(--card-hi);color:var(--ink)}
body.play #history.open .filters button.on{background:var(--accent);color:#3a2410}
body.play #history.open .item{flex-direction:column;gap:0;padding:8px 2px;border-bottom:1px solid var(--line)}
body.play #history.open .when{width:auto;font-size:12px;color:var(--muted)}
body.play #history.open .bad{color:var(--bad)}
@media (max-width:760px){
  body.play #business-panel.open{left:8px;right:8px;width:auto;top:64px;bottom:8px;max-height:none;z-index:35}
  body.play #history.open{left:8px;right:8px;width:auto;top:64px;bottom:8px;max-height:none;z-index:35}
  /* telefonda açık panel tam ekran: altındaki şerit, karar sayfası ve eğitim balonu gizlenir (üst üste binmesin) */
  body.play:has(#business-panel.open) :is(#tut,#strip,#stpop,#decisions,#history),
  body.play:has(#history.open) :is(#tut,#strip,#stpop,#decisions){display:none!important}
  .pl .toast{top:62px;font-size:13px}
}
`;

/** Telefon düzeni mi (alt sayfa, üst çubuk)? CSS'teki kırılım noktasıyla aynı. */
export const isMobile = () => window.matchMedia("(max-width: 760px)").matches;

let injected = false;
export function injectPlayCss(): void {
  if (injected) return;
  injected = true;
  const style = document.createElement("style");
  style.textContent = css;
  document.head.appendChild(style);
}

export type Mood = "great" | "good" | "meh" | "bad" | "burnt";

export const MOOD_ICON: Record<Mood, string> = { great: "😄", good: "🙂", meh: "😐", bad: "😟", burnt: "😩" };

/** Öğrencinin iç durumunu tek bir ruh hâline indirger (oyuncuya sayı gösterilmez). */
export function moodOf(s: Student, now: number): Mood {
  const v = (k: Parameters<typeof stat>[1]) => stat(s, k, now).value;
  if (v("fatigue") >= 78) return "burnt";
  const score = v("motivation") * 0.4 + v("selfEfficacy") * 0.2 + v("trust") * 0.2 + v("goalOwnership") * 0.1 - v("anxiety") * 0.3 - v("fatigue") * 0.3 + 25;
  if (score >= 52) return "great";
  if (score >= 40) return "good";
  if (score >= 28) return "meh";
  return "bad";
}

export const moodLabel = (m: Mood) => `${MOOD_ICON[m]} ${tk(`mood.${m}`)}`;

/** Veli memnuniyeti yüzü. */
export function parentFace(sat: number): string {
  return sat >= 70 ? "😊" : sat >= 50 ? "🙂" : sat >= 30 ? "😕" : "😠";
}

/** Kimlik + hafta için sabit sayı (kart seçeneklerini karıştırmak için; Math.random yok). */
export function hash(text: string): number {
  let h = 2166136261;
  for (const ch of text) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** Ekranın üstünde kısa bildirim. */
let toastEl: HTMLDivElement | null = null;
let toastTimer = 0;
export function toast(text: string, bad = false): void {
  if (!toastEl) {
    toastEl = document.createElement("div");
    toastEl.className = "pl toast";
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = text;
  toastEl.classList.toggle("bad", bad);
  toastEl.style.opacity = "1";
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => {
    if (toastEl) toastEl.style.opacity = "0";
  }, 3200);
}
