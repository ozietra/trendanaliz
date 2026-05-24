import crypto from 'crypto';
import { getRedis } from '../config/redis';
import { logger } from '../utils/logger';

/**
 * Auth State Service — distributed-safe brute force sayacı
 * ve refresh token kara listesi.
 *
 * Redis varsa Redis kullanılır (multi-process güvenli);
 * yoksa bellek-içi Map/Set fallback'i (development).
 *
 * Anahtar şemaları:
 *   auth:fail:{emailLowerCase}             (string: "count|lockedUntilMs")  TTL = LOCK_DURATION
 *   auth:revoked:{tokenHash}               (string: "1")                    TTL = refresh token süresi
 */

const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000; // 15 dakika
const REVOKED_TTL_S = 30 * 24 * 60 * 60; // 30 gün (refresh token ömrüne eşit)

// Bellek-içi fallback yapıları
interface MemAttempt {
  count: number;
  lockedUntil: number | null;
  expiresAt: number;
}
const memAttempts = new Map<string, MemAttempt>();
const memRevoked = new Map<string, number>(); // tokenHash -> expiresAt

// Periyodik bellek temizliği (Redis kullanılmıyorsa)
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of memAttempts) {
    if (v.expiresAt < now) memAttempts.delete(k);
  }
  for (const [k, exp] of memRevoked) {
    if (exp < now) memRevoked.delete(k);
  }
}, 60_000).unref();

const failKey = (email: string) => `auth:fail:${email.toLowerCase()}`;
const revokedKey = (tokenHash: string) => `auth:revoked:${tokenHash}`;

/**
 * Refresh token'ı saklamak yerine SHA-256 hash'ini saklarız;
 * böylece tüm token leak'lese bile kara liste içeriği değersiz olur.
 */
const hashToken = (token: string): string =>
  crypto.createHash('sha256').update(token).digest('hex');

// ---------- Brute force sayacı ----------

export interface AttemptInfo {
  count: number;
  lockedUntil: number | null;
}

export const getLoginAttempt = async (email: string): Promise<AttemptInfo> => {
  const redis = getRedis();
  if (redis) {
    try {
      const v = await redis.get(failKey(email));
      if (!v) return { count: 0, lockedUntil: null };
      const [count, lockedUntil] = v.split('|').map((x) => parseInt(x, 10));
      return {
        count: count || 0,
        lockedUntil: lockedUntil > 0 ? lockedUntil : null,
      };
    } catch (err) {
      logger.warn(`[auth-state] redis get hatası: ${(err as Error).message}`);
    }
  }
  // memory fallback
  const v = memAttempts.get(email.toLowerCase());
  if (!v) return { count: 0, lockedUntil: null };
  if (v.expiresAt < Date.now()) {
    memAttempts.delete(email.toLowerCase());
    return { count: 0, lockedUntil: null };
  }
  return { count: v.count, lockedUntil: v.lockedUntil };
};

export const registerFailedAttempt = async (
  email: string
): Promise<AttemptInfo> => {
  const current = await getLoginAttempt(email);
  const next: AttemptInfo = {
    count: current.count + 1,
    lockedUntil: current.lockedUntil,
  };
  if (next.count >= MAX_LOGIN_ATTEMPTS) {
    next.lockedUntil = Date.now() + LOCK_DURATION_MS;
    logger.warn(`Hesap kilitlendi (15 dk): ${email} - ${next.count} başarısız deneme`);
  }

  const redis = getRedis();
  const value = `${next.count}|${next.lockedUntil ?? 0}`;
  const ttlSeconds = Math.ceil(LOCK_DURATION_MS / 1000);

  if (redis) {
    try {
      await redis.set(failKey(email), value, 'EX', ttlSeconds);
      return next;
    } catch (err) {
      logger.warn(`[auth-state] redis set hatası: ${(err as Error).message}`);
    }
  }
  memAttempts.set(email.toLowerCase(), {
    count: next.count,
    lockedUntil: next.lockedUntil,
    expiresAt: Date.now() + LOCK_DURATION_MS,
  });
  return next;
};

export const clearLoginAttempts = async (email: string): Promise<void> => {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.del(failKey(email));
      return;
    } catch (err) {
      logger.warn(`[auth-state] redis del hatası: ${(err as Error).message}`);
    }
  }
  memAttempts.delete(email.toLowerCase());
};

export const isLocked = (info: AttemptInfo): boolean =>
  info.lockedUntil !== null && info.lockedUntil > Date.now();

// ---------- Refresh token kara listesi ----------

export const revokeRefreshToken = async (token: string): Promise<void> => {
  const h = hashToken(token);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(revokedKey(h), '1', 'EX', REVOKED_TTL_S);
      return;
    } catch (err) {
      logger.warn(`[auth-state] redis revoke hatası: ${(err as Error).message}`);
    }
  }
  memRevoked.set(h, Date.now() + REVOKED_TTL_S * 1000);
};

export const isRefreshTokenRevoked = async (token: string): Promise<boolean> => {
  const h = hashToken(token);
  const redis = getRedis();
  if (redis) {
    try {
      return Boolean(await redis.exists(revokedKey(h)));
    } catch (err) {
      logger.warn(`[auth-state] redis exists hatası: ${(err as Error).message}`);
    }
  }
  const exp = memRevoked.get(h);
  if (!exp) return false;
  if (exp < Date.now()) {
    memRevoked.delete(h);
    return false;
  }
  return true;
};

export const _MAX_LOGIN_ATTEMPTS = MAX_LOGIN_ATTEMPTS;
