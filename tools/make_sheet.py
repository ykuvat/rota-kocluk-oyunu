"""make_sheet — extract_diff kesitlerini (gri zeminli PNG'ler) aralıklı tek bir sayfada birleştirir;
pixelnorm bu sayfayı soldan sağa, verilen sırada okur.

Kullanım:
  python tools/make_sheet.py CIKTI.png kesit1.png kesit2.png ...
"""

import sys
from pathlib import Path

from PIL import Image

BG = (203, 203, 203)
GAP = 120


def main(out: Path, parts: list[Path]):
    ims = [Image.open(p).convert("RGB") for p in parts]
    w = sum(i.width for i in ims) + GAP * (len(ims) + 1)
    h = max(i.height for i in ims) + GAP * 2
    sheet = Image.new("RGB", (w, h), BG)
    x = GAP
    for im in ims:
        sheet.paste(im, (x, h - GAP - im.height))   # tabanlar hizalı
        x += im.width + GAP
    sheet.save(out)
    print(f"yazıldı: {out}  {w}x{h}  ({len(ims)} parça)")


if __name__ == "__main__":
    main(Path(sys.argv[1]), [Path(p) for p in sys.argv[2:]])
