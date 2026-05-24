import { Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { createNotification } from '../services/notification.service';
import { Role, PaymentStatus, SubscriptionStatus, NotificationType, PaymentMethod } from '@prisma/client';

/**
 * Süperadmin Panel Controller
 * Tüm action'lar AdminLog tablosuna yazılır.
 */

const logAction = async (
  adminId: string,
  action: string,
  target: string,
  detail: Record<string, unknown> = {}
) => {
  try {
    await prisma.adminLog.create({
      data: { adminId, action, target, detail: detail as any },
    });
  } catch (err) {
    logger.error(`AdminLog yazılamadı: ${(err as Error).message}`);
  }
};

/**
 * GET /api/admin/stats
 */
export const getStats = async (_req: AuthenticatedRequest, res: Response) => {
  try {
    const [userCount, activeSubs, trialSubs, pendingPayments, completedPayments, storeCount, productCount] =
      await Promise.all([
        prisma.user.count(),
        prisma.subscription.count({ where: { status: SubscriptionStatus.ACTIVE } }),
        prisma.subscription.count({ where: { status: SubscriptionStatus.PENDING } }),
        prisma.payment.count({ where: { status: PaymentStatus.PENDING } }),
        prisma.payment.findMany({
          where: { status: PaymentStatus.COMPLETED },
          select: { amount: true, createdAt: true },
        }),
        prisma.trendyolStore.count(),
        prisma.product.count(),
      ]);

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const mrr = completedPayments
      .filter((p) => p.createdAt >= startOfMonth)
      .reduce((s, p) => s + Number(p.amount), 0);
    const totalRevenue = completedPayments.reduce((s, p) => s + Number(p.amount), 0);

    return res.json({
      success: true,
      data: {
        userCount,
        activeSubs,
        trialSubs,
        pendingPayments,
        storeCount,
        productCount,
        mrr: Math.round(mrr * 100) / 100,
        totalRevenue: Math.round(totalRevenue * 100) / 100,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Admin stats hatası: ${error.message}`);
    return res.status(500).json({ success: false, message: 'İstatistikler yüklenemedi.' });
  }
};

/**
 * GET /api/admin/users
 */
export const listUsers = async (req: AuthenticatedRequest, res: Response) => {
  const { q, role, active, page = '1', pageSize = '25' } = req.query as Record<string, string>;
  const where: any = {};
  if (q) {
    where.OR = [
      { email: { contains: q, mode: 'insensitive' } },
      { name: { contains: q, mode: 'insensitive' } },
    ];
  }
  if (role && ['USER', 'ADMIN', 'SUPERADMIN'].includes(role)) where.role = role;
  if (active === 'true') where.isActive = true;
  if (active === 'false') where.isActive = false;

  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  const [total, items] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      skip: (p - 1) * ps,
      take: ps,
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
        subscriptions: {
          where: { status: SubscriptionStatus.ACTIVE },
          select: { status: true, endDate: true, plan: { select: { name: true } } },
          take: 1,
        },
      },
    }),
  ]);

  return res.json({
    success: true,
    data: items,
    pagination: { page: p, pageSize: ps, total, pages: Math.ceil(total / ps) },
  });
};

/**
 * PATCH /api/admin/users/:id
 * Body: { isActive?, role?, name?, phone? }
 */
export const updateUser = async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const { id } = req.params;
  const { isActive, role, name, phone } = req.body as {
    isActive?: boolean;
    role?: Role;
    name?: string;
    phone?: string;
  };

  // Süperadmini kendine veya başka SUPERADMIN'e dokunmaktan koru
  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) {
    return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  }
  if (target.role === Role.SUPERADMIN && target.id !== adminId) {
    return res
      .status(403)
      .json({ success: false, message: 'Diğer süperadmin hesaplarını değiştiremezsiniz.' });
  }
  if (target.id === adminId && (isActive === false || role)) {
    return res
      .status(403)
      .json({ success: false, message: 'Kendi hesabınızın rol/aktiflik durumunu değiştiremezsiniz.' });
  }

  const updated = await prisma.user.update({
    where: { id },
    data: {
      ...(isActive !== undefined ? { isActive } : {}),
      ...(role ? { role } : {}),
      ...(name !== undefined ? { name } : {}),
      ...(phone !== undefined ? { phone } : {}),
    },
  });

  await logAction(adminId, 'USER_UPDATE', id, { changes: { isActive, role, name, phone } });

  return res.json({
    success: true,
    data: {
      id: updated.id,
      email: updated.email,
      role: updated.role,
      isActive: updated.isActive,
    },
  });
};

/**
 * GET /api/admin/plans
 */
export const listPlans = async (_req: AuthenticatedRequest, res: Response) => {
  const plans = await prisma.plan.findMany({
    orderBy: { sortOrder: 'asc' },
    include: {
      _count: { select: { subscriptions: true } },
    },
  });
  return res.json({ success: true, data: plans });
};

/**
 * POST /api/admin/plans
 */
export const createPlan = async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const {
    name,
    slug,
    description,
    price,
    currency = 'TRY',
    billingCycle = 'MONTHLY',
    maxProducts,
    maxCompetitors,
    refreshInterval,
    features = [],
    isActive = true,
    isPopular = false,
    sortOrder = 0,
  } = req.body || {};

  if (!name || !slug || price === undefined) {
    return res
      .status(400)
      .json({ success: false, message: 'name, slug ve price zorunludur.' });
  }

  try {
    const plan = await prisma.plan.create({
      data: {
        name,
        slug,
        description: description || '',
        price,
        currency,
        billingCycle,
        maxProducts: maxProducts ?? 0,
        maxCompetitors: maxCompetitors ?? 0,
        refreshInterval: refreshInterval ?? 60,
        features,
        isActive,
        isPopular,
        sortOrder,
      },
    });
    await logAction(adminId, 'PLAN_CREATE', plan.id, { name, slug, price });
    return res.status(201).json({ success: true, data: plan });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * PUT /api/admin/plans/:id
 */
export const updatePlan = async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const { id } = req.params;
  const allowed = [
    'name',
    'slug',
    'description',
    'price',
    'currency',
    'billingCycle',
    'maxProducts',
    'maxCompetitors',
    'refreshInterval',
    'features',
    'isActive',
    'isPopular',
    'sortOrder',
  ];
  const data: Record<string, unknown> = {};
  for (const k of allowed) {
    if (req.body[k] !== undefined) data[k] = req.body[k];
  }
  try {
    const plan = await prisma.plan.update({ where: { id }, data });
    await logAction(adminId, 'PLAN_UPDATE', id, { changes: data });
    return res.json({ success: true, data: plan });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * DELETE /api/admin/plans/:id
 */
export const deletePlan = async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const { id } = req.params;
  // Aktif aboneliği olan plan silinemez
  const count = await prisma.subscription.count({
    where: { planId: id, status: SubscriptionStatus.ACTIVE },
  });
  if (count > 0) {
    return res.status(409).json({
      success: false,
      message: `Bu planda ${count} aktif abonelik var, silinemez. Önce pasifleştirin.`,
    });
  }
  try {
    await prisma.plan.delete({ where: { id } });
    await logAction(adminId, 'PLAN_DELETE', id, {});
    return res.json({ success: true });
  } catch (err: unknown) {
    const error = err as Error;
    return res.status(400).json({ success: false, message: error.message });
  }
};

/**
 * GET /api/admin/payments
 */
export const listPayments = async (req: AuthenticatedRequest, res: Response) => {
  const { status, q, page = '1', pageSize = '25' } = req.query as Record<string, string>;
  const where: any = {};
  if (status && ['PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'].includes(status)) {
    where.status = status;
  }
  if (q) {
    where.OR = [
      { user: { email: { contains: q, mode: 'insensitive' } } },
      { user: { name: { contains: q, mode: 'insensitive' } } },
      { ibanSenderName: { contains: q, mode: 'insensitive' } },
    ];
  }
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(100, Math.max(1, parseInt(pageSize, 10) || 25));

  const [total, items] = await Promise.all([
    prisma.payment.count({ where }),
    prisma.payment.findMany({
      where,
      skip: (p - 1) * ps,
      take: ps,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { id: true, email: true, name: true } },
        subscription: { include: { plan: { select: { name: true, slug: true } } } },
      },
    }),
  ]);

  return res.json({
    success: true,
    data: items,
    pagination: { page: p, pageSize: ps, total, pages: Math.ceil(total / ps) },
  });
};

/**
 * POST /api/admin/payments/:id/verify
 * Body: { activatePlanId?: string }
 * Manuel IBAN ödemeyi onaylar, isteğe bağlı olarak belirli bir plana abonelik aktive eder.
 */
export const verifyPayment = async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const { id } = req.params;
  const { activatePlanId } = req.body as { activatePlanId?: string };

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) {
    return res.status(404).json({ success: false, message: 'Ödeme bulunamadı.' });
  }
  if (payment.status === PaymentStatus.COMPLETED) {
    return res.status(409).json({ success: false, message: 'Bu ödeme zaten tamamlanmış.' });
  }

  let subscriptionId = payment.subscriptionId;

  if (activatePlanId) {
    const plan = await prisma.plan.findUnique({ where: { id: activatePlanId } });
    if (!plan) {
      return res.status(404).json({ success: false, message: 'Plan bulunamadı.' });
    }
    // Mevcut aktif aboneliği bitir
    await prisma.subscription.updateMany({
      where: {
        userId: payment.userId,
        status: SubscriptionStatus.ACTIVE,
      },
      data: { status: SubscriptionStatus.EXPIRED, autoRenew: false },
    });
    const now = new Date();
    const endDate = new Date(now);
    if (plan.billingCycle === 'YEARLY') endDate.setFullYear(endDate.getFullYear() + 1);
    else endDate.setMonth(endDate.getMonth() + 1);

    const sub = await prisma.subscription.create({
      data: {
        userId: payment.userId,
        planId: plan.id,
        status: SubscriptionStatus.ACTIVE,
        startDate: now,
        endDate,
        autoRenew: true,
      },
    });
    subscriptionId = sub.id;
  }

  await prisma.payment.update({
    where: { id },
    data: {
      status: PaymentStatus.COMPLETED,
      verifiedAt: new Date(),
      verifiedByAdminId: adminId,
      subscriptionId,
    },
  });

  await createNotification({
    userId: payment.userId,
    title: 'Ödemeniz onaylandı',
    message: `₺${Number(payment.amount).toLocaleString('tr-TR')} tutarındaki ödemeniz manuel olarak doğrulandı.`,
    event: 'PAYMENT_SUCCESS',
    type: NotificationType.SUCCESS,
  });

  await logAction(adminId, 'PAYMENT_VERIFY', id, { activatePlanId });
  return res.json({ success: true });
};

/**
 * POST /api/admin/payments/:id/reject
 */
export const rejectPayment = async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const { id } = req.params;
  const { reason } = req.body as { reason?: string };

  const payment = await prisma.payment.findUnique({ where: { id } });
  if (!payment) {
    return res.status(404).json({ success: false, message: 'Ödeme bulunamadı.' });
  }
  if (payment.status === PaymentStatus.COMPLETED) {
    return res.status(409).json({ success: false, message: 'Tamamlanmış ödeme reddedilemez.' });
  }

  await prisma.payment.update({
    where: { id },
    data: { status: PaymentStatus.FAILED },
  });
  await createNotification({
    userId: payment.userId,
    title: 'Ödemeniz reddedildi',
    message: reason || 'Yapılan ödeme doğrulanamadı. Lütfen destek ile iletişime geçin.',
    event: 'PAYMENT_FAILED',
    type: NotificationType.ERROR,
  });

  await logAction(adminId, 'PAYMENT_REJECT', id, { reason });
  return res.json({ success: true });
};

// =========================
// Demo / Trial Subscription Yönetimi
// =========================
//
// Süperadmin, herhangi bir kullanıcıya N günlük (1-90) "TRIAL" durumunda
// abonelik tanımlayabilir. Bu abonelik:
//   - status = TRIAL
//   - paymentMethod = MANUAL (kayda değer ödeme yok)
//   - autoRenew = false (süre bitince otomatik iptal)
//   - endDate = now + days
//
// Kullanıcının mevcut ACTIVE/TRIAL aboneliği varsa önce EXPIRED edilir.
// AdminLog'a yazılır + kullanıcıya bilgilendirme bildirimi gider.

/**
 * POST /api/admin/users/:id/grant-trial
 * Body: { planId: string, days: number (1-90) }
 */
export const grantTrial = async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const userId = req.params.id;
  const { planId, days } = req.body as { planId?: string; days?: number };

  if (!planId || !days || days < 1 || days > 90) {
    return res.status(400).json({
      success: false,
      message: 'planId zorunlu ve days 1-90 arasında olmalıdır.',
    });
  }

  const [user, plan] = await Promise.all([
    prisma.user.findUnique({ where: { id: userId }, select: { id: true, email: true, name: true } }),
    prisma.plan.findUnique({ where: { id: planId }, select: { id: true, name: true, isActive: true } }),
  ]);
  if (!user) {
    return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  }
  if (!plan) {
    return res.status(404).json({ success: false, message: 'Plan bulunamadı.' });
  }

  const now = new Date();
  const endDate = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

  // Mevcut aktif/trial aboneliği bitir
  await prisma.subscription.updateMany({
    where: {
      userId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
    },
    data: { status: SubscriptionStatus.EXPIRED, autoRenew: false },
  });

  const sub = await prisma.subscription.create({
    data: {
      userId,
      planId: plan.id,
      status: SubscriptionStatus.TRIAL,
      startDate: now,
      endDate,
      autoRenew: false,
      paymentMethod: PaymentMethod.MANUAL,
    },
  });

  await createNotification({
    userId,
    title: 'Demo aboneliğiniz aktive edildi',
    message: `${plan.name} planı ${days} gün süreyle hesabınıza tanımlandı. Bitiş tarihi: ${endDate.toLocaleDateString('tr-TR')}.`,
    event: 'PAYMENT_SUCCESS',
    type: NotificationType.SUCCESS,
    linkUrl: '/dashboard',
  });

  await logAction(adminId, 'TRIAL_GRANT', userId, {
    planId,
    days,
    endDate: endDate.toISOString(),
    subscriptionId: sub.id,
  });

  return res.json({
    success: true,
    message: `${user.email} için ${days} günlük demo (${plan.name}) tanımlandı.`,
    data: { subscriptionId: sub.id, endDate },
  });
};

/**
 * POST /api/admin/users/:id/cancel-subscription
 * Body: { reason?: string }
 *
 * Kullanıcının aktif/trial aboneliğini hemen sonlandırır (CANCELLED).
 * Geri ödeme oluşturmaz — sadece erişimi kapatır.
 */
export const cancelUserSubscription = async (
  req: AuthenticatedRequest,
  res: Response
) => {
  const adminId = req.user!.id;
  const userId = req.params.id;
  const { reason } = req.body as { reason?: string };

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true },
  });
  if (!user) {
    return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
  }

  const result = await prisma.subscription.updateMany({
    where: {
      userId,
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIAL] },
    },
    data: { status: SubscriptionStatus.CANCELLED, autoRenew: false, endDate: new Date() },
  });

  if (result.count === 0) {
    return res.status(404).json({
      success: false,
      message: 'Bu kullanıcının aktif veya demo aboneliği yok.',
    });
  }

  await createNotification({
    userId,
    title: 'Aboneliğiniz iptal edildi',
    message: reason || 'Aboneliğiniz yönetici tarafından sonlandırıldı.',
    event: 'SUBSCRIPTION_EXPIRED',
    type: NotificationType.WARNING,
  });

  await logAction(adminId, 'SUBSCRIPTION_CANCEL', userId, { reason, count: result.count });

  return res.json({
    success: true,
    message: `${user.email} için ${result.count} abonelik iptal edildi.`,
  });
};

/**
 * GET /api/admin/settings
 */
export const getSettings = async (_req: AuthenticatedRequest, res: Response) => {
  const settings = await prisma.siteSettings.findMany();
  return res.json({ success: true, data: settings });
};

/**
 * PUT /api/admin/settings/:key
 * Body: { value: any }
 * Anahtar yoksa oluşturur, varsa günceller.
 */
export const upsertSetting = async (req: AuthenticatedRequest, res: Response) => {
  const adminId = req.user!.id;
  const { key } = req.params;
  const { value } = req.body || {};
  if (value === undefined) {
    return res.status(400).json({ success: false, message: 'value gerekli.' });
  }
  const setting = await prisma.siteSettings.upsert({
    where: { key },
    create: { key, value, updatedByAdminId: adminId },
    update: { value, updatedByAdminId: adminId },
  });
  await logAction(adminId, 'SETTING_UPDATE', key, { value });
  return res.json({ success: true, data: setting });
};

/**
 * GET /api/admin/logs
 */
export const listLogs = async (req: AuthenticatedRequest, res: Response) => {
  const { page = '1', pageSize = '50' } = req.query as Record<string, string>;
  const p = Math.max(1, parseInt(page, 10) || 1);
  const ps = Math.min(200, Math.max(1, parseInt(pageSize, 10) || 50));

  const [total, items] = await Promise.all([
    prisma.adminLog.count(),
    prisma.adminLog.findMany({
      skip: (p - 1) * ps,
      take: ps,
      orderBy: { createdAt: 'desc' },
      include: { admin: { select: { email: true, name: true } } },
    }),
  ]);

  return res.json({
    success: true,
    data: items,
    pagination: { page: p, pageSize: ps, total, pages: Math.ceil(total / ps) },
  });
};
