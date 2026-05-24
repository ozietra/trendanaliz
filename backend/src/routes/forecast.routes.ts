import { Router } from 'express';
import { getProductForecasts } from '../controllers/forecast.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
router.get('/products', authenticateToken as any, getProductForecasts as any);
export default router;
