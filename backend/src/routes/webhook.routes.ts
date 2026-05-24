import { Router } from 'express';
import { trendyolWebhook } from '../controllers/webhook.controller';

const router = Router();

// Public — kimlik doğrulama yok; imza/secret header ile doğrulanır
router.post('/trendyol', trendyolWebhook as any);

export default router;
