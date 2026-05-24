import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { RuleType } from '@prisma/client';
import { addStoreLog } from '../services/repricer.service';

/**
 * GET /api/rules
 * Kullanıcının tanımladığı akıllı fiyatlandırma stratejilerini listeler
 */
export const getRules = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({
      where: { userId }
    });

    if (!store) {
      return res.json({ success: true, data: [] });
    }

    const products = await prisma.product.findMany({
      where: { storeId: store.id },
      include: { priceRules: true }
    });

    // Veritabanındaki tüm kural kayıtlarını çekelim ve arayüze uygun formatta gruplayalım
    const rulesMap: Record<string, { id: string, name: string, type: string, limit: number, step: number, minMargin: number, activeCount: number, isActive: boolean }> = {
      'min-match': { id: 'min-match', name: 'En Düşük Fiyat Eşitleme', type: 'min-match', limit: 799, step: 1.00, minMargin: 10, activeCount: 0, isActive: true },
      'buybox-defense': { id: 'buybox-defense', name: 'BuyBox Koruması', type: 'buybox-defense', limit: 899, step: 0.50, minMargin: 15, activeCount: 0, isActive: true },
      'stock-boost': { id: 'stock-boost', name: 'Düşük Stok Fiyat Yükseltme', type: 'stock-boost', limit: 1250, step: 8.00, minMargin: 20, activeCount: 0, isActive: false }
    };

    // Aktif sayımları yap
    for (const p of products) {
      for (const rule of p.priceRules) {
        if (rule.isActive) {
          if (rule.ruleType === RuleType.MATCH_LOWEST) {
            rulesMap['min-match'].activeCount += 1;
            rulesMap['min-match'].isActive = true;
          } else if (rule.ruleType === RuleType.BEAT_BY_AMOUNT) {
            rulesMap['buybox-defense'].activeCount += 1;
            rulesMap['buybox-defense'].isActive = true;
          } else if (rule.ruleType === RuleType.FIXED_MARGIN) {
            rulesMap['stock-boost'].activeCount += 1;
            rulesMap['stock-boost'].isActive = true;
          }
        }
      }
    }

    const rulesList = Object.values(rulesMap);
    return res.json({
      success: true,
      data: rulesList
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Get rules hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Fiyatlandırma kuralları yüklenirken sunucu hatası oluştu.' });
  }
};

/**
 * POST /api/rules
 * Yeni bir fiyatlandırma stratejisi tanımlar
 */
export const addRule = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const { name, type, limit, step } = req.body;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  if (!name || !type) {
    return res.status(400).json({ success: false, message: 'Strateji adı ve tipi zorunludur.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({
      where: { userId }
    });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Önce entegrasyonu tamamlamalısınız.' });
    }

    // Yeni oluşturulan kuralı simüle etmek için mağazaya ait ilk ürüne bu kuralı ekleyelim veya güncelleyelim
    const firstProduct = await prisma.product.findFirst({
      where: { storeId: store.id },
      include: { priceRules: true }
    });

    let mappedType: RuleType = RuleType.MATCH_LOWEST;
    if (type === 'buybox-defense') {
      mappedType = RuleType.BEAT_BY_AMOUNT;
    } else if (type === 'stock-boost') {
      mappedType = RuleType.FIXED_MARGIN;
    }

    if (firstProduct) {
      const existingRule = firstProduct.priceRules[0];
      if (existingRule) {
        await prisma.priceRule.update({
          where: { id: existingRule.id },
          data: {
            ruleType: mappedType,
            minPrice: limit || existingRule.minPrice,
            targetValue: step || existingRule.targetValue,
            isActive: true,
            updatedAt: new Date()
          }
        });
      } else {
        await prisma.priceRule.create({
          data: {
            productId: firstProduct.id,
            ruleType: mappedType,
            targetValue: step || 1.00,
            minPrice: limit || 100.00,
            maxPrice: limit ? limit * 2 : 2000.00,
            isActive: true
          }
        });
      }
    }

    addStoreLog(store.id, `YENİ KURAL TANIMLANDI: "${name}" stratejisi başarıyla kuruldu.`);

    return res.json({
      success: true,
      message: `"${name}" stratejisi başarıyla oluşturuldu.`
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Add rule hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Strateji eklenirken sunucu hatası oluştu.' });
  }
};

/**
 * PUT /api/rules/:id/toggle
 * Stratejiyi genel olarak aktif veya pasif yapar
 */
export const toggleRule = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const ruleId = req.params.id; // type bilgisi 'min-match', 'buybox-defense' vb.

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

    // Bu kural tipine uyan tüm ürünlerdeki kural durumunu tersine çevir (Toggle)
    let mappedType: RuleType = RuleType.MATCH_LOWEST;
    if (ruleId === 'buybox-defense') {
      mappedType = RuleType.BEAT_BY_AMOUNT;
    } else if (ruleId === 'stock-boost') {
      mappedType = RuleType.FIXED_MARGIN;
    }

    const products = await prisma.product.findMany({
      where: { storeId: store.id },
      include: {
        priceRules: {
          where: { ruleType: mappedType }
        }
      }
    });

    let nextState = true;
    for (const p of products) {
      for (const rule of p.priceRules) {
        nextState = !rule.isActive;
        await prisma.priceRule.update({
          where: { id: rule.id },
          data: {
            isActive: nextState,
            updatedAt: new Date()
          }
        });
      }
    }

    const ruleName = ruleId === 'min-match' ? 'En Düşük Fiyat Eşitleme' : ruleId === 'buybox-defense' ? 'BuyBox Koruması' : 'Düşük Stok Fiyat Yükseltme';
    addStoreLog(store.id, `KURAL DURUMU DEĞİŞTİ: "${ruleName}" stratejisi ${nextState ? 'AKTİF EDİLDİ' : 'PASİFLEŞTİRİLDİ'}.`);

    return res.json({
      success: true,
      message: `Strateji başarıyla ${nextState ? 'etkinleştirildi' : 'devre dışı bırakıldı'}.`
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Toggle rule hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Strateji durumu değiştirilirken sunucu hatası oluştu.' });
  }
};
