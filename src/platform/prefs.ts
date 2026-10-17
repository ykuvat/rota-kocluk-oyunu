// Oyuncu tercihleri (tarayıcıda): dil. Depo yoksa yalnız bu oturum.

import type { Locale } from "./i18n";

const KEY = "rota.locale.v1";

export function loadLocale(): Locale | null {
  try {
    const v = localStorage.getItem(KEY);
    return v === "tr" || v === "en" ? v : null;
  } catch {
    return null;
  }
}

export function saveLocale(l: Locale): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* depo yok */
  }
}
