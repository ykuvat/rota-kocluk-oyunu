"""Oda arka planında zemin baklavasının köşelerini renkle bulur.

Kullanım: floor_corners.py oda.png r g b [tolerans]
(r,g,b): zeminin tipik rengi. Çıktı: üst, sol, sağ, alt köşe ve 2:1 izometriye göre önerilen karo boyu.
"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage


def main():
    im = np.asarray(Image.open(sys.argv[1]).convert("RGBA")).astype(int)
    ref = np.array([int(sys.argv[2]), int(sys.argv[3]), int(sys.argv[4])])
    tol = float(sys.argv[5]) if len(sys.argv) > 5 else 60
    mask = (np.abs(im[..., :3] - ref).sum(-1) < tol) & (im[..., 3] > 0)
    mask = ndimage.binary_closing(mask, iterations=3)
    lab, n = ndimage.label(mask)
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    floor = lab == (int(np.argmax(sizes)) + 1)
    floor = ndimage.binary_fill_holes(floor)
    ys, xs = np.nonzero(floor)
    top = (xs[ys.argmin()], ys.min())
    left = (xs.min(), ys[xs.argmin()])
    right = (xs.max(), ys[xs.argmax()])
    bottom = (xs[ys.argmax()], ys.max())
    # köşegenler: x+y min = sol üst kenar, vb. — baklava için daha sağlam: x - 2y ve x + 2y uçları
    u = xs + 2 * ys
    v = xs - 2 * ys
    print(f"üst={top} sol={left} sağ={right} alt={bottom}  genişlik={right[0]-left[0]}  yükseklik={bottom[1]-top[1]}")
    print(f"x+2y aralığı {u.min()}..{u.max()}   x-2y aralığı {v.min()}..{v.max()}")


if __name__ == "__main__":
    main()
