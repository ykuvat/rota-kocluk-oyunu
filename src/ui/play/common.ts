// Oyun modu (sade arayüz) ortak parçaları: stil, ruh hâli, küçük yardımcılar.
// Oyuncu ham sayı görmez: öğrencinin iç durumu tek bir ruh hâline, para tek bir bakiyeye indirgenir.

import { tk } from "../../platform/i18n";
import { stat, type Student } from "../../sim/student";

export const fmt = (v: number) => Math.round(v).toLocaleString("tr-TR");

const css = `
:root{--ink:#f6ecdf;--muted:#b9a9c2;--panel:rgba(32,25,38,.94);--card:#3a2d44;--accent:#f0b85a;--good:#8fe3a0;--bad:#ff9d9d;--line:#5c4a68}
.pl{color:var(--ink);font:14px/1.45 system-ui,sans-serif;box-sizing:border-box}
.pl button{font:600 13px system-ui,sans-serif;color:var(--ink);background:#55426a;border:1px solid #7a6390;border-radius:8px;padding:6px 10px;cursor:pointer}
.pl button:hover{background:#6a5384}
.pl button.primary{background:var(--accent);border-color:var(--accent);color:#2a1d12}
.pl button.primary:hover{background:#ffd08a}
.pl button.primary .hint{color:#6b4a1f}
.pl button.ghost{background:transparent;border-color:var(--line);color:var(--muted)}
.pl .muted{color:var(--muted)}
.pl .hint{font-weight:400;color:var(--muted);margin-left:6px;font-size:12px}
.pl .toast{position:fixed;left:50%;transform:translateX(-50%);top:14px;z-index:40;background:#2f4a3a;color:var(--ink);
  padding:8px 14px;border-radius:10px;box-shadow:0 6px 20px rgba(0,0,0,.35);font:600 14px system-ui;transition:opacity .4s}
.pl .toast.bad{background:#5a2f36}
body.play #student-panel, body.play #inbox, body.play #history-btn, body.play #old-hud{display:none!important}
body.play #back-to-game{display:none}
#back-to-game{position:fixed;left:50%;transform:translateX(-50%);bottom:12px;z-index:40}
body.play #business-panel:not(.open){display:none!important}
body.play #business-panel.open{z-index:30;bottom:132px}
body:not(.play) .pl-only{display:none!important}
`;

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
