import type { Container } from "pixi.js";

/** Pixel art için izin verilen yakınlaştırma katları: tam sayılar + genel bakış için 0,5. */
export const ZOOM_STEPS = [0.5, 1, 2, 3] as const;

/** Dünya kabını kaydıran ve yakınlaştıran basit kamera. Konum her zaman tam piksele yuvarlanır. */
export class Camera {
  private zoomIndex = 2;
  private x = 0;
  private y = 0;

  constructor(private readonly world: Container, private readonly view: HTMLElement) {
    this.bindInput();
  }

  get zoom(): number {
    return ZOOM_STEPS[this.zoomIndex];
  }

  /** Sağda arayüzün kapladığı genişlik (px); ortalama bu alanın dışında yapılır. */
  rightInset = 0;

  /** Altta arayüzün kapladığı yükseklik (px). */
  bottomInset = 0;

  /** Dünyadaki (wx, wy) noktasını görünür alanın (sağ panel ve alt şerit hariç) ortasına getirir. */
  centerOn(wx: number, wy: number): void {
    this.x = (this.view.clientWidth - this.rightInset) / 2 - wx * this.zoom;
    this.y = (this.view.clientHeight - this.bottomInset) / 2 - wy * this.zoom;
    this.apply();
  }

  /** (w × h) dünya pikselini görünür alana sığdıran en büyük yakınlık katını seçer. */
  fit(w: number, h: number): void {
    const aw = this.view.clientWidth - this.rightInset - 24;
    const ah = this.view.clientHeight - this.bottomInset - 24;
    let best = 0;
    ZOOM_STEPS.forEach((z, i) => {
      if (w * z <= aw && h * z <= ah) best = i;
    });
    this.zoomIndex = best;
  }

  private apply(): void {
    this.world.scale.set(this.zoom);
    this.world.position.set(Math.round(this.x), Math.round(this.y));
  }

  private zoomAt(dir: 1 | -1, sx: number, sy: number): void {
    const next = Math.min(ZOOM_STEPS.length - 1, Math.max(0, this.zoomIndex + dir));
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
    let drag: { px: number; py: number } | null = null;
    this.view.addEventListener("pointerdown", (e) => (drag = { px: e.clientX, py: e.clientY }));
    window.addEventListener("pointerup", () => (drag = null));
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      this.x += e.clientX - drag.px;
      this.y += e.clientY - drag.py;
      drag = { px: e.clientX, py: e.clientY };
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
