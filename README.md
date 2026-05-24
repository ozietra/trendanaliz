# TrendAnaliz — Trendyol Satıcı Yönetim Platformu

Tam yığın (full-stack) SaaS platformu:
- **Backend:** Node.js 20 + Express + Prisma + PostgreSQL + Redis + BullMQ
- **Frontend:** Next.js 14 + Tailwind CSS + Zustand + React Hook Form
- **Entegrasyonlar:** Trendyol Marketplace API, İyzico, PayTR
- **Gerçek zamanlı:** Server-Sent Events (SSE) bildirimleri

## Hızlı Başlangıç (Docker)

```bash
# 1) Env dosyalarını hazırlayın
cp .env.example .env
cp backend/.env.example backend/.env

# 2) backend/.env içinde EN AZ şunları doldurun:
#    - JWT_SECRET, JWT_REFRESH_SECRET (32+ karakter)
#    - ENCRYPTION_KEY (64 hex karakter = 32 byte)
#    - SUPERADMIN_EMAIL, SUPERADMIN_PASSWORD
#    - (opsiyonel) IYZICO_*, PAYTR_*, Trendyol API anahtarları

# 3) İlk başlatmada seed'i etkinleştirin
echo "SEED_ON_START=1" >> .env

# 4) Stack'i başlatın
docker compose up -d --build

# 5) Logları izleyin
docker compose logs -f backend
```

Açılacak adresler:
- **http://localhost/** → Frontend
- **http://localhost/api/health** → Backend health
- **http://localhost:3000/health** → Backend doğrudan

## Geliştirme (Docker'sız)

```bash
# Backend
cd backend
cp .env.example .env
npm install
npx prisma migrate dev
npx prisma db seed
npm run dev

# Frontend (ayrı terminal)
cd frontend
npm install
npm run dev
```

## Trendyol API Entegrasyonu

Platform Trendyol'un resmi Marketplace API'sini kullanır:
- **Prod URL:** `https://apigw.trendyol.com`
- **Stage URL:** `https://stageapigw.trendyol.com` (IP whitelist gerektirir)
- **Auth:** HTTP Basic + zorunlu User-Agent: `"{sellerId} - SelfIntegration"`
- **Rate limit:** 10sn'de 50 istek/endpoint
- **Batch limit:** Fiyat-stok güncellemede tek istekte 1000 SKU

### API Anahtarlarını Trendyol'dan Alma
Trendyol Partner Panel → **Hesap Bilgilerim → Entegrasyon Bilgileri** sekmesinden:
- Satıcı ID
- API Key
- API Secret Key

### Canlı Fiyat Push'u Etkinleştirme
Repricer fiyat hesapladığında **gerçek** Trendyol push'u için:
```env
TRENDYOL_LIVE_PUSH=1
```
`0` ise sadece DB güncellenir (güvenli varsayılan).

### Bağlantıyı Test Etme
```bash
# Login ile JWT al, sonra:
curl -X POST http://localhost/api/store/test-connection \
  -H "Authorization: Bearer <JWT>" \
  -H "Content-Type: application/json" \
  -d '{
    "supplierId":"1234567",
    "apiKey":"...",
    "apiSecret":"..."
  }'
```

## Ödeme Sağlayıcıları

| Sağlayıcı | Env Anahtarları | Mock? |
|---|---|---|
| İyzico | `IYZICO_API_KEY`, `IYZICO_SECRET_KEY` | Boşsa otomatik mock akış |
| PayTR | `PAYTR_MERCHANT_ID`, `PAYTR_MERCHANT_KEY`, `PAYTR_MERCHANT_SALT` | Boşsa otomatik mock akış |
| Manuel (IBAN) | — | Admin paneli üzerinden onay |

Geliştirmede tüm ödemeleri başarılı simüle etmek için:
```
POST /api/payment/mock-success/:paymentId
```

## SSE (Gerçek Zamanlı Bildirim)

Endpoint: `GET /api/notifications/stream?token=<JWT>`

Nginx zaten SSE-uyumlu yapılandırıldı:
- `proxy_buffering off`
- `proxy_read_timeout 24h`
- `X-Accel-Buffering: no`

Frontend `lib/useNotifications.ts` hook'u otomatik bağlanır ve kopukluk halinde yeniden bağlanır.

## Admin Paneli

`/admin` yolu sadece `SUPERADMIN` rolü için açıktır:
- Kullanıcı yönetimi (rol, aktif/pasif)
- Plan yönetimi (CRUD)
- Ödeme yönetimi (manuel onay/red)
- Site ayarları
- Audit log

İlk superadmin seed sırasında `SUPERADMIN_EMAIL` / `SUPERADMIN_PASSWORD` env'lerinden oluşturulur.

## Üretim Kontrol Listesi

- [ ] `JWT_SECRET`, `JWT_REFRESH_SECRET`, `ENCRYPTION_KEY` güçlü ve rastgele
- [ ] PostgreSQL şifresi değiştirildi
- [ ] HTTPS (Let's Encrypt / Cloudflare) yapılandırıldı
- [ ] Trendyol API anahtarları DB'de AES-256-GCM ile şifreli (otomatik)
- [ ] Iyzico / PayTR canlı (sandbox değil) anahtarları
- [ ] `TRENDYOL_LIVE_PUSH=1` (üretimde fiyat push aktif)
- [ ] `SEED_ON_START=0` (ilk seed'den sonra)
- [ ] DB backup stratejisi (örn. `pg_dump` cron)
- [ ] Redis persistence yapılandırması

## Lisans

Proprietary — TrendAnaliz © 2025
