import axios from 'axios';
import { logger } from './logger';

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || '';
const API_BASE = `https://api.telegram.org/bot${BOT_TOKEN}`;

/**
 * Telegram'a mesaj gönderir.
 * chatId: kullanıcının Telegram chat ID'si (User modeline kaydedilir)
 */
export const sendTelegramMessage = async (
  chatId: string,
  text: string,
  options?: { parse_mode?: 'HTML' | 'MarkdownV2' }
): Promise<boolean> => {
  if (!BOT_TOKEN) {
    logger.warn(`Telegram mesajı atlandı (TELEGRAM_BOT_TOKEN ayarlanmamış): chatId=${chatId}`);
    return false;
  }
  try {
    await axios.post(`${API_BASE}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: options?.parse_mode || 'HTML',
    });
    return true;
  } catch (err) {
    logger.warn(`Telegram mesaj gönderilemedi (chatId=${chatId}): ${(err as Error).message}`);
    return false;
  }
};

/**
 * Bot bilgisini döner (bağlantı testi).
 */
export const getTelegramBotInfo = async () => {
  if (!BOT_TOKEN) return null;
  try {
    const res = await axios.get(`${API_BASE}/getMe`);
    return res.data?.result || null;
  } catch {
    return null;
  }
};

/**
 * Gelen update'leri (mesajları) çeker. Long polling ile kullanılır.
 * offset: son işlenen update_id + 1
 */
export const getUpdates = async (offset?: number): Promise<any[]> => {
  if (!BOT_TOKEN) return [];
  try {
    const res = await axios.get(`${API_BASE}/getUpdates`, {
      params: { offset, timeout: 30 },
      timeout: 35000,
    });
    return res.data?.result || [];
  } catch {
    return [];
  }
};
