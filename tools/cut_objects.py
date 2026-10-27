"""cut_objects — düz zemin üzerinde yan yana çizilmiş nesneleri (Gemini) ayrı çizgi film sprite'larına keser.

Konfig (JSON):
{
  "source": "art/inbox/cizgi2/o3_makineler_v1.jpg",
  "out_dir": "art/sprites/cartoon/office2",
  "meta_name": "_meta_machines.json",
  "resolution": 2,
  "floor_at": [1024, 1700],          # zeminin (platform) rengini örneklemek için bir nokta
  "tolerance": 38,                   # arka plan / zemin renginden fark eşiği
  "items": [{"name": "obj_machine_vending_cartoon_se", "pick": [340, 940], "height": 92}]
}
- Nesne maskesi = köşe arka planından ve zemin renginden farklı pikseller; "pick" noktasını içeren (ya da ona en
  yakın) bağlı parça alınır, delikler doldurulur. "height": oyundaki görünür boy (oyun pikseli); dosya `resolution` katı.
- Gölge yumuşak elips olarak yeniden çizilir; çapa alt-orta (taban izinin ön köşesi).

Kullanım: tools\\.venv\\Scripts\\python.exe tools\\cut_objects.py art\\configs\\makineler.json
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter
from scipy import ndimage

sys.path.insert(0, str(Path(__file__).parent))
from cartoon_cut import resize_rgba, soft_rgba  # noqa: E402


def main(cfg_path: str) -> None:
    cfg = json.loads(Path(cfg_path).read_text(encoding="utf-8"))
    src = np.asarray(Image.open(cfg["source"]).convert("RGB")).astype(int)
    h, w = src.shape[:2]
    res = int(cfg.get("resolution", 2))
    tol = cfg.get("tolerance", 38)
    bg = np.median(np.array([src[6, 6], src[6, w - 7], src[h - 7, 6], src[h - 7, w - 7]]), axis=0)
    fx, fy = cfg["floor_at"]
    floor = np.median(src[fy - 4:fy + 5, fx - 4:fx + 5].reshape(-1, 3), axis=0)
    obj = (np.abs(src - bg).sum(-1) > tol) & (np.abs(src - floor).sum(-1) > tol)
    obj = ndimage.binary_opening(obj, iterations=cfg.get("opening", 2))  # ince zemin kenar çizgileri parçaları birbirine bağlamasın
    lab_all, _ = ndimage.label(obj, structure=np.ones((3, 3)))
    out_dir = Path(cfg["out_dir"])
    out_dir.mkdir(parents=True, exist_ok=True)
    sprites = []
    for it in cfg["items"]:
        x, y = it["pick"]
        lab_it = lab_all
        if it.get("box"):
            # yan yana / üst üste duran nesneler: yalnız kutunun içi, isteğe bağlı silinecek dikdörtgenlerle
            bx0, by0, bx1, by1 = it["box"]
            sub = np.zeros_like(obj)
            sub[by0:by1, bx0:bx1] = obj[by0:by1, bx0:bx1]
            for ex0, ey0, ex1, ey1 in it.get("erase", []):
                sub[ey0:ey1, ex0:ex1] = False
            lab_it, _ = ndimage.label(sub, structure=np.ones((3, 3)))
        lab = lab_it
        k = int(lab[y, x])
        if k == 0:
            idx = ndimage.distance_transform_edt(lab == 0, return_indices=True)[1]
            k = int(lab[idx[0][y, x], idx[1][y, x]])
        m = ndimage.binary_fill_holes(lab == k)
        m = ndimage.binary_closing(m, iterations=3)
        # arka plandaki silik duvar / zemin çizgilerinden kalan ince kırıntılar: açıp en büyük parçayı tut
        d = it.get("despur", cfg.get("despur", 4))
        if d:
            mo = ndimage.binary_opening(m, iterations=d)
            lb, nb = ndimage.label(mo)
            if nb:
                sizes = ndimage.sum(mo, lb, range(1, nb + 1))
                core = lb == (int(np.argmax(sizes)) + 1)
                # gövdenin konturu açmada incelir: çekirdeğe yakın özgün pikselleri geri al
                m = m & ndimage.binary_dilation(core, iterations=d + 1)
        ys, xs = np.nonzero(m)
        x0, x1, y0, y1 = xs.min(), xs.max() + 1, ys.min(), ys.max() + 1
        s = it["height"] / (y1 - y0)
        cw, ch = max(1, round((x1 - x0) * s)), it["height"]
        body = resize_rgba(soft_rgba(src[y0:y1, x0:x1], m[y0:y1, x0:x1]), cw * res, ch * res)
        sw, sh = max(8, round(cw * 0.9)), max(4, round(cw * 0.3))
        W, H = cw + 4, ch + sh // 2
        canvas = Image.new("RGBA", (W * res, H * res), (0, 0, 0, 0))
        shadow = Image.new("L", canvas.size, 0)
        cx = W * res / 2
        ImageDraw.Draw(shadow).ellipse([cx - sw * res / 2, (H - sh) * res, cx + sw * res / 2, H * res - 1], fill=int(255 * 0.25))
        shadow = shadow.filter(ImageFilter.GaussianBlur(res * 1.5))
        canvas.paste(Image.new("RGBA", canvas.size, (40, 25, 20, 255)), (0, 0), shadow)
        canvas.alpha_composite(body, (round((W - cw) * res / 2), 0))
        canvas.save(out_dir / f"{it['name']}.png")
        print(f"{it['name']}: {W}x{H} (kaynak kutu {x0},{y0},{x1},{y1})")
        sprites.append({"name": it["name"], "size": [W, H], "anchor": [W // 2, ch], "footprint": None, "resolution": res, "smooth": True})
    meta = {"source": cfg_path, "style": "cartoon", "sprites": sprites}
    (out_dir / cfg.get("meta_name", "_meta_objects.json")).write_text(json.dumps(meta, indent=2, ensure_ascii=False), encoding="utf-8")


if __name__ == "__main__":
    main(sys.argv[1])
