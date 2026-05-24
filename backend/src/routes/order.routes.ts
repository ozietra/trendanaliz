import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  listOrders,
  getOrderDetail,
  setOrderTracking,
  setOrderStatus,
  setOrderInvoice,
  cancelOrderLines,
  getSummary,
  triggerSync,
} from '../controllers/order.controller';

const router = Router();

router.get('/', authenticateToken as any, listOrders as any);
router.get('/summary', authenticateToken as any, getSummary as any);
router.post('/sync', authenticateToken as any, triggerSync as any);
router.get('/:id', authenticateToken as any, getOrderDetail as any);

// Yazma operasyonları — Trendyol API'sine push eder
router.put('/:id/tracking', authenticateToken as any, setOrderTracking as any);
router.put('/:id/status', authenticateToken as any, setOrderStatus as any);
router.put('/:id/invoice', authenticateToken as any, setOrderInvoice as any);
router.post('/:id/cancel', authenticateToken as any, cancelOrderLines as any);

export default router;
