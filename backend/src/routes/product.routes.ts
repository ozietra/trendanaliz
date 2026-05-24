import { Router } from 'express';
import { getProducts, toggleRepricer, updateProductRule } from '../controllers/product.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken as any, getProducts as any);
router.put('/:id/repricer', authenticateToken as any, toggleRepricer as any);
router.put('/:id/rule', authenticateToken as any, updateProductRule as any);

export default router;
