"""Ölçek kontrolü: sprite'ları 128x64 izometrik karolu bir zemine dizer (karakter dahil).

Kullanım:
  python tools/scene_test.py çıktı.png
"""

import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parent.parent
TILE_W, TILE_H = 128, 64
COLS, ROWS = 5, 5
SCALE = 1
DESK_TOP = 52  # masa yüzeyinin zeminden yüksekliği (px)

DIRS = [ROOT / "art/sprites/furniture/economy", ROOT / "art/sprites/characters/buse"]


def iso(tx: float, ty: float, ox: int, oy: int):
    """Karo koordinatından ekran koordinatına (karonun üst köşesi)."""
    return ox + (tx - ty) * TILE_W / 2, oy + (tx + ty) * TILE_H / 2


def main(out: Path):
    meta, where = {}, {}
    for d in DIRS:
        for mf in sorted(d.glob("_meta*.json")):
            for m in json.loads(mf.read_text(encoding="utf-8"))["sprites"]:
                meta[m["name"]], where[m["name"]] = m, d

    w, h = (COLS + ROWS) * TILE_W // 2 + 40, (COLS + ROWS) * TILE_H // 2 + 200
    ox, oy = ROWS * TILE_W // 2 + 20, 180
    img = Image.new("RGBA", (w, h), (60, 52, 64, 255))
    d = ImageDraw.Draw(img)
    for ty in range(ROWS):
        for tx in range(COLS):
            x, y = iso(tx, ty, ox, oy)
            c = (196, 132, 64, 255) if (tx + ty) % 2 == 0 else (186, 124, 58, 255)
            d.polygon([(x, y), (x + TILE_W / 2, y + TILE_H / 2), (x, y + TILE_H), (x - TILE_W / 2, y + TILE_H / 2)],
                      fill=c, outline=(150, 92, 44, 255))

    def place(name, tx, ty, lift=0):
        spr = Image.open(where[name] / f"{name}.png")
        ax, ay = meta[name]["anchor"]
        x, y = iso(tx, ty, ox, oy)
        img.alpha_composite(spr, (int(x - ax), int(y + TILE_H / 2 - ay - lift)))  # karo merkezine otur

    # arkadan öne (tx + ty küçükten büyüğe) yerleşim
    place("furn_bookshelf_eco_se_full", 0, 0.6)
    place("edu_whiteboard_stand_se", 2.6, 0)
    place("furn_desk_eco_se", 1, 1.4)
    place("dev_laptop_old_se", 1.1, 1.3, lift=DESK_TOP)
    place("light_desk_lamp_se", 0.7, 1.2, lift=DESK_TOP)
    place("dev_printer_inkjet_se", 3.6, 0.6)
    place("furn_chair_eco_se", 1.9, 2.2)
    place("drink_kettle_tray_se", 4.0, 1.6)
    place("char_buse_idle_se", 2.7, 2.6)
    place("deco_plant_pot_se", 4.2, 2.8)
    place("furn_wastebasket_wicker_se", 0.2, 3.4)
    place("furn_bookshelf_eco_se_half", 3.4, 3.6)

    img.resize((w * SCALE, h * SCALE), Image.NEAREST).save(out)
    print(f"yazıldı: {out}")


if __name__ == "__main__":
    main(Path(sys.argv[1]))
