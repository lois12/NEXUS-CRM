import { Router } from 'express';
import { getArticles, createArticle, updateArticle, deleteArticle, getAttachments, uploadAttachment, deleteAttachment } from '../controllers/knowledgeController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
router.use(authenticateToken);

// Articles
router.get('/', getArticles);
router.post('/', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), createArticle);
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), updateArticle);
router.delete('/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), deleteArticle);

// Attachments
router.get('/:id/attachments', getAttachments);
router.post('/:id/attachments', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), upload.single('file'), uploadAttachment);
router.delete('/attachments/:attId', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), deleteAttachment);

export default router;
