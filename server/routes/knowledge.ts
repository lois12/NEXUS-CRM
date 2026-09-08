import { Router } from 'express';
import { getArticles, createArticle, updateArticle, deleteArticle } from '../controllers/knowledgeController';
import { authenticateToken, requireRole } from '../middleware/auth';

const router = Router();
router.use(authenticateToken);

router.get('/', getArticles);
router.post('/', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), createArticle);
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), updateArticle);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteArticle);

export default router;
