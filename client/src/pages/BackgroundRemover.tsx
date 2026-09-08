import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Download, Trash2, Image as ImageIcon, Loader2, Sliders, Paintbrush, Eye, EyeOff, Zap } from 'lucide-react';

// U2Net preprocessing: resize to 320x320, normalize to [0,1], CHW format
function preprocess(canvas: HTMLCanvasElement): Float32Array {
  const size = 320;
  const temp = document.createElement('canvas');
  temp.width = size;
  temp.height = size;
  const ctx = temp.getContext('2d')!;
  ctx.drawImage(canvas, 0, 0, size, size);
  const data = ctx.getImageData(0, 0, size, size).data;

  const input = new Float32Array(3 * size * size);
  for (let i = 0; i < size * size; i++) {
    input[i] = data[i * 4] / 255;           // R
    input[size * size + i] = data[i * 4 + 1] / 255; // G
    input[2 * size * size + i] = data[i * 4 + 2] / 255; // B
  }
  return input;
}

// Post-process: resize mask back to original size
function postprocess(maskData: Float32Array, origW: number, origH: number): Uint8Array {
  const size = 320;
  const temp = document.createElement('canvas');
  temp.width = size;
  temp.height = size;
  const ctx = temp.getContext('2d')!;
  const imgData = ctx.createImageData(size, size);

  for (let i = 0; i < size * size; i++) {
    const v = Math.max(0, Math.min(1, maskData[i])) * 255;
    imgData.data[i * 4] = v;
    imgData.data[i * 4 + 1] = v;
    imgData.data[i * 4 + 2] = v;
    imgData.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(imgData, 0, 0);

  // Scale mask to original size
  const out = document.createElement('canvas');
  out.width = origW;
  out.height = origH;
  const outCtx = out.getContext('2d')!;
  outCtx.drawImage(temp, 0, 0, origW, origH);
  const scaled = outCtx.getImageData(0, 0, origW, origH).data;

  const mask = new Uint8Array(origW * origH);
  for (let i = 0; i < origW * origH; i++) {
    // U2Net: high value = foreground (keep), low value = background (remove)
    mask[i] = scaled[i * 4] > 128 ? 0 : 1;
  }
  return mask;
}

async function runU2Net(imageData: ImageData, w: number, h: number): Promise<Uint8Array> {
  const ort = await import('onnxruntime-web');
  ort.env.wasm.numThreads = 1;

  // Preprocess
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.putImageData(imageData, 0, 0);
  const input = preprocess(canvas);

  // Create tensor
  const tensor = new ort.Tensor('float32', input, [1, 3, 320, 320]);

  // Load model
  const session = await ort.InferenceSession.create('/models/RMBG-2.0/model.onnx', {
    executionProviders: ['wasm'],
  });

  // Run inference
  const feeds: Record<string, any> = {};
  feeds[session.inputNames[0]] = tensor;
  const results = await session.run(feeds);
  const output = results[session.outputNames[0]].data as Float32Array;

  // Post-process
  return postprocess(output, w, h);
}

// Canvas-based fallback (flood-fill)
function removeBgCanvas(imageData: ImageData, tolerance: number): Uint8Array {
  const { width, height, data } = imageData;
  const visited = new Uint8Array(width * height);
  const mask = new Uint8Array(width * height);

  const samples: [number, number, number][] = [];
  for (let x = 0; x < width; x += Math.max(1, Math.floor(width / 20))) {
    samples.push([data[x * 4], data[x * 4 + 1], data[x * 4 + 2]]);
    const bi = ((height - 1) * width + x) * 4;
    samples.push([data[bi], data[bi + 1], data[bi + 2]]);
  }
  for (let y = 0; y < height; y += Math.max(1, Math.floor(height / 20))) {
    samples.push([data[y * width * 4], data[y * width * 4 + 1], data[y * width * 4 + 2]]);
    const ri = (y * width + width - 1) * 4;
    samples.push([data[ri], data[ri + 1], data[ri + 2]]);
  }

  const bgR = samples.reduce((s, c) => s + c[0], 0) / samples.length;
  const bgG = samples.reduce((s, c) => s + c[1], 0) / samples.length;
  const bgB = samples.reduce((s, c) => s + c[2], 0) / samples.length;
  const bg: [number, number, number] = [bgR, bgG, bgB];

  const dist = (a: [number, number, number]) => Math.sqrt((a[0] - bg[0]) ** 2 + (a[1] - bg[1]) ** 2 + (a[2] - bg[2]) ** 2);

  const queue: number[] = [];
  for (let x = 0; x < width; x++) { queue.push(x, (height - 1) * width + x); }
  for (let y = 1; y < height - 1; y++) { queue.push(y * width, y * width + width - 1); }

  for (const idx of queue) {
    if (!visited[idx]) {
      visited[idx] = 1;
      const i = idx * 4;
      if (dist([data[i], data[i + 1], data[i + 2]]) <= tolerance) mask[idx] = 1;
    }
  }

  let head = 0;
  while (head < queue.length) {
    const idx = queue[head++];
    if (!mask[idx]) continue;
    const px = idx % width;
    const py = Math.floor(idx / width);
    for (const ni of [px > 0 ? idx - 1 : -1, px < width - 1 ? idx + 1 : -1, py > 0 ? idx - width : -1, py < height - 1 ? idx + width : -1]) {
      if (ni >= 0 && !visited[ni]) {
        visited[ni] = 1;
        const ni4 = ni * 4;
        if (dist([data[ni4], data[ni4 + 1], data[ni4 + 2]]) <= tolerance) {
          mask[ni] = 1;
          queue.push(ni);
        }
      }
    }
  }
  return mask;
}

function applyMask(sourceData: ImageData, mask: Uint8Array): ImageData {
  const out = new Uint8ClampedArray(sourceData.data);
  for (let i = 0; i < mask.length; i++) {
    if (mask[i] === 1) out[i * 4 + 3] = 0;
  }
  return new ImageData(out, sourceData.width, sourceData.height);
}

type BrushMode = 'erase' | 'restore';
type Mode = 'ai' | 'canvas';

export default function BackgroundRemover() {
  const [original, setOriginal] = useState<string | null>(null);
  const [result, setResult] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState('');
  const [mode, setMode] = useState<Mode>('ai');
  const [tolerance, setTolerance] = useState(30);
  const [error, setError] = useState('');
  const [dragOver, setDragOver] = useState(false);
  const [showMask, setShowMask] = useState(false);
  const [brushMode, setBrushMode] = useState<BrushMode>('erase');
  const [brushSize, setBrushSize] = useState(20);
  const [isPainting, setIsPainting] = useState(false);
  const [maskData, setMaskData] = useState<Uint8Array | null>(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  const inputRef = useRef<HTMLInputElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const sourceDataRef = useRef<ImageData | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement>(null);

  const updateMaskPreview = (mask: Uint8Array, w: number, h: number) => {
    const canvas = maskCanvasRef.current;
    if (!canvas) return;
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d')!;
    const imgData = ctx.createImageData(w, h);
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] === 1) {
        imgData.data[i * 4] = 255;
        imgData.data[i * 4 + 3] = 120;
      }
    }
    ctx.putImageData(imgData, 0, 0);
  };

  const maskToResult = useCallback((mask: Uint8Array, src: ImageData) => {
    const resultData = applyMask(src, mask);
    const c = document.createElement('canvas');
    c.width = src.width;
    c.height = src.height;
    c.getContext('2d')!.putImageData(resultData, 0, 0);
    c.toBlob((blob) => {
      if (blob) {
        if (result) URL.revokeObjectURL(result);
        setResult(URL.createObjectURL(blob));
      }
    }, 'image/png');
    setMaskData(mask);
    updateMaskPreview(mask, src.width, src.height);
  }, [result]);

  const processFile = useCallback(async (file: File) => {
    if (!file.type.startsWith('image/')) { setError('Загрузите изображение'); return; }
    if (file.size > 20 * 1024 * 1024) { setError('Файл слишком большой'); return; }
    setError('');
    setResult(null);
    setMaskData(null);
    setShowMask(false);

    const reader = new FileReader();
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string;
      setOriginal(dataUrl);

      const img = new window.Image();
      img.onload = async () => {
        imgRef.current = img;
        setImgSize({ w: img.width, h: img.height });

        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d')!;
        ctx.drawImage(img, 0, 0);
        const srcData = ctx.getImageData(0, 0, img.width, img.height);
        sourceDataRef.current = srcData;

        if (mode === 'ai') {
          setProcessing(true);
          setProgress('Загрузка модели U2Net...');
          try {
            const mask = await runU2Net(srcData, img.width, img.height);
            maskToResult(mask, srcData);
            setProgress('');
          } catch (err: any) {
            setError('Ошибка нейросети: ' + (err?.message || 'Неизвестная') + '. Попробуйте режим "Кисть"');
          }
          setProcessing(false);
        } else {
          setProcessing(true);
          setTimeout(() => {
            const mask = removeBgCanvas(srcData, tolerance);
            maskToResult(mask, srcData);
            setProcessing(false);
          }, 50);
        }
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  }, [mode, tolerance, maskToResult]);

  const applyBrush = useCallback((clientX: number, clientY: number) => {
    const canvas = maskCanvasRef.current;
    if (!canvas || !maskData) return;

    const rect = canvas.getBoundingClientRect();
    const scaleX = imgSize.w / rect.width;
    const scaleY = imgSize.h / rect.height;
    const x = Math.round((clientX - rect.left) * scaleX);
    const y = Math.round((clientY - rect.top) * scaleY);
    const r = Math.round(brushSize * scaleX / 2);

    const ctx = canvas.getContext('2d')!;
    if (brushMode === 'erase') {
      ctx.globalCompositeOperation = 'source-over';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,0,0,120)';
      ctx.fill();
    } else {
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255,255,255,1)';
      ctx.fill();
    }
    ctx.globalCompositeOperation = 'source-over';

    const newMask = new Uint8Array(maskData);
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (dx * dx + dy * dy <= r * r) {
          const px = x + dx;
          const py = y + dy;
          if (px >= 0 && px < imgSize.w && py >= 0 && py < imgSize.h) {
            newMask[py * imgSize.w + px] = brushMode === 'erase' ? 1 : 0;
          }
        }
      }
    }
    setMaskData(newMask);
  }, [maskData, imgSize, brushSize, brushMode]);

  const applyBrushResult = useCallback(() => {
    if (!maskData || !sourceDataRef.current) return;
    maskToResult(maskData, sourceDataRef.current);
  }, [maskData, maskToResult]);

  const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) processFile(f); }, [processFile]);
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => { const f = e.target.files?.[0]; if (f) processFile(f); }, [processFile]);
  const handleDownload = useCallback(() => { if (!result) return; const a = document.createElement('a'); a.href = result; a.download = 'no-bg.png'; document.body.appendChild(a); a.click(); document.body.removeChild(a); }, [result]);
  const handleClear = useCallback(() => { if (result) URL.revokeObjectURL(result); setOriginal(null); setResult(null); setError(''); setMaskData(null); setShowMask(false); imgRef.current = null; sourceDataRef.current = null; if (inputRef.current) inputRef.current.value = ''; }, [result]);

  const handlePointerDown = useCallback((e: React.PointerEvent) => { setIsPainting(true); applyBrush(e.clientX, e.clientY); }, [applyBrush]);
  const handlePointerMove = useCallback((e: React.PointerEvent) => { if (isPainting) applyBrush(e.clientX, e.clientY); }, [isPainting, applyBrush]);
  const handlePointerUp = useCallback(() => { if (isPainting) { setIsPainting(false); applyBrushResult(); } }, [isPainting, applyBrushResult]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-mono" style={{ color: 'var(--color-primary)' }}>Удаление фона</h1>
          <p className="text-sm font-mono mt-1" style={{ color: '#6b7280' }}>Нейросеть U2Net + ручная кисть для точной доработки</p>
        </div>
        {original && (
          <button onClick={handleClear} className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono transition-colors hover:bg-white/5" style={{ color: '#ff6b6b', border: '1px solid rgba(255,107,107,0.2)' }}>
            <Trash2 className="w-4 h-4" /> Очистить
          </button>
        )}
      </div>

      {!original && (
        <>
          {/* Mode selection */}
          <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
            <span className="text-xs font-mono" style={{ color: '#8a8aa0' }}>РЕЖИМ</span>
            <button onClick={() => setMode('ai')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
              style={mode === 'ai' ? { background: 'rgba(0,255,136,0.15)', color: 'var(--color-primary)', border: '1px solid rgba(0,255,136,0.3)' } : { color: '#5a5a70', border: '1px solid transparent' }}>
              <Zap className="w-3.5 h-3.5" /> Нейросеть
            </button>
            <button onClick={() => setMode('canvas')} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
              style={mode === 'canvas' ? { background: 'rgba(0,212,255,0.15)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' } : { color: '#5a5a70', border: '1px solid transparent' }}>
              <Paintbrush className="w-3.5 h-3.5" /> Flood-fill
            </button>
            {mode === 'ai' && <span className="text-xs font-mono" style={{ color: '#5a5a70' }}>Лучшее для людей • первая загрузка ~15 сек</span>}
            {mode === 'canvas' && <span className="text-xs font-mono" style={{ color: '#5a5a70' }}>Мгновенно • для однотонного фона</span>}
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
            onClick={() => inputRef.current?.click()}
            className="border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all"
            style={{ borderColor: dragOver ? 'var(--color-primary)' : 'rgba(255,255,255,0.1)', background: dragOver ? 'color-mix(in srgb, var(--color-primary) 5%, transparent)' : 'rgba(255,255,255,0.02)' }}
          >
            <Upload className="w-12 h-12 mb-4" style={{ color: dragOver ? 'var(--color-primary)' : '#4a4a60' }} />
            <p className="text-sm font-mono mb-1" style={{ color: '#c0c0d0' }}>Перетащите изображение сюда</p>
            <p className="text-xs font-mono" style={{ color: '#5a5a70' }}>PNG, JPG, WebP • до 20MB</p>
            <input ref={inputRef} type="file" accept="image/*" onChange={handleFileChange} className="hidden" />
          </div>
        </>
      )}

      {error && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="p-3 rounded-xl" style={{ background: 'rgba(255,59,48,0.08)', border: '1px solid rgba(255,59,48,0.2)' }}>
          <p className="text-sm font-mono" style={{ color: '#ff6b6b' }}>{error}</p>
        </motion.div>
      )}

      {/* Controls */}
      {original && (
        <div className="space-y-3">
          {mode === 'canvas' && (
            <div className="flex items-center gap-4 p-4 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Sliders className="w-4 h-4 flex-shrink-0" style={{ color: '#5a5a70' }} />
              <span className="text-xs font-mono flex-shrink-0" style={{ color: '#8a8aa0' }}>ТОЧНОСТЬ</span>
              <input type="range" min={5} max={100} value={tolerance} onChange={e => setTolerance(+e.target.value)} className="flex-1 accent-green-500" />
              <span className="text-xs font-mono w-8 text-center" style={{ color: 'var(--color-primary)' }}>{tolerance}</span>
              <button onClick={() => { if (sourceDataRef.current) { setProcessing(true); setTimeout(() => { const mask = removeBgCanvas(sourceDataRef.current!, tolerance); maskToResult(mask, sourceDataRef.current!); setProcessing(false); }, 50); } }}
                className="px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#000' }}>Применить</button>
            </div>
          )}

          {/* Brush tools */}
          {maskData && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Paintbrush className="w-4 h-4" style={{ color: '#5a5a70' }} />
              <span className="text-xs font-mono" style={{ color: '#8a8aa0' }}>КИСТЬ</span>
              <button onClick={() => setBrushMode('erase')} className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                style={brushMode === 'erase' ? { background: 'rgba(255,59,48,0.2)', color: '#ff6b6b', border: '1px solid rgba(255,59,48,0.4)' } : { color: '#5a5a70', border: '1px solid transparent' }}>Стереть (E)</button>
              <button onClick={() => setBrushMode('restore')} className="px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                style={brushMode === 'restore' ? { background: 'rgba(0,255,136,0.2)', color: '#00ff88', border: '1px solid rgba(0,255,136,0.4)' } : { color: '#5a5a70', border: '1px solid transparent' }}>Восстановить (R)</button>
              <span className="text-xs font-mono" style={{ color: '#5a5a70' }}>Размер</span>
              <input type="range" min={5} max={100} value={brushSize} onChange={e => setBrushSize(+e.target.value)} className="w-24 accent-green-500" />
              <span className="text-xs font-mono w-6 text-center" style={{ color: 'var(--color-primary)' }}>{brushSize}</span>
              <div className="flex-1" />
              <button onClick={() => setShowMask(!showMask)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono transition-all"
                style={showMask ? { background: 'rgba(255,0,0,0.15)', color: '#ff6b6b', border: '1px solid rgba(255,0,0,0.3)' } : { color: '#5a5a70', border: '1px solid rgba(255,255,255,0.06)' }}>
                {showMask ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />} Маска
              </button>
            </div>
          )}
        </div>
      )}

      <AnimatePresence>
        {original && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="px-4 py-3 flex items-center gap-2" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <ImageIcon className="w-4 h-4" style={{ color: '#5a5a70' }} />
                <span className="text-xs font-mono" style={{ color: '#8a8aa0' }}>ОРИГИНАЛ</span>
              </div>
              <div className="p-4 flex items-center justify-center min-h-[300px]" style={{ background: 'repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px' }}>
                <img loading="lazy" decoding="async" src={original} alt="Original" className="max-w-full max-h-[400px] rounded-xl object-contain" />
              </div>
            </div>

            <div className="rounded-2xl overflow-hidden" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div className="px-4 py-3 flex items-center justify-between" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <div className="flex items-center gap-2">
                  <ImageIcon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                  <span className="text-xs font-mono" style={{ color: 'var(--color-primary)' }}>РЕЗУЛЬТАТ</span>
                </div>
                {result && (
                  <button onClick={handleDownload} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all hover:scale-105" style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', color: '#000' }}>
                    <Download className="w-3.5 h-3.5" /> PNG
                  </button>
                )}
              </div>
              <div className="p-4 flex items-center justify-center min-h-[300px] relative"
                style={{ background: 'repeating-conic-gradient(rgba(255,255,255,0.03) 0% 25%, transparent 0% 50%) 0 0 / 20px 20px', cursor: maskData ? 'crosshair' : 'default' }}
                onPointerDown={maskData ? handlePointerDown : undefined}
                onPointerMove={maskData ? handlePointerMove : undefined}
                onPointerUp={handlePointerUp}
                onPointerLeave={handlePointerUp}>
                {processing ? (
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-10 h-10 animate-spin" style={{ color: 'var(--color-primary)' }} />
                    <p className="text-sm font-mono" style={{ color: '#8a8aa0' }}>{progress || 'Обработка...'}</p>
                  </div>
                ) : result ? (
                  <div className="relative">
                    <img loading="lazy" decoding="async" src={result} alt="Result" className="max-w-full max-h-[400px] rounded-xl object-contain" />
                    {showMask && maskData && (
                      <canvas ref={maskCanvasRef} className="absolute inset-0 w-full h-full pointer-events-none rounded-xl" style={{ objectFit: 'contain' }} />
                    )}
                  </div>
                ) : (
                  <p className="text-sm font-mono" style={{ color: '#5a5a70' }}>Результат появится здесь</p>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
