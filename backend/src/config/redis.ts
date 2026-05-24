import Redis from 'ioredis';
import { logger } from '../utils/logger';

/**
 * Redis Singleton Bağlantısı
 *
 * - REDIS_URL tanımlıysa gerçek Redis'e bağlanır
 * - Tanımlı değilse (development), `null` döner ve çağıran modüller
 *   bellek-içi fallback'e geri düşer
 * - Bağlantı hataları kapatılmaz; ioredis otomatik retry yapar
 *
 * Kullanım:
 *   const redis = getRedis();
 *   if (redis) {
 *     await redis.set(...);
 *   } else {
 *     // bellek içi fallback
 *   }
 */

let client: Redis | null = null;
let initialized = false;
let healthy = false;

const buildClient = (url: string): Redis => {
  const c = new Redis(url, {
    // Bağlantı kurulamazsa app'in açılmasını engellememek için
    // başlangıçta lazyConnect veya retryStrategy ayarlanabilir.
    maxRetriesPerRequest: 3,
    enableOfflineQueue: false,
    retryStrategy(times) {
      // Üstel artarak max 30 sn bekle, sonra her 30 sn'de bir dene
      const delay = Math.min(times * 500, 30_000);
      return delay;
    },
    reconnectOnError(err) {
      logger.warn(`Redis reconnect on error: ${err.message}`);
      return true;
    },
  });

  c.on('connect', () => {
    healthy = true;
    logger.info('[redis] bağlantı kuruldu.');
  });
  c.on('ready', () => {
    healthy = true;
  });
  c.on('error', (err) => {
    healthy = false;
    // ioredis kendi retry yapıyor; sadece logla
    logger.warn(`[redis] hata: ${err.message}`);
  });
  c.on('close', () => {
    healthy = false;
    logger.warn('[redis] bağlantı kapandı.');
  });

  return c;
};

/**
 * Singleton Redis bağlantısı döner. REDIS_URL yoksa null.
 */
export const getRedis = (): Redis | null => {
  if (initialized) return client;
  initialized = true;

  const url = process.env.REDIS_URL;
  if (!url) {
    logger.info('[redis] REDIS_URL tanımlı değil; bellek-içi fallback kullanılacak.');
    return null;
  }

  try {
    client = buildClient(url);
  } catch (err) {
    logger.error(`[redis] istemci oluşturulamadı: ${(err as Error).message}`);
    client = null;
  }
  return client;
};

/**
 * Redis sağlıklı mı? (bağlantı açıldıysa true)
 * Health endpoint için kullanılabilir.
 */
export const isRedisHealthy = (): boolean => healthy;

/**
 * Test/shutdown için bağlantıyı kapat.
 */
export const closeRedis = async (): Promise<void> => {
  if (client) {
    try {
      await client.quit();
    } catch {
      // ignore
    }
    client = null;
    initialized = false;
    healthy = false;
  }
};
