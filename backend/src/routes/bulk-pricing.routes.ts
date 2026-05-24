import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { preview, apply } from '../controllers/bulk-pricing.controller';

const router = Router();

router.post('/preview', authenticateToken as any, preview as any);
router.post('/apply', authenticateToken as any, apply as any);

export default router;
