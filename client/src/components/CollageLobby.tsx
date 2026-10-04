import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { FolderOpen, Plus, Pencil, Trash2, X, Layers } from 'lucide-react';
import {
  listProjects, getProject, saveProject, deleteProject, newProjectId,
  formatRuDate, type ProjectMeta,
} from '../utils/collageStore';
import { showToast, ConfirmModal, useNexusConfirm } from './ui/NexusModal';

interface Props {
  onOpen: (id: string) => void;
}

interface Draft {
  id: string | null; // null = create
  name: string;
  description: string;
}

/** Project lobby for /photo-collage — create / rename / open */
export default function CollageLobby({ onOpen }: Props) {
  const [projects, setProjects] = useState<ProjectMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<Draft | null>(null);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();

  const refresh = async () => {
    try {
      setProjects(await listProjects());
    } catch {
      showToast('Не удалось загрузить проекты', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const saveDraft = async () => {
    if (!draft) return;
    const name = draft.name.trim();
    if (!name) { showToast('Укажите имя проекта', 'error'); return; }
    const description = draft.description.trim();
    try {
      if (draft.id) {
        const cur = await getProject(draft.id);
        if (!cur) { showToast('Проект не найден', 'error'); return; }
        await saveProject({ ...cur, name, description, updatedAt: Date.now() });
        showToast('Проект обновлён', 'success');
      } else {
        const id = newProjectId();
        await saveProject({
          id, name, description,
          updatedAt: Date.now(),
          pageCount: 1,
          pagesJson: JSON.stringify([{
            id: `p_${Date.now().toString(36)}`,
            name: 'Страница 1',
            format: 'a4',
            orient: 'portrait',
            customW: 1080,
            customH: 1080,
            bgColor: '#0a0a0f',
            outerRadius: 0,
            zones: [],
          }]),
          images: [],
        });
        showToast('Проект создан', 'success');
        setDraft(null);
        onOpen(id);
        return;
      }
      setDraft(null);
      refresh();
    } catch {
      showToast('Ошибка сохранения', 'error');
    }
  };

  const askDelete = (p: ProjectMeta) => {
    showConfirm(
      'Удалить проект?',
      `«${p.name}» будет удалён безвозвратно.`,
      async () => {
        closeConfirm();
        try {
          await deleteProject(p.id);
          showToast('Проект удалён', 'success');
          refresh();
        } catch {
          showToast('Ошибка удаления', 'error');
        }
      },
      'danger',
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <Layers className="w-7 h-7" /> КОЛЛАЖ — ПРОЕКТЫ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// СОЗДАЙТЕ ПРОЕКТ И ОТКРОЙТЕ РЕДАКТОР</p>
        </div>
        <button
          onClick={() => setDraft({ id: null, name: '', description: '' })}
          className="px-4 py-2.5 rounded-xl font-mono text-sm font-bold flex items-center gap-2"
          style={{ background: 'var(--color-primary)', color: '#000' }}
        >
          <Plus className="w-4 h-4" /> НОВЫЙ ПРОЕКТ
        </button>
      </div>

      {loading && (
        <p className="font-mono text-xs text-gray-500">загрузка…</p>
      )}

      {!loading && projects.length === 0 && (
        <div className="glass rounded-xl p-10 text-center">
          <FolderOpen className="w-10 h-10 mx-auto text-gray-600 mb-3" />
          <p className="font-mono text-sm text-gray-400">Пока нет проектов</p>
          <p className="font-mono text-[10px] text-gray-600 mt-1">нажмите «НОВЫЙ ПРОЕКТ» — задайте имя и описание</p>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {projects.map(p => (
          <motion.div
            key={p.id}
            whileHover={{ scale: 1.01 }}
            className="glass rounded-xl p-4 space-y-2 cursor-pointer relative"
            onClick={() => onOpen(p.id)}
          >
            <div className="flex items-start justify-between gap-2">
              <h3 className="font-mono text-sm font-bold text-white truncate flex-1">{p.name}</h3>
              <div className="flex gap-1 shrink-0" onClick={e => e.stopPropagation()}>
                <button
                  onClick={() => setDraft({ id: p.id, name: p.name, description: p.description })}
                  className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500 hover:text-gray-200"
                  title="Изменить имя / описание"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => askDelete(p)}
                  className="p-1.5 rounded-lg hover:bg-red-500/10 text-gray-500 hover:text-red-400"
                  title="Удалить проект"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {p.description && (
              <p className="font-mono text-[10px] text-gray-400 leading-relaxed" style={{ display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                {p.description}
              </p>
            )}
            <div className="flex items-center justify-between font-mono text-[9px] text-gray-600 pt-1 border-t border-white/5">
              <span>{p.pageCount} стр.</span>
              <span>изм. {formatRuDate(p.updatedAt)}</span>
            </div>
          </motion.div>
        ))}
      </div>

      {/* create / edit modal */}
      {draft && (
        <div className="fixed inset-0 z-[2000] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.65)' }}
          onClick={() => setDraft(null)}>
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={e => e.stopPropagation()}
            className="glass rounded-xl p-5 w-full max-w-md space-y-3"
            style={{ background: 'linear-gradient(135deg, rgba(20,20,35,0.98), rgba(10,10,20,0.99))' }}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>
                {draft.id ? 'ПРОЕКТ' : 'НОВЫЙ ПРОЕКТ'}
              </h3>
              <button onClick={() => setDraft(null)} className="p-1 rounded hover:bg-white/10 text-gray-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <label className="font-mono text-[10px] text-gray-500 mb-1 block">ИМЯ *</label>
              <input
                autoFocus
                value={draft.name}
                onChange={e => setDraft(d => d ? { ...d, name: e.target.value } : d)}
                onKeyDown={e => { if (e.key === 'Enter') saveDraft(); }}
                placeholder="Например: Афиши октябрь"
                className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]"
              />
            </div>
            <div>
              <label className="font-mono text-[10px] text-gray-500 mb-1 block">ОПИСАНИЕ</label>
              <textarea
                value={draft.description}
                onChange={e => setDraft(d => d ? { ...d, description: e.target.value } : d)}
                rows={3}
                placeholder="Зачем этот проект, что внутри…"
                className="w-full px-3 py-2 rounded-lg font-mono text-xs bg-black/30 border border-gray-700 text-gray-200 focus:outline-none resize-none"
              />
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => setDraft(null)}
                className="flex-1 py-2.5 rounded-lg font-mono text-xs glass text-gray-400 hover:text-gray-200">
                ОТМЕНА
              </button>
              <button onClick={saveDraft}
                className="flex-1 py-2.5 rounded-lg font-mono text-xs font-bold"
                style={{ background: 'var(--color-primary)', color: '#000' }}>
                {draft.id ? 'СОХРАНИТЬ' : 'СОЗДАТЬ И ОТКРЫТЬ'}
              </button>
            </div>
          </motion.div>
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type === 'danger' ? 'danger' : 'warning'}
        confirmText="УДАЛИТЬ"
      />
    </div>
  );
}
