# Varlık Günlüğü

Üretici: Gemini ("Görüntü oluştur" aracı).

| Dosya | Prompt | Durum | Not |
| --- | --- | --- | --- |
| art/reference/buse-karakter-sayfasi.jpg | — | Referans | Kullanıcının verdiği ana karakter sayfası |
| art/inbox/p1_buse_turnaround_v1.jpg | P1 | Reddedildi | 5 görünüm, iki ön görünüm aynı yöne bakıyor, kamera göz hizasında |
| art/inbox/p1_buse_turnaround_v2.jpg | P1 (2 görünüm, üst yüzeyler tarifli) | Konsept olarak kabul | Karakter tutarlı; kamera hâlâ odadan daha alçak |
| art/inbox/p3_baslangic_odasi_v1.jpg | P3 | Stil hedefi olarak kabul | Gerçek izometri, hedef palet ve detay seviyesi |
| art/inbox/p1_buse_turnaround_v3.jpg | P1 (oda + v2 referans, 2 görünüm) | Reddedildi | v2'nin neredeyse kopyası; karakter referansı açıyı kilitledi |
| art/inbox/p1_buse_odada_v4.jpg | P1 (odayı düzenle, Buse'yi içine ekle) | Ölçek ve açı hedefi olarak kabul | Buse odanın stilinde ve ölçeğinde; sprite bu görünümden üretilecek |
| art/inbox/p4_mobilya_ekonomik_v1.jpg | P4 (oda referansıyla) | Kabul, dilimlenecek | 12 nesne tam; nesneler arası ölçek tutarsız (dizüstü masayla aynı boy), dilimlerken normalleştirilecek |

## Normalleştirme (tools/pixelnorm.py)

```
tools\.venv\Scripts\python.exe tools\pixelnorm.py art\configs\<sayfa>.json
tools\.venv\Scripts\python.exe tools\scene_test.py <sprite klasörü> <çıktı.png>
```

- Gemini çıktılarında sahte piksel ≈ **6,0 px** (12 nesnede tutarlı). Yani 2400 px'lik sayfa aslında ~400 px'lik bir pixel art.
- Hedef boyut yapılandırmada `width` (oyun pikseli) olarak verilir: ekran genişliği = (en + derinlik) × 32 px. Masaüstü eşyaları okunurluk için ~%30 büyük.
- Palet sprite başına 24 renk (`palette_mode: sprite`); ortak palet ahşap tonlarına harcanıp diğer renkleri yutuyordu.
- Gölge yarı saydam siyaha (alfa 90) çevrilir; arka plan ve gölge, nesnelerin arasında kapalı kalan bölgelerde de temizlenir.
- P4 → `art/sprites/furniture/economy/` (12 PNG, `_meta.json`, `_preview.png`, `_scene_test.png`).
- Bilinen küçük kusurlar: sandalyenin sağında tek bir başıboş piksel; masa üstü eşyalar için oyun motorunda yüzey yüksekliği (masa ≈ 26 px) gerekecek.

## Buse sprite'ı (2026-10-15)

- v5/v6: Gemini'den ayrı sayfa istendi; ızgara her seferinde inceldi (≈4 px blok, ~130 px boy), "64 px" talimatına uymadı.
- Çözüm: `tools/extract_diff.py` ile oda (P3) ve odaya eklenmiş Buse (v4) farkı alındı → `art/inbox/p1_buse_from_room.png` (temiz, gölge ayrık).
- Boy karşılaştırması: `art/sprites/_test/buse_boy_karsilastirma.png` (64 / 96 / 128 px). 64 px'te yüz ve gömlek okunmuyor; Gemini'nin stilinin doğal karakter boyu ~120–130 px.
- **Karar (2026-10-15): karakter 128 px, karo 128×64 px (1 m).** Ekran genişliği = (en + derinlik) × 64 px. Belge, promptlar ve yapılandırmalar güncellendi.
- `art/sprites/characters/buse/char_buse_idle_se.png` = 53×129 px. SW yönü aynalanarak elde edilir; NE/NW (arka) görünüm henüz yok.
- Ölçek testi: `art/sprites/_scene_test.png` (Buse + 12 mobilya, 128×64 karo). Oranlar tutarlı.

### Yeni ölçekte bilinen sorun

P4 kaynağı 6 px bloklu; yeni genişliklere ulaşmak için masa, sandalye, kitaplıklar, yazı tahtası, bitki ve lamba ~1,5x **yukarı örnekleniyor** (pikseller düzensiz tekrar ediyor). `pixelnorm` bunu "UYARI" ile işaretler (`_meta.json` → `upsampled: true`). Kalıcı çözüm: mobilyaları Gemini'de sayfa başına daha az nesneyle (ör. 2×2) ve daha büyük çizdirip yeniden normalleştirmek. Not: Buse için çıkan uyarı yanlış alarm (FFT harmonik yakaladı; kaynak blok ≈4 px, adım 3,9).

## Mobilyayı daha ince ızgarayla yeniden üretme denemesi (2026-10-15)

| Dosya | İstek | Sonuç |
| --- | --- | --- |
| art/inbox/p4a_mobilya_buyuk_v1.jpg | 4 nesne, 2×2, "iki kat ince ızgara" | Reddedildi: 1024 px çıktı, blok ≈5 px, masa yine ≈78 sanat pikseli |
| art/inbox/p4_tek_masa_v1.jpg | Tek masa, tuvalin %85'i | Reddedildi: eski masayı dev bloklarla (≈20 px) büyüttü, bulanık |

**Sonuç:** Gemini nesneleri kendi sabit "sanat pikseli" sayısıyla çiziyor; büyütmek ızgarayı inceltmiyor. Odadaki ölçekte (oda içinde çizilen nesneler) blok ≈4,3 px → masa ≈100, Buse ≈116 sanat pikseli; 128 px hedefe ~1,1–1,2x büyütmeyle yaklaşır. Kesin 1:1 piksel kontrolü Gemini ile mümkün değil.

## Oda içi üretim + fark yöntemiyle mobilya (2026-10-15)

Zincir (hepsi `art/inbox/`): `oda_bos_v1` → `oda_z1_masa_bitki` → `oda_z2_sandalye_lamba` → `oda_z3_tahta` → `oda_z4_kitaplik_bos` / `oda_z5_kitaplik_yarim` / `oda_z6_kitaplik_dolu`. Her adımda Gemini bir önceki görsele nesne ekledi; ardışık görsellerin farkıyla kesildi (`art/inbox/kesit/`), `tools/make_sheet.py` ile `p4_oda_kesitler.png` sayfasında birleştirildi, `art/configs/p4_oda_mobilya.json` ile **tek ölçekte** (`fixed_step` 3,91 = Buse'nin adımı) normalleştirildi.

| Sprite | Boyut (px) |
| --- | --- |
| furn_desk_eco_se | 135×112 |
| deco_plant_pot_se | 47×96 |
| furn_chair_eco_se | 62×97 |
| light_desk_lamp_se | 25×49 |
| edu_whiteboard_stand_se | 109×150 |
| furn_bookshelf_eco_se_empty / half / full | 78×107 / 97×120 / 126×139 |

Dizüstü, yazıcı, kettle ve sepet eski sayfadan (`p4_mobilya_ekonomik.json`, diğerleri `skip`). Büyütme ≈1,3x (önce 1,5x).

**extract_diff'te karşılaşılan durumlar ve çözümleri:** Gemini bazen başka nesneleri kaydırır/yeniden çizer → `--pick x:y` (nesne içindeki nokta), `--base` (boş oda; açığa çıkan zemin nesne sayılmaz), `--split` (bitişik parçaları ayırma gücü); yaprak araları için büyük delikler saydam bırakılır; gölge yalnız seçilen nesnenin yakınında ve alt bölgede aranır.

**Bilinen kusurlar:** yazı tahtası gölgesinde birkaç turuncu zemin çizgisi; kitaplığın üç doluluk hâli Gemini tarafından farklı boyda çizildi (boş 78 px, dolu 126 px genişlik) — oyunda aynı mobilyanın hâlleri olarak kullanılacaksa tek boyda yeniden üretmek gerekir.

## Oda arka planı ve oyun iskeleti (2026-10-15)

- `art/configs/oda_ev_bos.json` → `art/sprites/rooms/home_studio/room_home_studio_empty.png` (406×406). Adım 2,125: zemin tam 3×3 karo; (0,0) karosunun üst köşesi sprite'ta (216, 188). Mobilyalar odaya göre ~%9 iri (adımları 3,91/2048 ≈ 1,955/1024).
- Oyun: Vite + TypeScript + PixiJS 8. Yerleşim `src/content/rooms/homeStudio.ts`. G tuşu ızgarayı gösterir; ızgara zemin baklavasıyla örtüşüyor.

## Ofis odaları ve yardımcı koç (2026-10-16)

| Dosya | İstek | Sonuç |
| --- | --- | --- |
| art/inbox/ofis_semt_bos_v1.jpg | oda_bos_v1 referanslı, "5×4 karo", sıcak ahşap, 3 pencere, boş | Kabul. Gemini kare zemin çizdi → **4×4** kullanıldı |
| art/inbox/ofis_merkez_bos_v1.jpg | semt ofisi referanslı, modern, açık gri seramik, geniş pencere bandı, boş | Kabul → **5×5** |
| art/inbox/p5_yardimci_odada_v1.jpg | Buse'li odaya (v4) genç erkek yardımcı koç eklet | Kabul; Buse'den ~%19 büyük çizildi |

- **Gemini'nin izometrisi tam 2:1 değil (~1,87:1).** Kaynak dikeyde sıkıştırıldı (semt 0,922, merkez 0,939 → `*_2to1.png`), sonra `pixelnorm` (adım 3,15 / 2,54). Zemin köşeleri `tools/floor_corners.py` ile ölçüldü, `tools/grid_overlay.py` ile ızgara doğrulandı: semt zemini 512 px, (0,0) üst köşe (274, 215); merkez 640 px, (339, 274).
- Yardımcı koç: `extract_diff.py p1_buse_odada_v4.jpg p5_yardimci_odada_v1.jpg --pick 707:1485` → `art/configs/p5_yardimci.json` (boy 132 px = Buse + 5 cm) → `char_assistant_idle_se` 46×136. Odada SW yönü `flip` ile aynalanır.
- Oyun: `src/content/rooms/offices.ts` artık `background` kullanıyor (kodla çizilen kabuk yedek olarak `RoomScene`'de duruyor). Yardımcı koç yerleşimleri `minStaff` ile ekip sayısına bağlı; ekip değişince sahne yeniden kurulur.
- **Bilinen kusurlar:** merkez ofisin seramik derzleri oyun ızgarasıyla çakışmıyor (6 derz / 5 karo); yardımcı koçun sağ kenarında birkaç turuncu zemin pikseli; tek bir yardımcı koç görünümü var (iki kişi aynı sprite, biri aynalı).
- Gemini notları (devam aşağıda): görsel aracı bir sohbette "devre dışı" deyince yeni sohbet açmak çözdü; + menüsü ekran görüntüsünde boş görünür ama erişilebilirlik ağacında öğeler vardır (dosya girişi "file input" olarak aranmalı). Tarayıcı indirme klasöründe **en yeni dosya CreationTime'a göre seçilmeli** (LastWriteTime'a göre seçince eski bir dosya yanlışlıkla taşındı, hemen geri kondu).

## PixelLab ile öğrenci karakterleri (2026-10-16)

PixelLab (ücretsiz plan). Character Creator → Create from Text → Humanoid → **Standard** mod, **56 px** karakter boyu, Low Top-Down, "Realistic Male/Female" oran ön ayarı. 8 yönlü dönüş üretir; ZIP (`Idle/rotations/*.png`) indirilir, oyuna **güneydoğu (south-east)** yönü alınır.

| Sprite | Arşetip | Kaynak | Boyut (2×) |
| --- | --- | --- | --- |
| char_student_messy_se | Yetenekli ama dağınık (hardal kapüşonlu, kıvırcık) | art/inbox/pixellab/messy | 40×124 figür |
| char_student_quiet_se | Sessiz kopan (gri bol kapüşonlu, perçemli) | art/inbox/pixellab/quiet | 40×128 figür |
| char_student_anxious_se | Kaygılı mükemmeliyetçi (lavanta hırka, gözlük) | art/inbox/pixellab/anxious2 | — |

- **Ücretsiz plan sınırları:** karakter en fazla 64 px (128 px için abonelik), aynı anda tek üretim. 64 px ayarı figürü ~73 px çiziyor (2× = 146, Buse'den uzun) → **56 px** kullanılıyor (figür ~62–64 px, 2× ≈ 124–128 = Buse boyu).
- İçe aktarma: `tools/pixellab_import.py <ad> 2 art/sprites/characters/students <png>` — saydam kenar kırpma, 2× en yakın komşu büyütme, ayak altına yarı saydam piksel gölge, `_meta_<ad>.json`. Animasyon kareleri verilirse `<ad>_idle_0..n` yazar (oyun `AnimatedSprite` ile oynatır).
- Öğrenciler 2× büyütüldüğü için sanat pikseli Buse'nin (1×) iki katı; stil ve boy uyumlu ama yakından bakınca daha iri pikselli. 128 px abonelikle 1:1 olur.
- **Buse'ye dokunulmadı** (kullanıcı: "Buse karakterinin benzerliğini bozma"). Buse ve yardımcı koç için bekleme animasyonu kodla: ayaklar sabit, nefeste 1 piksel uzayıp kısalır (`RoomScene.update`), çizim değişmez.
- Vite izleyicisi `art/inbox` içindeki ZIP kilidinde (EBUSY) çöküyordu → `vite.config.ts` `server.watch.ignored` ile sanat klasörleri izlenmiyor.

## Öğrenilenler

- Gemini'de normal sohbette görsel aracı bazen "kullanılamıyor" diyor; + menüsünden **Görüntü oluştur** seçilince çalışıyor.
- Kamera açısını derece vererek değil, **görünen üst yüzeyleri** (başın tepesi, omuz üstleri, yaka üstü) tarif ederek istemek daha iyi sonuç veriyor.
- Çok yönlü karakter sayfasında Gemini görünüm sayısını kaçırıyor; **2 görünüm** (sağ-ön, sağ-arka) isteyip aynalamak daha güvenilir.
- Karakteri ayrı bir sayfada istemek açıyı değiştirmiyor; **karakteri onaylı odanın içine ekletmek** açıyı, ölçeği ve stili otomatik eşitliyor.
- Yeni varlık sayfaları aynı sohbette, oda görseli bağlamdayken istendiğinde stil tutarlı kalıyor.
- Çıktılar "sahte piksel" (ızgara tutarsız); oyuna girmeden önce normalleştirme aracından geçecek.

## Uzman personel: sekreter, rehber öğretmen, branş öğretmeni (2026-10-17)

| Kaynak | İstek | Sonuç |
| --- | --- | --- |
| art/inbox/p7_uzmanlar_odada_v1.jpg | Buse'li odaya (v4) üç yetişkin ekle: sekreter (koyu küt saç, lacivert hırka, pano), rehber (kır saç, sakal, bej yelek), branş öğretmeni (kızıl at kuyruğu, hardal kazak, kitaplar) | Sekreter ve branş öğretmeni kabul. Rehber halının üstünde çizildi; fark halıyı da aldı, ayaklar kesildi |
| art/inbox/p7_rehber_odada_v2.jpg | Yalnız rehber, halısız zeminde, ayakkabılar görünür | Kabul (odanın ön-sol kenarında, gri zemin üstünde) |

- Gemini (Flash) bu kez **1024 px** verdi; v4 2048 olduğundan fark için Lanczos ile 2048'e büyütüldü (*_2048.png). pixelnorm "çözünürlük yetersiz" uyarısı veriyor ama sonuç temiz (büyütmeden gelen yumuşaklık FFT tahminini şaşırtıyor).
- Kesim: extract_diff.py p1_buse_odada_v4.jpg p7_uzmanlar_odada_v1_2048.png art/inbox/p7 --names secretary,counselor,teacher --pick 836:920,1267:1310,1568:1593 (rehber v2'den ayrıca). Konfigler rt/configs/p7_*.json; rehberin açık mavi gömleği gri zeminle karıştığı için g_tolerance 8.
- Yeni araç **	ools/sprite_cleanup.py**: pixelnorm çıktısında ince çıkıntıları (--despur: saç ucuna yapışan duvar/zemin kırıntısı), kopuk parçaları, gerekirse alttaki açık halı parçalarını (--strip-light-bottom) siler; gölgeyi düzgün bir elips olarak yeniden çizer ve boş alt satırları kırpar (çapa alt-orta; boş satır karakteri havada gösterir). Sıra: pixelnorm → sprite_cleanup.
- Sprite'lar rt/sprites/characters/staff/char_staff_{secretary,counselor,teacher}_se (53×129, 50×135, 57×125). Odada personel yuvaları (Placement.minStaff) önce her rolden birer kişiyle dolar; sprite content/staff.ts → ROLE_SPRITE. Semt ofisi 2, merkez 3 yuva.
- **Bilinen kusurlar:** rehberin bacak arasında birkaç açık piksel; tek görünüm (SE, aynası SW), yürüme karesi yok.

## Çizgi film tarz denemesi (2026-10-17)

Kullanıcı Game Dev Tycoon benzeri temiz çizgi film görünümü istedi ("pixel art ile hata mı ettik?"). Deneme yalnız ev odasında; ofisler pixel art kaldı. Oyunda HUD'daki 🎨 düğmesi ya da adreste `?stil=cizgi` / `?stil=piksel` ile geçiş.

| Kaynak | İstek | Sonuç |
| --- | --- | --- |
| art/inbox/cizgi/c1_ev_odasi_v1.jpg | Game Dev Tycoon tarzı, 3×3 m ev çalışma odası, iki arka duvar, mobilya arka duvarlarda, zemin ortası boş | Kabul (1024 px) |
| art/inbox/cizgi/c2_ev_karakterler_v1.jpg | Aynı odaya Buse + 3 öğrenci (önceki tasarımlarına sadık) | Kabul |

- Kesim: `extract_diff.py c1 c2 art/inbox/cizgi/kesit_t20 --names buse,anxious,messy,quiet --pick ... --threshold 20`; açık zemindeki beyaz ayakkabılar farkta kayboldu.
- Yeni araç **`tools/cartoon_cut.py`** (konfig `art/configs/cizgi_ev.json`): oda arka planı kırpılıp saydamlaştırılır, dikeyde 0,867 sıkıştırılır (Gemini ~1,73:1 çizdi), zemin köşelerinden floorOrigin hesaplanır (`floor_corners.py`). Karakterlerde fark maskesi özgün görselden koyu kontur + kapatma + doldurma ile tamamlanır (ayakkabılar geri gelir), boş odayla aynı kalan pikseller (arkadaki raf) atılır, gölge yumuşak elips. Hepsi **2x çözünürlük** (`resolution: 2`) ve **yumuşak ölçekleme** (`smooth`): manifest bu alanları taşır, oyun dokuyu doğrusal filtreyle yükler, kamera çizgi film tarzında ara yakınlıkları da kullanır (telefonda oda ekranı doldurur).
- Ölçek: zemin genişliği 808 px = 3 karo (384 oyun pikseli) → 0,4752. Karakterler bu ölçekte 140–170 px (Gemini kişileri odaya göre iri çiziyor; Game Dev Tycoon'daki gibi tombul durur).
- **Deneme sınırları:** mobilya arka plana gömülü (karakterler yalnız mobilyanın önünde durur), öğrencilerin tek görünümü var, yardımcı koç/uzmanlar ve ofisler çizgi film değil. Kalıcı geçişte oda boş üretilip mobilya "ekle + fark" ile ayrı sprite yapılmalı.
