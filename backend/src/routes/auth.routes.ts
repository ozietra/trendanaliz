import { Router } from 'express';
import {
  register,
  login,
  refresh,
  logout,
  verifyEmail,
  forgotPassword,
  resetPassword,
  me,
  requestDeletion,
} from '../controllers/auth.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Kamu (Public) Rotalar
router.post('/register', register);
router.post('/login', login);
router.post('/refresh', refresh);
router.get('/verify-email/:token', verifyEmail);
// Spec uyumluluğu: POST de destekleniyor
router.post('/verify-email/:token', verifyEmail);
router.post('/forgot-password', forgotPassword);
router.post('/reset-password/:token', resetPassword);

// Korumalı (Protected) Rotalar
router.get('/me', authenticateToken as any, me);
router.delete('/me', authenticateToken as any, requestDeletion);
router.post('/logout', authenticateToken as any, logout);

export default router;
