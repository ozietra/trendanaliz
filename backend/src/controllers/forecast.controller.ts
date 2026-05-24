import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { OrderStatus } from '@prisma/client';

/**
 * Satış Tahmini
 *
 * Gerçek sipariş verisi üzerinden çalışır. Çekirdek algoritma:
 *
 *  1) Son 90 günlük "gerçekleşen sipariş" verisinden ürün başına günlük
 *     adet/ciro time-series üretilir. Cancelled/Returned/UnDelivered
 *     statüsleri dışlanır.
 *
 *  2) Hareketli ortalama (7g ve 30g) → düzleştirilmiş günlük baseline.
 *     30g varsa onu, yoksa 7g'yi temel alır; o da yoksa "veri yok".
 *
 *  3) DOW (gün-içi) düzeltmesi: Geçmiş 90 günde haftanın her günü için
 *     ortalama satışın genel ortalamaya oranı hesaplanır (DOW seasonality).
 *     Tahmin günleri için ilgili DOW katsayısı uygulanır.
 *
 *  4) Tükenme günü = mevcut stok / günlük baseline (yuvarlatılmış).
 *
 * Bu yaklaşım ML modeli kadar güçlü değildir ama gerçek veriden gelir,
 * deterministiktir ve büyük katalogda saniyenin altında çalışır.
 */

const MS_PER_DAY = 24 * 60 * 60 * 1000;

interface DailyBucket {
  units: number;
  revenue: number;
}

const HISTORY_DAYS = 90;
const COMPLETED_STATUSES: OrderStatus[] = [
  OrderStatus.Created,
  OrderStatus.Picking,
  OrderStatus.Invoiced,
  OrderStatus.Shipped,
  OrderStatus.Delivered,
];

/**
 * Mağazanın son 90 gün siparişlerini çekip ürün başına günlük satış
 * adet/ciro matrisi üretir.
 */
const buildHistoryMatrix = async (
  storeId: string
): Promise<{
  matrix: Map<string, DailyBucket[]>;
  globalDowSum: number[];
  globalDowDays: number[];
}> => {
  const now = new Date();
  const since = new Date(now.getTime() - HISTORY_DAYS * MS_PER_DAY);

  // Sipariş kalemlerini bir defada çekiyoruz; her ürün için günlük bucket'a yazacağız.
  const items = await prisma.orderItem.findMany({
    where: {
      productId: { not: null },
      order: {
        storeId,
        orderDate: { gte: since },
        status: { in: COMPLETED_STATUSES },
      },
    },
    select: {
      productId: true,
      quantity: true,
      amount: true,
      order: { select: { orderDate: true } },
    },
  });

  const matrix = new Map<string, DailyBucket[]>();
  // Global DOW istatistikleri (her ürün için ayrı tutmak veri seyrekliğinde
  // kötü sonuç verir, bu yüzden mağaza genelinde tek bir DOW vektörü kullanıyoruz)
  const globalDowSum = new Array(7).fill(0) as number[];
  const globalDowDays = new Array(7).fill(0) as number[];

  for (const it of items) {
    if (!it.productId) continue;
    const ordered = it.order.orderDate;
    const daysAgo = Math.floor((now.getTime() - ordered.getTime()) / MS_PER_DAY);
    if (daysAgo < 0 || daysAgo >= HISTORY_DAYS) continue;

    let row = matrix.get(it.productId);
    if (!row) {
      row = new Array(HISTORY_DAYS).fill(null).map(() => ({ units: 0, revenue: 0 }));
      matrix.set(it.productId, row);
    }
    row[daysAgo].units += it.quantity;
    row[daysAgo].revenue += Number(it.amount);

    const dow = ordered.getDay();
    globalDowSum[dow] += it.quantity;
  }

  // Her DOW'un kaç farklı gün gözlemiyle temsil edildiğini hesapla
  for (let d = 0; d < HISTORY_DAYS; d++) {
    const dt = new Date(now.getTime() - d * MS_PER_DAY);
    globalDowDays[dt.getDay()] += 1;
  }

  return { matrix, globalDowSum, globalDowDays };
};

/**
 * Bir time-series için hareketli ortalama döner.
 */
const movingAverage = (series: number[], window: number): number => {
  const w = Math.min(window, series.length);
  if (w === 0) return 0;
  let sum = 0;
  for (let i = 0; i < w; i++) sum += series[i];
  return sum / w;
};

/**
 * Global DOW seasonality vektörü → her gün için çarpan (ortalama=1.0)
 */
const computeDowFactor = (
  globalDowSum: number[],
  globalDowDays: number[]
): number[] => {
  const perDow = globalDowSum.map((sum, i) =>
    globalDowDays[i] > 0 ? sum / globalDowDays[i] : 0
  );
  const totalAvg = perDow.reduce((a, b) => a + b, 0) / 7;
  if (totalAvg === 0) return new Array(7).fill(1);
  return perDow.map((v) => (v / totalAvg) || 1);
};

/**
 * Bir ürün için gelecek N gün için tahmin üretir.
 * baseline: günlük ortalama adet
 * dowFactor: 7'lik DOW çarpan vektörü
 */
const projectDays = (
  baseline: number,
  dowFactor: number[],
  days: number,
  startDate: Date
): { daily: number[]; totalUnits: number } => {
  const out: number[] = [];
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(startDate.getTime() + i * MS_PER_DAY);
    const f = dowFactor[d.getDay()] || 1;
    const v = Math.max(0, Math.round(baseline * f));
    out.push(v);
    total += v;
  }
  return { daily: out, totalUnits: total };
};

/**
 * GET /api/forecast/products
 * Mağazanın tüm ürünleri için 7g ve 30g satış tahmini.
 */
export const getProductForecasts = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });
    if (!store) {
      return res.json({ success: true, data: [], summary: emptySummary(), meta: { dataSource: 'NONE' } });
    }

    const [products, history] = await Promise.all([
      prisma.product.findMany({
        where: { storeId: store.id },
        select: {
          id: true,
          title: true,
          barcode: true,
          salePrice: true,
          stockCount: true,
        },
      }),
      buildHistoryMatrix(store.id),
    ]);

    const dowFactor = computeDowFactor(history.globalDowSum, history.globalDowDays);
    const tomorrow = new Date();
    tomorrow.setHours(0, 0, 0, 0);

    const items = products.map((p) => {
      const series = history.matrix.get(p.id);
      const dailySeries = series ? series.map((d) => d.units) : new Array(HISTORY_DAYS).fill(0);

      const avg7 = movingAverage(dailySeries.slice(0, 7), 7);
      const avg30 = movingAverage(dailySeries.slice(0, 30), 30);
      // 30 günlük varsa onu temel al; az veri varsa 7g; o da 0 ise 0.
      const baseline = avg30 > 0 ? avg30 : avg7;

      const w = projectDays(baseline, dowFactor, 7, tomorrow);
      const m = projectDays(baseline, dowFactor, 30, tomorrow);
      const price = Number(p.salePrice);

      const stockoutDays = baseline > 0 ? Math.floor(p.stockCount / baseline) : 999;
      const totalSold30 = dailySeries.slice(0, 30).reduce((s, v) => s + v, 0);
      const totalSold7 = dailySeries.slice(0, 7).reduce((s, v) => s + v, 0);

      return {
        productId: p.id,
        title: p.title,
        barcode: p.barcode,
        currentStock: p.stockCount,
        salePrice: price,
        dailyAvg: Math.round(baseline * 100) / 100,
        sold7: totalSold7,
        sold30: totalSold30,
        forecast7: {
          units: w.totalUnits,
          revenue: Math.round(w.totalUnits * price * 100) / 100,
          daily: w.daily,
        },
        forecast30: {
          units: m.totalUnits,
          revenue: Math.round(m.totalUnits * price * 100) / 100,
          daily: m.daily,
        },
        stockoutDays,
        warning:
          stockoutDays < 7
            ? `Stok ${stockoutDays} gün içinde tükenebilir`
            : stockoutDays < 14
            ? 'Stok takvimi dar, takviye planlayın'
            : null,
      };
    });

    items.sort((a, b) => a.stockoutDays - b.stockoutDays);

    const summary = {
      totalUnits7: items.reduce((s, i) => s + i.forecast7.units, 0),
      totalRevenue7: items.reduce((s, i) => s + i.forecast7.revenue, 0),
      totalUnits30: items.reduce((s, i) => s + i.forecast30.units, 0),
      totalRevenue30: items.reduce((s, i) => s + i.forecast30.revenue, 0),
      stockoutRisk: items.filter((i) => i.stockoutDays < 7).length,
      productCount: items.length,
    };

    return res.json({
      success: true,
      data: items,
      summary,
      meta: {
        dataSource: history.matrix.size > 0 ? 'ORDERS' : 'NO_HISTORY',
        historyDays: HISTORY_DAYS,
        productsWithHistory: history.matrix.size,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Forecast hatası: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Tahmin oluşturulamadı.' });
  }
};

function emptySummary() {
  return {
    totalUnits7: 0,
    totalRevenue7: 0,
    totalUnits30: 0,
    totalRevenue30: 0,
    stockoutRisk: 0,
    productCount: 0,
  };
}
