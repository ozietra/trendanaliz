import { Router } from 'express';
import {
  integrateStore,
  getStoreStatus,
  getStoreLogsEndpoint,
  testConnection,
  syncProducts,
  pushPriceInventory,
  getDashboardStats,
} from '../controllers/store.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.post('/integrate', authenticateToken as any, integrateStore as any);
router.post('/test-connection', authenticateToken as any, testConnection as any);
router.get('/status', authenticateToken as any, getStoreStatus as any);
router.get('/dashboard-stats', authenticateToken as any, getDashboardStats as any);
router.get('/logs', authenticateToken as any, getStoreLogsEndpoint as any);
router.post('/sync', authenticateToken as any, syncProducts as any);
router.post('/push-price-inventory', authenticateToken as any, pushPriceInventory as any);

export default router;
