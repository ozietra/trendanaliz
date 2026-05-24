import { Router } from 'express';
import { listCampaigns, calculateROI } from '../controllers/campaign.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
router.get('/', authenticateToken as any, listCampaigns as any);
router.post('/calculate', authenticateToken as any, calculateROI as any);
export default router;
