import { Response, NextFunction, Request } from 'express';
import jwt from 'jsonwebtoken';
import { Role } from '@prisma/client';
import { logger } from '../utils/logger';
import { env } from '../config/env';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: Role;
  };
}

/**
 * JWT Access Token doğrulama middleware'i
 */
export const authenticateToken = (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): void => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1]; // Bearer <token>

  if (!token) {
    logger.warn('Kimlik doğrulama hatası: Token bulunamadı');
    res.status(401).json({
      success: false,
      error: 'Unauthorized',
      message: 'Lütfen giriş yapın. Token bulunamadı.',
    });
    return;
  }

  jwt.verify(token, env.jwtSecret, (err, decoded) => {
    if (err) {
      logger.warn(`Kimlik doğrulama hatası: Geçersiz token - ${err.message}`);
      // 401 dönüyoruz ki frontend interceptor refresh token akışını tetikleyebilsin
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        code: err.name === 'TokenExpiredError' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
        message: 'Oturum süresi dolmuş veya geçersiz token. Lütfen tekrar giriş yapın.',
      });
      return;
    }

    const payload = decoded as { id: string; email: string; role: Role };
    req.user = {
      id: payload.id,
      email: payload.email,
      role: payload.role,
    };
    
    next();
  });
};

/**
 * Belirli rollerin erişimine izin veren middleware guard
 */
export const requireRole = (...allowedRoles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: 'Yetkisiz erişim. Lütfen giriş yapın.',
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      logger.warn(
        `Yetkisiz erişim teşebbüsü: Kullanıcı ${req.user.email} (${req.user.role}) izin verilmeyen rol alanına erişmeye çalıştı: ${allowedRoles.join(', ')}`
      );
      res.status(403).json({
        success: false,
        error: 'Forbidden',
        message: 'Bu alana erişim yetkiniz bulunmamaktadır.',
      });
      return;
    }

    next();
  };
};
