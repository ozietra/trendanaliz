import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import { listCommissions, upsertCommission, deleteCommission } from '../controllers/commission.controller';

const router = Router();

router.get('/', authenticateToken as any, listCommissions as any);
router.post('/', authenticateToken as any, upsertCommission as any);
router.delete('/:id', authenticateToken as any, deleteCommission as any);

export default router;
