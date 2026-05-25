import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { RepricerService } from './repricer.service';
import { syncStoreOrders } from './order.service';
import { syncBuyboxForStore } from './buybox.service';
import { startTelegramBot } from './telegram-bot.service';

// Sipariş senkronizasyon periyodu (varsayılan 5 dk; ENV ile override edilebilir)
const ORDER_SYNC_INTERVAL_MS = Number(process.env.ORDER_SYNC_INTERVAL_MS || 5 * 60 * 1000);

// Buybox kontrol periyodu — plan bazında override edilir; baz dış bayraklarla
// kullanıcı özelleştirebilir. Trendyol resmi API rate limit'i (50 req / 10 sn / endpoint)
// nedeniyle 200 barkodluk chunk'larla 1000+ ürün rahatlıkla işlenir.
const BUYBOX_INTERVAL_BUSINESS_MS = Number(process.env.BUYBOX_INTERVAL_BUSINESS_MS || 5 * 60 * 1000); // 5 dk
const BUYBOX_INTERVAL_PRO_MS = Number(process.env.BUYBOX_INTERVAL_PRO_MS || 15 * 60 * 1000); // 15 dk
const BUYBOX_INTERVAL_STARTER_MS = Number(process.env.BUYBOX_INTERVAL_STARTER_MS || 60 * 60 * 1000); // 60 dk

export class SchedulerService {
  // Bellekte çalışan mağaza zamanlayıcı referanslarını tutar (duplicate engellemek için)
  private static activeTimers: Record<string, NodeJS.Timeout> = {};
  // Sipariş senkronizasyonu zamanlayıcıları
  private static orderTimers: Record<string, NodeJS.Timeout> = {};
  // Buybox kontrol zamanlayıcıları
  private static buyboxTimers: Record<string, NodeJS.Timeout> = {};

  /**
   * Sistem ayağa kalktığında tüm aktif mağaza zamanlayıcılarını başlatır
   */
  static async init(): Promise<void> {
    logger.info('Arka Plan Fiyat Zamanlayıcı Servisi (Scheduler) başlatılıyor...');
    
    try {
      const activeStores = await prisma.trendyolStore.findMany({
        where: { isActive: true }
      });

      logger.info(`Sistemde ${activeStores.length} aktif Trendyol Mağazası bulundu. Zamanlayıcılar kuruluyor...`);

      for (const store of activeStores) {
        await this.startForStore(store.id);
        this.startOrderSyncForStore(store.id);
        await this.startBuyboxSyncForStore(store.id);
      }

      // Telegram bot long-polling başlat (7/24 çalışır)
      startTelegramBot().catch((err) =>
        logger.warn(`Telegram bot başlatma hatası: ${(err as Error).message}`)
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`Scheduler init hatası: ${err.message}`);
    }
  }

  /**
   * Belirli bir mağaza için fiyat senkronizasyon döngüsünü başlatır
   */
  static async startForStore(storeId: string): Promise<void> {
    // Eğer mağaza için halihazırda çalışan bir zamanlayıcı varsa önce onu temizle
    if (this.activeTimers[storeId]) {
      clearInterval(this.activeTimers[storeId]);
      delete this.activeTimers[storeId];
    }

    try {
      // Mağaza sahibi kullanıcının abonelik planını bul
      const store = await prisma.trendyolStore.findUnique({
        where: { id: storeId },
        include: {
          user: {
            include: {
              subscriptions: {
                where: { status: { in: ['ACTIVE', 'TRIAL'] } },
                include: { plan: true }
              }
            }
          }
        }
      });

      if (!store || !store.isActive) {
        return;
      }

      // Kullanıcının en güncel aktif planını tespit et, yoksa varsayılan Starter (120 dk) varsay
      const activeSubscription = store.user.subscriptions[0];
      const planSlug = activeSubscription?.plan?.slug || 'starter';

      // Geliştirme/Simülasyon modunda süreleri saniyelere ölçekliyoruz
      // Business: 15 sn, Pro: 60 sn, Starter: 120 sn
      let intervalMs = 120 * 1000; // Varsayılan 120 saniye

      if (planSlug === 'business') {
        intervalMs = 15 * 1000; // 15 saniye
      } else if (planSlug === 'pro') {
        intervalMs = 60 * 1000; // 60 saniye
      }

      logger.info(`Mağaza "${store.storeName}" (Plan: ${planSlug}) için zamanlayıcı kuruldu. Periyot: ${intervalMs / 1000} saniye.`);

      // İlk tetiklemeyi asenkron olarak hemen yap
      setTimeout(() => {
        RepricerService.runForStore(storeId);
      }, 2000);

      // Periyodik döngüyü kur
      const timer = setInterval(() => {
        RepricerService.runForStore(storeId);
      }, intervalMs);

      this.activeTimers[storeId] = timer;
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`Mağaza ${storeId} zamanlayıcı başlatma hatası: ${err.message}`);
    }
  }

  /**
   * Bir mağaza pasifleştiğinde veya silindiğinde zamanlayıcısını durdurur
   */
  static stopForStore(storeId: string): void {
    if (this.activeTimers[storeId]) {
      clearInterval(this.activeTimers[storeId]);
      delete this.activeTimers[storeId];
      logger.info(`Mağaza ${storeId} fiyat zamanlayıcısı durduruldu.`);
    }
    if (this.orderTimers[storeId]) {
      clearInterval(this.orderTimers[storeId]);
      delete this.orderTimers[storeId];
      logger.info(`Mağaza ${storeId} sipariş zamanlayıcısı durduruldu.`);
    }
    if (this.buyboxTimers[storeId]) {
      clearInterval(this.buyboxTimers[storeId]);
      delete this.buyboxTimers[storeId];
      logger.info(`Mağaza ${storeId} buybox zamanlayıcısı durduruldu.`);
    }
  }

  /**
   * Buybox kontrolü için plan bazında periyot belirler ve döngüyü başlatır.
   * Resmi Trendyol Buybox Check Service'ini çağırır.
   */
  static async startBuyboxSyncForStore(storeId: string): Promise<void> {
    if (this.buyboxTimers[storeId]) {
      clearInterval(this.buyboxTimers[storeId]);
      delete this.buyboxTimers[storeId];
    }

    try {
      const store = await prisma.trendyolStore.findUnique({
        where: { id: storeId },
        include: {
          user: {
            include: {
              subscriptions: {
                where: { status: { in: ['ACTIVE', 'TRIAL'] } },
                include: { plan: true },
              },
            },
          },
        },
      });

      if (!store || !store.isActive) return;

      const planSlug = store.user.subscriptions[0]?.plan?.slug || 'starter';
      let intervalMs = BUYBOX_INTERVAL_STARTER_MS;
      if (planSlug === 'business') intervalMs = BUYBOX_INTERVAL_BUSINESS_MS;
      else if (planSlug === 'pro') intervalMs = BUYBOX_INTERVAL_PRO_MS;

      const run = async () => {
        try {
          const result = await syncBuyboxForStore(storeId);
          if (result.lostNotifications > 0 || result.wonNotifications > 0) {
            logger.info(
              `Buybox (store=${storeId}): kazandı=${result.wonNotifications}, kaybetti=${result.lostNotifications}, snapshot=${result.written}`
            );
          }
        } catch (err) {
          logger.warn(`Buybox sync hatası (store=${storeId}): ${(err as Error).message}`);
        }
      };

      // İlk tetiklemeyi 20 sn sonra yap (sipariş sync çatışmasını azaltmak için)
      setTimeout(run, 20_000);
      this.buyboxTimers[storeId] = setInterval(run, intervalMs);

      logger.info(
        `Mağaza "${store.storeName}" (Plan: ${planSlug}) buybox zamanlayıcısı kuruldu. Periyot: ${intervalMs / 1000} sn.`
      );
    } catch (err) {
      logger.error(`startBuyboxSyncForStore hatası (${storeId}): ${(err as Error).message}`);
    }
  }

  /**
   * Mağaza için sipariş senkronizasyon döngüsünü başlatır.
   * - Açılışta 10 sn sonra ilk çekim (uygulama soğuk başlangıçta yorulmasın)
   * - Sonra her ORDER_SYNC_INTERVAL_MS aralığında çalışır
   */
  static startOrderSyncForStore(storeId: string): void {
    if (this.orderTimers[storeId]) {
      clearInterval(this.orderTimers[storeId]);
      delete this.orderTimers[storeId];
    }

    const run = async () => {
      try {
        const result = await syncStoreOrders(storeId);
        if (result.created > 0 || result.updated > 0) {
          logger.info(
            `Sipariş senkronizasyonu (store=${storeId}): yeni=${result.created}, güncel=${result.updated}, toplam=${result.totalFetched}`
          );
        }
      } catch (err) {
        logger.warn(`Sipariş senkronizasyon hatası (store=${storeId}): ${(err as Error).message}`);
      }
    };

    setTimeout(run, 10_000);
    this.orderTimers[storeId] = setInterval(run, ORDER_SYNC_INTERVAL_MS);
    logger.info(
      `Mağaza ${storeId} sipariş zamanlayıcısı kuruldu (${ORDER_SYNC_INTERVAL_MS / 1000} sn).`
    );
  }
}
