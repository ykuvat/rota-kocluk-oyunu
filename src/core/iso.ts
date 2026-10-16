// İzometrik geometri: 2:1 dimetrik, 1 karo = 1 m = 128 x 64 px.
// Karo ekseni: +x ekranda sağ-aşağı, +y ekranda sol-aşağı. (0,0) karosunun üst köşesi = dünya orijini.

export const TILE_W = 128;
export const TILE_H = 64;
export const HALF_W = TILE_W / 2;
export const HALF_H = TILE_H / 2;
/** Dikey 1 metrenin ekran karşılığı (karakter ve mobilya yüksekliği için). */
export const PX_PER_METER_UP = 78;

export interface Point {
  x: number;
  y: number;
}

/** Karo koordinatı (kesirli olabilir) -> ekran pikseli (o noktanın zemindeki izdüşümü). */
export function tileToScreen(tx: number, ty: number): Point {
  return { x: (tx - ty) * HALF_W, y: (tx + ty) * HALF_H };
}

/** Ekran pikseli -> karo koordinatı (zemin düzleminde). */
export function screenToTile(sx: number, sy: number): Point {
  return {
    x: (sy / HALF_H + sx / HALF_W) / 2,
    y: (sy / HALF_H - sx / HALF_W) / 2,
  };
}

/** Bir taban izinin (x,y konumunda, fx x fy karo) ekranda en alttaki köşesi. */
export function footprintBottom(x: number, y: number, fx: number, fy: number): Point {
  return tileToScreen(x + fx, y + fy);
}

/**
 * Sprite'ın alt-orta çapası taban izinin alt köşesinin neresine düşmeli:
 * baklava fx ve fy farklıysa yatay merkez alt köşeden (fx - fy) * HALF_W / 2 kadar kayar.
 */
export function footprintAnchorOffsetX(fx: number, fy: number): number {
  return ((fx - fy) * HALF_W) / 2;
}

/**
 * Çizim sırası anahtarı: taban izinin ön köşesi (x+fx, y+fy) ekrana ne kadar yakınsa o kadar sonra çizilir.
 * Eşitlikte arkadaki köşe (x+y) ikinci ölçüt olur.
 */
export function depthKey(x: number, y: number, fx: number, fy: number): number {
  return (x + fx + y + fy) * 1000 + (x + y);
}
