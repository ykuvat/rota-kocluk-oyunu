# PROJECT_CONTEXT

Kısa süreklilik notu. Ayrıntı: `docs/gelistirme-gunlugu.md` (oynanış, denge), `docs/varlik-gunlugu.md` (sanat), `CLAUDE.md` (mimari kurallar).

## Durum (2026-10-16)
- Oyun tarayıcıda oynanır (`npm run dev`, :5173). Varsayılan "oyun modu": tur tabanlı hafta (Haftayı başlat → ~4 sn → sonuç ekranı), sağda karar kartları, altta öğrenci şeridi, Buse'nin anlattığı 5 adımlı eğitim. Eski ayrıntılı paneller ⚙ / F2.
- Simülasyon: öğrenci, veli, ekonomi, huni, olaylar, sertifika, ofis, personel, ÜYS/sezon, tercih dönemi, rakipler, iflas. Kayıt şeması v10. 102 test (3 sezonluk denge botu dahil).
- Görsel: ev stüdyosu + semt (4×4) / merkez (5×5) ofis arka planları; Buse, yardımcı koç, 3 öğrenci (Gemini, "Buse'li odaya ekle + fark" yöntemi). Buse ve yardımcı koçlar odada iş noktaları arasında yürür (`render/walkers.ts`, `RoomDef.workSpots/hub`), öğrenciler `studentSpots`'ta durur, arada etrafa bakar.

## Kararlar
- Oyuncuya hesap yaptırılmaz; kart dili, görünür sonuç (kullanıcı geri bildirimi).
- **Buse'nin çizimi değiştirilmez**; hareket yalnız konum/aynalama/1 px adım-nefes ile.
- PixelLab öğrencileri reddedildi ("çok kötü"); karakterler Gemini fark yöntemiyle üretilir.
- Ücretli işlem/hesap açma kullanıcıya ait.

## Açık sorunlar
- Karakterler yalnız SE (ve aynası SW) görünümlü; kuzeye yürürken de önden görünür. Yürüme kareleri yok.
- Öğrenci kesitlerinde kenarda birkaç turuncu zemin pikseli.
- İlk sezon hedef tutturma düşük (%21); güven oturmuş kurumda ~99'da doyuyor.
- Merkez ofis seramik derzleri ızgarayla çakışmıyor.

## Sıradaki
- Buse ve öğrenciler için arka (NE) görünüm ve yürüme kareleri (Gemini fark yöntemi) → yürüyüş animasyonu.
- Her arşetip için ikinci görünüm (`char_student_<tür>_b_se`).
