import { Router } from 'express';
import { getTasks, createTask, updateTask, deleteTask, reorderTasks, archiveTask, unarchiveTask, getAttachments, uploadAttachment, deleteAttachment } from '../controllers/kanbanController';
import { authenticateToken } from '../middleware/auth';
import { upload } from '../middleware/upload';

const router = Router();
router.use(authenticateToken);

router.get('/', getTasks);
router.post('/', createTask);
router.put('/reorder', reorderTasks);
router.put('/:id', updateTask);
router.put('/:id/archive', archiveTask);
router.put('/:id/unarchive', unarchiveTask); // FIX: was archiveTask
router.delete('/:id', deleteTask);

// Attachments
router.get('/:taskId/attachments', getAttachments);
router.post('/:taskId/attachments', upload.single('file'), uploadAttachment);
router.delete('/attachments/:attachmentId', deleteAttachment);

export default router;
