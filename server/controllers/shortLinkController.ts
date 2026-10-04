import { Response } from 'express';
import crypto from 'crypto';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';

/**
 * Minimal URL shortener — shorten ANY link, nothing else (no click stats by design).
 * Codes are 7-char base62 from crypto.randomBytes.
 */

const CODE_LENGTH = 7;
const ALPHABET = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

function generateCode(): string {
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i++) {
    code += ALPHABET[bytes[i] % ALPHABET.length];
  }
  return code;
}

function isValidUrl(raw: string): boolean {
  try {
    const u = new URL(raw);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** POST /api/links/shorten — { url } → { code, shortUrl, url } */
export const shortenUrl = (req: AuthRequest, res: Response) => {
  try {
    const { url } = req.body || {};
    if (!url || typeof url !== 'string') return res.status(400).json({ success: false, error: 'URL обязателен' });
    const trimmed = url.trim();
    if (!isValidUrl(trimmed)) return res.status(400).json({ success: false, error: 'Некорректный URL (нужен http/https)' });

    // Reuse existing code for the same URL + user (idempotent)
    const existing = get('SELECT code FROM short_links WHERE url = ? AND createdBy = ?', [trimmed, req.user!.id]);
    if (existing) {
      return res.json({
        success: true,
        data: { code: existing.code, url: trimmed, shortUrl: `/s/${existing.code}` },
      });
    }

    // Generate unique code (retry on rare collision)
    let code = generateCode();
    for (let i = 0; i < 5 && get('SELECT 1 FROM short_links WHERE code = ?', [code]); i++) {
      code = generateCode();
    }
    if (get('SELECT 1 FROM short_links WHERE code = ?', [code])) {
      return res.status(500).json({ success: false, error: 'Не удалось создать код, попробуйте снова' });
    }

    run('INSERT INTO short_links (id, code, url, createdBy) VALUES (?, ?, ?, ?)',
      [crypto.randomUUID(), code, trimmed, req.user!.id]);

    res.status(201).json({
      success: true,
      data: { code, url: trimmed, shortUrl: `/s/${code}` },
    });
  } catch (error) {
    console.error('ShortenUrl error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

/** GET /api/links — my short links */
export const listMyLinks = (req: AuthRequest, res: Response) => {
  try {
    const links = query(
      'SELECT id, code, url, createdAt FROM short_links WHERE createdBy = ? ORDER BY createdAt DESC LIMIT 100',
      [req.user!.id]
    );
    res.json({ success: true, data: links });
  } catch (error) {
    console.error('ListMyLinks error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

/** DELETE /api/links/:id — delete own link */
export const deleteLink = (req: AuthRequest, res: Response) => {
  try {
    const link = get('SELECT id, createdBy FROM short_links WHERE id = ?', [req.params.id]);
    if (!link) return res.status(404).json({ success: false, error: 'Ссылка не найдена' });
    if (link.createdBy !== req.user!.id) return res.status(403).json({ success: false, error: 'Нет доступа' });
    run('DELETE FROM short_links WHERE id = ?', [req.params.id]);
    res.json({ success: true, message: 'Удалено' });
  } catch (error) {
    console.error('DeleteLink error:', error);
    res.status(500).json({ success: false, error: 'Ошибка сервера' });
  }
};

/** GET /s/:code — public redirect (no auth by design — anyone with the link opens it) */
export const redirectLink = (req: AuthRequest, res: Response) => {
  try {
    const link = get('SELECT url FROM short_links WHERE code = ?', [req.params.code]);
    if (!link) {
      res.status(404).send('Ссылка не найдена');
      return;
    }
    res.redirect(302, link.url);
  } catch (error) {
    console.error('RedirectLink error:', error);
    res.status(500).send('Ошибка сервера');
  }
};
