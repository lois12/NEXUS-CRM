import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Send, CheckCircle2 } from 'lucide-react';
import PrivacyFooter from '../components/common/PrivacyFooter';

const TYPES = [
  { id: 'withdraw', label: 'Отозвать согласие' },
  { id: 'delete', label: 'Удалить мои данные' },
  { id: 'export', label: 'Выгрузить мои данные' },
  { id: 'correct', label: 'Исправить данные' },
  { id: 'info', label: 'Информация об обработке' },
];

/** Public PD subject request — /pd-request */
export default function PublicPdRequest() {
  const [type, setType] = useState('withdraw');
  const [contact, setContact] = useState('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!contact.trim()) {
      setError('Укажите email или телефон, по которому с вами связаться');
      return;
    }
    setSending(true);
    setError('');
    try {
      const res = await fetch('/api/pd-request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          contact: contact.trim(),
          message: message.trim(),
          page: '/pd-request',
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) setDone(true);
      else setError(data?.error || 'Не удалось отправить запрос');
    } catch {
      setError('Ошибка сети, попробуйте позже');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="min-h-screen p-4 md:p-8">
      <div className="max-w-lg mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <ShieldCheck className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
          <h1 className="font-mono text-lg tracking-[0.15em]" style={{ color: 'var(--color-primary)' }}>
            МОИ ДАННЫЕ
          </h1>
        </div>
        <p className="font-mono text-xs text-gray-500 mb-6 leading-relaxed">
          Запрос по персональным данным (152-ФЗ). Ответ — в течение 30 рабочих дней
          на указанный контакт.
        </p>

        {done ? (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-2xl p-6 text-center"
          >
            <CheckCircle2 className="w-10 h-10 mx-auto mb-3" style={{ color: 'var(--color-primary)' }} />
            <p className="font-mono text-sm text-gray-200 mb-2">Запрос принят</p>
            <p className="font-mono text-xs text-gray-500">
              Мы свяжемся с вами в срок до 30 рабочих дней.
            </p>
          </motion.div>
        ) : (
          <form onSubmit={submit} className="glass rounded-2xl p-5 space-y-4">
            <div>
              <label className="block text-[10px] font-mono tracking-wider text-gray-500 mb-2">
                ТИП ЗАПРОСА
              </label>
              <div className="flex flex-wrap gap-2">
                {TYPES.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => setType(t.id)}
                    className={`px-3 py-2 rounded-xl text-[11px] font-mono transition-all ${
                      type === t.id ? 'btn-primary' : 'btn-ghost'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-[10px] font-mono tracking-wider text-gray-500 mb-2">
                EMAIL ИЛИ ТЕЛЕФОН *
              </label>
              <input
                value={contact}
                onChange={(e) => setContact(e.target.value)}
                required
                placeholder="для ответа"
                className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e0e0e0',
                }}
              />
            </div>
            <div>
              <label className="block text-[10px] font-mono tracking-wider text-gray-500 mb-2">
                ПОДРОБНОСТИ
              </label>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={3}
                placeholder="например: отозвать согласие на опрос «…» от 01.06"
                className="w-full px-4 py-3 rounded-xl text-sm font-mono outline-none resize-y"
                style={{
                  background: 'rgba(0,0,0,0.25)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  color: '#e0e0e0',
                }}
              />
            </div>
            {error && (
              <p className="font-mono text-xs" style={{ color: '#ff6b6b' }}>{error}</p>
            )}
            <button type="submit" disabled={sending} className="btn-primary w-full">
              <Send className="w-4 h-4" />
              {sending ? 'ОТПРАВКА…' : 'ОТПРАВИТЬ ЗАПРОС'}
            </button>
            <p className="font-mono text-[9px] text-gray-600 leading-relaxed">
              Отправляя форму, вы подтверждаете, что указанные контакты принадлежат вам.
              Запрос не является согласием на обработку — это обращение субъекта ПД.
            </p>
          </form>
        )}

        <PrivacyFooter compact />
      </div>
    </div>
  );
}
