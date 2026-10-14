import { Router } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireAnyRole, requireOwnership, ROLE_SUPER, ROLE_BOSS, ROLE_INFO, ROLE_TOURISM } from '../middleware/permissions';
import {
  listQuizzes, getQuiz, createQuiz, updateQuiz, deleteQuiz, duplicateQuiz,
  saveQuestions, listResults, deleteResult, exportResultsPdf, getPublicQuiz, submitQuiz, startQuiz, getPublicResults,
} from '../controllers/quizController';

const authRouter = Router();
authRouter.use(authenticateToken);

const canWrite = requireAnyRole(ROLE_SUPER, ROLE_BOSS, ROLE_INFO, ROLE_TOURISM);
const ownQuiz = requireOwnership('quizzes', 'createdBy');

authRouter.get('/', listQuizzes);
authRouter.get('/:id', getQuiz);
authRouter.post('/', canWrite, createQuiz);
authRouter.put('/:id', canWrite, ownQuiz, updateQuiz);
authRouter.delete('/:id', canWrite, ownQuiz, deleteQuiz);
authRouter.post('/:id/duplicate', canWrite, ownQuiz, duplicateQuiz);
authRouter.put('/:id/questions', canWrite, ownQuiz, saveQuestions);
authRouter.get('/:id/results', listResults);
authRouter.delete('/:id/results/:participantId', canWrite, ownQuiz, deleteResult);
authRouter.get('/:id/results/pdf', exportResultsPdf);

// Public (no auth) — mount before auth router
const publicRouter = Router();
publicRouter.get('/quizzes/public/:slug', getPublicQuiz);
publicRouter.get('/quizzes/public/:slug/results', getPublicResults);
publicRouter.post('/quizzes/public/:slug/start', startQuiz);
publicRouter.post('/quizzes/public/:slug/submit', submitQuiz);

export default authRouter;
export { publicRouter };
