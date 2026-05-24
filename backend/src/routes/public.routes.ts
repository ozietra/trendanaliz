import { Router } from 'express';
import { getPlans, getSiteSettings, getPaymentMethods } from '../controllers/public.controller';

const router = Router();

router.get('/plans', getPlans);
router.get('/site-settings', getSiteSettings);
router.get('/payment-methods', getPaymentMethods);

export default router;
