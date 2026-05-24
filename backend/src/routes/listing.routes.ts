import { Router } from 'express';
import { getListingScores } from '../controllers/listing.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();
router.get('/scores', authenticateToken as any, getListingScores as any);
export default router;
