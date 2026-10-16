// Üst-sol bilgi şeridi: zaman, hız, koç saati. Simülasyonu yalnız OKUR.

import { calendarAt } from "../sim/calendar";
import { monthlyForecast } from "../sim/economy";
import { coachHours, type GameState } from "../sim/state";
import { t, tk } from "../platform/i18n";

export interface HudView {
  zoom: number;
  speed: number;
  paused: boolean;
}

export function createHudElement(): HTMLDivElement {
  const el = document.createElement("div");
  Object.assign(el.style, {
    position: "fixed", left: "12px", top: "12px", padding: "8px 12px", color: "#f3e9dc", maxWidth: "420px",
    background: "rgba(30,24,34,0.85)", font: "13px/1.5 system-ui, sans-serif", borderRadius: "6px", pointerEvents: "none",
  });
  document.body.appendChild(el);
  return el;
}

export function renderHud(el: HTMLElement, state: GameState, view: HudView): void {
  const c = calendarAt(state.hour);
  const time = `${c.iso} · ${tk(`day.${c.weekday}`)} ${String(c.hourOfDay).padStart(2, "0")}:00`;
  const clock = view.paused ? `<b style="color:#ff8a8a">${t("hud.paused")}</b>` : `${t("hud.speed")}: ${view.speed}x`;
  const e = state.economy;
  const f = monthlyForecast(state);
  const net = f.income - f.personalCosts - f.advertising - f.office;
  const money = (v: number) => `<span style="color:${v < 0 ? "#ff8a8a" : "#f3e9dc"}">${Math.round(v).toLocaleString("tr-TR")} ₺</span>`;
  el.innerHTML = [
    `<b>${t("hud.title")}</b>`,
    `${time} · ${clock} · ${t("hud.zoom")}: ${view.zoom}x`,
    `${tk("money.personal")}: ${money(e.personal)} · ${tk("money.business")}: ${money(e.business)} · ${tk("money.monthlyNet")}: ${money(net)}`,
    `${t("hud.coachHours")}: ${state.coach.usedThisWeek}/${coachHours(state)} · ${tk("rep.awareness")} ${Math.round(state.reputation.awareness)} · ${tk("rep.trust")} ${Math.round(state.reputation.trust)}`,
    `<span style="color:#a99ab0">${t("hud.help")}</span>`,
  ].map((l) => `<div>${l}</div>`).join("");
}
