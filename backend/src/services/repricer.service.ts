import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { RuleType, PriceSource } from '@prisma/client';
import * as trendyol from './trendyol.service';
import { decrypt } from '../utils/crypto';

/**
 * Repricer Servisi
 *
 * VERİ KAYNAĞI: Repricer kararlarını şu sıralamayla alır:
 *  1) `BuyBoxSnapshot` (resmi Trendyol Buybox Check Service çıktısı)
 *     — buyboxPrice ve secondBuyboxPrice burada saklanır
 *  2) Snapshot yoksa, kullanıcı manuel olarak `Competitor` ekleyip
 *     fiyat girdiyse o kullanılır (legacy/opsiyonel)
 *  3) Hiçbiri yoksa, fiyat = maxPrice (kâr maksimizasyonu)
 *
 * SİMÜLASYON: Eski Math.random ile rakip fiyatı dalgalandıran kod KALDIRILDI.
 * Eğer geliştirme ortamında sahte rakip lazımsa SIMULATE_COMPETITORS=1 ile
 * `competitor.controller.ts:addCompetitor` üzerinden manuel ekleyin.
 *
 * CANLI PUSH: TRENDYOL_LIVE_PUSH=1 iken hesaplanan fiyatlar Trendyol'a
 * gerçek API ile gönderilir; aksi halde sadece DB güncellenir.
 */

const LIVE_PUSH_ENABLED = process.env.TRENDYOL_LIVE_PUSH === '1';

// Bellek içi (in-memory) dairesel log havuzu — UI'daki "Canlı Konsol" için.
interface SyncLog {
  timestamp: string;
  message: string;
}
const storeLogs: Record<string, SyncLog[]> = {};

export function addStoreLog(storeId: string, message: string) {
  const timestamp = new Date().toLocaleTimeString('tr-TR');
  const logEntry = { timestamp, message: `[${timestamp}] ${message}` };
  if (!storeLogs[storeId]) storeLogs[storeId] = [];
  storeLogs[storeId].push(logEntry);
  if (storeLogs[storeId].length > 50) storeLogs[storeId].shift();
  logger.info(`Store ${storeId} Sync Log: ${message}`);
}

export function getStoreLogs(storeId: string): string[] {
  if (!storeLogs[storeId] || storeLogs[storeId].length === 0) {
    storeLogs[storeId] = [
      {
        timestamp: '00:00:00',
        message: '[--:--:--] Henüz fiyat senkronizasyonu çalıştırılmadı. Bekleniyor...',
      },
    ];
  }
  return storeLogs[storeId].map((l) => l.message);
}

/**
 * Bir ürün için bilinen "rakip taban fiyatı" değerini hesaplar.
 * Öncelik: BuyBoxSnapshot.buyboxPrice → manuel competitor.currentPrice min
 * Dönen değer null ise rakip yok demektir.
 */
const resolveCompetitorReference = async (
  productId: string
): Promise<{ price: number; source: 'BUYBOX' | 'MANUAL' } | null> => {
  // Önce en güncel BuyBox snapshot
  const snap = await prisma.buyBoxSnapshot.findFirst({
    where: { productId },
    orderBy: { checkedAt: 'desc' },
    select: { buyboxPrice: true, hasMultipleSeller: true, buyboxOrder: true },
  });
  if (snap && snap.hasMultipleSeller) {
    return { price: Number(snap.buyboxPrice), source: 'BUYBOX' };
  }
  // Manuel competitor fallback
  const competitors = await prisma.competitor.findMany({
    where: { productId },
    select: { currentPrice: true },
  });
  if (competitors.length > 0) {
    const lowest = competitors.reduce(
      (min, c) => (Number(c.currentPrice) < min ? Number(c.currentPrice) : min),
      Number.POSITIVE_INFINITY
    );
    if (Number.isFinite(lowest)) {
      return { price: lowest, source: 'MANUAL' };
    }
  }
  return null;
};

export class RepricerService {
  /**
   * Bir mağaza için fiyatlandırma döngüsünü çalıştırır.
   */
  static async runForStore(storeId: string): Promise<void> {
    try {
      const store = await prisma.trendyolStore.findUnique({
        where: { id: storeId },
        include: {
          products: {
            include: {
              priceRules: { where: { isActive: true } },
            },
          },
        },
      });

      if (!store || !store.isActive) return;

      addStoreLog(storeId, 'Fiyat kontrolleri başlatılıyor...');

      let totalUpdated = 0;
      let totalChecked = 0;
      const pushQueue: Array<{ barcode: string; salePrice: number; quantity: number }> = [];

      for (const product of store.products) {
        totalChecked++;

        const activeRule = product.priceRules[0];
        if (!activeRule || !activeRule.isActive) continue;

        const minPrice = Number(activeRule.minPrice);
        const maxPrice = Number(activeRule.maxPrice);
        const currentPrice = Number(product.salePrice);

        const ref = await resolveCompetitorReference(product.id);

        let calculatedPrice = currentPrice;

        if (!ref) {
          // Rakip yok → kâr maksimizasyonu
          calculatedPrice = maxPrice;
        } else {
          const rivalPrice = ref.price;
          switch (activeRule.ruleType) {
            case RuleType.MATCH_LOWEST:
              calculatedPrice = rivalPrice;
              break;
            case RuleType.BEAT_BY_AMOUNT: {
              const beat = Number(activeRule.targetValue) || 0.5;
              calculatedPrice = rivalPrice - beat;
              break;
            }
            case RuleType.BEAT_BY_PERCENT: {
              const beatPct = Number(activeRule.targetValue) || 1;
              calculatedPrice = rivalPrice * (1 - beatPct / 100);
              break;
            }
            case RuleType.FIXED_MARGIN: {
              const margin = Number(activeRule.targetValue) || 10;
              calculatedPrice = minPrice + margin;
              break;
            }
            default:
              calculatedPrice = rivalPrice;
          }
        }

        // Min/Max limit + 2 ondalık
        calculatedPrice = parseFloat(calculatedPrice.toFixed(2));
        let isFloorTriggered = false;
        if (calculatedPrice < minPrice) {
          calculatedPrice = minPrice;
          isFloorTriggered = true;
        }
        if (calculatedPrice > maxPrice) {
          calculatedPrice = maxPrice;
        }

        if (calculatedPrice === currentPrice) continue;

        // DB'de güncelle
        await prisma.product.update({
          where: { id: product.id },
          data: { salePrice: calculatedPrice, updatedAt: new Date() },
        });
        await prisma.priceHistory.create({
          data: {
            productId: product.id,
            price: calculatedPrice,
            source: PriceSource.OWN,
            recordedAt: new Date(),
          },
        });
        await prisma.priceRule.update({
          where: { id: activeRule.id },
          data: { lastTriggeredAt: new Date() },
        });

        totalUpdated++;
        pushQueue.push({
          barcode: product.barcode,
          salePrice: calculatedPrice,
          quantity: product.stockCount,
        });

        const direction = calculatedPrice < currentPrice ? 'düşürüldü' : 'yükseltildi';
        const refLabel = ref ? (ref.source === 'BUYBOX' ? 'BuyBox' : 'manuel rakip') : 'rakipsiz';
        const triggerMsg = isFloorTriggered
          ? `UYARI: "${product.title}" için hesaplanan fiyat taban sınırın altında kaldı (₺${minPrice}'a kilitlendi).`
          : `GÜNCELLEME: "${product.title}" fiyatı ${refLabel} verisine göre ₺${calculatedPrice} olarak ${direction}.`;

        addStoreLog(storeId, triggerMsg);

        // NOT: BuyBox kaybedildi/kazanıldı bildirimleri buybox.service.ts içinde
        // gerçek snapshot karşılaştırması ile gönderiliyor. Burada PRICE_ALERT
        // sadece taban sınırı tetiklendiğinde gönderiliyor.
      }

      // Canlı Trendyol push
      if (LIVE_PUSH_ENABLED && pushQueue.length > 0) {
        try {
          const apiKey = decrypt(store.apiKey);
          const apiSecret = decrypt(store.apiSecret);
          const batches = await trendyol.bulkUpdatePriceInventory(
            { supplierId: store.supplierId, apiKey, apiSecret },
            pushQueue
          );
          addStoreLog(
            storeId,
            `Trendyol'a ${pushQueue.length} fiyat güncellemesi gönderildi (batchCount=${batches.length}).`
          );
        } catch (pushErr) {
          const e = pushErr as Error;
          addStoreLog(storeId, `UYARI: Canlı fiyat push başarısız - ${e.message}`);
          logger.warn(`Repricer canlı push başarısız (store=${storeId}): ${e.message}`);
        }
      } else if (pushQueue.length > 0) {
        addStoreLog(
          storeId,
          `${pushQueue.length} fiyat güncellemesi yerel kayıtlandı. (TRENDYOL_LIVE_PUSH=1 değil; canlıya gönderim yapılmadı.)`
        );
      }

      await prisma.trendyolStore.update({
        where: { id: storeId },
        data: { lastSyncAt: new Date() },
      });

      addStoreLog(
        storeId,
        `Fiyat analizi tamamlandı. ${totalChecked} ürün tarandı, ${totalUpdated} üründe fiyat değişti.`
      );
    } catch (error: unknown) {
      const err = error as Error;
      logger.error(`Repricer Store ${storeId} döngü hatası: ${err.message}`);
      addStoreLog(storeId, `HATA: Fiyat güncellenirken bir sorun oluştu - ${err.message}`);
    }
  }
}
