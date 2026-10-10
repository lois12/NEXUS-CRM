import { useEffect, useState } from 'react';
import { MessageSquare, Check, Trash2, RefreshCw } from 'lucide-react';
import { showToast, useNexusConfirm, ConfirmModal } from '../ui/NexusModal';

interface FeedbackRow {
  id: string;
  userName: string;
  message: string;
  page: string;
  status: string;
  createdAt: string;
}

const ROLE_MATRIX_DEFAULT: Record<string, Record<string, boolean | 'own'>> = {
  super_admin: {
    'Дашборд': true, 'Контент-план': true, 'Опросы': true, 'Задачи': true,
    'События/Регистрации': true, 'Пользователи': true, 'Админка/Бэкапы': true, 'Экспорт': true,
  },
  руководитель: {
    'Дашборд': true, 'Контент-план': true, 'Опросы': true, 'Задачи': true,
    'События/Регистрации': true, 'Пользователи': true, 'Админка/Бэкапы': false, 'Экспорт': true,
  },
  информационный: {
    'Дашборд': true, 'Контент-план': true, 'Опросы': 'own', 'Задачи': true,
    'События/Регистрации': 'own', 'Пользователи': false, 'Админка/Бэкапы': false, 'Экспорт': 'own',
  },
  туризм: {
    'Дашборд': true, 'Контент-план': 'own', 'Опросы': 'own', 'Задачи': true,
    'События/Регистрации': 'own', 'Пользователи': false, 'Админка/Бэкапы': false, 'Экспорт': 'own',
  },
};

const STORAGE_KEY = 'nexus_role_matrix_v1';

function loadMatrix() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch { /* noop */ }
  return ROLE_MATRIX_DEFAULT;
}

export function FeedbackInbox() {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const { confirmState, showConfirm, closeConfirm } = useNexusConfirm();

  const load = async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
      const res = await fetch('/api/feedback', {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.success) setRows(data.data || []);
    } catch {
      /* noop */
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const toggleResolve = async (id: string) => {
    const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
    await fetch(`/api/feedback/${id}/resolve`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    load();
  };

  const remove = (id: string) => {
    showConfirm('УДАЛИТЬ СООБЩЕНИЕ?', 'Действие нельзя отменить', async () => {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
      await fetch(`/api/feedback/${id}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` } as any,
      });
      showToast('Удалено', 'success');
      load();
    }, 'danger');
  };

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold tracking-wider flex items-center gap-2" style={{ color: '#6b7280' }}>
          <MessageSquare className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
          ОБРАТНАЯ СВЯЗЬ ({rows.filter((r) => r.status !== 'resolved').length} новых)
        </h3>
        <button onClick={load} className="p-1.5 rounded-lg hover:bg-white/10 text-gray-500" title="Обновить">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="text-xs font-mono text-gray-600 py-4 text-center">// ПУСТО</p>
      ) : (
        <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
          {rows.map((r) => (
            <div
              key={r.id}
              className="rounded-lg p-3"
              style={{
                background: r.status === 'resolved' ? 'rgba(255,255,255,0.02)' : 'rgba(0,255,136,0.06)',
                border: `1px solid ${r.status === 'resolved' ? 'rgba(255,255,255,0.06)' : 'rgba(0,255,136,0.18)'}`,
              }}
            >
              <div className="flex items-start justify-between gap-2 mb-1">
                <span className="text-[10px] font-mono font-bold" style={{ color: 'var(--color-primary)' }}>
                  {r.userName || '—'}
                </span>
                <span className="text-[9px] font-mono text-gray-600">
                  {r.createdAt ? new Date(r.createdAt).toLocaleString('ru-RU') : ''}
                </span>
              </div>
              <p className="text-xs text-gray-300 whitespace-pre-wrap">{r.message}</p>
              {r.page && (
                <p className="text-[9px] font-mono text-gray-600 mt-1">стр: {r.page}</p>
              )}
              <div className="flex gap-1.5 mt-2">
                <button
                  onClick={() => toggleResolve(r.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono glass text-gray-400 hover:text-gray-200"
                >
                  <Check className="w-3 h-3" />
                  {r.status === 'resolved' ? 'ВЕРНУТЬ' : 'РЕШЕНО'}
                </button>
                <button
                  onClick={() => remove(r.id)}
                  className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono glass text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <ConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        type={confirmState.type}
        onConfirm={confirmState.onConfirm}
        onCancel={closeConfirm}
      />
    </div>
  );
}

export function RoleMatrixEditor() {
  const [matrix, setMatrix] = useState(loadMatrix);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
    fetch('/api/roles/matrix', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => r.json())
      .then((data) => {
        if (data?.success && data.data && typeof data.data === 'object') {
          setMatrix(data.data);
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data.data)); } catch { /* noop */ }
        }
      })
      .catch(() => { /* offline / 401 — keep default */ });
  }, []);

  const roles = Object.keys(matrix);
  const cols = Object.keys(matrix[roles[0]] || {});

  const persist = async (next: Record<string, Record<string, boolean | 'own'>>) => {
    setSaving(true);
    try {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
      const res = await fetch('/api/roles/matrix', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ matrix: next }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        showToast('Права сохранены на сервере', 'success');
      } else {
        showToast(data?.error || 'Не удалось сохранить на сервере', 'error');
      }
    } catch {
      showToast('Ошибка сети — сохранено только локально', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cycle = (role: string, mod: string) => {
    setMatrix((prev: any) => {
      const cur = prev[role][mod];
      const nextVal = cur === true ? 'own' : cur === 'own' ? false : true;
      const copy = { ...prev, [role]: { ...prev[role], [mod]: nextVal } };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(copy)); } catch { /* noop */ }
      persist(copy);
      return copy;
    });
  };

  return (
    <div className="glass rounded-xl p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="font-mono text-xs font-bold tracking-wider" style={{ color: '#6b7280' }}>
          ПРАВА РОЛЕЙ · КЛИК = ПОЛНЫЙ → СВОИ → НЕТ
        </h3>
        {saving && (
          <span className="text-[10px] font-mono" style={{ color: 'var(--color-primary)' }}>сохранение…</span>
        )}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-[10px] font-mono">
          <thead>
            <tr>
              <th className="text-left pb-2 pr-2" style={{ color: '#4a4a60' }}>Роль</th>
              {cols.map((c) => (
                <th key={c} className="text-center pb-2 px-1" style={{ color: '#4a4a60' }}>{c}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {roles.map((role) => (
              <tr key={role} className="border-t border-white/5">
                <td className="py-1.5 pr-2 font-bold" style={{ color: '#c0c0d0' }}>{role}</td>
                {cols.map((c) => {
                  const v = matrix[role][c];
                  return (
                    <td key={c} className="text-center py-1.5 px-1">
                      <button
                        onClick={() => cycle(role, c)}
                        disabled={saving}
                        className="w-full h-7 rounded transition-colors disabled:opacity-50"
                        style={{
                          background:
                            v === true ? 'rgba(0,255,136,0.25)' : v === 'own' ? 'rgba(234,179,8,0.2)' : 'rgba(255,255,255,0.04)',
                          color: v === true ? '#00ff88' : v === 'own' ? '#eab308' : '#5a5a70',
                        }}
                        title={`${role} × ${c}`}
                      >
                        {v === true ? '✓' : v === 'own' ? 'свои' : '—'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-[10px] font-mono" style={{ color: '#4a4a60' }}>
        // сохраняется в БД (app_settings.roleMatrix) · видно всем супер-админам
      </p>
    </div>
  );
}
