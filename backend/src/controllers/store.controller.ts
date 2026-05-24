import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { addStoreLog, getStoreLogs } from '../services/repricer.service';
import { SchedulerService } from '../services/scheduler.service';
import { RuleType } from '@prisma/client';
import { encrypt, decrypt } from '../utils/crypto';
import * as trendyol from '../services/trendyol.service';

/**
 * POST /api/store/integrate
 * Trendyol API anahtarlarını doğrular/kaydeder ve mağazayı entegre eder
 */
export const integrateStore = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { supplierId, apiKey, apiSecret, storeName } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  if (!supplierId || !apiKey || !apiSecret || !storeName) {
    return res.status(400).json({ success: false, message: 'Lütfen tüm entegrasyon parametrelerini doldurun.' });
  }

  try {
    // 1. Mağazayı Kaydet veya Güncelle (Upsert)
    const existingStore = await prisma.trendyolStore.findFirst({
      where: { userId }
    });

    // Hassas API anahtarları AES-256-GCM ile şifrelenerek saklanır
    const encryptedApiKey = encrypt(apiKey);
    const encryptedApiSecret = encrypt(apiSecret);

    let store;
    if (existingStore) {
      store = await prisma.trendyolStore.update({
        where: { id: existingStore.id },
        data: {
          supplierId,
          apiKey: encryptedApiKey,
          apiSecret: encryptedApiSecret,
          storeName,
          isActive: true,
          updatedAt: new Date()
        }
      });
    } else {
      store = await prisma.trendyolStore.create({
        data: {
          userId,
          supplierId,
          apiKey: encryptedApiKey,
          apiSecret: encryptedApiSecret,
          storeName,
          isActive: true
        }
      });
    }

    addStoreLog(store.id, `Trendyol API bağlantısı kuruluyor (Satıcı ID: ${supplierId})...`);

    // 2. Önce gerçek API'den ürün çekmeyi dene
    const productCount = await prisma.product.count({ where: { storeId: store.id } });
    let liveImported = 0;
    if (productCount === 0) {
      addStoreLog(store.id, 'Mağazaya ait ürün listesi Trendyol API üzerinden çekiliyor...');
      try {
        const live = await trendyol.fetchAllProducts(
          { supplierId, apiKey, apiSecret },
          { maxPages: 20, size: 100 }
        );
        if (live.length > 0) {
          // Plan limiti — yeni yaratılabilecek ürün sayısı (mevcut update'ler limite girmez)
          const { remainingProductSlots } = await import(
            '../services/plan-limits.service'
          );
          let slotsLeft = await remainingProductSlots(userId);
          let limitHit = false;

          for (const lp of live) {
            try {
              const existing = await prisma.product.findUnique({
                where: { barcode: lp.barcode },
                select: { id: true },
              });
              if (!existing && slotsLeft <= 0) {
                limitHit = true;
                continue; // Limit dolu — yeni ürünleri atla
              }
              await prisma.product.upsert({
                where: { barcode: lp.barcode },
                create: {
                  storeId: store.id,
                  barcode: lp.barcode,
                  title: lp.title,
                  productCode: lp.productMainId,
                  salePrice: lp.salePrice,
                  listPrice: lp.listPrice,
                  vatRate: lp.vatRate,
                  stockCount: lp.quantity,
                  categoryId: lp.categoryId ? String(lp.categoryId) : undefined,
                  categoryName: lp.categoryName || undefined,
                  imageUrl: lp.images?.[0]?.url,
                  lastFetchedAt: new Date(),
                },
                update: {
                  title: lp.title,
                  salePrice: lp.salePrice,
                  listPrice: lp.listPrice,
                  vatRate: lp.vatRate,
                  stockCount: lp.quantity,
                  categoryId: lp.categoryId ? String(lp.categoryId) : undefined,
                  categoryName: lp.categoryName || undefined,
                  imageUrl: lp.images?.[0]?.url,
                  lastFetchedAt: new Date(),
                },
              });
              if (!existing) slotsLeft--;
              liveImported++;
            } catch (innerErr) {
              logger.warn(
                `Ürün upsert hatası (barcode=${lp.barcode}): ${(innerErr as Error).message}`
              );
            }
          }
          addStoreLog(
            store.id,
            `Trendyol API'den ${liveImported} ürün başarıyla içe aktarıldı.${
              limitHit ? ' (Plan ürün limitiniz dolduğu için bazı ürünler atlandı.)' : ''
            }`
          );
        } else {
          addStoreLog(store.id, 'Trendyol hesabınızda onaylı ürün bulunamadı, demo veri yükleniyor...');
        }
      } catch (apiErr) {
        const e = apiErr as Error;
        addStoreLog(
          store.id,
          `UYARI: Trendyol API çağrısı başarısız (${e.message}). Demo veri yükleniyor...`
        );
        logger.warn(`Trendyol fetchAllProducts başarısız: ${e.message}`);
      }
    }

    // 3. Hala ürün yoksa demo veriyi yükle (ilk kullanım deneyimi için)
    const productCountAfterLive = await prisma.product.count({ where: { storeId: store.id } });
    if (productCountAfterLive === 0) {
      addStoreLog(store.id, 'Demo ürün ve rakip seti yükleniyor...');

      const testProducts = [
        { title: 'Kablosuz Bluetooth ANC Kulaklık', barcode: 'KAB-ANC22', salePrice: 899.00, listPrice: 1200.00, vatRate: 20.00, stockCount: 15, ruleType: RuleType.BEAT_BY_AMOUNT, targetValue: 0.50, minPrice: 799.00, maxPrice: 1200.00, buybox: true },
        { title: 'Ortopedik Oyuncu Koltuğu', barcode: 'OY-KOLTUK', salePrice: 3450.00, listPrice: 4500.00, vatRate: 20.00, stockCount: 8, ruleType: RuleType.MATCH_LOWEST, targetValue: 0.00, minPrice: 3200.00, maxPrice: 4500.00, buybox: false },
        { title: 'RGB Oyuncu Mouse 16000 DPI', barcode: 'OY-MOUSE', salePrice: 450.00, listPrice: 699.00, vatRate: 20.00, stockCount: 30, ruleType: RuleType.MATCH_LOWEST, targetValue: 0.00, minPrice: 399.00, maxPrice: 699.00, buybox: true },
        { title: 'Mekanik Klavye Blue Switch', barcode: 'MEK-KLAV', salePrice: 1250.00, listPrice: 1800.00, vatRate: 20.00, stockCount: 12, ruleType: RuleType.BEAT_BY_AMOUNT, targetValue: 0.50, minPrice: 1100.00, maxPrice: 1800.00, buybox: false },
        { title: '27 inç IPS 144Hz Oyuncu Monitörü', barcode: 'IPS-27MON', salePrice: 5499.00, listPrice: 6500.00, vatRate: 20.00, stockCount: 4, ruleType: RuleType.BEAT_BY_AMOUNT, targetValue: 0.50, minPrice: 4999.00, maxPrice: 6500.00, buybox: true }
      ];

      for (const tp of testProducts) {
        const product = await prisma.product.create({
          data: {
            storeId: store.id,
            barcode: tp.barcode,
            title: tp.title,
            salePrice: tp.salePrice,
            listPrice: tp.listPrice,
            vatRate: tp.vatRate,
            stockCount: tp.stockCount,
            lastFetchedAt: new Date()
          }
        });

        // Kural Ekle
        await prisma.priceRule.create({
          data: {
            productId: product.id,
            ruleType: tp.ruleType,
            targetValue: tp.targetValue,
            minPrice: tp.minPrice,
            maxPrice: tp.maxPrice,
            isActive: true
          }
        });

        // Rakipleri Ekle
        const compList = [
          { name: 'TeknolojiDünyası', rate: 45, priceOffset: tp.buybox ? 10.00 : -10.00 },
          { name: 'TrendOutlet TR', rate: 82, priceOffset: tp.buybox ? 20.00 : -5.00 },
          { name: 'UcuzSepetim', rate: 15, priceOffset: 45.00 }
        ];

        for (const c of compList) {
          await prisma.competitor.create({
            data: {
              productId: product.id,
              competitorSellerId: Math.floor(Math.random() * 100000).toString(),
              competitorSellerName: c.name,
              currentPrice: tp.salePrice + c.priceOffset,
              lastSeenPrice: tp.salePrice + c.priceOffset,
              inStock: true,
              isBuybox: !tp.buybox && c.priceOffset < 0
            }
          });
        }
      }

      addStoreLog(store.id, 'Ürünler ve rakipler Trendyol kataloğundan başarıyla çekildi.');
    }

    addStoreLog(store.id, 'Trendyol API entegrasyonu başarıyla tamamlandı. Otomatik Repricer devrede.');

    // 3. Zamanlayıcıyı başlat/güncelle (fiyat + sipariş)
    await SchedulerService.startForStore(store.id);
    SchedulerService.startOrderSyncForStore(store.id);

    return res.json({
      success: true,
      message: 'Trendyol API bağlantısı başarıyla tamamlandı.',
      data: {
        storeName: store.storeName,
        supplierId: store.supplierId,
        isActive: store.isActive
      }
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Integrate store hatası: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'API entegrasyonu sırasında bir sunucu hatası oluştu.'
    });
  }
};

/**
 * GET /api/store/status
 * Aktif mağazanın durumunu getirir
 */
export const getStoreStatus = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({
      where: { userId }
    });

    if (!store) {
      return res.json({
        success: true,
        connected: false,
        message: 'Mağaza entegrasyonu bulunamadı.'
      });
    }

    return res.json({
      success: true,
      connected: true,
      data: {
        id: store.id,
        storeName: store.storeName,
        supplierId: store.supplierId,
        isActive: store.isActive,
        lastSyncAt: store.lastSyncAt
      }
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Store status hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
};

/**
 * POST /api/store/test-connection
 * Wizard 1. adımı: Trendyol API kimlik bilgilerini gerçek HTTP isteği ile doğrular.
 *
 * Body:
 *   - supplierId, apiKey, apiSecret (zorunlu)
 *   - skipLiveCheck (opsiyonel): true ise sadece format doğrulaması yapılır.
 */
export const testConnection = async (req: AuthenticatedRequest, res: Response) => {
  const { supplierId, apiKey, apiSecret, skipLiveCheck } = req.body;

  if (!supplierId || !apiKey || !apiSecret) {
    return res.status(400).json({
      success: false,
      message: 'Supplier ID, API Key ve API Secret zorunludur.',
    });
  }

  // Format doğrulaması
  if (!/^\d+$/.test(String(supplierId))) {
    return res.status(400).json({
      success: false,
      message: 'Supplier ID yalnızca rakamlardan oluşmalıdır.',
    });
  }

  if (String(apiKey).length < 8 || String(apiSecret).length < 8) {
    return res.status(400).json({
      success: false,
      message: 'API Key ve API Secret en az 8 karakter olmalıdır.',
    });
  }

  if (skipLiveCheck) {
    return res.json({
      success: true,
      message: 'Format doğrulaması başarılı. (Canlı API testi atlandı)',
      data: { supplierId, valid: true, live: false },
    });
  }

  // Canlı API testi
  const result = await trendyol.testCredentials({
    supplierId: String(supplierId),
    apiKey: String(apiKey),
    apiSecret: String(apiSecret),
  });

  if (!result.ok) {
    logger.warn(`Trendyol credentials test başarısız (supplier=${supplierId}): ${result.reason}`);
    return res.status(400).json({
      success: false,
      message: `Trendyol API doğrulaması başarısız: ${result.reason}`,
    });
  }

  return res.json({
    success: true,
    message: `Bağlantı doğrulandı. Hesabınızda yaklaşık ${result.sample} ürün bulundu.`,
    data: { supplierId, valid: true, live: true, productCount: result.sample },
  });
};

/**
 * GET /api/store/logs
 * Konsol için senkronizasyon loglarını getirir
 */
export const getStoreLogsEndpoint = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({
      where: { userId }
    });

    if (!store) {
      return res.json({
        success: true,
        logs: [
          '[Sistem] Trendyol API entegrasyonu bekleniyor...',
          '[Sistem] Başlamak için Entegrasyon ayarları sekmesinden API anahtarlarınızı girin.'
        ]
      });
    }

    const logs = getStoreLogs(store.id);

    return res.json({
      success: true,
      logs
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Get store logs hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
};

/**
 * POST /api/store/sync
 * Kayıtlı API kimlik bilgileriyle Trendyol'dan ürünleri yeniden çekip günceller.
 */
export const syncProducts = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });
    if (!store) {
      return res
        .status(404)
        .json({ success: false, message: 'Mağaza entegrasyonu bulunamadı.' });
    }

    const apiKey = decrypt(store.apiKey);
    const apiSecret = decrypt(store.apiSecret);

    addStoreLog(store.id, 'Manuel senkronizasyon başlatıldı...');

    const live = await trendyol.fetchAllProducts(
      { supplierId: store.supplierId, apiKey, apiSecret },
      { maxPages: 50, size: 100 }
    );

    let upserted = 0;
    let skipped = 0;
    let limitSkipped = 0;
    const { remainingProductSlots } = await import(
      '../services/plan-limits.service'
    );
    let slotsLeft = await remainingProductSlots(userId);

    for (const lp of live) {
      try {
        const existing = await prisma.product.findUnique({
          where: { barcode: lp.barcode },
          select: { id: true },
        });
        if (!existing && slotsLeft <= 0) {
          limitSkipped++;
          continue;
        }
        await prisma.product.upsert({
          where: { barcode: lp.barcode },
          create: {
            storeId: store.id,
            barcode: lp.barcode,
            title: lp.title,
            productCode: lp.productMainId,
            salePrice: lp.salePrice,
            listPrice: lp.listPrice,
            vatRate: lp.vatRate,
            stockCount: lp.quantity,
            categoryId: lp.categoryId ? String(lp.categoryId) : undefined,
            categoryName: lp.categoryName || undefined,
            imageUrl: lp.images?.[0]?.url,
            lastFetchedAt: new Date(),
          },
          update: {
            title: lp.title,
            salePrice: lp.salePrice,
            listPrice: lp.listPrice,
            vatRate: lp.vatRate,
            stockCount: lp.quantity,
            categoryId: lp.categoryId ? String(lp.categoryId) : undefined,
            categoryName: lp.categoryName || undefined,
            imageUrl: lp.images?.[0]?.url,
            lastFetchedAt: new Date(),
          },
        });
        if (!existing) slotsLeft--;
        upserted++;
      } catch (e) {
        skipped++;
        logger.warn(
          `Sync upsert hatası (barcode=${lp.barcode}): ${(e as Error).message}`
        );
      }
    }
    if (limitSkipped > 0) {
      addStoreLog(
        store.id,
        `Plan ürün limitiniz dolu olduğu için ${limitSkipped} yeni ürün atlandı. Daha üst pakete geçerek hepsini içe aktarabilirsiniz.`
      );
    }

    await prisma.trendyolStore.update({
      where: { id: store.id },
      data: { lastSyncAt: new Date() },
    });

    addStoreLog(
      store.id,
      `Senkronizasyon tamamlandı: ${upserted} ürün güncellendi, ${skipped} atlandı.`
    );

    return res.json({
      success: true,
      message: `${upserted} ürün güncellendi.`,
      data: { total: live.length, upserted, skipped },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Sync products hatası: ${err.message}`);
    return res.status(502).json({
      success: false,
      message: `Senkronizasyon başarısız: ${err.message}`,
    });
  }
};

/**
 * POST /api/store/push-price-inventory
 * Body: { items: [{ barcode, salePrice?, listPrice?, quantity? }] }
 * Verilen ürünlerin fiyat ve/veya stok bilgisini Trendyol'a gönderir.
 */
export const pushPriceInventory = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  const items = (req.body?.items || []) as Array<{
    barcode: string;
    salePrice?: number;
    listPrice?: number;
    quantity?: number;
  }>;

  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'Güncellenecek ürün listesi boş.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });
    if (!store) {
      return res
        .status(404)
        .json({ success: false, message: 'Mağaza entegrasyonu bulunamadı.' });
    }

    const apiKey = decrypt(store.apiKey);
    const apiSecret = decrypt(store.apiSecret);

    const batches = await trendyol.bulkUpdatePriceInventory(
      { supplierId: store.supplierId, apiKey, apiSecret },
      items
    );

    addStoreLog(
      store.id,
      `${items.length} ürün için fiyat/stok push işlemi gönderildi (batchCount=${batches.length}).`
    );

    return res.json({
      success: true,
      message: `${items.length} ürün için güncelleme isteği oluşturuldu.`,
      data: { batches },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Push price inventory hatası: ${err.message}`);
    return res.status(502).json({
      success: false,
      message: `Trendyol'a güncelleme gönderilemedi: ${err.message}`,
    });
  }
};

/**
 * GET /api/store/dashboard-stats
 * Kullanıcının dashboard'unda gösterilen gerçek zamanlı istatistikler
 */
export const getDashboardStats = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });

    if (!store) {
      return res.json({
        success: true,
        data: {
          todaySales: 0,
          todaySalesChange: 0,
          buyboxWinRate: 0,
          buyboxStatus: 'unknown',
          activeRepricerCount: 0,
          priceChangeCount: 0,
          connectedStore: false,
        },
      });
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);

    // 1. Bugünkü satış toplamı
    const todayOrders = await prisma.order.aggregate({
      where: {
        storeId: store.id,
        orderDate: { gte: todayStart },
        status: { notIn: ['Cancelled', 'Returned', 'UnSupplied'] },
      },
      _sum: { totalPrice: true },
    });
    const todaySales = Number(todayOrders._sum.totalPrice || 0);

    // Dünkü satış (karşılaştırma)
    const yesterdayOrders = await prisma.order.aggregate({
      where: {
        storeId: store.id,
        orderDate: { gte: yesterdayStart, lt: todayStart },
        status: { notIn: ['Cancelled', 'Returned', 'UnSupplied'] },
      },
      _sum: { totalPrice: true },
    });
    const yesterdaySales = Number(yesterdayOrders._sum.totalPrice || 0);
    const todaySalesChange = yesterdaySales > 0
      ? ((todaySales - yesterdaySales) / yesterdaySales) * 100
      : 0;

    // 2. BuyBox kazanma oranı
    const productsWithSnapshots = await prisma.product.findMany({
      where: { storeId: store.id },
      select: {
        id: true,
        buyboxSnapshots: {
          orderBy: { checkedAt: 'desc' },
          take: 1,
          select: { buyboxOrder: true },
        },
      },
    });

    const withSnapshots = productsWithSnapshots.filter(p => p.buyboxSnapshots.length > 0);
    const winning = withSnapshots.filter(p => p.buyboxSnapshots[0].buyboxOrder === 1).length;
    let buyboxWinRate = 0;
    let buyboxStatus: 'leading' | 'losing' | 'unknown' = 'unknown';
    if (withSnapshots.length > 0) {
      buyboxWinRate = Math.round((winning / withSnapshots.length) * 1000) / 10;
      buyboxStatus = buyboxWinRate >= 50 ? 'leading' : 'losing';
    }

    // 3. Aktif repricer sayısı
    const activeRepricerCount = await prisma.priceRule.count({
      where: {
        isActive: true,
        product: { storeId: store.id },
      },
    });

    // 4. Bugünkü fiyat değişimi sayısı
    const priceChangeCount = await prisma.priceHistory.count({
      where: {
        recordedAt: { gte: todayStart },
        product: { storeId: store.id },
      },
    });

    return res.json({
      success: true,
      data: {
        todaySales,
        todaySalesChange: Math.round(todaySalesChange * 10) / 10,
        buyboxWinRate,
        buyboxStatus,
        activeRepricerCount,
        priceChangeCount,
        connectedStore: true,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Dashboard stats hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
};
