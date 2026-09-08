import { useState, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
  Upload,
  Download,
  Trash,
  Settings,
  FileImage,
  Maximize,
  RefreshCw,
  X,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';

type OutputFormat = 'png' | 'jpeg' | 'webp';

interface ConversionSettings {
  format: OutputFormat;
  quality: number;
  maxWidth: number;
  maxHeight: number;
  maintainAspect: boolean;
}

interface ImageItem {
  id: string;
  file: File;
  preview: string;
  width: number;
  height: number;
  size: number;
  resultUrl?: string;
  resultSize?: number;
  status: 'pending' | 'converting' | 'done' | 'error';
}

const MAX_FILES = 5;

const formatLabels: Record<OutputFormat, string> = {
  png: 'PNG',
  jpeg: 'JPEG',
  webp: 'WebP',
};

const formatMimes: Record<OutputFormat, string> = {
  png: 'image/png',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function loadImage(file: File): Promise<{ preview: string; width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => resolve({
        preview: e.target?.result as string,
        width: img.width,
        height: img.height,
      });
      img.onerror = reject;
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ImageConverter() {
  const [images, setImages] = useState<ImageItem[]>([]);
  const [settings, setSettings] = useState<ConversionSettings>({
    format: 'png',
    quality: 90,
    maxWidth: 0,
    maxHeight: 0,
    maintainAspect: true,
  });
  const [isConverting, setIsConverting] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const addFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    const remaining = MAX_FILES - images.length;
    if (remaining <= 0) return;
    const toAdd = fileArray.slice(0, remaining);

    const newItems: ImageItem[] = [];
    for (const file of toAdd) {
      try {
        const { preview, width, height } = await loadImage(file);
        newItems.push({
          id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
          file,
          preview,
          width,
          height,
          size: file.size,
          status: 'pending',
        });
      } catch {}
    }

    setImages(prev => [...prev, ...newItems]);
  }, [images.length]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length) addFiles(e.dataTransfer.files);
  }, [addFiles]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) addFiles(e.target.files);
    e.target.value = '';
  }, [addFiles]);

  const removeImage = useCallback((id: string) => {
    setImages(prev => {
      const item = prev.find(i => i.id === id);
      if (item?.resultUrl) URL.revokeObjectURL(item.resultUrl);
      return prev.filter(i => i.id !== id);
    });
  }, []);

  const clearAll = useCallback(() => {
    images.forEach(i => { if (i.resultUrl) URL.revokeObjectURL(i.resultUrl); });
    setImages([]);
  }, [images]);

  const convertOne = useCallback(async (item: ImageItem): Promise<ImageItem> => {
    try {
      const img = new window.Image();
      img.src = item.preview;
      await new Promise<void>((resolve) => { img.onload = () => resolve(); });

      let { maxWidth, maxHeight } = settings;
      let width = img.width;
      let height = img.height;

      if (maxWidth > 0 || maxHeight > 0) {
        if (settings.maintainAspect) {
          const ratio = img.width / img.height;
          if (maxWidth > 0 && maxHeight > 0) {
            if (maxWidth / maxHeight > ratio) {
              width = maxHeight * ratio;
              height = maxHeight;
            } else {
              width = maxWidth;
              height = maxWidth / ratio;
            }
          } else if (maxWidth > 0) {
            width = maxWidth;
            height = maxWidth / ratio;
          } else {
            width = maxHeight * ratio;
            height = maxHeight;
          }
        } else {
          width = maxWidth > 0 ? maxWidth : img.width;
          height = maxHeight > 0 ? maxHeight : img.height;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      const quality = settings.format === 'png' ? undefined : settings.quality / 100;
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), formatMimes[settings.format], quality);
      });

      return {
        ...item,
        resultUrl: URL.createObjectURL(blob),
        resultSize: blob.size,
        status: 'done',
      };
    } catch {
      return { ...item, status: 'error' };
    }
  }, [settings]);

  const convertAll = useCallback(async () => {
    if (!images.length) return;
    setIsConverting(true);

    setImages(prev => prev.map(i => ({ ...i, status: 'converting' as const })));

    const results: ImageItem[] = [];
    for (const item of images) {
      const result = await convertOne(item);
      results.push(result);
      setImages(prev => prev.map(i => i.id === result.id ? result : i));
    }

    setIsConverting(false);
  }, [images, convertOne]);

  const downloadOne = useCallback((item: ImageItem) => {
    if (!item.resultUrl) return;
    const ext = settings.format;
    const name = item.file.name.replace(/\.[^.]+$/, '') + '.' + ext;
    const link = document.createElement('a');
    link.download = name;
    link.href = item.resultUrl;
    link.click();
  }, [settings.format]);

  const downloadAll = useCallback(() => {
    images.forEach(item => {
      if (item.resultUrl) downloadOne(item);
    });
  }, [images, downloadOne]);

  const doneCount = images.filter(i => i.status === 'done').length;
  const totalOriginal = images.reduce((s, i) => s + i.size, 0);
  const totalResult = images.reduce((s, i) => s + (i.resultSize || 0), 0);
  const totalReduction = totalOriginal > 0 && totalResult > 0
    ? Math.round((1 - totalResult / totalOriginal) * 100)
    : 0;

  return (
    <div className="space-y-6 cyber-grid">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
            <FileImage className="w-7 h-7 md:w-8 md:h-8" />
            КОНВЕРТЕР ИЗОБРАЖЕНИЙ
          </h1>
          <p className="text-gray-400 mt-1 font-mono text-sm">// КОНВЕРТАЦИЯ, ИЗМЕНЕНИЕ РАЗМЕРА И СЖАТИЕ (ДО {MAX_FILES} ФАЙЛОВ)</p>
        </div>
        {images.length > 0 && (
          <span className="text-xs font-mono px-3 py-1 rounded-full" style={{ backgroundColor: 'rgba(0,255,136,0.1)', color: 'var(--color-primary)' }}>
            {images.length} / {MAX_FILES}
          </span>
        )}
      </div>

      {/* Upload + Settings */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 md:gap-6">
        {/* Upload Area */}
        <div className="lg:col-span-2 space-y-4">
          <div
            className={`glass rounded-xl p-6 transition-all cursor-pointer ${
              dragOver ? 'border-green-400 bg-green-400/10' : ''
            } ${images.length >= MAX_FILES ? 'opacity-50 pointer-events-none' : ''}`}
            onDrop={handleDrop}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleInputChange}
              className="hidden"
            />
            <div className="flex flex-col items-center gap-3 text-center">
              <Upload className="w-10 h-10 text-gray-400" />
              <div>
                <p className="text-gray-300 font-medium">
                  {images.length === 0
                    ? 'Загрузите изображения'
                    : images.length >= MAX_FILES
                      ? 'Достигнут лимит файлов'
                      : `Добавить ещё (${images.length}/${MAX_FILES})`}
                </p>
                <p className="text-gray-500 text-sm mt-1">
                  Перетащите файлы или нажмите для выбора • до {MAX_FILES} файлов
                </p>
              </div>
            </div>
          </div>

          {/* Thumbnails */}
          {images.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3">
              {images.map((item) => {
                const reduction = item.resultSize
                  ? Math.round((1 - item.resultSize / item.size) * 100)
                  : 0;
                return (
                  <motion.div
                    key={item.id}
                    layout
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="glass rounded-xl p-2 relative group"
                  >
                    <button
                      onClick={() => removeImage(item.id)}
                      className="absolute top-1 right-1 z-10 w-6 h-6 rounded-full bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                    <div className="aspect-square rounded-lg overflow-hidden bg-white/5 mb-2 flex items-center justify-center">
                      <img loading="lazy" decoding="async" src={item.preview} alt="" className="max-w-full max-h-full object-contain" />
                    </div>
                    <div className="text-[10px] text-gray-400 truncate font-mono">{item.file.name}</div>
                    <div className="text-[10px] text-gray-500 font-mono">{formatFileSize(item.size)}</div>
                    {item.status === 'converting' && (
                      <div className="absolute inset-0 bg-black/40 rounded-xl flex items-center justify-center">
                        <RefreshCw className="w-5 h-5 animate-spin" style={{ color: 'var(--color-primary)' }} />
                      </div>
                    )}
                    {item.status === 'done' && (
                      <div className="mt-1 flex items-center gap-1">
                        <CheckCircle className="w-3 h-3" style={{ color: 'var(--color-primary)' }} />
                        <span className="text-[10px] font-mono" style={{ color: 'var(--color-primary)' }}>
                          {reduction > 0 ? `↓${reduction}%` : `↑${Math.abs(reduction)}%`}
                        </span>
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div className="mt-1 flex items-center gap-1">
                        <AlertCircle className="w-3 h-3 text-red-400" />
                        <span className="text-[10px] font-mono text-red-400">Ошибка</span>
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>

        {/* Settings */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Settings className="w-4 h-4" />
              Настройки
            </h2>
            <div className="space-y-4">
              {/* Format */}
              <div>
                <label className="text-xs text-gray-400 mb-2 block">Формат</label>
                <div className="grid grid-cols-3 gap-2">
                  {(Object.keys(formatLabels) as OutputFormat[]).map((fmt) => (
                    <button
                      key={fmt}
                      onClick={() => setSettings(prev => ({ ...prev, format: fmt }))}
                      className="py-2 px-3 rounded-lg text-sm font-mono transition-colors"
                      style={settings.format === fmt
                        ? { backgroundColor: 'var(--color-primary)', color: '#000' }
                        : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#9ca3af' }
                      }
                    >
                      {formatLabels[fmt]}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quality */}
              {settings.format !== 'png' && (
                <div>
                  <label className="text-xs text-gray-400 mb-2 block">Качество: {settings.quality}%</label>
                  <input
                    type="range"
                    min="10"
                    max="100"
                    step="5"
                    value={settings.quality}
                    onChange={(e) => setSettings(prev => ({ ...prev, quality: Number(e.target.value) }))}
                    className="w-full"
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                </div>
              )}

              {/* Resize */}
              <div>
                <label className="text-xs text-gray-400 mb-2 flex items-center gap-2">
                  <Maximize className="w-3 h-3" />
                  Размер
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={settings.maxWidth || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, maxWidth: Number(e.target.value) }))}
                    placeholder="Ширина"
                    className="px-2 py-1.5 bg-white/5 border border-cyber-border rounded-lg text-gray-200 text-xs"
                  />
                  <input
                    type="number"
                    value={settings.maxHeight || ''}
                    onChange={(e) => setSettings(prev => ({ ...prev, maxHeight: Number(e.target.value) }))}
                    placeholder="Высота"
                    className="px-2 py-1.5 bg-white/5 border border-cyber-border rounded-lg text-gray-200 text-xs"
                  />
                </div>
                <label className="flex items-center gap-2 mt-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.maintainAspect}
                    onChange={(e) => setSettings(prev => ({ ...prev, maintainAspect: e.target.checked }))}
                    style={{ accentColor: 'var(--color-primary)' }}
                  />
                  <span className="text-[10px] text-gray-400">Сохранять пропорции</span>
                </label>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="space-y-2">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={convertAll}
              disabled={!images.length || isConverting}
              className="w-full py-3 px-4 rounded-xl font-mono font-bold transition-all neon-glow-pulse btn-scanline disabled:opacity-50 disabled:cursor-not-allowed"
              style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
            >
              {isConverting ? (
                <RefreshCw className="w-5 h-5 inline mr-2 animate-spin" />
              ) : (
                <RefreshCw className="w-5 h-5 inline mr-2" />
              )}
              {isConverting ? `КОНВЕРТАЦИЯ... (${doneCount}/${images.length})` : `КОНВЕРТИРОВАТЬ ВСЕ (${images.length})`}
            </motion.button>

            {doneCount > 0 && (
              <motion.button
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={downloadAll}
                className="w-full py-3 px-4 rounded-xl font-mono font-bold transition-all btn-scanline"
                style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
              >
                <Download className="w-5 h-5 inline mr-2" />
                СКАЧАТЬ ВСЕ ({doneCount})
              </motion.button>
            )}

            <button
              onClick={clearAll}
              className="w-full py-2 px-4 rounded-xl glass text-gray-400 hover:text-red-400 transition-colors text-sm font-mono"
            >
              <Trash className="w-4 h-4 inline mr-2" />
              ОЧИСТИТЬ
            </button>
          </div>

          {/* Summary */}
          {doneCount > 0 && (
            <div className="glass rounded-xl p-3 space-y-2">
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Исходный:</span>
                <span className="font-mono text-gray-300">{formatFileSize(totalOriginal)}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Результат:</span>
                <span className="font-mono" style={{ color: 'var(--color-primary)' }}>{formatFileSize(totalResult)}</span>
              </div>
              <div className="h-px bg-white/10" />
              <div className="flex justify-between text-xs">
                <span className="text-gray-400">Экономия:</span>
                <span
                  className="font-mono font-bold"
                  style={{ color: totalReduction > 0 ? 'var(--color-primary)' : '#ff3b30' }}
                >
                  {totalReduction > 0 ? '↓' : '↑'} {Math.abs(totalReduction)}%
                </span>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
