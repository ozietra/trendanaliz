# TrendAnaliz — Live Deploy Rehberi (Ücretsiz Stack)

> Domain almadan, kart bilgisi vermeden launch için ücretsiz tier kombinasyonu.
> Tek seferlik kurulum ~45 dakika. Sonraki deploy'lar `git push` ile otomatik.

## Mimari

```
   ┌─────────────────────────┐
   │  trendanaliz.vercel.app │ ← Frontend (Next.js, Vercel free)
   └────────────┬────────────┘
                │ HTTPS (NEXT_PUBLIC_API_URL)
   ┌────────────▼────────────┐
   │ trendanaliz-api.       │ ← Backend (Express, Render free)
   │ onrender.com           │
   └────┬─────────────┬──────┘
        │             │
    ┌───▼────┐    ┌───▼─────────┐
    │ Neon   │    │ Upstash     │
    │ Postgres│   │ Redis       │
    │ (free) │    │ (free)      │
    └────────┘    └─────────────┘
```

| Servis | Sağlayıcı | Free tier | Bu projeye yetiyor mu? |
|---|---|---|---|
| Frontend | **Vercel** | 100 GB bandwidth/ay | Evet |
| Backend  | **Render** | 750 saat/ay, 512 MB RAM (uyku modlu) | Evet, kalıcı ücretsiz |
| Postgres | **Neon**  | 500 MB + 191 saat compute/ay | Evet (ilk 1000 kullanıcıya) |
| Redis    | **Upstash** | 10.000 komut/gün | Evet, opsiyonel — yoksa memory fallback |
| Sentry   | **Sentry** | 5K event/ay | Evet, opsiyonel |

---

## 0. Ön Hazırlık (lokal makinen)

```powershell
# Tüm değişiklikleri commit et
cd c:\Users\oguzy\projects\mulk360\trendyol2
git add .
git commit -m "feat: production-ready"

# GitHub'a push (yoksa önce gh.com'da repo oluştur)
git remote add origin https://github.com/<kullanici>/trendanaliz.git
git branch -M main
git push -u origin main
```

> **Önemli**: `.env` dosyaları `.gitignore`'da. Sırlar repo'ya gitmez.

---

## 1. Neon Postgres (5 dk)

1. <https://neon.tech> → GitHub ile giriş yap (free)
2. **New Project** → name: `trendanaliz`, region: `Frankfurt` (TR'ye en yakın free region)
3. **Connection string**'i kopyala. Şöyle görünür:
   ```
   postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require
   ```
4. Bu string'i bir yere not et. Hem migration için hem Render env için lazım.

### Şemayı oluştur (lokalden)

```powershell
cd c:\Users\oguzy\projects\mulk360\trendyol2\backend

# Geçici olarak production DB'ye bağlanıp migration uygula
$env:DATABASE_URL="postgresql://user:pass@ep-xxx.eu-central-1.aws.neon.tech/neondb?sslmode=require"
npx prisma migrate deploy
npx prisma db seed   # opsiyonel: planları + superadmin tohumla
```

> **Not**: `seed` script seed dosyana bağlı. Yoksa atla; ilk admin'i manuel oluştururuz (aşağıda 7. adım).

---

## 2. Upstash Redis (3 dk, opsiyonel)

1. <https://upstash.com> → GitHub ile giriş
2. **Create Database** → name: `trendanaliz-redis`, region: Frankfurt, eviction: ON
3. **Details → REST/TLS connection string**'i kopyala:
   ```
   rediss://default:pass@xxx.upstash.io:6379
   ```

> Bunu **atlayabilirsin** — Redis yoksa backend memory fallback kullanır. Tek instance Render'da çalışıyorsa fark etmez.

---

## 3. Render Backend (15 dk)

> **Not:** Render kalıcı ücretsiz tier sunar (kredi kartı gerekmez). Tek dezavantaj: 15 dk
> inaktivitede uyku moduna geçer, ilk istek ~30 sn sürer.

1. <https://render.com> → GitHub ile giriş
2. **New → Web Service** → GitHub repondan `trendanaliz` seç
3. **Configure**:
   - **Name**: `trendanaliz-api`
   - **Region**: `Frankfurt (EU Central)`
   - **Root directory**: `backend`
   - **Runtime**: `Node`
   - **Build command**: `npm install && npx prisma generate && npm run build`
   - **Start command**: `node dist/app.js`
   - **Instance Type**: **Free**
4. **Environment** sekmesinde şu env'leri ekle:

   ```env
   NODE_ENV=production
   PORT=3000

   # Postgres (Neon'dan kopyala)
   DATABASE_URL=postgresql://...

   # Redis (Upstash'ten — yoksa BOŞ bırak)
   REDIS_URL=rediss://default:pass@xxx.upstash.io:6379

   # JWT — güvenli rastgele 64-char (terminalde üret)
   JWT_SECRET=
   JWT_REFRESH_SECRET=

   # AES anahtar (Trendyol API key şifreleme)
   ENCRYPTION_KEY=

   # Frontend domain (sonra Vercel'den alıp güncelleyeceğiz)
   CORS_ORIGINS=https://trendanaliz.vercel.app

   # Sentry (opsiyonel)
   SENTRY_DSN=

   # Trendyol webhook (opsiyonel)
   TRENDYOL_WEBHOOK_SECRET=

   # Trendyol live push (mağaza yoksa 0 bırak)
   TRENDYOL_LIVE_PUSH=0
   ```

5. **Rastgele secret üret** (PowerShell):
   ```powershell
   # JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY için 3 ayrı değer
   1..3 | ForEach-Object { -join ((48..57) + (97..122) | Get-Random -Count 64 | % {[char]$_}) }
   ```

6. **Create Web Service** → Deploy başlar (~3-5 dk). Logs sekmesinden takip et.
7. Render sana `https://trendanaliz-api.onrender.com` benzeri bir URL verir.
8. Bittiğinde: `https://<render-url>/health/full` → `{"status":"ok"}` görmeli.

---

## 4. Vercel Frontend (10 dk)

1. <https://vercel.com> → GitHub ile giriş
2. **Add New → Project** → `trendanaliz` repo seç
3. **Configure**:
   - **Framework Preset**: Next.js
   - **Root Directory**: `frontend`
   - **Build Command**: (varsayılan) `npm run build`
   - **Output Directory**: (varsayılan) `.next`
4. **Environment Variables**:
   ```env
   NEXT_PUBLIC_API_URL=https://<render-url>.onrender.com/api
   ```
   > `/api` ekli olmalı. `api` olmadan tüm istekler 404 olur.
5. **Deploy** → ~2 dk
6. Vercel sana `trendanaliz-xyz.vercel.app` URL'i verir.
7. **Bu URL'i kopyala** → Render Dashboard'a geri dön → Environment → `CORS_ORIGINS` değerini bu URL'le güncelle → **Manual Deploy** tetikle.

---

## 5. İlk Superadmin Hesabı

Lokalden seed çalıştırmadıysan, dev makinende script çalıştır:

```powershell
cd c:\Users\oguzy\projects\mulk360\trendyol2\backend
$env:DATABASE_URL="<NEON-URL>"
npm run dev   # arka planda çalışsın

# Yeni terminal:
# 1) Normal kullanıcı oluştur (frontend'ten kayıt ol)
# 2) Sonra rolünü SUPERADMIN'e çek:
$env:DATABASE_URL="<NEON-URL>"
npx prisma studio
# Studio açılır → User tablosu → kendi e-postanı bul → role = SUPERADMIN → save
```

> Üretimde de aynı yöntem geçerli: Vercel'den kayıt ol → Neon Studio'dan role'i SUPERADMIN yap.

---

## 6. Trendyol Webhook (opsiyonel, mağazan yoksa atla)

Trendyol Satıcı Paneli → API Yönetimi → Webhook:
- **URL**: `https://<render-url>.onrender.com/api/webhooks/trendyol`
- **Authorization**: `Bearer <TRENDYOL_WEBHOOK_SECRET>` (Render'daki değer)

---

## 7. CI/CD (otomatik)

Artık `git push` her seferinde:
- **Render**: backend otomatik build + deploy
- **Vercel**: frontend otomatik build + deploy
- **GitHub Actions** (`.github/workflows/ci.yml`): typecheck + test çalışır, fail varsa deploy etmemek için Vercel/Render hookları kapat.

---

## 8. Custom Domain (sonra, bütçen olunca)

Domain aldığında (örn. `trendanaliz.com.tr`, Namecheap'ten yıllık ~$10):
- **Vercel**: Settings → Domains → `trendanaliz.com.tr` ekle → Vercel'in verdiği A record'ları DNS'e gir.
- **Render**: Settings → Custom Domains → `api.trendanaliz.com.tr` → CNAME ekle.
- Render env'de `CORS_ORIGINS=https://trendanaliz.com.tr` yap.
- Vercel env'de `NEXT_PUBLIC_API_URL=https://api.trendanaliz.com.tr/api` yap.

---

## 9. Maliyetler (gerçekçi)

İlk 100 kullanıcıya kadar **tamamen ücretsiz**. Üzerine:

| Aşama | Aylık tahmini |
|---|---|
| 0-100 kullanıcı | **$0** |
| 100-500 kullanıcı | $7 (Render Starter) |
| 500-2000 kullanıcı | $26 (Render $7 + Neon $19'a geç) |
| 2000+ | Dedicated VPS'e taşı |

---

## 10. Sık Karşılaşılan Hatalar

**"Cannot connect to database" Render logs'ta**
- DATABASE_URL'in sonunda `?sslmode=require` var mı? Neon zorunlu.

**Frontend "Network Error" / CORS hatası**
- Render env `CORS_ORIGINS` Vercel URL'inle birebir eşleşmeli (sonunda slash YOK, https YES).

**Vercel build "Module not found"**
- `frontend/package.json` içinde `axios`, `lucide-react`, vb. devDependencies'te değil dependencies'te olmalı.

**Trendyol API timeout**
- Render free tier'de cold start süresi uzun olabilir. Starter'a geçince çözülür.

**SSE bağlantısı kopuyor**
- Vercel/Cloudflare SSE'yi 30 sn sonra kesebilir. `NEXT_PUBLIC_API_URL` Render URL'i (direct, proxy'siz) olmalı.

---

## 11. Sonraki Adım: r10.net Tanıtım Konusu

Deploy bittiğinde Vercel URL'in elinde olunca → `R10_LAUNCH_POST.md` (bende hazır) ile r10.net'te konu açabilirsin.
