# PROJECT_CONTEXT

Kısa süreklilik notu. Ayrıntı: `docs/gelistirme-gunlugu.md` (oynanış, denge), `docs/varlik-gunlugu.md` (sanat), `CLAUDE.md` (mimari kurallar).

## Durum (2026-10-17)
- Oyun tarayıcıda oynanır (`npm run dev`, :5173). Varsayılan "oyun modu": tur tabanlı hafta (Haftayı başlat → 1× ≈ 10 sn, ⏩ 2×/4×, ⏸ → sonuç ekranı), sağda karar kartları, altta öğrenci şeridi, Buse'nin anlattığı 5 adımlı eğitim. Eski ayrıntılı paneller ☰ → Ayrıntılı paneller / F2 (mobilde gizli). ☰ ayarlar: dil, tarz, kaydet, rehber, yeni oyun.
- Karar kartları: seçilen kart seçimi ve sonucuyla yerinde kalır, hafta başlayınca temizlenir; hata (saat yetmedi vb.) kartın içinde yazar; başlıkta Buse'nin boş saati. Sohbet haftada bir, karar kartına öğrencinin ağzından asıl nedeni ima eden ipucu ekler (güven < `INSIGHT.clueMinTrust` ise açılmaz). Veli görüşmesi memnuniyet önce→sonra gösterir.
- Simülasyon: öğrenci, veli, ekonomi, huni, olaylar, sertifika, ofis, personel (yardımcı koç, sekreter, rehber, branş öğretmeni), şubeler (Aşama 4), ÜYS/sezon, tercih dönemi, rakipler, iflas. Kayıt şeması v11. 109 test (3 sezonluk denge botu dahil).
- Görsel: ev stüdyosu + semt (4×4) / merkez (5×5) ofis arka planları; Buse, yardımcı koç, sekreter, rehber, branş öğretmeni, 3 öğrenci (Gemini, "Buse'li odaya ekle + fark" yöntemi). Buse ve yardımcı koçlar odada iş noktaları arasında yürür (`render/walkers.ts`, `RoomDef.workSpots/hub`), öğrenciler `studentSpots`'ta durur, arada etrafa bakar.

- Kariyer: 3 sezon; 3. ÜYS'de final (karne + mühür): Başarı %60, Güven 85, Büyüme 1 şube → Koç/Bronz/Gümüş/Altın; `src/content/career.ts`, `src/sim/career.ts`. Devam et ile oyun sürer.

## Yayın
- Depo: github.com/ykuvat/rota-kocluk-oyunu (herkese açık). Oynanabilir: https://ykuvat.github.io/rota-kocluk-oyunu/
- `main`'e gönderim → `.github/workflows/pages.yml`: `npm ci`, `npm test`, `BASE_PATH=/<depo>/ npm run build`, Pages'e yayın. `art/sprites` commit'te olmalı (derleme sprite'ları oradan senkronlar).
- Sistemde git yok; GitHub Desktop'ın git'i: `%LOCALAPPDATA%\GitHubDesktop\app-<sürüm>\resources\app\git\cmd\git.exe`. Gönderim GitHub Desktop ile.

## Kararlar
- Oyuncuya hesap yaptırılmaz; kart dili, görünür sonuç (kullanıcı geri bildirimi).
- **Buse'nin çizimi değiştirilmez**; hareket yalnız konum/aynalama/1 px adım-nefes ile.
- Görsel tarz: **çizgi film varsayılan** (Game Dev Tycoon benzeri; `tools/cartoon_cut.py`); pixel art 🎨 ile hâlâ seçilebilir. Ev odası, semt ve merkez ofis, Buse, öğrenciler ve 4 personel rolü çizgi film.
- Öğrenciler odada sürekli durmaz: koçluk günü gelir, Buse'yle masada oturur (`ui/roomLife.ts`). İsimler görünümün cinsiyetine uyar.
- PixelLab öğrencileri reddedildi ("çok kötü"); karakterler Gemini fark yöntemiyle üretilir.
- Ücretli işlem/hesap açma kullanıcıya ait.

## Açık sorunlar
- Karakterler yalnız SE (ve aynası SW) görünümlü; kuzeye yürürken de önden görünür. Yürüme kareleri yok.
- Öğrenci kesitlerinde kenarda birkaç turuncu zemin pikseli.
- Denge (2026-10-25, 16 tohum): good tutturma 0,32/0,68/0,74, lean 0,32/0,67/0,69; güven ≤ 95 (veli memnuniyeti dinlenme düzeyi üstünde geri çekilir, `parent.satisfactionRest/Decay`). Sınırda: passive 1. sezon iflas 0,50 (eşik 0,50), good 2. sezon güven 94,4 (eşik 95). Ayrıntı: docs/gelistirme-gunlugu.md.
- Merkez ofis seramik derzleri ızgarayla çakışmıyor.
- Rehber (counselor) ve branş öğretmeni sprite'larında kırıntı / mobilya arkasında kalan bacak var: Gemini'de düz gri zeminde yeniden çizilecek (referans: Buse + iki karakter yan yana; 27.10'da Gemini görsel aracı hata verdi). Kesim için `tools/cut_objects.py`, ayrı `_meta_*.json`; `cizgi_semt.json`'dan iki öğe çıkarılır.
- Şubelerin ayrı sahnesi yok; personel yuvası semt 2, merkez 3 (fazlası odada görünmez).

- Çizgi film ofisleri ev stüdyosuyla aynı 3×3 karo: ofise taşınınca oda büyümüyor, yalnız masa ekleniyor (kullanıcı şikâyeti 2026-10-26). 3B'de semt 4×4, merkez 5×5 kurulacak.

## GÜNCEL (2026-10-27): 3B REDDEDİLDİ ("rezalet; 2B/2.5B detaylı çizin"). Blender/3B yolu bırakıldı (art/3d, tools/blender commit edilmedi). Görseller Gemini ile detaylı 2B çizgi film.
- Yapıldı (27.10): gerçek semt (4×4) ve merkez (5×5) ofisleri + makine sprite'ları (docs/varlik-gunlugu.md 'Gerçek ofisler'); ofis makineleri mekaniği (content/machines.ts, kayıt v12). Eski not: 4×4 semt ofisi Gemini'de üretildi (Chrome, gemini.google.com/u/1, sohbet 07029b9d26415c9c, model Pro, referans art/inbox/cizgi/c1_ev_odasi_v1.jpg; istem: aynı nesne boyutu, 4 m × 4 m zemin). Görsel iyi, henüz İNDİRİLMEDİ → indir (D:\Yeni klasör → art/inbox/cizgi/), aynı sohbette 5×5 merkez ofis, sonra cartoon_cut ile kes, RoomDef tilesX/Y 4 ve 5.

## (Eski plan) Sıradaki (3B geçişi, 2026-10-26; kullanıcı onaylı, limit dolarsa 27.10.2026 08:30'a kadar kesintisiz devam)
- Ekip: Tengri koordine eder; Ayaz Blender (başsız, `blender.exe -b -P`), Kor oyun entegrasyonu, Börü denetim. Görev kayıtları `.kuvat/` (git dışı).
- 3B paketler `art/3d/vendor/` (git dışı; ham model yeniden dağıtılmaz, depoya yalnız render): Quaternius Universal Base Characters + Universal Animation Library (CC0), Kenney Furniture Kit (CC0), KayKit Furniture Bits (CC0). Betikler `tools/blender/`, .blend kaynak `art/3d/src/` (git dışı), render `art/3d/renders/`.
- Buse'nin tasarımı korunur (referans `art/sprites/cartoon/home/char_buse_cartoon_se.png`: dalgalı koyu kahve saç, zeytin yeşili parka, krem bluz, açık mavi kot, beyaz ayakkabı, yeşil çanta).
1. Deneme: Buse (SE idle + 8 kare yürüme + 8 yön) ve 3×3 ev stüdyosu render; `compare.png` ile kullanıcıya göster.
2. Ofisler 3B: semt 4×4, merkez 5×5 (alan gerçekten büyüsün), personel yuvaları ve çalışma noktaları.
3. Öğrenciler (3 arşetip, cinsiyet uyumlu) ve personel rolleri 3B; yürüme animasyonu, 8 yön.
4. Oyuna entegrasyon: ayarlarda yeni "3B" tarzı (`platform/artStyle.ts`), `RoomDef`'ler, yürüyen karakterlerde yön ve kare; beğenilirse varsayılan.
- Bekleyen: GitHub'a push (af8cf53 kariyer, cb3e580 ekip kararları) — kullanıcı GitHub Desktop'tan basar.
