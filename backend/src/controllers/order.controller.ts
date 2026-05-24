import { Response } from 'express';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { decrypt } from '../utils/crypto';
import { syncStoreOrders, getOrderSummary } from '../services/order.service';
import {
  updatePackageStatus,
  updateTrackingNumber,
  setInvoiceLink,
  markLinesUnsupplied,
} from '../services/trendyol.service';

/**
 * Order controller.
 *
 * Tüm endpoint'ler mağaza sahibine bağlıdır: kullanıcı yalnızca kendi
 * mağazasının siparişlerini görür.
 */

/**
 * Kullanıcının mağazasını bulur. Yoksa 404 fırlatır (response yazar).
 */
const requireUserStore = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
    return null;
  }
  const store = await prisma.trendyolStore.findFirst({ where: { userId } });
  if (!store) {
    res.status(404).json({
      success: false,
      message: 'Mağaza entegrasyonu bulunamadı. Önce Trendyol API anahtarlarınızı ekleyin.',
    });
    return null;
  }
  return store;
};

/**
 * BigInt alanları JSON-uyumlu hale getirir.
 */
const serializeOrder = (o: any) => ({
  ...o,
  shipmentPackageId: o.shipmentPackageId?.toString?.() ?? null,
  items: o.items?.map((i: any) => ({
    ...i,
    lineId: i.lineId?.toString?.() ?? null,
  })),
});

/**
 * GET /api/orders
 * Query: page=0, size=20, status?, search?, startDate?, endDate?
 */
export const listOrders = async (req: AuthenticatedRequest, res: Response) => {
  const store = await requireUserStore(req, res);
  if (!store) return;

  const page = Math.max(0, Number(req.query.page) || 0);
  const size = Math.min(100, Math.max(1, Number(req.query.size) || 20));
  const { status, search, startDate, endDate } = req.query;

  const where: Prisma.OrderWhereInput = { storeId: store.id };
  if (status && typeof status === 'string') {
    where.status = status as any;
  }
  if (search && typeof search === 'string') {
    where.OR = [
      { orderNumber: { contains: search, mode: 'insensitive' } },
      { customerFirstName: { contains: search, mode: 'insensitive' } },
      { customerLastName: { contains: search, mode: 'insensitive' } },
      { customerEmail: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (startDate || endDate) {
    where.orderDate = {};
    if (startDate) (where.orderDate as any).gte = new Date(String(startDate));
    if (endDate) (where.orderDate as any).lte = new Date(String(endDate));
  }

  try {
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        orderBy: { orderDate: 'desc' },
        skip: page * size,
        take: size,
        include: {
          items: {
            select: {
              id: true,
              barcode: true,
              productName: true,
              quantity: true,
              price: true,
              amount: true,
              productSize: true,
              productColor: true,
            },
          },
        },
      }),
      prisma.order.count({ where }),
    ]);

    return res.json({
      success: true,
      data: {
        items: items.map(serializeOrder),
        total,
        page,
        size,
        totalPages: Math.ceil(total / size),
      },
    });
  } catch (err) {
    logger.error(`listOrders hatası: ${(err as Error).message}`);
    return res.status(500).json({ success: false, message: 'Siparişler yüklenemedi.' });
  }
};

/**
 * GET /api/orders/:id
 */
export const getOrderDetail = async (req: AuthenticatedRequest, res: Response) => {
  const store = await requireUserStore(req, res);
  if (!store) return;

  try {
    const order = await prisma.order.findFirst({
      where: { id: req.params.id, storeId: store.id },
      include: { items: { include: { product: { select: { id: true, title: true } } } } },
    });
    if (!order) {
      return res.status(404).json({ success: false, message: 'Sipariş bulunamadı.' });
    }
    return res.json({ success: true, data: serializeOrder(order) });
  } catch (err) {
    logger.error(`getOrderDetail hatası: ${(err as Error).message}`);
    return res.status(500).json({ success: false, message: 'Sipariş yüklenemedi.' });
  }
};

/**
 * GET /api/orders/summary?days=30
 */
export const getSummary = async (req: AuthenticatedRequest, res: Response) => {
  const store = await requireUserStore(req, res);
  if (!store) return;

  const days = Math.min(180, Math.max(1, Number(req.query.days) || 30));
  try {
    const summary = await getOrderSummary(store.id, days);
    return res.json({ success: true, data: summary });
  } catch (err) {
    logger.error(`getSummary hatası: ${(err as Error).message}`);
    return res.status(500).json({ success: false, message: 'Özet hesaplanamadı.' });
  }
};

const syncSchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

/**
 * POST /api/orders/sync
 * Manuel sipariş senkronizasyonu tetikler.
 */
export const triggerSync = async (req: AuthenticatedRequest, res: Response) => {
  const store = await requireUserStore(req, res);
  if (!store) return;

  const parsed = syncSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: 'Geçersiz tarih.' });
  }
  const startDate = parsed.data.startDate
    ? new Date(parsed.data.startDate).getTime()
    : undefined;
  const endDate = parsed.data.endDate ? new Date(parsed.data.endDate).getTime() : undefined;

  try {
    const result = await syncStoreOrders(store.id, { startDate, endDate });
    return res.json({
      success: true,
      message: `Senkronizasyon tamamlandı: ${result.created} yeni, ${result.updated} güncellendi.`,
      data: result,
    });
  } catch (err) {
    const e = err as Error;
    logger.error(`triggerSync hatası: ${e.message}`);
    return res.status(500).json({
      success: false,
      message: `Senkronizasyon başarısız: ${e.message}`,
    });
  }
};

// =========================
// Order Write Actions
// =========================
//
// Bu endpoint'ler Trendyol API'sine yazma operasyonu yapar.
// Tüm yazımlar, ilgili sipariş kullanıcının mağazasına ait mi kontrolü
// yapıldıktan sonra çalıştırılır. Her başarılı yazımdan sonra DB'deki
// Order kaydı da güncellenir (next sync için tutarlılık).

/**
 * Sipariş kullanıcının mağazasına ait mi kontrolü + credentials hazırlığı.
 * Yardımcı: hem write controller'ları sade tutar hem yetkisiz erişimi
 * tek noktada engeller.
 */
const loadOrderWithCreds = async (
  req: AuthenticatedRequest,
  res: Response,
  orderId: string
) => {
  const store = await requireUserStore(req, res);
  if (!store) return null;
  const order = await prisma.order.findFirst({
    where: { id: orderId, storeId: store.id },
    include: { items: { select: { id: true, lineId: true, quantity: true } } },
  });
  if (!order) {
    res.status(404).json({ success: false, message: 'Sipariş bulunamadı.' });
    return null;
  }
  let apiKey: string;
  let apiSecret: string;
  try {
    apiKey = decrypt(store.apiKey);
    apiSecret = decrypt(store.apiSecret);
  } catch (err) {
    logger.error(`Credentials decrypt edilemedi: ${(err as Error).message}`);
    res.status(500).json({ success: false, message: 'Mağaza kimlik bilgileri okunamadı.' });
    return null;
  }
  return {
    store,
    order,
    creds: { supplierId: store.supplierId, apiKey, apiSecret },
  };
};

const trackingSchema = z.object({
  trackingNumber: z.string().min(3, 'Takip numarası en az 3 karakter olmalı.'),
  cargoProviderName: z.string().optional(),
});

/**
 * PUT /api/orders/:id/tracking
 * Trendyol'a kargo takip numarası yazar; DB'yi günceller.
 */
export const setOrderTracking = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const parsed = trackingSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Geçersiz takip bilgisi.',
      issues: parsed.error.issues,
    });
  }
  const ctx = await loadOrderWithCreds(req, res, req.params.id);
  if (!ctx) return;

  try {
    await updateTrackingNumber(ctx.creds, ctx.order.shipmentPackageId.toString(), {
      trackingNumber: parsed.data.trackingNumber,
      cargoProviderName: parsed.data.cargoProviderName,
    });
    await prisma.order.update({
      where: { id: ctx.order.id },
      data: {
        cargoTrackingNumber: parsed.data.trackingNumber,
        cargoProviderName: parsed.data.cargoProviderName ?? ctx.order.cargoProviderName,
      },
    });
    return res.json({ success: true, message: 'Kargo takip numarası güncellendi.' });
  } catch (err) {
    const e = err as Error;
    logger.error(`setOrderTracking hatası: ${e.message}`);
    return res.status(502).json({
      success: false,
      message: `Trendyol kargo güncelleme başarısız: ${e.message}`,
    });
  }
};

const statusSchema = z.object({
  status: z.enum(['Picking', 'Invoiced', 'Shipped']),
});

/**
 * PUT /api/orders/:id/status
 * Paket durumunu Picking/Invoiced/Shipped olarak işaretler.
 * Tüm kalemlerin tam quantity'si ile çağırır.
 */
export const setOrderStatus = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const parsed = statusSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Geçersiz durum. Picking, Invoiced veya Shipped olmalı.',
    });
  }
  const ctx = await loadOrderWithCreds(req, res, req.params.id);
  if (!ctx) return;

  const lines = ctx.order.items
    .filter((it) => it.lineId != null)
    .map((it) => ({ lineId: Number(it.lineId), quantity: it.quantity }));
  if (lines.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'Sipariş kalemi bulunamadı.',
    });
  }

  try {
    await updatePackageStatus(ctx.creds, ctx.order.shipmentPackageId.toString(), {
      lines,
      status: parsed.data.status,
    });
    return res.json({
      success: true,
      message: `Sipariş durumu "${parsed.data.status}" olarak güncellendi. Sonraki senkronizasyonda durum yansıyacak.`,
    });
  } catch (err) {
    const e = err as Error;
    logger.error(`setOrderStatus hatası: ${e.message}`);
    return res.status(502).json({
      success: false,
      message: `Trendyol durum güncelleme başarısız: ${e.message}`,
    });
  }
};

const invoiceSchema = z.object({
  invoiceLink: z.string().url('Geçerli bir URL girin.'),
  invoiceNumber: z.string().optional(),
  invoiceDateTime: z.number().optional(),
});

/**
 * PUT /api/orders/:id/invoice
 * Pakete elektronik fatura linki ekler.
 */
export const setOrderInvoice = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const parsed = invoiceSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Geçersiz fatura bilgisi.',
      issues: parsed.error.issues,
    });
  }
  const ctx = await loadOrderWithCreds(req, res, req.params.id);
  if (!ctx) return;

  try {
    await setInvoiceLink(ctx.creds, ctx.order.shipmentPackageId.toString(), parsed.data);
    return res.json({ success: true, message: 'Fatura linki Trendyol\'a iletildi.' });
  } catch (err) {
    const e = err as Error;
    logger.error(`setOrderInvoice hatası: ${e.message}`);
    return res.status(502).json({
      success: false,
      message: `Fatura linki gönderme başarısız: ${e.message}`,
    });
  }
};

const cancelSchema = z.object({
  reasonId: z.number().int().positive().optional(),
  lineIds: z.array(z.string()).optional(), // OrderItem.id (UUID). Yoksa tüm kalemler.
});

/**
 * POST /api/orders/:id/cancel
 * Belirtilen kalemleri (veya tümünü) "tedarik edilemedi" olarak işaretler.
 * reasonId: Trendyol iptal sebebi kodu (varsayılan 99 = diğer).
 */
export const cancelOrderLines = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const parsed = cancelSchema.safeParse(req.body || {});
  if (!parsed.success) {
    return res.status(400).json({
      success: false,
      message: 'Geçersiz iptal isteği.',
      issues: parsed.error.issues,
    });
  }
  const ctx = await loadOrderWithCreds(req, res, req.params.id);
  if (!ctx) return;

  const targetItems = parsed.data.lineIds
    ? ctx.order.items.filter((it) => parsed.data.lineIds!.includes(it.id))
    : ctx.order.items;

  const lines = targetItems
    .filter((it) => it.lineId != null)
    .map((it) => ({
      lineId: Number(it.lineId),
      quantity: it.quantity,
      reasonId: parsed.data.reasonId ?? 99,
    }));
  if (lines.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'İptal edilecek kalem bulunamadı.',
    });
  }

  try {
    await markLinesUnsupplied(ctx.creds, ctx.order.shipmentPackageId.toString(), {
      lines,
    });
    return res.json({
      success: true,
      message: `${lines.length} kalem iptal edildi. Sonraki senkronizasyonda yansıyacak.`,
    });
  } catch (err) {
    const e = err as Error;
    logger.error(`cancelOrderLines hatası: ${e.message}`);
    return res.status(502).json({
      success: false,
      message: `Sipariş iptali başarısız: ${e.message}`,
    });
  }
};
