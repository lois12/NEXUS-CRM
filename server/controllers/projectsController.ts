import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../paths';

export const getProjects = (req: AuthRequest, res: Response) => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 200, 500);
    const projects = query('SELECT * FROM projects ORDER BY createdAt DESC LIMIT ?', [limit]);
    res.json({ success: true, data: projects });
  } catch (error) {
    console.error('GetProjects error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createProject = (req: AuthRequest, res: Response) => {
  try {
    const { title, description, status, priority, startDate, endDate, responsiblePerson, budget, progress, imageUrl } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Название обязательно' });

    const id = uuidv4();
    run(`INSERT INTO projects (id, title, description, status, priority, startDate, endDate, responsiblePerson, budget, progress, imageUrl)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, title, description || '', status || 'active', priority || 'medium', startDate || null, endDate || null, responsiblePerson || '', budget || 0, progress || 0, imageUrl || '']);

    const project = get('SELECT * FROM projects WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: project });
  } catch (error) {
    console.error('CreateProject error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateProject = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, priority, startDate, endDate, responsiblePerson, budget, progress, imageUrl } = req.body;

    const project = get('SELECT * FROM projects WHERE id = ?', [id]);
    if (!project) return res.status(404).json({ success: false, error: 'Проект не найден' });

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (status !== undefined) { updates.push('status = ?'); params.push(status); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (startDate !== undefined) { updates.push('startDate = ?'); params.push(startDate); }
    if (endDate !== undefined) { updates.push('endDate = ?'); params.push(endDate); }
    if (responsiblePerson !== undefined) { updates.push('responsiblePerson = ?'); params.push(responsiblePerson); }
    if (budget !== undefined) { updates.push('budget = ?'); params.push(budget); }
    if (progress !== undefined) { updates.push('progress = ?'); params.push(progress); }
    if (imageUrl !== undefined) { updates.push('imageUrl = ?'); params.push(imageUrl); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE projects SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Проект обновлён' });
  } catch (error) {
    console.error('UpdateProject error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteProject = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const project = get('SELECT id FROM projects WHERE id = ?', [id]);
    if (!project) return res.status(404).json({ success: false, error: 'Проект не найден' });
    // Delete associated documents files from disk
    const docs = query('SELECT filePath FROM project_documents WHERE projectId = ?', [id]);
    for (const doc of docs) {
      if (doc.filePath) {
        const fullPath = path.join(UPLOADS_DIR, path.basename(doc.filePath));
        if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
      }
    }
    run('DELETE FROM project_timeline WHERE projectId = ?', [id]);
    run('DELETE FROM project_documents WHERE projectId = ?', [id]);
    run('DELETE FROM projects WHERE id = ?', [id]);
    res.json({ success: true, message: 'Проект удалён' });
  } catch (error) {
    console.error('DeleteProject error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Timeline ──

export const getTimeline = (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const points = query('SELECT * FROM project_timeline WHERE projectId = ? ORDER BY position ASC', [projectId]);
    res.json({ success: true, data: points });
  } catch (error) {
    console.error('GetTimeline error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createTimelinePoint = (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const { type, title, description, date } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Название обязательно' });

    const maxPos = get('SELECT MAX(position) as maxPos FROM project_timeline WHERE projectId = ?', [projectId]);
    const position = (maxPos?.maxPos ?? -1) + 1;

    const id = uuidv4();
    run('INSERT INTO project_timeline (id, projectId, type, title, description, date, position) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [id, projectId, type || 'milestone', title, description || '', date || null, position]);

    const point = get('SELECT * FROM project_timeline WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: point });
  } catch (error) {
    console.error('CreateTimelinePoint error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateTimelinePoint = (req: AuthRequest, res: Response) => {
  try {
    const { pointId } = req.params;
    const { type, title, description, date } = req.body;

    const existing = get('SELECT id FROM project_timeline WHERE id = ?', [pointId]);
    if (!existing) return res.status(404).json({ success: false, error: 'Точка не найдена' });

    const updates: string[] = [];
    const params: any[] = [];

    if (type !== undefined) { updates.push('type = ?'); params.push(type); }
    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (date !== undefined) { updates.push('date = ?'); params.push(date); }

    params.push(pointId);

    if (updates.length > 0) {
      run(`UPDATE project_timeline SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    const point = get('SELECT * FROM project_timeline WHERE id = ?', [pointId]);
    res.json({ success: true, data: point });
  } catch (error) {
    console.error('UpdateTimelinePoint error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteTimelinePoint = (req: AuthRequest, res: Response) => {
  try {
    const { pointId } = req.params;
    run('DELETE FROM project_timeline WHERE id = ?', [pointId]);
    res.json({ success: true, message: 'Точка удалена' });
  } catch (error) {
    console.error('DeleteTimelinePoint error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Documents ──

export const getDocuments = (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const docs = query('SELECT * FROM project_documents WHERE projectId = ? ORDER BY createdAt DESC', [projectId]);
    res.json({ success: true, data: docs });
  } catch (error) {
    console.error('GetDocuments error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadDocument = (req: AuthRequest, res: Response) => {
  try {
    const { projectId } = req.params;
    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const id = uuidv4();
    const decodedName = (file as any).decodedOriginalname || file.originalname;
    run('INSERT INTO project_documents (id, projectId, fileName, filePath, fileSize, mimeType) VALUES (?, ?, ?, ?, ?, ?)',
      [id, projectId, decodedName, `/uploads/${file.filename}`, file.size, file.mimetype]);

    const doc = get('SELECT * FROM project_documents WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: doc });
  } catch (error) {
    console.error('UploadDocument error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteDocument = (req: AuthRequest, res: Response) => {
  try {
    const { docId } = req.params;
    const doc = get('SELECT * FROM project_documents WHERE id = ?', [docId]);
    if (!doc) return res.status(404).json({ success: false, error: 'Документ не найден' });

    const fullPath = path.join(UPLOADS_DIR, path.basename(doc.filePath));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    run('DELETE FROM project_documents WHERE id = ?', [docId]);
    res.json({ success: true, message: 'Документ удалён' });
  } catch (error) {
    console.error('DeleteDocument error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
