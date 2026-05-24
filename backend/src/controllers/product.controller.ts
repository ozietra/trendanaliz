import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { addStoreLog } from '../services/repricer.service';
import { RuleType } from '@prisma/client';

/**
 * GET /api/products
 * Kullanıcının entegre edilmiş Trendyol ürünlerini çeker
 */
export const getProducts = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { q, buybox } = req.query; // q: arama kelimesi, buybox: 'all' | 'lost'

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
        data: []
      });
    }

    // Arama filtreleri
    const whereClause: any = {
      storeId: store.id
    };

    if (q) {
      whereClause.OR = [
        { title: { contains: String(q), mode: 'insensitive' } },
        { barcode: { contains: String(q), mode: 'insensitive' } }
      ];
    }

    const products = await prisma.product.findMany({
      where: whereClause,
      include: {
        priceRules: true,
        competitors: true
      },
      orderBy: { title: 'asc' }
    });

    // Frontend için veri haritalama (Map) ve Buybox durumu kontrolü
    const formattedProducts = products.map((product) => {
      const activeRule = product.priceRules[0];
      const lowestCompetitor = product.competitors.reduce((prev, curr) => 
        Number(curr.currentPrice) < Number(prev.currentPrice) ? curr : prev
      , product.competitors[0]);

      const competitorPrice = lowestCompetitor ? Number(lowestCompetitor.currentPrice) : Number(product.salePrice);
      const isOurPriceLowest = Number(product.salePrice) <= competitorPrice;

      return {
        id: product.id,
        name: product.title,
        sku: product.barcode,
        price: Number(product.salePrice),
        competitorPrice: competitorPrice,
        buybox: isOurPriceLowest,
        minPrice: activeRule ? Number(activeRule.minPrice) : Number(product.salePrice) * 0.9,
        maxPrice: activeRule ? Number(activeRule.maxPrice) : Number(product.salePrice) * 1.5,
        rule: activeRule && activeRule.isActive ? activeRule.ruleType : 'none',
        repricerActive: activeRule ? activeRule.isActive : false
      };
    });

    // Buybox kayıp filtresi
    const filteredProducts = buybox === 'lost' 
      ? formattedProducts.filter(p => !p.buybox) 
      : formattedProducts;

    return res.json({
      success: true,
      data: filteredProducts
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Get products hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Ürün listesi yüklenirken sunucu hatası oluştu.' });
  }
};

/**
 * PUT /api/products/:id/repricer
 * Ürünün otomatik fiyatlandırma motorunu aktif/pasif yapar
 */
export const toggleRepricer = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const productId = req.params.id;
  const { active } = req.body; // boolean

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({
      where: { userId }
    });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      include: { priceRules: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });
    }

    const rule = product.priceRules[0];
    if (!rule) {
      // Varsayılan kural oluştur
      await prisma.priceRule.create({
        data: {
          productId: product.id,
          ruleType: RuleType.MATCH_LOWEST,
          targetValue: 0.00,
          minPrice: Number(product.salePrice) * 0.9,
          maxPrice: Number(product.salePrice) * 1.5,
          isActive: active
        }
      });
    } else {
      await prisma.priceRule.update({
        where: { id: rule.id },
        data: {
          isActive: active,
          updatedAt: new Date()
        }
      });
    }

    addStoreLog(store.id, `KURAL ${active ? 'AKTİF EDİLDİ' : 'DURDURULDU'}: "${product.title}" için repricer durumu değiştirildi.`);

    return res.json({
      success: true,
      message: `Otomatik fiyatlandırma başarıyla ${active ? 'başlatıldı' : 'durduruldu'}.`
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Toggle repricer hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Repricer durumu güncellenirken sunucu hatası oluştu.' });
  }
};

/**
 * PUT /api/products/:id/rule
 * Ürünün min/max fiyat sınırlarını ve kural stratejisini günceller
 */
export const updateProductRule = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const productId = req.params.id;
  const { minPrice, maxPrice, ruleType, targetValue } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({
      where: { userId }
    });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });
    }

    const product = await prisma.product.findFirst({
      where: { id: productId, storeId: store.id },
      include: { priceRules: true }
    });

    if (!product) {
      return res.status(404).json({ success: false, message: 'Ürün bulunamadı.' });
    }

    // Gelen kural tipini enum değerine map et
    let mappedRuleType: RuleType = RuleType.MATCH_LOWEST;
    if (ruleType === 'buybox-defense') {
      mappedRuleType = RuleType.BEAT_BY_AMOUNT;
    } else if (ruleType === 'min-match') {
      mappedRuleType = RuleType.MATCH_LOWEST;
    } else if (ruleType === 'stock-boost') {
      mappedRuleType = RuleType.FIXED_MARGIN;
    } else if (Object.values(RuleType).includes(ruleType)) {
      mappedRuleType = ruleType;
    }

    const rule = product.priceRules[0];
    if (!rule) {
      await prisma.priceRule.create({
        data: {
          productId: product.id,
          ruleType: mappedRuleType,
          targetValue: targetValue || 0.50,
          minPrice: minPrice || Number(product.salePrice) * 0.9,
          maxPrice: maxPrice || Number(product.salePrice) * 1.5,
          isActive: true
        }
      });
    } else {
      await prisma.priceRule.update({
        where: { id: rule.id },
        data: {
          ruleType: mappedRuleType,
          minPrice: minPrice || rule.minPrice,
          maxPrice: maxPrice || rule.maxPrice,
          targetValue: targetValue !== undefined ? targetValue : rule.targetValue,
          updatedAt: new Date()
        }
      });
    }

    addStoreLog(store.id, `GÜNCELLEME: "${product.title}" sınırları ve stratejisi güncellendi. Min: ₺${minPrice}, Max: ₺${maxPrice}`);

    return res.json({
      success: true,
      message: 'Ürün fiyat limitleri ve stratejisi başarıyla güncellendi.'
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Update product rule hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Kural limitleri güncellenirken sunucu hatası oluştu.' });
  }
};
