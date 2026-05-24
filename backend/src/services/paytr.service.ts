import crypto from 'crypto';
import https from 'https';
import { URLSearchParams } from 'url';
import { logger } from '../utils/logger';

/**
 * PayTR iFrame API entegrasyonu.
 * Docs: https://www.paytr.com/entegrasyon/iframe-api
 *
 * Akış:
 * 1) /odeme/api/get-token endpoint'ine HMAC-SHA256 imzalı POST
 * 2) Dönen token ile iframe URL: https://www.paytr.com/odeme/guvenli/{token}
 * 3) Kullanıcı ödeme yapınca PayTR -> notification_url'ye POST ile bildirir
 */

const MERCHANT_ID = process.env.PAYTR_MERCHANT_ID || '';
const MERCHANT_KEY = process.env.PAYTR_MERCHANT_KEY || '';
const MERCHANT_SALT = process.env.PAYTR_MERCHANT_SALT || '';
const TEST_MODE = process.env.PAYTR_TEST_MODE === '0' ? '0' : '1'; // varsayılan test

interface PaytrInitParams {
  merchantOid: string; // Unique sipariş kimliği (sadece alfa-numerik, max 64)
  amount: number; // TL cinsinden
  currency?: 'TL' | 'EUR' | 'USD';
  email: string;
  userName: string;
  userAddress: string;
  userPhone: string;
  userIp: string;
  okUrl: string;
  failUrl: string;
  basket: Array<{ name: string; price: number; qty: number }>;
}

const httpPost = (host: string, path: string, body: string): Promise<string> =>
  new Promise((resolve, reject) => {
    const req = https.request(
      {
        host,
        port: 443,
        path,
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Content-Length': Buffer.byteLength(body),
        },
      },
      (res) => {
        let data = '';
        res.on('data', (c) => (data += c));
        res.on('end', () => resolve(data));
      }
    );
    req.on('error', reject);
    req.setTimeout(15000, () => req.destroy(new Error('PayTR timeout')));
    req.write(body);
    req.end();
  });

/**
 * iframe ödeme token'ı üretir; dönüş olarak iframe URL'i verir.
 * Kimlik bilgileri yapılandırılmamışsa MOCK akışla okUrl'ye yönlendirir.
 */
export const initCheckout = async (
  params: PaytrInitParams
): Promise<{ paymentPageUrl: string; token: string; provider: 'PAYTR'; mock: boolean }> => {
  const isConfigured = !!(MERCHANT_ID && MERCHANT_KEY && MERCHANT_SALT);
  if (!isConfigured) {
    const token = `mock-paytr-${params.merchantOid}`;
    logger.warn('PayTR kimlik bilgileri yapılandırılmamış, MOCK akış kullanılıyor.');
    return {
      paymentPageUrl: `${params.okUrl}?merchant_oid=${params.merchantOid}&status=success&mock=1`,
      token,
      provider: 'PAYTR',
      mock: true,
    };
  }

  // PayTR kuruş cinsinden bekler
  const paymentAmount = Math.round(params.amount * 100);
  const currency = params.currency || 'TL';
  const noInstallment = '0';
  const maxInstallment = '0';

  // user_basket: base64( JSON.stringify( [[name, price_str, qty], ...] ) )
  const basket = params.basket.map((b) => [b.name, b.price.toFixed(2), b.qty]);
  const userBasket = Buffer.from(JSON.stringify(basket)).toString('base64');

  // Hash hesaplama: merchant_id + user_ip + merchant_oid + email + payment_amount + user_basket + no_installment + max_installment + currency + test_mode
  const hashStr =
    MERCHANT_ID +
    params.userIp +
    params.merchantOid +
    params.email +
    paymentAmount +
    userBasket +
    noInstallment +
    maxInstallment +
    currency +
    TEST_MODE;
  const paytrToken = crypto
    .createHmac('sha256', MERCHANT_KEY)
    .update(hashStr + MERCHANT_SALT)
    .digest('base64');

  const body = new URLSearchParams({
    merchant_id: MERCHANT_ID,
    user_ip: params.userIp,
    merchant_oid: params.merchantOid,
    email: params.email,
    payment_amount: String(paymentAmount),
    paytr_token: paytrToken,
    user_basket: userBasket,
    debug_on: '1',
    no_installment: noInstallment,
    max_installment: maxInstallment,
    user_name: params.userName,
    user_address: params.userAddress,
    user_phone: params.userPhone,
    merchant_ok_url: params.okUrl,
    merchant_fail_url: params.failUrl,
    timeout_limit: '30',
    currency,
    test_mode: TEST_MODE,
    lang: 'tr',
  }).toString();

  try {
    const raw = await httpPost('www.paytr.com', '/odeme/api/get-token', body);
    const json = JSON.parse(raw);
    if (json.status !== 'success' || !json.token) {
      logger.error(`PayTR token alınamadı: ${json.reason || raw}`);
      throw new Error(json.reason || 'PayTR token alınamadı');
    }
    return {
      paymentPageUrl: `https://www.paytr.com/odeme/guvenli/${json.token}`,
      token: json.token,
      provider: 'PAYTR',
      mock: false,
    };
  } catch (err) {
    logger.error(`PayTR init hatası: ${(err as Error).message}`);
    throw err;
  }
};

/**
 * PayTR notification webhook hash doğrulaması.
 * Hash: HMAC-SHA256( merchant_key, merchant_oid + merchant_salt + status + total_amount )
 */
export const verifyWebhook = (params: {
  merchantOid: string;
  status: string;
  totalAmount: string;
  receivedHash: string;
}): boolean => {
  if (!MERCHANT_KEY || !MERCHANT_SALT) return false;
  const hashStr = params.merchantOid + MERCHANT_SALT + params.status + params.totalAmount;
  const expected = crypto
    .createHmac('sha256', MERCHANT_KEY)
    .update(hashStr)
    .digest('base64');
  return expected === params.receivedHash;
};
