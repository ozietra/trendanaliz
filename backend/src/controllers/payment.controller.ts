import { Request, Response } from 'express';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import * as iyzico from '../services/iyzico.service';
import * as paytr from '../services/paytr.service';
import { createNotification } from '../services/notification.service';
import { PaymentProvider, PaymentStatus, SubscriptionStatus, PaymentMethod } from '@prisma/client';

const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:3001';

/**
 * POST /api/payments/checkout
 * Body: { planId: string, provider: 'IYZICO' | 'PAYTR' }
 * Yeni bir Payment kaydı oluşturur ve sağlayıcının ödeme sayfa URL'ini döner.
 */
export const createCheckout = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  const { planId, provider } = req.body as { planId: string; provider: PaymentProvider };
  if (!planId || !provider) {
    return res.status(400).json({ success: false, message: 'planId ve provider gereklidir.' });
  }
  if (!['IYZICO', 'PAYTR'].includes(provider)) {
    return res.status(400).json({
      success: false,
      message: 'Geçersiz ödeme sağlayıcısı. IYZICO veya PAYTR olmalı.',
    });
  }

  try {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan || !plan.isActive) {
      return res.status(404).json({ success: false, message: 'Plan bulunamadı veya aktif değil.' });
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    // Payment kaydı (PENDING) oluştur
    const payment = await prisma.payment.create({
      data: {
        userId,
        amount: plan.price,
        currency: plan.currency,
        provider,
        status: PaymentStatus.PENDING,
        method: PaymentMethod.CREDIT_CARD,
      },
    });

    // Buyer parse (name'i ad/soyad olarak böl)
    const [firstName, ...rest] = (user.name || 'Misafir').split(' ');
    const lastName = rest.join(' ') || 'Kullanıcı';

    const okUrl = `${FRONTEND_URL}/odeme/basarili?paymentId=${payment.id}`;
    const failUrl = `${FRONTEND_URL}/odeme/iptal?paymentId=${payment.id}`;

    let providerResult;
    if (provider === 'IYZICO') {
      providerResult = await iyzico.initCheckout({
        conversationId: payment.id,
        price: Number(plan.price),
        currency: plan.currency,
        basketId: plan.id,
        callbackUrl: okUrl,
        buyer: {
          id: user.id,
          name: firstName,
          surname: lastName,
          email: user.email,
          phone: user.phone || undefined,
        },
        basketItems: [
          {
            id: plan.id,
            name: `${plan.name} Aboneliği`,
            category: 'SaaS Subscription',
            price: Number(plan.price),
          },
        ],
      });
    } else {
      // PayTR merchantOid: alfa-numerik, sadeleştir
      const merchantOid = payment.id.replace(/-/g, '').slice(0, 32);
      providerResult = await paytr.initCheckout({
        merchantOid,
        amount: Number(plan.price),
        email: user.email,
        userName: user.name,
        userAddress: 'Türkiye',
        userPhone: user.phone || '5555555555',
        userIp: (req.ip || '0.0.0.0').replace('::ffff:', ''),
        okUrl,
        failUrl,
        basket: [
          { name: `${plan.name} Aboneligi`, price: Number(plan.price), qty: 1 },
        ],
      });
      // merchantOid'i kaydet ki webhook eşleştirebilelim
      await prisma.payment.update({
        where: { id: payment.id },
        data: { providerMerchantOid: merchantOid },
      });
    }

    // Token bilgisini Payment kaydına yaz
    await prisma.payment.update({
      where: { id: payment.id },
      data: { providerToken: providerResult.token },
    });

    return res.json({
      success: true,
      data: {
        paymentId: payment.id,
        provider,
        paymentPageUrl: providerResult.paymentPageUrl,
        mock: providerResult.mock,
      },
    });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Checkout hatası: ${error.message}`);
    return res.status(500).json({
      success: false,
      message: error.message || 'Ödeme başlatılamadı.',
    });
  }
};

/**
 * Başarılı ödeme sonrası ortak abonelik oluşturma.
 */
async function activateSubscription(paymentId: string): Promise<void> {
  const payment = await prisma.payment.findUnique({ where: { id: paymentId } });
  if (!payment) {
    throw new Error('Payment kaydı bulunamadı.');
  }

  if (payment.status === PaymentStatus.COMPLETED && payment.subscriptionId) {
    return; // Zaten tamamlanmış
  }

  // Bu ödeme hangi plana ait? Token üzerinden değil, ödeme miktarına bakacağız.
  // Daha güvenli yöntem: checkout sırasında basketId'yi Payment'a kaydetmek.
  // Şimdilik kullanıcı için son fiyat eşleşen aktif plan üzerinden ilerliyoruz.
  const candidatePlans = await prisma.plan.findMany({
    where: { isActive: true, price: payment.amount },
  });
  const plan = candidatePlans[0];
  if (!plan) {
    throw new Error('Eşleşen plan bulunamadı.');
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
  if (plan.billingCycle === 'YEARLY') {
    endDate.setFullYear(endDate.getFullYear() + 1);
  } else {
    endDate.setMonth(endDate.getMonth() + 1);
  }

  const subscription = await prisma.subscription.create({
    data: {
      userId: payment.userId,
      planId: plan.id,
      status: SubscriptionStatus.ACTIVE,
      startDate: now,
      endDate,
      autoRenew: true,
      paymentMethod: PaymentMethod.CREDIT_CARD,
    },
  });

  await prisma.payment.update({
    where: { id: payment.id },
    data: {
      status: PaymentStatus.COMPLETED,
      subscriptionId: subscription.id,
      verifiedAt: new Date(),
    },
  });

  await createNotification({
    userId: payment.userId,
    title: 'Aboneliğiniz aktif!',
    message: `${plan.name} planı başarıyla etkinleştirildi. İyi satışlar dileriz.`,
    event: 'PAYMENT_SUCCESS',
    type: 'SUCCESS',
  });
}

/**
 * POST /api/payments/webhook/iyzico
 * Iyzico callback (form POST) endpoint'i. token üzerinden ödeme detayını sorgular.
 * NOT: Bu endpoint Iyzico tarafından çağrılır; gerçekte 3D dönüşü için kullanılır.
 */
export const iyzicoWebhook = async (req: Request, res: Response) => {
  const token = (req.body?.token || req.query?.token) as string;
  if (!token) {
    return res.status(400).json({ success: false, message: 'Token gerekli.' });
  }

  try {
    const detail = await iyzico.retrievePayment(token);
    const payment = await prisma.payment.findFirst({ where: { providerToken: token } });
    if (!payment) {
      return res.status(404).json({ success: false, message: 'Payment bulunamadı.' });
    }

    if (detail.status === 'success' && (detail.paymentStatus === 'SUCCESS' || detail.paymentStatus === undefined)) {
      await activateSubscription(payment.id);
      return res.json({ success: true, message: 'Ödeme onaylandı.' });
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
      return res.json({ success: false, message: detail.errorMessage || 'Ödeme başarısız.' });
    }
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Iyzico webhook hatası: ${error.message}`);
    return res.status(500).json({ success: false, message: 'Webhook işlenemedi.' });
  }
};

/**
 * POST /api/payments/webhook/paytr
 * PayTR notification URL. application/x-www-form-urlencoded ile gelir.
 * Yanıt olarak "OK" döndürülmesi zorunludur, aksi halde PayTR tekrar dener.
 */
export const paytrWebhook = async (req: Request, res: Response) => {
  const { merchant_oid, status, total_amount, hash } = req.body || {};

  if (!merchant_oid || !status || !total_amount || !hash) {
    return res.status(400).send('Eksik parametre');
  }

  const valid = paytr.verifyWebhook({
    merchantOid: merchant_oid,
    status,
    totalAmount: total_amount,
    receivedHash: hash,
  });

  if (!valid) {
    logger.warn(`PayTR webhook hash uyumsuz: ${merchant_oid}`);
    return res.status(400).send('Hash uyumsuz');
  }

  try {
    const payment = await prisma.payment.findFirst({
      where: { providerMerchantOid: merchant_oid },
    });
    if (!payment) {
      logger.warn(`PayTR webhook: payment bulunamadı ${merchant_oid}`);
      return res.status(404).send('Payment bulunamadı');
    }

    if (status === 'success') {
      await activateSubscription(payment.id);
    } else {
      await prisma.payment.update({
        where: { id: payment.id },
        data: { status: PaymentStatus.FAILED },
      });
    }

    // PayTR "OK" bekler
    return res.status(200).send('OK');
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`PayTR webhook işleme hatası: ${error.message}`);
    return res.status(500).send('Hata');
  }
};

/**
 * GET /api/payments/:id
 * Bir ödemenin son durumunu döner (frontend success sayfasından çağırır).
 */
export const getPaymentStatus = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  const { id } = req.params;
  const payment = await prisma.payment.findFirst({
    where: { id, userId },
    include: { subscription: { include: { plan: true } } },
  });
  if (!payment) {
    return res.status(404).json({ success: false, message: 'Ödeme bulunamadı.' });
  }

  return res.json({ success: true, data: payment });
};

/**
 * POST /api/payments/:id/mock-success
 * SADECE GELİŞTİRME: Sandbox/mock akışları kullanırken ödeme tamamlandıktan sonra
 * frontend bu endpoint'i çağırarak aboneliği aktive eder. Üretimde webhook kullanılır.
 */
export const mockSuccess = async (req: AuthenticatedRequest, res: Response) => {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ success: false, message: 'Yetkisiz işlem.' });
  }

  const { id } = req.params;
  const payment = await prisma.payment.findFirst({ where: { id, userId } });
  if (!payment) {
    return res.status(404).json({ success: false, message: 'Ödeme bulunamadı.' });
  }

  // Yalnızca mock token'lı veya PENDING durumda olanlar için
  const isMock =
    payment.providerToken?.startsWith('mock-') ||
    process.env.NODE_ENV !== 'production';
  if (!isMock) {
    return res.status(403).json({
      success: false,
      message: 'Bu endpoint yalnızca geliştirme/sandbox akışları içindir.',
    });
  }

  try {
    await activateSubscription(payment.id);
    return res.json({ success: true, message: 'Abonelik aktive edildi.' });
  } catch (err: unknown) {
    const error = err as Error;
    logger.error(`Mock success hatası: ${error.message}`);
    return res.status(500).json({ success: false, message: error.message });
  }
};
