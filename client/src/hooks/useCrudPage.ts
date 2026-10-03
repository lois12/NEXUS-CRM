import { useState, useCallback, useEffect } from 'react';
import { showToast, useNexusConfirm } from '../components/ui/NexusModal';
import { ApiResponse } from '../types';

/** Minimal CRUD contract — any API object with these four methods fits. */
export interface CrudApi<T, TCreate = Partial<T>, TUpdate = Partial<T>> {
  getAll: () => Promise<ApiResponse<T[]>>;
  create: (data: TCreate) => Promise<ApiResponse<T>>;
  update: (id: string, data: TUpdate) => Promise<ApiResponse<unknown>>;
  delete: (id: string) => Promise<ApiResponse<unknown>>;
}

export interface UseCrudPageOptions<T, TItem = T & { id: string }> {
  api: CrudApi<TItem>;
  defaultForm: T;
  getFormFromItem: (item: TItem) => T;
  validate?: (form: T) => boolean;
  createLabel?: string;
  editLabel?: string;
  deleteLabel?: string;
}

interface Named {
  id: string;
  title?: string;
  name?: string;
}

export function useCrudPage<T, TItem extends Named = T & Named>({
  api,
  defaultForm,
  getFormFromItem,
  validate = (form: T) => {
    const f = form as unknown as Named;
    return !!(f.title?.trim() || f.name?.trim());
  },
  createLabel = 'Создано',
  editLabel = 'Обновлено',
  deleteLabel = 'Удалено',
}: UseCrudPageOptions<T, TItem>) {
  const [items, setItems] = useState<TItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<TItem | null>(null);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<T>(defaultForm);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();

  const fetchData = useCallback(async () => {
    try {
      const res = await api.getAll();
      if (res.success && res.data) setItems(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const openCreate = () => {
    setEditing(null);
    setForm(defaultForm);
    setShowModal(true);
  };

  const openEdit = (item: TItem) => {
    setEditing(item);
    setForm(getFormFromItem(item));
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!validate(form)) return;
    try {
      if (editing) {
        await api.update(editing.id, form as never);
        showToast(editLabel, 'success');
      } else {
        await api.create(form as never);
        showToast(createLabel, 'success');
      }
      setShowModal(false);
      fetchData();
    } catch {
      showToast('Ошибка', 'error');
    }
  };

  const handleDelete = (item: TItem, label?: string) => {
    const name = label || item.name || item.title || 'Запись';
    showConfirm(
      'УДАЛИТЬ?',
      `"${name}" будет удалён.`,
      async () => {
        try {
          await api.delete(item.id);
          showToast(deleteLabel, 'success');
          fetchData();
        } catch {
          showToast('Ошибка', 'error');
        }
      },
      'danger'
    );
  };

  return {
    items,
    setItems,
    isLoading,
    showModal,
    setShowModal,
    editing,
    setEditing,
    search,
    setSearch,
    form,
    setForm,
    fetchData,
    openCreate,
    openEdit,
    handleSave,
    handleDelete,
    confirmState,
    showConfirm,
    closeConfirm,
  };
}
