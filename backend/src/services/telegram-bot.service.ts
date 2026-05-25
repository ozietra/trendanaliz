import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { getUpdates, sendTelegramMessage, getTelegramBotInfo } from '../utils/telegram';

/**
 * Telegram Bot Servisi
 *
 * Long-polling ile 7/24 çalışır. Backend process'in bir parçası olarak
 * SchedulerService.init() içinden başlatılır.
 *
 * Kullanıcılar /start komutuyla Telegram hesaplarını TrendAnaliz'e bağlar.
 * Sonrasında bildirimler (BuyBox, fiyat uyarısı vb.) Telegram'dan da gönderilir.
 */

let running = false;
let lastOffset = 0;

async function handleUpdate(update: any) {
  const message = update.message;
  if (!message?.text || !message?.chat?.id) return;

  const chatId = String(message.chat.id);
  const text = message.text.trim();

  // /start <userId> — hesap bağlama
  if (text.startsWith('/start')) {
    const parts = text.split(' ');
    if (parts.length >= 2) {
      const userId = parts[1];
      try {
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
          await sendTelegramMessage(chatId, '❌ Geçersiz bağlantı kodu. Lütfen TrendAnaliz panelinden yeni kod alın.');
          return;
        }
        await prisma.user.update({
          where: { id: userId },
          data: { telegramChatId: chatId },
        });
        await sendTelegramMessage(
          chatId,
          `✅ Telegram hesabınız başarıyla bağlandı!\n\n👤 Hesap: ${user.name}\n📧 E-posta: ${user.email}\n\nArtık BuyBox, fiyat uyarısı ve sipariş bildirimleri Telegram'dan da gelecektir.`
        );
        logger.info(`Telegram bağlandı: userId=${userId}, chatId=${chatId}`);
      } catch (err) {
        logger.warn(`Telegram /start hatası: ${(err as Error).message}`);
        await sendTelegramMessage(chatId, '❌ Bir hata oluştu. Lütfen tekrar deneyin.');
      }
      return;
    }

    // /start args yok — bilgilendirme
    await sendTelegramMessage(
      chatId,
      '👋 <b>TrendAnaliz Bildirim Botu</b>\n\n'
      + 'Bu bot, TrendAnaliz hesabınızdaki önemli olayları Telegram\'dan bildirir.\n\n'
      + '<b>Nasıl bağlanılır?</b>\n'
      + '1. TrendAnaliz paneline giriş yapın\n'
      + '2. Bildirimler sayfasına gidin\n'
      + '3. "Telegram Bağla" butonuna tıklayın\n\n'
      + '📌 Komutlar:\n'
      + '/durum — Hesap durumunuzu görüntüleyin'
    );
    return;
  }

  // /durum — hesap durumu
  if (text === '/durum') {
    try {
      const user = await prisma.user.findFirst({ where: { telegramChatId: chatId } });
      if (!user) {
        await sendTelegramMessage(chatId, '❌ Telegram hesabınız henüz bir TrendAnaliz hesabına bağlı değil.\n\nBağlamak için TrendAnaliz panelinden "Telegram Bağla" butonuna tıklayın.');
        return;
      }
      const sub = await prisma.subscription.findFirst({
        where: { userId: user.id, status: { in: ['ACTIVE', 'TRIAL'] }, endDate: { gt: new Date() } },
        include: { plan: { select: { name: true } } },
        orderBy: { endDate: 'desc' },
      });
      const store = await prisma.trendyolStore.findFirst({
        where: { userId: user.id },
        include: { _count: { select: { products: true } } },
      });

      let msg = `📊 <b>Hesap Durumu</b>\n\n`;
      msg += `👤 ${user.name}\n`;
      msg += `📧 ${user.email}\n\n`;
      if (sub) {
        const remaining = Math.ceil((sub.endDate.getTime() - Date.now()) / (1000 * 60 * 60));
        msg += `📦 Plan: <b>${sub.plan.name}</b> (${sub.status})\n`;
        msg += `⏱ Kalan: ${remaining} saat\n`;
      } else {
        msg += `📦 Plan: <b>Aktif abonelik yok</b>\n`;
      }
      if (store) {
        msg += `🏪 Mağaza: ${store.storeName}\n`;
        msg += `📋 Ürün: ${store._count.products}\n`;
      }
      await sendTelegramMessage(chatId, msg);
    } catch (err) {
      logger.warn(`Telegram /durum hatası: ${(err as Error).message}`);
      await sendTelegramMessage(chatId, '❌ Durum alınamadı.');
    }
    return;
  }

  // Bilinmeyen komut
  await sendTelegramMessage(
    chatId,
    '🤖 Komut anlaşılamadı.\n\n📌 Kullanılabilir komutlar:\n/start — Hesap bağlama\n/durum — Hesap durumu'
  );
}

/**
 * Long-polling döngüsünü başlatır. Backend process yaşadığı sürece çalışır.
 */
export async function startTelegramBot() {
  if (running) return;
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    logger.info('Telegram bot başlatılmadı (TELEGRAM_BOT_TOKEN ayarlanmamış).');
    return;
  }

  const info = await getTelegramBotInfo();
  if (!info) {
    logger.error('Telegram bot bilgisi alınamadı — token geçersiz olabilir.');
    return;
  }

  running = true;
  logger.info(`Telegram bot başlatıldı: @${info.username} (${info.first_name})`);

  // Long-polling döngüsü
  while (running) {
    try {
      const updates = await getUpdates(lastOffset);
      for (const update of updates) {
        lastOffset = update.update_id + 1;
        handleUpdate(update).catch((e) =>
          logger.warn(`Telegram update işleme hatası: ${e.message}`)
        );
      }
    } catch (err) {
      logger.warn(`Telegram polling hatası: ${(err as Error).message}`);
      await new Promise((r) => setTimeout(r, 5000));
    }
  }
}

export function stopTelegramBot() {
  running = false;
}
