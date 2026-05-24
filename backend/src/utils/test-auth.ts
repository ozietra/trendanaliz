import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/database';
import { logger } from './logger';
import { Role } from '@prisma/client';

/**
 * Bu test betiği veritabanı bağlantısını ve temel kimlik doğrulama adımlarını (hashing, jwt) 
 * doğrudan test etmek için tasarlanmıştır.
 */
async function runTests() {
  logger.info('--- TrendAnaliz Kimlik Doğrulama Testi Başlatılıyor ---');

  try {
    // 1. Veritabanı bağlantı testi
    logger.info('Adım 1: Veritabanına bağlanılıyor...');
    await prisma.$connect();
    logger.info('Veritabanı bağlantısı başarılı.');

    // 2. Test kullanıcısının temizlenmesi (varsa)
    const testEmail = 'test_user_2026@trendanaliz.com';
    await prisma.user.deleteMany({
      where: { email: testEmail },
    });
    logger.info(`Temizlik: Eski test kullanıcısı (${testEmail}) silindi.`);

    // 3. Şifre Hashing Testi
    logger.info('Adım 2: Şifre şifreleme (hashing) test ediliyor...');
    const rawPassword = 'SecurePassword123!';
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(rawPassword, salt);
    
    const isPasswordCorrect = await bcrypt.compare(rawPassword, hash);
    if (!isPasswordCorrect) {
      throw new Error('Bcrypt şifre karşılaştırma testi başarısız!');
    }
    logger.info('Şifre şifreleme ve doğrulama başarılı.');

    // 4. Veritabanı Kayıt Testi
    logger.info('Adım 3: Test kullanıcısı veritabanına ekleniyor...');
    const newUser = await prisma.user.create({
      data: {
        email: testEmail,
        passwordHash: hash,
        name: 'Geliştirici Testi',
        role: Role.USER,
        isActive: true,
        emailVerified: false,
      },
    });
    logger.info(`Kullanıcı başarıyla oluşturuldu. ID: ${newUser.id}`);

    // 5. JWT Access / Refresh Token Testi
    logger.info('Adım 4: JWT Access ve Refresh token testi yapılıyor...');
    const jwtSecret = 'test_secret_key';
    const jwtRefreshSecret = 'test_refresh_secret_key';

    const accessToken = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      jwtSecret,
      { expiresIn: '15m' }
    );
    const refreshToken = jwt.sign(
      { id: newUser.id, email: newUser.email, role: newUser.role },
      jwtRefreshSecret,
      { expiresIn: '30d' }
    );

    const decodedAccess = jwt.verify(accessToken, jwtSecret) as any;
    const decodedRefresh = jwt.verify(refreshToken, jwtRefreshSecret) as any;

    if (decodedAccess.email !== testEmail || decodedRefresh.id !== newUser.id) {
      throw new Error('JWT verify ve payload testi başarısız!');
    }
    logger.info('JWT Token üretimi ve doğrulaması başarılı.');

    // 6. Test Kullanıcısı Temizliği
    logger.info('Adım 5: Test verileri temizleniyor...');
    await prisma.user.delete({
      where: { id: newUser.id },
    });
    logger.info('Test kullanıcısı silindi.');

    logger.info('=== TÜM TESTLER BAŞARIYLA TAMAMLANDI (PASSED) ===');
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`=== TEST HATA ALDI ===\n${err.message}`);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Betiği çalıştır
runTests();
