import * as Sentry from '@sentry/node';
import { logger } from '../utils/logger';

/**
 * Sentry Hata İzleme
 *
 * SENTRY_DSN ortam değişkeni tanımlıysa Sentry başlatılır; aksi halde
 * tüm fonksiyonlar no-op olur (development için yapılandırma zorunluluğu yok).
 *
 * Kullanım:
 *   - initSentry()                → uygulama açılışında BİR kez çağrılır
 *   - captureException(err, meta) → manuel hata raporu
 *   - sentryErrorHandler          → Express global error handler
 */

let initialized = false;

export const initSentry = (): void => {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) {
    logger.info('[sentry] SENTRY_DSN tanımsız; hata raporlama devre dışı.');
    return;
  }
  if (initialized) return;

  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.APP_RELEASE,
    // Otomatik instrumentation: http + express + node native
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE || 0.1),
    // PII filtrele (Pino redact ile uyumlu)
    sendDefaultPii: false,
    beforeSend(event) {
      // Hassas alanları temizle
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
      }
      return event;
    },
  });
  initialized = true;
  logger.info('[sentry] Hata raporlama aktif.');
};

/**
 * Manuel hata raporu. context: ek tag/extra alanlar.
 */
export const captureException = (
  err: unknown,
  context?: Record<string, unknown>
): void => {
  if (!initialized) return;
  Sentry.captureException(err, context ? { extra: context } : undefined);
};

/**
 * Express global error handler (4-arg).
 * app.ts global error handler'ından ÖNCE register edilir.
 */
export const sentryErrorHandler = (
  err: Error,
  _req: unknown,
  _res: unknown,
  next: (err?: unknown) => void
) => {
  if (initialized) {
    Sentry.captureException(err);
  }
  next(err);
};
