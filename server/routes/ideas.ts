import { Router } from 'express';
import {
  getAllIdeas, createIdea, updateIdea, deleteIdea,
  createLink, deleteLink,
  getComments, addComment, deleteComment,
  getAttachments, uploadAttachment, deleteAttachment,
} from '../controllers/ideasController';
import { authenticateToken, requireRole } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
router.use(authenticateToken);

// Ideas CRUD
router.get('/', getAllIdeas);
router.post('/', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), createIdea);
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), updateIdea);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteIdea);

// Links
router.post('/link', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), createLink);
router.delete('/link/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), deleteLink);

// Comments
router.get('/:ideaId/comments', getComments);
router.post('/:ideaId/comments', addComment);
router.delete('/comments/:id', deleteComment);

// Attachments
router.get('/:ideaId/attachments', getAttachments);
router.post('/:ideaId/attachments', upload.single('file'), uploadAttachment);
router.delete('/attachments/:id', deleteAttachment);

export default router;
