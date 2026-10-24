# Geliştirme Günlüğü

GDD MVP kilometre taşlarına göre ilerleme. Yeniden çalıştırma: `npm test`, `npm run dev`.

## M0 — Temel (tamam)

- Vite + TypeScript + PixiJS 8 iskeleti, izometrik oda sahnesi (`src/render`), kamera, TR/EN.
- Deterministik çekirdek: tohumlu RNG (`core/rng.ts`), saatlik tick (`sim/step.ts`), komut deseni (`sim/commands.ts`), değiştirici yığını (`sim/modifiers.ts`), sürümlü kayıt (`platform/save.ts`).

## M1 — Öğrenci prototipi (oynanabilir ilk sürüm)

| Parça | Dosya | Durum |
| --- | --- | --- |
| Öğrenci modeli (kişilik, durum, konu ustalığı, ön koşul) | `sim/student.ts`, `content/archetypes.ts`, `content/curriculum.ts` | tamam |
| Günlük çalışma: uyum olasılığı, ustalık kazancı, yorgunluk, tükenme, unutma | `sim/student.ts`, `content/balance.ts` | tamam |
| Deneme sınavı (2 haftada bir, soru bazlı gürültü, kaygı/yorgunluk etkisi) | `sim/exam.ts` | tamam |
| Gözlem sisi (aralık + tanıma), görüşme kartları, haftalık sinyaller | `sim/insight.ts` | tamam |
| Müdahale kartları (7), neden uyumu, tekrar azalması, güven etkisi | `content/interventions.ts`, `sim/commands.ts` | tamam |
| Öğrenci paneli (gözlem, sinyal, deneme, program, düğmeler) | `ui/studentPanel.ts` | tamam |
| Kaydet/yükle (otomatik haftalık, S, N) | `platform/save.ts` | tamam |
| Program düzenleyici (7 gün, blok ekle/çıkar, canlı uyum tahmini) | `ui/programEditor.ts`, `sim/estimate.ts` | tamam |
| Veli modeli (tarz, beklenti, algılanan gelişim, baskı, ayrılma, veli görüşmesi) | `sim/parent.ts` | tamam |
| Kayıt şeması v2 + 1→2 göçü | `platform/save.ts` | tamam |

### Denge ölçümleri (10–12 hafta, 12 tohum ortalaması; `tests/balance.test.ts`)

| Senaryo | Kaygılı mükemmeliyetçi | Yetenekli dağınık | Sessiz kopan |
| --- | --- | --- | --- |
| Dengeli program: kazanç / uyum | 15,7 / %98 | 8,3 / %45 | 8,9 / %52 |
| Aşırı yük: kazanç / uyum | 13,0 / %65 | 1,1 / %4 | 0,3 / %3 |
| Sinyal okuyan koç: kazanç / uyum | — | 11,1 / %52 | 8,8 / %48 |
| Pasif koç: kazanç / uyum | — | 9,3 / %44 | 7,4 / %41 |

**Ayar turu (2026-10-16):** müdahaleler güçlendirildi ve doğru teşhisin %30'u kalıcı alışkanlığa dönüşüyor. Sinyal okuyan koç artık açık farkla önde; "her kartı her hafta dene" istismarı aynı hafta etki azalması + baskı ile kapatıldı.

| 12 hafta, 12 tohum | Sessiz kopan: kazanç / uyum | Yetenekli dağınık: kazanç / uyum |
| --- | --- | --- |
| Sinyal okuyan koç | 12,4 / %64 | 15,1 / %71 |
| Pasif koç | 8,6 / %44 | 11,4 / %50 |
| Her kartı her hafta dene (istismar) | 9,4 / %48 | 10,5 / %46 |

Veli: 20 haftada veliyle hiç görüşmeyen koç 36 öğrenciden 4'ünü kaybediyor, 3 haftada bir görüşen 0.

Program tahmini: gözlem ortalarıyla beklenen logit ± 1,75σ (σ = merkez sapmasının gerçek dağılımı). 30 öğrencide ≥%80 isabet, ortalama genişlik < 0,6.

## M2 — İşletme döngüsü (ilk dilim tamam, 2026-10-16)

| Parça | Dosya | Durum |
| --- | --- | --- |
| Kişisel hesap / işletme kasası, defter, aylık tahsilat ve giderler, kredi kartı faizi, maaş çekme | `sim/economy.ts`, `content/business.ts` | tamam |
| Aday hunisi: çevre, organik içerik, ücretli reklam (azalan getiri), tavsiye; aday soğuması | `sim/funnel.ts` | tamam |
| Tanışma görüşmesi: fiyatı oyuncu verir; ödeme isteği gizli; fiyat veli memnuniyetini etkiler | `sim/commands.ts` | tamam |
| Koç kapasitesi: öğrenci başı 3 sa/hafta takip; ihmal; ideal vaka (8) üstünde herkesin kalitesi ve veli memnuniyeti düşer | `sim/funnel.ts` | tamam |
| İtibar: bilinirlik (sönümlü), kurum güveni (veli memnuniyetine yakınsar, ayrılma cezası) | `sim/funnel.ts` | tamam |
| Arayüz: para/itibar HUD, işletme paneli, öğrenci sekmeleri; yeni oyun öğrencisiz başlar | `ui/businessPanel.ts`, `ui/hud.ts`, `ui/studentPanel.ts` | tamam |
| Kayıt şeması v3 + 2→3 göçü | `platform/save.ts` | tamam |
| Olay motoru, ofis/kira, sertifikalar | aşağıda (M2 ikinci dilim) | tamam |

## M2 — İkinci dilim (2026-10-16)

| Parça | Dosya | Durum |
| --- | --- | --- |
| Hafta ortası kayıtta takip saati o hafta ayrılır (yoksa ilk hafta ihmal) | `sim/funnel.ts` (`enrollFromLead`) | tamam |
| Kayıt sezonu: aylık talep çarpanı (Haziran–Eylül yüksek, Mart–Mayıs düşük) organik, reklam ve tavsiyeye uygulanır | `content/business.ts` (`SEASONALITY`) | tamam |
| Olay motoru: sabah 08:00 anlatıcı zarı (olaysız gün gerilimi artırır, üst üste kötü olay seyreltilir), bekleyen olay, süre dolunca varsayılan sonuç, gecikmeli sonuçlar | `sim/events.ts` | tamam |
| İlk 8 olay: puan garantisi, rakip teklif, gece mesajı, viral paylaşım, hafta sonu dersi, bilgisayar arızası, şikâyet tehdidi, kardeş kaydı | `content/events.ts`, `platform/i18n.extra.ts` | tamam |
| Koçun geçici saat yükleri (ek iş, eğitim, arıza) | `sim/state.ts` (`addCoachPenalty`) | tamam |
| Gelen kutusu arayüzü: olay kartları, seçenek maliyeti, yeni olayda oyun durur, son gelişmeler | `ui/inboxPanel.ts` | tamam |
| Sertifikalar (5): para + haftalarca koç saati; kayıt, müdahale, veli görüşmesi, görüşme, içerik etkileri | `content/growth.ts`, `sim/growth.ts` | tamam |
| Aşamalar: 1 evden (kapasite 10) → 2 tanınan koç (4 öğrenci, güven 50, 40.000 ₺ tahsilat) → 3 ofis (semt / merkez; depozito, kurulum, aylık kira + fatura, kapasite, kayıt bonusu) | `sim/growth.ts`, `ui/businessPanel.ts` (Gelişim sekmesi) | tamam |
| Kayıt şeması v4 (olaylar) ve v5 (sertifika, aşama, ofis) göçleri | `platform/save.ts` | tamam |

Testler: 78 (yeni: `tests/events.test.ts`). İşletme botu ev kapasitesiyle: 3.000 ₺ → 10 öğrenci / 7.525 ₺; 6.000 ₺ → 9,9 / 54.125 ₺; 12.000 ₺ → 0,2 / −56.891 ₺. Bot olaylara yanıt vermiyor (hepsi varsayılan sonuçla kapanıyor); yine de makul fiyat sağlam.

**Bilinen eksikler:** Olay sonuçları tek satır bildirim; bildirim geçmişi paneli yok.

## M3 — Personel ve ofis sahnesi (2026-10-16)

| Parça | Dosya | Durum |
| --- | --- | --- |
| Yardımcı koç: ofisle haftalık başvuru (beceri sisli aralık, istenen maaş), işe alma, 4 hafta sonra beceri netleşir | `sim/staff.ts`, `content/staff.ts` | tamam |
| Maaş + %22,5 işveren maliyeti her ayın 1'inde; işten çıkarmada 1 ay kıdem; +1.000 ₺ zam | `sim/staff.ts` | tamam |
| Öğrenciye takip koçu atama; takip saati koçun 40 saatinden; beceri takip kalitesini (güven, motivasyon, veli) belirler | `sim/funnel.ts` (`weeklyPlanning`), `ui/studentPanel.ts` | tamam |
| Vaka yükü cezası artık koç başına (ideal 8) | `sim/funnel.ts` | tamam |
| Moral: piyasa altı maaş ve fazla vaka düşürür; eşik altında istifa, öğrenciler oyuncuya döner | `sim/staff.ts` | tamam |
| Ekip arayüzü (Gelişim sekmesi), aylık tahmine maaşlar | `ui/businessPanel.ts`, `sim/economy.ts` | tamam |
| Ofis odaları: semt (5×4) ve merkez (6×5); duvar/zemin/pencere kodla çizilir, mobilya mevcut sprite'lar; ofis kiralanınca sahne değişir | `content/rooms/offices.ts`, `render/RoomScene.ts`, `main.ts` | tamam |
| Kayıt şeması v6 + 5→6 göçü | `platform/save.ts` | tamam |

Denge (12 hafta, 8 tohum, merkez ofis, 16 öğrenci, dengeli program, veli görüşmesi yok): tek başına → 15,6 ayrılan, veli memnuniyeti 8; iki yardımcı (beceri 60) → 0 ayrılan, memnuniyet 60. Yardımcı koç maliyeti (beceri 60 ≈ 30.250 ₺ + işveren payı ≈ 37.000 ₺/ay) ancak ~6+ öğrenci üstlenince kârlı.

## M3 — Oynanış döngüsü: geçmiş, ÜYS, sezon (2026-10-16)

| Parça | Dosya | Durum |
| --- | --- | --- |
| Kalıcı bildirim geçmişi: önemli olaylar `state.history`'de (300 kayıt; olay günlüğü kırpılsa da kalır) | `sim/state.ts` (`NOTABLE`) | tamam |
| Geçmiş paneli (H / alt ortadaki düğme): tarihli liste, okunmamış sayacı, filtre (öğrenci, kurum, olay), kötü haber kırmızı | `ui/historyPanel.ts`, `ui/notices.ts` | tamam |
| Yıl sonu ÜYS (her sezon 19 Haziran 10:00): sınav günü kaygısı, net, sıralama (2,4 milyon aday), velinin beklentisinden hedef net | `sim/season.ts`, `content/season.ts` | tamam |
| Sonuçların etkisi: hedefi tutan başına kurum güveni +3, tutmayan −2 (±12 sınır), bilinirlik, yaz dönemi tavsiye adayı; öğrenciler mezun olur | `sim/season.ts` | tamam |
| Sezon sonu raporu (oyun durur): başarı oranı, ilk denemeye göre net artışı, sonuç tablosu, sezonun kategori bazlı gelir-gideri, güven değişimi; "Yeni sezona başla" | `ui/seasonReport.ts` | tamam |
| Yeni sezon: sayaçlar sıfırlanır, sonraki ÜYS bir yıl sonra; öğrenci panelinde mezun sonucu | `sim/season.ts`, `ui/studentPanel.ts` | tamam |
| Kayıt şeması v7 + 6→7 göçü | `platform/save.ts` | tamam |

Testler: 93 (yeni: `tests/season.test.ts`). 12 öğrenciyle tek başına, dengeli program ve ayda bir veli görüşmesi: 8'i sezonu bitirdi (4'ü vaka yükünden ayrıldı), ortalama +22,8 net, %75 hedef tutturma, ortalama 43,8 net.

## M3 — Sezon pazarı: sınıf düzeyi, tercih dönemi, rakipler (2026-10-16)

| Parça | Dosya | Durum |
| --- | --- | --- |
| Sınıf düzeyi: adaylar 11 ya da 12 (11. sınıf payı aya göre: yazın %45, baharda %10); 11'ler %75 ustalıkla başlar, ÜYS günü 12'ye geçip kalır (veli +4), ertesi yıl sınava girer | `content/season.ts` (`GRADES`), `sim/funnel.ts`, `sim/season.ts` | tamam |
| Tercih dönemi: ÜYS'den 24 gün sonra açılır, 14 gün sürer; mezunlar + bilinirliğe göre dışarıdan talepler; fiyatı oyuncu verir, 2 koç saati; kabulde gelir, küçük güven, tavsiye adayı | `sim/market.ts` | tamam |
| Rakipler: sezon sonunda başarı oranı ilan (%45–72); hepsini geçersek güven +4, sonda kalırsak −3; iki rakip birer hamle: fiyat savaşı (10 hf kayıt logit −0,4), reklam bombardımanı (8 hf talep ×0,75), yeni şube (bilinirlik −8), ekip ayartma (yeni olay `staffPoach`) | `sim/market.ts`, `sim/marketEffects.ts`, `content/events.ts` | tamam |
| Arayüz: aday ve öğrencide sınıf, işletme panelinde tercih talepleri ve rakip baskısı, raporda 12'ye geçen, rakip tablosu ve hamleleri; geçmişte yeni olay türleri | `ui/businessPanel.ts`, `ui/seasonReport.ts`, `ui/notices.ts` | tamam |
| Kayıt şeması v8 + 7→8 göçü (eski öğrenci ve adaylar 12. sınıf) | `platform/save.ts` | tamam |

Testler: 101 (yeni: `tests/market.test.ts`).

## Denge — 3 sezonluk tam oyun botu (2026-10-16)

`tests/bot.ts` bir oyuncunun bütün kararlarını komutlarla verir (aday kabulü ve fiyat, program, sinyale göre müdahale, veli görüşmesi, olay yanıtları, maaş çekme, pazarlama, sertifika, ofis, yardımcı koç işe alma ve atama, tercih danışmanlığı). `tests/fullgame.test.ts` 4 stratejiyi 3 sezon (≈ 2,8 oyun yılı) oynatır. Daha çok tohum için: `FULLGAME_SEEDS=16 npx vitest run tests/fullgame.test.ts`.

**İlk ölçümde bulunanlar ve düzeltmeler**

| Sorun | Neden | Düzeltme |
| --- | --- | --- |
| Makul oyuncu 3. sezonda −115 bin ₺ | 2 yardımcı koç sezonda 1,05 milyon ₺ (ücret gelirinin %75'i) | maaş = 13.000 + 150 × beceri (önce 17.000 + 220 ×) |
| 11.000 ₺ fiyat en kârlı strateji | pazar fiyata duyarsız | kayıt logit fiyat ağırlığı 0,9 → 1,3 |
| Pasif oyuncunun borcu −1,5 milyon ₺ | sınırsız kredi kartı faizi, oyun sonu yok | **iflas**: ayın 1'inde net varlık < −75.000 ₺ → oyun biter (şema v9, iflas ekranı) |
| 2. sezondan itibaren %100 hedef tutturma | hedef, her veli görüşmesinde düşen beklentiden hesaplanıyordu | hedef = 24 + kayıttaki beklenti × 0,35 (önce 18 + güncel beklenti) |
| Güven ve memnuniyet hep 100 | 3 haftada bir veli görüşmesi tam etki | 4 haftadan sık görüşme yarım etki |
| Ofisli kuruma hafta sonu dersi teklifi | koşul yalnız kişisel bakiyeydi | yalnız Aşama 1–2 |

**Son ölçüm (16 tohum, sezon sonu ortalamaları)**

| Strateji | 1. sezon servet / iflas | 3. sezon servet / iflas | 3. sezon hedef tutturma | Not |
| --- | --- | --- | --- | --- |
| Makul (6–8 bin ₺, ofis, 2 yardımcı) | 135 bin / %0 | 403 bin / %0 | %67 (2. sezon %64) | 1. sezon %21: geç kaydolan öğrencinin zamanı az |
| Pasif | −63 bin / %56 | iflas / %100 | — | ilk yıl batar |
| Ucuz (3.500 ₺) | 63 bin / %0 | 13 bin / %31 | %13 | kalabalık → 26 yarıda bırakan, güven 42 |
| Pahalı (11.000 ₺) | −23 bin / %56 | 199 bin / %56 | %46 | ya batar ya yavaş büyür |

`tests/fullgame.test.ts` bu ilişkileri doğrular: makul oyuncu iflas etmez ve büyür, 3. sezon tutturma %50–95, pasif çoğunlukla batar, uç fiyatlar geride kalır.

**Açık ayar hedefleri:** 1. sezon tutturma düşük (%21); ilk sezona özel "geç kayıt" hedef indirimi düşünülebilir. Oturmuş kurumda güven ~99'da doyuyor (veli memnuniyetine yakınsıyor); ileride güveni sonuç oranına da bağlamak gerekebilir. Bot yazın öğrenci azalınca yardımcı koçu tutmaya devam ediyor; mevsimsel ekip yönetimi oyuncunun kararı.

## Ofis sanatı (2026-10-16)

Semt (4×4) ve merkez (5×5) ofis arka planları ile yardımcı koç sprite'ı Gemini'de üretildi ve oyuna bağlandı (ayrıntı: `docs/varlik-gunlugu.md`). Ofis kiralanınca sahne değişir; işe alınan yardımcı koçlar odada görünür (semtte 1, merkezde 2 yer). Semt ofisi 5×4'ten 4×4'e küçüldü (kapasite değişmedi).

## Oyun modu: "program değil oyun" (2026-10-16)

Kullanıcı geri bildirimi: oyun koçluk programı gibi duruyor; oyuncu detaya gömülünce hesap yapıyor, oynamıyor. Karar: **simülasyon aynen kalır, oyuncunun gördüğü ve karar verdiği şey sadeleşir.** Eski ayrıntılı paneller ⚙ (F2) arkasında duruyor.

| Parça | Dosya |
| --- | --- |
| Kararlar sütunu: aday (Uygun / Normal / Premium / Şimdi değil), öğrencinin haftalık kartı (sinyal + 3 çare + "bu hafta bekle"), huzursuz veli, olaylar, tercih talepleri, iş başvuruları | `ui/play/decisions.ts` |
| Tempo: oyun saati 120 ms (karar gelmeyen hafta 1×'te ≈ 20 sn), hız 1/2/4×; karar, haftalık özet, sezon raporu ya da iflas varken zaman akmaz | `main.ts` |
| Öğrenci şeridi: ruh hâli simgesi, tek satır ipucu, deneme eğilimi; tıklayınca sohbet / veli / takip koçu / ayrıntılar | `ui/play/studentStrip.ts`, `ui/play/common.ts` (`moodOf`) |
| Sade HUD: tek para bakiyesi, aylık eğilim, itibar yıldızları, zaman düğmeleri, Kurum / Geçmiş / ⚙ | `ui/play/playHud.ts` |
| Hedefler: 12 sıralı görev (en fazla 3 görünür), para ya da itibar ödülü; şema v10 | `content/quests.ts`, `sim/quests.ts` |
| Otomatik pilot: dengeli program kendiliğinden yazılır ve 3 haftada bir yenilenir; kişisel hesap eksiye düşmesin diye kasadan otomatik maaş | `ui/play/autopilot.ts` |
| Haftalık özet: öğrenci başına ruh hâli ve görev yüzdesi, para değişimi; kapatılabilir | `ui/play/weekSummary.ts` |
| Sahnede uçan geri bildirim: yeni öğrenci, tahsilat, ❤/💧, görüşme, deneme değişimi, hedef | `render/floaters.ts` |
| Kamera odayı boş alana sığdırır (sağ sütun ve alt şerit hariç) | `render/camera.ts` (`fit`) |

N tuşu artık onay soruyor. Testler: 102 (tam oyun botu 12 tohuma çıkarıldı; 6 tohumda tutturma oranı ±%10 oynuyordu).

**Sıradaki:** öğrenci karakterlerinin odada görünmesi (sprite gerekli), görsel kalite geçişi (kullanıcı: "elimle çizmişim gibi" — daha detaylı karakterler, ışık, animasyon), Kurum panelinin de kart diline çevrilmesi, ilk sezonun yumuşatılması.

## Tur tabanlı hafta ve eğitim (2026-10-16)

İlk oyun modu testinde kullanıcı: "5 dk oynadım, ne yaptığım hakkında hiç fikrim yok; zaman çok hızlı geçti; bir bildirim geldi, oyun durmadı, kabul edemedim." Kararlar:

- **Tur tabanlı hafta:** zaman kendiliğinden akmaz. Kartlara bakılır, "▶ Haftayı başlat" denir; hafta ≈ 4 sn oynar (saat başına 24 ms), bir olay çıkarsa durur ("⚡ Bir gelişme var"), cevap verilince "▶ Haftaya devam". Hafta oynarken diğer kartlar kilitli. Boşluk/Enter = başlat/devam.
- **Sonuç gösteren hafta sonu:** "Kararların" (✓ işe yaradı / ✗ tutmadı — asıl mesele: …), öğrencilerin görev yüzdesi ve deneme değişimi, bu hafta olanlar, gelen/giden/sonuç. Anlık bildirim yok; olanlar bu ekranda anlatılır.
- **Görünür amaç:** öğrenci kartında "Hedef 46 net · şimdi ~22" çubuğu; üstte "🎯 Sezon hedefi … X gün kaldı".
- **Yol gösteren ilk hafta:** Buse'nin konuştuğu 5 adımlı eğitim (aday seç → öğrenciler → haftayı başlat → çare seç → sendesin), ilgili alan parlar; "Eğitimi geç" var; ilerleme tarayıcıda.
- **Erken sadeleştirme:** zaman ve hız düğmeleri kaldırıldı; Kurum menüsü 3 öğrenci / Aşama 2 / 6. haftaya kadar gizli.

Tarayıcıda baştan oynandı: eğitim adımları, iki hafta, kararların sonucu ekranda doğru göründü.

**Görsel:** kullanıcı PixelLab'ı seçti (piksel sanata özel; tutarlı karakter, yönler, animasyon). Hesap açma oyuncuya ait; kullanıcı Chrome'da oturum açınca öğrenci karakterleri ve Buse/yardımcı koç animasyonları üretilecek.

## Öğrenciler odada (2026-10-16)

- PixelLab'da 3 öğrenci karakteri (kaygılı, dağınık, sessiz; ayrıntı `docs/varlik-gunlugu.md`). Odada aktif öğrenciler odaya özgü yerlerde (`RoomDef.studentSpots`: ev 3, semt 5, merkez 6) duruyor; başlarının üstünde ruh hâli simgesi, tıklanınca öğrenci kartı açılıyor. Arşetipe göre karakter; `_b` varyantları eklenirse kimliğe göre dağıtılır.
- Karakterlerde bekleme: animasyon kareleri varsa `AnimatedSprite`, yoksa (Buse dahil) kodla nefes — ayaklar sabit 1 piksel uzama. Buse'nin çizimine dokunulmadı.
- Vite artık `art/`, `tools/`, `docs/` klasörlerini izlemiyor (indirilen ZIP kilidi sunucuyu çökertiyordu).

## Oda yaşamı, isim-cinsiyet, çizgi film varsayılan (2026-10-17)

- **Çizgi film tarzı varsayılan** (🎨 / `?stil=piksel` ile pixel art). Ev odası arka planına seans masası eklendi.
- **Öğrenciler odada sürekli durmuyor** (`ui/roomLife.ts`, `content/visits.ts`): her öğrencinin haftalık koçluk günü var (kimlikten türetilir). Hafta oynarken gündüz o günün öğrencisi Buse'yle **seans masasında oturur**, aynı gün gelen diğerleri bekler; kimse gelmezse Buse odada dolaşır; gece ve eğitim (sertifika) saatlerinde Buse **masasında çalışır/ders çalışır**. Hafta dururken şeritte seçili öğrenciyle (yoksa ilkiyle) seans görünür; eğitim sürüyorsa masa başı.
- Pozlar, aynı kırpma ve ızgarayla üretilmiş **tam oda varyantları** (`RoomDef.poses`); geçişte 0,3 sn kararma (`RoomScene.setBackground`). Üst katman denendi: Gemini masa başı görselinde odayı yeniden çizdiği için fark kesimi tutmadı.
- **İsim ↔ görünüm:** arşetiplere cinsiyet (kaygılı kız, dağınık ve sessiz erkek), personel rollerine sprite cinsiyeti; adlar buna göre seçilir. Eski kayıtlarda uyumsuz adlar yüklemede düzelir (`platform/save.ts → fixNameGenders`). Aynı ad-soyad iki kez çıkmaz. Yeni oyun her seferinde farklı tohumla başlar. Testler: 112 (`tests/names.test.ts`).

## Mobil düzen ve yumuşak arayüz (2026-10-17)

Kullanıcı (telefon ekran görüntüleri): oyun menülerin arkasında görünmüyor; menüler hâlâ "program" gibi.

- **Telefon (≤ 760 px):** üstte ince bilgi çubuğu (tarih, para, itibar; hedefler 🎯 ile açılır), altta açılır-kapanır **karar sayfası** (hafta oynarken kapanır, yeni karar gelince açılır, başlığa dokununca aç/kapa), öğrenci şeridi sayfanın üstünde (boşken gizli), eğitim balonu üstte. Kurum paneli tam ekran sayfa. Ayrıntılı (⚙) mod telefonda gizli.
- **Keskin piksel, küçük ekran:** renderer cihaz piksel oranıyla çiziyor; yakınlaştırma katları cihaz pikselinde tam sayı (telefonda 1/dpr gibi CSS katları). Oda telefona keskin sığıyor. Kamera ölçüyü tuval yerine kaptan alıyor (yeniden boyutlanma sırası); iki parmakla kıstırma yakınlaştırma.
- **Yumuşak görünüm:** Nunito yazı tipi, yarı saydam buzlu cam paneller, 16–20 px köşeler, büyük harfli başlık yok, hap düğmeler (fiyat sağda), kart simgesi yuvarlak rozet, sıcak degrade ana düğme; haftalık özet ve eğitim balonu aynı dilde.
- Dokunmatikte kaydırırken yanlış seçim olmasın diye kart ve şerit düğmeleri `pointerdown` yerine `click`. Eğitim metinleri yön içermiyor ("sağdaki" yerine "Kararlar bölümündeki").

## M4 — Personel rolleri ve şubeler / Aşama 4 (2026-10-17)

Şema v11 (personel rolü, `branches`, `lastBranchHour`; eski ekip yardımcı koç olur).

| Rol | Ne yapar | Maaş (60 beceri) | Başvuru gelir |
| --- | --- | --- | --- |
| Yardımcı koç | öğrenci takibi (değişmedi) | 22.000 ₺ | her zaman |
| Sekreter | Buse'ye +6 sa/hafta, aday bekleme ×1,5, kayıt logit +0,25, her veliye +0,6/hafta | 6.800 ₺ | ≥12 öğrenci |
| Branş öğretmeni | en zayıf 12 öğrenciye haftalık etüt (en zayıf konuya ustalık), aile başı 350 ₺/hafta etüt ücreti | 16.600 ₺ | ≥14 öğrenci |
| Rehber öğretmen | en kaygılı 16 öğrenciye kaygı −5 / motivasyon +3, veli +0,8/hafta, tercih kabulü logit +0,8 | 12.800 ₺ | ≥20 öğrenci |

Uzman etkisi beceri / 60 ile ölçeklenir; uzmanlar yer (ofis + şube) başına sınırlı (sekreter 1, rehber 1, branş 2); öğrenci yalnız yardımcı koça atanır. Kod: `content/staff.ts` (`ROLES`, `SPECIALISTS`), `sim/staff.ts` (`specialistsWeekly`), `sim/state.ts` (`coachHours`).

**Şubeler (Aşama 4):** Liman (14), Kampüs (16), Yamaç (12) kapasite. Koşul: güven 60 (+10/şube), kapasitenin %75'i dolu, açıldıktan sonra her yerde iki koç (Buse dahil → ilk şube için 3 yardımcı koç), peşinat + 3 aylık (kira + bir koç maaşı) kasada, ÜYS'ye 10 haftadan az kalmamış, son şubeden 26 hafta geçmiş. Şube kapasite, kayıt katkısı ve haftalık bilinirlik ekler; kira ayın 1'inde. Oyun koşullar sağlanınca karar kartıyla önerir; Kurum → Gelişim'de engeller görünür. Kod: `content/growth.ts` (`BRANCHES`, `STAGES.branch`), `sim/growth.ts` (`branchBlocker`, `openBranch`).

**Denge süreci (bot, 12 tohum):** ilk sürümde uzmanlar küçük kurumda (≤16 öğrenci, ofis kapasitesi) %50 iflas getirdi → maaşlar düşürüldü, başvurular kurum büyüklüğüne bağlandı, sekretere saat, branşa ücretli etüt eklendi. Şube ilk sürümde sınavdan hemen önce açılıp yaz boşluğunda iflas ettiriyordu → ÜYS öncesi yasak, şubeler arası 26 hafta, para yedeği. Yeni `lean` stratejisi (uzman/şube yok) karşılaştırma için.

| Strateji (3. sezon) | Servet | İflas | Tutturma | Şube | Uzman |
| --- | --- | --- | --- | --- | --- |
| Makul (uzman + şube) | 827 bin | %0 | %60 | 1,9 | 2,8 |
| Makul, tek ofis (`lean`) | 460 bin | %0 | %62 | 0 | 0 |

16 tohumda: 816 bin / %57 / 1,9 şube. Ölçek büyüdükçe tutturma biraz düşüyor (Buse herkese yetişemiyor); tek tek uzmanlar küçük kurumda kârı azaltır ama kaliteyi artırır (branş öğretmeniyle tutturma %62 → %73). `tests/fullgame.test.ts` artık şube açıldığını ve büyümenin tek ofisten kârlı olduğunu da doğrular. Testler: 109.

**Açık:** odadaki personel hepsi yardımcı koç sprite'ıyla görünür (rol sprite'ı yok); şubelerin ayrı sahnesi yok; güven ~99'da doyduğu için kalite artışı (branş, rehber) doğrudan gelire dönmüyor.

**Sıradaki adaylar (eski):** 11. sınıf için ayrı müfredat ilerlemesi (okulda yeni konu öğrenme); rakiplerin oyuncunun fiyatına göre tepki vermesi; tercih danışmanlığının başarı ölçüsü (yerleşme sonucu) ve bunun ertesi sezona etkisi.

**Ayar notları:** Tek koçta 8'in çok üstü vaka yükü cezası sert (16 öğrencide haftada −12 veli memnuniyeti); ev kapasitesi 10 olduğu için Aşama 1–2'de sorun değil, ofiste "işe al" baskısı yaratıyor. Gerekirse fazla vaka sayısı 5'te sınırlanabilir. Ofis duvar/zemin sanatı Gemini'yle üretilince `procedural` yerine `background` sprite'ı kullanılacak; yardımcı koç karakter sprite'ı yok.

### İşletme denge botu (16 hafta, 16 tohum; tüm adaylarla görüşür, sinyallere müdahale, 3 haftada bir veli)

| Fiyat | Aktif öğrenci | Ayrılan | Servet (kişisel + kasa) | Kurum güveni |
| --- | --- | --- | --- | --- |
| 3.000 ₺ | 13,0 | 4,6 | 19.338 ₺ | 38 |
| 6.000 ₺ | 13,7 | 1,4 | 68.961 ₺ | 60 |
| 12.000 ₺ | 0,3 | 0 | −54.103 ₺ | 53 |

İlk ayarda (takip 1,5 sa, vaka cezası yok) makul fiyatla 16 haftada 29 öğrenci ve sıfır kayıp çıkıyordu; GDD zinciri ("fazla öğrenci → takip düşer → memnuniyet düşer → kayıp") eklenince ucuz-hızlı büyüme artık cezalı.

**Ayar hedefleri:** Aşama 1 büyümesi hâlâ hızlı olabilir (16 haftada ~14 öğrenci, tüm adaylar kabul edilince); gerçek oyunda ev ortamı/tek oda sınırı ve kayıt sezonu mevsimselliği bunu yavaşlatacak. (Hafta ortası kayıt hatası ve mevsimsellik ikinci dilimde çözüldü.)

**Sonraki (eski not):** M2 — işletme döngüsü: ekonomi (kişisel hesap/işletme kasası, giderler), aday hunisi ve kayıt görüşmesi, birden çok öğrenci, olay motoru. Sinyaller şu an hep doğru; ileride düşük güvende yanıltıcı sinyal.

### Bilinen notlar

- Vite HMR bir kez ara düzenlemeyi önbellekte tuttu (`addInsight is not defined`); sunucuyu yeniden başlatmak çözdü.
- Git kurulu değil; sürüm kontrolü yok.

## Seçimlerin görünürlüğü ve tempo (2026-10-17)
- Kullanıcı: tıklamalar hızlı kayboluyor, alt alta yanlış kartlara basılıyor; sohbet/veli bir şey hissettirmiyor; hafta çok hızlı.
- Karar kartı seçilince kaybolmaz: seçilen seçenek ve sonucu kartta kalır, hafta başlayınca temizlenir; kartların sırası sabit (alttaki kart yukarı kaymaz), 450 ms çift dokunuş koruması. Hata kartın içinde.
- Başlıkta "⏱ boş/toplam sa" (Buse'nin haftalık koçluk saati).
- Sohbet: haftada bir (`Student.lastInterviewWeek`, isteğe bağlı alan, şema değişmedi); karar kartına geçen haftanın baskın nedenini ima eden cümle (`clue.<neden>`), güven < 30 ise "pek açılmadı". Önceden oyun modunda sohbetin görünür etkisi yoktu (tanıma yalnız eski panelde).
- Veli görüşmesi: memnuniyet önce → sonra, 4 haftadan sık ise "yarım etki" uyarısı (düğmede de).
- Hafta hızı 1× = 60 ms/saat (~10 sn/hafta), ⏩ 2×/4×, ⏸ hafta ortası durdurma; gün şeridi; 22:00'de Buse üstünde günün görev sayısı.
- Çubuklar: öğrenci kartında haftalık görev (yapılan/program), öğrenci penceresinde görev/tanıma/veli memnuniyeti, HUD'da ve Kurum panelinde sertifika eğitimi (hafta).
- Kurum paneli oyun modunda daha büyük yazı, sertifikalar üstte, kapatma düğmesi. Mobilde "Ayrıntılar" düğmesi gerçekten gizli (CSS özgüllük hatası).

## Menü kullanımı, gecikmeli sonuç, sorun çeşitliliği (2026-10-17)
- Hafta sonu özeti `pointerdown`da kapanıyordu; parmak kalkınca dokunuş alttaki "Haftayı başlat"a düşüp haftayı başlatıyordu. Özet ve paneller (`playHud`, `businessPanel`, `historyPanel`, `tutorial`) artık `click`; ayrıca özet kapandıktan 800 ms sonrasına kadar hafta başlamaz.
- Yeni olay kapalı mobil sayfayı her zaman açar; alt düğme "⚡ Bir gelişme var — karta cevap ver" karta götürür.
- Geçmiş ve Kurum panelleri oyun modunda yumuşak stil, ✕ ile kapanır, birbirini kapatır; telefonda tam ekran (altındaki şerit/sayfa gizlenir).
- Müdahale ve veli kartının sonucu tıklayınca söylenmez ("hafta sonunda göreceksin"); hafta sonu ekranında görünür (veli satırı: memnuniyet önce → sonra).
- Öğrenci kartı: iki sinyal karışık sırada ve 3 farklı cümleyle (`signal.X.v1/v2`); seçenekler, gösterilen sinyalleri üretebilecek TÜM nedenlerin çareleri + çeldirici (en fazla 4). Sohbet ipucu tanımaya bağlı: doğru olma olasılığı %40 + tanıma·0,6; tutmazsa ikinci nedeni ya da belirsiz bir şey söyler, güven yüzdesi gösterilir.
- Sertifika kartı: eğitim yokken, parası ve saati yeten en ucuz 3 sertifika 4 haftada bir karar kartı olarak gelir.
- Hafta oynarken oda poz arka planı değişmez (slayt gösterisi gibi duruyordu); Buse yürür, koçluk günü gelen öğrenciler odada; pozlar yalnız hafta dururken.

## Sorun çeşitliliği ve ayarlar menüsü (2026-10-18)
- Kaçırma nedeni artık yalnız en büyük açığa yazılmıyor: `sampleMissCause` açık^`causeSharpness` (1,3) ile orantılı çeker. Baskın neden çoğunlukla kazanır, ikincil sorunlar da sinyal üretir.
- Yaşam olayları (`content/lifeEvents.ts`, `sim/lifeEvents.ts`): hafta kapanışında öğrenci başına %30 olasılıkla yeni oyun, okulda sınav haftası (`freeHours` −2 → "vakit yok"), hastalık, arkadaşla küslük, ailede gerginlik ya da iyi haber; birkaç günlük `life.<id>` değiştiricisi. Sohbet ipucu doğru çıkarsa öğrenci olayı anlatır.
- Ölçüm (12 tohum, 3. sezon): good hitRate 0,51 (önce ~0,57), lean 0,59. Değişiklik bilerek zorlaştırıyor: bot sinyal→çare eşlemesiyle oynuyor, çeşitlilik onu yanıltıyor. `FULLGAME_SEEDS=16` ile "pasif ilk yıl batar ≥ 0,5" 0,44'te kalıyor; olaylar ve çekiliş kapalıyken de aynı (bu değişiklikten bağımsız).
- `tests/lifeEvents.test.ts`: dağınık ve sessiz öğrencide 20 haftada en az 3 farklı sinyal üreten neden; süren olay varken ikincisi yok.
- Ayarlar (☰, `ui/play/settings.ts`): dil (kalıcı, `platform/prefs.ts`), görsel tarz, kaydet, rehberi yeniden göster, ayrıntılı paneller (masaüstü), yeni oyun (sayfa içi onay). Önceden yalnız klavye kısayolu vardı. Telefonda rehber balonu üst çubuğun altında (`--hud-h`).

## Denge düzeltmesi (2026-10-25)
Sorun: 1. sezon tutturma ~%20, güven 2.–3. sezonda 92–99'da doyuyor, kalite yatırımı görünmüyor, pasif oyuncu 16 tohumda %44 batıyor. Ölçüm: `FULLGAME_SEEDS=16`, 12 ve 20 ile doğrulandı.
- `balance.ts` parent: `expectationFloor` 40 → 55, `meetingStaleFactor` 0,5 → 0,25; yeni `satisfactionRest` 60 / `satisfactionDecay` 0,1 (veli memnuniyeti dinlenme düzeyinin üstünde haftalık %10 geri çekilir; `sim/parent.ts` tek satır. Plan dışı: yalnız taban/ÜYS ayarı lean botun güvenini 97–99'da bırakıyordu).
- `business.ts`: `trustConvergence` 0,25 → 0,15.
- `season.ts`: `trustPerSuccess` 3 → 2, `trustCap` 12 → 4, `targetBase` 24 → 22, `targetPerExpectation` 0,35 → 0,32.
- `staff.ts`: `teacher.students` 12 → 18, `teacher.mastery` 3 → 6, `counselor.anxiety` −5 → −8, `counselor.motivation` 3 → 5, `STAFF.idealCaseload` 8 → 10, `qualityDivisor` 8 → 10 (büyüyen kurum ölçek cezasını daha az yiyor).

| 16 tohum | önce | sonra |
|---|---|---|
| good hitRate s1 / s3 | 0,20 / 0,51 | 0,32 / 0,74 |
| lean hitRate s3 | 0,59 | 0,69 |
| good trust s2 / s3 | 93,7 / 92,5 | 94,4 / 89,6 |
| lean trust s2 / s3 | 95,6 / 98,8 | 91,2 / 92,0 |
| passive s1 bankrupt | 0,44 | 0,50 |
| good worth s3 | 721k | 1.045k |
| lean worth s3 | 521k | 588k |

Ayrıntı ve adım adım ölçüm: `.kuvat/kor-rapor.md`. Not: passive iflas oranı 0,50 sınırda (12 tohum 0,58, 20 tohum 0,50).