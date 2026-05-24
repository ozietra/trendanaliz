import { prisma } from '../config/database';
import { Role, SubscriptionStatus } from '@prisma/client';

/**
 * Plan Limit Servisi
 *
 * Trial/Active aboneliği olan kullanıcının paketinin getirdiği üst sınırları
 * uygular. SUPERADMIN her zaman muaftır. Aboneliği yoksa "henüz plan yok"
 * olarak değerlendirilir ve `enforce*` çağrıları LimitExceededError fırlatır
 * (subscription guard zaten 402 atacağı için pratikte buraya düşmez).
 *
 * Mantık:
 *   - getActivePlan(userId)        → kullanıcının aktif/trial planı
 *   - getUsage(userId)             → kullanım/limit özeti (UI için)
 *   - enforceCompetitorLimit(uid)  → yeni rakip eklemeden ÖNCE çağır
 *   - capProductSyncCount(uid, n)  → sync sırasında en çok kaç ürün
 *                                     yaratılabileceğini döner
 *
 * NOT: Limitler kullanım sayısını AŞAR. Mevcut kayıtları silmez. Yani
 * kullanıcı plan düşürse bile mevcut verileri görmeye devam eder; sadece
 * yeni kayıt ekleyemez (sert downgrade tetikleyici yok).
 */

export class LimitExceededError extends Error {
  code = 'LIMIT_EXCEEDED';
  constructor(public resource: string, public used: number, public max: number) {
    super(
      `${resource} limiti aşıldı: ${used}/${max}. Daha üst bir pakete geçerek devam edebilirsiniz.`
    );
  }
}

export interface PlanLimits {
  maxProducts: number;
  maxCompetitors: number;
  refreshInterval: number;
  planName: string;
  planSlug: string;
  isUnlimited: (k: 'products' | 'competitors') => boolean;
}

/**
 * UNLIMITED sentinel: Business gibi sınırsız paketlerde max=99999 set ediyoruz.
 * Bu sınırın üstündeyse "sınırsız" sayılır.
 */
const UNLIMITED_THRESHOLD = 9999;

export const getActivePlanLimits = async (
  userId: string
): Promise<PlanLimits | null> => {
  const sub = await prisma.subscription.findFirst({
    where: {
      userId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
      endDate: { gt: new Date() },
    },
    include: {
      plan: {
        select: {
          name: true,
          slug: true,
          maxProducts: true,
          maxCompetitors: true,
          refreshInterval: true,
        },
      },
    },
    orderBy: { endDate: 'desc' },
  });
  if (!sub) return null;
  return {
    maxProducts: sub.plan.maxProducts,
    maxCompetitors: sub.plan.maxCompetitors,
    refreshInterval: sub.plan.refreshInterval,
    planName: sub.plan.name,
    planSlug: sub.plan.slug,
    isUnlimited: (k) =>
      (k === 'products' ? sub.plan.maxProducts : sub.plan.maxCompetitors) >=
      UNLIMITED_THRESHOLD,
  };
};

export interface UsageReport {
  plan: { name: string; slug: string } | null;
  products: { used: number; max: number; unlimited: boolean };
  competitors: { used: number; max: number; unlimited: boolean };
  refreshIntervalMin: number;
}

export const getUsage = async (userId: string): Promise<UsageReport> => {
  const limits = await getActivePlanLimits(userId);
  const store = await prisma.trendyolStore.findFirst({
    where: { userId },
    select: { id: true },
  });

  let productsUsed = 0;
  let competitorsUsed = 0;
  if (store) {
    productsUsed = await prisma.product.count({ where: { storeId: store.id } });
    // Distinct rakip satıcıları say
    const distinct = await prisma.competitor.findMany({
      where: { product: { storeId: store.id } },
      select: { competitorSellerName: true },
      distinct: ['competitorSellerName'],
    });
    competitorsUsed = distinct.length;
  }

  return {
    plan: limits ? { name: limits.planName, slug: limits.planSlug } : null,
    products: {
      used: productsUsed,
      max: limits?.maxProducts ?? 0,
      unlimited: limits?.isUnlimited('products') ?? false,
    },
    competitors: {
      used: competitorsUsed,
      max: limits?.maxCompetitors ?? 0,
      unlimited: limits?.isUnlimited('competitors') ?? false,
    },
    refreshIntervalMin: limits?.refreshInterval ?? 60,
  };
};

/**
 * Yeni rakip eklemeden ÖNCE çağır. Superadmin muaf.
 * Limit aşıldıysa LimitExceededError fırlatır.
 */
export const enforceCompetitorLimit = async (
  userId: string,
  userRole: Role
): Promise<void> => {
  if (userRole === Role.SUPERADMIN) return;
  const usage = await getUsage(userId);
  if (usage.competitors.unlimited) return;
  if (usage.competitors.used >= usage.competitors.max) {
    throw new LimitExceededError(
      'Rakip takibi',
      usage.competitors.used,
      usage.competitors.max
    );
  }
};

/**
 * Sipariş senkronizasyonu sırasında ürün limiti.
 * Hard-cap olarak en fazla kaç YENI ürün yaratılabileceğini döner.
 * Negatif veya sıfır → yeni ürün yaratılamaz.
 *
 * Sınırsız ise Number.POSITIVE_INFINITY döner.
 */
export const remainingProductSlots = async (
  userId: string
): Promise<number> => {
  const usage = await getUsage(userId);
  if (usage.products.unlimited) return Number.POSITIVE_INFINITY;
  return Math.max(0, usage.products.max - usage.products.used);
};
