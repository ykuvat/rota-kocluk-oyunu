"""PixelLab çıktısını oyuna alır: saydam kenarları kırpar, tam sayı katıyla (en yakın komşu) büyütür,
ayakların altına yumuşak piksel gölge ekler, sprite'ı ve _meta dosyasını yazar.

Kullanım:
  pixellab_import.py <ad> <ölçek> <çıktı klasörü> <png> [<png> ...]
Tek PNG: <ad>.png. Birden çok PNG (animasyon kareleri): <ad>.png (ilk kare) + <ad>_idle_0..n.png;
tüm kareler aynı kutuyla kırpılır, böylece çapa sabit kalır. Meta: <çıktı>/_meta_<ad>.json
"""
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage


def drop_specks(img: np.ndarray) -> np.ndarray:
    """Gövdeden kopuk küçük parçaları siler (ör. animasyondaki nefes buharı); en büyük parçanın %5'inden küçükler."""
    # 4-komşuluk: köşeden değen buhar pikselleri de ayrı parça sayılır
    lab, n = ndimage.label(img[..., 3] > 0)
    if n <= 1:
        return img
    sizes = ndimage.sum(np.ones(lab.shape), lab, range(1, n + 1))
    keep = sizes >= sizes.max() * 0.05
    mask = keep[lab - 1] & (lab > 0)
    img[~mask] = 0
    return img


def main():
    name, scale, out = sys.argv[1], int(sys.argv[2]), Path(sys.argv[3])
    frames = [drop_specks(np.asarray(Image.open(p).convert("RGBA")).copy()) for p in sys.argv[4:]]
    h0, w0 = frames[0].shape[:2]
    alpha = np.zeros((h0, w0), bool)
    for f in frames:
        alpha |= f[..., 3] > 0
    ys, xs = np.nonzero(alpha)
    x0, x1, y0, y1 = int(xs.min()), int(xs.max()) + 1, int(ys.min()), int(ys.max()) + 1
    fig_h, fig_w = y1 - y0, x1 - x0
    # gölge için alta ve yanlara yer aç
    pad_x, pad_b = max(3, fig_w // 4), 2
    out.mkdir(parents=True, exist_ok=True)
    sprites = []
    for i, f in enumerate(frames):
        crop = f[y0:y1, x0:x1]
        canvas = np.zeros((fig_h + pad_b, fig_w + 2 * pad_x, 4), np.uint8)
        # gölge: ayak hizasında yatay elips (siyah, yarı saydam)
        cx, cy = canvas.shape[1] / 2, fig_h - 1
        rx, ry = fig_w * 0.42 + 1, max(1.5, fig_w * 0.12)
        yy, xx = np.mgrid[0 : canvas.shape[0], 0 : canvas.shape[1]]
        shadow = ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1
        canvas[shadow] = [0, 0, 0, 70]
        region = canvas[0:fig_h, pad_x : pad_x + fig_w]
        mask = crop[..., 3] > 0
        region[mask] = crop[mask]
        img = Image.fromarray(canvas).resize((canvas.shape[1] * scale, canvas.shape[0] * scale), Image.NEAREST)
        names = [name] if len(frames) == 1 else ([name] if i == 0 else []) + [f"{name}_idle_{i}"]
        for n in names:
            img.save(out / f"{n}.png")
            sprites.append({"name": n, "size": [img.width, img.height], "anchor": [img.width // 2, (fig_h - 1) * scale + scale // 2], "footprint": None})
    (out / f"_meta_{name}.json").write_text(json.dumps({"source": "pixellab", "sprites": sprites}, indent=2), encoding="utf-8")
    print(f"{name}: figür {fig_w}x{fig_h} -> {fig_w * scale}x{fig_h * scale} (ölçek {scale}), {len(frames)} kare")


if __name__ == "__main__":
    main()
