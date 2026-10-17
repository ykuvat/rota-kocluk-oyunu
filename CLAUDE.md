# Rota — Koçluktan Kuruma

Eğitim koçluğundan danışmanlık kurumuna uzanan 2.5D izometrik pixel art yönetim simülasyonu. Tarayıcı oyunu.
Tasarım belgesi (GDD): Claude Docs'taki "Eğitim Koçluğu Simülasyonu — Mimari ve GDD v0.1". Varlık süreci: `docs/varlik-gunlugu.md`.

## Komutlar

- `npm run dev` — sprite'ları senkronlar (`tools/sync_sprites.mjs`), Vite'ı 5173'te açar
- `npm test` — Vitest (`tests/`); `tests/fullgame.test.ts` 3 sezonluk tam oyun botudur (`tests/bot.ts`), denge değişince sonuçlarını `docs/gelistirme-gunlugu.md`'ye işle (`FULLGAME_SEEDS=16` ile daha çok tohum)
- `npm run typecheck` / `npm run build`
- Sanat araçları (Python, `tools/.venv`): `tools\.venv\Scripts\python.exe tools\pixelnorm.py art\configs\<x>.json`, `tools/extract_diff.py`, `tools/sprite_cleanup.py` (pixelnorm sonrası kırıntı/gölge), `tools/make_sheet.py`, `tools/scene_test.py`

## Mimari kuralları

- Katmanlar: `src/core` (saf matematik/rng) · `src/sim` (simülasyon) · `src/content` (veri, denge) · `src/render` (PixiJS) · `src/ui` (HUD; sim'i yalnız okur) · `src/platform` (i18n, kayıt, girdi).
- Simülasyon: 1 tick = 1 oyun saati (`sim/step.ts → advance`); 22:00 günlük öğrenci çalışması, Pazar 23:00 hafta kapanışı. Durum (`GameState`) düz JSON; RNG durumu içinde saklanır.
- Durum yalnız komutlarla değişir (`sim/commands.ts → applyCommand`); geçersiz komut durumu değiştirmez.
- Geçici etkiler değiştirici yığınıyla (`sim/modifiers.ts`); her değerin kırılımı "Neden?" için raporlanabilir.
- Denge değerleri `content/balance.ts`; `tests/balance.test.ts` dengeli programın aşırı yüklemeyi yendiğini her arşetip için doğrular — denge değişince bu test geçmeli.
- `core` ve `sim` içinde DOM, PixiJS, `Date.now` veya `Math.random` YOK. Rastgelelik yalnız `core/rng.ts` üzerinden (tohumlu, deterministik).
- Denge değerleri ve yerleşimler `src/content` içinde veri olarak durur, render/sim kodunda sabit yazılmaz.
- Arayüz metinleri `platform/i18n.ts` anahtarlarıyla (tr + en); kodda düz metin yok. Kurum/sınav/marka adları kurgusal.
- İzometri: 2:1, 1 karo = 1 m = 128×64 px; +x sağ-aşağı, +y sol-aşağı; dikey 1 m ≈ 78 px. Kamera açısı sabit, döndürme yok.
- Pixel art: `TextureStyle` nearest, `roundPixels`, renderer `resolution` = cihaz piksel oranı; konumlar tam cihaz pikseline yuvarlanır; yakınlaştırma cihaz pikselinde 0.5/1/2/3… (masaüstünde 0.5/1/2/3; CSS'te en çok 3).
- Arayüz: oyun modu `src/ui/play` (ortak stil `common.ts`); ≤ 760 px telefon düzeni (üst çubuk, açılır-kapanır karar sayfası, kıstırma yakınlaştırma).
- Çizim sırası: taban izinin ön köşesi (`core/iso.ts → depthKey`); yüzey üstündeki eşyalar `on` ile ebeveyninin hemen ardından.

## İlerleme

`docs/gelistirme-gunlugu.md`: kilometre taşları, denge ölçümleri, ayar hedefleri. Yeni bir mekanik eklenince oraya ve `tests/balance.test.ts`'e işlenir.

## Sanat

- `art/sprites/` kaynak; `public/assets/sprites/` üretilir (elle düzenleme, git'e koyma). `manifest.json` sync betiğiyle yazılır.
- Sprite adı: `kategori_ad_seviye_yön[_durum]` (ör. `furn_bookshelf_eco_se_full`). Çapa: alt-orta = taban izinin ön köşesi.
- Mobilya `SE` çizilir; uzun kenar karo +y ekseni boyunca.
