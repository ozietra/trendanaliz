import axios from 'axios';
import { logger } from './logger';

/**
 * SMS Gönderim Adaptörü
 *
 * Çoklu sağlayıcı destekler — şu anda Netgsm ve Twilio. Sağlayıcı seçimi
 * SMS_PROVIDER ortam değişkeni ile yapılır:
 *
 *  - SMS_PROVIDER=netgsm  (varsayılan, TR pazarına uygun)
 *      NETGSM_USERCODE=...
 *      NETGSM_PASSWORD=...
 *      NETGSM_HEADER=...        (msgheader / onaylı başlık)
 *  - SMS_PROVIDER=twilio
 *      TWILIO_ACCOUNT_SID=...
 *      TWILIO_AUTH_TOKEN=...
 *      TWILIO_FROM=...
 *
 * Hiçbir sağlayıcı yapılandırılmamışsa MOCK modda çalışır:
 * SMS içeriği loga yazılır, başarılı kabul edilir. Bu sayede development
 * ve test ortamlarında entegrasyon güvenle çalışır.
 */

const PROVIDER = (process.env.SMS_PROVIDER || 'netgsm').toLowerCase();

const NETGSM_USERCODE = process.env.NETGSM_USERCODE || '';
const NETGSM_PASSWORD = process.env.NETGSM_PASSWORD || '';
const NETGSM_HEADER = process.env.NETGSM_HEADER || '';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_FROM = process.env.TWILIO_FROM || '';

export interface SmsOptions {
  to: string;
  message: string;
}

/**
 * Telefon numarasını E.164 formatına yakın bir biçime normalize eder.
 *  - Boşluk/parantez/tire temizler
 *  - Türkiye numaralarında 0 ile başlıyorsa +90 ekler
 */
const normalizePhone = (raw: string): string => {
  const cleaned = raw.replace(/[\s\-()]/g, '');
  if (cleaned.startsWith('+')) return cleaned;
  if (cleaned.startsWith('00')) return '+' + cleaned.slice(2);
  if (cleaned.startsWith('0')) return '+90' + cleaned.slice(1);
  if (cleaned.length === 10) return '+90' + cleaned;
  return cleaned;
};

/**
 * Genel SMS gönderici. Kullandığınız tek API.
 * Hiç bir sağlayıcı yapılandırılmamışsa MOCK modunda log yazıp true döner.
 */
export const sendSms = async (opts: SmsOptions): Promise<boolean> => {
  const phone = normalizePhone(opts.to);
  if (!phone || opts.message.trim().length === 0) {
    logger.warn('SMS gönderilemedi: telefon veya mesaj boş.');
    return false;
  }

  try {
    if (PROVIDER === 'netgsm' && NETGSM_USERCODE && NETGSM_PASSWORD) {
      return await sendViaNetgsm(phone, opts.message);
    }
    if (PROVIDER === 'twilio' && TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && TWILIO_FROM) {
      return await sendViaTwilio(phone, opts.message);
    }

    // MOCK akış: yapılandırma yoksa logla ve geç
    logger.info(`[SMS-MOCK] To: ${phone} | Msg: ${opts.message}`);
    return true;
  } catch (err) {
    logger.error(`SMS gönderim hatası (${PROVIDER}): ${(err as Error).message}`);
    return false;
  }
};

/**
 * Netgsm "SMS Gönderici" Restful API
 * Doc: https://www.netgsm.com.tr/dokuman/#http-sms-api-1n-iletisi
 *
 * Basit GET endpoint kullanıyoruz; tek alıcı + tek mesaj.
 * Başarı yanıtı "00 <bulkid>" formatındadır.
 */
const sendViaNetgsm = async (phone: string, message: string): Promise<boolean> => {
  // Netgsm 90 olmadan da kabul ediyor; +90 ile gelirse +'yi kaldırıyoruz.
  const tel = phone.replace(/^\+/, '');
  const params = {
    usercode: NETGSM_USERCODE,
    password: NETGSM_PASSWORD,
    gsmno: tel,
    message,
    msgheader: NETGSM_HEADER,
    filter: '0',
  };
  const res = await axios.get('https://api.netgsm.com.tr/sms/send/get', {
    params,
    timeout: 10_000,
    validateStatus: () => true,
  });
  const text = String(res.data || '').trim();
  // Başarı kodları: 00 ve 01
  if (text.startsWith('00') || text.startsWith('01')) {
    logger.info(`Netgsm SMS gönderildi: ${tel} (yanıt=${text})`);
    return true;
  }
  logger.warn(`Netgsm SMS başarısız: ${tel} (yanıt=${text})`);
  return false;
};

/**
 * Twilio Programmable SMS — Messages REST API
 */
const sendViaTwilio = async (phone: string, message: string): Promise<boolean> => {
  const url = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`;
  const body = new URLSearchParams({
    From: TWILIO_FROM,
    To: phone,
    Body: message,
  });
  const res = await axios.post(url, body, {
    auth: { username: TWILIO_ACCOUNT_SID, password: TWILIO_AUTH_TOKEN },
    timeout: 10_000,
    validateStatus: () => true,
  });
  if (res.status >= 200 && res.status < 300) {
    logger.info(`Twilio SMS gönderildi: ${phone}`);
    return true;
  }
  logger.warn(`Twilio SMS başarısız (${res.status}): ${JSON.stringify(res.data)}`);
  return false;
};
