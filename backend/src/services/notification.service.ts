import { prisma } from '../config/database';
import { publishToUser } from './realtime.service';
import { logger } from '../utils/logger';
import { NotificationType } from '@prisma/client';
import { sendMail } from '../utils/mailer';
import { sendSms } from '../utils/sms';

/**
 * Bildirim Servisi (channel-aware).
 *
 * Sorumluluklar:
 *  1) DB'ye Notification kaydı yazar (her zaman)
 *  2) IN_APP kanalına SSE push gönderir (anlık dropdown)
 *  3) EMAIL kanalı seçildiyse kullanıcının e-posta adresine gönderim yapar
 *  4) SMS kanalı seçildiyse kullanıcının telefonuna gönderim yapar
 *
 * Kanal kararı şu öncelikle alınır:
 *  a) Çağıranın açıkça belirttiği `channel` listesi varsa o kullanılır
 *  b) Aksi halde User.notificationPrefs[event] kullanılır
 *  c) Hiçbiri yoksa DEFAULT_PREFS[event] (bu dosyanın altında) kullanılır
 *  d) Hiçbiri eşleşmezse sadece IN_APP gönderilir (en güvenli varsayılan)
 *
 * `event` parametresi kullanıcı tercihlerini aramak için kullanılır.
 * Örnek event isimleri: 'PRICE_ALERT', 'BUYBOX_LOST', 'NEW_ORDER',
 * 'STOCK_LOW', 'SUBSCRIPTION_EXPIRING', 'PAYMENT_FAILED' vs.
 */

export type NotificationChannel = 'IN_APP' | 'EMAIL' | 'SMS';

/**
 * Yeni kullanıcılar için varsayılan bildirim tercihleri.
 * Aşırı yüklemeyecek şekilde seçilmiş — her şey IN_APP'e düşer; sadece
 * iş açısından kritik konular (BuyBox kaybı, ödeme, sipariş) e-posta da alır.
 */
// NOT: E-posta/SMS sağlayıcı entegrasyonu üretim için aktif edilene kadar
// tüm olaylar yalnızca IN_APP kanalı üzerinden gider. Sağlayıcılar
// (Postmark, Twilio, NetGSM vb.) yapılandırıldığında bu tablo aşağıdaki
// şekilde genişletilebilir:
//   BUYBOX_LOST: ['IN_APP', 'EMAIL']
//   NEW_ORDER:   ['IN_APP', 'EMAIL']
//   PAYMENT_*  : ['IN_APP', 'EMAIL']
//
// Şu an IN_APP-only güvenli varsayılan. Frontend tercih ekranı da
// EMAIL/SMS toggle'larını gizleyecek (bkz. BildirimAyarlari sayfası).
export const DEFAULT_PREFS: Record<string, NotificationChannel[]> = {
  // Ürün/Fiyat
  PRICE_ALERT: ['IN_APP'],
  BUYBOX_LOST: ['IN_APP'],
  BUYBOX_WON: ['IN_APP'],
  STOCK_LOW: ['IN_APP'],

  // Sipariş
  NEW_ORDER: ['IN_APP'],
  ORDER_CANCELLED: ['IN_APP'],

  // Abonelik & Ödeme
  SUBSCRIPTION_EXPIRING: ['IN_APP'],
  SUBSCRIPTION_EXPIRED: ['IN_APP'],
  PAYMENT_SUCCESS: ['IN_APP'],
  PAYMENT_FAILED: ['IN_APP'],

  // Sistem
  SYSTEM: ['IN_APP'],
};

interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type?: NotificationType;
  /**
   * Doğrudan kanalları belirtmek için. Genellikle çağıran burayı boş bırakıp
   * `event` adıyla kullanıcı tercihlerini kullanır.
   */
  channel?: NotificationChannel[];
  /**
   * Bildirim olay tipi — kullanıcının tercihlerine bakmak için anahtar.
   * Örn: 'BUYBOX_LOST', 'NEW_ORDER'.
   */
  event?: string;
  /**
   * SMS kısa metni (varsa). Verilmezse `${title}: ${message}` türetilir.
   */
  smsText?: string;
  /**
   * E-posta HTML body (varsa). Verilmezse basit bir şablon türetilir.
   */
  emailHtml?: string;
  /**
   * Bildirime tıklanınca yönlenecek frontend URL'i.
   * Örn: '/dashboard/siparisler/<id>', '/dashboard/buybox'
   */
  linkUrl?: string;
}

/**
 * Hangi kanallara gönderim yapılacağını çözümler.
 */
const resolveChannels = (
  prefs: unknown,
  event: string | undefined,
  override: NotificationChannel[] | undefined
): NotificationChannel[] => {
  if (override && override.length > 0) {
    return Array.from(new Set(override));
  }
  if (event) {
    // Kullanıcı tercihi
    if (
      prefs &&
      typeof prefs === 'object' &&
      Array.isArray((prefs as Record<string, unknown>)[event])
    ) {
      const userChans = (prefs as Record<string, unknown>)[event] as string[];
      const valid = userChans.filter((c): c is NotificationChannel =>
        ['IN_APP', 'EMAIL', 'SMS'].includes(c)
      );
      if (valid.length > 0) return valid;
    }
    if (DEFAULT_PREFS[event]) return DEFAULT_PREFS[event];
  }
  return ['IN_APP'];
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const defaultEmailHtml = (title: string, message: string) => `
  <div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
    <div style="background:#0b1424;color:#fff;padding:16px 20px;border-radius:8px 8px 0 0">
      <h2 style="margin:0;font-size:18px">${escapeHtml(title)}</h2>
    </div>
    <div style="background:#f7f9fc;padding:20px;border-radius:0 0 8px 8px;color:#1a2b4a;font-size:14px;line-height:1.6">
      <p style="margin:0">${escapeHtml(message)}</p>
      <p style="margin-top:24px;font-size:11px;color:#7c8b9c">
        Bu bildirimi e-posta yerine arayüzde almak isterseniz hesap ayarlarınızdan bildirim tercihlerinizi düzenleyebilirsiniz.
      </p>
    </div>
  </div>
`;

/**
 * Tek nokta bildirim oluşturucu — channel-aware.
 */
export const createNotification = async (input: CreateNotificationInput) => {
  // Kullanıcıyı tercihler ve iletişim için çek
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true, phone: true, notificationPrefs: true },
  });
  if (!user) {
    logger.warn(`createNotification: kullanıcı bulunamadı (id=${input.userId})`);
    return null;
  }

  const channels = resolveChannels(user.notificationPrefs, input.event, input.channel);

  let notif;
  try {
    notif = await prisma.notification.create({
      data: {
        userId: input.userId,
        title: input.title,
        message: input.message,
        type: input.type || NotificationType.INFO,
        channel: channels,
        linkUrl: input.linkUrl ?? null,
      },
    });
  } catch (err) {
    logger.error(`createNotification (DB) hatası: ${(err as Error).message}`);
    throw err;
  }

  // 1) IN_APP — DB'ye yazıldı; SSE ile dropdown'u canlı güncelle
  if (channels.includes('IN_APP')) {
    try {
      publishToUser(input.userId, 'notification', {
        id: notif.id,
        title: notif.title,
        message: notif.message,
        type: notif.type,
        linkUrl: notif.linkUrl,
        createdAt: notif.createdAt,
        isRead: false,
      });
    } catch (err) {
      logger.warn(`SSE push başarısız: ${(err as Error).message}`);
    }
  }

  // 2) EMAIL — fire-and-forget; bildirimin DB kaydı zaten var
  if (channels.includes('EMAIL') && user.email) {
    void sendMail({
      to: user.email,
      subject: input.title,
      html: input.emailHtml || defaultEmailHtml(input.title, input.message),
    }).catch((err) => logger.warn(`E-posta bildirim hatası: ${err.message}`));
  }

  // 3) SMS — fire-and-forget
  if (channels.includes('SMS') && user.phone) {
    const smsBody = input.smsText || `${input.title}: ${input.message}`.slice(0, 300);
    void sendSms({ to: user.phone, message: smsBody }).catch((err) =>
      logger.warn(`SMS bildirim hatası: ${err.message}`)
    );
  } else if (channels.includes('SMS') && !user.phone) {
    logger.info(
      `SMS bildirimi atlandı (kullanıcı=${input.userId}): telefon numarası tanımlı değil.`
    );
  }

  return notif;
};

/**
 * Kullanıcının bildirim tercihlerini ekran için döner.
 * DEFAULT_PREFS üzerine kullanıcı tercihlerini bindirip eksiksiz bir nesne sağlar.
 */
export const getUserNotificationPrefs = async (
  userId: string
): Promise<Record<string, NotificationChannel[]>> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  const result: Record<string, NotificationChannel[]> = {};
  for (const event of Object.keys(DEFAULT_PREFS)) {
    result[event] = DEFAULT_PREFS[event];
  }
  const userPrefs = user?.notificationPrefs;
  if (userPrefs && typeof userPrefs === 'object') {
    for (const [event, chans] of Object.entries(userPrefs as Record<string, unknown>)) {
      if (Array.isArray(chans)) {
        const valid = (chans as string[]).filter((c): c is NotificationChannel =>
          ['IN_APP', 'EMAIL', 'SMS'].includes(c)
        );
        result[event] = valid;
      }
    }
  }
  return result;
};

/**
 * Kullanıcının bildirim tercihlerini günceller (kısmî yamalama).
 * Sadece DEFAULT_PREFS'te tanımlı bilinen olay türleri kabul edilir.
 * Geçersiz kanal girişleri filtrelenir.
 */
export const updateUserNotificationPrefs = async (
  userId: string,
  patch: Record<string, string[]>
): Promise<Record<string, NotificationChannel[]>> => {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { notificationPrefs: true },
  });
  const current = (user?.notificationPrefs && typeof user.notificationPrefs === 'object'
    ? (user.notificationPrefs as Record<string, unknown>)
    : {}) as Record<string, NotificationChannel[]>;

  const next = { ...current };
  for (const [event, chans] of Object.entries(patch)) {
    if (!(event in DEFAULT_PREFS)) continue; // bilinmeyen olayları görmezden gel
    const valid = (chans || [])
      .filter((c) => typeof c === 'string')
      .filter((c): c is NotificationChannel =>
        ['IN_APP', 'EMAIL', 'SMS'].includes(c)
      );
    next[event] = valid;
  }

  await prisma.user.update({
    where: { id: userId },
    data: { notificationPrefs: next as unknown as object },
  });
  return getUserNotificationPrefs(userId);
};
