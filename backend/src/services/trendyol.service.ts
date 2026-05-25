import axios, { AxiosInstance, AxiosError } from 'axios';
import { logger } from '../utils/logger';

/**
 * Trendyol Satıcı (Marketplace) API entegrasyonu.
 *
 * Resmi referans: https://developers.trendyol.com/
 *
 * BASE URL'LER:
 *  - PROD:  https://apigw.trendyol.com
 *  - STAGE: https://stageapigw.trendyol.com  (IP whitelist gerektirir)
 *
 * NOT: apigw.trendyol.com bir API gateway'idir; tarayıcıda root "/" açılırsa
 * "Service Unavailable" döner. Gerçek endpoint'ler /integration/... altındadır.
 *
 * KULLANILAN ENDPOINT'LER (Trendyol resmi doc):
 *  - GET  /integration/product/sellers/{sellerId}/products            (filterProducts)
 *  - POST /integration/inventory/sellers/{sellerId}/products/price-and-inventory
 *  - GET  /integration/product/sellers/{sellerId}/products/batch-requests/{id}
 *
 * KIMLIK DOĞRULAMA:
 *  - HTTP Basic Auth: base64(apiKey:apiSecret)
 *  - User-Agent header zorunlu: "{supplierId} - {IntegratorName}"
 *    Kendi yazılımınız için: "{supplierId} - SelfIntegration"
 *    User-Agent gönderilmezse 403 alırsınız.
 *
 * RATE LIMIT (resmi):
 *  - Aynı endpoint'e 10 saniyede en fazla 50 istek
 *  - 51. istek -> 429 too.many.requests
 *  - Bu servis Retry-After'a saygı duyup otomatik yeniden dener.
 *
 * BATCH LİMİT:
 *  - Stok-fiyat güncelleme: tek istekte en fazla 1000 SKU
 *  - Aynı body ile 15 dakika içinde tekrar gönderim engellidir
 *
 * Ortam değişkenleri:
 *  - TRENDYOL_API_BASE          (default: https://apigw.trendyol.com)
 *  - TRENDYOL_USER_AGENT_SUFFIX (default: "SelfIntegration")
 *  - TRENDYOL_TIMEOUT_MS        (default: 15000)
 *  - TRENDYOL_MAX_RETRIES       (default: 3)
 */

const BASE_URL = process.env.TRENDYOL_API_BASE || 'https://apigw.trendyol.com';
const UA_SUFFIX = process.env.TRENDYOL_USER_AGENT_SUFFIX || 'SelfIntegration';
const TIMEOUT_MS = Number(process.env.TRENDYOL_TIMEOUT_MS || 15000);
const MAX_RETRIES = Number(process.env.TRENDYOL_MAX_RETRIES || 3);

interface ClientCredentials {
  supplierId: string;
  apiKey: string;
  apiSecret: string;
}

export interface TrendyolProduct {
  barcode: string;
  title: string;
  productMainId?: string;
  brandId?: number;
  categoryId?: number;
  categoryName?: string;
  quantity: number;
  stockUnitType?: string;
  listPrice: number;
  salePrice: number;
  vatRate: number;
  dimensionalWeight?: number;
  description?: string;
  brand?: string;
  images?: Array<{ url: string }>;
  approved?: boolean;
  archived?: boolean;
}

export interface PriceInventoryUpdate {
  barcode: string;
  quantity?: number;
  salePrice?: number;
  listPrice?: number;
}

export interface BatchRequestResponse {
  batchRequestId: string;
}

export interface BatchStatusResponse {
  batchRequestId: string;
  itemCount: number;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  failedItemCount: number;
  items?: Array<{ requestItem: unknown; status: string; failureReasons?: string[] }>;
}

/**
 * Trendyol sipariş satırı (lines[] içindeki bir öğe)
 */
export interface TrendyolOrderLine {
  lineId?: number;
  quantity: number;
  productName: string;
  productSize?: string;
  productColor?: string;
  merchantSku?: string;
  barcode: string;
  price: number;
  amount?: number;
  discount?: number;
  vatBaseAmount?: number;
  orderLineItemStatusName?: string;
}

/**
 * Trendyol sipariş paketi (shipment package).
 */
export interface TrendyolOrder {
  shipmentPackageId: number;
  orderNumber: string;
  grossAmount: number;
  totalDiscount?: number;
  totalPrice: number;
  currencyCode?: string;
  status: string;
  orderDate: number; // timestamp ms
  estimatedDeliveryStartDate?: number;
  estimatedDeliveryEndDate?: number;
  cargoTrackingNumber?: string | number;
  cargoProviderName?: string;
  cargoTrackingLink?: string;
  customerFirstName?: string;
  customerLastName?: string;
  customerEmail?: string;
  tcIdentityNumber?: string;
  taxNumber?: string;
  fastDelivery?: boolean;
  deliveryType?: string;
  invoiceAddress?: Record<string, unknown>;
  shipmentAddress?: Record<string, unknown>;
  lines: TrendyolOrderLine[];
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Verilen kimlik bilgileri için axios instance oluşturur.
 * storeFrontCode header'ı Trendyol tarafından zorunlu kılınır (Türkiye = "1").
 */
const STOREFRONT_CODE = process.env.TRENDYOL_STOREFRONT_CODE || '1';

const createClient = (creds: ClientCredentials): AxiosInstance => {
  const token = Buffer.from(`${creds.apiKey}:${creds.apiSecret}`).toString('base64');
  return axios.create({
    baseURL: BASE_URL,
    timeout: TIMEOUT_MS,
    headers: {
      Authorization: `Basic ${token}`,
      'User-Agent': `${creds.supplierId} - ${UA_SUFFIX}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'storeFrontCode': STOREFRONT_CODE,
    },
    // Trendyol kendi hata gövdelerini döner; axios'un kendi atışı yerine biz parse edelim
    validateStatus: () => true,
  });
};

/**
 * Retry + jitter ile bir HTTP isteği yapar.
 * - 5xx ve 429 durumlarında retry edilir.
 * - 4xx (429 hariç) hatalar doğrudan döndürülür (tekrarlamak anlamsız).
 */
async function requestWithRetry<T>(
  client: AxiosInstance,
  config: { method: 'get' | 'post' | 'put' | 'delete'; url: string; params?: any; data?: any }
): Promise<T> {
  let attempt = 0;
  let lastError: Error | null = null;

  while (attempt <= MAX_RETRIES) {
    try {
      const res = await client.request({
        method: config.method,
        url: config.url,
        params: config.params,
        data: config.data,
      });

      if (res.status >= 200 && res.status < 300) {
        return res.data as T;
      }

      // 429 → Retry-After'a uy
      if (res.status === 429 && attempt < MAX_RETRIES) {
        const retryAfter = Number(res.headers['retry-after']) || 2;
        logger.warn(
          `Trendyol 429 alındı (${config.method.toUpperCase()} ${config.url}), ${retryAfter}s bekleniyor...`
        );
        await sleep(retryAfter * 1000);
        attempt++;
        continue;
      }

      // 5xx → exponential backoff
      if (res.status >= 500 && attempt < MAX_RETRIES) {
        const backoff = 2 ** attempt * 500 + Math.floor(Math.random() * 300);
        logger.warn(
          `Trendyol ${res.status} alındı, ${backoff}ms backoff (attempt ${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(backoff);
        attempt++;
        continue;
      }

      // İstemci hatası: anlamlı bir mesajla fırlat
      const errMsg =
        (res.data && (res.data.errors?.[0]?.message || res.data.message)) ||
        `HTTP ${res.status}`;
      throw new Error(`Trendyol API hatası: ${errMsg}`);
    } catch (err) {
      const e = err as AxiosError | Error;
      // Ağ hatası, timeout vb. → retry
      const isNetwork =
        (e as AxiosError).code === 'ECONNABORTED' ||
        (e as AxiosError).code === 'ETIMEDOUT' ||
        (e as AxiosError).code === 'ECONNRESET' ||
        (e as AxiosError).code === 'ENOTFOUND';

      lastError = e;
      if (isNetwork && attempt < MAX_RETRIES) {
        const backoff = 2 ** attempt * 500 + Math.floor(Math.random() * 300);
        logger.warn(
          `Trendyol ağ hatası (${e.message}), ${backoff}ms sonra tekrar denenecek (${attempt + 1}/${MAX_RETRIES})`
        );
        await sleep(backoff);
        attempt++;
        continue;
      }
      throw e;
    }
  }

  throw lastError || new Error('Trendyol API: bilinmeyen hata.');
}

/**
 * Bağlantı testi: küçük sayfa istemiyle satıcının kimlik bilgilerini doğrular.
 * Başarılıysa { ok: true, productSampleCount } döner.
 */
export const testCredentials = async (
  creds: ClientCredentials
): Promise<{ ok: true; sample: number } | { ok: false; reason: string }> => {
  const client = createClient(creds);
  try {
    const data = await requestWithRetry<{ totalElements?: number; content?: unknown[] }>(client, {
      method: 'get',
      url: `/integration/product/sellers/${creds.supplierId}/products`,
      params: { page: 0, size: 1, approved: true },
    });
    return { ok: true, sample: data?.totalElements ?? data?.content?.length ?? 0 };
  } catch (err) {
    return { ok: false, reason: (err as Error).message };
  }
};

/**
 * Onaylı ürünleri sayfalı olarak çeker.
 */
export const fetchProducts = async (
  creds: ClientCredentials,
  options: { page?: number; size?: number; approved?: boolean; onSale?: boolean; barcode?: string } = {}
): Promise<{
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  content: TrendyolProduct[];
}> => {
  const client = createClient(creds);
  const params = {
    page: options.page ?? 0,
    size: options.size ?? 50,
    approved: options.approved ?? true,
    onSale: options.onSale ?? true,
    ...(options.barcode ? { barcode: options.barcode } : {}),
  };
  const data = await requestWithRetry<any>(client, {
    method: 'get',
    url: `/integration/product/sellers/${creds.supplierId}/products`,
    params,
  });
  return {
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    page: data?.page ?? params.page,
    size: data?.size ?? params.size,
    content: data?.content ?? [],
  };
};

/**
 * Tüm sayfaları sırayla çeker. Çok büyük katalogları güvenli sınırla durdurur.
 */
export const fetchAllProducts = async (
  creds: ClientCredentials,
  options: { maxPages?: number; size?: number } = {}
): Promise<TrendyolProduct[]> => {
  const size = options.size ?? 100;
  const maxPages = options.maxPages ?? 50; // 5000 ürün koruma sınırı
  const all: TrendyolProduct[] = [];
  let page = 0;
  while (page < maxPages) {
    const res = await fetchProducts(creds, { page, size });
    all.push(...res.content);
    if (page + 1 >= res.totalPages || res.content.length === 0) break;
    page++;
    // Hız limitlerini zorlamamak için minik bir nefes
    await sleep(200);
  }
  return all;
};

/**
 * Fiyat ve/veya stok günceller (Trendyol resmi limit: tek istekte en fazla 1000 SKU).
 * Asenkron işlenir; batchRequestId döner. Sonucu getBatchStatus ile takip edin.
 *
 * Önemli: Aynı body 15 dk içinde tekrar gönderilirse Trendyol hata döner.
 */
export const updatePriceAndInventory = async (
  creds: ClientCredentials,
  items: PriceInventoryUpdate[]
): Promise<BatchRequestResponse> => {
  if (items.length === 0) {
    throw new Error('Güncellenecek öğe yok.');
  }
  if (items.length > 1000) {
    throw new Error('Tek istekte en fazla 1000 ürün gönderilebilir.');
  }
  const client = createClient(creds);
  return requestWithRetry<BatchRequestResponse>(client, {
    method: 'post',
    url: `/integration/inventory/sellers/${creds.supplierId}/products/price-and-inventory`,
    data: { items },
  });
};

/**
 * Batch işin durumunu sorgular.
 */
export const getBatchStatus = async (
  creds: ClientCredentials,
  batchRequestId: string
): Promise<BatchStatusResponse> => {
  const client = createClient(creds);
  return requestWithRetry<BatchStatusResponse>(client, {
    method: 'get',
    url: `/integration/product/sellers/${creds.supplierId}/products/batch-requests/${batchRequestId}`,
  });
};

/**
 * SİPARİŞLERİ ÇEKER
 *
 * Endpoint: GET /integration/order/sellers/{sellerId}/orders
 * Tüm parametreler opsiyonel. Tarihler timestamp (ms) cinsinden.
 *
 * Resmi parametreler:
 *  - startDate / endDate (ms timestamp; en fazla 14 günlük aralık)
 *  - page (0-tabanlı) / size (max 200)
 *  - status (Created, Picking, Invoiced, Shipped, Delivered, Cancelled, ...)
 *  - orderByField: PackageLastModifiedDate | CreatedDate
 *  - orderByDirection: ASC | DESC
 *  - supplierId, shipmentPackageIds, customerEmail, orderNumber
 */
export const fetchOrders = async (
  creds: ClientCredentials,
  options: {
    page?: number;
    size?: number;
    startDate?: number;
    endDate?: number;
    status?: string;
    orderNumber?: string;
    orderByField?: 'PackageLastModifiedDate' | 'CreatedDate';
    orderByDirection?: 'ASC' | 'DESC';
  } = {}
): Promise<{
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
  content: TrendyolOrder[];
}> => {
  const client = createClient(creds);
  const params: Record<string, unknown> = {
    page: options.page ?? 0,
    size: options.size ?? 50,
    orderByField: options.orderByField ?? 'PackageLastModifiedDate',
    orderByDirection: options.orderByDirection ?? 'DESC',
  };
  if (options.startDate) params.startDate = options.startDate;
  if (options.endDate) params.endDate = options.endDate;
  if (options.status) params.status = options.status;
  if (options.orderNumber) params.orderNumber = options.orderNumber;

  const data = await requestWithRetry<any>(client, {
    method: 'get',
    url: `/integration/order/sellers/${creds.supplierId}/orders`,
    params,
  });
  return {
    totalElements: data?.totalElements ?? 0,
    totalPages: data?.totalPages ?? 0,
    page: data?.page ?? params.page,
    size: data?.size ?? params.size,
    content: data?.content ?? [],
  };
};

/**
 * Belirli bir tarih aralığındaki TÜM siparişleri sayfa sayfa çeker.
 * Trendyol limitleri: tarih aralığı max 14 gün, size max 200.
 */
export const fetchAllOrders = async (
  creds: ClientCredentials,
  options: { startDate?: number; endDate?: number; status?: string; maxPages?: number } = {}
): Promise<TrendyolOrder[]> => {
  const size = 200;
  const maxPages = options.maxPages ?? 100; // 20.000 sipariş koruma sınırı
  const all: TrendyolOrder[] = [];
  let page = 0;
  while (page < maxPages) {
    const res = await fetchOrders(creds, { ...options, page, size });
    all.push(...res.content);
    if (page + 1 >= res.totalPages || res.content.length === 0) break;
    page++;
    await sleep(200);
  }
  return all;
};

/**
 * Yardımcı: 1000'er bölerek toplu fiyat/stok günceller (Trendyol resmi limiti).
 */
export const bulkUpdatePriceInventory = async (
  creds: ClientCredentials,
  items: PriceInventoryUpdate[]
): Promise<BatchRequestResponse[]> => {
  const batches: PriceInventoryUpdate[][] = [];
  for (let i = 0; i < items.length; i += 1000) {
    batches.push(items.slice(i, i + 1000));
  }
  const results: BatchRequestResponse[] = [];
  for (const b of batches) {
    const r = await updatePriceAndInventory(creds, b);
    results.push(r);
    await sleep(300); // dakika başına çağrı sınırına saygı
  }
  return results;
};

// =========================
// Order Write Operations
// =========================
//
// Trendyol resmi sipariş yönetimi endpoint'leri:
//
//  - PUT /integration/order/sellers/{sellerId}/shipment-packages/{packageId}
//    Package status güncelle (Picking -> Invoiced -> Shipped akışı)
//    Body: { lines: [{ lineId, quantity }], status: 'Picking'|'Invoiced'|'Shipped' }
//
//  - PUT /integration/order/sellers/{sellerId}/shipment-packages/{packageId}/tracking-number
//    Eski TR endpoint: { trackingNumber, cargoProviderName }
//    (Yeni uluslararası endpoint /tracking-details farklı şema kullanır)
//
//  - POST /integration/sellers/{sellerId}/shipment-packages/{packageId}/invoice-links
//    Fatura linki ekle: { invoiceLink, invoiceNumber, invoiceDateTime }
//
//  - PUT /integration/order/sellers/{sellerId}/shipment-packages/{packageId}/items/unsupplied
//    Sipariş kalemini tedarik edilemedi (iptal) olarak işaretle:
//    Body: { lines: [{ lineId, quantity, reasonId? }] }
//
// NOT: Bu endpoint'ler `packageId` (shipmentPackageId — Trendyol Order'ın
// shipmentPackageId alanı) kullanır. Order numarası değil!

export type PackageStatus =
  | 'Picking'
  | 'Invoiced'
  | 'Shipped'
  | 'Delivered'
  | 'UnDelivered'
  | 'Cancelled'
  | 'UnSupplied';

export interface PackageLine {
  lineId: number;
  quantity: number;
}

/**
 * Paket statüsünü günceller.
 * Geçişler: Created -> Picking -> Invoiced -> Shipped
 * Kargoya verildikten sonra "Delivered" otomatik gelir; satıcı set edemez.
 */
export const updatePackageStatus = async (
  creds: ClientCredentials,
  packageId: string,
  body: { lines: PackageLine[]; status: PackageStatus }
): Promise<void> => {
  const client = createClient(creds);
  await requestWithRetry<unknown>(client, {
    method: 'put',
    url: `/integration/order/sellers/${creds.supplierId}/shipment-packages/${packageId}`,
    data: body,
  });
};

/**
 * Kargo takip numarasını ve sağlayıcı adını günceller.
 * Paket statüsü "Picking" veya "Invoiced" olmalı (Shipped/Delivered sonrası kabul edilmez).
 */
export const updateTrackingNumber = async (
  creds: ClientCredentials,
  packageId: string,
  body: { trackingNumber: string; cargoProviderName?: string }
): Promise<void> => {
  const client = createClient(creds);
  await requestWithRetry<unknown>(client, {
    method: 'put',
    url: `/integration/order/sellers/${creds.supplierId}/shipment-packages/${packageId}/tracking-number`,
    data: body,
  });
};

/**
 * Pakete elektronik fatura linki ekler.
 */
export const setInvoiceLink = async (
  creds: ClientCredentials,
  packageId: string,
  body: { invoiceLink: string; invoiceNumber?: string; invoiceDateTime?: number }
): Promise<void> => {
  const client = createClient(creds);
  await requestWithRetry<unknown>(client, {
    method: 'post',
    url: `/integration/sellers/${creds.supplierId}/shipment-packages/${packageId}/invoice-links`,
    data: body,
  });
};

/**
 * Bir sipariş kalemini "tedarik edilemedi" olarak işaretler (iptal eder).
 * Satıcı kaynaklı iptaller için kullanılır. Müşteri iptali değil.
 */
export const markLinesUnsupplied = async (
  creds: ClientCredentials,
  packageId: string,
  body: { lines: Array<{ lineId: number; quantity: number; reasonId?: number }> }
): Promise<void> => {
  const client = createClient(creds);
  await requestWithRetry<unknown>(client, {
    method: 'put',
    url: `/integration/order/sellers/${creds.supplierId}/shipment-packages/${packageId}/items/unsupplied`,
    data: body,
  });
};

// =========================
// Buybox Check Service
// =========================
//
// POST /integration/product/sellers/{sellerId}/products/buybox-information
//
// Resmi dokümantasyon:
//   - Header: storeFrontCode zorunlu (genellikle "TR")
//   - İstek gövdesi: { "barcodes": ["...", ...] }
//   - İstek başına en fazla 10 barkod gönderilebilir
//   - Dakikada en fazla 1000 istek
//   - Yanıt: { "buyboxInfo": [ ... ] }

export interface TrendyolBuyboxInfo {
  barcode: string;
  buyboxOrder: number;
  buyboxPrice: number;
  hasMultipleSeller: boolean;
  secondBuyboxPrice?: number;
  thirdBuyboxPrice?: number;
}

interface BuyboxResponse {
  buyboxInfo?: TrendyolBuyboxInfo[];
}

/**
 * Verilen barkod listesi için Trendyol Buybox bilgilerini çeker.
 * Trendyol resmi limiti: tek istekte EN FAZLA 10 barkod.
 * storeFrontCode header'ı zorunludur.
 */
export const fetchBuyboxInfo = async (
  creds: ClientCredentials,
  barcodes: string[]
): Promise<TrendyolBuyboxInfo[]> => {
  if (barcodes.length === 0) return [];
  const client = createClient(creds);
  const path = `/integration/product/sellers/${creds.supplierId}/products/buybox-information`;

  const data = await requestWithRetry<BuyboxResponse>(client, {
    method: 'post',
    url: path,
    data: { barcodes },
  });

  logger.info(`Buybox API yanıt: ${data.buyboxInfo?.length ?? 0} sonuç (gönderilen: ${barcodes.length})`);
  return data.buyboxInfo || [];
};

/**
 * Çok sayıda barkod için chunk'lara bölerek tüm buybox bilgilerini çeker.
 * Trendyol resmi limiti: istek başına 10 barkod, dakikada 1000 istek.
 * 429/5xx'lerde requestWithRetry otomatik yedek+jitter ile bekler.
 */
export const fetchAllBuyboxInfo = async (
  creds: ClientCredentials,
  barcodes: string[],
  options: { chunkSize?: number; sleepMsBetweenChunks?: number } = {}
): Promise<TrendyolBuyboxInfo[]> => {
  // Trendyol limiti: istek başına maks 10 barkod
  const chunkSize = options.chunkSize ?? 10;
  // Rate limit: 1000 req/dakika = ~16.6 req/sn
  // Güvenli aralık: 100ms (10 req/sn) ile margin bırakıyoruz
  const sleepMs = options.sleepMsBetweenChunks ?? 100;

  const result: TrendyolBuyboxInfo[] = [];
  const unique = Array.from(new Set(barcodes.filter(Boolean)));

  logger.info(`Buybox tarama başlıyor: ${unique.length} barkod, ${Math.ceil(unique.length / chunkSize)} chunk`);

  let successChunks = 0;
  let failedChunks = 0;

  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    try {
      const part = await fetchBuyboxInfo(creds, chunk);
      result.push(...part);
      successChunks++;
    } catch (err) {
      failedChunks++;
      logger.warn(
        `Buybox chunk başarısız (offset=${i}, size=${chunk.length}): ${(err as Error).message}`
      );
    }
    if (i + chunkSize < unique.length && sleepMs > 0) {
      await sleep(sleepMs);
    }
  }

  logger.info(
    `Buybox tarama tamamlandı: ${result.length} sonuç, ${successChunks} başarılı/${failedChunks} başarısız chunk`
  );
  return result;
};
