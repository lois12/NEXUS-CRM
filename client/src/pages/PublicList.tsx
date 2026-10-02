import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { List as ListIcon, AlertTriangle, Phone, Mail, Check, X as XIcon } from 'lucide-react';
import { publicListsApi } from '../services/api';
import { CyberBackground } from '../components/ui/CyberBackground';

export default function PublicList() {
  const { slug } = useParams<{ slug: string }>();
  const [list, setList] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    publicListsApi.getBySlug(slug)
      .then(res => { if (res.success && res.data) setList(res.data); else setError('Список не найден'); })
      .catch(() => setError('Список не найден'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <CyberBackground />
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="relative z-10 text-center">
        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        <p className="font-mono text-sm text-gray-500">Загрузка...</p>
      </motion.div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <CyberBackground />
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 text-center">
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2 className="font-mono text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>{error}</h2>
        <a href="/" className="inline-block mt-4 px-5 py-2.5 rounded-xl font-mono text-sm font-bold transition-all" style={{ backgroundColor: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }}>НА ГЛАВНУЮ</a>
      </motion.div>
    </div>
  );

  const fields = list.fields || [];
  const entries = list.entries || [];
  const hasCalled = fields.some((f: any) => f.type === 'toggle_called');
  const hasVisited = fields.some((f: any) => f.type === 'toggle_visited');
  const customFields = fields.filter((f: any) => f.type !== 'toggle_called' && f.type !== 'toggle_visited');

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <CyberBackground />

      {/* Header */}
      <motion.header initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative z-10 px-4 py-4 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(0,255,136,0.08)' }}>
        <ListIcon className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
        <div>
          <h1 className="font-mono font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>{list.name}</h1>
          {list.description && <p className="text-xs text-gray-500 truncate max-w-md">{list.description}</p>}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-[10px] font-mono text-gray-600">NEXUS</span>
          {/* Social share buttons */}
          <a href={`https://vk.com/share.php?url=${encodeURIComponent(window.location.href)}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="VK">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#0077FF"><path d="M12.785 16.241s.288-.032.436-.194c.136-.148.132-.427.132-.427s-.02-1.304.587-1.496c.596-.189 1.362 1.26 2.174 1.817.613.42 1.079.328 1.079.328l2.172-.03s1.136-.07.598-.964c-.044-.073-.314-.66-1.618-1.866-1.364-1.264-1.182-1.06.462-3.246.999-1.33 1.398-2.143 1.273-2.49-.12-.334-.86-.246-.86-.246l-2.446.015s-.182-.025-.316.056c-.131.079-.216.263-.216.263s-.387 1.026-.902 1.906c-1.086 1.85-1.524 1.952-1.702 1.838-.415-.268-.312-1.076-.312-1.65 0-1.793.272-2.54-.529-2.734-.266-.064-.462-.107-1.143-.114-.874-.008-1.613.003-2.032.208-.28.137-.496.442-.363.46.163.022.532.099.728.366.254.346.245 1.124.245 1.124s.146 2.15-.34 2.416c-.333.184-.791-.19-1.776-1.9-.503-.877-.882-1.844-.882-1.844s-.073-.18-.204-.277c-.159-.118-.38-.156-.38-.156l-2.32.015s-.348.01-.476.162c-.114.135-.01.413-.01.413s1.82 4.262 3.882 6.408c1.89 1.968 4.04 1.836 4.04 1.836h.976z"/></svg>
          </a>
          <a href={`https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(list.name)}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="Telegram">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#0088CC"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
          </a>
          <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(list.name + ' ' + window.location.href)}`} target="_blank" rel="noopener noreferrer" className="p-1.5 rounded-lg hover:bg-white/5 transition-colors" title="WhatsApp">
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
          </a>
        </div>
      </motion.header>

      {/* Table */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }} className="relative z-10 p-4 md:p-6">
        {/* Stats */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="px-4 py-2 rounded-xl" style={{ background: 'rgba(0,255,136,0.08)', border: '1px solid rgba(0,255,136,0.15)' }}>
            <span className="text-[10px] font-mono text-gray-500">Всего записей</span>
            <p className="font-mono text-lg font-bold" style={{ color: 'var(--color-primary)' }}>{entries.length}</p>
          </div>
          {hasCalled && (
            <div className="px-4 py-2 rounded-xl" style={{ background: 'rgba(0,212,255,0.08)', border: '1px solid rgba(0,212,255,0.15)' }}>
              <span className="text-[10px] font-mono text-gray-500">Обзвонено</span>
              <p className="font-mono text-lg font-bold" style={{ color: '#00d4ff' }}>{entries.filter((e: any) => e.called).length}</p>
            </div>
          )}
          {hasVisited && (
            <div className="px-4 py-2 rounded-xl" style={{ background: 'rgba(191,0,255,0.08)', border: '1px solid rgba(191,0,255,0.15)' }}>
              <span className="text-[10px] font-mono text-gray-500">Посещено</span>
              <p className="font-mono text-lg font-bold" style={{ color: '#bf00ff' }}>{entries.filter((e: any) => e.visited).length}</p>
            </div>
          )}
        </div>

        {/* Table */}
        <div className="overflow-x-auto rounded-xl" style={{ border: '1px solid rgba(0,255,136,0.08)' }}>
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-white/5">
                <th className="px-3 py-2 font-mono text-xs text-gray-500">№</th>
                <th className="px-3 py-2 font-mono text-xs text-gray-500">ФАМИЛИЯ</th>
                <th className="px-3 py-2 font-mono text-xs text-gray-500">ИМЯ</th>
                <th className="px-3 py-2 font-mono text-xs text-gray-500">ОТЧЕСТВО</th>
                <th className="px-3 py-2 font-mono text-xs text-gray-500">ТЕЛЕФОН</th>
                <th className="px-3 py-2 font-mono text-xs text-gray-500">ПОЧТА</th>
                <th className="px-3 py-2 font-mono text-xs text-gray-500">КОММЕНТАРИЙ</th>
                {hasCalled && <th className="px-3 py-2 font-mono text-xs text-gray-500 text-center">ОБЗВОН</th>}
                {hasVisited && <th className="px-3 py-2 font-mono text-xs text-gray-500 text-center">ПОСЕЩЕНИЕ</th>}
                {customFields.map((f: any) => <th key={f.id} className="px-3 py-2 font-mono text-xs text-gray-500">{f.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {entries.map((entry: any, i: number) => {
                const answers = JSON.parse(entry.answers || '{}');
                return (
                  <tr key={entry.id} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="px-3 py-2 font-mono text-xs text-gray-500">{i + 1}</td>
                    <td className="px-3 py-2 font-mono text-sm text-gray-200">{entry.lastName || '—'}</td>
                    <td className="px-3 py-2 font-mono text-sm text-gray-200">{entry.firstName || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-400">{entry.patronymic || '—'}</td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-300">
                      {entry.phone ? <span className="flex items-center gap-1"><Phone className="w-3 h-3 text-gray-500" />{entry.phone}</span> : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-300">
                      {entry.email ? <span className="flex items-center gap-1"><Mail className="w-3 h-3 text-gray-500" />{entry.email}</span> : '—'}
                    </td>
                    <td className="px-3 py-2 font-mono text-xs text-gray-400">{entry.comment || '—'}</td>
                    {hasCalled && (
                      <td className="px-3 py-2 text-center">
                        {entry.called ? <Check className="w-4 h-4 mx-auto" style={{ color: 'var(--color-primary)' }} /> : <XIcon className="w-4 h-4 mx-auto text-gray-600" />}
                      </td>
                    )}
                    {hasVisited && (
                      <td className="px-3 py-2 text-center">
                        {entry.visited ? <Check className="w-4 h-4 mx-auto" style={{ color: 'var(--color-primary)' }} /> : <XIcon className="w-4 h-4 mx-auto text-gray-600" />}
                      </td>
                    )}
                    {customFields.map((f: any) => <td key={f.id} className="px-3 py-2 font-mono text-xs text-gray-400">{answers[f.id] || '—'}</td>)}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {entries.length === 0 && (
          <div className="text-center py-16">
            <ListIcon className="w-12 h-12 mx-auto mb-4 text-gray-700" />
            <p className="font-mono text-sm text-gray-500">Список пуст</p>
          </div>
        )}
      </motion.div>
    </div>
  );
}