import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  getProfitReport,
  updateProductCost,
  bulkUpdateProductCost,
} from '../controllers/profit.controller';

const router = Router();

// Kar-zarar raporu
router.get('/report', authenticateToken as any, getProfitReport as any);

// Tek ürün maliyet güncelle
router.patch('/cost/:barcode', authenticateToken as any, updateProductCost as any);

// Toplu maliyet güncelle
router.patch('/bulk-cost', authenticateToken as any, bulkUpdateProductCost as any);

export default router;
