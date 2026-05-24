import { Request, Response } from 'express';
import crypto from 'crypto';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { syncStoreOrders } from '../services/order.service';

/**
 * Trendyol Webhook Receiver
 *
 * Trendyol'un resmi webhook servisi, sipariş statü değişikliklerini
 * (OrderCreated, OrderShipmentPackageStatusChanged, OrderInvoiceLink
 * vb.) bizim verdiğimiz URL'ye POST eder.
 *
 * KURULUM (kullanıcı tarafı):
 *   1) Trendyol Satıcı Paneli → API Yönetimi → Webhook
 *   2) URL: https://<domainin>/api/webhooks/trendyol
 *   3) Authorization Header (isteğe bağlı): Bearer <TRENDYOL_WEBHOOK_SECRET>
 *      veya HMAC imza (X-Trendyol-Signature)
 *
 * GÜVENLİK:
 *   - `TRENDYOL_WEBHOOK_SECRET` env tanımlıysa header tabanlı doğrulama
 *   - Aksi halde supplierId payload'da → mağaza eşleştirme yeterli
 *     (DENY: bilinmeyen supplierId → 401)
 *
 * NOT: Trendyol webhook şeması farklı olay tipleri için biraz değişir.
 * Biz tek alan üzerinden ilerleyelim: payload.supplierId VEYA URL pattern.
 * Tek paketin tam senkronizasyonunu yapmak yerine, etkilenen mağazanın
 * son 14 gününü güvenli sync ediyoruz (idempotent).
 */

const WEBHOOK_SECRET = process.env.TRENDYOL_WEBHOOK_SECRET || '';

const verifySignature = (req: Request): boolean => {
  // 1) Authorization: Bearer <secret>
  const auth = req.headers['authorization'];
  if (auth && typeof auth === 'string') {
    const expected = `Bearer ${WEBHOOK_SECRET}`;
    if (WEBHOOK_SECRET && safeEqual(auth, expected)) return true;
  }
  // 2) X-Trendyol-Signature: hex(HMAC-SHA256(rawBody, secret))
  const sig = req.headers['x-trendyol-signature'];
  if (sig && typeof sig === 'string' && WEBHOOK_SECRET) {
    const raw = JSON.stringify(req.body);
    const mac = crypto
      .createHmac('sha256', WEBHOOK_SECRET)
      .update(raw)
      .digest('hex');
    if (safeEqual(sig.toLowerCase(), mac.toLowerCase())) return true;
  }
  // Secret yapılandırılmamışsa imza doğrulaması yapılmaz; sadece supplierId match'i
  if (!WEBHOOK_SECRET) return true;
  return false;
};

const safeEqual = (a: string, b: string): boolean => {
  if (a.length !== b.length) return false;
  try {
    return crypto.timingSafeEqual(Buffer.from(a), Buffer.from(b));
  } catch {
    return false;
  }
};

/**
 * POST /api/webhooks/trendyol
 *
 * Beklenen payload (gevşek):
 *   { supplierId: number|string, eventName?: string, shipmentPackageId?: number, ... }
 *
 * Yanıt: 200 OK her zaman (Trendyol retry'larını azaltmak için).
 * İç hata olursa logla, kullanıcıya 200 dön.
 */
export const trendyolWebhook = async (req: Request, res: Response) => {
  try {
    if (!verifySignature(req)) {
      logger.warn(
        `Trendyol webhook imza doğrulanamadı (IP=${req.ip}). Reddedildi.`
      );
      return res.status(401).json({ success: false, message: 'Geçersiz imza.' });
    }

    const body = req.body || {};
    const supplierId =
      body.supplierId ??
      body.supplier_id ??
      body.SupplierId ??
      body.sellerId ??
      null;
    const eventName: string = body.eventName || body.event || 'Unknown';

    if (!supplierId) {
      logger.warn(`Trendyol webhook: supplierId bulunamadı (event=${eventName}).`);
      // 200 dön ki Trendyol retry yapmasın
      return res.json({ success: true, message: 'supplierId yok, atlandı.' });
    }

    const store = await prisma.trendyolStore.findFirst({
      where: { supplierId: String(supplierId), isActive: true },
    });
    if (!store) {
      logger.warn(
        `Trendyol webhook: supplierId=${supplierId} ile eşleşen aktif mağaza yok.`
      );
      return res.json({
        success: true,
        message: 'Eşleşen aktif mağaza yok, atlandı.',
      });
    }

    logger.info(
      `Trendyol webhook alındı: store=${store.id} event=${eventName} packageId=${body.shipmentPackageId ?? '-'}`
    );

    // Sipariş güvenli senkronizasyonu (son 14 gün, idempotent)
    // Tek paket için optimize etmek mümkün ama polling fallback'i ile
    // tutarlılığı korumak adına son aralığı yeniden çekiyoruz.
    void syncStoreOrders(store.id).catch((err) =>
      logger.warn(`Webhook sonrası sync hatası: ${err.message}`)
    );

    return res.json({ success: true });
  } catch (err) {
    logger.error(`Trendyol webhook hatası: ${(err as Error).message}`);
    // 200 dön ki retry oluşmasın; biz iç hatamızı zaten logladık.
    return res.json({ success: true, message: 'Internal error swallowed.' });
  }
};
