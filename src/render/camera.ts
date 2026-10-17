import type { Container } from "pixi.js";

/**
 * Pixel art için yakınlaştırma katları, **cihaz pikseli** cinsinden: bir sanat pikseli tam sayı kadar cihaz pikseline
 * (ya da genel bakış için yarım) denk gelir. Masaüstünde (dpr 1) 0,5/1/2/3; yüksek yoğunluklu telefonda ekrana
 * sığdırmak için 1/dpr gibi CSS katları da kullanılır, yine de her sanat pikseli keskin kalır.
 */
export const ZOOM_STEPS = [0.5, 1, 2, 3, 4, 5, 6, 8, 9] as const;

/** Arayüzün (CSS pikseli) en fazla yakınlığı. */
const MAX_CSS_ZOOM = 3;

/** Dünya kabını kaydıran ve yakınlaştıran basit kamera. Konum her zaman tam cihaz pikseline yuvarlanır. */
export class Camera {
  private readonly steps: number[];
  private zoomIndex: number;
  private x = 0;
  private y = 0;

  /**
   * @param dpr cihaz piksel oranı (renderer çözünürlüğü)
   * @param frame boyutu ölçülen kap (tuval yeniden boyutlanması pencere olayından sonra gelebilir; kap her zaman günceldir)
   */
  constructor(private readonly world: Container, private readonly view: HTMLElement, private readonly dpr = 1, private readonly frame: HTMLElement = view) {
    this.steps = ZOOM_STEPS.map((s) => s / dpr).filter((z) => z <= MAX_CSS_ZOOM);
    this.zoomIndex = Math.min(this.steps.length - 1, this.steps.indexOf(1 / dpr) + 1);
    this.bindInput();
  }

  /** CSS pikseli başına dünya pikseli. */
  get zoom(): number {
    return this.steps[this.zoomIndex];
  }

  /** Sağda arayüzün kapladığı genişlik (px); ortalama bu alanın dışında yapılır. */
  rightInset = 0;

  /** Altta arayüzün kapladığı yükseklik (px). */
  bottomInset = 0;

  /** Üstte arayüzün kapladığı yükseklik (px). */
  topInset = 0;

  /** Dünyadaki (wx, wy) noktasını görünür alanın (paneller hariç) ortasına getirir. */
  centerOn(wx: number, wy: number): void {
    this.x = (this.frame.clientWidth - this.rightInset) / 2 - wx * this.zoom;
    this.y = this.topInset + (this.frame.clientHeight - this.topInset - this.bottomInset) / 2 - wy * this.zoom;
    this.apply();
  }

  /** (w × h) dünya pikselini görünür alana sığdıran en büyük yakınlık katını seçer (hiçbiri sığmazsa en küçüğü). */
  fit(w: number, h: number): void {
    const aw = this.frame.clientWidth - this.rightInset - 16;
    const ah = this.frame.clientHeight - this.topInset - this.bottomInset - 16;
    let best = 0;
    this.steps.forEach((z, i) => {
      if (w * z <= aw && h * z <= ah) best = i;
    });
    this.zoomIndex = best;
  }

  private apply(): void {
    this.world.scale.set(this.zoom);
    // tam cihaz pikseline: pixel art titremesin
    this.world.position.set(Math.round(this.x * this.dpr) / this.dpr, Math.round(this.y * this.dpr) / this.dpr);
  }

  private zoomAt(dir: 1 | -1, sx: number, sy: number): void {
    const next = Math.min(this.steps.length - 1, Math.max(0, this.zoomIndex + dir));
    if (next === this.zoomIndex) return;
    // imlecin altındaki dünya noktası sabit kalsın
    const wx = (sx - this.x) / this.zoom;
    const wy = (sy - this.y) / this.zoom;
    this.zoomIndex = next;
    this.x = sx - wx * this.zoom;
    this.y = sy - wy * this.zoom;
    this.apply();
  }

  private bindInput(): void {
    // sürükleme: tek parmak/fare kaydırır; iki parmak kıstırma yakınlaştırır
    const pts = new Map<number, { x: number; y: number }>();
    let pinch: { d: number; cx: number; cy: number } | null = null;
    const dist = () => {
      const [a, b] = [...pts.values()];
      return { d: Math.hypot(a.x - b.x, a.y - b.y), cx: (a.x + b.x) / 2, cy: (a.y + b.y) / 2 };
    };
    this.view.style.touchAction = "none";
    this.view.addEventListener("pointerdown", (e) => {
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pts.size === 2) pinch = dist();
    });
    const end = (e: PointerEvent) => {
      pts.delete(e.pointerId);
      if (pts.size < 2) pinch = null;
    };
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    window.addEventListener("pointermove", (e) => {
      const p = pts.get(e.pointerId);
      if (!p) return;
      if (pinch && pts.size === 2) {
        pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
        const now = dist();
        // eşik aşılınca bir kat değiştir (katlar ayrık: piksel keskinliği)
        if (now.d / pinch.d > 1.35 || now.d / pinch.d < 0.74) {
          this.zoomAt(now.d > pinch.d ? 1 : -1, now.cx, now.cy);
          pinch = now;
        }
        return;
      }
      this.x += e.clientX - p.x;
      this.y += e.clientY - p.y;
      pts.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.apply();
    });
    this.view.addEventListener(
      "wheel",
      (e) => {
        e.preventDefault();
        this.zoomAt(e.deltaY < 0 ? 1 : -1, e.clientX, e.clientY);
      },
      { passive: false },
    );
  }
}
