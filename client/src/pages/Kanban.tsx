import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Edit3, Calendar, Flag, X, Archive, ArchiveRestore, Paperclip, Upload, FileText, Image, File, Download, GripVertical } from 'lucide-react';
import { KanbanTask, KanbanStatus, KanbanPriority, KANBAN_COLUMNS } from '../types';
import { kanbanApi } from '../services/api';
import { showToast } from '../components/ui/NexusModal';
import {
  DndContext,
  DragOverlay,
  closestCorners,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useDroppable } from '@dnd-kit/core';
import { useAutoAnimate } from '@formkit/auto-animate/react';

const PRIORITY_CONFIG: Record<KanbanPriority, { label: string; color: string }> = {
  low: { label: 'НИЗКИЙ', color: '#6b7280' },
  medium: { label: 'СРЕДНИЙ', color: '#00d4ff' },
  high: { label: 'ВЫСОКИЙ', color: '#eab308' },
  urgent: { label: 'СРОЧНЫЙ', color: '#ff3b30' },
};

interface Attachment {
  id: string;
  taskId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  mimeType: string;
  createdAt: string;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1048576).toFixed(1) + ' MB';
}

function getFileIcon(mime: string) {
  if (mime.startsWith('image/')) return <Image className="w-4 h-4" />;
  if (mime.includes('pdf')) return <FileText className="w-4 h-4" />;
  return <File className="w-4 h-4" />;
}

// ── Sortable Task Card ──
function SortableTask({
  task,
  onEdit,
  onDelete,
  onArchive,
}: {
  task: KanbanTask;
  onEdit: () => void;
  onDelete: () => void;
  onArchive?: () => void;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: task.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="p-2 rounded-lg cursor-grab active:cursor-grabbing group transition-all"
      data-task-id={task.id}
      {...attributes}
      {...listeners}
    >
      <div
        className="rounded-lg p-3 transition-all"
        style={{
          background: 'linear-gradient(145deg, rgba(30,30,50,0.6), rgba(20,20,35,0.8))',
          border: '1px solid rgba(255,255,255,0.06)',
          borderLeft: `3px solid ${PRIORITY_CONFIG[task.priority].color}`,
          boxShadow: '0 4px 16px rgba(0,0,0,0.3)',
        }}
      >
        <div className="flex items-start gap-2">
          <div className="mt-0.5 flex-shrink-0 opacity-30 group-hover:opacity-60 transition-opacity">
            <GripVertical className="w-4 h-4 text-gray-400" />
          </div>
          <div className="flex-1 min-w-0" onClick={(e) => { e.stopPropagation(); onEdit(); }}>
            <p className="font-mono text-sm text-gray-200 truncate">{task.title}</p>
            {task.description && <p className="font-mono text-xs text-gray-500 mt-1 line-clamp-2">{task.description}</p>}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded" style={{ backgroundColor: `${PRIORITY_CONFIG[task.priority].color}20`, color: PRIORITY_CONFIG[task.priority].color }}>
                {PRIORITY_CONFIG[task.priority].label}
              </span>
              {task.dueDate && (
                <span className="text-[10px] font-mono text-gray-500 flex items-center gap-1">
                  <Calendar className="w-3 h-3" />{task.dueDate}
                </span>
              )}
            </div>
          </div>
          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
            {onArchive && (
              <button onClick={(e) => { e.stopPropagation(); onArchive(); }} className="p-1 rounded hover:bg-blue-500/20" title="В архив">
                <Archive className="w-3.5 h-3.5 text-blue-400" />
              </button>
            )}
            <button onClick={(e) => { e.stopPropagation(); onEdit(); }} className="p-1 rounded hover:bg-white/10"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
            <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Droppable Column ──
function DroppableColumn({
  column,
  tasks,
  children,
}: {
  column: { id: string; label: string; color: string };
  tasks: KanbanTask[];
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id: column.id });
  const [listRef] = useAutoAnimate({ duration: 200 });

  return (
    <div
      ref={setNodeRef}
      className={`flex flex-col min-h-0 w-[200px] sm:w-[240px] md:w-auto md:flex-1 flex-shrink-0 rounded-xl border-2 transition-colors duration-300 ${isOver ? 'border-dashed' : ''}`}
      style={{
        backgroundColor: isOver ? `${column.color}15` : 'rgba(15,15,25,0.85)',
        borderColor: isOver ? column.color : 'rgba(255,255,255,0.08)',
        borderTopColor: column.color,
        borderTopWidth: '3px',
        boxShadow: isOver
          ? `0 0 30px ${column.color}20, inset 0 0 20px ${column.color}05`
          : `0 -4px 16px ${column.color}10`,
      }}
    >
      <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full" style={{ backgroundColor: column.color, boxShadow: `0 0 10px ${column.color}80` }} />
          <span className="font-mono text-[10px] font-bold tracking-[0.2em] uppercase" style={{ color: column.color, opacity: 0.8 }}>{column.label}</span>
        </div>
        <span className="font-mono text-[10px] px-1.5 py-0.5 rounded" style={{ backgroundColor: `${column.color}15`, color: column.color }}>{tasks.length}</span>
      </div>
      <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-1 min-h-[100px]">
        {children}
        {isOver && tasks.length === 0 && (
          <div className="rounded-lg border-2 border-dashed p-3 flex items-center justify-center min-h-[60px]" style={{ borderColor: `${column.color}40` }}>
            <span className="font-mono text-[10px] text-gray-500">+ СЮДА</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Drag Overlay Card ──
function DragOverlayCard({ task }: { task: KanbanTask }) {
  return (
    <div
      className="p-3 rounded-lg shadow-2xl"
      style={{
        background: 'linear-gradient(145deg, rgba(30,30,50,0.95), rgba(20,20,35,0.98))',
        border: '1px solid rgba(0,255,136,0.3)',
        borderLeft: `3px solid ${PRIORITY_CONFIG[task.priority].color}`,
        boxShadow: '0 12px 40px rgba(0,0,0,0.5), 0 0 20px var(--color-glow)',
        transform: 'rotate(2deg)',
        maxWidth: 300,
      }}
    >
      <p className="font-mono text-sm text-gray-200 truncate">{task.title}</p>
      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded mt-1 inline-block" style={{ backgroundColor: `${PRIORITY_CONFIG[task.priority].color}20`, color: PRIORITY_CONFIG[task.priority].color }}>
        {PRIORITY_CONFIG[task.priority].label}
      </span>
    </div>
  );
}

export default function Kanban() {
  const [tasks, setTasks] = useState<KanbanTask[]>([]);
  const [archived, setArchived] = useState<KanbanTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [tab, setTab] = useState<'active' | 'archive'>('active');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<KanbanTask | null>(null);
  const [form, setForm] = useState({ title: '', description: '', priority: 'medium' as KanbanPriority, dueDate: '' });
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const [activeTask, setActiveTask] = useState<KanbanTask | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor),
  );

  const fetchTasks = useCallback(async () => {
    try {
      const [activeRes, archivedRes] = await Promise.all([kanbanApi.getAll(false), kanbanApi.getAll(true)]);
      if (activeRes.success && activeRes.data) setTasks(activeRes.data);
      if (archivedRes.success && archivedRes.data) setArchived(archivedRes.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchTasks(); }, [fetchTasks]);

  const getColumnTasks = (status: KanbanStatus) =>
    tasks.filter(t => t.status === status).sort((a, b) => a.position - b.position);

  // ── dnd-kit handlers ──
  const handleDragStart = (event: DragStartEvent) => {
    const task = tasks.find(t => t.id === event.active.id);
    if (task) setActiveTask(task);
  };

  const handleDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Check if dropping on a column
    const overColumn = KANBAN_COLUMNS.find(c => c.id === overId);
    const overTask = tasks.find(t => t.id === overId);

    if (overColumn) {
      // Moving to a different column
      if (activeTask.status !== overColumn.id) {
        setTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: overColumn.id as KanbanStatus } : t));
      }
    } else if (overTask && activeTask.status !== overTask.status) {
      // Moving to a column via hovering over a task in that column
      setTasks(prev => prev.map(t => t.id === activeId ? { ...t, status: overTask.status } : t));
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveTask(null);
    if (!over) return;

    const activeId = active.id as string;
    const overId = over.id as string;

    if (activeId === overId) return;

    const activeTask = tasks.find(t => t.id === activeId);
    if (!activeTask) return;

    // Check if reordering within same column
    const overTask = tasks.find(t => t.id === overId);
    if (overTask && activeTask.status === overTask.status) {
      const colTasks = getColumnTasks(activeTask.status);
      const oldIndex = colTasks.findIndex(t => t.id === activeId);
      const newIndex = colTasks.findIndex(t => t.id === overId);
      if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
        const reordered = arrayMove(colTasks, oldIndex, newIndex);
        setTasks(prev => {
          const otherTasks = prev.filter(t => t.status !== activeTask.status);
          const updated = reordered.map((t, i) => ({ ...t, position: i }));
          return [...otherTasks, ...updated];
        });
        kanbanApi.reorder(reordered.map((t, i) => ({ id: t.id, status: t.status, position: i })))
          .catch(() => fetchTasks());
      }
    } else {
      // Cross-column move — get updated task from current state
      setTasks(prev => {
        const movedTask = prev.find(t => t.id === activeId);
        if (!movedTask) return prev;
        const colTasks = prev.filter(t => t.status === movedTask.status);
        kanbanApi.reorder(colTasks.map((t, i) => ({ id: t.id, status: t.status, position: i })))
          .catch(() => fetchTasks());
        return prev;
      });
    }
  };

  // CRUD
  const openCreate = () => {
    setEditingTask(null);
    setForm({ title: '', description: '', priority: 'medium', dueDate: '' });
    setAttachments([]);
    setShowModal(true);
  };

  const openEdit = async (task: KanbanTask) => {
    setEditingTask(task);
    setForm({ title: task.title, description: task.description, priority: task.priority, dueDate: task.dueDate || '' });
    setShowModal(true);
    try {
      const res = await kanbanApi.getAttachments(task.id);
      if (res.success && res.data) setAttachments(res.data);
    } catch { setAttachments([]); }
  };

  const handleSave = async () => {
    if (!form.title.trim()) return;
    try {
      if (editingTask) {
        await kanbanApi.update(editingTask.id, form);
        showToast('Задача обновлена', 'success');
      } else {
        await kanbanApi.create({ ...form, status: 'queue' });
        showToast('Задача создана', 'success');
      }
      setShowModal(false);
      fetchTasks();
    } catch { showToast('Ошибка', 'error'); }
  };

  const handleDelete = async (id: string) => {
    try { await kanbanApi.delete(id); showToast('Удалено', 'success'); fetchTasks(); }
    catch { showToast('Ошибка', 'error'); }
  };
  const handleArchive = async (id: string) => { try { await kanbanApi.archive(id); showToast('В архив', 'success'); fetchTasks(); } catch {} };
  const handleUnarchive = async (id: string) => { try { await kanbanApi.unarchive(id); showToast('Восстановлено', 'success'); fetchTasks(); } catch {} };

  // Attachments
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !editingTask) return;
    setUploading(true);
    try {
      const res = await kanbanApi.uploadAttachment(editingTask.id, file);
      if (res.success && res.data) {
        setAttachments(prev => [res.data, ...prev]);
        showToast('Файл загружен', 'success');
      }
    } catch { showToast('Ошибка загрузки', 'error'); }
    finally { setUploading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    try {
      await kanbanApi.deleteAttachment(attachmentId);
      setAttachments(prev => prev.filter(a => a.id !== attachmentId));
      showToast('Файл удалён', 'success');
    } catch { showToast('Ошибка', 'error'); }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: 'linear' }}>
          <Flag className="w-12 h-12" style={{ color: 'var(--color-primary)' }} />
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-dvh-minus-header flex flex-col gap-3">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text" style={{ color: 'var(--color-primary)' }}>ЗАДАЧИ</h1>
          <p className="text-gray-400 font-mono text-sm mt-1">// {tasks.length} АКТИВНЫХ • {archived.length} В АРХИВЕ</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <div className="flex rounded-lg overflow-hidden border border-gray-700">
            <button onClick={() => setTab('active')} className={`px-3 sm:px-4 py-2 font-mono text-[10px] sm:text-xs font-bold transition-all ${tab === 'active' ? 'text-black' : 'text-gray-400 hover:text-gray-200'}`} style={tab === 'active' ? { backgroundColor: 'var(--color-primary)' } : {}}>АКТИВНЫЕ</button>
            <button onClick={() => setTab('archive')} className={`px-3 sm:px-4 py-2 font-mono text-[10px] sm:text-xs font-bold transition-all flex items-center gap-1 ${tab === 'archive' ? 'text-black' : 'text-gray-400 hover:text-gray-200'}`} style={tab === 'archive' ? { backgroundColor: 'var(--color-primary)' } : {}}>
              <Archive className="w-3 h-3" /> АРХИВ ({archived.length})
            </button>
          </div>
          {tab === 'active' && (
            <button onClick={openCreate} className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-lg font-mono text-xs sm:text-sm font-bold" style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
              <Plus className="w-4 h-4" /> СОЗДАТЬ
            </button>
          )}
        </div>
      </div>

      {/* Active — Kanban */}
      {tab === 'active' && (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={handleDragStart}
          onDragOver={handleDragOver}
          onDragEnd={handleDragEnd}
        >
          <div className="flex-1 overflow-x-auto">
            <div className="flex gap-3 min-h-0 h-full pb-2" style={{ minWidth: 'max-content' }}>
            {KANBAN_COLUMNS.map(col => {
              const colTasks = getColumnTasks(col.id);
              return (
                <DroppableColumn key={col.id} column={col} tasks={colTasks}>
                  <SortableContext items={colTasks.map(t => t.id)} strategy={verticalListSortingStrategy}>
                    {colTasks.map(task => (
                      <SortableTask
                        key={task.id}
                        task={task}
                        onEdit={() => openEdit(task)}
                        onDelete={() => handleDelete(task.id)}
                        onArchive={col.id === 'done' ? () => handleArchive(task.id) : undefined}
                      />
                    ))}
                  </SortableContext>
                </DroppableColumn>
              );
            })}
            </div>
          </div>
          <DragOverlay>
            {activeTask ? <DragOverlayCard task={activeTask} /> : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Archive */}
      {tab === 'archive' && (
        <div className="flex-1 overflow-y-auto space-y-2">
          {archived.length === 0 ? (
            <div className="text-center py-12">
              <Archive className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
              <p className="font-mono text-gray-500">// АРХИВ ПУСТ</p>
            </div>
          ) : (
            archived.map(task => (
              <motion.div key={task.id} layout className="glass-card rounded-xl p-4 group flex items-center gap-4 opacity-70 hover:opacity-100 transition-opacity">
                <div className="flex-1 min-w-0">
                  <p className="font-mono text-sm text-gray-200">{task.title}</p>
                  {task.description && <p className="font-mono text-xs text-gray-500 mt-1">{task.description}</p>}
                </div>
                <div className="flex gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => handleUnarchive(task.id)} className="p-1.5 rounded hover:bg-green-500/20"><ArchiveRestore className="w-4 h-4 text-green-400" /></button>
                  <button onClick={() => handleDelete(task.id)} className="p-1.5 rounded hover:bg-red-500/20"><Trash2 className="w-4 h-4 text-red-400" /></button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[100] p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowModal(false)}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
              className="glass-frost rounded-2xl p-6 w-full max-w-lg max-h-[85vh] overflow-y-auto" style={{ border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>
                  {editingTask ? 'РЕДАКТИРОВАТЬ' : 'НОВАЯ ЗАДАЧА'}
                </h2>
                <button onClick={() => setShowModal(false)} className="p-1 rounded hover:bg-white/10"><X className="w-5 h-5 text-gray-400" /></button>
              </div>
              <div className="space-y-3">
                <input value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} placeholder="// ЗАГОЛОВОК"
                  className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
                <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="// ОПИСАНИЕ" rows={3}
                  className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] resize-none" />
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-mono text-xs text-gray-500 mb-1 block">ПРИОРИТЕТ</label>
                    <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value as KanbanPriority })}
                      className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                      {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="font-mono text-xs text-gray-500 mb-1 block">СРОК</label>
                    <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                  </div>
                </div>

                {/* Attachments */}
                {editingTask && (
                  <div className="border-t border-white/5 pt-3 mt-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-mono text-xs text-gray-400 flex items-center gap-1.5">
                        <Paperclip className="w-3.5 h-3.5" /> ФАЙЛЫ ({attachments.length})
                      </span>
                      <label className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-xs cursor-pointer transition-all ${uploading ? 'opacity-50' : 'hover:bg-white/10'}`} style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
                        <Upload className="w-3.5 h-3.5" />
                        {uploading ? 'ЗАГРУЗКА...' : 'ЗАГРУЗИТЬ'}
                        <input ref={fileRef} type="file" className="hidden" onChange={handleFileUpload} disabled={uploading} />
                      </label>
                    </div>
                    <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                      {attachments.map(att => {
                        const isImage = att.mimeType.startsWith('image/');
                        return (
                          <div key={att.id} className="rounded-lg bg-white/5 overflow-hidden group">
                            {isImage && (
                              <div className="relative cursor-pointer" onClick={() => setZoomImage(`${att.filePath}`)}>
                                <img loading="lazy" decoding="async" src={`${att.filePath}`} alt={att.fileName} className="w-full h-24 object-cover" />
                                <div className="absolute inset-0 bg-black/40 opacity-0 hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <span className="font-mono text-[10px] text-white bg-black/60 px-2 py-1 rounded">ЗУМ</span>
                                </div>
                              </div>
                            )}
                            <div className="flex items-center gap-2 px-3 py-2">
                              <div className="text-gray-500">{getFileIcon(att.mimeType)}</div>
                              <div className="flex-1 min-w-0">
                                <p className="font-mono text-xs text-gray-300 truncate">{att.fileName}</p>
                                <p className="font-mono text-[10px] text-gray-600">{formatFileSize(att.fileSize)}</p>
                              </div>
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <a href={`${att.filePath}`} target="_blank" rel="noopener" className="p-1 rounded hover:bg-white/10" title="Скачать">
                                  <Download className="w-3.5 h-3.5 text-gray-400" />
                                </a>
                                <button onClick={() => handleDeleteAttachment(att.id)} className="p-1 rounded hover:bg-red-500/20" title="Удалить">
                                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                                </button>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                      {attachments.length === 0 && (
                        <p className="font-mono text-[10px] text-gray-600 text-center py-2">// НЕТ ФАЙЛОВ</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <div className="flex gap-3 mt-5">
                <button onClick={() => setShowModal(false)} className="flex-1 px-4 py-2.5 rounded-xl glass font-mono text-sm text-gray-400">ОТМЕНА</button>
                <button onClick={handleSave} className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm font-bold"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>{editingTask ? 'СОХРАНИТЬ' : 'СОЗДАТЬ'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Zoom overlay */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center p-4 cursor-zoom-out"
            style={{ backgroundColor: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
            onClick={() => setZoomImage(null)}>
            <motion.img initial={{ scale: 0.8 }} animate={{ scale: 1 }} exit={{ scale: 0.8 }}
              src={zoomImage} alt="" className="max-w-full max-h-full object-contain rounded-lg shadow-2xl" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
