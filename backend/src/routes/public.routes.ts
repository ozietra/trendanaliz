import { Router } from 'express';
import { getPlans, getSiteSettings } from '../controllers/public.controller';

const router = Router();

router.get('/plans', getPlans);
router.get('/site-settings', getSiteSettings);

export default router;
