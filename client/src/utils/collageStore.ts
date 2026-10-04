/** Client-side collage project persistence (IndexedDB). */

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

export interface StoredProject extends ProjectMeta {
  /** JSON of CollagePage[] (history stripped) */
  pagesJson: string;
  images: StoredImage[];
}

const DB_NAME = 'nexus-collage';
const STORE = 'projects';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return openDb().then(db => new Promise<T>((resolve, reject) => {
    const t = db.transaction(STORE, mode);
    const req = fn(t.objectStore(STORE));
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  }));
}

export async function listProjects(): Promise<ProjectMeta[]> {
  const all = await tx<StoredProject[]>('readonly', s => s.getAll() as IDBRequest<StoredProject[]>);
  return (all || [])
    .map(({ id, name, description, updatedAt, pageCount }) => ({ id, name, description: description || '', updatedAt, pageCount }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export async function getProject(id: string): Promise<StoredProject | null> {
  const p = await tx<StoredProject | undefined>('readonly', s => s.get(id) as IDBRequest<StoredProject | undefined>);
  return p || null;
}

export async function saveProject(p: StoredProject): Promise<void> {
  await tx('readwrite', s => s.put(p));
}

export async function deleteProject(id: string): Promise<void> {
  await tx('readwrite', s => s.delete(id));
}

export function newProjectId(): string {
  return `cp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function patchProjectMeta(id: string, patch: { name?: string; description?: string }): Promise<void> {
  const cur = await getProject(id);
  if (!cur) return;
  await saveProject({
    ...cur,
    name: patch.name ?? cur.name,
    description: patch.description ?? cur.description,
    updatedAt: Date.now(),
  });
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
