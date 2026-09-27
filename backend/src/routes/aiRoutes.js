import { Router } from 'express';
import { handleGetAIPlan, handleGetAIInsights } from '../controllers/aiController.js';

const router = Router();

router.post('/plan', handleGetAIPlan);
router.post('/insights', handleGetAIInsights);

export default router;
