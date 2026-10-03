import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText, FileSpreadsheet, FileImage, Scissors, Droplets,
  Upload, Download, X, CheckCircle, AlertCircle, ArrowLeft, RefreshCw, Layers,
} from 'lucide-react';
import {
  mergePdfs, splitPdf, watermarkPdf, imagesToPdf, csvToXlsx, xlsxToCsv,
  downloadBlob, formatFileSize,
} from '../utils/docTools';
import { showToast } from '../components/ui/NexusModal';
import { getControlToken } from '../services/api';

type ToolId =
  | 'office-to-pdf' | 'pdf-to-docx' | 'pdf-to-xlsx'
  | 'merge' | 'split' | 'watermark' | 'jpg-to-pdf'
  | 'csv-to-xlsx' | 'xlsx-to-csv';

type ItemStatus = 'pending' | 'converting' | 'done' | 'error';

interface FileItem {
  id: string;
  file: File;
  status: ItemStatus;
  resultUrl?: string;
  resultName?: string;
  resultSize?: number;
  resultBlob?: Blob;
  error?: string;
}

interface ToolDef {
  id: ToolId;
  label: string;
  desc: string;
  icon: typeof FileText;
  engine: 'browser' | 'server';
  accept: string;
  multiple: boolean;
}

const TOOLS: ToolDef[] = [
  { id: 'office-to-pdf', label: 'Office → PDF', desc: 'DOCX, XLSX, PPTX в PDF', icon: FileText, engine: 'server', accept: '.docx,.doc,.xlsx,.xls,.pptx,.ppt,.odt,.rtf,.csv,.txt', multiple: true },
  { id: 'pdf-to-docx', label: 'PDF → Word', desc: 'Текстовый PDF в DOCX', icon: FileText, engine: 'server', accept: '.pdf', multiple: true },
  { id: 'pdf-to-xlsx', label: 'PDF → Excel', desc: 'Таблицы из PDF в XLSX', icon: FileSpreadsheet, engine: 'server', accept: '.pdf', multiple: true },
  { id: 'merge', label: 'Объединить PDF', desc: 'Несколько PDF в один', icon: Layers, engine: 'browser', accept: '.pdf', multiple: true },
  { id: 'split', label: 'Разделить PDF', desc: 'Выбор страниц: 1-3,5', icon: Scissors, engine: 'browser', accept: '.pdf', multiple: false },
  { id: 'watermark', label: 'Водяной знак', desc: 'Текст поверх страниц', icon: Droplets, engine: 'browser', accept: '.pdf', multiple: false },
  { id: 'jpg-to-pdf', label: 'JPG → PDF', desc: 'Картинки в один PDF', icon: FileImage, engine: 'browser', accept: '.jpg,.jpeg,.png', multiple: true },
  { id: 'csv-to-xlsx', label: 'CSV → Excel', desc: 'Таблицы онлайн', icon: FileSpreadsheet, engine: 'browser', accept: '.csv', multiple: true },
  { id: 'xlsx-to-csv', label: 'Excel → CSV', desc: 'Обратная конвертация', icon: FileSpreadsheet, engine: 'browser', accept: '.xlsx,.xls', multiple: true },
];

const MAX_FILES = 5;

export default function DocConverter() {
  const { tool } = useParams<{ tool: string }>();
  const navigate = useNavigate();
  const current = TOOLS.find(t => t.id === tool) || null;

  return current ? (
    <ToolPanel tool={current} onBack={() => navigate('/doc-converter')} />
  ) : (
    <HubView onOpen={(id) => navigate(`/doc-converter/${id}`)} />
  );
}

// ── Hub: tile grid (ilovepdf style) ──
function HubView({ onOpen }: { onOpen: (id: ToolId) => void }) {
  const [loOk, setLoOk] = useState<boolean | null>(null);

  useEffect(() => {
    fetch('/api/converter/health', {
      headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || ''}` },
    })
      .then(r => r.json())
      .then(res => setLoOk(!!res?.data?.libreoffice))
      .catch(() => setLoOk(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
          <FileText className="w-7 h-7 md:w-8 md:h-8" /> КОНВЕРТЕР ДОКУМЕНТОВ
        </h1>
        <p className="text-gray-400 mt-1 font-mono text-sm">// PDF, WORD, EXCEL, CSV — ОНЛАЙН</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {TOOLS.map((t, i) => {
          const needsLo = t.engine === 'server';
          const disabled = needsLo && loOk === false;
          return (
            <motion.button
              key={t.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05, duration: 0.3 }}
              whileHover={{ scale: disabled ? 1 : 1.02, y: disabled ? 0 : -4 }}
              onClick={() => !disabled && onOpen(t.id)}
              disabled={disabled}
              className={`glass-card rounded-2xl p-6 text-left transition-all ${disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center glass-accent mb-4">
                <t.icon className="w-6 h-6" style={{ color: 'var(--color-primary)' }} />
              </div>
              <h3 className="font-mono text-sm font-bold text-gray-200">{t.label}</h3>
              <p className="font-mono text-xs text-gray-500 mt-1">{t.desc}</p>
              {needsLo && loOk === false && (
                <p className="font-mono text-[9px] text-yellow-500 mt-2">LibreOffice не установлен</p>
              )}
              {needsLo && loOk === null && (
                <p className="font-mono text-[9px] text-gray-600 mt-2">проверка сервера...</p>
              )}
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}

// ── Tool panel ──
function ToolPanel({ tool, onBack }: { tool: ToolDef; onBack: () => void }) {
  const [items, setItems] = useState<FileItem[]>([]);
  const [isBusy, setIsBusy] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Tool-specific settings
  const [splitRanges, setSplitRanges] = useState('1-3,5');
  const [wmText, setWmText] = useState('КОНФИДЕНЦИАЛЬНО');
  const [wmOpacity, setWmOpacity] = useState(25);
  const [wmPosition, setWmPosition] = useState<'center' | 'diagonal' | 'top' | 'bottom'>('diagonal');

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const remaining = MAX_FILES - items.length;
    if (remaining <= 0) { showToast(`Максимум ${MAX_FILES} файлов`, 'error'); return; }
    const toAdd = arr.slice(0, tool.multiple ? remaining : 1);
    setItems(prev => [
      ...prev,
      ...toAdd.map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: 'pending' as ItemStatus })),
    ]);
  }, [items.length, tool.multiple]);

  const removeItem = (id: string) => setItems(prev => prev.filter(i => i.id !== id));

  const runConvert = async () => {
    if (items.length === 0) return;
    setIsBusy(true);
    try {
      if (tool.engine === 'browser') await runBrowser();
      else await runServer();
    } catch (e: any) {
      showToast(e?.message || 'Ошибка конвертации', 'error');
    } finally {
      setIsBusy(false);
    }
  };

  const runBrowser = async () => {
    const set = (id: string, patch: Partial<FileItem>) =>
      setItems(prev => prev.map(i => i.id === id ? { ...i, ...patch } : i));

    if (tool.id === 'merge') {
      const first = items[0];
      set(first.id, { status: 'converting' });
      try {
        const blob = await mergePdfs(items.map(i => i.file));
        set(first.id, { status: 'done', resultBlob: blob, resultName: 'merged.pdf', resultSize: blob.size });
        items.slice(1).forEach(i => set(i.id, { status: 'done' }));
      } catch (e) {
        set(first.id, { status: 'error', error: 'Ошибка объединения' });
      }
      return;
    }

    for (const item of items) {
      set(item.id, { status: 'converting' });
      try {
        let blob: Blob;
        let name = item.file.name.replace(/\.[^.]+$/, '');
        if (tool.id === 'split') {
          const parts = await splitPdf(item.file, splitRanges);
          // Multiple outputs: download all sequentially
          for (const p of parts) downloadBlob(p.blob, p.name);
          set(item.id, { status: 'done', resultName: `${parts.length} частей` });
          showToast(`Создано частей: ${parts.length}`, 'success');
          continue;
        } else if (tool.id === 'watermark') {
          blob = await watermarkPdf(item.file, { text: wmText, opacity: wmOpacity / 100, position: wmPosition });
          name += '_wm.pdf';
        } else if (tool.id === 'jpg-to-pdf') {
          blob = await imagesToPdf(items.map(i => i.file));
          name = 'images.pdf';
          set(item.id, { status: 'done', resultBlob: blob, resultName: name, resultSize: blob.size });
          items.slice(1).forEach((i, idx) => idx > 0 && set(i.id, { status: 'done' }));
          showToast('PDF создан', 'success');
          return;
        } else if (tool.id === 'csv-to-xlsx') {
          blob = await csvToXlsx(item.file);
          name += '.xlsx';
        } else if (tool.id === 'xlsx-to-csv') {
          blob = await xlsxToCsv(item.file);
          name += '.csv';
        } else {
          throw new Error('Неизвестный инструмент');
        }
        set(item.id, { status: 'done', resultBlob: blob, resultName: name, resultSize: blob.size });
      } catch (e) {
        set(item.id, { status: 'error', error: 'Ошибка' });
      }
    }
    showToast('Готово', 'success');
  };

  const runServer = async () => {
    const endpoint = tool.id === 'office-to-pdf' ? '/api/converter/office-to-pdf'
      : tool.id === 'pdf-to-docx' ? '/api/converter/pdf-to-docx'
      : '/api/converter/pdf-to-xlsx';

    for (const item of items) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'converting' } : i));
      try {
        const fd = new FormData();
        fd.append('file', item.file);
        const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
        const res = await fetch(endpoint, { method: 'POST', body: fd, headers: { Authorization: `Bearer ${token}` } });
        const json = await res.json();
        if (json.success && json.data) {
          setItems(prev => prev.map(i => i.id === item.id ? {
            ...i,
            status: 'done',
            resultUrl: json.data.downloadUrl,
            resultName: json.data.filename,
            resultSize: json.data.size,
          } : i));
        } else {
          setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: json.error || 'Ошибка' } : i));
        }
      } catch {
        setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'error', error: 'Сетевая ошибка' } : i));
      }
    }
    showToast('Готово', 'success');
  };

  const downloadResult = async (item: FileItem) => {
    if (item.resultBlob && item.resultName) {
      downloadBlob(item.resultBlob, item.resultName);
    } else if (item.resultUrl) {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || getControlToken() || '';
      const res = await fetch(item.resultUrl, { headers: { Authorization: `Bearer ${token}` } });
      const blob = await res.blob();
      downloadBlob(blob, item.resultName || 'result');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-xl glass hover:bg-white/10" aria-label="Назад">
          <ArrowLeft className="w-4 h-4 text-gray-400" />
        </button>
        <div>
          <h1 className="text-2xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <tool.icon className="w-6 h-6" /> {tool.label.toUpperCase()}
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// {tool.desc}</p>
        </div>
      </div>

      {/* Settings */}
      {tool.id === 'split' && (
        <div className="glass rounded-xl p-4">
          <label className="font-mono text-xs text-gray-500 mb-2 block">ДИАПАЗОНЫ СТРАНИЦ</label>
          <input value={splitRanges} onChange={e => setSplitRanges(e.target.value)}
            placeholder="например: 1-3,5,7"
            className="w-full px-4 py-2.5 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none focus:border-[var(--color-primary)]" />
          <p className="font-mono text-[10px] text-gray-600 mt-2">Каждый диапазон станет отдельным PDF-файлом</p>
        </div>
      )}
      {tool.id === 'watermark' && (
        <div className="glass rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-mono text-xs text-gray-500 mb-2 block">ТЕКСТ</label>
            <input value={wmText} onChange={e => setWmText(e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
          </div>
          <div>
            <label className="font-mono text-xs text-gray-500 mb-2 block">ПРОЗРАЧНОСТЬ: {wmOpacity}%</label>
            <input type="range" min={5} max={80} value={wmOpacity} onChange={e => setWmOpacity(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
          </div>
          <div>
            <label className="font-mono text-xs text-gray-500 mb-2 block">ПОЗИЦИЯ</label>
            <select value={wmPosition} onChange={e => setWmPosition(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
              <option value="diagonal">Диагональ</option>
              <option value="center">Центр</option>
              <option value="top">Сверху</option>
              <option value="bottom">Снизу</option>
            </select>
          </div>
        </div>
      )}

      {/* Drop zone */}
      <div
        className="glass rounded-2xl p-8 text-center cursor-pointer transition-all"
        style={dragOver ? { borderColor: 'var(--color-primary)', background: 'rgba(0,255,136,0.05)' } : {}}
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={e => { e.preventDefault(); setDragOver(false); addFiles(e.dataTransfer.files); }}
      >
        <Upload className="w-10 h-10 mx-auto mb-3 opacity-40" style={{ color: 'var(--color-primary)' }} />
        <p className="font-mono text-sm text-gray-300">ПЕРЕТАЩИТЕ ФАЙЛЫ ИЛИ НАЖМИТЕ</p>
        <p className="font-mono text-[10px] text-gray-600 mt-1">до {MAX_FILES} файлов • {tool.accept}</p>
        <input ref={fileInputRef} type="file" accept={tool.accept} multiple={tool.multiple} className="hidden"
          onChange={e => { if (e.target.files) addFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {/* File list */}
      {items.length > 0 && (
        <div className="glass rounded-2xl p-4 space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center gap-3 px-3 py-2.5 rounded-xl bg-black/20">
              <div className="flex-1 min-w-0">
                <p className="font-mono text-xs text-gray-200 truncate">{item.file.name}</p>
                <p className="font-mono text-[10px] text-gray-500">{formatFileSize(item.file.size)}</p>
              </div>
              {item.status === 'pending' && <span className="font-mono text-[10px] text-gray-500">ожидание</span>}
              {item.status === 'converting' && <RefreshCw className="w-4 h-4 animate-spin text-gray-400" />}
              {item.status === 'done' && (
                <>
                  <CheckCircle className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                  {(item.resultBlob || item.resultUrl) && (
                    <button onClick={() => downloadResult(item)} className="px-2.5 py-1 rounded-lg font-mono text-[10px] font-bold"
                      style={{ background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)' }}>
                      <Download className="w-3 h-3 inline mr-1" />СКАЧАТЬ
                    </button>
                  )}
                </>
              )}
              {item.status === 'error' && (
                <>
                  <AlertCircle className="w-4 h-4 text-red-400" />
                  <span className="font-mono text-[10px] text-red-400">{item.error}</span>
                </>
              )}
              {item.status === 'pending' && (
                <button onClick={() => removeItem(item.id)} className="p-1 rounded hover:bg-white/10" aria-label="Удалить">
                  <X className="w-3.5 h-3.5 text-gray-500" />
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-2 pt-2">
            <button onClick={runConvert} disabled={isBusy}
              className="flex-1 py-2.5 rounded-xl font-mono text-sm font-bold transition-all disabled:opacity-50"
              style={{ background: 'var(--color-primary)', color: '#000' }}>
              {isBusy ? 'КОНВЕРТАЦИЯ...' : 'КОНВЕРТИРОВАТЬ'}
            </button>
            <button onClick={() => setItems([])} className="px-4 py-2.5 rounded-xl glass text-gray-400 hover:text-gray-200 font-mono text-sm">
              ОЧИСТИТЬ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
