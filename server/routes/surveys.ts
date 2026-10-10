import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAnyRole, requireOwnership, ROLE_SUPER, ROLE_BOSS, ROLE_INFO, ROLE_TOURISM } from '../middleware/permissions';
import { upload } from '../middleware/upload';
import {
  getSurveys, getSurveyById, createSurvey, updateSurvey, deleteSurvey, togglePublish, setStatus, duplicateSurvey,
  createQuestion, updateQuestion, deleteQuestion, reorderQuestions,
  getSurveyStats, exportCSV, exportPDF, exportHTML,
} from '../controllers/surveyController';
import { getPublicSurvey, submitSurveyResponse, getPublicSurveyStats } from '../controllers/surveyPublicController';

const router = Router();
router.use(authenticateToken);

const canWrite = requireAnyRole(ROLE_SUPER, ROLE_BOSS, ROLE_INFO, ROLE_TOURISM);
const ownSurvey = requireOwnership('surveys', 'createdBy');

// Surveys CRUD — managers any, others only own
router.get('/', getSurveys);
router.get('/:id', getSurveyById);
router.post('/', canWrite, createSurvey);
router.put('/:id', canWrite, ownSurvey, updateSurvey);
router.delete('/:id', canWrite, ownSurvey, deleteSurvey);
router.post('/:id/toggle-publish', canWrite, ownSurvey, togglePublish);
router.post('/:id/status', canWrite, ownSurvey, setStatus);
router.post('/:id/duplicate', canWrite, ownSurvey, duplicateSurvey);
router.post('/:id/image', canWrite, ownSurvey, upload.single('file'), (req, res) => {
  const file = (req as any).file;
  if (!file) return res.status(400).json({ success: false, error: 'Файл не получен' });
  res.json({ success: true, data: { imageUrl: `/uploads/${file.filename}` } });
});

// Questions
router.post('/:id/questions', canWrite, ownSurvey, createQuestion);
router.put('/:id/questions/:questionId', canWrite, ownSurvey, updateQuestion);
router.delete('/:id/questions/:questionId', canWrite, ownSurvey, deleteQuestion);
router.put('/:id/questions-reorder', canWrite, ownSurvey, reorderQuestions);

// Stats + export
router.get('/:id/stats', getSurveyStats);
router.get('/:id/export/csv', exportCSV);
router.get('/:id/export/pdf', exportPDF);
router.get('/:id/export/html', exportHTML);

export default router;

// Public (unauthenticated) — mount BEFORE auth router
const publicRouter = Router();
publicRouter.get('/surveys/public/:slug', getPublicSurvey);
publicRouter.get('/surveys/public/:slug/stats', getPublicSurveyStats);
publicRouter.post('/surveys/public/:slug/submit', submitSurveyResponse);

export { publicRouter };
