"""cartoon_cut — çizgi film (düz renk, kenar yumuşatmalı) tarzı sprite'ları hazırlar. pixelnorm'un karşılığı.

pixelnorm'dan farkı: palet/blok yok; görsel yumuşak ölçeklenir (LANCZOS), kenarlar yarı saydam kalır ve
sprite'lar 2x çözünürlükte yazılır (``resolution: 2``): oyun dünyası pikselinde ``size`` kadar yer kaplar,
yakınlaştırılınca ve yüksek yoğunluklu ekranda net görünür.

Konfig (JSON):
{
  "out_dir": "art/sprites/cartoon/home",
  "meta_name": "_meta.json",
  "resolution": 2,
  "items": [
    {"name": "room_home_cartoon", "kind": "room", "source": "...jpg", "scale": 0.475, "squash": 0.867,
     "floor": {"left": [108, 705], "right": [916, 705], "bottom": [511, 938]}},
    {"name": "char_buse_cartoon_se", "kind": "char", "source": "art/inbox/cizgi/kesit/buse.png", "scale": 0.475,
     "floor_rgb": [238, 165, 80]}
  ]
}
- room: kaynağın düz açık arka planı (köşeden örneklenir) saydam yapılır; dikeyde ``squash`` ile 2:1 izometriye
  getirilir; ``floor`` köşelerinden (0,0) karosunun üst köşesi (floorOrigin) hesaplanıp yazdırılır.
- char: extract_diff çıktısı (düz gri zemin + işaretli gölge rengi). En büyük parça tutulur, kapalı delikler
  doldurulur, alt bölgedeki zemin rengi kırıntıları (``floor_rgb``) silinir; gölge yumuşak elips olarak yeniden çizilir.
  Çapa alt-orta.

Kullanım: tools\\.venv\\Scripts\\python.exe tools\\cartoon_cut.py art\\configs\\cizgi_ev.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from scipy import ndimage

BG = np.array([203, 203, 203])
SHADOW = np.array([106, 133, 130])


PICK: tuple[int, int] | None = None  # do_char çalışırken: seçilecek parçanın içindeki nokta (kesit koordinatı)


def largest(mask: np.ndarray) -> np.ndarray:
    lab, n = ndimage.label(mask, structure=np.ones((3, 3)))
    if n <= 1:
        return mask
    if PICK is not None:
        # yan yana duran iki kişiden belirtileni: noktayı içeren ya da ona en yakın parça
        x, y = PICK
        k = int(lab[y, x])
        if k == 0:
            idx = ndimage.distance_transform_edt(lab == 0, return_indices=True)[1]
            k = int(lab[idx[0][y, x], idx[1][y, x]])
        return lab == k
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    return lab == (int(np.argmax(sizes)) + 1)


def soft_rgba(rgb: np.ndarray, mask: np.ndarray) -> Image.Image:
    """Maske kenarını 1 px yumuşatıp RGBA yap (renk kenarda dışarı taşırılır: ölçeklemede koyu hale olmasın)."""
    alpha = Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.6))
    a = np.minimum(np.asarray(alpha), (ndimage.binary_dilation(mask, iterations=1) * 255).astype(np.uint8))
    # saydam bölgeye en yakın içerik rengini yay
    idx = ndimage.distance_transform_edt(~mask, return_indices=True)[1]
    bled = rgb[idx[0], idx[1]]
    return Image.fromarray(np.dstack([bled, a]).astype(np.uint8), "RGBA")


def resize_rgba(im: Image.Image, w: int, h: int) -> Image.Image:
    # premultiplied ölçekleme: kenarlarda renk karışmasın
    arr = np.asarray(im).astype(np.float32) / 255
    pm = arr.copy()
    pm[..., :3] *= pm[..., 3:4]
    out = np.asarray(Image.fromarray((pm * 255).astype(np.uint8), "RGBA").resize((w, h), Image.LANCZOS)).astype(np.float32) / 255
    a = out[..., 3:4]
    rgb = np.where(a > 1e-3, out[..., :3] / np.maximum(a, 1e-3), 0)
    return Image.fromarray((np.dstack([np.clip(rgb, 0, 1), a]) * 255).astype(np.uint8), "RGBA")


def do_room(it: dict, res: int, out_dir: Path) -> dict:
    src = np.asarray(Image.open(it["source"]).convert("RGB")).astype(int)
    h, w = src.shape[:2]
    corners = np.array([src[4, 4], src[4, w - 5], src[h - 5, 4], src[h - 5, w - 5]])
    bg = np.median(corners, axis=0)
    mask = np.abs(src - bg).sum(-1) > it.get("bg_tolerance", 24)
    mask = ndimage.binary_fill_holes(largest(ndimage.binary_opening(mask, iterations=2)))
    ys, xs = np.nonzero(mask)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    if it.get("box"):
        # aynı odanın poz varyantları aynı kırpmayla: oyunda birbirinin yerine geçtiklerinde kaymasınlar
        x0, y0, x1, y1 = it["box"]
    im = soft_rgba(src[y0:y1, x0:x1], mask[y0:y1, x0:x1])
    sx, sy = it["scale"], it["scale"] * it.get("squash", 1.0)
    lw, lh = round((x1 - x0) * sx), round((y1 - y0) * sy)
    resize_rgba(im, lw * res, lh * res).save(out_dir / f"{it['name']}.png")
    f = it["floor"]
    # 2:1'e sıkıştırılmış ve kırpılmış koordinatlar; üst köşe = sol/sağ ortası − çeyrek genişlik
    left = ((f["left"][0] - x0) * sx, (f["left"][1] - y0) * sy)
    right = ((f["right"][0] - x0) * sx, (f["right"][1] - y0) * sy)
    bottom = ((f["bottom"][0] - x0) * sx, (f["bottom"][1] - y0) * sy)
    width = right[0] - left[0]
    top = ((left[0] + right[0]) / 2, (left[1] + right[1]) / 2 - width / 4)
    tiles = width / 128
    print(f"{it['name']}: {lw}x{lh} (dosya {lw * res}x{lh * res})  floorOrigin≈({top[0]:.1f}, {top[1]:.1f})  "
          f"karo≈{tiles:.2f}  ön köşe={bottom[0]:.1f},{bottom[1]:.1f} (beklenen y {top[1] + width / 2:.1f})")
    return {"name": it["name"], "size": [lw, lh], "anchor": [lw // 2, lh - 1], "footprint": None, "resolution": res,
            "smooth": True, "floor_origin": [round(top[0], 1), round(top[1], 1)], "source_box": [int(x0), int(y0), int(x1), int(y1)]}


def do_char(it: dict, res: int, out_dir: Path) -> dict:
    global PICK
    PICK = tuple(it["pick"]) if it.get("pick") else None
    src = np.asarray(Image.open(it["source"]).convert("RGB")).astype(int)
    h = src.shape[0]
    obj = (np.abs(src - BG).sum(-1) > 18) & (np.abs(src - SHADOW).sum(-1) > 12)
    if it.get("floor_rgb"):
        floor = np.abs(src - np.array(it["floor_rgb"])).sum(-1) < it.get("floor_tolerance", 45)
        zone = np.zeros_like(obj)
        zone[int(h * (1 - it.get("floor_zone", 0.4))):] = True
        obj &= ~(floor & zone)
    obj = ndimage.binary_opening(obj, iterations=1)
    obj = largest(obj)
    if it.get("after") and it.get("box"):
        # açık zemin üstündeki açık renkli parçalar (beyaz ayakkabı) farkta kaybolur: özgün görselden geri al.
        # Çizgi film konturu koyudur: gövdeye yakın koyu pikseller eklenir, kapatma + delik doldurma ile kontur içi dolar.
        bx, by = it["box"]
        after = np.asarray(Image.open(it["after"]).convert("RGB")).astype(int)[by:by + src.shape[0], bx:bx + src.shape[1]]
        dark = after.sum(-1) < it.get("outline_max", 260)
        near = ndimage.binary_dilation(obj, iterations=it.get("outline_reach", 8))
        grown = ndimage.binary_closing(obj | (dark & near), iterations=it.get("close", 4))
        grown = ndimage.binary_fill_holes(grown)
        # eklenen kısımdan ince çizgiler (mobilya/zemin konturu) düşsün; dolu parçalar (ayakkabı) kalsın
        grown = ndimage.binary_opening(grown, iterations=it.get("despur", 3))
        obj = largest(grown | obj)
        if it.get("before"):
            # boş odayla aynı kalan pikseller arka plandır (kapatma/doldurmayla içeri sızan zemin, raf)
            before = np.asarray(Image.open(it["before"]).convert("RGB")).astype(int)[by:by + src.shape[0], bx:bx + src.shape[1]]
            same = np.abs(after - before).sum(-1) < it.get("same_tol", 30)
            obj &= ~ndimage.binary_opening(same, iterations=1)
        if it.get("feet_from") is not None:
            # beyaz ayakkabı krem zeminde "boş odayla aynı" sayılıp silinir: ayak bandında koyu konturla
            # kapalı bölgeler (ayakkabı) doğrudan eklenir
            band = np.zeros_like(obj)
            ff = it["feet_from"]  # kaynak satırı ya da (< 1) yükseklik oranı
            band[int(ff * h) if ff < 1 else ff:] = True
            # kontur + mevcut gövde (paça) birlikte sınır: ayakkabının üstü paçayla kapanır
            edge = ((after.sum(-1) < it.get("feet_outline_max", 330)) | obj) & band
            closed = ndimage.binary_closing(edge, iterations=2)
            obj |= ndimage.binary_fill_holes(closed) & band
        obj = largest(obj)
        src = after
    obj = ndimage.binary_fill_holes(obj)
    if it.get("fringe_clean"):
        # saç/kontur kenarına yapışık turuncu zemin (ahşap) kırıntısı: dış kenara değen küçük turuncu parçalar silinir;
        # iç bölgedeki ten (yüz, el) kenara değmediği için kalır
        rgb = src / 255.0
        mx, mn = rgb.max(-1), rgb.min(-1)
        sat = np.where(mx > 0, (mx - mn) / np.maximum(mx, 1e-6), 0)
        r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
        orange = (r > g) & (g > b) & (sat > 0.38) & (mx > 0.55) & ((r - g) > 0.12) & obj
        if it.get("before") and it.get("box"):
            # boş odaya yakın (duvar, raf) kenar pikselleri de kırıntıdır
            bx, by = it["box"]
            before = np.asarray(Image.open(it["before"]).convert("RGB")).astype(int)[by:by + src.shape[0], bx:bx + src.shape[1]]
            orange |= (np.abs(src - before).sum(-1) < it.get("fringe_same_tol", 70)) & obj
        edge = obj & ~ndimage.binary_erosion(obj, iterations=1)
        lab, n = ndimage.label(orange)
        for k in range(1, n + 1):
            m = lab == k
            if (m & edge).any() and m.sum() < it.get("fringe_max", 400):
                obj &= ~m
        obj = largest(ndimage.binary_opening(obj, iterations=1))
        # silmenin gövdede açtığı ince yarıklar (saç içinden geçen kol parıltısı) kapansın
        obj = ndimage.binary_fill_holes(ndimage.binary_closing(obj, iterations=2))
    # gövdeye yapışık 1–3 px'lik kırıntı çizgileri (arka plan konturu) düşsün
    if it.get("final_despur", 2):
        obj = largest(ndimage.binary_opening(obj, iterations=it.get("final_despur", 2)))
    # elle silinecek dikdörtgenler en sonda: delik doldurma bacak arasındaki zemini geri getirmesin
    for x0e, y0e, x1e, y1e in it.get("erase", []):
        obj[y0e:y1e, x0e:x1e] = False
    if it.get("erase"):
        obj = largest(obj)
    # gövdenin önüne düşen arka plan parçası (ör. saçın üstündeki kapı kolu parıltısı): açık pikseller verilen renge
    for x0p, y0p, x1p, y1p, col in it.get("paint_light", []):
        reg = src[y0p:y1p, x0p:x1p]
        reg[reg.sum(-1) > it.get("paint_min", 330)] = col
    ys, xs = np.nonzero(obj)
    x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
    s = it["scale"]
    cw, ch = round((x1 - x0) * s), round((y1 - y0) * s)
    body = resize_rgba(soft_rgba(src[y0:y1, x0:x1], obj[y0:y1, x0:x1]), cw * res, ch * res)
    # gölge: ayak hizasında yumuşak elips (gövde genişliğinin ~%80'i)
    sw, sh = max(8, round(cw * 0.8)), max(4, round(cw * 0.22))
    pad = sh // 2
    W, H = max(cw, sw) + 2, ch + pad
    canvas = Image.new("RGBA", (W * res, H * res), (0, 0, 0, 0))
    sh_img = Image.new("L", (W * res, H * res), 0)
    from PIL import ImageDraw
    cx = W * res / 2
    ImageDraw.Draw(sh_img).ellipse([cx - sw * res / 2, (H - sh) * res, cx + sw * res / 2, H * res - 1], fill=int(255 * 0.28))
    sh_img = sh_img.filter(ImageFilter.GaussianBlur(res * 1.2))
    canvas.paste(Image.new("RGBA", canvas.size, (40, 25, 20, 255)), (0, 0), sh_img)
    canvas.alpha_composite(body, (round((W - cw) * res / 2), 0))
    canvas.save(out_dir / f"{it['name']}.png")
    print(f"{it['name']}: {W}x{H} (dosya {W * res}x{H * res})  gövde boyu {ch}")
    return {"name": it["name"], "size": [W, H], "anchor": [W // 2, ch], "footprint": None, "resolution": res,
            "smooth": True, "source_box": [int(x0), int(y0), int(x1), int(y1)]}


def main(cfg_path: str) -> None:
    cfg = json.loads(Path(cfg_path).read_text(encoding="utf-8"))
    out_dir = Path(cfg["out_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    res = int(cfg.get("resolution", 2))
    sprites = [(do_room if it["kind"] == "room" else do_char)(it, res, out_dir) for it in cfg["items"]]
    meta = {"source": cfg_path, "style": "cartoon", "sprites": sprites}
    (out_dir / cfg.get("meta_name", "_meta.json")).write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
