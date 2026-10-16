// Değiştirici yığını: her türetilmiş değer = taban + kaynak etiketli değiştiriciler.
// "Neden?" paneli doğrudan bu kırılımdan üretilir; bir değerin nereden geldiği her zaman açıklanabilir.

export interface Modifier {
  /** Hangi değeri etkiler (ör. "motivation"). */
  stat: string;
  /** Açıklama anahtarı (ör. "session.trust", "fatigue.overload"). */
  source: string;
  /** Toplanan etki (çarpandan sonra uygulanır). */
  add?: number;
  /** Çarpan (1 = etkisiz). */
  mul?: number;
  /** Bu saatte (tick) sona erer; yoksa kalıcı. */
  until?: number;
}

export interface Contribution {
  source: string;
  delta: number;
}

export interface Breakdown {
  base: number;
  parts: Contribution[];
  /** Sınırlanmış son değer */
  value: number;
}

/**
 * Önce tüm çarpanlar tabana uygulanır, sonra toplananlar eklenir, en son [min,max] aralığına sınırlanır.
 * Her değiştiricinin katkısı ayrı ayrı raporlanır.
 */
export function evaluate(stat: string, base: number, mods: readonly Modifier[], now: number, min = 0, max = 100): Breakdown {
  const active = mods.filter((m) => m.stat === stat && (m.until === undefined || m.until > now));
  const parts: Contribution[] = [];
  let v = base;
  for (const m of active) {
    if (m.mul !== undefined && m.mul !== 1) {
      const next = v * m.mul;
      parts.push({ source: m.source, delta: next - v });
      v = next;
    }
  }
  for (const m of active) {
    if (m.add) {
      parts.push({ source: m.source, delta: m.add });
      v += m.add;
    }
  }
  const value = Math.min(max, Math.max(min, v));
  return { base, parts, value };
}

/** Süresi dolmuş değiştiricileri atar (kayıt dosyası şişmesin). */
export function pruneExpired(mods: Modifier[], now: number): Modifier[] {
  return mods.filter((m) => m.until === undefined || m.until > now);
}
