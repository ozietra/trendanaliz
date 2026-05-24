import { Router } from 'express';
import { getProducts, toggleRepricer, updateProductRule, getCategories } from '../controllers/product.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken as any, getProducts as any);
router.get('/categories', authenticateToken as any, getCategories as any);
router.put('/:id/repricer', authenticateToken as any, toggleRepricer as any);
router.put('/:id/rule', authenticateToken as any, updateProductRule as any);

export default router;
