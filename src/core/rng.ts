// Tohumlu, deterministik rastgele sayı üreteci (mulberry32).
// Simülasyonda Math.random KULLANILMAZ: aynı tohum + aynı komutlar = aynı sonuç.

export interface Rng {
  /** [0, 1) */
  next(): number;
  /** [min, max] tam sayı */
  int(min: number, max: number): number;
  /** Üretecin anlık durumu (kayıt dosyasına yazılır). */
  state(): number;
}

export function createRng(seed: number): Rng {
  let s = seed >>> 0;
  const next = () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return {
    next,
    int: (min, max) => min + Math.floor(next() * (max - min + 1)),
    state: () => s,
  };
}
