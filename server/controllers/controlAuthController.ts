import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { get, run } from '../db/database';
import { JWT_SECRET } from '../config';
import { AuthRequest } from '../middleware/auth';

const CONTROL_TOKEN_TTL = '24h';

function getSetting(key: string): string | null {
  const row = get('SELECT value FROM app_settings WHERE key = ?', [key]);
  return row ? row.value : null;
}

function setSetting(key: string, value: string): void {
  run(
    `INSERT INTO app_settings (key, value, updatedAt) VALUES (?, ?, datetime('now'))
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = datetime('now')`,
    [key, value]
  );
}

function deleteSetting(key: string): void {
  run('DELETE FROM app_settings WHERE key = ?', [key]);
}

/** Whether a control password is currently set. */
export function isControlPasswordSet(): boolean {
  return !!getSetting('controlPasswordHash');
}

/**
 * Public: does CONTROL require a password?
 */
export const getControlStatus = (req: AuthRequest, res: Response) => {
  res.json({ success: true, data: { passwordRequired: isControlPasswordSet() } });
};

/**
 * Public: verify control password → short-lived control token.
 * Body: { password: string }
 */
export const authControl = (req: AuthRequest, res: Response) => {
  const { password } = req.body || {};
  if (!password || typeof password !== 'string') {
    return res.status(400).json({ success: false, error: 'Введите пароль' });
  }

  const hash = getSetting('controlPasswordHash');
  if (!hash) {
    // No password configured — issue token anyway so client flow stays uniform
    const token = jwt.sign({ scope: 'control' }, JWT_SECRET, { expiresIn: CONTROL_TOKEN_TTL });
    return res.json({ success: true, data: { token, passwordRequired: false } });
  }

  if (!bcrypt.compareSync(password, hash)) {
    return res.status(401).json({ success: false, error: 'Неверный пароль' });
  }

  const token = jwt.sign({ scope: 'control' }, JWT_SECRET, { expiresIn: CONTROL_TOKEN_TTL });
  res.json({ success: true, data: { token, passwordRequired: true } });
};

/**
 * Admin: set or clear the control password.
 * Body: { password: string } → set; { password: null | '' } → clear
 */
export const setControlPassword = (req: AuthRequest, res: Response) => {
  const { password } = req.body || {};

  if (password === null || password === '' || password === undefined) {
    deleteSetting('controlPasswordHash');
    return res.json({ success: true, message: 'Пароль CONTROL сброшен' });
  }

  if (typeof password !== 'string' || password.length < 4) {
    return res.status(400).json({ success: false, error: 'Пароль должен быть не короче 4 символов' });
  }

  const hash = bcrypt.hashSync(password, 10);
  setSetting('controlPasswordHash', hash);
  res.json({ success: true, message: 'Пароль CONTROL установлен' });
};
