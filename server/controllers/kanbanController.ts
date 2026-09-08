import { Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { UPLOADS_DIR } from '../paths';

const COLUMNS = ['queue', 'in_progress', 'review', 'done'];

export const getTasks = (req: AuthRequest, res: Response) => {
  try {
    const archived = req.query.archived === '1' ? 1 : 0;
    const tasks = query('SELECT * FROM kanban_tasks WHERE userId = ? AND archived = ? ORDER BY position ASC', [req.user?.id, archived]);
    res.json({ success: true, data: tasks });
  } catch (error) {
    console.error('GetTasks error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const createTask = (req: AuthRequest, res: Response) => {
  try {
    const { title, description, status, priority, dueDate } = req.body;
    if (!title) return res.status(400).json({ success: false, error: 'Заголовок обязателен' });

    const id = uuidv4();
    const finalStatus = COLUMNS.includes(status) ? status : 'queue';
    const maxPos = get('SELECT MAX(position) as maxPos FROM kanban_tasks WHERE userId = ? AND status = ? AND archived = 0', [req.user?.id, finalStatus]);
    const position = (maxPos?.maxPos ?? -1) + 1;

    run('INSERT INTO kanban_tasks (id, title, description, status, position, priority, dueDate, userId) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, title, description || '', finalStatus, position, priority || 'medium', dueDate || null, req.user?.id]);

    const task = get('SELECT * FROM kanban_tasks WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: task });
  } catch (error) {
    console.error('CreateTask error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const updateTask = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { title, description, status, position, priority, dueDate } = req.body;

    const task = get('SELECT * FROM kanban_tasks WHERE id = ? AND userId = ?', [id, req.user?.id]);
    if (!task) return res.status(404).json({ success: false, error: 'Задача не найдена' });

    const updates: string[] = [];
    const params: any[] = [];

    if (title !== undefined) { updates.push('title = ?'); params.push(title); }
    if (description !== undefined) { updates.push('description = ?'); params.push(description); }
    if (status !== undefined && COLUMNS.includes(status)) { updates.push('status = ?'); params.push(status); }
    if (position !== undefined) { updates.push('position = ?'); params.push(position); }
    if (priority !== undefined) { updates.push('priority = ?'); params.push(priority); }
    if (dueDate !== undefined) { updates.push('dueDate = ?'); params.push(dueDate); }

    updates.push("updatedAt = datetime('now')");
    params.push(id);

    if (updates.length > 1) {
      run(`UPDATE kanban_tasks SET ${updates.join(', ')} WHERE id = ?`, params);
    }

    res.json({ success: true, message: 'Задача обновлена' });
  } catch (error) {
    console.error('UpdateTask error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteTask = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const task = get('SELECT * FROM kanban_tasks WHERE id = ? AND userId = ?', [id, req.user?.id]);
    if (!task) return res.status(404).json({ success: false, error: 'Задача не найдена' });

    run('DELETE FROM kanban_tasks WHERE id = ?', [id]);
    res.json({ success: true, message: 'Задача удалена' });
  } catch (error) {
    console.error('DeleteTask error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const archiveTask = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const task = get('SELECT * FROM kanban_tasks WHERE id = ? AND userId = ?', [id, req.user?.id]);
    if (!task) return res.status(404).json({ success: false, error: 'Задача не найдена' });

    run("UPDATE kanban_tasks SET archived = 1, updatedAt = datetime('now') WHERE id = ?", [id]);
    res.json({ success: true, message: 'Задача архивирована' });
  } catch (error) {
    console.error('ArchiveTask error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const unarchiveTask = (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const task = get('SELECT * FROM kanban_tasks WHERE id = ? AND userId = ?', [id, req.user?.id]);
    if (!task) return res.status(404).json({ success: false, error: 'Задача не найдена' });

    run("UPDATE kanban_tasks SET archived = 0, status = 'done', updatedAt = datetime('now') WHERE id = ?", [id]);
    res.json({ success: true, message: 'Задача восстановлена' });
  } catch (error) {
    console.error('UnarchiveTask error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const reorderTasks = (req: AuthRequest, res: Response) => {
  try {
    const { tasks } = req.body;
    if (!Array.isArray(tasks)) return res.status(400).json({ success: false, error: 'tasks массив обязателен' });

    for (const t of tasks) {
      run("UPDATE kanban_tasks SET status = ?, position = ?, updatedAt = datetime('now') WHERE id = ? AND userId = ?",
        [t.status, t.position, t.id, req.user?.id]);
    }

    res.json({ success: true, message: 'Порядок обновлён' });
  } catch (error) {
    console.error('ReorderTasks error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

// ── Attachments ──

export const getAttachments = (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = get('SELECT id FROM kanban_tasks WHERE id = ? AND userId = ?', [taskId, req.user?.id]);
    if (!task) return res.status(404).json({ success: false, error: 'Задача не найдена' });

    const attachments = query('SELECT * FROM task_attachments WHERE taskId = ? ORDER BY createdAt DESC', [taskId]);
    res.json({ success: true, data: attachments });
  } catch (error) {
    console.error('GetAttachments error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const uploadAttachment = (req: AuthRequest, res: Response) => {
  try {
    const { taskId } = req.params;
    const task = get('SELECT id FROM kanban_tasks WHERE id = ? AND userId = ?', [taskId, req.user?.id]);
    if (!task) return res.status(404).json({ success: false, error: 'Задача не найдена' });

    const file = (req as any).file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });

    const id = uuidv4();
    const decodedName = file.decodedOriginalname || file.originalname;
    run('INSERT INTO task_attachments (id, taskId, fileName, filePath, fileSize, mimeType) VALUES (?, ?, ?, ?, ?, ?)',
      [id, taskId, decodedName, `/uploads/${file.filename}`, file.size, file.mimetype]);

    const attachment = get('SELECT * FROM task_attachments WHERE id = ?', [id]);
    res.status(201).json({ success: true, data: attachment });
  } catch (error) {
    console.error('UploadAttachment error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

export const deleteAttachment = (req: AuthRequest, res: Response) => {
  try {
    const { attachmentId } = req.params;
    const attachment = get('SELECT * FROM task_attachments WHERE id = ?', [attachmentId]);
    if (!attachment) return res.status(404).json({ success: false, error: 'Файл не найден' });

    // Verify task belongs to user
    const task = get('SELECT id FROM kanban_tasks WHERE id = ? AND userId = ?', [attachment.taskId, req.user?.id]);
    if (!task) return res.status(404).json({ success: false, error: 'Задача не найдена' });

    // Delete file from disk
    const fullPath = path.join(UPLOADS_DIR, path.basename(attachment.filePath));
    if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);

    run('DELETE FROM task_attachments WHERE id = ?', [attachmentId]);
    res.json({ success: true, message: 'Файл удалён' });
  } catch (error) {
    console.error('DeleteAttachment error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
