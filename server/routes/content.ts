import { Router, Response } from 'express';
import { getAllPosts, getPostById, createPost, updatePost, deletePost, submitForApproval, approvePost, requestRevision, finalizePost, publishPost, getComments, addComment, deleteComment, getApprovals } from '../controllers/contentController';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { run, get } from '../db/database';
import { generateThumbnail } from '../utils/thumbnail';

const router = Router();
router.use(authenticateToken);

// CRUD
router.get('/', getAllPosts);
router.get('/:id', getPostById);
router.post('/', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), createPost);
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), updatePost);
router.delete('/:id', requireRole('super_admin', 'руководитель', 'редактор'), deletePost);

// Image upload for posts
router.post('/:id/image', upload.single('file'), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const post = get('SELECT id FROM content_posts WHERE id = ?', [id]);
    if (!post) return res.status(404).json({ success: false, error: 'Пост не найден' });

    const imageUrl = `/uploads/${file.filename}`;
    const thumbUrl = await generateThumbnail(file.path);
    run("UPDATE content_posts SET imageUrl = ?, thumbnailUrl = ? WHERE id = ?", [imageUrl, thumbUrl, id]);
    res.json({ success: true, data: { imageUrl, thumbnailUrl: thumbUrl } });
  } catch (error) {
    console.error('Upload content image error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Approval workflow
router.post('/:id/submit', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), submitForApproval);
router.post('/:id/approve', requireRole('super_admin', 'руководитель'), approvePost);
router.post('/:id/request-revision', requireRole('super_admin', 'руководитель'), requestRevision);
router.post('/:id/finalize', requireRole('super_admin', 'руководитель'), finalizePost);
router.post('/:id/publish', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), publishPost);

// Comments
router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);
router.delete('/comments/:id', deleteComment);

// Approvals
router.get('/:id/approvals', getApprovals);

export default router;
