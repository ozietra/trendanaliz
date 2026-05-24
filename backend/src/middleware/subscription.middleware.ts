import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { AuthenticatedRequest } from './auth.middleware';
import { Role, SubscriptionStatus } from '@prisma/client';

/**
 * Subscription Guard Middleware
 *
 * `requireActiveSubscription`:
 *   Kullanıcının aktif ve süresi dolmamış bir aboneliği yoksa 402 döner.
 *   SUPERADMIN rolü her zaman muaftır (test ve destek için).
 *   Aboneliği `req.subscription` üzerine bağlar — sonraki middleware'ler
 *   ve controller'lar burayı okuyabilir.
 *
 * `requireFeature(...features)`:
 *   `requireActiveSubscription`'dan SONRA kullanılmalı.
 *   Plan.features içinde verilen tüm feature anahtarları yoksa 403 döner.
 *   Plan.features JSON: ["repricer","forecast","keyword","listing-audit","sms-notifications", ...]
 *
 * Kullanım örneği (route):
 *   router.use(authenticateToken, requireActiveSubscription);
 *   router.get('/forecast', requireFeature('forecast'), handler);
 */

interface SubscriptionWithPlan {
  id: string;
  status: SubscriptionStatus;
  endDate: Date;
  planId: string;
  plan: {
    id: string;
    name: string;
    slug: string;
    features: unknown;
    maxProducts: number;
    maxCompetitors: number;
    refreshInterval: number;
  };
}

// Express Request'i genişletmek için module augmentation
declare module 'express-serve-static-core' {
  interface Request {
    subscription?: SubscriptionWithPlan;
  }
}

export const requireActiveSubscription = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Lütfen önce giriş yapın.',
    });
    return;
  }

  // SUPERADMIN her zaman erişebilir
  if (req.user.role === Role.SUPERADMIN) {
    next();
    return;
  }

  try {
    const sub = await prisma.subscription.findFirst({
      where: {
        userId: req.user.id,
        status: SubscriptionStatus.ACTIVE,
        endDate: { gt: new Date() },
      },
      include: {
        plan: {
          select: {
            id: true,
            name: true,
            slug: true,
            features: true,
            maxProducts: true,
            maxCompetitors: true,
            refreshInterval: true,
          },
        },
      },
      orderBy: { endDate: 'desc' },
    });

    if (!sub) {
      res.status(402).json({
        success: false,
        error: 'PaymentRequired',
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message: 'Bu özelliği kullanmak için aktif bir aboneliğiniz olmalı.',
      });
      return;
    }

    req.subscription = sub as SubscriptionWithPlan;
    next();
  } catch (err) {
    logger.error(`requireActiveSubscription hatası: ${(err as Error).message}`);
    res.status(500).json({
      success: false,
      message: 'Abonelik kontrolü sırasında bir hata oluştu.',
    });
  }
};

/**
 * Plan'a özgü özellik anahtarlarını zorunlu kılar.
 * Tüm verilen feature'lar mevcut olmalı (AND mantığı).
 */
export const requireFeature = (...features: string[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Yetkisiz.' });
      return;
    }
    if (req.user.role === Role.SUPERADMIN) {
      next();
      return;
    }
    const sub = req.subscription;
    if (!sub) {
      res.status(402).json({
        success: false,
        code: 'NO_ACTIVE_SUBSCRIPTION',
        message:
          'Abonelik bilgisi bulunamadı. Önce requireActiveSubscription middleware çağrılmalı.',
      });
      return;
    }

    const planFeatures = Array.isArray(sub.plan.features)
      ? (sub.plan.features as unknown[]).filter(
          (f): f is string => typeof f === 'string'
        )
      : [];

    const missing = features.filter((f) => !planFeatures.includes(f));
    if (missing.length > 0) {
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        code: 'PLAN_FEATURE_MISSING',
        message: `Bu özellik mevcut planınızda (${sub.plan.name}) bulunmuyor. Planınızı yükselterek erişim sağlayabilirsiniz.`,
        missingFeatures: missing,
        currentPlan: sub.plan.slug,
      });
      return;
    }
    next();
  };
};
