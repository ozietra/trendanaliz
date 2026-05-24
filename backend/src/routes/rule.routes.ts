import { Router } from 'express';
import { getRules, addRule, toggleRule } from '../controllers/rule.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

router.get('/', authenticateToken as any, getRules as any);
router.post('/', authenticateToken as any, addRule as any);
router.put('/:id/toggle', authenticateToken as any, toggleRule as any);

export default router;
