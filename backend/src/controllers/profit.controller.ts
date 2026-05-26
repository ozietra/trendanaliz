import { Response } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from '../middleware/auth.middleware';

/**
 * Kar-Zarar Raporu
 *
 * Her ürün için:
 *   Net Gelir (KDV'siz) = salePrice / (1 + vatRate/100)
 *   Komisyon Tutarı     = Net Gelir × (komisyonOranı / 100)
 *   Net Kar             = Net Gelir - Komisyon Tutarı - shippingCost - costPrice
 *   Kar Marjı %         = (Net Kar / salePrice) × 100
 *
 * Komisyon oranı: ürünün categoryName'i ile CommissionRate tablosundan eşleştirilir.
 * Eşleşme yoksa hasCommission=false, kar hesabı yapılamaz.
 */
export const getProfitReport = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });
    if (!store) {
      return res.json({ success: true, data: { items: [], summary: null } });
    }

    // Ürünleri ve komisyon oranlarını paralel çek
    const [products, commissions] = await Promise.all([
      prisma.product.findMany({
        where: { storeId: store.id },
        select: {
          id: true,
          barcode: true,
          title: true,
          categoryName: true,
          salePrice: true,
          listPrice: true,
          vatRate: true,
          costPrice: true,
          shippingCost: true,
          imageUrl: true,
          stockCount: true,
        } as any,
        orderBy: { title: 'asc' },
      }) as Promise<any[]>,
      prisma.commissionRate.findMany({
        where: { storeId: store.id },
        select: { categoryName: true, rate: true },
      }),
    ]);

    // Kategori → komisyon oranı map
    const commissionMap = new Map<string, number>();
    for (const c of commissions) {
      commissionMap.set(c.categoryName.toLowerCase().trim(), Number(c.rate));
    }

    // Her ürün için hesaplama
    const items = products.map((p) => {
      const salePrice = Number(p.salePrice);
      const listPrice = Number(p.listPrice);
      const vatRate = Number(p.vatRate);
      const costPrice = p.costPrice != null ? Number(p.costPrice) : null;
      const shippingCost = p.shippingCost != null ? Number(p.shippingCost) : 0;

      // Komisyon oranı — kategori eşleştirme
      const catKey = (p.categoryName || '').toLowerCase().trim();
      const commissionRate = commissionMap.has(catKey) ? commissionMap.get(catKey)! : null;

      // Hesaplama (sadece costPrice VE commissionRate varsa tam hesap)
      let netRevenue: number | null = null;
      let commissionAmount: number | null = null;
      let netProfit: number | null = null;
      let profitMargin: number | null = null;
      let status: 'profit' | 'loss' | 'break_even' | 'incomplete' = 'incomplete';

      if (costPrice !== null && commissionRate !== null) {
        netRevenue = salePrice / (1 + vatRate / 100);
        commissionAmount = netRevenue * (commissionRate / 100);
        netProfit = netRevenue - commissionAmount - shippingCost - costPrice;
        profitMargin = salePrice > 0 ? (netProfit / salePrice) * 100 : 0;

        if (netProfit > 0.01) status = 'profit';
        else if (netProfit < -0.01) status = 'loss';
        else status = 'break_even';
      } else if (costPrice === null) {
        status = 'incomplete'; // alış fiyatı eksik
      } else {
        status = 'incomplete'; // komisyon eksik
      }

      return {
        barcode: p.barcode,
        title: p.title,
        categoryName: p.categoryName,
        imageUrl: p.imageUrl,
        stockCount: p.stockCount,
        salePrice,
        listPrice,
        vatRate,
        costPrice,
        shippingCost: shippingCost || null,
        commissionRate,
        netRevenue: netRevenue != null ? Math.round(netRevenue * 100) / 100 : null,
        commissionAmount: commissionAmount != null ? Math.round(commissionAmount * 100) / 100 : null,
        netProfit: netProfit != null ? Math.round(netProfit * 100) / 100 : null,
        profitMargin: profitMargin != null ? Math.round(profitMargin * 10) / 10 : null,
        status,
        hasCommission: commissionRate !== null,
        hasCostPrice: costPrice !== null,
      };
    });

    // Özet istatistikler (sadece tam hesaplananlar)
    const completeItems = items.filter((i) => i.status !== 'incomplete' && i.netProfit !== null);
    const summary = completeItems.length > 0
      ? {
          totalProducts: items.length,
          completeCount: completeItems.length,
          incompleteCount: items.length - completeItems.length,
          profitableCount: completeItems.filter((i) => i.status === 'profit').length,
          lossCount: completeItems.filter((i) => i.status === 'loss').length,
          totalRevenue: Math.round(completeItems.reduce((s, i) => s + i.salePrice, 0) * 100) / 100,
          totalCost: Math.round(completeItems.reduce((s, i) => s + (i.costPrice || 0) + (i.shippingCost || 0), 0) * 100) / 100,
          totalNetProfit: Math.round(completeItems.reduce((s, i) => s + (i.netProfit || 0), 0) * 100) / 100,
          avgMargin: Math.round(
            completeItems.reduce((s, i) => s + (i.profitMargin || 0), 0) / completeItems.length * 10
          ) / 10,
        }
      : {
          totalProducts: items.length,
          completeCount: 0,
          incompleteCount: items.length,
          profitableCount: 0,
          lossCount: 0,
          totalRevenue: 0,
          totalCost: 0,
          totalNetProfit: 0,
          avgMargin: 0,
        };

    return res.json({ success: true, data: { items, summary } });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Kar-zarar raporu hatası: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
};

/**
 * Tek ürün alış fiyatı + kargo güncelle
 * PATCH /api/profit/cost/:barcode
 */
export const updateProductCost = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });

  const { barcode } = req.params;
  const { costPrice, shippingCost } = req.body;

  if (costPrice === undefined && shippingCost === undefined) {
    return res.status(400).json({ success: false, message: 'costPrice veya shippingCost gerekli.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });
    if (!store) return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });

    const product = await prisma.product.findFirst({
      where: { barcode, storeId: store.id },
    });
    if (!product) return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });

    const updateData: any = {};
    if (costPrice !== undefined) updateData.costPrice = costPrice !== null ? Number(costPrice) : null;
    if (shippingCost !== undefined) updateData.shippingCost = shippingCost !== null ? Number(shippingCost) : null;

    const updated = await prisma.product.update({
      where: { barcode },
      data: updateData,
      select: { barcode: true, costPrice: true, shippingCost: true } as any,
    }) as any;

    return res.json({ success: true, data: updated });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Maliyet güncelleme hatası: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
};

/**
 * Toplu alış fiyatı güncelle
 * PATCH /api/profit/bulk-cost
 * Body: { items: [{ barcode, costPrice, shippingCost? }] }
 */
export const bulkUpdateProductCost = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });

  const { items } = req.body;
  if (!Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ success: false, message: 'items dizisi gerekli.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });
    if (!store) return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });

    // Transaction ile toplu güncelle
    const results = await prisma.$transaction(
      items.map((item: { barcode: string; costPrice?: number | null; shippingCost?: number | null }) => {
        const data: { costPrice?: number | null; shippingCost?: number | null } = {};
        if (item.costPrice !== undefined) data.costPrice = item.costPrice !== null ? Number(item.costPrice) : null;
        if (item.shippingCost !== undefined) data.shippingCost = item.shippingCost !== null ? Number(item.shippingCost) : null;
        return prisma.product.updateMany({
          where: { barcode: item.barcode, storeId: store.id },
          data,
        });
      })
    );

    const totalUpdated = results.reduce((s, r) => s + r.count, 0);
    return res.json({ success: true, data: { updated: totalUpdated } });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Toplu maliyet güncelleme hatası: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Sunucu hatası.' });
  }
};
