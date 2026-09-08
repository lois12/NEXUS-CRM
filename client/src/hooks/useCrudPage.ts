import { useState, useCallback, useEffect } from 'react';
import { showToast, useNexusConfirm } from '../components/ui/NexusModal';

interface CrudApi {
  getAll: () => Promise<{ success: boolean; data?: any[] }>;
  create: (data: any) => Promise<any>;
  update: (id: string, data: any) => Promise<any>;
  delete: (id: string) => Promise<any>;
}

interface UseCrudPageOptions<T> {
  api: CrudApi;
  defaultForm: T;
  getFormFromItem: (item: any) => T;
  validate?: (form: T) => boolean;
  createLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
}

export function useCrudPage<T>({
  api, defaultForm, getFormFromItem,
  validate = (form: any) => !!(form.title?.trim() || form.name?.trim()),
  createLabel = 'Создано', editLabel = 'Обновлено', deleteLabel = 'Удалено'
}: UseCrudPageOptions<T>) {
  const [items, setItems] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<T>(defaultForm);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getAll();
      if (res.success && res.data) setItems(res.data);
    } catch (e) { console.error(e); }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (item: any) => {
    setEditing(item);
    setForm(getFormFromItem(item));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!validate(form)) return;
    try {
      if (editing) {
        await api.update(editing.id, form);
        showToast(editLabel, 'success');
      } else {
        await api.create(form);
        showToast(createLabel, 'success');
      }
      setShowModal(false);
      fetchData();
    } catch (e) { showToast('Ошибка', 'error'); }
  };

  const handleDelete = (item: any, label?: string) => {
    const name = label || item.name || item.title || 'Запись';
    showConfirm('УДАЛИТЬ?', `"${name}" будет удалён.`, async () => {
      try { await api.delete(item.id); showToast(deleteLabel, 'success'); fetchData(); }
      catch (e) { showToast('Ошибка', 'error'); }
    }, 'danger');
  };

  return {
    items, setItems, isLoading, showModal, setShowModal,
    editing, setEditing, search, setSearch, form, setForm,
    fetchData, openCreate, openEdit, handleSave, handleDelete,
    confirmState, showConfirm, closeConfirm
  };
}
