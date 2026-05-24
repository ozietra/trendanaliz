import { logger } from '../utils/logger';

/**
 * Çevresel Değişken Doğrulayıcı (fail-fast)
 *
 * Bu modül uygulama başlamadan önce çağrılır. Eksik veya
 * güvensiz secret'lar varsa uygulama açılmaz — bu sayede
 * hardcoded fallback secret'larla üretime çıkma riski
 * tamamen ortadan kalkar.
 *
 * Production'da `NODE_ENV=production` iken bilinen
 * default değerler de reddedilir.
 */

const REQUIRED_ALWAYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'JWT_REFRESH_SECRET',
  'ENCRYPTION_KEY',
] as const;

/**
 * Geçmişte hardcoded fallback olarak kullanılmış değerler.
 * Birisi `.env`'e bunlardan birini koyarsa fail edelim.
 */
const FORBIDDEN_VALUES = new Set([
  'trendanaliz_jwt_secret_key_2026_very_secure',
  'trendanaliz_jwt_refresh_secret_key_2026_very_secure',
  'trendanaliz_default_aes_key_change_in_production_2026',
  'change-me',
  'changeme',
  'secret',
]);

const MIN_SECRET_LENGTH = 32;

export const validateEnv = (): void => {
  const errors: string[] = [];
  const warnings: string[] = [];
  const isProd = process.env.NODE_ENV === 'production';

  for (const key of REQUIRED_ALWAYS) {
    const val = process.env[key];
    if (!val || val.trim() === '') {
      errors.push(`${key} tanımlanmamış (zorunlu).`);
      continue;
    }
    if (FORBIDDEN_VALUES.has(val)) {
      errors.push(
        `${key} bilinen bir varsayılan/örnek değer içeriyor. Güvenli rastgele bir değer üretin.`
      );
    }
    // JWT_SECRET, JWT_REFRESH_SECRET, ENCRYPTION_KEY için minimum uzunluk
    if (key !== 'DATABASE_URL' && val.length < MIN_SECRET_LENGTH) {
      const msg = `${key} en az ${MIN_SECRET_LENGTH} karakter olmalı (şu an ${val.length}).`;
      if (isProd) errors.push(msg);
      else warnings.push(msg);
    }
  }

  // JWT_SECRET ile JWT_REFRESH_SECRET aynı olmamalı
  if (
    process.env.JWT_SECRET &&
    process.env.JWT_REFRESH_SECRET &&
    process.env.JWT_SECRET === process.env.JWT_REFRESH_SECRET
  ) {
    errors.push('JWT_SECRET ve JWT_REFRESH_SECRET farklı olmalı.');
  }

  // Production'da TRENDYOL_LIVE_PUSH=1 ise SIMULATE_COMPETITORS=0 olmalı
  if (
    isProd &&
    process.env.TRENDYOL_LIVE_PUSH === '1' &&
    process.env.SIMULATE_COMPETITORS === '1'
  ) {
    errors.push(
      'Production + TRENDYOL_LIVE_PUSH=1 iken SIMULATE_COMPETITORS=1 olamaz (sahte rakip fiyatına göre gerçek API push edilir).'
    );
  }

  if (warnings.length > 0) {
    for (const w of warnings) logger.warn(`[env] ${w}`);
  }

  if (errors.length > 0) {
    for (const e of errors) logger.error(`[env] ${e}`);
    throw new Error(
      `Ortam değişkenleri doğrulanamadı (${errors.length} hata). Uygulama başlatılamıyor.`
    );
  }

  logger.info('[env] Ortam değişkenleri doğrulandı.');
};

/**
 * Doğrulanmış secret'lara tip-güvenli erişim için yardımcı.
 * `validateEnv()` çağrıldıktan sonra bu değerler kesinlikle tanımlıdır.
 */
export const env = {
  get jwtSecret(): string {
    return process.env.JWT_SECRET as string;
  },
  get jwtRefreshSecret(): string {
    return process.env.JWT_REFRESH_SECRET as string;
  },
  get encryptionKey(): string {
    return process.env.ENCRYPTION_KEY as string;
  },
  get jwtExpiresIn(): string {
    return process.env.JWT_EXPIRES_IN || '15m';
  },
  get jwtRefreshExpiresIn(): string {
    return process.env.JWT_REFRESH_EXPIRES_IN || '30d';
  },
  get frontendUrl(): string {
    return process.env.FRONTEND_URL || 'http://localhost:3001';
  },
  get nodeEnv(): string {
    return process.env.NODE_ENV || 'development';
  },
  get isProd(): boolean {
    return this.nodeEnv === 'production';
  },
};
