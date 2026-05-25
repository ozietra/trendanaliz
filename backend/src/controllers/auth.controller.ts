import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import { prisma } from '../config/database';
import { logger } from '../utils/logger';
import { sendMail } from '../utils/mailer';
import { AuthenticatedRequest } from '../middleware/auth.middleware';
import { Role, SubscriptionStatus, PaymentMethod } from '@prisma/client';
import { env } from '../config/env';
import {
  getLoginAttempt,
  registerFailedAttempt as recordFailedAttempt,
  clearLoginAttempts,
  isLocked,
  revokeRefreshToken,
  isRefreshTokenRevoked,
} from '../services/auth-state.service';

// NOT: env.jwtSecret vb. her erişimde process.env'den okur.
// validateEnv() app.ts başlangıcında bu değerlerin geçerli olduğunu garantiler.
// Brute force sayacı ve refresh token kara listesi auth-state.service'e taşındı
// (Redis varsa orada, yoksa bellek-içi fallback ile multi-process güvenli).

// Zod Doğrulama Şemaları
const registerSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  password: z.string().min(6, 'Şifre en az 6 karakter olmalıdır'),
  name: z.string().min(2, 'İsim en az 2 karakter olmalıdır'),
  phone: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
  password: z.string().min(1, 'Şifre gereklidir'),
});

const forgotPasswordSchema = z.object({
  email: z.string().email('Geçerli bir e-posta adresi giriniz'),
});

const resetPasswordSchema = z.object({
  password: z.string().min(6, 'Yeni şifre en az 6 karakter olmalıdır'),
});

// Yardımcı Fonksiyonlar: JWT Üretimi
const generateAccessToken = (userId: string, email: string, role: Role) => {
  return jwt.sign({ id: userId, email, role }, env.jwtSecret, {
    expiresIn: env.jwtExpiresIn as any,
  });
};

const generateRefreshToken = (userId: string, email: string, role: Role) => {
  return jwt.sign({ id: userId, email, role }, env.jwtRefreshSecret, {
    expiresIn: env.jwtRefreshExpiresIn as any,
  });
};

/**
 * POST /api/auth/register
 * E-posta + şifre ile kayıt, e-posta doğrulama maili gönder
 */
export const register = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = registerSchema.parse(req.body);
    const { email, password, name, phone } = validatedData;

    // E-posta benzersizlik kontrolü
    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'Bu e-posta adresi zaten kullanımda.',
      });
    }

    // Şifre Hashing
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Kullanıcı Oluşturma
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        name,
        phone,
        role: Role.USER, // Varsayılan rol USER
        isActive: true, // E-posta doğrulanana kadar da işlem yapabilsin fakat emailVerified false
      },
    });

    logger.info(`Yeni kullanıcı kaydoldu: ${email} (${user.id})`);

    // 🎁 Otomatik 3 günlük PRO plan deneme aboneliği oluştur
    try {
      const proPlan = await prisma.plan.findFirst({ where: { slug: 'pro' } });
      if (proPlan) {
        const now = new Date();
        const endDate = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000); // 3 gün
        await prisma.subscription.create({
          data: {
            userId: user.id,
            planId: proPlan.id,
            status: SubscriptionStatus.TRIAL,
            startDate: now,
            endDate,
            autoRenew: false,
            paymentMethod: PaymentMethod.MANUAL,
          },
        });
        logger.info(`3 günlük PRO deneme oluşturuldu: userId=${user.id}`);
      }
    } catch (trialErr) {
      logger.warn(`Otomatik deneme oluşturulamadı: ${(trialErr as Error).message}`);
    }

    // E-posta Doğrulama Token'ı (JWT - 1 Günlük)
    const verificationToken = jwt.sign({ email }, env.jwtSecret, { expiresIn: '1d' });
    const verificationUrl = `${env.frontendUrl}/verify-email?token=${verificationToken}`;

    // Doğrulama E-postası Gönderimi
    await sendMail({
      to: email,
      subject: 'TrendAnaliz - E-posta Doğrulama',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #0F1F3D;">
          <h2>TrendAnaliz'e Hoş Geldiniz!</h2>
          <p>Merhaba ${name},</p>
          <p>Kayıt işleminizi tamamlamak ve e-posta adresinizi doğrulamak için lütfen aşağıdaki butona tıklayın:</p>
          <p style="margin: 30px 0;">
            <a href="${verificationUrl}" style="background-color: #FF6B00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">E-postamı Doğrula</a>
          </p>
          <p>Eğer buton çalışmıyorsa aşağıdaki linki tarayıcınıza yapıştırabilirsiniz:</p>
          <p>${verificationUrl}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.</p>
          <p style="font-size: 12px; color: #FF6B00; font-weight: bold;">  🎁 3 günlük ücretsiz PRO denemeniz başladı!</p>
        </div>
      `,
    });

    return res.status(201).json({
      success: true,
      message: 'Kayıt başarıyla tamamlandı. 3 günlük ücretsiz PRO denemeniz başladı! Lütfen e-posta adresinize gönderilen doğrulama bağlantısını kontrol edin.',
      data: {
        id: user.id,
        email: user.email,
        name: user.name,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    const err = error as Error;
    logger.error(`Register Hatası: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Kayıt işlemi sırasında bir hata oluştu.',
    });
  }
};

/**
 * POST /api/auth/login
 * JWT erişim token (15 dk) + refresh token (30 gün) döndür
 */
export const login = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = loginSchema.parse(req.body);
    const { email, password } = validatedData;

    // Brute Force Kilit Kontrolü
    const attempt = await getLoginAttempt(email);
    if (isLocked(attempt) && attempt.lockedUntil) {
      const remainingMin = Math.ceil((attempt.lockedUntil - Date.now()) / 60000);
      return res.status(429).json({
        success: false,
        message: `Çok fazla başarısız giriş denemesi. Lütfen ${remainingMin} dakika sonra tekrar deneyin.`,
      });
    }

    // Kullanıcı Bulma
    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      await recordFailedAttempt(email);
      return res.status(400).json({
        success: false,
        message: 'Hatalı e-posta adresi veya şifre.',
      });
    }

    // Kullanıcı Aktiflik Kontrolü
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Hesabınız askıya alınmıştır. Lütfen destek ekibiyle iletişime geçin.',
      });
    }

    // Şifre Eşleşme Kontrolü
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      await recordFailedAttempt(email);
      return res.status(400).json({
        success: false,
        message: 'Hatalı e-posta adresi veya şifre.',
      });
    }

    // Başarılı giriş: sayacı sıfırla
    await clearLoginAttempts(email);

    // Token Üretimi
    const accessToken = generateAccessToken(user.id, user.email, user.role);
    const refreshToken = generateRefreshToken(user.id, user.email, user.role);

    logger.info(`Kullanıcı giriş yaptı: ${email}`);

    return res.json({
      success: true,
      message: 'Giriş başarılı.',
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          emailVerified: user.emailVerified,
        },
        accessToken,
        refreshToken,
      },
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    const err = error as Error;
    logger.error(`Login Hatası: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Giriş işlemi sırasında bir hata oluştu.',
    });
  }
};

/**
 * POST /api/auth/refresh
 * Refresh token ile yeni erişim token
 */
export const refresh = async (req: AuthenticatedRequest, res: Response) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({
      success: false,
      message: 'Yenileme token\'ı gereklidir.',
    });
  }

  try {
    // Token kara liste kontrolü (logout sonrası geçersiz kılınmış)
    if (await isRefreshTokenRevoked(refreshToken)) {
      return res.status(401).json({
        success: false,
        message: 'Yenileme token\'ı geçersiz kılınmış.',
      });
    }

    const decoded = jwt.verify(refreshToken, env.jwtRefreshSecret) as { id: string; email: string; role: Role };

    // Kullanıcı Kontrolü
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        message: 'Kullanıcı bulunamadı veya hesabı aktif değil.',
      });
    }

    // Eski refresh token'ı blacklist'e ekle (rotasyon)
    await revokeRefreshToken(refreshToken);

    // Yeni Access Token ve Refresh Token Üretimi
    const newAccessToken = generateAccessToken(user.id, user.email, user.role);
    const newRefreshToken = generateRefreshToken(user.id, user.email, user.role);

    return res.json({
      success: true,
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      },
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.warn(`Token yenileme başarısız: ${err.message}`);
    return res.status(403).json({
      success: false,
      message: 'Geçersiz veya süresi dolmuş yenileme token\'ı.',
    });
  }
};

/**
 * POST /api/auth/logout
 * Refresh token'ı geçersiz kıl (İstemci tarafında silinmesi istenir, sunucu tarafında başarılı yanıt döner)
 */
export const logout = async (req: AuthenticatedRequest, res: Response) => {
  // İstemciden gönderilen refresh token'ı kara listeye al
  const { refreshToken } = req.body;
  if (refreshToken && typeof refreshToken === 'string') {
    await revokeRefreshToken(refreshToken);
    logger.info(`Refresh token kara listeye alındı: kullanıcı ${req.user?.email || 'bilinmiyor'}`);
  }
  return res.json({
    success: true,
    message: 'Başarıyla çıkış yapıldı.',
  });
};

/**
 * POST /api/auth/verify-email/:token
 * E-posta doğrulama
 */
export const verifyEmail = async (req: AuthenticatedRequest, res: Response) => {
  const { token } = req.params;

  try {
    const decoded = jwt.verify(token, env.jwtSecret) as { email: string };

    const user = await prisma.user.findUnique({ where: { email: decoded.email } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı.',
      });
    }

    if (user.emailVerified) {
      return res.json({
        success: true,
        message: 'E-posta adresi zaten doğrulanmış.',
      });
    }

    // Kullanıcıyı doğrula
    await prisma.user.update({
      where: { email: decoded.email },
      data: { emailVerified: true },
    });

    logger.info(`E-posta doğrulandı: ${decoded.email}`);

    return res.json({
      success: true,
      message: 'E-posta adresiniz başarıyla doğrulandı. Artık giriş yapabilirsiniz.',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`E-posta doğrulama hatası: ${err.message}`);
    return res.status(400).json({
      success: false,
      message: 'Geçersiz veya süresi dolmuş doğrulama bağlantısı.',
    });
  }
};

/**
 * POST /api/auth/forgot-password
 * Şifre sıfırlama maili gönder
 */
export const forgotPassword = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const validatedData = forgotPasswordSchema.parse(req.body);
    const { email } = validatedData;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      // Güvenlik gereği "kullanıcı bulunamadı" demek yerine, e-posta gönderildi mesajı verilir
      return res.json({
        success: true,
        message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi (Eğer kayıtlıysa).',
      });
    }

    // Şifre sıfırlama token'ı (JWT - 1 saat geçerli)
    const resetToken = jwt.sign({ id: user.id, email: user.email }, env.jwtSecret, { expiresIn: '1h' });
    const resetUrl = `${env.frontendUrl}/sifre-sifirla/${resetToken}`;

    await sendMail({
      to: email,
      subject: 'TrendAnaliz - Şifre Sıfırlama Talebi',
      html: `
        <div style="font-family: sans-serif; padding: 20px; color: #0F1F3D;">
          <h2>Şifre Sıfırlama Talebi</h2>
          <p>Merhaba ${user.name},</p>
          <p>TrendAnaliz hesabınız için şifre sıfırlama talebinde bulundunuz. Şifrenizi sıfırlamak için aşağıdaki butona tıklayın:</p>
          <p style="margin: 30px 0;">
            <a href="${resetUrl}" style="background-color: #FF6B00; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Şifremi Sıfırla</a>
          </p>
          <p>Eğer bu talebi siz yapmadıysanız bu e-postayı dikkate almayabilirsiniz. Şifreniz güvende kalacaktır.</p>
          <p>Buton çalışmıyorsa aşağıdaki linki tarayıcınıza yapıştırabilirsiniz:</p>
          <p>${resetUrl}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #666;">Bu e-posta otomatik olarak gönderilmiştir. Lütfen yanıtlamayınız.</p>
        </div>
      `,
    });

    logger.info(`Şifre sıfırlama e-postası gönderildi: ${email}`);

    return res.json({
      success: true,
      message: 'Şifre sıfırlama bağlantısı e-posta adresinize gönderildi.',
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    const err = error as Error;
    logger.error(`Forgot Password Hatası: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Şifre sıfırlama işlemi sırasında bir hata oluştu.',
    });
  }
};

/**
 * POST /api/auth/reset-password/:token
 * Yeni şifre belirleme
 */
export const resetPassword = async (req: AuthenticatedRequest, res: Response) => {
  const { token } = req.params;

  try {
    const validatedData = resetPasswordSchema.parse(req.body);
    const { password } = validatedData;

    const decoded = jwt.verify(token, env.jwtSecret) as { id: string; email: string };

    // Kullanıcı Kontrolü
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı.',
      });
    }

    // Yeni Şifre Hashing
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Güncelleme
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash },
    });

    logger.info(`Şifre başarıyla sıfırlandı: ${user.email}`);

    return res.json({
      success: true,
      message: 'Şifreniz başarıyla güncellendi. Yeni şifrenizle giriş yapabilirsiniz.',
    });
  } catch (error: unknown) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    const err = error as Error;
    logger.error(`Reset Password Hatası: ${err.message}`);
    return res.status(400).json({
      success: false,
      message: 'Geçersiz veya süresi dolmuş sıfırlama bağlantısı.',
    });
  }
};

/**
 * GET /api/auth/me
 * Oturum açık kullanıcı bilgisi
 */
export const me = async (req: AuthenticatedRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        message: 'Oturum açık değil.',
      });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        email: true,
        name: true,
        phone: true,
        role: true,
        isActive: true,
        emailVerified: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Kullanıcı bulunamadı.',
      });
    }

    return res.json({
      success: true,
      data: user,
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`GET Me Hatası: ${err.message}`);
    return res.status(500).json({
      success: false,
      message: 'Kullanıcı bilgisi çekilirken bir hata oluştu.',
    });
  }
};

/**
 * DELETE /api/auth/me
 * Kullanıcının hesap silme talebi göndermesi.
 * Hesap hemen silinmez — admin panelden onaylanması gerekir.
 */
export const requestDeletion = async (req: AuthenticatedRequest, res: Response) => {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Oturum açık değil.' });
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, email: true, role: true, deletionRequestedAt: true },
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'Kullanıcı bulunamadı.' });
    }

    if (user.role === Role.SUPERADMIN) {
      return res.status(403).json({ success: false, message: 'SUPERADMIN hesabı silinemez.' });
    }

    if (user.deletionRequestedAt) {
      return res.json({
        success: true,
        message: 'Hesap silme talebiniz zaten alınmıştır. Yönetim onayı bekleniyor.',
      });
    }

    await prisma.user.update({
      where: { id: user.id },
      data: { deletionRequestedAt: new Date() },
    });

    logger.info(`Hesap silme talebi: ${user.email} (${user.id})`);

    return res.json({
      success: true,
      message: 'Hesap silme talebiniz alındı. Yönetim onayladıktan sonra hesabınız ve tüm verileriniz kalıcı olarak silinecektir.',
    });
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`requestDeletion hatası: ${err.message}`);
    return res.status(500).json({ success: false, message: 'Talep oluşturulurken bir hata oluştu.' });
  }
};
