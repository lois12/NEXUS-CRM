import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../paths';

export const getAllMaterials = (req: AuthRequest, res: Response) => {
  try {
    const { folder, type } = req.query;
    
    let sql = `
      SELECT m.*, u.fullName as uploaderName
      FROM materials m
      LEFT JOIN users u ON m.uploadedBy = u.id
      WHERE 1=1
    `;
    const params: any[] = [];

    if (folder) {
      sql += ' AND m.folder = ?';
      params.push(folder);
    }

    if (type && type !== 'all') {
      sql += ' AND m.type = ?';
      params.push(type);
    }

    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    sql += ' ORDER BY m.createdAt DESC LIMIT ?';
    params.push(limit);

    const materials = query(sql, params);

    res.json({ success: true, data: materials });
  } catch (error) {
    console.error('GetAllMaterials error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadMaterial = (req: AuthRequest, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Файл не загружен' });
    }

    const { folder } = req.body;
    const file = req.file;
    const id = uuidv4();
    const uploadedBy = req.user?.id;

    // Determine material type based on mimetype
    let type = 'other';
    if (file.mimetype.startsWith('image/')) type = 'image';
    else if (file.mimetype.startsWith('video/')) type = 'video';
    else if (file.mimetype.startsWith('audio/')) type = 'audio';
    else if (
      file.mimetype.includes('pdf') ||
      file.mimetype.includes('document') ||
      file.mimetype.includes('sheet')
    ) type = 'document';

    const url = `/uploads/${file.filename}`;
    const decodedName = (file as any).decodedOriginalname || file.originalname;

    run(`
      INSERT INTO materials (id, name, type, url, size, mimeType, folder, uploadedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [id, decodedName, type, url, file.size, file.mimetype, folder || null, uploadedBy]);

    // Log activity
    run(`
      INSERT INTO activities (id, type, description, userId)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), 'material_uploaded', `Загружен файл: ${decodedName}`, uploadedBy]);

    res.status(201).json({
      success: true,
      data: {
        id,
        name: decodedName,
        type,
        url,
        size: file.size,
        mimeType: file.mimetype,
        folder: folder || null,
        uploadedBy,
      },
    });
  } catch (error) {
    console.error('UploadMaterial error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateMaterial = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { folder, name } = req.body;

    const material = get('SELECT * FROM materials WHERE id = ?', [id]);
    if (!material) {
      return res.status(404).json({ success: false, error: 'Материал не найден' });
    }

    const updates: string[] = [];
    const params: any[] = [];

    if (folder !== undefined) { updates.push('folder = ?'); params.push(folder || null); }
    if (name !== undefined) { updates.push('name = ?'); params.push(name); }

    if (updates.length === 0) {
      return res.json({ success: true, data: material });
    }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    run(`UPDATE materials SET ${updates.join(', ')} WHERE id = ?`, params);

    const updated = get('SELECT * FROM materials WHERE id = ?', [id]);
    res.json({ success: true, data: updated });
  } catch (error) {
    console.error('UpdateMaterial error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteMaterial = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;

    const material = get('SELECT * FROM materials WHERE id = ?', [id]);
    if (!material) {
      return res.status(404).json({ success: false, error: 'Материал не найден' });
    }

    // Delete file from disk
    const filePath = path.join(UPLOADS_DIR, path.basename(material.url));
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    run('DELETE FROM materials WHERE id = ?', [id]);

    // Log activity
    run(`
      INSERT INTO activities (id, type, description, userId)
      VALUES (?, ?, ?, ?)
    `, [uuidv4(), 'material_deleted', `Удален файл: ${material.name}`, req.user?.id]);

    res.json({ success: true, message: 'Материал удален' });
  } catch (error) {
    console.error('DeleteMaterial error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
