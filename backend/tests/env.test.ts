import { describe, it, expect, beforeEach, afterEach } from 'vitest';

/**
 * validateEnv() davranış testleri.
 * Modülün process.env'den okuduğu değerleri her testte snapshotlayıp
 * restore ediyoruz ki testler birbirini etkilemesin.
 */

const snapshot = () => ({
  JWT_SECRET: process.env.JWT_SECRET,
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET,
  ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
  DATABASE_URL: process.env.DATABASE_URL,
  NODE_ENV: process.env.NODE_ENV,
});

const restore = (s: ReturnType<typeof snapshot>) => {
  for (const [k, v] of Object.entries(s)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
};

describe('validateEnv()', () => {
  let snap: ReturnType<typeof snapshot>;

  beforeEach(() => {
    snap = snapshot();
  });
  afterEach(() => {
    restore(snap);
  });

  it('geçerli env değerleri ile hata atmaz', async () => {
    const { validateEnv } = await import('../src/config/env');
    expect(() => validateEnv()).not.toThrow();
  });

  it('JWT_SECRET tanımsızsa fırlatır', async () => {
    delete process.env.JWT_SECRET;
    const { validateEnv } = await import('../src/config/env');
    expect(() => validateEnv()).toThrow();
  });

  it('bilinen hardcoded fallback değeri reddeder', async () => {
    process.env.JWT_SECRET = 'trendanaliz_jwt_secret_key_2026_very_secure';
    const { validateEnv } = await import('../src/config/env');
    expect(() => validateEnv()).toThrow();
  });

  it('JWT_SECRET ile JWT_REFRESH_SECRET aynı olamaz', async () => {
    process.env.JWT_REFRESH_SECRET = process.env.JWT_SECRET;
    const { validateEnv } = await import('../src/config/env');
    expect(() => validateEnv()).toThrow();
  });

  it('ENCRYPTION_KEY çok kısaysa production\'da fail eder', async () => {
    process.env.NODE_ENV = 'production';
    process.env.ENCRYPTION_KEY = 'short';
    const { validateEnv } = await import('../src/config/env');
    expect(() => validateEnv()).toThrow();
  });

  it('production + TRENDYOL_LIVE_PUSH=1 + SIMULATE_COMPETITORS=1 reddedilir', async () => {
    process.env.NODE_ENV = 'production';
    process.env.TRENDYOL_LIVE_PUSH = '1';
    process.env.SIMULATE_COMPETITORS = '1';
    const { validateEnv } = await import('../src/config/env');
    expect(() => validateEnv()).toThrow();
    delete process.env.TRENDYOL_LIVE_PUSH;
    delete process.env.SIMULATE_COMPETITORS;
  });
});
