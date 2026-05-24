import { Prisma, OrderStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { decrypt } from '../utils/crypto';
import * as trendyol from './trendyol.service';
import type { TrendyolOrder, TrendyolOrderLine } from './trendyol.service';
import { createNotification } from './notification.service';

/**
 * Sipariş servisi.
 *
 * Sorumluluklar:
 *  - Trendyol'dan sipariş çekme (tarih aralığı)
 *  - DB'ye upsert (idempotent — shipmentPackageId benzersiz)
 *  - Mevcut platform ürünlerimizle eşleştirme (barcode ile)
 *  - Yeni sipariş geldiğinde kullanıcıya in-app/SSE bildirim
 *  - Sipariş özet/istatistik fonksiyonları
 */

const TRENDYOL_TO_ENUM: Record<string, OrderStatus> = {
  Created: OrderStatus.Created,
  Picking: OrderStatus.Picking,
  Invoiced: OrderStatus.Invoiced,
  Shipped: OrderStatus.Shipped,
  ShippedToCollectionPoint: OrderStatus.ShippedToCollectionPoint,
  AtCollectionPoint: OrderStatus.AtCollectionPoint,
  Delivered: OrderStatus.Delivered,
  UnDelivered: OrderStatus.UnDelivered,
  UnDeliveredAndReturned: OrderStatus.UnDeliveredAndReturned,
  Cancelled: OrderStatus.Cancelled,
  Returned: OrderStatus.Returned,
  Awaiting: OrderStatus.Awaiting,
  UnSupplied: OrderStatus.UnSupplied,
  UnPacked: OrderStatus.UnPacked,
  Repack: OrderStatus.Repack,
};

const mapStatus = (s: string): OrderStatus => TRENDYOL_TO_ENUM[s] ?? OrderStatus.Created;

/**
 * Bir mağazanın siparişlerini Trendyol'dan çekip DB'ye yazar.
 * Varsayılan tarih aralığı son 14 gün (Trendyol limit).
 *
 * @returns {created, updated, totalFetched}
 */
export const syncStoreOrders = async (
  storeId: string,
  options: { startDate?: number; endDate?: number; notifyUser?: boolean } = {}
): Promise<{ created: number; updated: number; totalFetched: number }> => {
  const store = await prisma.trendyolStore.findUnique({ where: { id: storeId } });
  if (!store || !store.isActive) {
    return { created: 0, updated: 0, totalFetched: 0 };
  }

  const endDate = options.endDate ?? Date.now();
  const startDate = options.startDate ?? endDate - 14 * 24 * 60 * 60 * 1000;

  const apiKey = decrypt(store.apiKey);
  const apiSecret = decrypt(store.apiSecret);

  let trendyolOrders: TrendyolOrder[] = [];
  try {
    trendyolOrders = await trendyol.fetchAllOrders(
      { supplierId: store.supplierId, apiKey, apiSecret },
      { startDate, endDate }
    );
  } catch (err) {
    logger.error(`Sipariş çekme hatası (store=${storeId}): ${(err as Error).message}`);
    throw err;
  }

  let created = 0;
  let updated = 0;
  const newOrderIdsForNotification: Array<{ id: string; orderNumber: string; customer: string }> = [];

  for (const o of trendyolOrders) {
    try {
      const existing = await prisma.order.findUnique({
        where: { shipmentPackageId: BigInt(o.shipmentPackageId) },
        select: { id: true, status: true },
      });

      const data = await buildOrderUpsertData(storeId, o);

      if (existing) {
        await prisma.order.update({
          where: { id: existing.id },
          data: {
            status: data.status,
            cargoTrackingNumber: data.cargoTrackingNumber,
            cargoProviderName: data.cargoProviderName,
            cargoTrackingLink: data.cargoTrackingLink,
            estimatedDeliveryStart: data.estimatedDeliveryStart,
            estimatedDeliveryEnd: data.estimatedDeliveryEnd,
            lastSyncedAt: new Date(),
          },
        });
        updated++;
      } else {
        const createdOrder = await prisma.order.create({ data, select: { id: true } });
        created++;
        newOrderIdsForNotification.push({
          id: createdOrder.id,
          orderNumber: o.orderNumber,
          customer: `${o.customerFirstName ?? ''} ${o.customerLastName ?? ''}`.trim() || 'Müşteri',
        });
      }
    } catch (err) {
      logger.error(
        `Sipariş upsert hatası (shipmentPackageId=${o.shipmentPackageId}): ${(err as Error).message}`
      );
    }
  }

  // Yeni sipariş bildirimleri (varsa)
  if (options.notifyUser !== false && newOrderIdsForNotification.length > 0) {
    try {
      const ownerId = store.userId;
      if (newOrderIdsForNotification.length === 1) {
        const o = newOrderIdsForNotification[0];
        await createNotification({
          userId: ownerId,
          title: 'Yeni Sipariş',
          message: `${o.customer} tarafından ${o.orderNumber} numaralı yeni bir sipariş alındı.`,
          type: 'INFO',
          event: 'NEW_ORDER',
          linkUrl: `/dashboard/siparisler/${o.id}`,
          smsText: `Yeni sipariş: ${o.orderNumber} (${o.customer}). TrendAnaliz`,
        });
      } else {
        await createNotification({
          userId: ownerId,
          title: 'Yeni Siparişler',
          message: `${newOrderIdsForNotification.length} adet yeni sipariş alındı.`,
          type: 'INFO',
          event: 'NEW_ORDER',
          linkUrl: '/dashboard/siparisler',
          smsText: `${newOrderIdsForNotification.length} yeni sipariş alındı. TrendAnaliz`,
        });
      }
    } catch (err) {
      logger.warn(`Sipariş bildirimi gönderilemedi: ${(err as Error).message}`);
    }
  }

  await prisma.trendyolStore.update({
    where: { id: storeId },
    data: { lastSyncAt: new Date() },
  });

  return { created, updated, totalFetched: trendyolOrders.length };
};

/**
 * Trendyol sipariş objesini DB upsert formatına dönüştürür.
 * Satırları (lines) da paralel oluşturur.
 */
const buildOrderUpsertData = async (
  storeId: string,
  o: TrendyolOrder
): Promise<Prisma.OrderCreateInput> => {
  // Barcode → ürün id eşlemesi (sadece bu mağazaya ait)
  const barcodes = Array.from(new Set(o.lines.map((l) => l.barcode).filter(Boolean)));
  const matchedProducts = barcodes.length
    ? await prisma.product.findMany({
        where: { storeId, barcode: { in: barcodes } },
        select: { id: true, barcode: true },
      })
    : [];
  const productByBarcode = new Map(matchedProducts.map((p) => [p.barcode, p.id]));

  return {
    store: { connect: { id: storeId } },
    shipmentPackageId: BigInt(o.shipmentPackageId),
    orderNumber: o.orderNumber,
    grossAmount: new Prisma.Decimal(o.grossAmount ?? 0),
    totalDiscount: new Prisma.Decimal(o.totalDiscount ?? 0),
    totalPrice: new Prisma.Decimal(o.totalPrice ?? 0),
    currencyCode: o.currencyCode ?? 'TRY',
    status: mapStatus(o.status),
    cargoTrackingNumber: o.cargoTrackingNumber ? String(o.cargoTrackingNumber) : null,
    cargoProviderName: o.cargoProviderName ?? null,
    cargoTrackingLink: o.cargoTrackingLink ?? null,
    customerFirstName: o.customerFirstName ?? null,
    customerLastName: o.customerLastName ?? null,
    customerEmail: o.customerEmail ?? null,
    tcIdentityNumber: o.tcIdentityNumber ?? null,
    taxNumber: o.taxNumber ?? null,
    invoiceAddress: (o.invoiceAddress ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    shipmentAddress: (o.shipmentAddress ?? Prisma.JsonNull) as Prisma.InputJsonValue,
    orderDate: new Date(o.orderDate),
    estimatedDeliveryStart: o.estimatedDeliveryStartDate
      ? new Date(o.estimatedDeliveryStartDate)
      : null,
    estimatedDeliveryEnd: o.estimatedDeliveryEndDate
      ? new Date(o.estimatedDeliveryEndDate)
      : null,
    fastDelivery: !!o.fastDelivery,
    deliveryType: o.deliveryType ?? null,
    items: {
      create: o.lines.map((l: TrendyolOrderLine) => ({
        ...(productByBarcode.get(l.barcode)
          ? { product: { connect: { id: productByBarcode.get(l.barcode)! } } }
          : {}),
        lineId: l.lineId ? BigInt(l.lineId) : null,
        barcode: l.barcode,
        productName: l.productName,
        merchantSku: l.merchantSku ?? null,
        productSize: l.productSize ?? null,
        productColor: l.productColor ?? null,
        quantity: l.quantity,
        price: new Prisma.Decimal(l.price ?? 0),
        amount: new Prisma.Decimal(l.amount ?? (l.price ?? 0) * l.quantity),
        discount: new Prisma.Decimal(l.discount ?? 0),
        vatBaseAmount: l.vatBaseAmount != null ? new Prisma.Decimal(l.vatBaseAmount) : null,
        lineItemStatus: l.orderLineItemStatusName ?? null,
      })),
    },
  };
};

/**
 * Mağaza için sipariş özet istatistiklerini döner.
 */
export const getOrderSummary = async (
  storeId: string,
  days = 30
): Promise<{
  totalCount: number;
  totalRevenue: number;
  byStatus: Record<string, number>;
  recentDays: Array<{ date: string; count: number; revenue: number }>;
}> => {
  const since = new Date();
  since.setDate(since.getDate() - days);

  const orders = await prisma.order.findMany({
    where: { storeId, orderDate: { gte: since } },
    select: { status: true, totalPrice: true, orderDate: true },
  });

  const byStatus: Record<string, number> = {};
  let totalRevenue = 0;
  const dayMap = new Map<string, { count: number; revenue: number }>();

  for (const o of orders) {
    byStatus[o.status] = (byStatus[o.status] || 0) + 1;
    // İptal/iade satışları gelir kabul etme
    if (o.status !== OrderStatus.Cancelled && o.status !== OrderStatus.Returned) {
      totalRevenue += Number(o.totalPrice);
    }
    const key = o.orderDate.toISOString().slice(0, 10);
    const day = dayMap.get(key) ?? { count: 0, revenue: 0 };
    day.count++;
    day.revenue += Number(o.totalPrice);
    dayMap.set(key, day);
  }

  const recentDays = Array.from(dayMap.entries())
    .map(([date, v]) => ({ date, count: v.count, revenue: Math.round(v.revenue * 100) / 100 }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return {
    totalCount: orders.length,
    totalRevenue: Math.round(totalRevenue * 100) / 100,
    byStatus,
    recentDays,
  };
};
