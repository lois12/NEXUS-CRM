import { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Search, Edit3, Trash2, Copy, ChevronLeft, List as ListIcon, Users, Download, FileText, ArrowUpDown, ArrowUp, ArrowDown, Check, X as XIcon, Eye, EyeOff } from 'lucide-react';
import { listsApi } from '../services/api';
import { showToast, useNexusConfirm, ConfirmModal } from '../components/ui/NexusModal';
import { SkeletonGrid, SkeletonHeader } from '../components/ui/Skeleton';
import FieldBuilder from '../components/registrations/FieldBuilder';
import { List, ListField, ListEntry, FieldType, RegistrationField, FIELD_TYPE_CONFIG } from '../types';

export default function Lists() {
  const [lists, setLists] = useState<List[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [view, setView] = useState<'list' | 'edit' | 'entries'>('list');
  const [editing, setEditing] = useState<List | null>(null);
  const [form, setForm] = useState({ name: '', description: '' });
  const [listFields, setListFields] = useState<ListField[]>([]);
  const [entries, setEntries] = useState<ListEntry[]>([]);
  const [search, setSearch] = useState('');
  const [filterCalled, setFilterCalled] = useState<'' | '1' | '0'>('');
  const [filterVisited, setFilterVisited] = useState<'' | '1' | '0'>('');
  const [sortField, setSortField] = useState('lastName');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [entryForm, setEntryForm] = useState({ lastName: '', firstName: '', patronymic: '', phone: '', email: '', comment: '' });
  const [entryAnswers, setEntryAnswers] = useState<Record<string, string>>({});
  const [editingEntry, setEditingEntry] = useState<ListEntry | null>(null);
  const [showPdfTheme, setShowPdfTheme] = useState(false);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();

  const fetchData = useCallback(async () => {
    try {
      const res = await listsApi.getAll();
      if (res.success && res.data) setLists(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const normalizeFields = (fields: any[]): ListField[] => {
    return (fields || []).map(f => ({
      ...f,
      options: typeof f.options === 'string' ? f.options : JSON.stringify(f.options || []),
    }));
  };

  // ── Open Edit ──
  const openEdit = async (list: List) => {
    try {
      const res = await listsApi.getOne(list.id);
      if (res.success && res.data) {
        const data = res.data;
        setEditing(data);
        setForm({ name: data.name, description: data.description || '' });
        setListFields(normalizeFields(data.fields));
        setView('edit');
      }
    } catch { showToast('Ошибка загрузки', 'error'); }
  };

  // ── Open Entries ──
  const openEntries = async (list: List) => {
    try {
      const res = await listsApi.getOne(list.id);
      if (res.success && res.data) {
        setEditing(res.data);
        setListFields(normalizeFields(res.data.fields));
        setEntries(Array.isArray(res.data.entries) ? res.data.entries : []);
        setView('entries');
        setSearch('');
        setFilterCalled('');
        setFilterVisited('');
        setSortField('lastName');
        setSortDir('asc');
      }
    } catch { showToast('Ошибка загрузки', 'error'); }
  };

  // ── Open Create ──
  const openCreate = () => {
    setEditing(null);
    setForm({ name: '', description: '' });
    setListFields([]);
    setView('edit');
  };

  // ── Save List ──
  const handleSave = async () => {
    if (!form.name.trim()) { showToast('Введите название списка', 'error'); return; }
    try {
      let listId = editing?.id;
      if (editing) {
        await listsApi.update(editing.id, form);
        listId = editing.id;
      } else {
        const res = await listsApi.create(form);
        if (res.success && res.data) listId = res.data.id;
      }

      if (listId) {
        // Delete removed fields
        const existingIds = listFields.map(f => f.id);
        const currentFields = editing ? (await listsApi.getOne(listId)).data?.fields || [] : [];
        for (const f of currentFields) {
          if (!existingIds.includes(f.id)) {
            await listsApi.deleteField(listId, f.id);
          }
        }
        // Create/update fields
        for (let i = 0; i < listFields.length; i++) {
          const field = listFields[i];
          const fieldData = {
            ...field,
            position: i,
            options: typeof field.options === 'string' ? field.options : JSON.stringify(field.options || []),
          };
          if (field.id.startsWith('temp-')) {
            await listsApi.createField(listId, fieldData);
          } else {
            await listsApi.updateField(listId, field.id, fieldData);
          }
        }
      }

      showToast(editing ? 'Обновлено' : 'Создано', 'success');
      setView('list');
      fetchData();
    } catch { showToast('Ошибка сохранения', 'error'); }
  };

  // ── Duplicate List ──
  const handleDuplicate = async (id: string) => {
    try {
      const res = await listsApi.duplicate(id);
      if (res.success) { showToast('Список скопирован', 'success'); fetchData(); }
    } catch { showToast('Ошибка копирования', 'error'); }
  };

  // ── Delete List ──
  const handleDelete = (list: List) => {
    showConfirm('УДАЛИТЬ?', `"${list.name}" будет удалён безвозвратно.`, async () => {
      try { await listsApi.delete(list.id); showToast('Удалено', 'success'); fetchData(); }
      catch { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  // ── Toggle Publish ──
  const handleTogglePublish = async (list: List) => {
    try {
      const res = await listsApi.togglePublish(list.id);
      if (res.success) {
        showToast(list.isPublic ? 'Ссылка убрана' : 'Список опубликован');
        fetchData();
      }
    } catch { showToast('Ошибка', 'error'); }
  };

  // ── Copy Link ──
  const handleCopyLink = (slug: string) => {
    navigator.clipboard.writeText(`${window.location.origin}/lists/public/${slug}`);
    showToast('Ссылка скопирована');
  };

  // ── Field Builder helpers (cast ListField to RegistrationField for FieldBuilder) ──
  const toRegField = (f: ListField): RegistrationField => ({
    ...f,
    options: typeof f.options === 'string' ? f.options : JSON.stringify(f.options || []),
    settings: '{}',
    registrationId: f.listId,
  });

  const addField = (type: FieldType) => {
    const tempId = `temp-${Date.now()}`;
    const config = FIELD_TYPE_CONFIG[type];
    const newField: ListField = {
      id: tempId, listId: '', type, label: config.label,
      placeholder: '', required: 0, options: JSON.stringify(['Вариант 1', 'Вариант 2']),
      position: listFields.length, createdAt: new Date().toISOString(),
    };
    setListFields(prev => [...prev, newField]);
  };

  const updateField = (fieldId: string, data: Partial<RegistrationField>) => {
    setListFields(prev => prev.map(f => {
      if (f.id !== fieldId) return f;
      const updated: any = { ...f };
      if (data.label !== undefined) updated.label = data.label;
      if (data.placeholder !== undefined) updated.placeholder = data.placeholder;
      if (data.required !== undefined) updated.required = data.required;
      if (data.options !== undefined) updated.options = Array.isArray(data.options) ? JSON.stringify(data.options) : data.options;
      if (data.type !== undefined) updated.type = data.type;
      return updated as ListField;
    }));
  };

  const deleteField = (fieldId: string) => {
    setListFields(prev => prev.filter(f => f.id !== fieldId));
  };

  const duplicateField = (fieldId: string) => {
    setListFields(prev => {
      const src = prev.find(f => f.id === fieldId);
      if (!src) return prev;
      const dup: ListField = {
        ...src,
        id: `temp-${Date.now()}`,
        label: src.label + ' (копия)',
        position: prev.length,
        createdAt: new Date().toISOString(),
      };
      const idx = prev.findIndex(f => f.id === fieldId);
      const arr = [...prev];
      arr.splice(idx + 1, 0, dup);
      return arr;
    });
  };

  const reorderFields = (from: number, to: number) => {
    setListFields(prev => {
      const arr = [...prev];
      const [item] = arr.splice(from, 1);
      arr.splice(to, 0, item);
      return arr;
    });
  };

  // ── Entry CRUD ──
  const handleAddEntry = async () => {
    if (!editing) return;
    if (!entryForm.lastName.trim()) { showToast('Введите фамилию', 'error'); return; }
    try {
      const payload = { ...entryForm, answers: JSON.stringify(entryAnswers) };
      if (editingEntry) {
        await listsApi.updateEntry(editing.id, editingEntry.id, payload);
        showToast('Обновлено', 'success');
      } else {
        await listsApi.createEntry(editing.id, payload);
        showToast('Добавлено', 'success');
      }
      setShowAddEntry(false);
      setEditingEntry(null);
      setEntryForm({ lastName: '', firstName: '', patronymic: '', phone: '', email: '', comment: '' });
      setEntryAnswers({});
      // Refresh entries
      const res = await listsApi.getOne(editing.id);
      if (res.success && res.data) setEntries(Array.isArray(res.data.entries) ? res.data.entries : []);
    } catch { showToast('Ошибка', 'error'); }
  };

  const openEditEntry = (entry: ListEntry) => {
    setEditingEntry(entry);
    setEntryForm({
      lastName: entry.lastName || '',
      firstName: entry.firstName || '',
      patronymic: entry.patronymic || '',
      phone: entry.phone || '',
      email: entry.email || '',
      comment: entry.comment || '',
    });
    try {
      const parsed = JSON.parse(entry.answers || '{}');
      setEntryAnswers(typeof parsed === 'object' && parsed !== null ? parsed : {});
    } catch { setEntryAnswers({}); }
    setShowAddEntry(true);
  };

  const handleDeleteEntry = (entryId: string) => {
    if (!editing) return;
    showConfirm('УДАЛИТЬ ЗАПИСЬ?', '', async () => {
      try {
        await listsApi.deleteEntry(editing.id, entryId);
        setEntries(prev => prev.filter(e => e.id !== entryId));
        showToast('Удалено', 'success');
      } catch { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  const handleToggle = async (entryId: string, field: 'called' | 'visited') => {
    if (!editing) return;
    try {
      const res = await listsApi.toggleEntry(editing.id, entryId, field);
      if (res.success) {
        setEntries(prev => prev.map(e => e.id === entryId ? { ...e, [field]: e[field] ? 0 : 1 } : e));
      }
    } catch { showToast('Ошибка', 'error'); }
  };

  // ── Filtering & Sorting for entries ──
  const filteredEntries = useMemo(() => {
    return entries.filter(e => {
      if (filterCalled === '1' && !e.called) return false;
      if (filterCalled === '0' && e.called) return false;
      if (filterVisited === '1' && !e.visited) return false;
      if (filterVisited === '0' && e.visited) return false;
      if (search) {
        const q = search.toLowerCase();
        const textFields = [e.lastName, e.firstName, e.patronymic, e.phone, e.email, e.comment];
        // Also search in custom field answers
        let answers: Record<string, string> = {};
        try { answers = JSON.parse(e.answers || '{}'); } catch {}
        const answerTexts = Object.values(answers).join(' ').toLowerCase();
        const match = textFields.some(t => (t || '').toLowerCase().includes(q)) || answerTexts.includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [entries, filterCalled, filterVisited, search]);

  const sortedEntries = useMemo(() => {
    const sorted = [...filteredEntries];
    sorted.sort((a, b) => {
      let va = '', vb = '';
      switch (sortField) {
        case 'lastName': va = a.lastName; vb = b.lastName; break;
        case 'firstName': va = a.firstName; vb = b.firstName; break;
        case 'patronymic': va = a.patronymic; vb = b.patronymic; break;
        case 'phone': va = a.phone; vb = b.phone; break;
        case 'email': va = a.email; vb = b.email; break;
        case 'called': return sortDir === 'asc' ? a.called - b.called : b.called - a.called;
        case 'visited': return sortDir === 'asc' ? a.visited - b.visited : b.visited - a.visited;
        default: va = a.lastName; vb = b.lastName;
      }
      return sortDir === 'asc' ? va.localeCompare(vb, 'ru') : vb.localeCompare(va, 'ru');
    });
    return sorted;
  }, [filteredEntries, sortField, sortDir]);

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const SortIcon = ({ field }: { field: string }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 text-gray-600" />;
    return sortDir === 'asc' ? <ArrowUp className="w-3 h-3" style={{ color: 'var(--color-primary)' }} /> : <ArrowDown className="w-3 h-3" style={{ color: 'var(--color-primary)' }} />;
  };

  // ── CSV Export ──
  const handleExportCSV = () => {
    const fieldLabels = listFields.map(f => f.label);
    const headers = ['№', 'Фамилия', 'Имя', 'Отчество', 'Телефон', 'Email', 'Комментарий', 'Обзвон', 'Посещение', ...fieldLabels];
    const rows = sortedEntries.map((e, i) => {
      const answers = (() => { try { return JSON.parse(e.answers || '{}'); } catch { return {}; } })();
      return [
        i + 1, e.lastName, e.firstName, e.patronymic, e.phone, e.email, e.comment,
        e.called ? 'Да' : 'Нет', e.visited ? 'Да' : 'Нет',
        ...listFields.map(f => answers[f.id] || ''),
      ];
    });
    const bom = '\uFEFF';
    const csv = bom + [headers.join(';'), ...rows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(';'))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `list-${editing?.id || 'export'}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // ── PDF Export ──
  const handleExportPDF = async (theme: 'light' | 'dark') => {
    if (!editing) return;
    setShowPdfTheme(false);
    try {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token');
      const res = await fetch(`/api/lists/${editing.id}/export/pdf?theme=${theme}`, { headers: { 'Authorization': `Bearer ${token}` } });
      if (!res.ok) { showToast('Ошибка', 'error'); return; }
      const html = await res.text();
      const win = window.open('', '_blank');
      if (win) { win.document.write(html); win.document.close(); }
    } catch { showToast('Ошибка', 'error'); }
  };

  // ── Loading ──
  if (isLoading) {
    return (
      <div className="space-y-6">
        <SkeletonHeader />
        <SkeletonGrid count={6} />
      </div>
    );
  }

  // ── Edit View ──
  if (view === 'edit') {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => setView('list')} className="flex items-center gap-2 font-mono text-sm text-gray-400 hover:text-gray-200 transition-colors">
            <ChevronLeft className="w-4 h-4" /> НАЗАД
          </button>
          <div className="flex gap-2">
            {editing && (
              <>
                <button onClick={() => openEntries(editing)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10">
                  <Users className="w-3.5 h-3.5" /> ЗАПИСИ ({editing.entryCount || 0})
                </button>
              </>
            )}
            <button onClick={handleSave}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold"
              style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
              СОХРАНИТЬ
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left: Basic info */}
          <div className="space-y-4">
            <div className="glass rounded-2xl p-6 space-y-4">
              <h2 className="font-mono text-sm font-bold" style={{ color: 'var(--color-primary)' }}>ИНФОРМАЦИЯ</h2>
              <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="// НАЗВАНИЕ СПИСКА *"
                className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
              <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="// ОПИСАНИЕ" rows={3}
                className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)] resize-none" />
            </div>
          </div>

          {/* Right: Field Builder */}
          <div className="glass rounded-2xl p-6">
            <FieldBuilder
              fields={listFields.map(toRegField)}
              onAdd={addField}
              onUpdate={updateField}
              onDelete={deleteField}
              onDuplicate={duplicateField}
              onReorder={reorderFields}
            />
          </div>
        </div>

        <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm} title={confirmState.title} message={confirmState.message} type={confirmState.type} />
      </div>
    );
  }

  // ── Entries View ──
  if (view === 'entries' && editing) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <button onClick={() => setView('list')} className="flex items-center gap-2 font-mono text-sm text-gray-400 hover:text-gray-200 transition-colors">
            <ChevronLeft className="w-4 h-4" /> НАЗАД
          </button>
          <div className="flex gap-2 flex-wrap">
            <button onClick={handleExportCSV} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={() => setShowPdfTheme(true)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
            <button onClick={() => { setEditingEntry(null); setEntryForm({ lastName: '', firstName: '', patronymic: '', phone: '', email: '', comment: '' }); setEntryAnswers({}); setShowAddEntry(true); }}
              className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold"
              style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
              <Plus className="w-4 h-4" /> ДОБАВИТЬ
            </button>
          </div>
        </div>

        <h2 className="font-mono text-lg font-bold neon-text flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
          <ListIcon className="w-5 h-5" /> {editing.name}
          <span className="text-sm text-gray-500 font-normal">// {filteredEntries.length} записей</span>
        </h2>

        {/* Filters */}
        <div className="flex gap-3 flex-wrap items-center">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="ПОИСК..."
              className="w-full pl-9 pr-4 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
          </div>
          <select value={filterCalled} onChange={e => setFilterCalled(e.target.value as any)}
            className="px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
            <option value="">ОБЗВОН: ВСЕ</option>
            <option value="1">Да</option>
            <option value="0">Нет</option>
          </select>
          <select value={filterVisited} onChange={e => setFilterVisited(e.target.value as any)}
            className="px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
            <option value="">ПОСЕЩЕНИЕ: ВСЕ</option>
            <option value="1">Да</option>
            <option value="0">Нет</option>
          </select>
        </div>

        {/* Entries table */}
        <div className="flex-1 overflow-y-auto">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-700/50">
                  <th className="px-3 py-2 font-mono text-xs text-gray-500 w-10">№</th>
                  <th onClick={() => toggleSort('lastName')} className="px-3 py-2 font-mono text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none"><span className="flex items-center gap-1">ФАМИЛИЯ <SortIcon field="lastName" /></span></th>
                  <th onClick={() => toggleSort('firstName')} className="px-3 py-2 font-mono text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none"><span className="flex items-center gap-1">ИМЯ <SortIcon field="firstName" /></span></th>
                  <th onClick={() => toggleSort('patronymic')} className="px-3 py-2 font-mono text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none"><span className="flex items-center gap-1">ОТЧЕСТВО <SortIcon field="patronymic" /></span></th>
                  <th onClick={() => toggleSort('phone')} className="px-3 py-2 font-mono text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none"><span className="flex items-center gap-1">ТЕЛЕФОН <SortIcon field="phone" /></span></th>
                  <th onClick={() => toggleSort('email')} className="px-3 py-2 font-mono text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none"><span className="flex items-center gap-1">EMAIL <SortIcon field="email" /></span></th>
                  <th className="px-3 py-2 font-mono text-xs text-gray-500">КОММЕНТАРИЙ</th>
                  <th onClick={() => toggleSort('called')} className="px-3 py-2 font-mono text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none text-center"><span className="flex items-center gap-1 justify-center">ОБЗВОН <SortIcon field="called" /></span></th>
                  <th onClick={() => toggleSort('visited')} className="px-3 py-2 font-mono text-xs text-gray-500 cursor-pointer hover:text-gray-300 select-none text-center"><span className="flex items-center gap-1 justify-center">ПОСЕЩЕНИЕ <SortIcon field="visited" /></span></th>
                  {listFields.map(f => (
                    <th key={f.id} className="px-3 py-2 font-mono text-xs text-gray-500">{f.label}</th>
                  ))}
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {sortedEntries.map((e, idx) => {
                  const answers = (() => { try { return JSON.parse(e.answers || '{}'); } catch { return {}; } })();
                  return (
                    <tr key={e.id} className="border-b border-gray-800/50 hover:bg-white/5 group transition-colors">
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-500">{idx + 1}</td>
                      <td className="px-3 py-2.5 font-mono text-sm text-gray-200">{e.lastName}</td>
                      <td className="px-3 py-2.5 font-mono text-sm text-gray-200">{e.firstName}</td>
                      <td className="px-3 py-2.5 font-mono text-sm text-gray-200">{e.patronymic}</td>
                      <td className="px-3 py-2.5 font-mono text-sm text-gray-300">{e.phone}</td>
                      <td className="px-3 py-2.5 font-mono text-sm text-gray-300">{e.email}</td>
                      <td className="px-3 py-2.5 font-mono text-xs text-gray-400 max-w-[150px] truncate">{e.comment}</td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => handleToggle(e.id, 'called')}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:scale-110"
                          style={e.called
                            ? { background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)' }
                            : { background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)' }}>
                          {e.called ? <Check className="w-4 h-4" style={{ color: '#00ff88' }} /> : <XIcon className="w-4 h-4" style={{ color: '#ff3b30' }} />}
                        </button>
                      </td>
                      <td className="px-3 py-2.5 text-center">
                        <button onClick={() => handleToggle(e.id, 'visited')}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-lg transition-all hover:scale-110"
                          style={e.visited
                            ? { background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)' }
                            : { background: 'rgba(255,59,48,0.1)', border: '1px solid rgba(255,59,48,0.2)' }}>
                          {e.visited ? <Check className="w-4 h-4" style={{ color: '#00ff88' }} /> : <XIcon className="w-4 h-4" style={{ color: '#ff3b30' }} />}
                        </button>
                      </td>
                      {listFields.map(f => (
                        <td key={f.id} className="px-3 py-2.5 font-mono text-xs text-gray-300 max-w-[120px] truncate">{answers[f.id] || '—'}</td>
                      ))}
                      <td className="px-3 py-2.5">
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => openEditEntry(e)} className="p-1 rounded hover:bg-white/10"><Edit3 className="w-3.5 h-3.5 text-gray-400" /></button>
                          <button onClick={() => handleDeleteEntry(e.id)} className="p-1 rounded hover:bg-red-500/20"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {sortedEntries.length === 0 && (
              <div className="text-center py-12">
                <Users className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
                <p className="font-mono text-gray-500">// НЕТ ЗАПИСЕЙ</p>
              </div>
            )}
          </div>
        </div>

        {/* Add/Edit Entry Modal */}
        <AnimatePresence>
          {showAddEntry && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 flex items-center justify-center z-[100] p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}
              onClick={() => { setShowAddEntry(false); setEditingEntry(null); }}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }}
                className="glass-frost rounded-2xl p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto" style={{ border: '1px solid var(--color-border)' }} onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                  <h2 className="font-mono text-lg font-bold neon-text" style={{ color: 'var(--color-primary)' }}>
                    {editingEntry ? 'РЕДАКТИРОВАТЬ' : 'НОВАЯ ЗАПИСЬ'}
                  </h2>
                  <button onClick={() => { setShowAddEntry(false); setEditingEntry(null); }} className="p-1 rounded hover:bg-white/10"><XIcon className="w-5 h-5 text-gray-400" /></button>
                </div>
                <div className="space-y-3">
                  <input value={entryForm.lastName} onChange={e => setEntryForm({ ...entryForm, lastName: e.target.value })} placeholder="// ФАМИЛИЯ *"
                    className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
                  <div className="grid grid-cols-2 gap-3">
                    <input value={entryForm.firstName} onChange={e => setEntryForm({ ...entryForm, firstName: e.target.value })} placeholder="// ИМЯ"
                      className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                    <input value={entryForm.patronymic} onChange={e => setEntryForm({ ...entryForm, patronymic: e.target.value })} placeholder="// ОТЧЕСТВО"
                      className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <input value={entryForm.phone} onChange={e => setEntryForm({ ...entryForm, phone: e.target.value })} placeholder="// ТЕЛЕФОН"
                      className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                    <input value={entryForm.email} onChange={e => setEntryForm({ ...entryForm, email: e.target.value })} placeholder="// EMAIL"
                      className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
                  </div>
                  <textarea value={entryForm.comment} onChange={e => setEntryForm({ ...entryForm, comment: e.target.value })} placeholder="// КОММЕНТАРИЙ" rows={2}
                    className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none resize-none" />

                  {/* Custom field answers */}
                  {listFields.length > 0 && (
                    <div className="border-t border-white/5 pt-3 mt-1">
                      <p className="font-mono text-[10px] text-gray-500 mb-2">ДОПОЛНИТЕЛЬНЫЕ ПОЛЯ</p>
                      <div className="space-y-2">
                        {listFields.map(f => (
                          <div key={f.id}>
                            <label className="font-mono text-[10px] text-gray-500 block mb-1">{f.label}</label>
                            <input value={entryAnswers[f.id] || ''} onChange={e => setEntryAnswers(prev => ({ ...prev, [f.id]: e.target.value }))} placeholder={f.placeholder || ''}
                              className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <div className="flex gap-3 mt-5">
                  <button onClick={() => { setShowAddEntry(false); setEditingEntry(null); }} className="flex-1 px-4 py-2.5 rounded-xl glass font-mono text-sm text-gray-400">ОТМЕНА</button>
                  <button onClick={handleAddEntry} className="flex-1 px-4 py-2.5 rounded-xl font-mono text-sm font-bold"
                    style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>{editingEntry ? 'СОХРАНИТЬ' : 'ДОБАВИТЬ'}</button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PDF Theme Picker Modal */}
        <AnimatePresence>
          {showPdfTheme && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-[100] flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)' }}
              onClick={() => setShowPdfTheme(false)}>
              <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
                className="glass-frost rounded-2xl p-6 text-center" onClick={e => e.stopPropagation()}>
                <h3 className="font-mono text-sm font-bold mb-4" style={{ color: 'var(--color-primary)' }}>ВЫБЕРИТЕ ТЕМУ PDF</h3>
                <div className="flex gap-4">
                  <button onClick={() => handleExportPDF('light')}
                    className="px-6 py-3 rounded-xl font-mono text-sm font-bold transition-all hover:scale-105"
                    style={{ background: '#ffffff', color: '#000', border: '1px solid rgba(0,0,0,0.2)' }}>
                    СВЕТЛАЯ
                  </button>
                  <button onClick={() => handleExportPDF('dark')}
                    className="px-6 py-3 rounded-xl font-mono text-sm font-bold transition-all hover:scale-105"
                    style={{ background: '#1a1a2e', color: '#e8e8ec', border: '1px solid rgba(255,255,255,0.15)' }}>
                    ТЁМНАЯ
                  </button>
                </div>
                <button onClick={() => setShowPdfTheme(false)} className="mt-4 px-4 py-2 rounded-xl glass font-mono text-xs text-gray-400">ЗАКРЫТЬ</button>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm} title={confirmState.title} message={confirmState.message} type={confirmState.type} />
      </div>
    );
  }

  // ── List View ──
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <ListIcon className="w-7 h-7 md:w-8 md:h-8" /> СПИСКИ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// {lists.length} СПИСКОВ</p>
        </div>
        <div className="flex gap-2">
          <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Plus className="w-4 h-4" /> СОЗДАТЬ
          </button>
        </div>
      </div>

      {/* Grid of list cards */}
      {lists.length === 0 ? (
        <div className="text-center py-16">
          <ListIcon className="w-16 h-16 mx-auto mb-4 opacity-30 text-gray-500" />
          <p className="font-mono text-gray-500">// НЕТ СПИСКОВ</p>
          <button onClick={openCreate} className="mt-4 flex items-center gap-2 px-4 py-2 rounded-lg font-mono text-sm font-bold mx-auto"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Plus className="w-4 h-4" /> СОЗДАТЬ
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {lists.map(list => (
            <motion.div key={list.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-5 hover:bg-white/5 transition-all group"
              style={{ border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <h3 className="font-mono text-sm font-bold text-gray-200 truncate">{list.name}</h3>
                  {list.description && <p className="font-mono text-[10px] text-gray-500 mt-1 line-clamp-2">{list.description}</p>}
                </div>
              </div>
              <div className="flex items-center gap-3 mb-4">
                <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff' }}>
                  <Users className="w-3 h-3 inline mr-1" />{list.entryCount || 0} записей
                </span>
                {list.fields && (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded" style={{ background: 'rgba(191,0,255,0.12)', color: '#bf00ff' }}>
                    {(Array.isArray(list.fields) ? list.fields.length : 0)} полей
                  </span>
                )}
              </div>
              <div className="flex gap-2 flex-wrap">
                <button onClick={() => openEdit(list)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10 transition-all">
                  <Edit3 className="w-3 h-3" /> РЕД.
                </button>
                <button onClick={() => openEntries(list)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10 transition-all">
                  <Eye className="w-3 h-3" /> ЗАПИСИ
                </button>
                <button onClick={() => handleDuplicate(list.id)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] glass hover:bg-white/10 transition-all">
                  <Copy className="w-3 h-3" /> КОПИЯ
                </button>
                <button onClick={(e) => { e.stopPropagation(); handleTogglePublish(list); }} className="p-1.5 rounded hover:bg-white/10" title={list.isPublic ? 'Скрыть публичную ссылку' : 'Опубликовать'}>
                  {list.isPublic ? <Eye className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} /> : <EyeOff className="w-3.5 h-3.5 text-gray-400" />}
                </button>
                <button onClick={() => handleDelete(list)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-mono text-[10px] hover:bg-red-500/10 transition-all text-gray-400 hover:text-red-400">
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
              {list.isPublic && list.publicSlug && (
                <div className="flex items-center gap-1 mt-2 pt-2" style={{ borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                  <button onClick={(e) => { e.stopPropagation(); handleCopyLink(list.publicSlug!); }} className="p-1.5 rounded hover:bg-white/10" title="Копировать ссылку">
                    <Copy className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <a href={`https://vk.com/share.php?url=${encodeURIComponent(`${window.location.origin}/lists/public/${list.publicSlug}`)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-white/10" title="VK">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#0077FF"><path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.596-.189 1.362 1.26 2.174 1.817.613.42 1.079.328 1.079.328l2.172-.03s1.136-.07.598-.964c-.044-.073-.314-.66-1.618-1.866-1.364-1.264-1.182-1.06.462-3.246.999-1.33 1.398-2.143 1.273-2.49-.12-.334-.86-.246-.86-.246l-2.446.015s-.182-.025-.316.056c-.131.079-.216.263-.216.263s-.387 1.026-.902 1.906c-1.086 1.85-1.524 1.952-1.702 1.838-.415-.268-.312-1.076-.312-1.65 0-1.793.272-2.54-.529-2.734-.266-.064-.462-.107-1.143-.114-.874-.008-1.613.003-2.032.208-.28.137-.496.442-.363.46.163.022.532.099.728.366.254.346.245 1.124.245 1.124s.146 2.15-.34 2.416c-.333.184-.791-.19-1.776-1.9-.503-.877-.882-1.844-.882-1.844s-.073-.18-.204-.277c-.159-.118-.38-.156-.38-.156l-2.32.015s-.348.01-.476.162c-.114.135-.01.413-.01.413s1.82 4.262 3.882 6.408c1.89 1.968 4.04 1.836 4.04 1.836h.976z"/></svg>
                  </a>
                  <a href={`https://t.me/share/url?url=${encodeURIComponent(`${window.location.origin}/lists/public/${list.publicSlug}`)}&text=${encodeURIComponent(list.name)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-white/10" title="Telegram">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#0088CC"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
                  </a>
                  <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(list.name + ' ' + window.location.origin + '/lists/public/' + list.publicSlug)}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="p-1.5 rounded hover:bg-white/10" title="WhatsApp">
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                  </a>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      <ConfirmModal isOpen={confirmState.isOpen} onConfirm={() => { confirmState.onConfirm(); closeConfirm(); }} onCancel={closeConfirm} title={confirmState.title} message={confirmState.message} type={confirmState.type} />
    </div>
  );
}