import { Router } from 'express';
import { authenticateToken } from '../middleware/auth.middleware';
import {
  listGroups,
  createGroup,
  updateGroup,
  deleteGroup,
  addProducts,
  removeProducts,
  autoFillByCategory,
} from '../controllers/product-group.controller';

const router = Router();

router.get('/', authenticateToken as any, listGroups as any);
router.post('/', authenticateToken as any, createGroup as any);
router.put('/:id', authenticateToken as any, updateGroup as any);
router.delete('/:id', authenticateToken as any, deleteGroup as any);
router.post('/:id/products', authenticateToken as any, addProducts as any);
router.delete('/:id/products', authenticateToken as any, removeProducts as any);
router.post('/:id/auto-fill', authenticateToken as any, autoFillByCategory as any);

export default router;
