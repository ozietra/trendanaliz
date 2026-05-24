# TrendAnaliz — Proje Denetim Raporu & Geliştirme Yol Haritası

> **Bu dosya bir prompt + iş listesi olarak hazırlanmıştır.** Bir AI asistana
> (Cascade, GitHub Copilot Chat, Claude, ChatGPT vb.) verdiğinizde projenin
> mevcut durumu, kritik açıkları ve sıralı yol haritası eksiksiz aktarılır.
> Asistan tek tek bu maddeleri uygulayarak ilerleyebilir.
>
> Tarih: 2026-05-24
> Versiyon: 1.0
> Kapsam: `c:\Users\oguzy\projects\mulk360\trendyol2` (Trendyol Repricer SaaS)

---

## 1. PROJE ÖZETİ (Bağlam)

TrendAnaliz, Trendyol satıcılarına yönelik bir SaaS platformudur. Çekirdek
işlevler:

- **Repricer**: Rakip fiyatlarına göre otomatik fiyat güncelleme (plan
  bazlı sıklıkta)
- **Mağaza ve Ürün Yönetimi**: Trendyol API key/secret ile entegrasyon,
  ürün/rakip/sipariş senkronizasyonu
- **Sipariş Modülü**: Yeni eklendi. 5 dk'da bir sipariş çekimi, liste +
  detay sayfaları, push bildirim
- **Channel-Aware Bildirim**: IN_APP (SSE) + EMAIL + SMS (Netgsm/Twilio)
  kanalları, kullanıcı tercihleri
- **Abonelik & Ödeme**: Iyzico ve PayTR entegrasyonu, manuel onay,
  yenileme cron'u
- **Admin Paneli**: Süperadmin ödeme onayı, plan yönetimi, kullanıcı
  yönetimi, log kayıtları

### Teknik Stack

- **Backend**: Node.js 20, Express 5, TypeScript, Prisma 5, PostgreSQL 16
- **Frontend**: Next.js 14 (App Router), React 18, TailwindCSS, Zustand,
  axios, Lucide
- **Altyapı**: Docker Compose (postgres + redis + backend + frontend +
  nginx). **Redis tanımlı ama henüz kullanılmıyor.**
- **Realtime**: Server-Sent Events (`/api/notifications/stream`)
- **Şifreleme**: AES-256-GCM (`utils/crypto.ts`) + bcrypt + JWT
  access/refresh

### Klasör Yapısı

```
trendyol2/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.ts
│   │   └── migrations/
│   └── src/
│       ├── app.ts
│       ├── config/database.ts
│       ├── controllers/   (15 dosya)
│       ├── middleware/auth.middleware.ts
│       ├── routes/        (15 dosya)
│       ├── services/      (9 dosya: trendyol, repricer, scheduler,
│       │                  notification, order, iyzico, paytr,
│       │                  realtime, subscription-cron)
│       └── utils/         (logger, mailer, crypto, sms)
├── frontend/
│   ├── app/
│   │   ├── (auth)/        (giriş/kayıt/şifre sıfırla)
│   │   ├── admin/         (süperadmin paneli)
│   │   ├── dashboard/     (urunlerim, siparisler, rakip-fiyat,
│   │   │                  fiyat-kurallari, anahtar-kelime, bildirimler,
│   │   │                  abonelik, vb.)
│   │   ├── odeme/         (başarılı/başarısız callback)
│   │   ├── verify-email/
│   │   └── yasal/         (sözleşme, gizlilik vb.)
│   ├── components/        (DashboardSidebar, NotificationPreferences vb.)
│   ├── lib/               (api.ts axios instance, useNotifications.ts SSE)
│   └── store/auth.store.ts (Zustand)
├── nginx/nginx.conf
├── docker-compose.yml
├── .env.example
└── README.md
```

---

## 2. MEVCUT DURUM — GÜÇLÜ YÖNLER

Bu yönler korunmalı, refactor edilmemeli:

1. **Mimari katmanlar net**: routes → controllers → services → Prisma.
   İş mantığı service'lerde, controller'lar yalın.
2. **Trendyol entegrasyonu olgun**: `requestWithRetry` 5xx + 429 + ağ
   hataları için exponential backoff + jitter, Retry-After header
   desteği, abort timeout, structured logging.
3. **Channel-aware bildirim alt yapısı**: `notification.service.ts`
   `event` parametresine göre kullanıcı tercihinden veya
   `DEFAULT_PREFS`'ten kanal çözer; IN_APP/EMAIL/SMS bağımsız adapter'lar
   üzerinden gönderim. `DEFAULT_PREFS` ile birlikte yeni event eklemek
   tek satır.
4. **SMS adapter**: Netgsm + Twilio + mock fallback (yapılandırma yoksa
   loga yazıp başarılı kabul eder).
5. **Scheduler**: Plan slug'una göre repricer aralığı (Business 15 sn,
   Pro 60 sn, Starter 120 sn) + 5 dk'lık sipariş senkron döngüsü +
   6 saatlik abonelik cron'u.
6. **Prisma şeması temiz**: İlişkiler, indexler, enum'lar tutarlı.
   Order/OrderItem yeni eklendi.
7. **UI tutarlı**: Koyu tema (#070c16, #0b1424), brand-orange vurgular,
   Tailwind utility'ler tek tip, sidebar navigation tek componentten
   geliyor.
8. **JWT akışı**: Access (15dk) + Refresh (30g), axios interceptor ile
   otomatik refresh, 401 sonrası queue + retry.

---

## 3. KRİTİK SORUNLAR (üretime çıkmadan kapatılmalı)

### 3.1 Hardcoded güvenlik secret fallback'leri

**Dosyalar:**
- `backend/src/middleware/auth.middleware.ts:14`
- `backend/src/controllers/auth.controller.ts:12-13`
- `backend/src/utils/crypto.ts:7-12`

**Sorun:** `process.env.JWT_SECRET || 'trendanaliz_jwt_secret_key_2026_very_secure'`
gibi sabit fallback string'leri var. Üretimde `JWT_SECRET` set edilmezse
herkesin bildiği bir secret ile token üretilir → tüm kullanıcı oturumları
taklit edilebilir. AES anahtarı için aynı durum → şifrelenmiş Trendyol
API key'leri okunabilir.

**Çözüm:** Fail-fast — yokken uygulama açılmasın.
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) {
  throw new Error('JWT_SECRET ortam değişkeni zorunludur.');
}
```
Aynısı `JWT_REFRESH_SECRET` ve `ENCRYPTION_KEY` için. `app.ts` en üstte
bir `validateEnv()` fonksiyonu çağrılmalı.

### 3.2 Bellek içi state ölçeklenemez

**Dosyalar:**
- `backend/src/controllers/auth.controller.ts:24` (`loginAttempts: Map`)
- `backend/src/controllers/auth.controller.ts:30` (`revokedRefreshTokens: Set`)
- `backend/src/services/scheduler.service.ts:11-13` (timer maps)
- `backend/src/services/repricer.service.ts` (storeLogs Map)

**Sorun:** Çok process / cluster / restart sonrası kilitlenmiş hesaplar
otomatik açılır, çıkış yapan kullanıcının refresh token'ı tekrar geçerli
olur. `docker-compose.yml`'de Redis tanımlı ama hiç kullanılmıyor.

**Çözüm:**
- `ioredis` veya `redis` paketini ekle.
- `loginAttempts` → Redis key `auth:fail:{email}` TTL 15 dk
- `revokedRefreshTokens` → Redis Set `auth:revoked` (token'ın kendisi
  yerine token JTI saklamak daha iyi)
- Timer'lar zaten process bazlı kalmalı ama her instance kendi store
  listesini başlatır → distributed lock ile çift çalışmayı engellemek
  isterseniz `bullmq` (Redis tabanlı) kuyruğa geçilmeli.

### 3.3 Frontend "Demo Mode" giriş yapmamış kullanıcıya UI gösteriyor

**Dosya:** `frontend/app/dashboard/layout.tsx:29-52`

**Sorun:** Oturum yokken `demoMode=true` set edilip "Demo Satıcı"
gösteriliyor. `useEffect` ile sonra login'e yönlendiriliyor ama içerik
kısa süre flash eder. Bazı sayfalar `useNotifications` gibi hook'lardan
veri çekmeye çalışıp 401 alır.

**Çözüm:**
```tsx
useEffect(() => {
  if (isHydrated && !isAuthenticated) {
    router.replace('/giris');
  }
}, [isHydrated, isAuthenticated]);

if (!isHydrated || !isAuthenticated) {
  return <FullPageSpinner />;
}
```
`demoMode` ile ilgili tüm bloklar kaldırılmalı (hem layout hem de
referansta olan diğer sayfalar).

### 3.4 Subscription guard yok — plan kontrolü yapılmıyor

**Dosyalar:** `backend/src/routes/*.routes.ts` — yalnızca
`authenticateToken` var.

**Sorun:** Aktif aboneliği olmayan kullanıcı tüm endpoint'leri
çağırabilir. Plan slug'ına göre özellik kapısı yok (örn. Starter
kullanıcı satış tahminine erişebilir).

**Çözüm:** Yeni middleware:
```ts
// backend/src/middleware/subscription.middleware.ts
export const requireActiveSubscription = async (req, res, next) => {
  const sub = await prisma.subscription.findFirst({
    where: { userId: req.user.id, status: 'ACTIVE', endDate: { gt: new Date() } },
    include: { plan: true },
  });
  if (!sub) {
    return res.status(402).json({
      success: false,
      code: 'NO_ACTIVE_SUBSCRIPTION',
      message: 'Bu özelliği kullanmak için aktif bir aboneliğiniz olmalı.',
    });
  }
  req.subscription = sub;
  next();
};

export const requireFeature = (...features: string[]) => (req, res, next) => {
  const planFeatures = req.subscription.plan.features as string[];
  if (!features.every(f => planFeatures.includes(f))) {
    return res.status(403).json({
      success: false,
      code: 'PLAN_FEATURE_MISSING',
      message: 'Aboneliğinizi yükselterek bu özelliği açabilirsiniz.',
    });
  }
  next();
};
```
Tüm `/api/products`, `/api/orders`, `/api/forecast`, `/api/keywords`,
`/api/listings`, `/api/campaigns`, `/api/rules`, `/api/competitors` ve
mağaza route'ları bu middleware ile sarılmalı. `/api/subscriptions` ve
`/api/payments` ile `/api/notifications` muaf.

### 3.5 `prisma/seed.ts` hâlâ trial ayarını ekliyor

**Dosya:** `backend/prisma/seed.ts`

**Sorun:** Trial kaldırıldı ama seed `trial_duration_days` ayarını hâlâ
yazıyor. Yeni kurulumda tutarsız.

**Çözüm:** `trial_duration_days` blok satırlarını sil. SiteSetting'lerde
de istenirse Prisma migration ile temizlik yapılabilir.

---

## 4. ORTA ÖNCELİKLİ KONULAR

### 4.1 Sahte rakip verisi prod'a sızabiliyor

**Dosyalar:**
- `backend/src/services/repricer.service.ts:88-100` (Math.random ile fiyat
  dalgası)
- `backend/src/controllers/store.controller.ts:172-180` (rastgele competitor
  oluşturma)
- `backend/src/controllers/competitor.controller.ts:120-132` (manuel ekleme
  fake price)

**Risk:** Prod'da gerçek müşteri için yanlış rakip fiyatına göre repricing
→ kâr kaybı.

**Çözüm:**
```ts
const SIMULATE = process.env.SIMULATE_COMPETITORS === '1';
if (SIMULATE && Math.random() < 0.3) { ... }
```
`.env.example`'a `SIMULATE_COMPETITORS=0` eklenmeli. Asıl çözüm:
**Trendyol'ün gerçek rakip API'sini entegre et** (aşağıda 5.2).

### 4.2 BigInt JSON serileştirme kırılgan

**Sorun:** `Order.shipmentPackageId`, `OrderItem.lineId` BigInt. Şu an
controller'da elle `.toString()` ile çevriliyor. Yeni endpoint yazan
biri unutursa "Do not know how to serialize a BigInt" hatası.

**Çözüm:** `backend/src/app.ts` en üstte global serializer:
```ts
declare global {
  interface BigInt { toJSON(): string }
}
(BigInt.prototype as any).toJSON = function () { return this.toString(); };
```

### 4.3 CORS tek origin

**Dosya:** `backend/src/app.ts:39-46`

**Sorun:** `FRONTEND_URL` tek değer. Staging + prod + custom domain için
yetersiz.

**Çözüm:**
```ts
const allowed = (process.env.CORS_ORIGINS || 'http://localhost:3001').split(',');
cors({ origin: (origin, cb) => {
  if (!origin || allowed.includes(origin)) cb(null, true);
  else cb(new Error('CORS reddedildi'));
}, credentials: true, ... })
```

### 4.4 Test yok

`package.json`'da test scripti yok. SaaS bu ölçekte test'siz olmaz.

**Çözüm:** Vitest + supertest. Minimum kapsam:
- `notification.service` — `resolveChannels` davranışı (override > user
  prefs > defaults > IN_APP fallback)
- `repricer` — `calculatePrice` (rule type'lara göre, floor/ceiling
  clamping)
- JWT verify happy + expired
- Order upsert idempotency (aynı orderNumber 2 kez sync edilirse update
  olmalı, duplicate olmamalı)
- `requireActiveSubscription` middleware — aktif/expired/yok

### 4.5 Trendyol gerçek rakip fiyat API'si entegre değil

`Competitor` tablosu var ama veriler simüle. Trendyol resmi
`/integration/competitive-prices` endpoint'i (veya benzeri) entegre
edilmeli; rakip listesi gerçek olunca repricer mantığı meşrulaşır.

### 4.6 Sales forecast / keyword / listing audit / campaign ROI

Bu sayfalar mevcut ama çoğu sahte data ile çalışıyor. Sipariş verisi
geldiğine göre **sales forecast** gerçek hâle getirilebilir:
- 7/30/90 günlük kayan ortalama
- Mevsimsellik düzeltmesi (dow + dom)
- "Önümüzdeki 30 gün için tahmini sipariş = X ± Y"

Keyword tracking için Trendyol public arama yok; ya kaldırılmalı ya da
scraping çözümü (etik ve yasal sorunlar nedeniyle önerilmez).

Listing audit heuristic: başlık uzunluğu, görsel sayısı, açıklama
zenginliği, fiyat-rakip karşılaştırması → 0-100 skor.

### 4.7 Sipariş yazma operasyonları yok

Şu an sadece okuma var. İhtiyaç:
- `POST /api/orders/:id/cargo` — kargo takip numarası set et
- `POST /api/orders/:id/invoice` — fatura linki gönder
- `POST /api/orders/:id/cancel` — sipariş iptal

Trendyol API'lerinde `update-package`, `tracking-number`,
`split-package`, `change-cargo-provider` endpoint'leri var.

### 4.8 Webhook yerine sadece polling

Trendyol order webhook'ları desteklenmeli (push tabanlı). Polling
fallback olarak kalsın. Webhook ile gecikme < 1 sn'ye düşer.

### 4.9 `as any` Express tip uyumsuzlukları

Route'larda `authenticateToken as any, getNotifications as any` gibi
çok sayıda `as any` var. Express 5 tipleri ile düzgün handler tipleri
tanımlanırsa kaldırılabilir:
```ts
type Handler = (req: AuthenticatedRequest, res: Response, next: NextFunction) => Promise<void> | void;
```

### 4.10 Frontend toast tutarsızlığı

Bazı sayfalarda inline `setError`/`setSuccess`, bazılarında yok. Tek
toast kütüphanesi (`sonner` önerilir) tüm projede standart hâle
getirilmeli.

### 4.11 Tarih formatı

`Date.prototype.toLocaleString('tr-TR')` her yerde manuel. `dayjs` ile
saat dilimi tutarlılığı + relative time ("2 saat önce") destekli format
yardımcısı eklensin: `lib/date.ts`.

---

## 5. KÜÇÜK İYİLEŞTİRMELER

### 5.1 Logger redaction

`Authorization` header, body içinde `apiKey`, `apiSecret`, `password`,
`token` alanları log'lanmamalı. Pino kullanırsak `redact: ['*.password', '*.apiKey']`
otomatik.

### 5.2 Health endpoint zenginleştirme

`/health` şu an sadece `200 OK`. Eklenecek:
- `/health/db` — `SELECT 1`
- `/health/redis` — `PING`
- `/health/full` — tümünün özeti

### 5.3 Structured logging + request ID

Pino + `cls-hooked` ile her request'e `traceId` üret, log satırlarına
ekle. Sentry/Glitchtip ile entegrasyon kolaylaşır.

### 5.4 Admin paneli observability

Admin'e: aktif scheduler sayısı, son cron çalışmaları, son 24 saat
hata sayısı, gönderilen SMS/EMAIL adedi, kuyruk boyutu (BullMQ'ya
geçince).

### 5.5 Plan limitleri

- Maksimum mağaza: Starter 1, Pro 3, Business 10
- Maksimum ürün izlenecek: Starter 100, Pro 1000, Business sınırsız
- Günlük SMS kotası: Starter 0, Pro 50, Business 500

---

## 6. HIZLI KAZANIMLAR (1-2 saat içinde)

| # | Dosya | İşlem |
|---|---|---|
| 1 | `backend/src/middleware/auth.middleware.ts:14` | JWT_SECRET fallback'ı kaldır |
| 2 | `backend/src/controllers/auth.controller.ts:12-13` | JWT secret fallback'larını kaldır |
| 3 | `backend/src/utils/crypto.ts:7-12` | ENCRYPTION_KEY fallback'ı kaldır |
| 4 | `backend/prisma/seed.ts` | `trial_duration_days` ayarını sil |
| 5 | `frontend/app/dashboard/layout.tsx:29-110` | `demoMode` bloğunu komple sil, redirect ile değiştir |
| 6 | `backend/src/app.ts` | `BigInt.prototype.toJSON` global tanımı |
| 7 | `backend/src/services/repricer.service.ts:88` | `if (process.env.SIMULATE_COMPETITORS === '1')` koşulu |
| 8 | `backend/src/app.ts:39` | CORS array desteği |
| 9 | `backend/src/controllers/store.controller.ts:172` | Rastgele competitor üretimini flag arkasına al |
| 10 | `frontend/app/odeme/basarili/page.tsx` | `mock=1` query string'i prod build'da gizle |

---

## 7. SPRINT BAZLI YOL HARİTASI

### Sprint 1 — Güvenlik & Ölçeklenebilirlik (2-3 gün)

**Amaç:** Üretime çıkabilir hâle getirmek.

1. ✅ Tüm secret fallback'leri kaldır → `validateEnv()` fonksiyonu ile
   fail-fast başlatma. `JWT_SECRET`, `JWT_REFRESH_SECRET`,
   `ENCRYPTION_KEY`, `DATABASE_URL` zorunlu.
2. ✅ Redis client (`ioredis`) kur, `lib/redis.ts` singleton.
3. ✅ Brute-force ve refresh token revoke list'i Redis'e taşı.
4. ✅ `requireActiveSubscription` + `requireFeature` middleware'leri ekle.
   Tüm korumalı route'lara uygula. 402 response code.
5. ✅ Frontend `demoMode` kaldır. Layout başında auth-required guard +
   spinner.
6. ✅ Global `BigInt.prototype.toJSON` tanımla.
7. ✅ CORS array desteği (`CORS_ORIGINS` env, virgül ayrımlı).
8. ✅ `prisma/seed.ts`'den `trial_duration_days` sil. Migration
   gerekirse `SiteSetting` tablosundan da DELETE.
9. ✅ `.env.example` güncelle: yeni env'ler dokümante.
10. ✅ Hızlı duman testi: `npm run dev` her iki tarafta, login → mağaza
    ekle → siparişler sekmesi.

### Sprint 2 — İş Değeri (4-5 gün)

**Amaç:** Müşterinin ödediği değeri gerçekleştirmek.

1. **Trendyol gerçek rakip fiyat entegrasyonu** —
   `services/trendyol.service.ts`'e `fetchCompetitivePrices(barcode)`
   ekle. Scheduler'da ürün başına günde 1-2 kez çek (plan'a göre).
   Sahte competitor üretimini sil veya `SIMULATE_COMPETITORS=1`
   gerektir.
2. **Repricer mantığını gerçek veriyle çalıştır** — Mock fiyat
   dalgalanmasını kaldır.
3. **Sipariş yazma işlemleri** — kargo numarası set, paket güncelle,
   iptal endpoint'leri.
4. **Sales forecast gerçek veri** — `services/forecast.service.ts`'i
   `Order` tablosundan gelen son 90 günlük veriyle hesapla. 7/30/90
   günlük moving average + DOW seasonality.
5. **Sipariş bildirimine eylem butonları** — Bildirim dropdown'unda
   "Detay" linki direkt sipariş detayına. (Şu an sadece title/message.)
6. **Trendyol order webhook receiver** —
   `POST /api/webhook/trendyol/order` endpoint, signature doğrulama,
   gelen package'ı upsert. Polling fallback kalır.

### Sprint 3 — Operasyonel Olgunluk (4-5 gün)

**Amaç:** Production-grade observability ve testlenebilirlik.

1. **Vitest** + **supertest** kur. 30+ test:
   - Auth flow (register → verify → login → refresh → logout)
   - Notification channel resolution
   - Repricer price calculation
   - Order sync idempotency
   - Subscription middleware
2. **Pino structured logging** + request ID. `console.log`
   bırakılmamalı.
3. **Sentry / GlitchTip** entegrasyonu — backend hatalar + frontend
   ErrorBoundary.
4. **Health endpoint'leri zenginleştir** (`/health/db`, `/health/redis`,
   `/health/full`).
5. **GitHub Actions CI** — lint + tsc --noEmit + test + docker build.
6. **Migration sürüm güvenliği** — `prisma migrate deploy` zaten
   `docker-entrypoint.sh`'da; CI'da shadow DB üzerinden migration
   smoke testi.

### Sprint 4 — Büyüme (5-7 gün)

**Amaç:** Çok mağaza, plan limitleri, admin observability.

1. **Multi-store per user** — `User` ↔ `TrendyolStore` zaten 1-N. UI'da
   mağaza switcher dropdown'u (header'da). Mağaza scope'u tüm
   sayfalarda.
2. **Plan limitleri** — Plan tablosuna `maxStores`, `maxProducts`,
   `dailySmsQuota` alanları. `requireFeature` + sayım kontrolü.
3. **BullMQ** ile sipariş senkron / repricer kuyruğa alınsın
   (multi-instance ölçeklenebilirlik).
4. **Admin observability paneli** — son 24 saat hata, kuyruk derinliği,
   gönderilen SMS/EMAIL/IN_APP sayısı, aktif user/sub.
5. **Webhook senderları** — kullanıcı kendi sistemine event yollasın
   (yeni sipariş, fiyat değişti). HMAC signature.
6. **Mobil responsive cilası** — Tablo wrap'ları, sidebar mobile drawer.

### Sprint 5 — Polish (3 gün)

1. `as any` temizliği — Express handler tipleri düzgün.
2. Tarih kütüphanesi (`dayjs`) + tek format helper.
3. Toast standardizasyonu (`sonner`).
4. i18n altyapısı (TR varsayılan, EN opsiyonel).
5. Onboarding wizard (yeni user → plan seç → mağaza ekle → ilk ürünü
   gör).
6. Dashboard ana sayfa istatistik kartları gerçek sipariş verisi ile.

---

## 8. AI ASİSTANINA TALİMAT (PROMPT BÖLÜMÜ)

Aşağıdaki bölümü doğrudan asistana ileten kullanıcı **bu dosyanın
tamamını referans olarak** verecektir:

> Sen bir senior full-stack engineer'sın. TrendAnaliz projesinde
> çalışıyorsun. Yukarıdaki rapor projenin mevcut durumunu ve yol
> haritasını gösteriyor.
>
> **Kurallar:**
> 1. Her sprint'i tek tek, sırayla uygula. Sprint 1 bitmeden Sprint 2'ye
>    geçme.
> 2. Her madde için: önce ilgili dosyaları oku, sonra düzenle, sonra
>    `tsc --noEmit` ile doğrula. Hata varsa düzelt, geçmeden bir
>    sonrakine başlama.
> 3. Mevcut kod stilini koru — Türkçe yorumlar, brand-orange tema,
>    Tailwind utility'ler, channel-aware bildirim pattern'i, Prisma
>    naming convention.
> 4. Yeni yorum ekleme zorunluluğun yok ama silme. Mevcut JSDoc'ları
>    koru.
> 5. Her sprint sonunda kullanıcıya özet rapor ver: ne değişti, hangi
>    migration gerekti, hangi env eklenmeli, manuel test adımları.
> 6. Migration üreten her değişiklik için kullanıcıya
>    `npx prisma migrate dev --name <isim>` komutunu hatırlat.
> 7. Bellek içi state'leri Redis'e taşırken backward-compatible kal —
>    Redis kapalıysa fallback'le bellek içi devam etsin (development
>    için).
> 8. Hassas veri loglamadığından emin ol. Test ekleyince mock kullan,
>    gerçek API çağırma.
>
> **İlk eylemin:** Sprint 1 maddelerini sırayla uygula. Her madde için
> önce dosyayı oku, ardından düzenle, ardından doğrula. Bittiğinde
> kullanıcıya özet ver ve Sprint 2'ye geçmek için onay iste.

---

## 9. ENV DEĞİŞKENLERİ (TAM LİSTE)

Hedef `.env.example` (Sprint 1 sonrası):

```env
# === Postgres ===
POSTGRES_USER=trendanaliz
POSTGRES_PASSWORD=trendanaliz_secret
POSTGRES_DB=trendanaliz_db
DATABASE_URL=postgresql://trendanaliz:trendanaliz_secret@postgres:5432/trendanaliz_db?schema=public

# === Redis (Sprint 1) ===
REDIS_URL=redis://redis:6379

# === Auth ===
JWT_SECRET=<min 64 karakter rastgele>
JWT_REFRESH_SECRET=<min 64 karakter rastgele>
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=30d

# === Şifreleme ===
ENCRYPTION_KEY=<min 64 karakter rastgele>

# === Frontend ===
FRONTEND_URL=http://localhost:3001
CORS_ORIGINS=http://localhost:3001,https://trendanaliz.com

# === SMTP ===
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM="TrendAnaliz <noreply@trendanaliz.com>"

# === SMS ===
SMS_PROVIDER=netgsm
NETGSM_USERCODE=
NETGSM_PASSWORD=
NETGSM_HEADER=
TWILIO_ACCOUNT_SID=
TWILIO_AUTH_TOKEN=
TWILIO_FROM=

# === Iyzico ===
IYZICO_API_KEY=
IYZICO_SECRET_KEY=
IYZICO_BASE_URL=https://sandbox-api.iyzipay.com

# === PayTR ===
PAYTR_MERCHANT_ID=
PAYTR_MERCHANT_KEY=
PAYTR_MERCHANT_SALT=

# === Trendyol Live ===
TRENDYOL_LIVE_PUSH=0  # 1 yapılırsa gerçek API'ye fiyat push edilir

# === Geliştirme/Simülasyon ===
SIMULATE_COMPETITORS=0   # 1 yapılırsa rastgele competitor üretilir
SEED_ON_START=0

# === Cron Aralıkları (opsiyonel) ===
ORDER_SYNC_INTERVAL_MS=300000          # 5 dk
SUBSCRIPTION_CRON_INTERVAL_MS=21600000 # 6 saat

# === Sentry (Sprint 3) ===
SENTRY_DSN=

# === Frontend ===
NEXT_PUBLIC_API_URL=/api
```

---

## 10. SON KONTROL LİSTESİ (Production Readiness)

- [ ] Tüm secret'lar 64+ karakter rastgele, `.env`'de
- [ ] Redis çalışıyor ve uygulama bağlanıyor
- [ ] `prisma migrate deploy` clean
- [ ] `tsc --noEmit` her iki tarafta 0 hata
- [ ] `npm test` 0 fail (Sprint 3 sonrası)
- [ ] Health endpoint'ler 200
- [ ] Süperadmin oluşturuldu, şifre değiştirildi
- [ ] Iyzico/PayTR live key'ler set, sandbox bayrağı off
- [ ] SMTP/SMS sağlayıcı çalışıyor (test maili/SMS başarılı)
- [ ] HTTPS reverse proxy (nginx + Let's Encrypt)
- [ ] Backup: postgres günlük `pg_dump`, S3'e push
- [ ] Sentry alıyor, ilk gönüllü hatayı yakaladı
- [ ] Rate limit nginx + express seviyesinde aktif
- [ ] Log dosyaları rotate (logrotate veya pino-pretty)

---

## 11. NOTLAR

- **Mevcut migration**: `20260524104226_orders_and_notification_prefs`.
  Trial konsepti şemadan değil, controller mantığından kaldırıldı.
  Subscription default `ACTIVE` (bilinen Postgres enum kısıtı nedeniyle
  PENDING default'a çevrilemedi; pratik fark yok).
- **`SUBSCRIPTION_CRON_INTERVAL_MS`** ENV ile özelleştirilebilir.
- **SMS mock**: Yapılandırma yoksa loga yazıp "başarılı" der; geliştirme
  için ideal.
- **Demo mode kaldırılınca** `frontend/app/odeme/basarili/page.tsx`'deki
  `mock=1` URL parametresi kontrolü da gözden geçirilmeli (üretimde
  gizli olmalı).

---

**Hazırlayan:** Cascade AI denetim oturumu
**Konum:** `c:\Users\oguzy\projects\mulk360\trendyol2\PROJECT_AUDIT_AND_ROADMAP.md`
