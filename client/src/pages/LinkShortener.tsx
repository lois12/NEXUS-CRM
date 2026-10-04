import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Link2, Copy, Trash2, ExternalLink, Scissors } from 'lucide-react';
import { showToast } from '../components/ui/NexusModal';

interface ShortLink {
  id: string;
  code: string;
  url: string;
  createdAt: string;
}

export default function LinkShortener() {
  const [url, setUrl] = useState('');
  const [links, setLinks] = useState<ShortLink[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [lastResult, setLastResult] = useState<{ code: string; shortUrl: string } | null>(null);

  const fetchLinks = useCallback(async () => {
    try {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
      const res = await fetch('/api/links', { headers: { Authorization: `Bearer ${token}` } });
      const json = await res.json();
      if (json.success && json.data) setLinks(json.data);
    } catch {}
  }, []);

  useEffect(() => { fetchLinks(); }, [fetchLinks]);

  const shorten = async () => {
    const trimmed = url.trim();
    if (!trimmed) { showToast('Введите ссылку', 'error'); return; }
    setIsBusy(true);
    try {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
      const res = await fetch('/api/links/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ url: trimmed }),
      });
      const json = await res.json();
      if (json.success && json.data) {
        setLastResult(json.data);
        setUrl('');
        fetchLinks();
        showToast('Ссылка сокращена', 'success');
      } else {
        showToast(json.error || 'Ошибка', 'error');
      }
    } catch {
      showToast('Сетевая ошибка', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const copyLink = (code: string) => {
    const full = `${window.location.origin}/s/${code}`;
    navigator.clipboard.writeText(full);
    showToast('Скопировано', 'success');
  };

  const deleteLink = async (id: string) => {
    try {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
      await fetch(`/api/links/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      setLinks(prev => prev.filter(l => l.id !== id));
      showToast('Удалено', 'success');
    } catch {
      showToast('Ошибка', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
          <Scissors className="w-7 h-7 md:w-8 md:h-8" /> СОКРАЩАТЕЛЬ ССЫЛОК
        </h1>
        <p className="text-gray-400 mt-1 font-mono text-sm">// ЛЮБАЯ ССЫЛКА → КОРОТКАЯ</p>
      </div>

      {/* Input */}
      <div className="glass rounded-2xl p-6 space-y-4">
        <label className="font-mono text-xs text-gray-500 block">ВСТАВЬТЕ ССЫЛКУ</label>
        <div className="flex gap-2 flex-col sm:flex-row">
          <div className="relative flex-1">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && shorten()}
              placeholder="https://example.com/very/long/link"
              className="w-full pl-10 pr-4 py-3 rounded-xl font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]"
            />
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={shorten}
            disabled={isBusy}
            className="px-6 py-3 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50"
            style={{ background: 'var(--color-primary)', color: '#000' }}
          >
            {isBusy ? '...' : 'СОКРАТИТЬ'}
          </motion.button>
        </div>

        {lastResult && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl p-4"
            style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.2)' }}
          >
            <p className="font-mono text-xs text-gray-400 mb-2">ГОТОВАЯ ССЫЛКА</p>
            <div className="flex items-center gap-2 flex-wrap">
              <code className="flex-1 px-3 py-2 rounded-lg font-mono text-sm truncate" style={{ background: 'rgba(0,0,0,0.3)', color: 'var(--color-primary)' }}>
                {window.location.origin}{lastResult.shortUrl}
              </code>
              <button onClick={() => copyLink(lastResult.code)}
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs font-bold"
                style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)' }}>
                <Copy className="w-3.5 h-3.5" /> КОПИЯ
              </button>
              <a href={lastResult.shortUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg font-mono text-xs glass text-gray-300">
                <ExternalLink className="w-3.5 h-3.5" /> ОТКРЫТЬ
              </a>
            </div>
          </motion.div>
        )}
      </div>

      {/* My links */}
      <div className="glass rounded-2xl p-6">
        <h2 className="font-mono text-xs font-bold tracking-wider mb-4" style={{ color: 'var(--color-primary)' }}>
          // МОИ ССЫЛКИ ({links.length})
        </h2>
        {links.length === 0 ? (
          <p className="font-mono text-xs text-gray-500">// ПОКА ПУСТО</p>
        ) : (
          <div className="space-y-2">
            {links.map(link => (
              <div key={link.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/20">
                <code className="font-mono text-xs w-24 truncate" style={{ color: 'var(--color-primary)' }}>
                  /s/{link.code}
                </code>
                <span className="flex-1 font-mono text-xs text-gray-400 truncate">{link.url}</span>
                <span className="font-mono text-[9px] text-gray-600 hidden sm:inline">
                  {String(link.createdAt).slice(0, 10)}
                </span>
                <button onClick={() => copyLink(link.code)} className="p-1.5 rounded hover:bg-white/10" aria-label="Копировать">
                  <Copy className="w-3.5 h-3.5 text-gray-400" />
                </button>
                <a href={`/s/${link.code}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded hover:bg-white/10" aria-label="Открыть">
                  <ExternalLink className="w-3.5 h-3.5 text-gray-400" />
                </a>
                <button onClick={() => deleteLink(link.id)} className="p-1.5 rounded hover:bg-red-500/10" aria-label="Удалить">
                  <Trash2 className="w-3.5 h-3.5 text-red-400" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
