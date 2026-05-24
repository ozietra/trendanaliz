import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { decrypt } from '../utils/crypto';
import { fetchAllBuyboxInfo, TrendyolBuyboxInfo } from './trendyol.service';
import { createNotification } from './notification.service';

/**
 * BuyBox Servisi
 *
 * Resmi Trendyol Buybox Check Service'i ile bir mağazanın TÜM ürünlerini
 * tarar, her ürün için bir `BuyBoxSnapshot` yazar ve durum değiştiyse
 * (kazandı/kaybetti) kullanıcıya bildirim gönderir.
 *
 * Bu modül, projedeki TEK gerçek rakip-fiyat veri kaynağıdır.
 * Eski `Competitor` modeli (Math.random ile üretilen fake rakipler)
 * SADECE manuel rakip eklemek isteyen kullanıcılar için tutulur;
 * repricer kararı `BuyBoxSnapshot` üzerinden alınır.
 */

interface SyncResult {
  /** API'den dönen barkod sayısı */
  fetched: number;
  /** DB'ye yazılan snapshot sayısı */
  written: number;
  /** BUYBOX_LOST bildirimi gönderilen ürün sayısı */
  lostNotifications: number;
  /** BUYBOX_WON bildirimi gönderilen ürün sayısı */
  wonNotifications: number;
}

/**
 * Tek mağaza için tüm aktif ürünlerin Buybox snapshot'larını çeker ve yazar.
 * Önceki snapshot ile karşılaştırıp BUYBOX_LOST/BUYBOX_WON bildirimleri üretir.
 */
export const syncBuyboxForStore = async (storeId: string): Promise<SyncResult> => {
  const store = await prisma.trendyolStore.findUnique({
    where: { id: storeId },
    include: {
      products: {
        select: { id: true, barcode: true, title: true, salePrice: true },
      },
    },
  });

  if (!store) {
    throw new Error(`Mağaza bulunamadı: ${storeId}`);
  }
  if (!store.isActive) {
    logger.info(`Buybox sync atlandı: mağaza aktif değil (storeId=${storeId})`);
    return { fetched: 0, written: 0, lostNotifications: 0, wonNotifications: 0 };
  }
  if (store.products.length === 0) {
    return { fetched: 0, written: 0, lostNotifications: 0, wonNotifications: 0 };
  }

  let apiKey: string;
  let apiSecret: string;
  try {
    apiKey = decrypt(store.apiKey);
    apiSecret = decrypt(store.apiSecret);
  } catch (err) {
    logger.error(
      `Buybox sync iptal: mağaza credentials decrypt edilemedi (storeId=${storeId}): ${(err as Error).message}`
    );
    throw err;
  }

  const creds = {
    supplierId: store.supplierId,
    apiKey,
    apiSecret,
  };

  // Barkodları topla
  const barcodes = store.products.map((p) => p.barcode);
  const barcodeToProduct = new Map(store.products.map((p) => [p.barcode, p]));

  // Önceki snapshot'ları tek seferde çek (status karşılaştırması için)
  const previousSnapshots = await prisma.buyBoxSnapshot.findMany({
    where: { productId: { in: store.products.map((p) => p.id) } },
    orderBy: { checkedAt: 'desc' },
    distinct: ['productId'],
    select: { productId: true, buyboxOrder: true },
  });
  const prevOrderByProduct = new Map(
    previousSnapshots.map((s) => [s.productId, s.buyboxOrder])
  );

  // API çağrısı
  let buyboxInfo: TrendyolBuyboxInfo[];
  try {
    buyboxInfo = await fetchAllBuyboxInfo(creds, barcodes);
  } catch (err) {
    logger.error(`Trendyol buybox fetch hatası (storeId=${storeId}): ${(err as Error).message}`);
    throw err;
  }

  logger.info(
    `Buybox: ${buyboxInfo.length}/${barcodes.length} barkod için yanıt alındı (storeId=${storeId})`
  );

  let written = 0;
  let lostNotifications = 0;
  let wonNotifications = 0;

  for (const info of buyboxInfo) {
    const product = barcodeToProduct.get(info.barcode);
    if (!product) continue;

    try {
      await prisma.buyBoxSnapshot.create({
        data: {
          productId: product.id,
          buyboxOrder: info.buyboxOrder,
          buyboxPrice: info.buyboxPrice,
          hasMultipleSeller: info.hasMultipleSeller,
          secondBuyboxPrice: info.secondBuyboxPrice ?? null,
          thirdBuyboxPrice: info.thirdBuyboxPrice ?? null,
          ownPrice: product.salePrice,
        },
      });
      written += 1;
    } catch (err) {
      logger.warn(
        `Buybox snapshot yazılamadı (productId=${product.id}): ${(err as Error).message}`
      );
      continue;
    }

    // Durum değişikliği bildirimi
    const prevOrder = prevOrderByProduct.get(product.id);
    if (prevOrder === undefined) continue; // ilk snapshot, bildirim yok

    const wasWinning = prevOrder === 1;
    const isWinning = info.buyboxOrder === 1;

    if (wasWinning && !isWinning) {
      // BuyBox kaybedildi
      lostNotifications += 1;
      void createNotification({
        userId: store.userId,
        title: 'BuyBox Kaybedildi',
        message: `"${product.title}" ürününde BuyBox'ı kaybettiniz. Yeni BuyBox fiyatı: ₺${info.buyboxPrice}. Sıralamanız: ${info.buyboxOrder}.`,
        event: 'BUYBOX_LOST',
        type: 'WARNING',
        linkUrl: '/dashboard/buybox?state=losing',
        smsText: `BuyBox kaybedildi: ${product.title}. Yeni fiyat ₺${info.buyboxPrice}. TrendAnaliz`,
      }).catch((e) => logger.warn(`BUYBOX_LOST bildirimi: ${e.message}`));
    } else if (!wasWinning && isWinning) {
      // BuyBox kazanıldı
      wonNotifications += 1;
      void createNotification({
        userId: store.userId,
        title: 'BuyBox Kazanıldı',
        message: `"${product.title}" ürününde BuyBox'ı kazandınız. Tebrikler!`,
        event: 'BUYBOX_WON',
        type: 'SUCCESS',
        linkUrl: '/dashboard/buybox?state=winning',
      }).catch((e) => logger.warn(`BUYBOX_WON bildirimi: ${e.message}`));
    }
  }

  return {
    fetched: buyboxInfo.length,
    written,
    lostNotifications,
    wonNotifications,
  };
};

/**
 * Bir ürün için en son snapshot'ı döner (yoksa null).
 * Repricer ve UI bu fonksiyonu kullanır.
 */
export const getLatestSnapshot = (productId: string) =>
  prisma.buyBoxSnapshot.findFirst({
    where: { productId },
    orderBy: { checkedAt: 'desc' },
  });

/**
 * Son N gün için snapshot zaman serisi döner.
 * Grafik için kullanılır.
 */
export const getSnapshotSeries = (productId: string, days = 30) => {
  const since = new Date();
  since.setDate(since.getDate() - days);
  return prisma.buyBoxSnapshot.findMany({
    where: { productId, checkedAt: { gte: since } },
    orderBy: { checkedAt: 'asc' },
    select: {
      checkedAt: true,
      buyboxOrder: true,
      buyboxPrice: true,
      ownPrice: true,
      secondBuyboxPrice: true,
      thirdBuyboxPrice: true,
      hasMultipleSeller: true,
    },
  });
};
