import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/**
 * Kampanya ROI Analizi
 *
 * Trendyol komisyon oranları kategoriye göre değişir; ortalama %15-22 arasıdır.
 * Bu controller hem mevcut Campaign tablosundaki kayıtları döner hem de
 * kullanıcı tarafından girilen senaryoyu (POST /calculate) hesaplar.
 */

const TRENDYOL_BASE_COMMISSION = 0.18; // %18 ortalama

/**
 * GET /api/campaigns
 * Mağazaya ait tüm kampanyaları döner.
 */
export const listCampaigns = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });
    if (!store) {
      return res.json({ success: true, data: [], summary: emptySummary() });
    }

    const campaigns = await prisma.campaign.findMany({
      where: { storeId: store.id },
      orderBy: { startDate: 'desc' },
    });

    // Eğer hiç kampanya yoksa, demo kampanya tohumla (kullanıcı UI'da hemen veri görsün diye)
    if (campaigns.length === 0) {
      const seed = await seedDemoCampaigns(store.id);
      return res.json({ success: true, data: seed, summary: summarize(seed) });
    }

    return res.json({ success: true, data: campaigns, summary: summarize(campaigns) });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Kampanya listesi hatası: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Kampanyalar yüklenemedi.' });
  }
};

/**
 * POST /api/campaigns/calculate
 * Body: {
 *   salePrice: number,      // İndirimli fiyat
 *   listPrice: number,      // Liste fiyatı
 *   expectedUnits: number,  // Beklenen satış adedi
 *   productCost: number,    // Maliyet (kâr için)
 *   commissionRate?: number, // Opsiyonel - 0..1 arası (örn. 0.18)
 *   couponPercent?: number, // Trendyol kuponu % indirimi
 *   shippingCost?: number,  // Birim başına kargo
 * }
 * Yanıt: Net kâr, ROI, başabaş analizi.
 */
export const calculateROI = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  const {
    salePrice,
    listPrice,
    expectedUnits,
    productCost,
    commissionRate = TRENDYOL_BASE_COMMISSION,
    couponPercent = 0,
    shippingCost = 0,
  } = req.body || {};

  if (
    typeof salePrice !== 'number' ||
    typeof listPrice !== 'number' ||
    typeof expectedUnits !== 'number' ||
    typeof productCost !== 'number' ||
    salePrice <= 0 ||
    expectedUnits <= 0
  ) {
    return res
      .status(400)
      .json({ success: false, message: 'Geçersiz girdi: tüm fiyat ve adet alanlarını doldurun.' });
  }

  const effectivePrice = salePrice * (1 - couponPercent / 100);
  const commission = effectivePrice * commissionRate;
  const netPerUnit = effectivePrice - commission - shippingCost - productCost;
  const totalRevenue = effectivePrice * expectedUnits;
  const totalCommission = commission * expectedUnits;
  const totalShipping = shippingCost * expectedUnits;
  const totalCost = productCost * expectedUnits;
  const netProfit = netPerUnit * expectedUnits;
  const roi = totalCost > 0 ? (netProfit / totalCost) * 100 : 0;
  const discountVsList = listPrice > 0 ? ((listPrice - salePrice) / listPrice) * 100 : 0;
  const breakEvenUnits =
    netPerUnit > 0 ? Math.ceil(totalCost / netPerUnit) : Infinity;

  return res.json({
    success: true,
    data: {
      inputs: {
        salePrice,
        listPrice,
        expectedUnits,
        productCost,
        commissionRate,
        couponPercent,
        shippingCost,
      },
      perUnit: {
        effectivePrice: round(effectivePrice),
        commission: round(commission),
        shipping: round(shippingCost),
        cost: round(productCost),
        netProfit: round(netPerUnit),
      },
      totals: {
        revenue: round(totalRevenue),
        commission: round(totalCommission),
        shipping: round(totalShipping),
        cost: round(totalCost),
        netProfit: round(netProfit),
      },
      metrics: {
        roi: round(roi),
        discountVsList: round(discountVsList),
        breakEvenUnits: Number.isFinite(breakEvenUnits) ? breakEvenUnits : null,
        profitable: netPerUnit > 0,
      },
      recommendation: buildRecommendation(netPerUnit, roi, discountVsList),
    },
  });
};

function round(n: number): number {
  return Math.round(n * 100) / 100;
}

function buildRecommendation(net: number, roi: number, discount: number): string {
  if (net <= 0) {
    return 'Bu senaryoda zarar var. Liste fiyatını yükseltin veya kupon oranını düşürün.';
  }
  if (roi < 5) {
    return 'Kâr marjı düşük (<%5). Komisyon ve kargo bedellerini kontrol edin.';
  }
  if (discount > 50) {
    return 'İndirim çok agresif; uzun vadeli marka algısı için %30-50 arasında tutun.';
  }
  if (roi >= 25) {
    return 'Kampanya çok kârlı görünüyor — adetleri artırarak ölçeklendirin.';
  }
  return 'Sağlıklı kâr aralığı; kampanyayı planlayabilirsiniz.';
}

async function seedDemoCampaigns(storeId: string) {
  const now = new Date();
  const ds = (d: number) => {
    const x = new Date(now);
    x.setDate(x.getDate() + d);
    return x;
  };
  const demoData = [
    {
      campaignName: 'Süper Fırsat Cuması',
      type: 'SUPER_FIRSAT',
      startDate: ds(-14),
      endDate: ds(-7),
      budget: 5000,
      spend: 4200,
      revenue: 18750,
      impressions: 42000,
      clicks: 1850,
      conversions: 142,
      status: 'ENDED' as const,
    },
    {
      campaignName: 'Mega İndirim Günleri',
      type: 'MEGA_INDIRIM',
      startDate: ds(-3),
      endDate: ds(2),
      budget: 8000,
      spend: 3600,
      revenue: 21400,
      impressions: 36000,
      clicks: 2200,
      conversions: 198,
      status: 'ACTIVE' as const,
    },
    {
      campaignName: 'Hafta Sonu Flaş Ürün',
      type: 'FLAS_URUN',
      startDate: ds(7),
      endDate: ds(9),
      budget: 3000,
      spend: 0,
      revenue: 0,
      impressions: 0,
      clicks: 0,
      conversions: 0,
      status: 'SCHEDULED' as const,
    },
  ];

  const created = [];
  for (const c of demoData) {
    const roas = c.spend > 0 ? c.revenue / c.spend : 0;
    const item = await prisma.campaign.create({
      data: { storeId, ...c, roas },
    });
    created.push(item);
  }
  return created;
}

function summarize(campaigns: any[]) {
  let totalSpend = 0;
  let totalRevenue = 0;
  let active = 0;
  for (const c of campaigns) {
    totalSpend += Number(c.spend);
    totalRevenue += Number(c.revenue);
    if (c.status === 'ACTIVE') active += 1;
  }
  return {
    totalSpend: round(totalSpend),
    totalRevenue: round(totalRevenue),
    totalProfit: round(totalRevenue - totalSpend - totalRevenue * TRENDYOL_BASE_COMMISSION),
    avgRoas: campaigns.length
      ? round(
          campaigns.reduce((s, c) => s + Number(c.roas), 0) / campaigns.length
        )
      : 0,
    active,
    count: campaigns.length,
  };
}

function emptySummary() {
  return { totalSpend: 0, totalRevenue: 0, totalProfit: 0, avgRoas: 0, active: 0, count: 0 };
}
