/**
 * Test ortamı kurulumu.
 *
 * - Test sırasında secret'ları sahte fakat geçerli (uzunluk + farklılık)
 *   değerlerle setler ki `validateEnv()` testte fail etmesin.
 * - Production'da bu değerlere düşmemesi için NODE_ENV=test sabitlenir.
 */

process.env.NODE_ENV = 'test';
process.env.JWT_SECRET =
  process.env.JWT_SECRET ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  'fedcba9876543210fedcba9876543210fedcba9876543210fedcba9876543210';
process.env.ENCRYPTION_KEY =
  process.env.ENCRYPTION_KEY ||
  'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
process.env.DATABASE_URL =
  process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';

// Sentry'yi testte tamamen pasif tut
delete process.env.SENTRY_DSN;
