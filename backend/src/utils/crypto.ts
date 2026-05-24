import crypto from 'crypto';
import { logger } from './logger';

// AES-256-GCM şifreleme yardımcısı - Trendyol API anahtarları gibi hassas verileri korumak için
// 32 byte (256 bit) bir anahtar gerektirir. ENCRYPTION_KEY .env'den okunur ve
// validateEnv() ile başlangıçta zorunlu kılınır (fail-fast).

const getKey = (): Buffer => {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    // validateEnv() başlangıçta bunu yakalar ama yine de savunmacı koruma
    throw new Error('ENCRYPTION_KEY tanımlanmamış.');
  }
  // 32 byte sabit anahtar üret (SHA-256 ile hash)
  return crypto.createHash('sha256').update(raw).digest();
};

const ALGO = 'aes-256-gcm';

/**
 * Düz metni AES-256-GCM ile şifreler.
 * Çıktı formatı: "iv_hex:authTag_hex:cipherText_hex"
 */
export const encrypt = (plainText: string): string => {
  try {
    if (!plainText) return '';
    const iv = crypto.randomBytes(12); // GCM için 12 byte IV önerilir
    const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
    const encrypted = Buffer.concat([cipher.update(plainText, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return `${iv.toString('hex')}:${authTag.toString('hex')}:${encrypted.toString('hex')}`;
  } catch (err) {
    logger.error(`Şifreleme hatası: ${(err as Error).message}`);
    throw new Error('Hassas veri şifrelenemedi.');
  }
};

/**
 * Şifrelenmiş metni çözer. Hatalı format gelirse düz metin olarak kabul edip geri döner
 * (eski veritabanı kayıtlarıyla geri uyumluluk için).
 */
export const decrypt = (cipherText: string): string => {
  try {
    if (!cipherText) return '';
    const parts = cipherText.split(':');
    if (parts.length !== 3) {
      // Şifrelenmemiş eski veri olabilir - olduğu gibi dön
      return cipherText;
    }
    const [ivHex, authTagHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const encrypted = Buffer.from(encryptedHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(authTag);
    const decrypted = Buffer.concat([decipher.update(encrypted), decipher.final()]);
    return decrypted.toString('utf8');
  } catch (err) {
    logger.warn(`Çözme hatası, ham veri döndürülüyor: ${(err as Error).message}`);
    return cipherText;
  }
};
