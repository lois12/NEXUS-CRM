import { Response } from 'express';
import { Router } from 'express';
import { getEvents, createEvent, updateEvent, deleteEvent } from '../controllers/eventsController';
import { authenticateToken, requireRole, AuthRequest } from '../middleware/auth';
import { upload } from '../middleware/upload';
import { run, get, query } from '../db/database';
import { v4 as uuidv4 } from 'uuid';

const router = Router();
router.use(authenticateToken);

router.get('/', getEvents);
router.post('/', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), createEvent);
router.put('/:id', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), updateEvent);
router.delete('/:id', requireRole('super_admin', 'руководитель'), deleteEvent);

// Upload image for event
router.post('/:id/image', requireRole('super_admin', 'руководитель', 'редактор', 'smm'), upload.single('file'), (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const event = get('SELECT id FROM events WHERE id = ?', [id]);
    if (!event) return res.status(404).json({ success: false, error: 'Мероприятие не найдено' });

    const imageUrl = `/uploads/${file.filename}`;
    run("UPDATE events SET imageUrl = ?, updatedAt = datetime('now') WHERE id = ?", [imageUrl, id]);
    res.json({ success: true, data: { imageUrl } });
  } catch (error) {
    console.error('UploadEventImage error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
});

// Event blocks (sub-tasks)
router.get('/:id/blocks', (req: AuthRequest, res: Response) => {
  try {
    const blocks = query('SELECT * FROM event_blocks WHERE eventId = ? ORDER BY createdAt', [req.params.id]);
    res.json({ success: true, data: blocks });
  } catch (error) { res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
});

router.post('/:id/blocks', (req: AuthRequest, res: Response) => {
  try {
    const { title, description, responsiblePerson, deadline } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Название обязательно' });
    const id = uuidv4();
    run('INSERT INTO event_blocks (id, eventId, title, description, responsiblePerson, deadline) VALUES (?, ?, ?, ?, ?, ?)',
      [id, req.params.id, title, description || '', responsiblePerson || '', deadline || '']);
    const block = get('SELECT * FROM event_blocks WHERE id = ?', [id]);
    res.json({ success: true, data: block });
  } catch (error) { res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
});

router.put('/:eventId/blocks/:blockId', (req: AuthRequest, res: Response) => {
  try {
    const { title, description, responsiblePerson, deadline } = req.body;
    const updates: string[] = []; const params: any[] = [];
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (responsiblePerson !== undefined) { updates.push('responsiblePerson = ?'); params.push(responsiblePerson); }
    if (deadline !== undefined) { updates.push('deadline = ?'); params.push(deadline); }
    if (updates.length === 0) return res.json({ success: true });
    params.push(req.params.blockId);
    run(`UPDATE event_blocks SET ${updates.join(', ')} WHERE id = ?`, params);
    const block = get('SELECT * FROM event_blocks WHERE id = ?', [req.params.blockId]);
    res.json({ success: true, data: block });
  } catch (error) { res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
});

router.delete('/:eventId/blocks/:blockId', (req: AuthRequest, res: Response) => {
  try {
    run('DELETE FROM event_blocks WHERE id = ?', [req.params.blockId]);
    res.json({ success: true });
  } catch (error) { res.status(500).json({ success: false, error: 'Ошибка сервера' }); }
});

export default router;
