import { useState } from 'react';
import { X, Download, ExternalLink, FileText } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface DocumentPreviewProps {
  url: string;
  filename: string;
  onClose: () => void;
}

export default function DocumentPreview({ url, filename, onClose }: DocumentPreviewProps) {
  const [loadError, setLoadError] = useState(false);
  const isPdf = filename.toLowerCase().endsWith('.pdf');
  const fullUrl = url.startsWith('http') ? url : `${window.location.origin}${url}`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[100] flex flex-col"
        style={{ background: 'rgba(0,0,0,0.85)', backdropFilter: 'blur(8px)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3" style={{ background: 'rgba(20,20,35,0.95)', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="flex items-center gap-3">
            <FileText className="w-5 h-5" style={{ color: 'var(--color-primary)' }} />
            <span className="text-sm font-mono truncate max-w-md" style={{ color: '#e0e0e0' }}>{filename}</span>
          </div>
          <div className="flex items-center gap-2">
            <a href={fullUrl} download={filename}
              className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Скачать">
              <Download className="w-4 h-4 text-gray-400" />
            </a>
            <a href={fullUrl} target="_blank" rel="noopener noreferrer"
              className="p-2 rounded-lg hover:bg-white/5 transition-colors" title="Открыть в новой вкладке">
              <ExternalLink className="w-4 h-4 text-gray-400" />
            </a>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/5 transition-colors">
              <X className="w-4 h-4 text-gray-400" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex items-center justify-center p-4">
          {loadError ? (
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--color-primary)' }} />
              <p className="text-sm font-mono mb-2" style={{ color: '#8a8aa0' }}>Не удалось загрузить превью</p>
              <a href={fullUrl} download={filename}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono"
                style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>
                <Download className="w-4 h-4" /> Скачать файл
              </a>
            </div>
          ) : isPdf ? (
            <iframe
              src={fullUrl}
              className="w-full h-full rounded-xl"
              style={{ border: '1px solid rgba(255,255,255,0.06)', background: '#fff' }}
              onError={() => setLoadError(true)}
              title={filename}
            />
          ) : (
            <div className="text-center">
              <FileText className="w-16 h-16 mx-auto mb-4 opacity-20" style={{ color: 'var(--color-primary)' }} />
              <p className="text-sm font-mono mb-2" style={{ color: '#8a8aa0' }}>Превью недоступно для этого формата</p>
              <a href={fullUrl} download={filename}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono"
                style={{ background: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.2)' }}>
                <Download className="w-4 h-4" /> Скачать файл
              </a>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
