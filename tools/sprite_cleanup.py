"""Karakter sprite'ı temizliği (fark yöntemi kırıntıları için).

pixelnorm çıktısını yerinde düzeltir:
  1. Yarı saydam (gölge) pikselleri ayırır.
  2. --strip-light-bottom: alt bölgedeki açık, doygunluğu düşük opak pikselleri siler (ayağın altına giren halı parçası).
  3. --despur: 1–2 px'lik ince çıkıntılar silinir.
  4. Opak piksellerden yalnız en büyük 8-bağlantılı bileşeni tutar (saç ucuna yapışan duvar/zemin kırıntıları düşer).
  5. --shoes: bacak uçlarına koyu ayakkabı.
  6. Gölgeyi baştan çizer (ayak hizasında elips; renk/alfa pixelnorm ile aynı), boş alt/üst satırları kırpar.

Kullanım:
  tools\\.venv\\Scripts\\python.exe tools\\sprite_cleanup.py art\\sprites\\characters\\staff\\char_staff_counselor_se.png --strip-light-bottom 0.1
"""
from __future__ import annotations

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

SHADOW_RGB = (106, 133, 130)
SHADOW_ALPHA = 90
SHOE_RGB = (52, 34, 30)


def cleanup(path: Path, strip_light_bottom: float, shadow_w: float, shadow_h: int, despur: bool, shoes: bool) -> None:
    im = np.array(Image.open(path).convert("RGBA"))
    h, w = im.shape[:2]
    opaque = im[..., 3] >= 200

    if strip_light_bottom > 0:
        rgb = im[..., :3].astype(int)
        light = rgb.min(axis=2) >= 170
        flat = (rgb.max(axis=2) - rgb.min(axis=2)) <= 40
        zone = np.zeros_like(opaque)
        zone[int(h * (1 - strip_light_bottom)):, :] = True
        opaque &= ~(light & flat & zone)

    if despur:
        # ince çıkıntılar (1–2 px saç teli, kırıntı çizgisi): açma ile kaybolan, gövdeye 1 px'ten uzak pikseller silinir
        core = ndimage.binary_opening(opaque, structure=np.ones((3, 3)))
        opaque &= ndimage.binary_dilation(core, structure=np.ones((3, 3)), iterations=1)

    lab, n = ndimage.label(opaque, structure=np.ones((3, 3)))
    if n > 1:
        sizes = ndimage.sum(opaque, lab, range(1, n + 1))
        opaque = lab == (int(np.argmax(sizes)) + 1)

    out = np.zeros_like(im)
    out[opaque] = im[opaque]

    if shoes:
        # halıyla birlikte silinen ayakkabılar: bacak uçlarının son satırları koyu renge boyanır, altına bir taban satırı eklenir
        ys0 = np.nonzero(opaque.any(axis=1))[0]
        last = ys0.max()
        for y in range(last - 2, last + 1):
            cols = np.nonzero(opaque[y])[0]
            out[y, cols] = (*SHOE_RGB, 255)
        if last + 1 < h:
            cols = np.nonzero(opaque[last])[0]
            cols = np.unique(np.clip(np.concatenate([cols, cols + 1]), 0, w - 1))
            out[last + 1, cols] = (*SHOE_RGB, 255)
            opaque[last + 1, cols] = True

    # ayak hizası: karakterin en alt opak satırı; elips merkezi biraz yukarıda
    ys, xs = np.nonzero(opaque)
    bottom = ys.max()
    feet = xs[ys >= bottom - 6]
    cx = (feet.min() + feet.max()) / 2
    rx = max(8.0, (xs.max() - xs.min()) * shadow_w / 2)
    ry = shadow_h / 2
    cy = bottom - ry / 2
    yy, xx = np.mgrid[0:h, 0:w]
    ell = ((xx + 0.5 - cx) / rx) ** 2 + ((yy + 0.5 - cy) / ry) ** 2 <= 1.0
    shadow = ell & ~opaque
    out[shadow, :3] = SHADOW_RGB
    out[shadow, 3] = SHADOW_ALPHA
    # çapa alt-ortadır: boş kalan alt/üst satırlar kırpılır (yoksa karakter havada durur)
    rows = np.nonzero(out[..., 3].any(axis=1))[0]
    out = out[rows.min(): rows.max() + 1]
    Image.fromarray(out).save(path)
    print(f"temizlendi: {path.name}  bileşen={n}  gölge={int(shadow.sum())} px")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("sprites", type=Path, nargs="+")
    ap.add_argument("--strip-light-bottom", type=float, default=0.0, help="alt bölge oranı (0 = kapalı)")
    ap.add_argument("--shadow-w", type=float, default=0.9, help="gölge genişliği / karakter genişliği")
    ap.add_argument("--shoes", action="store_true", help="bacak uçlarına koyu ayakkabı boya (halıyla silinen ayaklar)")
    ap.add_argument("--despur", action="store_true", help="1–2 px'lik ince çıkıntıları sil")
    ap.add_argument("--shadow-h", type=int, default=10, help="gölge yüksekliği (px)")
    a = ap.parse_args()
    for p in a.sprites:
        cleanup(p, a.strip_light_bottom, a.shadow_w, a.shadow_h, a.despur, a.shoes)
