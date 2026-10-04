import { Response } from 'express';
import crypto from 'crypto';
import { query, get, run } from '../db/database';
import { AuthRequest } from '../middleware/auth';
import { asyncAuthHandler, HttpError } from '../middleware/errorHandler';

/**
 * Collage projects — server-side storage (team-shared).
 * pagesJson: CollagePage[] (history stripped)
 * imagesJson: [{id, dataUrl}]
 * versionsJson: ProjectVersion[] (capped 20)
 */

const MAX_VERSIONS = 20;
const MAX_IMAGES = 80;

function sanitizeImages(raw: unknown): { id: string; dataUrl: string }[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((x: any) => x && typeof x.id === 'string' && typeof x.dataUrl === 'string')
    .slice(0, MAX_IMAGES)
    .map((x: any) => ({ id: x.id, dataUrl: x.dataUrl }));
}

function sanitizePages(raw: unknown): unknown[] {
  return Array.isArray(raw) ? raw : [];
}

function sanitizeVersions(raw: unknown): any[] {
  if (!Array.isArray(raw)) return [];
  return raw.slice(0, MAX_VERSIONS);
}

function metaRow(row: any) {
  return {
    id: row.id,
    name: row.name,
    description: row.description || '',
    updatedAt: row.updatedAt,
    pageCount: row.pageCount || 0,
    ownerName: row.ownerName || '',
  };
}

/** GET /api/collage/projects — list (no heavy blobs) */
export const listProjects = asyncAuthHandler(async (req: AuthRequest, res: Response) => {
  const rows = query(
    `SELECT id, name, description, updatedAt, pageCount, ownerName
     FROM collage_projects
     ORDER BY datetime(updatedAt) DESC`,
  );
  res.json({ success: true, data: rows.map(metaRow) });
});

/** GET /api/collage/projects/:id */
export const getProject = asyncAuthHandler(async (req: AuthRequest, res: Response) => {
  const row = get('SELECT * FROM collage_projects WHERE id = ?', [req.params.id]);
  if (!row) throw new HttpError(404, 'Проект не найден');
  res.json({
    success: true,
    data: {
      ...metaRow(row),
      pagesJson: row.pagesJson,
      images: sanitizeImages(JSON.parse(row.imagesJson || '[]')),
      versions: sanitizeVersions(JSON.parse(row.versionsJson || '[]')),
    },
  });
});

/** POST /api/collage/projects — create */
export const createProject = asyncAuthHandler(async (req: AuthRequest, res: Response) => {
  const { name, description, pagesJson, images } = req.body || {};
  const title = typeof name === 'string' ? name.trim() : '';
  if (!title) throw new HttpError(400, 'Укажите имя проекта');

  const pages = sanitizePages(typeof pagesJson === 'string' ? JSON.parse(pagesJson || '[]') : pagesJson);
  const imgs = sanitizeImages(images);
  const id = `cp_${Date.now().toString(36)}_${crypto.randomBytes(3).toString('hex')}`;
  const pagesStr = JSON.stringify(pages.length ? pages : [{
    id: `p_${Date.now().toString(36)}`,
    name: 'Страница 1',
    format: 'a4',
    orient: 'portrait',
    customW: 1080,
    customH: 1080,
    bgColor: '#0a0a0f',
    bgTransparent: false,
    bgTexture: 'none',
    outerRadius: 0,
    zones: [],
  }]);

  run(
    `INSERT INTO collage_projects
       (id, name, description, ownerId, ownerName, pageCount, pagesJson, imagesJson, versionsJson, createdAt, updatedAt)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, '[]', datetime('now'), datetime('now'))`,
    [
      id,
      title,
      typeof description === 'string' ? description.trim() : '',
      req.user!.id,
      req.user!.username || '',
      (pages.length || 1),
      pagesStr,
      JSON.stringify(imgs),
    ],
  );

  const row = get('SELECT * FROM collage_projects WHERE id = ?', [id])!;
  res.json({ success: true, data: { ...metaRow(row), pagesJson: row.pagesJson, images: imgs, versions: [] } });
});

/** PUT /api/collage/projects/:id — full save (autosave) */
export const saveProject = asyncAuthHandler(async (req: AuthRequest, res: Response) => {
  const existing = get('SELECT id FROM collage_projects WHERE id = ?', [req.params.id]);
  if (!existing) throw new HttpError(404, 'Проект не найден');

  const { name, description, pagesJson, images, pageCount } = req.body || {};
  const pages = sanitizePages(typeof pagesJson === 'string' ? JSON.parse(pagesJson || '[]') : pagesJson);
  const imgs = sanitizeImages(images);

  run(
    `UPDATE collage_projects
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         pageCount = COALESCE(?, pageCount),
         pagesJson = COALESCE(?, pagesJson),
         imagesJson = COALESCE(?, imagesJson),
         updatedAt = datetime('now')
     WHERE id = ?`,
    [
      typeof name === 'string' ? name.trim() : null,
      typeof description === 'string' ? description : null,
      typeof pageCount === 'number' ? pageCount : null,
      pages.length || typeof pagesJson === 'string' ? JSON.stringify(pages) : null,
      images !== undefined ? JSON.stringify(imgs) : null,
      req.params.id,
    ],
  );

  const row = get('SELECT * FROM collage_projects WHERE id = ?', [req.params.id])!;
  res.json({
    success: true,
    data: {
      ...metaRow(row),
      pagesJson: row.pagesJson,
      images: sanitizeImages(JSON.parse(row.imagesJson || '[]')),
      versions: sanitizeVersions(JSON.parse(row.versionsJson || '[]')),
    },
  });
});

/** PATCH /api/collage/projects/:id/meta — rename / description */
export const patchMeta = asyncAuthHandler(async (req: AuthRequest, res: Response) => {
  const existing = get('SELECT id FROM collage_projects WHERE id = ?', [req.params.id]);
  if (!existing) throw new HttpError(404, 'Проект не найден');
  const { name, description } = req.body || {};
  run(
    `UPDATE collage_projects
     SET name = COALESCE(?, name),
         description = COALESCE(?, description),
         updatedAt = datetime('now')
     WHERE id = ?`,
    [
      typeof name === 'string' && name.trim() ? name.trim() : null,
      typeof description === 'string' ? description : null,
      req.params.id,
    ],
  );
  const row = get('SELECT * FROM collage_projects WHERE id = ?', [req.params.id])!;
  res.json({ success: true, data: metaRow(row) });
});

/** DELETE /api/collage/projects/:id */
export const removeProject = asyncAuthHandler(async (req: AuthRequest, res: Response) => {
  const existing = get('SELECT id, ownerId FROM collage_projects WHERE id = ?', [req.params.id]);
  if (!existing) throw new HttpError(404, 'Проект не найден');
  // creator or super_admin
  const roles = req.user!.roles || [req.user!.role];
  if (existing.ownerId !== req.user!.id && !roles.includes('super_admin')) {
    throw new HttpError(403, 'Можно удалять только свои проекты');
  }
  run('DELETE FROM collage_projects WHERE id = ?', [req.params.id]);
  res.json({ success: true, data: { id: req.params.id } });
});

/** POST /api/collage/projects/:id/versions — snapshot */
export const addVersion = asyncAuthHandler(async (req: AuthRequest, res: Response) => {
  const row = get('SELECT * FROM collage_projects WHERE id = ?', [req.params.id]);
  if (!row) throw new HttpError(404, 'Проект не найден');
  const name = typeof req.body?.name === 'string' && req.body.name.trim()
    ? req.body.name.trim()
    : `v · ${new Date().toLocaleString('ru-RU')}`;

  const versions = sanitizeVersions(JSON.parse(row.versionsJson || '[]'));
  versions.unshift({
    id: `v_${Date.now().toString(36)}`,
    name,
    at: Date.now(),
    pagesJson: row.pagesJson,
    images: sanitizeImages(JSON.parse(row.imagesJson || '[]')),
  });
  run('UPDATE collage_projects SET versionsJson = ?, updatedAt = datetime(\'now\') WHERE id = ?', [
    JSON.stringify(versions.slice(0, MAX_VERSIONS)),
    req.params.id,
  ]);
  res.json({ success: true, data: { versions: versions.slice(0, MAX_VERSIONS) } });
});

/** DELETE /api/collage/projects/:id/versions/:vid */
export const removeVersion = asyncAuthHandler(async (req: AuthRequest, res: Response) => {
  const row = get('SELECT versionsJson FROM collage_projects WHERE id = ?', [req.params.id]);
  if (!row) throw new HttpError(404, 'Проект не найден');
  const versions = sanitizeVersions(JSON.parse(row.versionsJson || '[]'))
    .filter((v: any) => v.id !== req.params.vid);
  run('UPDATE collage_projects SET versionsJson = ?, updatedAt = datetime(\'now\') WHERE id = ?', [
    JSON.stringify(versions),
    req.params.id,
  ]);
  res.json({ success: true, data: { versions } });
});
