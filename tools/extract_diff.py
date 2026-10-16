"""extract_diff — bir sahneye sonradan eklenmiş nesneleri, önceki ve sonraki görselin farkından
kesip her birini düz gri zemine yerleştirir (pixelnorm'a girdi olarak).

Gemini'ye "odaya şunu ekle" dedirtmek açı, ölçek ve stili otomatik eşitliyor; bu araç da
eklenen parçaları odanın içinden temiz çıkarıyor. Zincirleme kullanım: her adımda bir önceki
görsele yeni nesneler eklenir, ardışık iki görselin farkı yalnızca yenileri verir.

Kullanım:
  python tools/extract_diff.py ONCE.jpg SONRA.jpg CIKTI.png                 # en büyük tek nesne
  python tools/extract_diff.py ONCE.jpg SONRA.jpg DIR --names masa,bitki    # soldan sağa N nesne
"""

import argparse
from pathlib import Path

import numpy as np
from PIL import Image
from scipy import ndimage

BG = np.array([203, 203, 203], np.uint8)
SHADOW = np.array([106, 133, 130], np.uint8)   # pixelnorm'un gölge olarak tanıyacağı renk


def load_pair(before: Path, after: Path):
    a_img = Image.open(before).convert("RGB")
    b_img = Image.open(after).convert("RGB")
    if a_img.size != b_img.size:   # Gemini bazen 1024, bazen 2048 verir
        a_img = a_img.resize(b_img.size, Image.LANCZOS)
    return np.array(a_img).astype(np.float32), np.array(b_img).astype(np.float32)


def extract_region(a, b, d, region, threshold, erode, pad, out: Path, shadow_from: float = 0.7,
                   small_hole: int = 600, point=None, base=None, split: int = 2):
    # delik doldurma YOK: yaprak aralarından görünen arka plan değişmemiştir, saydam kalmalı
    changed = region & (d > threshold * 0.6)
    changed = ndimage.binary_closing(changed, iterations=1) & region

    # gölge: aynı ton, daha koyu (sonra ≈ k * önce, k < 0.9), yalnız alt bölgede
    eps = 1e-3
    ratio = (b.mean(-1) + eps) / (a.mean(-1) + eps)
    cos = (a * b).sum(-1) / (np.linalg.norm(a, axis=-1) * np.linalg.norm(b, axis=-1) + eps)
    shadow = changed & (ratio > 0.35) & (ratio < 0.9) & (cos > 0.995)
    if base is not None:  # boş odaya göre de: gölgedeki zemin = boş zeminin koyulaşmışı
        rb = (b.mean(-1) + eps) / (base.mean(-1) + eps)
        cb = (base * b).sum(-1) / (np.linalg.norm(base, axis=-1) * np.linalg.norm(b, axis=-1) + eps)
        floor_shadow = changed & (rb > 0.35) & (rb < 0.92) & (cb > 0.993)
        # yalnız alt bölgede: üstteki kahverengi ahşap yüzeyler koyu zemine benzer ama gölge değildir
        ys0 = np.flatnonzero(changed.any(1))
        floor_shadow[:ys0[0] + int((ys0[-1] - ys0[0]) * 0.55)] = False
        shadow |= floor_shadow
    ys = np.flatnonzero(changed.any(1))
    shadow[:ys[0] + int((ys[-1] - ys[0]) * shadow_from)] = False
    obj = changed & ~shadow
    if base is not None:  # boş odayla aynı görünen piksel = açığa çıkan zemin (kaymış nesnenin hayaleti)
        obj &= np.sqrt(((b - base) ** 2).sum(-1)) > threshold
        # zemine benzeyen yüzeylerde (raf üstü) açılan ince yarıkları onar
        obj = ndimage.binary_closing(obj, iterations=4) & changed

    # ince bağlantıları kopar (gölgedeki tahta çizgileri gövdeye yapışmasın), sonra ana gövdeyi al
    core = ndimage.binary_opening(obj, iterations=split)
    olab, on = ndimage.label(core)
    if on > 1:  # ana gövdeye bağlı olmayan kırıntıları (ve kaymış nesne hayaletlerini) at
        if point:
            px, py = point
            k = int(olab[py, px])
            if k == 0:
                idx = ndimage.distance_transform_edt(olab == 0, return_indices=True)[1]
                k = int(olab[idx[0][py, px], idx[1][py, px]])
        else:
            k = int(np.argmax(ndimage.sum(core, olab, range(1, on + 1)))) + 1
        core = olab == k
    obj = obj & ndimage.binary_dilation(core, iterations=split)
    # küçük delikleri doldur (kontur/çekmece çizgisi), büyükleri saydam bırak (yaprak araları)
    holes = ndimage.binary_fill_holes(obj) & ~obj
    hlab, hn = ndimage.label(holes)
    if hn:
        hsz = ndimage.sum(holes, hlab, range(1, hn + 1))
        small = np.zeros(hn + 1, bool)
        small[1:] = hsz < small_hole
        obj = obj | small[hlab]
    # yalnız DIŞ kenarı içeri çek (zemin rengi karışan saçak)
    obj = obj & ndimage.binary_erosion(ndimage.binary_fill_holes(obj), iterations=erode)
    # gölge yalnız seçilen nesnenin yakınında olabilir (kaymış nesnelerin gölge izlerini at)
    near = ndimage.binary_dilation(obj, iterations=max(12, obj.shape[0] // 80))
    slab, sn = ndimage.label(shadow)
    if sn:
        touching = np.unique(slab[near & shadow])
        shadow = np.isin(slab, touching[touching > 0])

    sl = ndimage.find_objects((obj | shadow).astype(int))[0]
    y0, y1 = max(sl[0].start - pad, 0), min(sl[0].stop + pad, b.shape[0])
    x0, x1 = max(sl[1].start - pad, 0), min(sl[1].stop + pad, b.shape[1])
    canvas = np.empty((y1 - y0, x1 - x0, 3), np.uint8)
    canvas[:] = BG
    canvas[shadow[y0:y1, x0:x1]] = SHADOW
    o = obj[y0:y1, x0:x1]
    canvas[o] = b[y0:y1, x0:x1].astype(np.uint8)[o]
    Image.fromarray(canvas).save(out)
    print(f"yazıldı: {out}  kutu=({x0},{y0})-({x1},{y1})  nesne={int(o.sum())} px  gölge={int(shadow.sum())} px")


def main(before, after, out: Path, threshold, pad, erode, names, shadow_from=0.7, pick=None, base_path=None,
         split=2):
    a, b = load_pair(before, after)
    base = load_pair(base_path, after)[0] if base_path else None
    d = np.sqrt(((a - b) ** 2).sum(-1))
    m = ndimage.binary_opening(d > threshold, iterations=2)
    lab, n = ndimage.label(ndimage.binary_closing(m, iterations=6))
    sizes = ndimage.sum(m, lab, range(1, n + 1))
    count = len(names) if names else 1
    if pick:  # Gemini başka nesneleri de kaydırdıysa: verilen noktalardaki parçaları seç
        top = []
        for (px, py) in pick:
            i = int(lab[py, px])
            if i == 0:  # nokta boşta: en yakın parçayı al
                dist = ndimage.distance_transform_edt(lab == 0, return_indices=True)[1]
                i = int(lab[dist[0][py, px], dist[1][py, px]])
            top.append(i)
    else:
        top = (np.argsort(sizes)[::-1][:count] + 1).tolist()
    if len(top) < count:
        raise SystemExit(f"{count} nesne beklendi, {len(top)} bulundu")
    # soldan sağa sırala
    boxes = ndimage.find_objects(lab)
    top.sort(key=lambda i: (boxes[i - 1][1].start + boxes[i - 1][1].stop) / 2)
    print(f"fark: medyan={np.median(d):.1f}  bileşen={n}  seçilen boyutlar={[int(sizes[i - 1]) for i in top]}")
    if names:
        out.mkdir(parents=True, exist_ok=True)
    for k, i in enumerate(top):
        region = ndimage.binary_fill_holes(lab == i)
        target = out / f"{names[k]}.png" if names else out
        extract_region(a, b, d, region, threshold, erode, pad, target, shadow_from,
                       point=pick[k] if pick else None, base=base, split=split)


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("before", type=Path)
    ap.add_argument("after", type=Path)
    ap.add_argument("out", type=Path, help="tek nesnede dosya, --names ile klasör")
    ap.add_argument("--threshold", type=float, default=40)
    ap.add_argument("--pad", type=int, default=40)
    ap.add_argument("--erode", type=int, default=2, help="kenardan içeri alınacak piksel")
    ap.add_argument("--names", type=lambda s: [x.strip() for x in s.split(",") if x.strip()], default=None,
                    help="virgülle ayrılmış adlar; soldan sağa bu kadar nesne çıkarılır")
    ap.add_argument("--shadow-from", type=float, default=0.7,
                    help="gölge yalnız nesne yüksekliğinin bu oranından aşağıda olabilir (mobilya: 0.4, karakter: 0.7)")
    ap.add_argument("--pick", type=lambda s: [tuple(int(v) for v in p.split(":")) for p in s.split(",")], default=None,
                    help="x:y[,x:y] — SONRA görselinde nesnelerin içindeki noktalar (adlarla aynı sırada)")
    ap.add_argument("--base", type=Path, default=None,
                    help="boş oda görseli; onunla aynı görünen pikseller nesne sayılmaz")
    ap.add_argument("--split", type=int, default=2,
                    help="birbirine değen nesneleri ayırmak için açma gücü (piksel); bitişikse 6-10 dene")
    args = ap.parse_args()
    main(args.before, args.after, args.out, args.threshold, args.pad, args.erode, args.names, args.shadow_from,
         args.pick, args.base, args.split)
