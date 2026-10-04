/**
 * Collage project persistence — SERVER API (SQLite, team-shared).
 * Thin facade over `collageApi` so lobby/editor stay unchanged.
 * Images travel as dataUrl strings (cap on server).
 */
import { collageApi } from '../services/api';

export interface StoredImage {
  id: string;
  dataUrl: string;
}

export interface ProjectMeta {
  id: string;
  name: string;
  description: string;
  updatedAt: number;
  pageCount: number;
}

export interface ProjectVersion {
  id: string;
  name: string;
  at: number;
  pagesJson: string;
  images: StoredImage[];
}

export interface StoredProject extends ProjectMeta {
  pagesJson: string;
  images: StoredImage[];
  versions?: ProjectVersion[];
}

const MAX_VERSIONS = 20;

function toMeta(raw: any): ProjectMeta {
  const t = raw?.updatedAt;
  const ts = typeof t === 'number' ? t : Date.parse(t || '') || Date.now();
  return {
    id: raw.id,
    name: raw.name || '',
    description: raw.description || '',
    updatedAt: ts,
    pageCount: raw.pageCount || 0,
  };
}

function toStored(raw: any): StoredProject {
  return {
    ...toMeta(raw),
    pagesJson: raw.pagesJson || '[]',
    images: Array.isArray(raw.images) ? raw.images : [],
    versions: Array.isArray(raw.versions) ? raw.versions : [],
  };
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const res = await collageApi.list();
  return (res.data || []).map(toMeta).sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<StoredProject | null> {
  try {
    const res = await collageApi.get(id);
    return res.data ? toStored(res.data) : null;
  } catch {
    return null;
  }
}

export async function saveProject(p: StoredProject): Promise<void> {
  await collageApi.save(p.id, {
    name: p.name,
    description: p.description,
    pageCount: p.pageCount,
    pagesJson: p.pagesJson,
    images: p.images,
  });
}

export async function createProject(input: {
  name: string;
  description?: string;
  pagesJson?: string;
  images?: StoredImage[];
}): Promise<StoredProject> {
  const res = await collageApi.create({
    name: input.name,
    description: input.description || '',
    pagesJson: input.pagesJson,
    images: input.images || [],
  });
  return toStored(res.data);
}

export async function deleteProject(id: string): Promise<void> {
  await collageApi.remove(id);
}

export function newProjectId(): string {
  return `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function patchProjectMeta(id: string, patch: { name?: string; description?: string }): Promise<void> {
  await collageApi.patchMeta(id, patch);
}

export async function addProjectVersion(id: string, name: string): Promise<void> {
  await collageApi.addVersion(id, name);
}

export async function deleteProjectVersion(id: string, versionId: string): Promise<void> {
  await collageApi.removeVersion(id, versionId);
}

export function formatRuDate(ts: number): string {
  try {
    return new Date(ts).toLocaleString('ru-RU', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  } catch {
    return new Date(ts).toISOString();
  }
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

export function dataUrlToImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('image load failed'));
    img.src = dataUrl;
  });
}

/** legacy name kept — versions list lives on the project */
export const MAX_STORED_VERSIONS = MAX_VERSIONS;
