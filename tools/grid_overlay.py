"""Oda arka planı üstüne izometrik karo ızgarası çizer (floorOrigin ve karo sayısını doğrulamak için).

Kullanım: grid_overlay.py oda.png ox oy tx ty çıktı.png [ölçek]
ox, oy: (0,0) karosunun üst köşesinin sprite içindeki konumu; karo 128x64.
"""
import sys
from PIL import Image, ImageDraw


def main():
    src, ox, oy, tx, ty, out = sys.argv[1], float(sys.argv[2]), float(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]), sys.argv[6]
    scale = int(sys.argv[7]) if len(sys.argv) > 7 else 2
    im = Image.open(src).convert("RGBA")
    im = im.resize((im.width * scale, im.height * scale), Image.NEAREST)
    d = ImageDraw.Draw(im)
    P = lambda x, y: ((ox + (x - y) * 64) * scale, (oy + (x + y) * 32) * scale)
    for i in range(tx + 1):
        d.line([P(i, 0), P(i, ty)], fill=(0, 220, 255, 255), width=1)
    for j in range(ty + 1):
        d.line([P(0, j), P(tx, j)], fill=(0, 220, 255, 255), width=1)
    im.save(out)


if __name__ == "__main__":
    main()
