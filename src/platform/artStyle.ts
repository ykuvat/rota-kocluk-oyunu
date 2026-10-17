// Görsel tarz seçimi (deneme): "pixel" (mevcut) ya da "cartoon" (çizgi film). Tarayıcıda saklanır;
// adres çubuğunda ?stil=cizgi / ?stil=piksel ile de seçilebilir.

export type ArtStyle = "pixel" | "cartoon";

const KEY = "rota.style.v1";

export function getArtStyle(): ArtStyle {
  try {
    const q = new URLSearchParams(location.search).get("stil");
    if (q === "cizgi" || q === "cartoon") return "cartoon";
    if (q === "piksel" || q === "pixel") return "pixel";
    return localStorage.getItem(KEY) === "cartoon" ? "cartoon" : "pixel";
  } catch {
    return "pixel";
  }
}

export function setArtStyle(s: ArtStyle): void {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* depo yoksa yalnız bu oturum */
  }
}
