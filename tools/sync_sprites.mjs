// art/sprites altındaki oyun sprite'larını (PNG + _meta*.json) public/assets/sprites'a kopyalar ve
// oyunun yükleyeceği manifest.json'u yazar. Önizleme ve test görselleri kopyalanmaz.
import { cpSync, mkdirSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, join, relative } from "node:path";

const src = "art/sprites";
const dst = "public/assets/sprites";

const skip = (name) => name === "_test" || (name.startsWith("_") && !name.startsWith("_meta"));

rmSync(dst, { recursive: true, force: true });
mkdirSync(dst, { recursive: true });
cpSync(src, dst, { recursive: true, filter: (p) => !skip(basename(p)) });

// manifest: her sprite adı -> dosya yolu + metadata (boyut, çapa, taban izi)
const sprites = {};
const walk = (dir) => {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { walk(p); continue; }
    if (!/^_meta.*\.json$/.test(name)) continue;
    const meta = JSON.parse(readFileSync(p, "utf8"));
    const folder = relative(dst, dir).replaceAll("\\", "/");
    for (const s of meta.sprites) {
      sprites[s.name] = { url: `assets/sprites/${folder}/${s.name}.png`, size: s.size, anchor: s.anchor, footprint: s.footprint ?? null,
        ...(s.resolution ? { resolution: s.resolution } : {}), ...(s.smooth ? { smooth: true } : {}) };
    }
  }
};
walk(dst);
writeFileSync(join(dst, "manifest.json"), JSON.stringify({ sprites }, null, 2));
console.log(`sprite'lar kopyalandı: ${src} -> ${dst} (${Object.keys(sprites).length} sprite, manifest.json)`);
