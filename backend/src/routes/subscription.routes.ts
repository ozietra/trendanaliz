import { Router } from 'express';
import {
  getMySubscription,
  cancelSubscription,
  getMyUsage,
} from '../controllers/subscription.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/me', authenticateToken as any, getMySubscription as any);
router.get('/usage', authenticateToken as any, getMyUsage as any);
router.post('/cancel', authenticateToken as any, cancelSubscription as any);

export default router;
