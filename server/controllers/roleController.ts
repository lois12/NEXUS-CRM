import { Response } from 'express';
import { get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

const KEY = 'roleMatrix';

/** GET /api/roles/matrix — current permission matrix */
export const getRoleMatrix = (req: AuthRequest, res: Response) => {
  try {
    const row = get('SELECT value FROM app_settings WHERE key = ?', [KEY]);
    let matrix = null;
    if (row?.value) {
      try { matrix = JSON.parse(row.value); } catch { matrix = null; }
    }
    res.json({ success: true, data: matrix });
  } catch (error) {
    console.error('GetRoleMatrix error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

/** PUT /api/roles/matrix — super_admin saves matrix to DB */
export const saveRoleMatrix = (req: AuthRequest, res: Response) => {
  try {
    const { matrix } = req.body;
    if (!matrix || typeof matrix !== 'object') {
      return res.status(400).json({ success: false, error: 'Нужен объект matrix' });
    }
    const json = JSON.stringify(matrix);
    const existing = get('SELECT key FROM app_settings WHERE key = ?', [KEY]);
    if (existing) {
      run("UPDATE app_settings SET value = ?, updatedAt = datetime('now') WHERE key = ?", [json, KEY]);
    } else {
      run('INSERT INTO app_settings (key, value) VALUES (?, ?)', [KEY, json]);
    }
    res.json({ success: true, message: 'Права сохранены на сервере' });
  } catch (error) {
    console.error('SaveRoleMatrix error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};
