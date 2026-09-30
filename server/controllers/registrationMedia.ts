import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../paths';

export const uploadImage = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT id FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const imageUrl = `/uploads/${file.filename}`;
    run("UPDATE registrations SET imageUrl = ?, updatedAt = datetime('now') WHERE id = ?", [imageUrl, id]);
    res.json({ success: true, data: { imageUrl } });
  } catch (error) {
    console.error('UploadImage error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadVideo = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT id FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const videoUrl = `/uploads/${file.filename}`;
    run("UPDATE registrations SET videoUrl = ?, updatedAt = datetime('now') WHERE id = ?", [videoUrl, id]);
    res.json({ success: true, data: { videoUrl } });
  } catch (error) {
    console.error('UploadVideo error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Media Gallery CRUD ──

export const getMedia = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const media = query('SELECT * FROM registration_media WHERE registrationId = ? ORDER BY position ASC', [id]);
    res.json({ success: true, data: media });
  } catch (error) {
    console.error('GetMedia error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadMedia = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const reg = get('SELECT id FROM registrations WHERE id = ?', [id]);
    if (!reg) return res.status(404).json({ success: false, error: 'Регистрация не найдена' });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const mediaId = uuidv4();
    const type = file.mimetype.startsWith('video/') ? 'video' : 'image';
    const maxPos = get('SELECT MAX(position) as maxPos FROM registration_media WHERE registrationId = ?', [id]);
    const pos = (maxPos?.maxPos ?? -1) + 1;

    run('INSERT INTO registration_media (id, registrationId, type, url, filename, size, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [mediaId, id, type, `/uploads/${file.filename}`, file.originalname || file.filename, file.size, pos]);

    const media = get('SELECT * FROM registration_media WHERE id = ?', [mediaId]);
    res.status(201).json({ success: true, data: media });
  } catch (error) {
    console.error('UploadMedia error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteMedia = (req: AuthRequest, res: Response) => {
  try {
    const { mediaId } = req.params;
    const media = get('SELECT * FROM registration_media WHERE id = ?', [mediaId]);
    if (!media) return res.status(404).json({ success: false, error: 'Файл не найден' });

    const filePath = path.join(UPLOADS_DIR, path.basename(media.url));
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);

    run('DELETE FROM registration_media WHERE id = ?', [mediaId]);
    res.json({ success: true, message: 'Удалено' });
  } catch (error) {
    console.error('DeleteMedia error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};