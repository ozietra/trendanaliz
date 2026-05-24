import { Router } from 'express';
import express from 'express';
import {
  createCheckout,
  iyzicoWebhook,
  paytrWebhook,
  getPaymentStatus,
  mockSuccess,
} from '../controllers/payment.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// Korumalı: yeni ödeme oluştur
router.post('/checkout', authenticateToken as any, createCheckout as any);
router.get('/:id', authenticateToken as any, getPaymentStatus as any);
router.post('/:id/mock-success', authenticateToken as any, mockSuccess as any);

// Public webhook'lar - kimlik doğrulama yok, hash ile doğrulanır
// PayTR form-urlencoded gönderir
router.post(
  '/webhook/paytr',
  express.urlencoded({ extended: false }),
  paytrWebhook as any
);
router.post('/webhook/iyzico', iyzicoWebhook as any);

export default router;
