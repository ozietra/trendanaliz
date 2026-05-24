import { Router } from 'express';
import {
  getNotifications,
  markAsRead,
  markAllAsRead,
  streamNotifications,
  getPreferences,
  updatePreferences,
} from '../controllers/notification.controller';
import { authenticateToken } from '../middleware/auth.middleware';

const router = Router();

// SSE stream — token query string'den (EventSource header'ları desteklemiyor)
router.get('/stream', streamNotifications as any);

router.get('/', authenticateToken as any, getNotifications as any);
router.get('/preferences', authenticateToken as any, getPreferences as any);
router.put('/preferences', authenticateToken as any, updatePreferences as any);
router.patch('/:id/read', authenticateToken as any, markAsRead as any);
router.post('/read-all', authenticateToken as any, markAllAsRead as any);

export default router;
