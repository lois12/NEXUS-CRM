import { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getProjects, createProject, updateProject, deleteProject, getTimeline, createTimelinePoint, updateTimelinePoint, deleteTimelinePoint, getDocuments, uploadDocument, deleteDocument } from '../controllers/projectsController';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { upload, uploadMedia, uploadDoc } from '../middleware/upload';
import { run, get, query } from '../db/database';
import { generateThumbnail } from '../utils/thumbnail';

const router = Router();
router.use(authenticateToken);

router.get('/', getProjects);
router.post('/', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), createProject);
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), updateProject);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteProject);

// Upload image for project (media only)
router.post('/:id/image', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), uploadMedia.single('file'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });
    const project = get('SELECT id FROM projects WHERE id = ?', [id]);
    if (!project) return res.status(404).json({ success: false, error: 'Проект не найден' });
    const imageUrl = `/uploads/${file.filename}`;
    run("UPDATE projects SET imageUrl = ?, updatedAt = datetime('now') WHERE id = ?", [imageUrl, id]);
    res.json({ success: true, data: { imageUrl } });
  } catch (error) {
    console.error('UploadProjectImage error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Timeline
router.get('/:projectId/timeline', getTimeline);
router.post('/:projectId/timeline', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), createTimelinePoint);
router.put('/timeline/:pointId', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), updateTimelinePoint);
router.delete('/timeline/:pointId', requireRole('super_admin', 'руководитель'), deleteTimelinePoint);

// Documents (doc files only, multi-upload)
router.get('/:projectId/documents', getDocuments);
router.post('/:projectId/documents', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), uploadDoc.array('files', 20), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) return res.status(400).json({ success: false, error: 'Файлы не загружены' });

    const results = [];

    for (const file of files) {
      const id = uuidv4();
      const decodedName = (file as any).decodedOriginalname || file.originalname;
      run('INSERT INTO project_documents (id, projectId, fileName, filePath, fileSize, mimeType) VALUES (?, ?, ?, ?, ?, ?)',
        [id, projectId, decodedName, `/uploads/${file.filename}`, file.size, file.mimetype]);
      const doc = get('SELECT * FROM project_documents WHERE id = ?', [id]);
      if (doc) results.push(doc);
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('UploadDocuments error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Media upload (images/videos only, multi-upload)
router.post('/:projectId/media', requireRole('super_admin', 'руководитель', 'редактор', 'smm', 'документовед'), uploadMedia.array('files', 20), async (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const files = req.files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) return res.status(400).json({ success: false, error: 'Файлы не загружены' });

    const results = [];

    for (const file of files) {
      const id = uuidv4();
      const decodedName = (file as any).decodedOriginalname || file.originalname;
      const filePath = `/uploads/${file.filename}`;
      const thumbPath = await generateThumbnail(file.path);
      run('INSERT INTO project_documents (id, projectId, fileName, filePath, fileSize, mimeType, thumbnailPath) VALUES (?, ?, ?, ?, ?, ?, ?)',
        [id, projectId, decodedName, filePath, file.size, file.mimetype, thumbPath]);
      const doc = get('SELECT * FROM project_documents WHERE id = ?', [id]);
      if (doc) results.push(doc);
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('UploadMedia error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

router.delete('/documents/:docId', requireRole('super_admin', 'руководитель'), deleteDocument);

// Project links
router.get('/:id/links', (req: AuthRequest, res: Response) => {
  try {
    const links = query('SELECT * FROM project_links WHERE projectId = ? ORDER BY createdAt', [req.params.id]);
    res.json({ success: true, data: links });
  } catch (error) { res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
});

router.post('/:id/links', (req: AuthRequest, res: Response) => {
  try {
    const { title, url, description } = req.body;
    if (!title || !url) return res.status(400).json({ success: false, error: 'Название и URL обязательны' });
    const id = uuidv4();
    run('INSERT INTO project_links (id, projectId, title, url, description) VALUES (?, ?, ?, ?, ?)',
      [id, req.params.id, title, url, description || '']);
    const link = get('SELECT * FROM project_links WHERE id = ?', [id]);
    res.json({ success: true, data: link });
  } catch (error) { res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
});

router.delete('/:projectId/links/:linkId', (req: AuthRequest, res: Response) => {
  try {
    run('DELETE FROM project_links WHERE id = ?', [req.params.linkId]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
});

export default router;
