import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';

/**
 * GET /api/subscriptions/me
 * Aktif aboneliği, plan detayını ve son ödeme geçmişini döndürür.
 */
/**
 * GET /api/subscriptions/usage
 * Mevcut plan limitleri ile fiili kullanım oranlarını döner. Dashboard
 * "kullanım" göstergesi ve uyarı banner'ı için kullanılır.
 */
export const getMyUsage = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }
  try {
    const { getUsage } = await import('../services/plan-limits.service');
    const usage = await getUsage(userId);
    return res.json({ success: true, data: usage });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: 'Kullanım bilgisi alınamadı: ' + (err as Error).message,
    });
  }
};

export const getMySubscription = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
      orderBy: { createdAt: 'desc' },
      include: {
        plan: true,
        payments: { orderBy: { createdAt: 'desc' }, take: 10 },
      },
    });

    if (!subscription) {
      return res.json({
        success: true,
        data: null,
        message: 'Aktif abonelik bulunamadı.',
      });
    }

    return res.json({ success: true, data: subscription });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Abonelik detayı hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Abonelik bilgisi yüklenemedi.' });
  }
};

/**
 * POST /api/subscriptions/cancel
 * Aboneliği bir sonraki yenileme tarihinde sonlandıracak şekilde işaretler.
 */
export const cancelSubscription = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  try {
    const subscription = await prisma.subscription.findFirst({
      where: { userId, status: 'ACTIVE' },
    });
    if (!subscription) {
      return res.status(404).json({ success: false, message: 'Aktif abonelik bulunamadı.' });
    }

    await prisma.subscription.update({
      where: { id: subscription.id },
      data: { autoRenew: false },
    });

    return res.json({
      success: true,
      message: 'Aboneliğiniz, yenileme tarihinde sonlandırılacak şekilde işaretlendi.',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`Abonelik iptal hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'İptal işlemi başarısız.' });
  }
};
