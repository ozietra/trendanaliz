import axios from 'axios';
import { logger } from './logger';

const getApiBase = () => {
  const token = process.env.TELEGRAM_BOT_TOKEN || '';
  return `https://api.telegram.org/bot${token}`;
};

/**
 * Telegram'a mesaj gönderir.
 * chatId: kullanıcının Telegram chat ID'si (User modeline kaydedilir)
 */
export const sendTelegramMessage = async (
  chatId: string,
  text: string,
  options?: { parse_mode?: 'HTML' | 'MarkdownV2' }
): Promise<boolean> => {
  if (!process.env.TELEGRAM_BOT_TOKEN) {
    logger.warn(`Telegram mesajı atlandı (TELEGRAM_BOT_TOKEN ayarlanmamış): chatId=${chatId}`);
    return false;
  }
  try {
    await axios.post(`${getApiBase()}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
    });
    return true;
  } catch (err: any) {
    logger.warn(`Telegram mesaj gönderilemedi (chatId=${chatId}): ${err.response?.data?.description || err.message}`);
    return false;
  }
};

/**
 * Bot bilgisini döner (bağlantı testi).
 */
export const getTelegramBotInfo = async () => {
  if (!process.env.TELEGRAM_BOT_TOKEN) return null;
  try {
    const res = await axios.get(`${getApiBase()}/getMe`);
    return res.data?.result || null;
  } catch (err: any) {
    logger.error(`Telegram getMe hatası: ${err.response?.data?.description || err.message}`);
    return null;
  }
};

/**
 * Gelen update'leri (mesajları) çeker. Long polling ile kullanılır.
 * offset: son işlenen update_id + 1
 */
export const getUpdates = async (offset?: number): Promise<any[]> => {
  if (!process.env.TELEGRAM_BOT_TOKEN) return [];
  const res = await axios.get(`${getApiBase()}/getUpdates`, {
    params: { offset, timeout: 30 },
    timeout: 35000,
  });
  return res.data?.result || [];
};
