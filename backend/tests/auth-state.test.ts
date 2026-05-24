import { describe, it, expect, beforeEach } from 'vitest';
import {
  getLoginAttempt,
  registerFailedAttempt,
  clearLoginAttempts,
  isLocked,
  revokeRefreshToken,
  isRefreshTokenRevoked,
  _MAX_LOGIN_ATTEMPTS,
} from '../src/services/auth-state.service';

/**
 * REDIS_URL set edilmemiş; bellek-içi fallback üzerinden çalışır.
 * Her test başında temizlik için unique e-posta kullanırız.
 */

describe('auth-state.service (memory fallback)', () => {
  it('başlangıçta 0 başarısız deneme', async () => {
    const r = await getLoginAttempt(`u1-${Date.now()}@x.com`);
    expect(r.count).toEqual(0);
    expect(r.lockedUntil).toBeNull();
  });

  it('başarısız deneme sayacı artar', async () => {
    const email = `u2-${Date.now()}@x.com`;
    await registerFailedAttempt(email);
    await registerFailedAttempt(email);
    const r = await getLoginAttempt(email);
    expect(r.count).toEqual(2);
    expect(isLocked(r)).toBe(false);
  });

  it('MAX denemeye ulaşılınca kilit aktif olur', async () => {
    const email = `u3-${Date.now()}@x.com`;
    for (let i = 0; i < _MAX_LOGIN_ATTEMPTS; i++) {
      await registerFailedAttempt(email);
    }
    const r = await getLoginAttempt(email);
    expect(r.count).toBeGreaterThanOrEqual(_MAX_LOGIN_ATTEMPTS);
    expect(isLocked(r)).toBe(true);
    expect(r.lockedUntil).toBeGreaterThan(Date.now());
  });

  it('clearLoginAttempts sıfırlar', async () => {
    const email = `u4-${Date.now()}@x.com`;
    await registerFailedAttempt(email);
    await clearLoginAttempts(email);
    const r = await getLoginAttempt(email);
    expect(r.count).toEqual(0);
    expect(isLocked(r)).toBe(false);
  });

  it('e-posta büyük/küçük harf duyarsız sayar', async () => {
    const base = `case-${Date.now()}@x.com`;
    await registerFailedAttempt(base.toLowerCase());
    await registerFailedAttempt(base.toUpperCase());
    const r = await getLoginAttempt(base);
    expect(r.count).toEqual(2);
  });

  it('refresh token revoke + isRevoked', async () => {
    const t = `tok_${Date.now()}_${Math.random()}`;
    expect(await isRefreshTokenRevoked(t)).toBe(false);
    await revokeRefreshToken(t);
    expect(await isRefreshTokenRevoked(t)).toBe(true);
  });

  it('revoke aynı token için idempotent', async () => {
    const t = `tok2_${Date.now()}`;
    await revokeRefreshToken(t);
    await revokeRefreshToken(t);
    expect(await isRefreshTokenRevoked(t)).toBe(true);
  });
});
