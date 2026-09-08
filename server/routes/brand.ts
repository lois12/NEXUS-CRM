import { Response } from 'express';
import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAssets, createAsset, updateAsset, deleteAsset } from '../controllers/brandController';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { run, get } from '../db/database';

const router = Router();
router.use(authenticateToken);

router.get('/', getAssets);
router.post('/', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    const { name, category, description } = req.body;
    const file = req.file;
    if (!name) return res.status(400).json({ success: false, error: 'Название обязательно' });
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const id = uuidv4();
    const url = `/uploads/${file.filename}`;

    run('INSERT INTO brand_assets (id, name, category, description, url, mimeType, size, uploadedBy) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, name, category || 'logo', description || '', url, file.mimetype, file.size, req.user?.id]);

    const asset = get('SELECT * FROM brand_assets WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: asset });
  } catch (error) {
    console.error('UploadAsset error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), updateAsset);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteAsset);

export default router;
