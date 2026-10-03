import { Router, Response } from 'express';
import { getAllPosts, getPostById, createPost, updatePost, deletePost, publishPost, getComments, addComment, deleteComment } from '../controllers/contentController';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { run, get } from '../db/database';
import { generateThumbnail } from '../utils/thumbnail';

const router = Router();
router.use(authenticateToken);

// Read — доступно всем авторизованным
router.get('/', getAllPosts);
router.get('/:id', getPostById);

// Write — только super_admin и smm
const canWrite = requireRole('super_admin', 'smm');

router.post('/', canWrite, createPost);
router.put('/:id', canWrite, updatePost);
router.delete('/:id', canWrite, deletePost);
router.post('/:id/publish', canWrite, publishPost);

// Image upload for posts
router.post('/:id/image', canWrite, upload.single('file'), async (req: AuthRequest, res: Response) => {
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

// Comments
router.get('/:id/comments', getComments);
router.post('/:id/comments', addComment);
router.delete('/comments/:id', deleteComment);

export default router;
