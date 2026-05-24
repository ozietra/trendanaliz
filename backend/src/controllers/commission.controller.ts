import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';

/**
 * GET /api/commissions
 */
export const listCommissions = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz.' });

  const store = await prisma.trendyolStore.findFirst({ where: { userId } });
  if (!store) return res.json({ success: true, data: [] });

  const rates = await prisma.commissionRate.findMany({
    where: { storeId: store.id },
    orderBy: { categoryName: 'asc' },
  });

  return res.json({ success: true, data: rates });
};

/**
 * POST /api/commissions
 * Body: { categoryName, rate }
 */
export const upsertCommission = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz.' });

  const store = await prisma.trendyolStore.findFirst({ where: { userId } });
  if (!store) return res.status(404).json({ success: false, message: 'Mağaza bulunamadı.' });

  const { categoryName, rate } = req.body as { categoryName: string; rate: number };
  if (!categoryName?.trim() || rate === undefined || rate < 0 || rate > 100) {
    return res.status(400).json({ success: false, message: 'categoryName ve rate (0-100) gerekli.' });
  }

  const result = await prisma.commissionRate.upsert({
    where: { storeId_categoryName: { storeId: store.id, categoryName: categoryName.trim() } },
    create: { storeId: store.id, categoryName: categoryName.trim(), rate },
    update: { rate },
  });

  return res.json({ success: true, data: result });
};

/**
 * DELETE /api/commissions/:id
 */
export const deleteCommission = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) return res.status(401).json({ success: false, message: 'Yetkisiz.' });

  try {
    await prisma.commissionRate.delete({ where: { id: req.params.id } });
    return res.json({ success: true });
  } catch {
    return res.status(404).json({ success: false, message: 'Komisyon kaydı bulunamadı.' });
  }
};
