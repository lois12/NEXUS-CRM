import { Router } from 'express';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';
import {
  getSurveys, getSurveyById, createSurvey, updateSurvey, deleteSurvey, togglePublish, duplicateSurvey,
  createQuestion, updateQuestion, deleteQuestion, reorderQuestions,
  getSurveyStats, exportCSV, exportPDF, exportHTML,
} from '../controllers/surveyController';
import { getPublicSurvey, submitSurveyResponse } from '../controllers/surveyPublicController';

const router = Router();
router.use(authenticateToken);

// Surveys CRUD
router.get('/', getSurveys);
router.get('/:id', getSurveyById);
router.post('/', requireRole('super_admin', 'руководитель', 'редактор'), createSurvey);
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор'), updateSurvey);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteSurvey);
router.post('/:id/toggle-publish', requireRole('super_admin', 'руководитель', 'редактор'), togglePublish);
router.post('/:id/duplicate', requireRole('super_admin', 'руководитель', 'редактор'), duplicateSurvey);
router.post('/:id/image', requireRole('super_admin', 'руководитель', 'редактор'), upload.single('file'), (req, res) => {
  const file = (req as any).file;
  if (!file) return res.status(400).json({ success: false, error: 'Файл не получен' });
  res.json({ success: true, data: { imageUrl: `/uploads/${file.filename}` } });
});

// Questions
router.post('/:id/questions', requireRole('super_admin', 'руководитель', 'редактор'), createQuestion);
router.put('/:id/questions/:questionId', requireRole('super_admin', 'руководитель', 'редактор'), updateQuestion);
router.delete('/:id/questions/:questionId', requireRole('super_admin', 'руководитель', 'редактор'), deleteQuestion);
router.put('/:id/questions-reorder', requireRole('super_admin', 'руководитель', 'редактор'), reorderQuestions);

// Stats + export
router.get('/:id/stats', getSurveyStats);
router.get('/:id/export/csv', exportCSV);
router.get('/:id/export/pdf', exportPDF);
router.get('/:id/export/html', exportHTML);

export default router;

// Public (unauthenticated) — mount BEFORE auth router
const publicRouter = Router();
publicRouter.get('/surveys/public/:slug', getPublicSurvey);
publicRouter.post('/surveys/public/:slug/submit', submitSurveyResponse);

export { publicRouter };
