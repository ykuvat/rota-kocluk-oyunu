// Rakip hamlelerinin süren etkileri (fiyat savaşı, reklam bombardımanı). Döngüsel içe aktarmayı önlemek için ayrı, bağımlılıksız modül.

import type { GameState } from "./state";

export type MarketEffectKind = "priceWar" | "adBlitz";

export interface MarketEffect {
  kind: MarketEffectKind;
  rival: string;
  until: number;
  value: number;
}

export interface MarketState {
  effects: MarketEffect[];
  /** son sezon sonunda rakiplerin ilan ettiği başarı oranları */
  rivalRates: { name: string; rate: number }[];
}

export const createMarket = (): MarketState => ({ effects: [], rivalRates: [] });

const live = (state: GameState, kind: MarketEffectKind) => state.market.effects.filter((e) => e.kind === kind && e.until > state.hour);

/** Kayıt olasılığına süren fiyat savaşlarının logit katkısı (≤ 0). */
export const marketConversion = (state: GameState) => live(state, "priceWar").reduce((a, e) => a + e.value, 0);

/** Talep çarpanı: rakip reklamları pazarı paylaşır. */
export const marketDemand = (state: GameState) => live(state, "adBlitz").reduce((a, e) => a * e.value, 1);

export function pruneMarket(state: GameState): void {
  state.market.effects = state.market.effects.filter((e) => e.until > state.hour);
}
