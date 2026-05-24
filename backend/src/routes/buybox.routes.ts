import { Router } from 'express';
import {
  listBuyboxStatus,
  getBuyboxProductSeries,
  triggerBuyboxSync,
} from '../controllers/buybox.controller';

const router = Router();

router.get('/', listBuyboxStatus as any);
router.post('/sync', triggerBuyboxSync as any);
router.get('/:productId/series', getBuyboxProductSeries as any);

export default router;
