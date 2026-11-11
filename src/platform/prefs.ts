// Oyuncu tercihleri (tarayıcıda): dil, ses. Depo yoksa yalnız bu oturum.

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

const SOUND_KEY = "rota.sound.v1";

/** Ses efektleri açık mı (varsayılan açık). */
export function loadSoundOn(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveSoundOn(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? "1" : "0");
  } catch {
    /* depo yok */
  }
}

const MUSIC_KEY = "rota.music.v1";

/** Müzik açık mı (varsayılan açık). */
export function loadMusicOn(): boolean {
  try {
    return localStorage.getItem(MUSIC_KEY) !== "0";
  } catch {
    return true;
  }
}

export function saveMusicOn(on: boolean): void {
  try {
    localStorage.setItem(MUSIC_KEY, on ? "1" : "0");
  } catch {
    /* depo yok */
  }
}

export function saveLocale(l: Locale): void {
  try {
    localStorage.setItem(KEY, l);
  } catch {
    /* depo yok */
  }
}
