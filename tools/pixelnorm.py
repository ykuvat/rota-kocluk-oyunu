"""pixelnorm — yapay zekâ çıktısı "sahte piksel" varlık sayfalarını oyuna hazır sprite'lara çevirir.

Akış:
  1. Arka planı (kenarlara bağlı düz gri) ve temas gölgesini ayır.
  2. Nesneleri bağlı bileşenlerle bul, satır/sütun sırasına diz.
  3. Her nesnede sahte piksel boyutunu ve ızgara fazını kenar profilinin FFT'siyle tespit et.
  4. Hedef genişliğe göre ızgara adımını seç, her hücreyi merkez bölgesinin baskın rengiyle örnekle.
  5. Tüm sayfayı ortak bir palete indir, PNG + metadata + önizleme yaz.

Kullanım:
  python tools/pixelnorm.py art/configs/p4_mobilya_ekonomik.json
"""

from __future__ import annotations

import argparse
import json
import math
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = Path(__file__).resolve().parent.parent


# --------------------------------------------------------------------------- maskeler

def border_median(rgb: np.ndarray, width: int = 8) -> np.ndarray:
    edges = np.concatenate([
        rgb[:width].reshape(-1, 3), rgb[-width:].reshape(-1, 3),
        rgb[:, :width].reshape(-1, 3), rgb[:, -width:].reshape(-1, 3),
    ])
    return np.median(edges, axis=0)


def color_dist(rgb: np.ndarray, color) -> np.ndarray:
    return np.sqrt(((rgb.astype(np.float32) - np.asarray(color, np.float32)) ** 2).sum(-1))


def background_mask(rgb: np.ndarray, bg: np.ndarray, tol: float, min_region: int = 150) -> np.ndarray:
    """Arka plana yakın pikseller: görüntü kenarına bağlı olanlar ve nesnelerin arasında
    kapalı kalmış ama yeterince büyük olanlar (ör. masa bacaklarının arası)."""
    cand = color_dist(rgb, bg) < tol
    labels, n = ndimage.label(cand)
    if n == 0:
        return cand
    sizes = ndimage.sum(cand, labels, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= min_region
    keep[np.unique(np.concatenate([labels[0], labels[-1], labels[:, 0], labels[:, -1]]))] = True
    keep[0] = False
    return keep[labels]


def estimate_shadow_color(rgb: np.ndarray, bg_mask: np.ndarray, bg: np.ndarray):
    """Arka plana komşu, düşük doygunluklu ve arka plandan koyu piksellerin baskın rengi."""
    ring = ndimage.binary_dilation(bg_mask, iterations=4) & ~bg_mask
    px = rgb[ring].astype(np.int32)
    if len(px) == 0:
        return None
    chroma = px.max(1) - px.min(1)
    lum = px.mean(1)
    bg_lum = float(bg.mean())
    sel = px[(chroma < 60) & (lum > bg_lum * 0.25) & (lum < bg_lum * 0.9)]
    if len(sel) < 50:
        return None
    q = (sel // 8) * 8
    keys, counts = np.unique(q, axis=0, return_counts=True)
    top = keys[counts.argmax()]
    return sel[(q == top).all(1)].mean(0)


def shadow_mask(rgb, bg_mask, shadow_color, tol, min_region=150):
    """Gölge rengine yakın bölgeler. Arka plana değmeyen ama yeterince büyük bölgeler de
    gölge sayılır (ör. masa bacakları arasında kalan gölge)."""
    if shadow_color is None:
        return np.zeros(bg_mask.shape, bool)
    cand = (color_dist(rgb, shadow_color) < tol) & ~bg_mask
    touching = ndimage.binary_dilation(bg_mask, iterations=2)
    labels, n = ndimage.label(cand)
    if n == 0:
        return cand
    sizes = ndimage.sum(cand, labels, index=np.arange(1, n + 1))
    keep = np.zeros(n + 1, bool)
    keep[1:] = sizes >= min_region
    keep[np.unique(labels[touching & cand])] = True
    keep[0] = False
    return keep[labels]


# --------------------------------------------------------------------------- nesneler

@dataclass
class Obj:
    y0: int
    y1: int
    x0: int
    x1: int

    @property
    def cy(self):
        return (self.y0 + self.y1) / 2

    @property
    def cx(self):
        return (self.x0 + self.x1) / 2

    @property
    def h(self):
        return self.y1 - self.y0


def find_objects(fg: np.ndarray, close: int, min_area: int) -> list[Obj]:
    merged = ndimage.binary_closing(fg, iterations=close)
    merged = ndimage.binary_fill_holes(merged)
    labels, n = ndimage.label(merged)
    objs = []
    for i, sl in enumerate(ndimage.find_objects(labels), start=1):
        if sl is None:
            continue
        area = int((labels[sl] == i).sum())
        if area < min_area:
            continue
        objs.append(Obj(sl[0].start, sl[0].stop, sl[1].start, sl[1].stop))
    # satırlara ayır, sonra soldan sağa
    objs.sort(key=lambda o: o.cy)
    rows, cur = [], []
    for o in objs:
        if cur and o.cy - np.mean([c.cy for c in cur]) > np.median([c.h for c in objs]) * 0.6:
            rows.append(cur)
            cur = []
        cur.append(o)
    if cur:
        rows.append(cur)
    return [o for row in rows for o in sorted(row, key=lambda o: o.cx)]


# --------------------------------------------------------------------------- piksel ızgarası

def grid_period(profile: np.ndarray, pmin: float, pmax: float):
    """Kenar profilindeki baskın periyot ve faz (FFT)."""
    p = profile - profile.mean()
    n = len(p)
    if n < pmax * 3:
        return None
    spec = np.fft.rfft(p * np.hanning(n))
    freqs = np.fft.rfftfreq(n)
    valid = (freqs > 1 / pmax) & (freqs < 1 / pmin)
    if not valid.any():
        return None
    k = np.flatnonzero(valid)[np.abs(spec[valid]).argmax()]
    period = 1 / freqs[k]
    phase = (-np.angle(spec[k]) / (2 * np.pi) * period) % period
    return period, phase


def detect_grid(rgb: np.ndarray, alpha: np.ndarray, pmin=3.0, pmax=24.0):
    g = rgb.astype(np.float32).mean(-1)
    gx = np.abs(np.diff(g, axis=1)) * alpha[:, 1:]
    gy = np.abs(np.diff(g, axis=0)) * alpha[1:, :]
    rx = grid_period(gx.sum(0), pmin, pmax)
    ry = grid_period(gy.sum(1), pmin, pmax)
    return rx, ry


def best_offset(profile: np.ndarray, step: float, resolution: float = 0.25) -> float:
    """Kenar enerjisinin ızgara çizgilerine en çok düştüğü fazı arar.
    Sahte pikselin renk değişimleri ızgara sınırlarında olur; doğru faz bu tepeleri toplar."""
    n = len(profile)
    best, best_score = 0.0, -1.0
    for ox in np.arange(0, step, resolution):
        pos = np.arange(ox, n, step)
        idx = np.clip(np.round(pos).astype(int), 0, n - 1)
        score = profile[idx].sum() + 0.5 * (profile[np.clip(idx - 1, 0, n - 1)].sum() + profile[np.clip(idx + 1, 0, n - 1)].sum())
        score /= max(len(idx), 1)
        if score > best_score:
            best, best_score = float(ox), score
    return best


def dominant_color(block: np.ndarray) -> np.ndarray:
    q = (block.astype(np.int32) // 16)
    keys, inv, counts = np.unique(q, axis=0, return_inverse=True, return_counts=True)
    top = counts.argmax()
    return block[inv.ravel() == top].mean(0)


def sample_grid(rgb, obj_mask, shad_mask, step, ox, oy, inner=0.5, shadow_alpha=90):
    h, w = obj_mask.shape
    nx = int(math.ceil((w - ox) / step))
    ny = int(math.ceil((h - oy) / step))
    out = np.zeros((ny, nx, 4), np.uint8)
    m = (1 - inner) / 2
    for j in range(ny):
        ya, yb = oy + (j + m) * step, oy + (j + 1 - m) * step
        y0, y1 = max(int(ya), 0), min(int(math.ceil(yb)), h)
        if y1 <= y0:
            continue
        for i in range(nx):
            xa, xb = ox + (i + m) * step, ox + (i + 1 - m) * step
            x0, x1 = max(int(xa), 0), min(int(math.ceil(xb)), w)
            if x1 <= x0:
                continue
            om = obj_mask[y0:y1, x0:x1]
            sm = shad_mask[y0:y1, x0:x1]
            n = om.size
            if om.sum() > n * 0.5:
                out[j, i, :3] = dominant_color(rgb[y0:y1, x0:x1][om])
                out[j, i, 3] = 255
            elif sm.sum() > n * 0.5:
                out[j, i] = (0, 0, 0, shadow_alpha)
    return trim(out)


def trim(img: np.ndarray) -> np.ndarray:
    a = img[..., 3] > 0
    if not a.any():
        return img
    ys, xs = np.flatnonzero(a.any(1)), np.flatnonzero(a.any(0))
    return img[ys[0]:ys[-1] + 1, xs[0]:xs[-1] + 1]


# --------------------------------------------------------------------------- palet

def build_palette(px: np.ndarray, colors: int) -> np.ndarray:
    side = int(math.ceil(math.sqrt(len(px))))
    canvas = np.zeros((side * side, 3), np.uint8)
    canvas[:len(px)] = px
    canvas[len(px):] = px[0]
    pal_img = Image.fromarray(canvas.reshape(side, side, 3)).quantize(colors, method=Image.Quantize.MEDIANCUT)
    return np.array(pal_img.getpalette()[:colors * 3], np.int32).reshape(-1, 3)


def apply_palette(s: np.ndarray, pal: np.ndarray) -> np.ndarray:
    s = s.copy()
    op = s[..., 3] == 255
    px = s[op][:, :3].astype(np.int32)
    if len(px):
        s[op, :3] = pal[((px[:, None, :] - pal[None]) ** 2).sum(-1).argmin(1)]
    return s


def quantize_sheet(sprites: list[np.ndarray], colors: int, mode: str) -> tuple[list[np.ndarray], list]:
    """mode='sheet': tüm sayfaya ortak palet. mode='sprite': her sprite kendi paletini alır
    (baskın malzeme diğer nesnelerin renklerini yutmasın diye)."""
    if mode == "sprite":
        out, pals = [], []
        for s in sprites:
            px = s[s[..., 3] == 255][:, :3]
            if len(px) == 0:
                out.append(s)
                pals.append([])
                continue
            pal = build_palette(px, min(colors, len(np.unique(px, axis=0))))
            out.append(apply_palette(s, pal))
            pals.append(pal.tolist())
        return out, pals
    allpx = np.concatenate([s[s[..., 3] == 255][:, :3] for s in sprites])
    pal = build_palette(allpx, colors)
    return [apply_palette(s, pal) for s in sprites], pal.tolist()


# --------------------------------------------------------------------------- çıktı

def checker(w, h, cell=8):
    yy, xx = np.mgrid[0:h, 0:w]
    c = (((yy // cell) + (xx // cell)) % 2).astype(np.uint8)
    img = np.where(c[..., None] == 1, 205, 235).astype(np.uint8)
    return np.dstack([img, img, img, np.full((h, w), 255, np.uint8)])


def make_preview(sprites, names, scale=4, pad=8):
    cols = 4
    rows = math.ceil(len(sprites) / cols)
    cw = max(s.shape[1] for s in sprites) * scale + pad * 2
    ch = max(s.shape[0] for s in sprites) * scale + pad * 2
    sheet = Image.fromarray(checker(cw * cols, ch * rows))
    for k, s in enumerate(sprites):
        im = Image.fromarray(s, "RGBA").resize((s.shape[1] * scale, s.shape[0] * scale), Image.NEAREST)
        x = (k % cols) * cw + (cw - im.width) // 2
        y = (k // cols) * ch + (ch - im.height) - pad
        sheet.alpha_composite(im, (x, y))
    return sheet


def run(cfg_path: Path):
    cfg = json.loads(cfg_path.read_text(encoding="utf-8-sig"))
    src = ROOT / cfg["source"]
    out_dir = ROOT / cfg["out_dir"]
    out_dir.mkdir(parents=True, exist_ok=True)

    rgb = np.array(Image.open(src).convert("RGB"))
    bg = np.asarray(cfg.get("background") or border_median(rgb), np.float32)
    bgm = background_mask(rgb, bg, cfg.get("bg_tolerance", 22))
    shadow_color = cfg.get("shadow_color") or estimate_shadow_color(rgb, bgm, bg)
    shm = shadow_mask(rgb, bgm, shadow_color, cfg.get("shadow_tolerance", 26))
    fg = ~bgm & ~shm

    objs = find_objects(fg | shm, cfg.get("close_iterations", 6), cfg.get("min_area", 3000))
    items = cfg["items"]
    print(f"kaynak: {src.name}  {rgb.shape[1]}x{rgb.shape[0]}  arka plan={bg.round().tolist()}  "
          f"gölge={None if shadow_color is None else np.round(shadow_color).tolist()}")
    print(f"bulunan nesne: {len(objs)}  beklenen: {len(items)}")
    if len(objs) != len(items):
        raise SystemExit("Nesne sayısı yapılandırmayla eşleşmiyor; close_iterations / min_area ayarla.")

    sprites, meta = [], []
    for o, it in zip(objs, items):
        sl = (slice(o.y0, o.y1), slice(o.x0, o.x1))
        crop, om, sm = rgb[sl], fg[sl].copy(), shm[sl].copy()
        zone = it.get("shadow_zone", cfg.get("shadow_zone"))
        if zone:  # gölge yalnızca nesnenin alt bandında olabilir (karakterler: ayak altı)
            cut = int(sm.shape[0] * (1 - zone))
            om[:cut] |= sm[:cut]
            sm[:cut] = False
        rx, ry = detect_grid(crop, om.astype(np.float32))
        native = None
        if rx and ry:
            native = (rx[0] + ry[0]) / 2
        obj_w = int(np.ptp(np.flatnonzero(om.any(0)))) + 1
        obj_h = int(np.ptp(np.flatnonzero(om.any(1)))) + 1
        if "step" in it or "fixed_step" in cfg:   # oda içi kesitler: tek ölçek, göreli boyutlar korunur
            step = it.get("step", cfg.get("fixed_step"))
        elif "height" in it:      # karakterler: boy hedefi
            step = obj_h / it["height"]
        elif "width" in it:     # mobilya: ekran genişliği hedefi
            step = obj_w / it["width"]
        else:
            step = native or cfg.get("default_step", 8)
        upsampled = native is not None and step < native * 0.9
        g = crop.astype(np.float32).mean(-1)
        prof_x = np.r_[0, (np.abs(np.diff(g, axis=1)) * om[:, 1:]).sum(0)]  # sınır x'e yazılır
        prof_y = np.r_[0, (np.abs(np.diff(g, axis=0)) * om[1:, :]).sum(1)]
        ox = best_offset(prof_x, step)
        oy = best_offset(prof_y, step)
        spr = sample_grid(crop, om, sm, step, ox, oy, shadow_alpha=cfg.get("shadow_alpha", 90) if cfg.get("keep_shadow", True) else 0)
        if not cfg.get("keep_shadow", True):
            spr[spr[..., 3] < 255] = 0
            spr = trim(spr)
        sprites.append(spr)
        meta.append({"name": it["name"], "native_pixel": None if native is None else round(native, 2),
                     "step": round(step, 2), "size": [int(spr.shape[1]), int(spr.shape[0])],
                     "anchor": [int(spr.shape[1]) // 2, int(spr.shape[0]) - 1],
                     "footprint": it.get("footprint"), "source_box": [o.x0, o.y0, o.x1, o.y1],
                     "upsampled": bool(upsampled)})
        warn = "  UYARI: kaynak çözünürlüğü yetersiz, pikseller tekrar ediliyor; daha büyük yeniden üret" if upsampled else ""
        print(f"  {it['name']:<28} sahte piksel≈{meta[-1]['native_pixel']}  adım={step:.2f}  -> {spr.shape[1]}x{spr.shape[0]}{warn}")

    if cfg.get("palette_colors"):
        sprites, pal = quantize_sheet(sprites, cfg["palette_colors"], cfg.get("palette_mode", "sprite"))
    else:
        pal = None

    # skip: sayfada var ama başka kaynaktan daha iyisi üretildi
    keep = [k for k, it in enumerate(items) if not it.get("skip")]
    sprites = [sprites[k] for k in keep]
    meta = [meta[k] for k in keep]
    if isinstance(pal, list) and pal and isinstance(pal[0], list) and len(pal) == len(items):
        pal = [pal[k] for k in keep]
    for s, m in zip(sprites, meta):
        Image.fromarray(s, "RGBA").save(out_dir / f"{m['name']}.png")
    (out_dir / cfg.get("meta_name", "_meta.json")).write_text(
        json.dumps({"source": cfg["source"], "palette": pal, "sprites": meta}, ensure_ascii=False, indent=2),
        encoding="utf-8")
    prev = make_preview(sprites, [m["name"] for m in meta], scale=cfg.get("preview_scale", 4))
    prev.save(out_dir / cfg.get("preview_name", "_preview.png"))
    print(f"yazıldı: {out_dir.relative_to(ROOT)}  ({len(sprites)} sprite + {cfg.get('meta_name', '_meta.json')} + "
          f"{cfg.get('preview_name', '_preview.png')})")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("config", type=Path)
    run(ap.parse_args().config.resolve())
