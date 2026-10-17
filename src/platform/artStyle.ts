// Görsel tarz seçimi: "cartoon" (çizgi film, varsayılan) ya da "pixel" (ilk tarz). Tarayıcıda saklanır;
// adres çubuğunda ?stil=cizgi / ?stil=piksel ile de seçilebilir.

export type ArtStyle = "pixel" | "cartoon";

const KEY = "rota.style.v1";

export function getArtStyle(): ArtStyle {
  try {
    const q = new URLSearchParams(location.search).get("stil");
    if (q === "cizgi" || q === "cartoon") return "cartoon";
    if (q === "piksel" || q === "pixel") return "pixel";
    // varsayılan çizgi film (kullanıcının hedeflediği görünüm); pixel art 🎨 ile seçilebilir
    return localStorage.getItem(KEY) === "pixel" ? "pixel" : "cartoon";
  } catch {
    return "cartoon";
  }
}

export function setArtStyle(s: ArtStyle): void {
  try {
    localStorage.setItem(KEY, s);
  } catch {
    /* depo yoksa yalnız bu oturum */
  }
}
