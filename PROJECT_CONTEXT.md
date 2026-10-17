# PROJECT_CONTEXT

Kısa süreklilik notu. Ayrıntı: `docs/gelistirme-gunlugu.md` (oynanış, denge), `docs/varlik-gunlugu.md` (sanat), `CLAUDE.md` (mimari kurallar).

## Durum (2026-10-17)
- Oyun tarayıcıda oynanır (`npm run dev`, :5173). Varsayılan "oyun modu": tur tabanlı hafta (Haftayı başlat → 1× ≈ 10 sn, ⏩ 2×/4×, ⏸ → sonuç ekranı), sağda karar kartları, altta öğrenci şeridi, Buse'nin anlattığı 5 adımlı eğitim. Eski ayrıntılı paneller ☰ → Ayrıntılı paneller / F2 (mobilde gizli). ☰ ayarlar: dil, tarz, kaydet, rehber, yeni oyun.
- Karar kartları: seçilen kart seçimi ve sonucuyla yerinde kalır, hafta başlayınca temizlenir; hata (saat yetmedi vb.) kartın içinde yazar; başlıkta Buse'nin boş saati. Sohbet haftada bir, karar kartına öğrencinin ağzından asıl nedeni ima eden ipucu ekler (güven < `INSIGHT.clueMinTrust` ise açılmaz). Veli görüşmesi memnuniyet önce→sonra gösterir.
- Simülasyon: öğrenci, veli, ekonomi, huni, olaylar, sertifika, ofis, personel (yardımcı koç, sekreter, rehber, branş öğretmeni), şubeler (Aşama 4), ÜYS/sezon, tercih dönemi, rakipler, iflas. Kayıt şeması v11. 109 test (3 sezonluk denge botu dahil).
- Görsel: ev stüdyosu + semt (4×4) / merkez (5×5) ofis arka planları; Buse, yardımcı koç, sekreter, rehber, branş öğretmeni, 3 öğrenci (Gemini, "Buse'li odaya ekle + fark" yöntemi). Buse ve yardımcı koçlar odada iş noktaları arasında yürür (`render/walkers.ts`, `RoomDef.workSpots/hub`), öğrenciler `studentSpots`'ta durur, arada etrafa bakar.

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
- İlk sezon hedef tutturma düşük (%21); güven oturmuş kurumda ~99'da doyuyor. Yaşam olaylarıyla good bot 3. sezon tutturma 0,51 (testin alt sınırı 0,5). 16 tohumda "pasif ilk yıl batar" 0,44 (eşik 0,5).
- Merkez ofis seramik derzleri ızgarayla çakışmıyor.
- Şubelerin ayrı sahnesi yok; personel yuvası semt 2, merkez 3 (fazlası odada görünmez).
- Güven ~99'da doyduğu için kalite yatırımı (branş, rehber) gelire dolaylı dönmüyor; büyüme şubelerden geliyor.

## Sıradaki
- Merkez ofis: sessiz öğrenci seansı ve masa başı pozu (Gemini sınırı sıfırlanınca; aynı sohbette m2 -> m3). Şube sahnesi.
- Buse ve öğrenciler için arka (NE) görünüm ve yürüme kareleri (Gemini fark yöntemi) → yürüyüş animasyonu.
- Her arşetip için ikinci görünüm (`char_student_<tür>_b_se`).
