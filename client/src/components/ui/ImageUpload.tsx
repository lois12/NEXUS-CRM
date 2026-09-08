import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, X, ZoomIn } from 'lucide-react';

interface ImageUploadProps {
  images: string[];
  onImagesChange: (images: string[]) => void;
  onFilesChange?: (files: File[]) => void;
  maxImages?: number;
  maxSizeMB?: number;
}

const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/bmp', 'image/svg+xml'];

export default function ImageUpload({ images, onImagesChange, onFilesChange, maxImages = 10, maxSizeMB = 5 }: ImageUploadProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [zoomImage, setZoomImage] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const filesRef = useRef<File[]>([]);

  const processFiles = useCallback(async (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    const remaining = maxImages - images.length;
    const filesToProcess = fileArray.slice(0, remaining);

    if (filesToProcess.length === 0) return;

    setUploadingCount(filesToProcess.length);
    const newImages: string[] = [];
    const newFiles: File[] = [];

    for (const file of filesToProcess) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        continue;
      }
      if (file.size > maxSizeMB * 1024 * 1024) {
        continue;
      }

      const base64 = await fileToBase64(file);
      newImages.push(base64);
      newFiles.push(file);
    }

    onImagesChange([...images, ...newImages]);
    filesRef.current = [...filesRef.current, ...newFiles];
    if (onFilesChange) onFilesChange(filesRef.current);
    setUploadingCount(0);
  }, [images, maxImages, maxSizeMB, onImagesChange, onFilesChange]);

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files) {
      processFiles(e.dataTransfer.files);
    }
  }, [processFiles]);

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      processFiles(e.target.files);
      e.target.value = '';
    }
  }, [processFiles]);

  const removeImage = (index: number) => {
    const newImages = [...images];
    newImages.splice(index, 1);
    onImagesChange(newImages);
    filesRef.current.splice(index, 1);
    if (onFilesChange) onFilesChange(filesRef.current);
  };

  return (
    <div className="space-y-3">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed transition-all cursor-pointer ${
          isDragging 
            ? 'border-[var(--color-primary)] bg-[var(--color-glow)]' 
            : 'border-white/10 hover:border-white/20 bg-white/5'
        }`}
      >
        <div className="flex flex-col items-center justify-center py-6 px-4">
          {uploadingCount > 0 ? (
            <motion.div
              className="flex flex-col items-center gap-3"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
            >
              {/* Nexus mini spinner */}
              <div className="relative w-10 h-10">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ border: '2px solid transparent', borderTopColor: 'var(--color-primary)' }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  className="absolute inset-1.5 rounded-full"
                  style={{ border: '2px solid transparent', borderBottomColor: 'var(--color-accent)' }}
                  animate={{ rotate: -360 }}
                  transition={{ duration: 1.2, repeat: Infinity, ease: 'linear' }}
                />
              </div>
              <span className="font-mono text-xs" style={{ color: 'var(--color-primary)' }}>
                // ЗАГРУЗКА {uploadingCount} ФАЙЛОВ...
              </span>
            </motion.div>
          ) : (
            <>
              <Upload className="w-8 h-8 mb-2 text-gray-500" />
              <p className="font-mono text-sm text-gray-400">
                {isDragging ? '// ОТПУСТИТЕ ФАЙЛЫ' : '// ПЕРЕТАЩИТЕ ИЛИ НАЖМИТЕ'}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                JPG, PNG, GIF, WebP, BMP, SVG • до {maxSizeMB}MB • макс {maxImages} файлов
              </p>
            </>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>

      {/* Image preview grid */}
      {images.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
          <AnimatePresence>
            {images.map((img, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="relative aspect-square rounded-lg overflow-hidden group"
                style={{ border: '1px solid rgba(255,255,255,0.06)' }}
              >
                <img loading="lazy" decoding="async" src={img} draggable="false"
                  alt={`Upload ${index + 1}`}
                  className="w-full h-full object-cover select-none"
                />
                {/* Overlay */}
                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setZoomImage(img); }}
                    className="p-1.5 rounded-lg bg-white/20 text-white hover:bg-white/30 transition-colors"
                  >
                    <ZoomIn className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeImage(index); }}
                    className="p-1.5 rounded-lg bg-red-500/50 text-white hover:bg-red-500/80 transition-colors"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* Zoom modal */}
      <AnimatePresence>
        {zoomImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 flex items-center justify-center z-[150] p-4"
            style={{ backgroundColor: 'rgba(0, 0, 0, 0.9)', backdropFilter: 'blur(8px)' }}
            onClick={() => setZoomImage(null)}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              className="relative max-w-[90vw] max-h-[90vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <img loading="lazy" decoding="async" src={zoomImage} alt="Zoom" className="max-w-full max-h-[85vh] object-contain rounded-lg" />
              <button
                onClick={() => setZoomImage(null)}
                className="absolute -top-3 -right-3 w-8 h-8 rounded-full flex items-center justify-center transition-colors"
                style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
