import { Router } from 'express';
import { getCompetitors, addCompetitor, deleteCompetitor } from '../controllers/competitor.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken as any, getCompetitors as any);
router.post('/', authenticateToken as any, addCompetitor as any);
router.delete('/:id', authenticateToken as any, deleteCompetitor as any);

export default router;
