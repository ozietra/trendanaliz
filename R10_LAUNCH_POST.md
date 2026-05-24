# r10.net Lansman Konusu — Hazır Şablon

> Bu dosya r10.net forumlarında konu açarken doğrudan kopyalanabilir.
> 3 farklı başlık varyantı, 1 ana konu BBCode'u, açılış kampanyası kopyası
> ve ekran görüntüsü çekme rehberi içerir.

---

## 1. Forum Seçimi

**Önerilen alt forumlar:**
1. **r10.net → e-Ticaret → Trendyol** (en hedefli, satıcılar burada)
2. **r10.net → Yazılım & Web → SAAS / B2B Yazılımlar**
3. **r10.net → e-Ticaret → Genel**

İlk konu açılışında **(1)** öncelikli, sonra (2)'ye **bump** atılabilir.

---

## 2. Başlık Varyantları (A/B test edilebilir)

> r10 algoritması başlıkta sayı + parantez + emoji'yi sever.

**A) Sorun Odaklı (önerilen):**
```
[YENİ] Trendyol BuyBox Asistanı | Otomatik Repricer + Sipariş Yönetimi (Beta'da %50 İndirim)
```

**B) Fayda Odaklı:**
```
Trendyol Satıcılar Buraya: BuyBox Kaybınızı 15dk'da Bildirim, Otomatik Fiyat Güncelle ✅
```

**C) Topluluk Odaklı:**
```
Geliştirdiğim Trendyol SaaS Projemi Sizinle Paylaşıyorum — İlk 20 Kullanıcıya Ücretsiz
```

---

## 3. Ana Konu (BBCode)

```bbcode
[CENTER][SIZE=6][B][COLOR=#F27A1A]TrendAnaliz[/COLOR][/B] — Trendyol Satıcı Asistanı[/SIZE][/CENTER]
[CENTER][I]BuyBox takibinden otomatik fiyatlandırmaya, sipariş yönetiminden satış tahminine — tek panelde.[/I][/CENTER]

[CENTER][IMG]GORSEL_1_KAPAK.png[/IMG][/CENTER]

[HR][/HR]

[B]Selam r10 ailesi 👋[/B]

Bir Trendyol satıcısı olarak [B]BuyBox kaybını fark etmek için günde 50 kere ürünlerime bakmaktan[/B] bıktım. Manuel fiyat güncellemek, sipariş kargolamayı unutmak, rakipleri Excel'e not almak... Tanıdık geliyor mu? :)

Son birkaç aydır geliştirdiğim [B][COLOR=#F27A1A]TrendAnaliz[/COLOR][/B] tam da bu sorunu çözmek için var. Bugün BETA'ya açıyorum ve [B]ilk 20 r10 üyesine 30 gün ücretsiz Pro paketi[/B] hediye ediyorum (kart bilgisi istemeden).

[HR][/HR]

[SIZE=5][B]🎯 Neler Yapıyor?[/B][/SIZE]

[B]1) BuyBox Takibi (Trendyol resmi API'si ile)[/B]
[LIST]
[*]Tüm ürünlerinizin BuyBox durumu canlı izlenir
[*]Kutuyu kaybettiğinizde [B]anında bildirim[/B] (ek e-posta/SMS yok, anlık panelde)
[*]Hangi rakip kaptı, hangi fiyatla — hepsi görünür
[/LIST]

[B]2) Otomatik Fiyatlandırma (Repricer)[/B]
[LIST]
[*]Min/Max fiyat aralığında kalarak rakibin altına geç
[*]Kâr marjı korumalı: tanımladığınız tabanı asla geçmez
[*]Plan bazlı 15-120 dakika güncelleme sıklığı
[/LIST]

[B]3) Sipariş Yönetimi[/B]
[LIST]
[*]5 dakikada bir Trendyol'dan otomatik sipariş çekimi
[*]Tek tıkla durum güncelleme: Hazırlanıyor → Faturalandı → Kargoda
[*]Kargo takip numarası, fatura linki, kalem iptali — direkt panelden Trendyol'a yazar
[/LIST]

[B]4) Satış Tahmini[/B]
[LIST]
[*]Son 90 gün siparişlerinizden 7g/30g satış tahmini
[*]Stok tükenme uyarısı: "Bu ürün 4 gün içinde biter"
[*]Hareketli ortalama + haftanın günü düzeltmesi
[/LIST]

[B]5) Listing Kalite Skoru[/B]
[LIST]
[*]Başlık, açıklama, görsel, beden tablosu kontrolü
[*]Trendyol SEO için somut iyileştirme önerileri
[/LIST]

[CENTER][IMG]GORSEL_2_DASHBOARD.png[/IMG][/CENTER]

[HR][/HR]

[SIZE=5][B]💰 Fiyatlandırma[/B][/SIZE]

[TABLE]
[TR][TH]Paket[/TH][TH]Fiyat / ay[/TH][TH]Ürün[/TH][TH]Rakip[/TH][TH]Güncelleme[/TH][/TR]
[TR][TD][B]Starter[/B][/TD][TD]₺499[/TD][TD]50[/TD][TD]5[/TD][TD]120 dk[/TD][/TR]
[TR][TD][B][COLOR=#F27A1A]Pro[/COLOR][/B][/TD][TD]₺999[/TD][TD]250[/TD][TD]20[/TD][TD]60 dk[/TD][/TR]
[TR][TD][B]Business[/B][/TD][TD]₺1.999[/TD][TD]∞[/TD][TD]∞[/TD][TD]15 dk[/TD][/TR]
[/TABLE]

[B][COLOR=#22c55e]🎁 r10 Lansman Kampanyası:[/COLOR][/B]
İlk [B]20 kişiye 30 gün ücretsiz Pro paketi[/B]. Aşağıya yorum atın ya da DM'den ulaşın, hesabınıza ben tanımlıyorum (kart bilgisi istemiyoruz).

[HR][/HR]

[SIZE=5][B]🛡 Güvenlik[/B][/SIZE]

[LIST]
[*]Trendyol API anahtarınız [B]AES-256-GCM[/B] ile şifrelenir, plain-text olarak DB'de tutulmaz
[*]JWT access + refresh token ayrımı, brute-force koruması (Redis)
[*]Tüm trafik HTTPS
[*]Açık kaynak değil ama denetlenebilir log altyapısı (Pino + Sentry)
[/LIST]

[HR][/HR]

[SIZE=5][B]📸 Ekran Görüntüleri[/B][/SIZE]

[CENTER][IMG]GORSEL_3_BUYBOX.png[/IMG][/CENTER]
[CENTER][I]BuyBox durumu sayfası — kazanan/kaybeden filtreli liste[/I][/CENTER]

[CENTER][IMG]GORSEL_4_SIPARIS.png[/IMG][/CENTER]
[CENTER][I]Sipariş detayı — kargo takip, fatura linki, durum geçişleri[/I][/CENTER]

[CENTER][IMG]GORSEL_5_FORECAST.png[/IMG][/CENTER]
[CENTER][I]Satış tahmini — 7 ve 30 günlük projeksiyon[/I][/CENTER]

[HR][/HR]

[SIZE=5][B]❓ Sıkça Sorulanlar[/B][/SIZE]

[B]Q: Trendyol API anahtarımı vermem güvenli mi?[/B]
A: Anahtar AES-256-GCM ile şifrelenir, sadece API çağrıları sırasında bellekte çözülür. Çalışan ekibin DB'ye direkt erişimi olsa bile anahtarınızı okuyamaz.

[B]Q: Repricer fiyatımı sıfırlar mı?[/B]
A: Hayır. Her ürün için zorunlu min/max sınır tanımlarsınız. Algoritma o aralığın dışına ASLA çıkamaz.

[B]Q: Mağazam yoksa deneyebilir miyim?[/B]
A: Demo hesap için DM atın, ben tarafa hazır demo açıyorum.

[B]Q: SMS / e-posta bildirim var mı?[/B]
A: Şu an sadece uygulama içi anlık bildirim aktif (gerçek zamanlı SSE ile). E-posta/SMS bir sonraki sürümde geliyor.

[B]Q: İptal kolay mı?[/B]
A: Tek tık. Üyelik panelinde "Aboneliği iptal et" butonu, ek soru yok.

[HR][/HR]

[SIZE=5][B]🔗 Erişim[/B][/SIZE]

[CENTER][URL=https://trendanaliz.vercel.app][SIZE=5][B][COLOR=#F27A1A]→ trendanaliz.vercel.app[/COLOR][/B][/SIZE][/URL][/CENTER]

[CENTER]Soruyu yorum olarak atın, hepsini cevaplıyorum 🙌[/CENTER]
[CENTER][I]— [B]@kullanici_adin[/B][/I][/CENTER]
```

---

## 4. Açılış Mesajı için Görsel Listesi

Aşağıdaki görselleri kendi panelinden çekip yukarıdaki BBCode'da
`GORSEL_X_*.png` placeholder'larıyla değiştir:

| Dosya adı | Sayfa | Boyut önerisi |
|---|---|---|
| `GORSEL_1_KAPAK.png` | Landing page (`/`) hero bölümü | 1200x600 |
| `GORSEL_2_DASHBOARD.png` | `/dashboard` — özet istatistikler | 1200x700 |
| `GORSEL_3_BUYBOX.png` | `/dashboard/buybox` — kazanan/kaybeden filtreli | 1200x700 |
| `GORSEL_4_SIPARIS.png` | `/dashboard/siparisler/<id>` — eylem barıyla | 1200x700 |
| `GORSEL_5_FORECAST.png` | `/dashboard/tahmin` — 7/30g grafik | 1200x600 |

### Görsel çekme tüyoları

1. Tarayıcıyı **1440x900** boyutuna ayarla (Chrome DevTools → Device Toolbar)
2. **Demo veriyle doldur**: kendine demo hesabıyla giriş yap, 5-10 örnek ürün/sipariş ekle
3. **Hassas veri yok**: gerçek e-posta/sipariş numarası varsa Photoshop'ta sansürle
4. **PNG kaydet**, JPG'den daha keskin ve r10 yüklemesinde sorun çıkarmaz
5. r10'a **yüklerken** "Resim ekle" butonuyla yükle (harici link önerilmez — link kopabilir, görsel kaybolur)

---

## 5. Başarı Stratejisi

### İlk 24 saat
- Konu açar açmaz **5 farklı tanıdığa "yorum at, kaldıralım üst sıraya"** yaz
- İlk yorumlar olumlu/sorulu olsun. Kuru "tebrikler" işe yaramaz, **soru sor** ki konuya etkileşim gelsin.
- Sen de hemen **5 dakika içinde** gelen sorulara cevap ver. r10 algoritması yeni cevaplı konuları öne çıkarır.

### İlk hafta
- Her gün **1-2 kez bump et** ama spam'e düşme. Mantıklı: "yeni özellik geldi", "10 kişiye kampanya kalsın diye uzattık" gibi güncellemelerle.
- Yorumlarda **kullanıcı testimonial'ı** istemeyi unutma: "Pro hesap verdiğim kişiler, deneyiminizi yorum olarak yazar mısınız?" — bu sosyal kanıt çığ etkisi yaratır.

### Sonraki hafta
- Aynı konuyu **e-Ticaret/Genel** alt forumuna **link vererek** taşı (içeriği kopyalama, içerik tek yerde dursun, diğer foruma "ana konu burada → link" formatıyla referans ver).
- Kullanıcı kazandıkça **r10'da inceleme yazsınlar**, onların bağlantılarına yıldız ver.

### 1. ay sonunda
- Bir "1 ay raporu" konusu aç: "20 kullanıcı kazandık, en çok kullanılan özellik X, en çok istenen Y, geliyor"
- Bu kalıcı topluluk inşa eder.

---

## 6. Pazarlama Kopyası — Kısa Versiyonlar

### Twitter / X (280 karakter)

```
Trendyol satıcıları için BuyBox + Otomatik Fiyatlandırma + Sipariş yönetimini tek panelde topladım.

İlk 20 kullanıcıya 30 gün ücretsiz Pro paketi.

Kart bilgisi yok, e-posta yeter.

→ trendanaliz.vercel.app
```

### LinkedIn (kısa post)

```
2 aydır geliştirdiğim Trendyol Satıcı Asistanı'nı bugün BETA'ya açıyorum.

Çözdüğü problemler:
🟠 BuyBox kaybını saatler sonra fark etmek
🟠 Manuel fiyat güncellemenin getirdiği yorgunluk
🟠 Siparişleri kargoya vermeyi unutmak
🟠 "Bu hafta hangi ürün biter?" sorusunun cevapsızlığı

İlk 20 kullanıcıya 30 gün Pro paketi ücretsiz. r10.net'te ilk konuyu az önce açtım — yorumlarda buluşalım.

#trendyol #ecommerce #saas
```

### WhatsApp Status (görsel + 1 cümle)

```
[GORSEL_1_KAPAK.png]
Trendyol satıcılarına özel asistanım yayında: trendanaliz.vercel.app
İlk 20 kişiye 30 gün ücretsiz 🎁
```
