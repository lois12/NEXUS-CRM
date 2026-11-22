import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AuthRequest } from '../middleware/auth';
import { query, get, run } from '../db/database';
import { UPLOADS_DIR } from '../paths';

/** Сколько результатов храним на юзера на инструмент (FIFO: 6-й вытесняет 1-й) */
const MAX_PER_TOOL = 5;

const TOOL_ID_RE = /^[a-z0-9-]{1,40}$/;

function convDir(): string {
  const dir = path.join(UPLOADS_DIR, 'conv');
  try { fs.mkdirSync(dir, { recursive: true }); } catch { /* exists */ }
  return dir;
}

/** POST /api/converter/history — сохранить результат конвертации (multer уже положил файл в conv/) */
export const uploadResult = (req: AuthRequest, res: Response) => {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ success: false, error: 'Файл не загружен' });
    const toolId = String(req.body?.toolId || '').trim();
    if (!TOOL_ID_RE.test(toolId)) {
      try { fs.unlinkSync(file.path); } catch { /* noop */ }
      return res.status(400).json({ success: false, error: 'Неверный инструмент' });
    }
    const userId = req.user!.id;
    const origName = String(req.body?.origName || file.originalname || 'file').slice(0, 200);
    const id = uuidv4();
    // multer уже сохранил файл в conv/ как <имя файла>; переименовываем в id для надёжного удаления
    const ext = path.extname(file.originalname).toLowerCase() || '.bin';
    const finalName = `${id}${ext}`;
    const finalPath = path.join(convDir(), finalName);
    try {
      if (path.resolve(file.path) !== path.resolve(finalPath)) fs.renameSync(file.path, finalPath);
    } catch {
      try { fs.copyFileSync(file.path, finalPath); fs.unlinkSync(file.path); } catch { /* noop */ }
    }
    const size = fs.existsSync(finalPath) ? fs.statSync(finalPath).size : (file.size || 0);

    run(
      'INSERT INTO conv_history (id, userId, toolId, fileName, origName, size) VALUES (?, ?, ?, ?, ?, ?)',
      [id, userId, toolId, finalName, origName, size],
    );

    // FIFO: оставляем только MAX_PER_TOOL последних, остальное удаляем вместе с файлами
    const olds = query(
      `SELECT id, fileName FROM conv_history
       WHERE userId = ? AND toolId = ?
       ORDER BY datetime(createdAt) DESC, rowid DESC
       LIMIT -1 OFFSET ?`,
      [userId, toolId, MAX_PER_TOOL],
    ) as { id: string; fileName: string }[];
    for (const old of olds) {
      run('DELETE FROM conv_history WHERE id = ?', [old.id]);
      try { fs.unlinkSync(path.join(convDir(), old.fileName)); } catch { /* noop */ }
    }

    res.json({
      success: true,
      data: { id, origName, size, downloadUrl: `/api/converter/history/${id}` },
    });
  } catch (error) {
    console.error('uploadConvHistory error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сохранения результата' });
  }
};

/** GET /api/converter/history?toolId= — последние 5 действий юзера по инструменту */
export const listHistory = (req: AuthRequest, res: Response) => {
  try {
    const toolId = String(req.query?.toolId || '').trim();
    if (!TOOL_ID_RE.test(toolId)) {
      return res.status(400).json({ success: false, error: 'Неверный инструмент' });
    }
    const rows = query(
      `SELECT id, origName, size, createdAt FROM conv_history
       WHERE userId = ? AND toolId = ?
       ORDER BY datetime(createdAt) DESC, rowid DESC
       LIMIT ?`,
      [req.user!.id, toolId, MAX_PER_TOOL],
    );
    res.json({
      success: true,
      data: rows.map((r: any) => ({
        id: r.id,
        origName: r.origName,
        size: r.size,
        createdAt: r.createdAt,
        downloadUrl: `/api/converter/history/${r.id}`,
      })),
    });
  } catch (error) {
    console.error('listConvHistory error:', error);
    res.status(500).json({ success: false, error: 'Ошибка чтения истории' });
  }
};

/** GET /api/converter/history/:id — скачать сохранённый результат (только свой) */
export const downloadHistory = (req: AuthRequest, res: Response) => {
  try {
    const row = get('SELECT * FROM conv_history WHERE id = ?', [req.params.id]);
    if (!row || row.userId !== req.user!.id) {
      return res.status(404).json({ success: false, error: 'Файл не найден' });
    }
    const filePath = path.join(convDir(), row.fileName);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Файл удалён с сервера' });
    }
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(row.origName)}"`);
    res.setHeader('Content-Length', String(fs.statSync(filePath).size));
    fs.createReadStream(filePath).pipe(res);
  } catch (error) {
    console.error('downloadConvHistory error:', error);
    res.status(500).json({ success: false, error: 'Ошибка скачивания' });
  }
};
