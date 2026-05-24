import { Router } from 'express';
import {
  getStats,
  listUsers,
  updateUser,
  listPlans,
  createPlan,
  updatePlan,
  deletePlan,
  listPayments,
  verifyPayment,
  rejectPayment,
  getSettings,
  upsertSetting,
  listLogs,
  grantTrial,
  cancelUserSubscription,
} from '../controllers/admin.controller';
import { authenticateToken, requireRole } from '../middleware/auth.middleware';
import { Role } from '@prisma/client';

const router = Router();

// Tüm admin route'ları SUPERADMIN ister
router.use(authenticateToken as any, requireRole(Role.SUPERADMIN));

router.get('/stats', getStats as any);

router.get('/users', listUsers as any);
router.patch('/users/:id', updateUser as any);
router.post('/users/:id/grant-trial', grantTrial as any);
router.post('/users/:id/cancel-subscription', cancelUserSubscription as any);

router.get('/plans', listPlans as any);
router.post('/plans', createPlan as any);
router.put('/plans/:id', updatePlan as any);
router.delete('/plans/:id', deletePlan as any);

router.get('/payments', listPayments as any);
router.post('/payments/:id/verify', verifyPayment as any);
router.post('/payments/:id/reject', rejectPayment as any);

router.get('/settings', getSettings as any);
router.put('/settings/:key', upsertSetting as any);

router.get('/logs', listLogs as any);

export default router;
