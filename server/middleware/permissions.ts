import { Response, NextFunction } from 'express';
import type { AuthRequest } from './auth';

/**
 * NEXUS roles (v2):
 * - super_admin      — everything, including /admin
 * - руководитель     — everything except /admin
 * - информационный   — all modules except admin; materials/records = own only; content plan write
 * - туризм           — same as информационный, but content plan READ-only
 *
 * Legacy roles (smm / редактор / документовед / мол) map to nearest new role
 * so existing users keep working after deploy.
 */

export const ROLE_SUPER = 'super_admin';
export const ROLE_BOSS = 'руководитель';
export const ROLE_INFO = 'информационный';
export const ROLE_TOURISM = 'туризм';

/** legacy → effective capability set */
const LEGACY_MAP: Record<string, string[]> = {
  smm: [ROLE_INFO],
  редактор: [ROLE_INFO],
  документовед: [ROLE_TOURISM],
  мол: [ROLE_TOURISM],
};

export function userRoles(req: AuthRequest): string[] {
  const raw = req.user?.roles?.length ? req.user.roles : [req.user?.role].filter(Boolean) as string[];
  const set = new Set<string>();
  for (const r of raw) {
    set.add(r);
    for (const alias of LEGACY_MAP[r] || []) set.add(alias);
  }
  return [...set];
}

export function hasAnyRole(req: AuthRequest, ...roles: string[]): boolean {
  const rs = userRoles(req);
  return roles.some((r) => rs.includes(r));
}

/** Full manage of all records (no ownership limit) */
export function isManager(req: AuthRequest): boolean {
  return hasAnyRole(req, ROLE_SUPER, ROLE_BOSS);
}

export function isAdmin(req: AuthRequest): boolean {
  return hasAnyRole(req, ROLE_SUPER);
}

/** Content plan write (туризм is read-only) */
export function canWriteContent(req: AuthRequest): boolean {
  return hasAnyRole(req, ROLE_SUPER, ROLE_BOSS, ROLE_INFO);
}

/** Hidden modules for each role */
export function blockedModules(req: AuthRequest): string[] {
  const rs = userRoles(req);
  const blocked: string[] = [];
  if (!rs.includes(ROLE_SUPER)) blocked.push('admin');
  if (rs.includes(ROLE_TOURISM) && !rs.includes(ROLE_SUPER) && !rs.includes(ROLE_BOSS)) {
    blocked.push('content_write');
  }
  return blocked;
}

/** Middleware: at least one of roles */
export function requireAnyRole(...roles: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    if (!hasAnyRole(req, ...roles)) {
      return res.status(403).json({ success: false, error: 'Недостаточно прав' });
    }
    next();
  };
}

/**
 * Ownership gate for update/delete of a row.
 * Managers (super_admin, руководитель) always pass.
 * Others must own the row via one of `ownerColumns`.
 *
 * Usage: router.delete('/:id', auth, requireOwnership('materials', 'uploadedBy'), handler)
 */
export function requireOwnership(table: string, ...ownerColumns: string[]) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) return res.status(401).json({ success: false, error: 'Требуется авторизация' });
    if (isManager(req)) return next();

    const id = req.params.id;
    if (!id) return res.status(400).json({ success: false, error: 'Нет id' });

    // lazy import to avoid cycle
    const { get } = require('../db/database') as typeof import('../db/database');
    const row = get(`SELECT * FROM "${table}" WHERE id = ?`, [id]) as Record<string, unknown> | null;
    if (!row) return res.status(404).json({ success: false, error: 'Запись не найдена' });

    const me = req.user.id;
    const owned = ownerColumns.some((col) => row[col] === me);
    if (!owned) {
      return res.status(403).json({ success: false, error: 'Можно менять только свои записи' });
    }
    next();
  };
}

/** Soft filter helper: managers see all, others see own rows only (for list GET) */
export function ownershipWhere(req: AuthRequest, alias: string, ...ownerColumns: string[]): { sql: string; params: string[] } {
  if (isManager(req)) return { sql: '', params: [] };
  const me = req.user!.id;
  const parts = ownerColumns.map((c) => `"${alias}"."${c}" = ?`);
  return { sql: ` AND (${parts.join(' OR ')})`, params: ownerColumns.map(() => me) };
}
