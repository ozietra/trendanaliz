import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import * as trendyol from '../services/trendyol.service';
import { decrypt } from '../utils/crypto';

interface BulkPricingRequest {
  scope: {
    type: 'group' | 'category' | 'all';
    groupId?: string;
    categoryName?: string;
  };
  formula: {
    type: 'PERCENT_CHANGE' | 'FIXED_CHANGE' | 'SET_PRICE';
    value: number;
    direction?: 'increase' | 'decrease';
    applyTo: 'salePrice' | 'listPrice' | 'both';
  };
  constraints?: {
    minPrice?: number;
    maxPrice?: number;
  };
}

interface PreviewItem {
  id: string;
  title: string;
  barcode: string;
  categoryName: string | null;
  currentSalePrice: number;
  newSalePrice: number;
  currentListPrice: number;
  newListPrice: number;
}

const applyFormula = (
  currentPrice: number,
  formula: BulkPricingRequest['formula']
): number => {
  let result = currentPrice;
  switch (formula.type) {
    case 'PERCENT_CHANGE': {
      const mult = formula.direction === 'decrease' ? (1 - formula.value / 100) : (1 + formula.value / 100);
      result = currentPrice * mult;
      break;
    }
    case 'FIXED_CHANGE': {
      result = formula.direction === 'decrease' ? currentPrice - formula.value : currentPrice + formula.value;
      break;
    }
    case 'SET_PRICE': {
      result = formula.value;
      break;
    }
  }
  return Math.max(0.01, Math.round(result * 100) / 100);
};

const resolveProducts = async (storeId: string, scope: BulkPricingRequest['scope']) => {
  const where: any = { storeId };
  if (scope.type === 'group' && scope.groupId) {
    const items = await prisma.productGroupItem.findMany({
      where: { groupId: scope.groupId },
      select: { productId: true },
    });
    where.id = { in: items.map((i) => i.productId) };
  } else if (scope.type === 'category' && scope.categoryName) {
    where.categoryName = scope.categoryName;
  }
  return prisma.product.findMany({
    where,
    select: { id: true, title: true, barcode: true, salePrice: true, listPrice: true, categoryName: true },
  });
};

/**
 * POST /api/bulk-pricing/preview
 */
export const preview = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz.' });

  const store = await prisma.trendyolStore.findFirst({ where: { userId } });
  if (!store) return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });

  const body = req.body as BulkPricingRequest;
  if (!body.scope || !body.formula) {
    return res.status(400).json({ success: false, message: 'scope ve formula gerekli.' });
  }

  const products = await resolveProducts(store.id, body.scope);
  const items: PreviewItem[] = products.map((p) => {
    const cSale = Number(p.salePrice);
    const cList = Number(p.listPrice);
    let nSale = cSale;
    let nList = cList;

    if (body.formula.applyTo === 'salePrice' || body.formula.applyTo === 'both') {
      nSale = applyFormula(cSale, body.formula);
    }
    if (body.formula.applyTo === 'listPrice' || body.formula.applyTo === 'both') {
      nList = applyFormula(cList, body.formula);
    }

    // Constraints
    if (body.constraints?.minPrice) {
      nSale = Math.max(nSale, body.constraints.minPrice);
      nList = Math.max(nList, body.constraints.minPrice);
    }
    if (body.constraints?.maxPrice) {
      nSale = Math.min(nSale, body.constraints.maxPrice);
      nList = Math.min(nList, body.constraints.maxPrice);
    }

    // listPrice >= salePrice (Trendyol kuralı)
    if (nList < nSale) nList = nSale;

    return {
      id: p.id,
      title: p.title,
      barcode: p.barcode,
      categoryName: p.categoryName,
      currentSalePrice: cSale,
      newSalePrice: nSale,
      currentListPrice: cList,
      newListPrice: nList,
    };
  });

  return res.json({ success: true, data: { affected: items.length, items } });
};

/**
 * POST /api/bulk-pricing/apply
 */
export const apply = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz.' });

  const store = await prisma.trendyolStore.findFirst({ where: { userId } });
  if (!store) return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });

  const body = req.body as BulkPricingRequest;
  if (!body.scope || !body.formula) {
    return res.status(400).json({ success: false, message: 'scope ve formula gerekli.' });
  }

  const products = await resolveProducts(store.id, body.scope);
  if (products.length === 0) {
    return res.json({ success: true, message: 'Etkilenen ürün yok.', updated: 0 });
  }

  const updates: trendyol.PriceInventoryUpdate[] = [];
  const dbUpdates: Array<{ id: string; salePrice: number; listPrice: number }> = [];

  for (const p of products) {
    const cSale = Number(p.salePrice);
    const cList = Number(p.listPrice);
    let nSale = cSale;
    let nList = cList;

    if (body.formula.applyTo === 'salePrice' || body.formula.applyTo === 'both') {
      nSale = applyFormula(cSale, body.formula);
    }
    if (body.formula.applyTo === 'listPrice' || body.formula.applyTo === 'both') {
      nList = applyFormula(cList, body.formula);
    }

    if (body.constraints?.minPrice) {
      nSale = Math.max(nSale, body.constraints.minPrice);
      nList = Math.max(nList, body.constraints.minPrice);
    }
    if (body.constraints?.maxPrice) {
      nSale = Math.min(nSale, body.constraints.maxPrice);
      nList = Math.min(nList, body.constraints.maxPrice);
    }
    if (nList < nSale) nList = nSale;

    // Değişiklik yoksa atla
    if (nSale === cSale && nList === cList) continue;

    updates.push({ barcode: p.barcode, salePrice: nSale, listPrice: nList });
    dbUpdates.push({ id: p.id, salePrice: nSale, listPrice: nList });
  }

  if (updates.length === 0) {
    return res.json({ success: true, message: 'Fiyat değişikliği hesaplanamadı.', updated: 0 });
  }

  // DB güncelle + PriceHistory kaydet
  for (const u of dbUpdates) {
    await prisma.product.update({
      where: { id: u.id },
      data: { salePrice: u.salePrice, listPrice: u.listPrice },
    });
    await prisma.priceHistory.create({
      data: {
        productId: u.id,
        price: u.salePrice,
        source: 'OWN',
      },
    });
  }

  // Trendyol'a push
  let pushResult = 'DB_ONLY';
  if (process.env.TRENDYOL_LIVE_PUSH === '1') {
    try {
      const creds = {
        supplierId: store.supplierId,
        apiKey: decrypt(store.apiKey),
        apiSecret: decrypt(store.apiSecret),
      };
      await trendyol.bulkUpdatePriceInventory(creds, updates);
      pushResult = 'PUSHED';
    } catch (err) {
      logger.error(`Toplu fiyat push hatası: ${(err as Error).message}`);
      pushResult = 'PUSH_FAILED';
    }
  }

  return res.json({
    success: true,
    message: `${updates.length} ürünün fiyatı güncellendi.`,
    updated: updates.length,
    pushResult,
  });
};
