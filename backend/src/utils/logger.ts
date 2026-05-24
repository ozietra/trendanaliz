import pino, { Logger as PinoLogger } from 'pino';

/**
 * Structured logger (Pino tabanlı).
 *
 * - Development'ta `pino-pretty` ile renkli ve okunaklı çıktı
 * - Production'da JSON satırlar (Loki/Datadog/CloudWatch için ideal)
 *
 * Eski Winston API'si ile uyumluluk:
 *   - logger.info(msg)
 *   - logger.warn(msg)
 *   - logger.error(msg)
 *   - logger.http(msg) → Pino'da http yok; info'ya yönlendirilir
 *   - logger.debug(msg)
 *
 * Yeni özellikler:
 *   - logger.child({ requestId, userId, ... }) → bağlam ekleyen child logger
 *   - Tüm satırlarda hassas alanlar (password, apiKey, token, authorization)
 *     `redact` yardımıyla **REDACTED** olarak çıkar.
 */

const isDev = (process.env.NODE_ENV || 'development') !== 'production';

const pinoOptions: pino.LoggerOptions = {
  level: process.env.LOG_LEVEL || (isDev ? 'debug' : 'info'),
  redact: {
    // Hassas alanlar otomatik maskelenir
    paths: [
      'password',
      'passwordHash',
      '*.password',
      '*.passwordHash',
      'apiKey',
      'apiSecret',
      '*.apiKey',
      '*.apiSecret',
      'token',
      'accessToken',
      'refreshToken',
      '*.token',
      'authorization',
      'req.headers.authorization',
      'req.headers.cookie',
      'headers.authorization',
      'headers.cookie',
    ],
    censor: '[REDACTED]',
  },
  base: {
    service: 'trendanaliz-backend',
    env: process.env.NODE_ENV || 'development',
  },
  timestamp: pino.stdTimeFunctions.isoTime,
};

if (isDev) {
  pinoOptions.transport = {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:HH:MM:ss.l',
      ignore: 'pid,hostname,service,env',
    },
  };
}

const pinoLogger: PinoLogger = pino(pinoOptions);

/**
 * Winston-uyumlu logger arayüzü. Eski `logger.info/warn/error/http/debug`
 * çağrılarını bozmadan Pino'yu kullanır.
 */
export interface AppLogger {
  info: (msg: string, meta?: Record<string, unknown>) => void;
  warn: (msg: string, meta?: Record<string, unknown>) => void;
  error: (msg: string, meta?: Record<string, unknown>) => void;
  http: (msg: string, meta?: Record<string, unknown>) => void;
  debug: (msg: string, meta?: Record<string, unknown>) => void;
  child: (bindings: Record<string, unknown>) => AppLogger;
  raw: PinoLogger;
}

const wrap = (p: PinoLogger): AppLogger => ({
  info: (msg, meta) => (meta ? p.info(meta, msg) : p.info(msg)),
  warn: (msg, meta) => (meta ? p.warn(meta, msg) : p.warn(msg)),
  error: (msg, meta) => (meta ? p.error(meta, msg) : p.error(msg)),
  // Pino'da 'http' seviyesi yok; info olarak loglarız
  http: (msg, meta) => (meta ? p.info({ ...meta, http: true }, msg) : p.info({ http: true }, msg)),
  debug: (msg, meta) => (meta ? p.debug(meta, msg) : p.debug(msg)),
  child: (bindings) => wrap(p.child(bindings)),
  raw: p,
});

export const logger: AppLogger = wrap(pinoLogger);
