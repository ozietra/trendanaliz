import crypto from 'crypto';
import https from 'https';
import { URL } from 'url';
import { logger } from '../utils/logger';

/**
 * Iyzico Checkout Form (Hosted Payment Page) entegrasyonu.
 * SDK kullanılmadan ham HTTP + HMAC-SHA1 imzasıyla istek atar.
 * Üretim için IYZICO_BASE_URL'i "https://api.iyzipay.com" yapın.
 */

const API_KEY = process.env.IYZICO_API_KEY || 'sandbox-api-key';
const SECRET_KEY = process.env.IYZICO_SECRET_KEY || 'sandbox-secret-key';
const BASE_URL = process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com';

interface CheckoutInitParams {
  conversationId: string;
  price: number;
  currency: string;
  basketId: string;
  callbackUrl: string;
  buyer: {
    id: string;
    name: string;
    surname: string;
    email: string;
    phone?: string;
    registrationAddress?: string;
    city?: string;
    country?: string;
    identityNumber?: string;
  };
  basketItems: Array<{
    id: string;
    name: string;
    category: string;
    price: number;
  }>;
}

interface IyzicoResponse {
  status: string;
  errorCode?: string;
  errorMessage?: string;
  paymentPageUrl?: string;
  token?: string;
  conversationId?: string;
  [k: string]: any;
}

/**
 * Iyzico'nun PKI authorization string'ini hesaplar.
 * Format: "apiKey:[apiKey]&randomString:[rand]&signature:[hmac-sha1(secret, randomString + body)]"
 */
const buildAuthHeader = (randomString: string, requestBody: string): string => {
  const dataToSign = randomString + requestBody;
  const signature = crypto.createHmac('sha1', SECRET_KEY).update(dataToSign).digest('base64');
  return `IYZWSv2 ${Buffer.from(
    `apiKey:${API_KEY}&randomString:${randomString}&signature:${signature}`
  ).toString('base64')}`;
};

const post = (path: string, payload: object): Promise<IyzicoResponse> =>
  new Promise((resolve, reject) => {
    const body = JSON.stringify(payload);
    const randomString = `${Date.now()}${Math.floor(Math.random() * 1e9)}`;
    const url = new URL(BASE_URL + path);

    const req = https.request(
      {
        hostname: url.hostname,
        port: 443,
        path: url.pathname,
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          Authorization: buildAuthHeader(randomString, body),
          'x-iyzi-rnd': randomString,
        },
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (err) {
            reject(new Error(`Iyzico yanıt parse hatası: ${(err as Error).message}`));
          }
        });
      }
    );

    req.on('error', (err) => reject(err));
    req.setTimeout(15000, () => req.destroy(new Error('Iyzico timeout')));
    req.write(body);
    req.end();
  });

/**
 * Checkout Form başlatır, dönen paymentPageUrl'e kullanıcı yönlendirilir.
 * Sandbox sırları yoksa veya istek başarısızsa MOCK URL döner ki dev akışı bozulmasın.
 */
export const initCheckout = async (params: CheckoutInitParams): Promise<{
  paymentPageUrl: string;
  token: string;
  provider: 'IYZICO';
  mock: boolean;
}> => {
  const isConfigured =
    API_KEY && API_KEY !== 'sandbox-api-key' && SECRET_KEY && SECRET_KEY !== 'sandbox-secret-key';

  if (!isConfigured) {
    const token = `mock-iyz-${params.conversationId}`;
    logger.warn('Iyzico kimlik bilgileri yapılandırılmamış, MOCK ödeme akışı kullanılıyor.');
    return {
      paymentPageUrl: `${params.callbackUrl}?token=${token}&status=success&mock=1`,
      token,
      provider: 'IYZICO',
      mock: true,
    };
  }

  const payload = {
    locale: 'tr',
    conversationId: params.conversationId,
    price: params.price.toFixed(2),
    paidPrice: params.price.toFixed(2),
    currency: params.currency,
    basketId: params.basketId,
    paymentGroup: 'SUBSCRIPTION',
    callbackUrl: params.callbackUrl,
    enabledInstallments: [1, 2, 3, 6, 9],
    buyer: {
      id: params.buyer.id,
      name: params.buyer.name,
      surname: params.buyer.surname,
      gsmNumber: params.buyer.phone || '+905555555555',
      email: params.buyer.email,
      identityNumber: params.buyer.identityNumber || '11111111111',
      registrationAddress: params.buyer.registrationAddress || 'Türkiye',
      city: params.buyer.city || 'Istanbul',
      country: params.buyer.country || 'Turkey',
      ip: '85.34.78.112',
    },
    shippingAddress: {
      contactName: `${params.buyer.name} ${params.buyer.surname}`,
      city: params.buyer.city || 'Istanbul',
      country: params.buyer.country || 'Turkey',
      address: params.buyer.registrationAddress || 'Türkiye',
    },
    billingAddress: {
      contactName: `${params.buyer.name} ${params.buyer.surname}`,
      city: params.buyer.city || 'Istanbul',
      country: params.buyer.country || 'Turkey',
      address: params.buyer.registrationAddress || 'Türkiye',
    },
    basketItems: params.basketItems.map((b) => ({
      id: b.id,
      name: b.name,
      category1: b.category,
      itemType: 'VIRTUAL',
      price: b.price.toFixed(2),
    })),
  };

  try {
    const res = await post('/payment/iyzipos/checkoutform/initialize/auth/ecom', payload);
    if (res.status !== 'success' || !res.paymentPageUrl) {
      logger.error(`Iyzico init başarısız: ${res.errorCode} - ${res.errorMessage}`);
      throw new Error(res.errorMessage || 'Iyzico checkout başlatılamadı');
    }
    return {
      paymentPageUrl: res.paymentPageUrl,
      token: res.token || '',
      provider: 'IYZICO',
      mock: false,
    };
  } catch (err) {
    logger.error(`Iyzico request hatası: ${(err as Error).message}`);
    throw err;
  }
};

/**
 * Webhook geldiğinde ödeme detayını sorgular ve durumu döner.
 */
export const retrievePayment = async (token: string): Promise<IyzicoResponse> => {
  if (token.startsWith('mock-iyz-')) {
    return { status: 'success', paymentStatus: 'SUCCESS', paymentId: token, token };
  }
  try {
    const res = await post('/payment/iyzipos/checkoutform/auth/ecom/detail', {
      locale: 'tr',
      token,
    });
    return res;
  } catch (err) {
    logger.error(`Iyzico retrieve hatası: ${(err as Error).message}`);
    throw err;
  }
};
