import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/**
 * GET /api/product-groups
 */
export const listGroups = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz.' });

  const store = await prisma.trendyolStore.findFirst({ where: { userId } });
  if (!store) return res.json({ success: true, data: [] });

  const groups = await prisma.productGroup.findMany({
    where: { storeId: store.id },
    include: { items: { include: { product: { select: { id: true, title: true, barcode: true, salePrice: true, listPrice: true, categoryName: true, imageUrl: true } } } } },
    orderBy: { createdAt: 'desc' },
  });

  return res.json({ success: true, data: groups });
};

/**
 * POST /api/product-groups
 * Body: { name, color? }
 */
export const createGroup = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz.' });

  const store = await prisma.trendyolStore.findFirst({ where: { userId } });
  if (!store) return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });

  const { name, color } = req.body as { name: string; color?: string };
  if (!name?.trim()) return res.status(400).json({ success: false, message: 'Grup adı gerekli.' });

  try {
    const group = await prisma.productGroup.create({
      data: { storeId: store.id, name: name.trim(), color: color || '#f97316' },
    });
    return res.status(201).json({ success: true, data: group });
  } catch (err: any) {
    if (err.code === 'P2002') return res.status(409).json({ success: false, message: 'Bu isimde grup zaten var.' });
    throw err;
  }
};

/**
 * PUT /api/product-groups/:id
 */
export const updateGroup = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz.' });

  const store = await prisma.trendyolStore.findFirst({ where: { userId } });
  if (!store) return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });

  const { name, color } = req.body as { name?: string; color?: string };
  try {
    const group = await prisma.productGroup.update({
      where: { id: req.params.id },
      data: { ...(name ? { name: name.trim() } : {}), ...(color ? { color } : {}) },
    });
    return res.json({ success: true, data: group });
  } catch {
    return res.status(404).json({ success: false, message: 'Grup bulunamadı.' });
  }
};

/**
 * DELETE /api/product-groups/:id
 */
export const deleteGroup = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz.' });

  try {
    await prisma.productGroup.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch {
    return res.status(404).json({ success: false, message: 'Grup bulunamadı.' });
  }
};

/**
 * POST /api/product-groups/:id/products
 * Body: { productIds: string[] }
 */
export const addProducts = async (req: AuthenticatedRequest, res: Response) => {
  const { productIds } = req.body as { productIds: string[] };
  if (!productIds?.length) return res.status(400).json({ success: false, message: 'productIds gerekli.' });

  const groupId = req.params.id;
  try {
    await prisma.productGroupItem.createMany({
      data: productIds.map((productId) => ({ groupId, productId })),
      skipDuplicates: true,
    });
    return res.json({ success: true, message: `${productIds.length} ürün gruba eklendi.` });
  } catch (err) {
    logger.error(`addProducts hatası: ${(err as Error).message}`);
    return res.status(400).json({ success: false, message: 'Ürün eklenemedi.' });
  }
};

/**
 * DELETE /api/product-groups/:id/products
 * Body: { productIds: string[] }
 */
export const removeProducts = async (req: AuthenticatedRequest, res: Response) => {
  const { productIds } = req.body as { productIds: string[] };
  if (!productIds?.length) return res.status(400).json({ success: false, message: 'productIds gerekli.' });

  const groupId = req.params.id;
  await prisma.productGroupItem.deleteMany({
    where: { groupId, productId: { in: productIds } },
  });
  return res.json({ success: true, message: 'Ürünler gruptan çıkarıldı.' });
};

/**
 * POST /api/product-groups/:id/auto-fill
 * Body: { categoryName: string }
 * Seçili kategorideki tüm ürünleri otomatik olarak gruba ekler
 */
export const autoFillByCategory = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz.' });

  const store = await prisma.trendyolStore.findFirst({ where: { userId } });
  if (!store) return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });

  const { categoryName } = req.body as { categoryName: string };
  if (!categoryName) return res.status(400).json({ success: false, message: 'categoryName gerekli.' });

  const groupId = req.params.id;

  const products = await prisma.product.findMany({
    where: { storeId: store.id, categoryName },
    select: { id: true },
  });

  if (products.length === 0) {
    return res.json({ success: true, message: 'Bu kategoride ürün bulunamadı.', added: 0 });
  }

  await prisma.productGroupItem.createMany({
    data: products.map((p) => ({ groupId, productId: p.id })),
    skipDuplicates: true,
  });

  return res.json({ success: true, message: `${products.length} ürün gruba eklendi.`, added: products.length });
};
