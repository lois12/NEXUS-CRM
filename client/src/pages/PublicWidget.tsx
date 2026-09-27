import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Puzzle, AlertTriangle } from 'lucide-react';
import { publicWidgetApi } from '../services/api';
import { CyberBackground } from '../components/ui/CyberBackground';

export default function PublicWidget() {
  const { slug } = useParams<{ slug: string }>();
  const [widget, setWidget] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!slug) return;
    publicWidgetApi.getBySlug(slug)
      .then((res) => {
        if (res.success && res.data) setWidget(res.data);
        else setError('Виджет не найден');
      })
      .catch(() => setError('Виджет не найден'))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <CyberBackground />
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="relative z-10 text-center"
      >
        <div className="w-12 h-12 rounded-full border-2 border-t-transparent animate-spin mx-auto mb-4"
          style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        <p className="font-mono text-sm text-gray-500">Загрузка...</p>
      </motion.div>
    </div>
  );

  if (error) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-bg)' }}>
      <CyberBackground />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 text-center"
      >
        <AlertTriangle className="w-16 h-16 mx-auto mb-4 text-red-400" />
        <h2 className="font-mono text-xl font-bold mb-2" style={{ color: 'var(--color-text-primary)' }}>{error}</h2>
        <a href="/" className="inline-block mt-4 px-5 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
          style={{ backgroundColor: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' }}>
          НА ГЛАВНУЮ
        </a>
      </motion.div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg)' }}>
      <CyberBackground />

      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative z-10 px-4 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(0,255,136,0.08)' }}
      >
        <Puzzle className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
        <div>
          <h1 className="font-mono font-bold text-sm" style={{ color: 'var(--color-text-primary)' }}>{widget.title}</h1>
          {widget.description && <p className="text-xs text-gray-500 truncate max-w-md">{widget.description}</p>}
        </div>
        <span className="ml-auto text-[10px] font-mono text-gray-600">NEXUS</span>
      </motion.header>

      {/* Widget Content */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.15 }}
        className="relative z-10"
      >
        {widget.htmlCode ? (
          <iframe
            srcDoc={widget.htmlCode}
            className="w-full border-0"
            style={{ minHeight: 'calc(100vh - 60px)' }}
            sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
            title={widget.title}
          />
        ) : (
          <div className="flex items-center justify-center py-32">
            <div className="text-center">
              <Puzzle className="w-16 h-16 mx-auto mb-4 text-gray-700" />
              <p className="font-mono text-gray-500">Виджет пока пустой</p>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
}