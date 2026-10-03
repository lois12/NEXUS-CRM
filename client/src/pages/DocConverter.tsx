import { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  FileText, FileSpreadsheet, FileImage, Scissors, Droplets,
  Upload, Download, X, CheckCircle, AlertCircle, ArrowLeft, RefreshCw, Layers,
  RotateCw, Hash, Crop, Archive, Trash2,
  Presentation, PenLine, Eraser, Shield, History as HistoryIcon,
} from 'lucide-react';
import {
  mergePdfs, splitPdf, watermarkPdf, imagesToPdf, csvToXlsx, xlsxToCsv,
  downloadBlob, formatFileSize,
  rotatePdf, organizePdf, addPageNumbers, cropPdf, compressPdf, downloadZip,
  signPdf, redactPdf, RedactRegion,
} from '../utils/docTools';
import { renderPdfPages } from '../utils/pdfPreview';
import { showToast } from '../components/ui/NexusModal';
import { getControlToken } from '../services/api';

type ToolId =
  | 'office-to-pdf' | 'pdf-to-docx' | 'pdf-to-xlsx' | 'pdf-to-pptx'
  | 'merge' | 'split' | 'watermark' | 'jpg-to-pdf'
  | 'csv-to-xlsx' | 'xlsx-to-csv' | 'csv-to-pdf' | 'xlsx-to-pdf'
  | 'rotate' | 'organize' | 'pagenum' | 'crop' | 'compress'
  | 'sign' | 'redact' | 'protect';

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
  { id: 'pdf-to-pptx', label: 'PDF → PowerPoint', desc: 'Страницы в слайды', icon: Presentation, engine: 'server', accept: '.pdf', multiple: true },
  { id: 'sign', label: 'Подписать PDF', desc: 'Подпись на каждой странице', icon: PenLine, engine: 'browser', accept: '.pdf', multiple: true },
  { id: 'redact', label: 'Замазка (цензура)', desc: 'Чёрные блоки поверх текста', icon: Eraser, engine: 'browser', accept: '.pdf', multiple: false },
  { id: 'protect', label: 'Защита паролем', desc: 'Шифрование PDF (AES-256)', icon: Shield, engine: 'server', accept: '.pdf', multiple: true },
  { id: 'merge', label: 'Объединить PDF', desc: 'Несколько PDF в один', icon: Layers, engine: 'browser', accept: '.pdf', multiple: true },
  { id: 'split', label: 'Разделить PDF', desc: 'Выбор страниц: 1-3,5', icon: Scissors, engine: 'browser', accept: '.pdf', multiple: false },
  { id: 'watermark', label: 'Водяной знак', desc: 'Текст поверх страниц', icon: Droplets, engine: 'browser', accept: '.pdf', multiple: false },
  { id: 'jpg-to-pdf', label: 'JPG → PDF', desc: 'Картинки в один PDF', icon: FileImage, engine: 'browser', accept: '.jpg,.jpeg,.png', multiple: true },
  { id: 'csv-to-xlsx', label: 'CSV → Excel', desc: 'Таблицы онлайн', icon: FileSpreadsheet, engine: 'browser', accept: '.csv', multiple: true },
  { id: 'xlsx-to-csv', label: 'Excel → CSV', desc: 'Обратная конвертация', icon: FileSpreadsheet, engine: 'browser', accept: '.xlsx,.xls', multiple: true },
  { id: 'csv-to-pdf', label: 'CSV → PDF', desc: 'Таблица в PDF', icon: FileText, engine: 'server', accept: '.csv', multiple: true },
  { id: 'xlsx-to-pdf', label: 'Excel → PDF', desc: 'Таблица печатным видом', icon: FileText, engine: 'server', accept: '.xlsx,.xls', multiple: true },
  { id: 'rotate', label: 'Повернуть PDF', desc: 'Страницы на 90/180/270°', icon: RotateCw, engine: 'browser', accept: '.pdf', multiple: true },
  { id: 'organize', label: 'Организовать страницы', desc: 'Порядок, удаление, поворот', icon: Layers, engine: 'browser', accept: '.pdf', multiple: false },
  { id: 'pagenum', label: 'Номера страниц', desc: 'Пронумеровать страницы', icon: Hash, engine: 'browser', accept: '.pdf', multiple: true },
  { id: 'crop', label: 'Обрезать PDF', desc: 'Убрать поля в %', icon: Crop, engine: 'browser', accept: '.pdf', multiple: true },
  { id: 'compress', label: 'Сжать PDF', desc: 'Уменьшить размер файла', icon: Archive, engine: 'browser', accept: '.pdf', multiple: true },
];

const MAX_FILES = 5;

// ── Signature drawing pad → PNG data URL ──
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    onChange(null);
  };

  return (
    <div>
      <canvas
        ref={canvasRef}
        width={480}
        height={140}
        className="w-full max-w-md rounded-lg border border-white/10 bg-black/30 cursor-crosshair touch-none"
        onMouseDown={e => {
          drawing.current = true;
          const ctx = canvasRef.current?.getContext('2d');
          if (!ctx) return;
          const { x, y } = getPos(e);
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.strokeStyle = '#e8e8ec';
          ctx.lineWidth = 2.5;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }}
        onMouseMove={e => {
          if (!drawing.current) return;
          const ctx = canvasRef.current?.getContext('2d');
          if (!ctx) return;
          const { x, y } = getPos(e);
          ctx.lineTo(x, y);
          ctx.stroke();
          onChange(canvasRef.current?.toDataURL('image/png') || null);
        }}
        onMouseUp={() => { drawing.current = false; }}
        onMouseLeave={() => { drawing.current = false; }}
      />
      <button onClick={clear} className="mt-2 px-3 py-1 rounded-lg font-mono text-[10px] glass text-gray-400 hover:text-gray-200">
        ОЧИСТИТЬ
      </button>
    </div>
  );
}

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
  const [history, setHistory] = useState<{ name: string; tool: string; date: string; size: number }[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    fetch('/api/converter/health', {
      headers: { Authorization: `Bearer ${localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || ''}` },
    })
      .then(r => r.json())
      .then(res => setLoOk(!!res?.data?.libreoffice))
      .catch(() => setLoOk(false));
    try {
      const raw = localStorage.getItem('nexus-conv-history');
      if (raw) setHistory(JSON.parse(raw));
    } catch {}
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <FileText className="w-7 h-7 md:w-8 md:h-8" /> КОНВЕРТЕР ДОКУМЕНТОВ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// PDF, WORD, EXCEL, CSV — ОНЛАЙН</p>
        </div>
        {history.length > 0 && (
          <button onClick={() => setShowHistory(v => !v)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg font-mono text-xs glass hover:bg-white/10">
            <HistoryIcon className="w-3.5 h-3.5" /> ИСТОРИЯ ({history.length})
          </button>
        )}
      </div>

      {showHistory && history.length > 0 && (
        <div className="glass rounded-xl p-4">
          <div className="flex items-center justify-between mb-2">
            <label className="font-mono text-xs text-gray-500">ПОСЛЕДНИЕ КОНВЕРТАЦИИ</label>
            <button onClick={() => {
              setHistory([]);
              try { localStorage.removeItem('nexus-conv-history'); } catch {}
            }} className="font-mono text-[10px] text-red-400 hover:bg-white/10 px-2 py-1 rounded">ОЧИСТИТЬ</button>
          </div>
          <div className="space-y-1 max-h-56 overflow-y-auto">
            {history.map((h, i) => (
              <div key={i} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-black/20 text-xs font-mono">
                <span className="text-gray-400 w-28 truncate">{h.tool}</span>
                <span className="text-gray-200 flex-1 truncate">{h.name}</span>
                <span className="text-gray-500">{formatFileSize(h.size)}</span>
                <span className="text-gray-600 text-[9px]">{h.date}</span>
              </div>
            ))}
          </div>
        </div>
      )}

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
  const [rotateAngle, setRotateAngle] = useState<90 | 180 | 270>(90);
  const [rotatePages, setRotatePages] = useState('');
  const [pnPosition, setPnPosition] = useState<'bottom-center' | 'bottom-right' | 'bottom-left' | 'top-center' | 'top-right' | 'top-left'>('bottom-center');
  const [pnFormat, setPnFormat] = useState<'n' | 'n/total' | 'Стр n из total'>('n');
  const [pnStart, setPnStart] = useState(1);
  const [cropTop, setCropTop] = useState(0);
  const [cropBottom, setCropBottom] = useState(0);
  const [cropLeft, setCropLeft] = useState(0);
  const [cropRight, setCropRight] = useState(0);
  // Organize: page list state — one entry per source page
  const [pageList, setPageList] = useState<{ num: number; keep: boolean; rot: number }[]>([]);
  const [pageThumbs, setPageThumbs] = useState<Record<number, string>>({});
  // Sign
  const [signDataUrl, setSignDataUrl] = useState<string | null>(null);
  const [signPosition, setSignPosition] = useState<'bottom-right' | 'bottom-left' | 'top-right' | 'top-left'>('bottom-right');
  const [signWidth, setSignWidth] = useState(25);
  const [signPages, setSignPages] = useState('');
  // Redact
  const [redactPage, setRedactPage] = useState(1);
  const [redactRegions, setRedactRegions] = useState<RedactRegion[]>([]);
  const [redactThumbs, setRedactThumbs] = useState<{ index: number; dataUrl: string; width: number; height: number }[]>([]);
  const [redactDrawing, setRedactDrawing] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  // Protect
  const [protectPassword, setProtectPassword] = useState('');
  // History is read in HubView; ToolPanel only appends via pushHistory

  const pushHistory = (name: string, toolLabel: string, size: number) => {
    try {
      const raw = localStorage.getItem('nexus-conv-history');
      const prev: { name: string; tool: string; date: string; size: number }[] = raw ? JSON.parse(raw) : [];
      const next = [{ name, tool: toolLabel, date: new Date().toLocaleString('ru-RU'), size }, ...prev].slice(0, 30);
      localStorage.setItem('nexus-conv-history', JSON.stringify(next));
    } catch {}
  };

  // Organize tool: render page thumbnails when a file is added
  useEffect(() => {
    if (tool.id !== 'organize' && tool.id !== 'redact') return;
    const f = items.find(i => i.file)?.file;
    if (!f) return;
    renderPdfPages(f, { scale: tool.id === 'redact' ? 0.8 : 0.35, maxPages: 30 })
      .then(pages => {
        if (tool.id === 'redact') {
          setRedactThumbs(pages);
          setRedactPage(pages[0]?.index || 1);
          setRedactRegions([]);
        } else {
          const map: Record<number, string> = {};
          pages.forEach(p => { map[p.index] = p.dataUrl; });
          setPageThumbs(map);
        }
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.length, tool.id]);

  const addFiles = useCallback((files: FileList | File[]) => {
    const arr = Array.from(files);
    const remaining = MAX_FILES - items.length;
    if (remaining <= 0) { showToast(`Максимум ${MAX_FILES} файлов`, 'error'); return; }
    const toAdd = arr.slice(0, tool.multiple ? remaining : 1);
    const newItems = toAdd.map(f => ({ id: Math.random().toString(36).slice(2), file: f, status: 'pending' as ItemStatus }));
    setItems(prev => [...prev, ...newItems]);

    // Organize tool: build page list from the first PDF
    if (tool.id === 'organize' && toAdd[0]) {
      import('pdf-lib').then(async ({ PDFDocument }) => {
        try {
          const doc = await PDFDocument.load(await toAdd[0].arrayBuffer());
          setPageList(doc.getPageIndices().map(i => ({ num: i + 1, keep: true, rot: 0 })));
        } catch { setPageList([]); }
      });
    }
  }, [items.length, tool.multiple, tool.id]);

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
        } else if (tool.id === 'rotate') {
          blob = await rotatePdf(item.file, rotateAngle, rotatePages || undefined);
          name += '_rotated.pdf';
        } else if (tool.id === 'organize') {
          const kept = pageList.filter(p => p.keep);
          if (kept.length === 0) throw new Error('Оставьте хотя бы одну страницу');
          const order = kept.map(p => p.num);
          const rots: Record<number, number> = {};
          kept.forEach((p, i) => { if (p.rot) rots[i] = p.rot; });
          blob = await organizePdf(item.file, order, rots);
          name += '_organized.pdf';
        } else if (tool.id === 'pagenum') {
          blob = await addPageNumbers(item.file, { position: pnPosition, format: pnFormat, startNumber: pnStart });
          name += '_numbered.pdf';
        } else if (tool.id === 'crop') {
          blob = await cropPdf(item.file, { top: cropTop, bottom: cropBottom, left: cropLeft, right: cropRight });
          name += '_cropped.pdf';
        } else if (tool.id === 'compress') {
          const res = await compressPdf(item.file);
          blob = res.blob;
          name += '_compressed.pdf';
          showToast(`Сжато: ${formatFileSize(res.before)} → ${formatFileSize(res.after)}`, 'success');
        } else if (tool.id === 'sign') {
          if (!signDataUrl) throw new Error('Нарисуйте подпись');
          blob = await signPdf(item.file, { signatureDataUrl: signDataUrl, position: signPosition, widthPercent: signWidth, pages: signPages || undefined });
          name += '_signed.pdf';
        } else if (tool.id === 'redact') {
          if (redactRegions.length === 0) throw new Error('Выделите области для замазки');
          blob = await redactPdf(item.file, redactRegions);
          name += '_redacted.pdf';
        } else {
          throw new Error('Неизвестный инструмент');
        }
        set(item.id, { status: 'done', resultBlob: blob, resultName: name, resultSize: blob.size });
        pushHistory(name, tool.label, blob.size);
      } catch (e) {
        set(item.id, { status: 'error', error: 'Ошибка' });
      }
    }
    showToast('Готово', 'success');
  };

  const runServer = async () => {
    const endpoint = tool.id === 'office-to-pdf' || tool.id === 'csv-to-pdf' || tool.id === 'xlsx-to-pdf' ? '/api/converter/office-to-pdf'
      : tool.id === 'pdf-to-docx' ? '/api/converter/pdf-to-docx'
      : tool.id === 'pdf-to-xlsx' ? '/api/converter/pdf-to-xlsx'
      : tool.id === 'pdf-to-pptx' ? '/api/converter/pdf-to-pptx'
      : '/api/converter/protect-pdf';

    for (const item of items) {
      setItems(prev => prev.map(i => i.id === item.id ? { ...i, status: 'converting' } : i));
      try {
        const fd = new FormData();
        fd.append('file', item.file);
        if (tool.id === 'protect') fd.append('password', protectPassword);
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
          pushHistory(json.data.filename || item.file.name, tool.label, json.data.size || 0);
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
      {tool.id === 'rotate' && (
        <div className="glass rounded-xl p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label className="font-mono text-xs text-gray-500 mb-2 block">УГОЛ</label>
            <div className="flex gap-2">
              {([90, 180, 270] as const).map(a => (
                <button key={a} onClick={() => setRotateAngle(a)}
                  className="px-4 py-2 rounded-lg font-mono text-sm transition-all"
                  style={rotateAngle === a
                    ? { background: 'var(--color-primary)', color: '#000' }
                    : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
                  {a}°
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="font-mono text-xs text-gray-500 mb-2 block">СТРАНИЦЫ (пусто = все)</label>
            <input value={rotatePages} onChange={e => setRotatePages(e.target.value)}
              placeholder="например: 1-3,5"
              className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
          </div>
        </div>
      )}
      {tool.id === 'organize' && pageList.length > 0 && (
        <div className="glass rounded-xl p-4">
          <label className="font-mono text-xs text-gray-500 mb-2 block">СТРАНИЦЫ — ПЕРЕТАСКИВАЙТЕ, УДАЛЯЙТЕ, ПОВОРАЧИВАЙТЕ</label>
          <div className="flex flex-wrap gap-3">
            {pageList.map((p, i) => (
              <div
                key={p.num}
                draggable
                onDragStart={e => e.dataTransfer.setData('text/plain', String(i))}
                onDragOver={e => e.preventDefault()}
                onDrop={e => {
                  e.preventDefault();
                  const from = parseInt(e.dataTransfer.getData('text/plain'), 10);
                  if (isNaN(from) || from === i) return;
                  setPageList(list => {
                    const next = [...list];
                    const [moved] = next.splice(from, 1);
                    next.splice(i, 0, moved);
                    return next;
                  });
                }}
                className="w-20 rounded-lg overflow-hidden cursor-grab active:cursor-grabbing border border-white/10"
                style={{ opacity: p.keep ? 1 : 0.35 }}
              >
                {pageThumbs[p.num] ? (
                  <img src={pageThumbs[p.num]} alt={`#${p.num}`} className="w-full h-24 object-cover object-top pointer-events-none" />
                ) : (
                  <div className="w-full h-24 bg-black/30 flex items-center justify-center">
                    <span className="font-mono text-[10px] text-gray-500">#{p.num}</span>
                  </div>
                )}
                <div className="flex items-center justify-between px-1 py-0.5 bg-black/40">
                  <span className="font-mono text-[9px] text-gray-400">{p.num}</span>
                  <div className="flex gap-0.5">
                    <button onClick={() => setPageList(list => list.map((x, j) => j === i ? { ...x, rot: (x.rot + 90) % 360 } : x))}
                      className="p-0.5 rounded hover:bg-white/10" aria-label="Повернуть"><RotateCw className="w-2.5 h-2.5 text-gray-400" /></button>
                    <button onClick={() => setPageList(list => list.map((x, j) => j === i ? { ...x, keep: !x.keep } : x))}
                      className="p-0.5 rounded hover:bg-white/10" aria-label="Удалить/вернуть">
                      {p.keep ? <Trash2 className="w-2.5 h-2.5 text-red-400" /> : <RefreshCw className="w-2.5 h-2.5 text-gray-500" />}
                    </button>
                  </div>
                </div>
                {p.rot > 0 && <div className="text-center font-mono text-[8px] text-gray-500 bg-black/30">{p.rot}°</div>}
              </div>
            ))}
          </div>
        </div>
      )}
      {tool.id === 'pagenum' && (
        <div className="glass rounded-xl p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <label className="font-mono text-xs text-gray-500 mb-2 block">ПОЗИЦИЯ</label>
            <select value={pnPosition} onChange={e => setPnPosition(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
              <option value="bottom-center">Снизу по центру</option>
              <option value="bottom-right">Снизу справа</option>
              <option value="bottom-left">Снизу слева</option>
              <option value="top-center">Сверху по центру</option>
              <option value="top-right">Сверху справа</option>
              <option value="top-left">Сверху слева</option>
            </select>
          </div>
          <div>
            <label className="font-mono text-xs text-gray-500 mb-2 block">ФОРМАТ</label>
            <select value={pnFormat} onChange={e => setPnFormat(e.target.value as any)}
              className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
              <option value="n">1, 2, 3</option>
              <option value="n/total">1/10</option>
              <option value="Стр n из total">Page 1 of 10</option>
            </select>
          </div>
          <div>
            <label className="font-mono text-xs text-gray-500 mb-2 block">НАЧАТЬ С</label>
            <input type="number" min={0} value={pnStart} onChange={e => setPnStart(+e.target.value)}
              className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
          </div>
        </div>
      )}
      {tool.id === 'crop' && (
        <div className="glass rounded-xl p-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
          {([['ВЕРХ', cropTop, setCropTop], ['НИЗ', cropBottom, setCropBottom], ['ЛЕВО', cropLeft, setCropLeft], ['ПРАВО', cropRight, setCropRight]] as const).map(([label, val, set]) => (
            <div key={label}>
              <label className="font-mono text-xs text-gray-500 mb-2 block">{label}: {val}%</label>
              <input type="range" min={0} max={40} value={val} onChange={e => set(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
            </div>
          ))}
        </div>
      )}
      {tool.id === 'protect' && (
        <div className="glass rounded-xl p-4">
          <label className="font-mono text-xs text-gray-500 mb-2 block">ПАРОЛЬ ДЛЯ ОТКРЫТИЯ PDF</label>
          <input type="password" value={protectPassword} onChange={e => setProtectPassword(e.target.value)}
            placeholder="минимум 4 символа"
            className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
          <p className="font-mono text-[10px] text-gray-600 mt-2">Шифрование AES-256. Потеряете пароль — файл не открыть.</p>
        </div>
      )}
      {tool.id === 'sign' && (
        <div className="glass rounded-xl p-4 space-y-3">
          <label className="font-mono text-xs text-gray-500 block">НАРИСУЙТЕ ПОДПИСЬ МЫШЬЮ / ПАЛЬЦЕМ</label>
          <SignaturePad onChange={setSignDataUrl} />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="font-mono text-xs text-gray-500 mb-2 block">ПОЗИЦИЯ</label>
              <select value={signPosition} onChange={e => setSignPosition(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none">
                <option value="bottom-right">Снизу справа</option>
                <option value="bottom-left">Снизу слева</option>
                <option value="top-right">Сверху справа</option>
                <option value="top-left">Сверху слева</option>
              </select>
            </div>
            <div>
              <label className="font-mono text-xs text-gray-500 mb-2 block">РАЗМЕР: {signWidth}%</label>
              <input type="range" min={10} max={45} value={signWidth} onChange={e => setSignWidth(+e.target.value)} className="w-full accent-[var(--color-primary)]" />
            </div>
            <div>
              <label className="font-mono text-xs text-gray-500 mb-2 block">СТРАНИЦЫ (пусто = все)</label>
              <input value={signPages} onChange={e => setSignPages(e.target.value)} placeholder="1-3,5"
                className="w-full px-3 py-2 rounded-lg font-mono text-sm bg-black/30 border border-gray-700 text-gray-200 focus:outline-none" />
            </div>
          </div>
        </div>
      )}
      {tool.id === 'redact' && redactThumbs.length > 0 && (
        <div className="glass rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <label className="font-mono text-xs text-gray-500">ОБЛАСТИ ДЛЯ ЗАМАЗКИ ({redactRegions.length})</label>
            <div className="flex gap-2">
              {redactThumbs.map(p => (
                <button key={p.index} onClick={() => setRedactPage(p.index)}
                  className="px-2 py-1 rounded font-mono text-[10px]"
                  style={redactPage === p.index ? { background: 'var(--color-primary)', color: '#000' } : { background: 'rgba(255,255,255,0.05)', color: '#888' }}>
                  #{p.index}
                </button>
              ))}
              {redactRegions.length > 0 && (
                <button onClick={() => setRedactRegions([])} className="px-2 py-1 rounded font-mono text-[10px] text-red-400 hover:bg-white/10">СБРОС</button>
              )}
            </div>
          </div>
          {(() => {
            const page = redactThumbs.find(p => p.index === redactPage) || redactThumbs[0];
            if (!page) return null;
            return (
              <div
                className="relative inline-block max-w-full cursor-crosshair select-none"
                onMouseDown={e => {
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  setRedactDrawing({ x: (e.clientX - rect.left) / rect.width, y: (e.clientY - rect.top) / rect.height, w: 0, h: 0 });
                }}
                onMouseMove={e => {
                  if (!redactDrawing) return;
                  const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                  const x2 = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
                  const y2 = Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height));
                  setRedactDrawing({
                    x: Math.min(redactDrawing.x, x2), y: Math.min(redactDrawing.y, y2),
                    w: Math.abs(x2 - redactDrawing.x), h: Math.abs(y2 - redactDrawing.y),
                  });
                }}
                onMouseUp={() => {
                  if (redactDrawing && redactDrawing.w > 0.01 && redactDrawing.h > 0.01) {
                    setRedactRegions(prev => [...prev, { page: redactPage, ...redactDrawing }]);
                  }
                  setRedactDrawing(null);
                }}
                onMouseLeave={() => setRedactDrawing(null)}
              >
                <img src={page.dataUrl} alt={`Страница ${redactPage}`} draggable={false}
                  className="block max-w-full max-h-[420px] rounded-lg border border-white/10" />
                {redactRegions.filter(r => r.page === redactPage).map((r, i) => (
                  <div key={i} className="absolute bg-black" style={{
                    left: `${r.x * 100}%`, top: `${r.y * 100}%`,
                    width: `${r.w * 100}%`, height: `${r.h * 100}%`,
                  }} />
                ))}
                {redactDrawing && redactDrawing.w > 0 && (
                  <div className="absolute bg-black opacity-50 pointer-events-none" style={{
                    left: `${redactDrawing.x * 100}%`, top: `${redactDrawing.y * 100}%`,
                    width: `${redactDrawing.w * 100}%`, height: `${redactDrawing.h * 100}%`,
                  }} />
                )}
              </div>
            );
          })()}
          <p className="font-mono text-[10px] text-gray-600">Нажмите и тяните мышью по превью, чтобы замазать область</p>
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
            {items.filter(i => i.status === 'done' && (i.resultBlob || i.resultUrl)).length > 1 && (
              <button onClick={async () => {
                const done = items.filter(i => i.status === 'done');
                const files: { name: string; blob: Blob }[] = [];
                for (const i of done) {
                  if (i.resultBlob && i.resultName) {
                    files.push({ name: i.resultName, blob: i.resultBlob });
                  } else if (i.resultUrl) {
                    const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token') || '';
                    const res = await fetch(i.resultUrl, { headers: { Authorization: `Bearer ${token}` } });
                    files.push({ name: i.resultName || 'file', blob: await res.blob() });
                  }
                }
                if (files.length) await downloadZip(files, 'nexus-converted.zip');
              }} className="px-4 py-2.5 rounded-xl font-mono text-sm font-bold transition-all"
                style={{ background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}>
                <Archive className="w-3.5 h-3.5 inline mr-1" />ZIP
              </button>
            )}
            <button onClick={() => setItems([])} className="px-4 py-2.5 rounded-xl glass text-gray-400 hover:text-gray-200 font-mono text-sm">
              ОЧИСТИТЬ
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
