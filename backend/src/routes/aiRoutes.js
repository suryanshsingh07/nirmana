import { Router } from 'express';
import {
  handleGetAIPlan,
  handleGetAIInsights,
  handleExtractDeadlines,
} from '../controllers/aiController.js';

const router = Router();

router.post('/plan', handleGetAIPlan);
router.post('/insights', handleGetAIInsights);
router.post('/extract-deadlines', handleExtractDeadlines);

export default router;
