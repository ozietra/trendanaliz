import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { syncBuyboxForStore, getSnapshotSeries } from '../services/buybox.service';

/**
 * GET /api/buybox
 * Kullanıcının tüm mağazalarındaki ürünler için en son BuyBox snapshot listesi.
 * Her ürün için tek satır: ürün + son snapshot (yoksa null).
 *
 * Query parametreleri:
 *   - storeId  (opsiyonel) — belirli bir mağazayı filtrele
 *   - state    (opsiyonel) — winning | losing | no-rivals (filtreleme)
 *   - search   (opsiyonel) — ürün başlığı/barkod
 *   - page, size (sayfalama, default 0/30)
 */
export const listBuyboxStatus = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  const storeId = (req.query.storeId as string) || undefined;
  const state = (req.query.state as string) || undefined;
  const search = ((req.query.search as string) || '').trim();
  const page = Math.max(0, parseInt((req.query.page as string) || '0', 10));
  const size = Math.min(100, Math.max(1, parseInt((req.query.size as string) || '30', 10)));

  try {
    // Kullanıcının mağazaları
    const stores = await prisma.trendyolStore.findMany({
      where: { userId, ...(storeId ? { id: storeId } : {}) },
      select: { id: true, storeName: true },
    });
    const storeIds = stores.map((s) => s.id);
    if (storeIds.length === 0) {
      return res.json({
        success: true,
        data: { items: [], total: 0, page, size, totalPages: 0 },
      });
    }

    const where: any = { storeId: { in: storeIds } };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
      ];
    }

    // Önce tüm ürünlerin son snapshot'larını çek (aggregate stats için)
    const allProducts = await prisma.product.findMany({
      where: { storeId: { in: storeIds } },
      select: {
        id: true,
        buyboxSnapshots: {
          orderBy: { checkedAt: 'desc' as const },
          take: 1,
          select: { buyboxOrder: true, hasMultipleSeller: true },
        },
      },
    });

    const aggregateStats = { winning: 0, losing: 0, noRivals: 0, unknown: 0, totalProducts: allProducts.length };
    // BuyBox eligible = snapshot'ı olan VE birden fazla satıcısı olan ürünler
    const eligibleProductIds: string[] = [];
    for (const p of allProducts) {
      const s = p.buyboxSnapshots[0];
      if (!s) { aggregateStats.unknown++; continue; }
      if (!s.hasMultipleSeller) { aggregateStats.noRivals++; continue; }
      // hasMultipleSeller = true → BuyBox rekabeti var
      if (s.buyboxOrder === 1) aggregateStats.winning++;
      else aggregateStats.losing++;
      eligibleProductIds.push(p.id);
    }

    // Sadece BuyBox rekabeti olan ürünleri sayfalı çek
    const eligibleWhere: any = { id: { in: eligibleProductIds } };
    if (search) {
      eligibleWhere.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { barcode: { contains: search } },
      ];
    }

    const [products, eligibleTotal] = await prisma.$transaction([
      prisma.product.findMany({
        where: eligibleWhere,
        orderBy: { updatedAt: 'desc' },
        skip: page * size,
        take: size,
        select: {
          id: true,
          barcode: true,
          title: true,
          salePrice: true,
          stockCount: true,
          imageUrl: true,
          storeId: true,
          buyboxSnapshots: {
            orderBy: { checkedAt: 'desc' },
            take: 1,
            select: {
              buyboxOrder: true,
              buyboxPrice: true,
              hasMultipleSeller: true,
              secondBuyboxPrice: true,
              thirdBuyboxPrice: true,
              checkedAt: true,
            },
          },
        },
      }),
      prisma.product.count({ where: eligibleWhere }),
    ]);

    const storeMap = new Map(stores.map((s) => [s.id, s.storeName]));

    let items = products.map((p) => {
      const snap = p.buyboxSnapshots[0] || null;
      let computedState: 'winning' | 'losing' | 'no-rivals' | 'unknown' = 'unknown';
      if (snap) {
        if (!snap.hasMultipleSeller) computedState = 'no-rivals';
        else if (snap.buyboxOrder === 1) computedState = 'winning';
        else computedState = 'losing';
      }
      return {
        productId: p.id,
        barcode: p.barcode,
        title: p.title,
        imageUrl: p.imageUrl,
        ownPrice: p.salePrice,
        stockCount: p.stockCount,
        storeId: p.storeId,
        storeName: storeMap.get(p.storeId) || '',
        snapshot: snap,
        state: computedState,
      };
    });

    if (state && ['winning', 'losing', 'no-rivals'].includes(state)) {
      items = items.filter((it) => it.state === state);
    }

    return res.json({
      success: true,
      data: {
        items,
        total: eligibleTotal,
        page,
        size,
        totalPages: Math.ceil(eligibleTotal / size),
        stats: aggregateStats,
      },
    });
  } catch (err) {
    logger.error(`listBuyboxStatus hatası: ${(err as Error).message}`);
    return res
      .status(500)
      .json({ success: false, message: 'BuyBox durumu yüklenemedi.' });
  }
};

/**
 * GET /api/buybox/:productId/series?days=30
 * Bir ürünün son N gün için snapshot zaman serisi.
 */
export const getBuyboxProductSeries = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }
  const { productId } = req.params;
  const days = Math.min(180, Math.max(1, parseInt((req.query.days as string) || '30', 10)));

  try {
    // Yetki kontrolü: ürün kullanıcının mağazasına ait mi?
    const product = await prisma.product.findFirst({
      where: { id: productId, store: { userId } },
      select: { id: true, title: true, barcode: true },
    });
    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });
    }

    const series = await getSnapshotSeries(productId, days);
    return res.json({
      success: true,
      data: { product, series },
    });
  } catch (err) {
    logger.error(`getBuyboxProductSeries hatası: ${(err as Error).message}`);
    return res
      .status(500)
      .json({ success: false, message: 'BuyBox geçmişi yüklenemedi.' });
  }
};

/**
 * POST /api/buybox/sync
 * Kullanıcının tüm aktif mağazaları için manuel BuyBox tarama tetikler.
 */
export const triggerBuyboxSync = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }
  try {
    const stores = await prisma.trendyolStore.findMany({
      where: { userId, isActive: true },
      select: { id: true, storeName: true },
    });
    if (stores.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Aktif Trendyol mağazası bulunamadı.',
      });
    }

    const results: Array<Record<string, unknown>> = [];
    for (const s of stores) {
      try {
        const r = await syncBuyboxForStore(s.id);
        results.push({ storeId: s.id, storeName: s.storeName, ...r });
      } catch (err) {
        results.push({
          storeId: s.id,
          storeName: s.storeName,
          error: (err as Error).message,
        });
      }
    }

    return res.json({
      success: true,
      message: 'BuyBox senkronizasyonu tamamlandı.',
      data: { stores: results },
    });
  } catch (err) {
    logger.error(`triggerBuyboxSync hatası: ${(err as Error).message}`);
    return res
      .status(500)
      .json({ success: false, message: 'BuyBox senkronizasyonu başarısız.' });
  }
};
