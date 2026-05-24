import { SubscriptionStatus } from '@prisma/client';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { createNotification } from './notification.service';

/**
 * Abonelik Cron Servisi
 *
 * Sorumluluklar:
 *  1) Bitişine 3 gün kalan aktif abonelikler için "yenileme yaklaşıyor" bildirimi
 *  2) endDate geçmiş aktif abonelikleri EXPIRED'a çek + bildirim gönder
 *
 * Çalışma sıklığı: günde 1 kere yeterli (varsayılan 6 saat = idempotent).
 * createNotification kendi içinde duplicate engellemiyor; o yüzden
 * "uyarı bayrağı" için Notification tablosunda son 3 gündeki aynı isimli
 * bildirimi kontrol ediyoruz.
 */

const CHECK_INTERVAL_MS = Number(
  process.env.SUBSCRIPTION_CRON_INTERVAL_MS || 6 * 60 * 60 * 1000 // 6 saat
);

const REMINDER_TITLE = 'Aboneliğiniz yakında sona eriyor';
const EXPIRED_TITLE = 'Aboneliğiniz sona erdi';

let timer: NodeJS.Timeout | null = null;

/**
 * Bitişine 3 gün veya daha az kalan aktif abonelikleri tespit eder ve
 * son 3 günde benzeri bildirim almamış kullanıcılara hatırlatma gönderir.
 */
const sendExpiringReminders = async () => {
  const now = new Date();
  const threeDaysLater = new Date(now);
  threeDaysLater.setDate(threeDaysLater.getDate() + 3);

  const subs = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      endDate: { gte: now, lte: threeDaysLater },
    },
    include: { plan: true, user: { select: { id: true, name: true } } },
  });

  for (const sub of subs) {
    // Bu kullanıcı için son 3 gün içinde aynı bildirim atıldı mı?
    const recent = await prisma.notification.findFirst({
      where: {
        userId: sub.userId,
        title: REMINDER_TITLE,
        createdAt: { gte: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000) },
      },
      select: { id: true },
    });
    if (recent) continue;

    const remainingDays = Math.max(
      1,
      Math.ceil((sub.endDate.getTime() - now.getTime()) / (24 * 60 * 60 * 1000))
    );

    try {
      await createNotification({
        userId: sub.userId,
        title: REMINDER_TITLE,
        message: `${sub.plan.name} planınız ${remainingDays} gün içinde sona eriyor. Hizmeti kesintisiz kullanmaya devam etmek için lütfen aboneliğinizi yenileyin.`,
        event: 'SUBSCRIPTION_EXPIRING',
        type: 'WARNING',
        smsText: `Aboneliğiniz ${remainingDays} gün sonra sona eriyor. Yenilemek için TrendAnaliz panelinize giriş yapın.`,
      });
      logger.info(
        `Yenileme hatırlatması gönderildi (user=${sub.userId}, plan=${sub.plan.slug}, kalan=${remainingDays}g)`
      );
    } catch (err) {
      logger.warn(
        `Yenileme hatırlatması gönderilemedi (user=${sub.userId}): ${(err as Error).message}`
      );
    }
  }
};

/**
 * endDate geçmiş aktif abonelikleri EXPIRED işaretle ve kullanıcıyı bilgilendir.
 */
const expireOverdueSubscriptions = async () => {
  const now = new Date();

  const overdue = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.ACTIVE,
      endDate: { lt: now },
    },
    include: { plan: { select: { name: true, slug: true } } },
  });

  if (overdue.length === 0) return;

  // Toplu güncelleme
  await prisma.subscription.updateMany({
    where: { id: { in: overdue.map((s) => s.id) } },
    data: { status: SubscriptionStatus.EXPIRED, autoRenew: false },
  });

  // Tek tek bildirim
  for (const sub of overdue) {
    try {
      await createNotification({
        userId: sub.userId,
        title: EXPIRED_TITLE,
        message: `${sub.plan.name} planınızın süresi doldu. Hizmetlere yeniden erişmek için aboneliğinizi yenilemeniz gerekiyor.`,
        event: 'SUBSCRIPTION_EXPIRED',
        type: 'ERROR',
        smsText: `Aboneliğiniz sona erdi. Yenilemek için TrendAnaliz panelinize giriş yapın.`,
      });
      logger.info(`Abonelik sona erdi bildirimi gönderildi (user=${sub.userId})`);
    } catch (err) {
      logger.warn(`Bildirim gönderilemedi (user=${sub.userId}): ${(err as Error).message}`);
    }
  }
};

/**
 * Tek tur cron işi.
 */
export const runSubscriptionCron = async (): Promise<void> => {
  try {
    await expireOverdueSubscriptions();
    await sendExpiringReminders();
  } catch (err) {
    logger.error(`Abonelik cron hatası: ${(err as Error).message}`);
  }
};

/**
 * Periyodik döngüyü başlatır. Birden fazla kez çağrılırsa eskiyi durdurur.
 * - Açılışta 30 sn sonra ilk tetikleme
 * - Sonra her CHECK_INTERVAL_MS aralığında çalışır
 */
export const startSubscriptionCron = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }
  setTimeout(runSubscriptionCron, 30_000);
  timer = setInterval(runSubscriptionCron, CHECK_INTERVAL_MS);
  logger.info(
    `Abonelik cron başlatıldı (her ${Math.round(CHECK_INTERVAL_MS / 60000)} dk).`
  );
};

export const stopSubscriptionCron = (): void => {
  if (timer) {
    clearInterval(timer);
    timer = null;
    logger.info('Abonelik cron durduruldu.');
  }
};
