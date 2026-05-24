import dotenv from 'dotenv';
// .env yüklemesi route ve servis modülleri import edilmeden ÖNCE yapılmalı,
// aksi takdirde modül-yüklemesinde okunan secret'lar boş olur.
dotenv.config();

import { validateEnv } from './config/env';
// Eksik veya güvensiz secret varsa burada throw eder, uygulama açılmaz.
validateEnv();

import { initSentry, sentryErrorHandler, captureException } from './config/sentry';
// Sentry — SENTRY_DSN tanımlıysa hata izleme başlatılır
initSentry();

// BigInt JSON serileştirme — Order.shipmentPackageId, OrderItem.lineId vb.
// Prisma BigInt sütunları için JSON.stringify'ın TypeError fırlatmasını engeller.
// Tüm yanıtlarda BigInt'ler string'e dönüştürülerek serileştirilir.
(BigInt.prototype as unknown as { toJSON: () => string }).toJSON = function () {
  return this.toString();
};

import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import authRoutes from './routes/auth.routes';
import publicRoutes from './routes/public.routes';
import storeRoutes from './routes/store.routes';
import productRoutes from './routes/product.routes';
import competitorRoutes from './routes/competitor.routes';
import ruleRoutes from './routes/rule.routes';
import notificationRoutes from './routes/notification.routes';
import subscriptionRoutes from './routes/subscription.routes';
import paymentRoutes from './routes/payment.routes';
import listingRoutes from './routes/listing.routes';
import forecastRoutes from './routes/forecast.routes';
import campaignRoutes from './routes/campaign.routes';
import adminRoutes from './routes/admin.routes';
import orderRoutes from './routes/order.routes';
import buyboxRoutes from './routes/buybox.routes';
import webhookRoutes from './routes/webhook.routes';
import healthRoutes from './routes/health.routes';
import { logger } from './utils/logger';
import { SchedulerService } from './services/scheduler.service';
import { startSubscriptionCron } from './services/subscription-cron.service';
import { authenticateToken } from './middleware/auth.middleware';
import { requireActiveSubscription } from './middleware/subscription.middleware';
import { requestContext } from './middleware/request-context.middleware';

const app = express();
const PORT = process.env.PORT || 3000;

// Güvenlik Middleware'leri
app.use(helmet());

// Response sıkıştırma (gzip) - performans için zorunlu
app.use(compression());

// CORS Yapılandırması — birden fazla origin desteği
// CORS_ORIGINS virgülle ayrılmış liste; tanımlı değilse FRONTEND_URL veya localhost
const allowedOrigins = (process.env.CORS_ORIGINS || process.env.FRONTEND_URL || 'http://localhost:3001')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin veya curl/server-to-server istekler (origin yok) için izin ver
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }
      logger.warn(`CORS reddedildi: ${origin}`);
      callback(new Error(`CORS politikası ${origin} adresini reddetti.`));
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  })
);

// JSON Gövde Analizi (Body Parsing)
app.use(express.json());

// Request Context: her isteğe X-Request-Id + req.log child logger ekler,
// finish'te yapılandırılmış http_request log satırı atar.
app.use(requestContext);

// Kimlik Doğrulama Uç Noktaları İçin Hız Sınırlandırıcı (Rate Limiting)
// IP başına dakikada maksimum 10 istek
const authRateLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 dakika
  max: 10, // IP başına limit
  message: {
    success: false,
    message: 'Çok fazla istek gönderdiniz. Lütfen bir dakika sonra tekrar deneyin.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// === Rotalar ===
//
// Muaf grup: kimlik doğrulama gerektirmeyen veya abonelik gerektirmeyen.
//   /api/auth        — giriş, kayıt, şifre sıfırlama
//   /api/public      — public planlar, footer ayarları
//   /api/notifications — bildirim akışı (SSE token query'den, geri kalanı kendi authenticateToken'ını kullanır)
//   /api/subscriptions — kullanıcının aboneliğini görüntüleme/iptal
//   /api/payments    — yeni abonelik için ödeme akışı
//   /api/admin       — kendi requireRole(SUPERADMIN) guard'ı var
app.use('/api/auth', authRateLimiter, authRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/subscriptions', subscriptionRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/webhooks', webhookRoutes); // Public — imza/secret ile doğrulanır

// Korumalı grup: tüm endpoint'ler aktif abonelik gerektirir.
// SUPERADMIN her durumda muaftır (subscription middleware içinde işleniyor).
const protectedGuard = [authenticateToken as any, requireActiveSubscription as any];
app.use('/api/store', protectedGuard, storeRoutes);
// Spec uyumluluğu: /api/trendyol/* alias
app.use('/api/trendyol', protectedGuard, storeRoutes);
app.use('/api/products', protectedGuard, productRoutes);
app.use('/api/competitors', protectedGuard, competitorRoutes);
app.use('/api/rules', protectedGuard, ruleRoutes);
app.use('/api/listings', protectedGuard, listingRoutes);
app.use('/api/forecast', protectedGuard, forecastRoutes);
app.use('/api/campaigns', protectedGuard, campaignRoutes);
app.use('/api/orders', protectedGuard, orderRoutes);
app.use('/api/buybox', protectedGuard, buyboxRoutes);

// Sağlık Kontrolleri: /health, /health/db, /health/redis, /health/full
app.use('/health', healthRoutes);

// Sentry hata yakalayıcı global handler'dan ÖNCE
app.use(sentryErrorHandler as any);

// Genel Hata Yakalama (Global Error Handler)
app.use((err: Error, req: Request, res: Response, _next: NextFunction) => {
  const requestId = (req as any).requestId;
  logger.error('Beklenmeyen hata', {
    requestId,
    error: err.message,
    stack: err.stack,
  });
  res.status(500).json({
    success: false,
    error: 'Internal Server Error',
    message: 'Sunucu tarafında beklenmeyen bir hata oluştu.',
    requestId,
  });
});

// Process-level beklenmeyen hatalar (cron/worker'lardan gelebilir)
process.on('unhandledRejection', (reason) => {
  logger.error('Yakalanmamış Promise reddi', { reason: String(reason) });
  captureException(reason);
});
process.on('uncaughtException', (err) => {
  logger.error('Yakalanmamış istisna', { error: err.message, stack: err.stack });
  captureException(err);
});

// Sunucuyu Başlatma
app.listen(PORT, async () => {
  logger.info(`TrendAnaliz Backend Sunucusu ${PORT} portunda çalışmaya başladı.`);
  
  // Arka plan zamanlayıcılarını başlat
  await SchedulerService.init();
  startSubscriptionCron();
});

export default app;
