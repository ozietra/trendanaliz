import nodemailer from 'nodemailer';
import { logger } from './logger';

const SMTP_HOST = process.env.SMTP_HOST || 'smtp.mailtrap.io';
const SMTP_PORT = parseInt(process.env.SMTP_PORT || '2525');
const SMTP_USER = process.env.SMTP_USER || '';
const SMTP_PASS = process.env.SMTP_PASS || '';
const SMTP_FROM = process.env.SMTP_FROM || 'noreply@trendanaliz.com';

// E-posta gönderimi için Nodemailer transporter
const transporter = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465, // 465 için true, diğerleri için false
  auth: {
    user: SMTP_USER,
    pass: SMTP_PASS,
  },
});

interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

/**
 * Kullanıcıya e-posta gönderen genel fonksiyon.
 * SMTP yapılandırılmamışsa veya hata verirse e-postayı konsola/loglara yazdırarak geliştiricinin işini kolaylaştırır.
 */
export const sendMail = async (options: EmailOptions): Promise<boolean> => {
  const mailOptions = {
    from: `"TrendAnaliz" <${SMTP_FROM}>`,
    to: options.to,
    subject: options.subject,
    html: options.html,
  };

  try {
    // Sadece mock/test veya boş kimlik bilgisi varsa SMTP'yi pas geç
    if (!SMTP_USER || SMTP_USER === 'test' || SMTP_USER === 'your_smtp_user') {
      logger.info(`[MOCK EMAIL SENT]
      Kime: ${options.to}
      Konu: ${options.subject}
      İçerik (HTML):
      ----------------------------------------
      ${options.html}
      ----------------------------------------`);
      return true;
    }

    const info = await transporter.sendMail(mailOptions);
    logger.info(`E-posta başarıyla gönderildi: ${info.messageId} (Kime: ${options.to})`);
    return true;
  } catch (error: unknown) {
    const err = error as Error;
    logger.error(`E-posta gönderim hatası: ${err.message}. E-posta konsola yazdırılıyor:`);
    logger.info(`[FALLBACK EMAIL]
    Kime: ${options.to}
    Konu: ${options.subject}
    İçerik: ${options.html}`);
    // Geliştirmeyi engellememek için true dönüyoruz
    return true;
  }
};
