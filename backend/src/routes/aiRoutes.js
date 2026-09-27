import { Router } from 'express';
import {
  handleGetAIPlan,
  handleGetAIInsights,
  handleExtractDeadlines,
  handleDiffTimetable,
} from '../controllers/aiController.js';

const router = Router();

router.post('/plan', handleGetAIPlan);
router.post('/insights', handleGetAIInsights);
router.post('/extract-deadlines', handleExtractDeadlines);
router.post('/diff-timetable', handleDiffTimetable);

export default router;
