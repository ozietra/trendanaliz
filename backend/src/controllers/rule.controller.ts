import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { RuleType } from '@prisma/client';
import { addStoreLog } from '../services/repricer.service';

/**
 * Kural tipi etiketleri
 */
const RULE_LABELS: Record<string, string> = {
  MATCH_LOWEST: 'En Düşük Fiyat Eşitleme',
  BEAT_BY_AMOUNT: 'BuyBox Koruması',
  FIXED_MARGIN: 'Düşük Stok Fiyat Yükseltme',
};
const RULE_TYPE_SLUG: Record<string, string> = {
  MATCH_LOWEST: 'min-match',
  BEAT_BY_AMOUNT: 'buybox-defense',
  FIXED_MARGIN: 'stock-boost',
};
const SLUG_TO_RULE_TYPE: Record<string, RuleType> = {
  'min-match': RuleType.MATCH_LOWEST,
  'buybox-defense': RuleType.BEAT_BY_AMOUNT,
  'stock-boost': RuleType.FIXED_MARGIN,
};

/**
 * GET /api/rules
 * Kullanıcının **gerçek** PriceRule kayıtlarını gruplandırılmış şekilde listeler.
 * Hardcoded varsayılan kural listesi KALDIRILDI — sadece veritabanındaki
 * kayıtlar döner. Hiç kayıt yoksa boş liste döner.
 */
export const getRules = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });

    if (!store) {
      return res.json({ success: true, data: [] });
    }

    // Gerçek PriceRule kayıtlarını çek
    const priceRules = await prisma.priceRule.findMany({
      where: { product: { storeId: store.id } },
      include: { product: { select: { title: true } } },
    });

    if (priceRules.length === 0) {
      return res.json({ success: true, data: [] });
    }

    // Kural tipine göre grupla
    const groups: Record<
      string,
      {
        id: string;
        name: string;
        type: string;
        step: number;
        minMargin: number;
        activeCount: number;
        totalCount: number;
        isActive: boolean;
      }
    > = {};

    for (const rule of priceRules) {
      const slug = RULE_TYPE_SLUG[rule.ruleType] || rule.ruleType;
      if (!groups[slug]) {
        groups[slug] = {
          id: slug,
          name: RULE_LABELS[rule.ruleType] || rule.ruleType,
          type: slug,
          step: Number(rule.targetValue),
          minMargin: 0,
          activeCount: 0,
          totalCount: 0,
          isActive: false,
        };
      }
      groups[slug].totalCount += 1;
      if (rule.isActive) {
        groups[slug].activeCount += 1;
        groups[slug].isActive = true;
      }
    }

    return res.json({
      success: true,
      data: Object.values(groups),
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Get rules hatası: ${err.message}`);
    return res
      .status(500)
      .json({ success: false, message: 'Fiyatlandırma kuralları yüklenirken sunucu hatası oluştu.' });
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
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Önce entegrasyonu tamamlamalısınız.' });
    }

    const mappedType = SLUG_TO_RULE_TYPE[type] || RuleType.MATCH_LOWEST;

    // İlk ürüne kural ekle
    const firstProduct = await prisma.product.findFirst({
      where: { storeId: store.id },
      include: { priceRules: true },
    });

    if (firstProduct) {
      const existingRule = firstProduct.priceRules.find((r) => r.ruleType === mappedType);
      if (existingRule) {
        await prisma.priceRule.update({
          where: { id: existingRule.id },
          data: {
            targetValue: step || existingRule.targetValue,
            minPrice: limit || existingRule.minPrice,
            isActive: true,
            updatedAt: new Date(),
          },
        });
      } else {
        await prisma.priceRule.create({
          data: {
            productId: firstProduct.id,
            ruleType: mappedType,
            targetValue: step || 1.0,
            minPrice: limit || 100.0,
            maxPrice: limit ? limit * 2 : 2000.0,
            isActive: true,
          },
        });
      }
    }

    addStoreLog(store.id, `YENİ KURAL TANIMLANDI: "${name}" stratejisi başarıyla kuruldu.`);

    return res.json({
      success: true,
      message: `"${name}" stratejisi başarıyla oluşturuldu.`,
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
  const ruleId = req.params.id; // slug: 'min-match', 'buybox-defense', 'stock-boost'

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });
    }

    const mappedType = SLUG_TO_RULE_TYPE[ruleId];
    if (!mappedType) {
      return res.status(400).json({ success: false, message: 'Geçersiz kural tipi.' });
    }

    // Bu kural tipine ait tüm kuralları bul
    const rules = await prisma.priceRule.findMany({
      where: { ruleType: mappedType, product: { storeId: store.id } },
    });

    if (rules.length === 0) {
      return res.status(404).json({ success: false, message: 'Bu tipte tanımlı kural bulunamadı.' });
    }

    // Tüm kuralların mevcut durumunun tersini uygula
    const nextState = !rules[0].isActive;

    await prisma.priceRule.updateMany({
      where: { ruleType: mappedType, product: { storeId: store.id } },
      data: { isActive: nextState, updatedAt: new Date() },
    });

    const ruleName = RULE_LABELS[mappedType] || ruleId;
    addStoreLog(
      store.id,
      `KURAL DURUMU DEĞİŞTİ: "${ruleName}" stratejisi ${nextState ? 'AKTİF EDİLDİ' : 'PASİFLEŞTİRİLDİ'}.`
    );

    return res.json({
      success: true,
      message: `Strateji başarıyla ${nextState ? 'etkinleştirildi' : 'devre dışı bırakıldı'}.`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Toggle rule hatası: ${err.message}`);
    return res
      .status(500)
      .json({ success: false, message: 'Strateji durumu değiştirilirken sunucu hatası oluştu.' });
  }
};

/**
 * DELETE /api/rules/:id
 * Bir kural tipine ait tüm kuralları kalıcı olarak siler.
 */
export const deleteRule = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  const ruleId = req.params.id;

  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const store = await prisma.trendyolStore.findFirst({ where: { userId } });

    if (!store) {
      return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });
    }

    const mappedType = SLUG_TO_RULE_TYPE[ruleId];
    if (!mappedType) {
      return res.status(400).json({ success: false, message: 'Geçersiz kural tipi.' });
    }

    const deleted = await prisma.priceRule.deleteMany({
      where: { ruleType: mappedType, product: { storeId: store.id } },
    });

    if (deleted.count === 0) {
      return res.status(404).json({ success: false, message: 'Silinecek kural bulunamadı.' });
    }

    const ruleName = RULE_LABELS[mappedType] || ruleId;
    addStoreLog(store.id, `KURAL SİLİNDİ: "${ruleName}" stratejisi silindi (${deleted.count} kayıt).`);

    return res.json({
      success: true,
      message: `"${ruleName}" stratejisi silindi (${deleted.count} ürünün kuralı kaldırıldı).`,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Delete rule hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Strateji silinirken sunucu hatası oluştu.' });
  }
};
