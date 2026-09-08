import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ImageIcon,
  Sparkles,
  Download,
  RefreshCw,
  Wand2,
  History,
  Trash,
  Loader2,
  Languages,
  AlertCircle,
  Camera,
  Paintbrush,
  Pencil,
  Sunset,
  Ghost,
  Crown,
  Zap,
  Music,
  Globe,
  Droplets,
  Grid3X3,
  Settings2,
  Minus,
  BookOpen,
  Sun,
  Star,
  Heart,
  Smile,
} from 'lucide-react';

interface GeneratedImage {
  id: string;
  promptRu: string;
  promptEn: string;
  url: string;
  style: string;
  size: string;
  createdAt: Date;
  status: 'loading' | 'ready' | 'error';
}

// Simple Russian to English dictionary for common words
const ruToEnDict: Record<string, string> = {
  'кот': 'cat', 'кошка': 'cat', 'собака': 'dog', 'пёс': 'dog',
  'город': 'city', 'ночь': 'night', 'день': 'day', 'небо': 'sky',
  'лес': 'forest', 'море': 'sea', 'гора': 'mountain', 'река': 'river',
  'дом': 'house', 'здание': 'building', 'улица': 'street', 'дорога': 'road',
  'девушка': 'girl', 'парень': 'boy', 'мужчина': 'man', 'женщина': 'woman',
  'дракон': 'dragon', 'робот': 'robot', 'машина': 'car', 'самолёт': 'airplane',
  'космос': 'space', 'звезда': 'star', 'луна': 'moon', 'солнце': 'sun',
  'огонь': 'fire', 'вода': 'water', 'ветер': 'wind', 'земля': 'earth',
  'красивый': 'beautiful', 'большой': 'big', 'маленький': 'small',
  'новый': 'new', 'старый': 'old', 'быстрый': 'fast', 'медленный': 'slow',
  'свет': 'light', 'тень': 'shadow', 'тьма': 'darkness',
  'меч': 'sword', 'щит': 'shield', 'замок': 'castle', 'трон': 'throne',
  'неон': 'neon', 'голография': 'hologram', 'киберпанк': 'cyberpunk',
  'футуристический': 'futuristic', 'технологии': 'technology',
  'искусственный интеллект': 'artificial intelligence', 'ИИ': 'AI',
  'портрет': 'portrait', 'пейзаж': 'landscape', 'натюрморт': 'still life',
  'абстракция': 'abstract', 'минимализм': 'minimalism',
  'фантастика': 'science fiction', 'фэнтези': 'fantasy',
  'ужасы': 'horror', 'комедия': 'comedy', 'драма': 'drama',
  'рыба': 'fish', 'птица': 'bird', 'цветок': 'flower', 'дерево': 'tree',
  'сердце': 'heart', 'глаза': 'eyes', 'рука': 'hand', 'лицо': 'face',
  'кровь': 'blood', 'дождь': 'rain', 'снег': 'snow', 'буря': 'storm',
  'радуга': 'rainbow', 'облако': 'cloud', 'молния': 'lightning',
  'пиксель': 'pixel', 'глитч': 'glitch', 'ретро': 'retro', 'винтаж': 'vintage',
  'тёмный': 'dark', 'яркий': 'bright', 'красный': 'red', 'синий': 'blue',
  'зелёный': 'green', 'жёлтый': 'yellow', 'чёрный': 'black', 'белый': 'white',
  'золотой': 'gold', 'серебряный': 'silver',
  'аниме': 'anime', 'манга': 'manga', 'комикс': 'comic',
  'реалистичный': 'realistic', 'мультяшный': 'cartoon', 'карандаш': 'pencil',
  'масло': 'oil painting', 'акварель': 'watercolor', 'цифровой': 'digital art',
  '3D': '3D render', 'фотореализм': 'photorealistic',
};

function translateRuToEn(text: string): string {
  let result = text.toLowerCase();
  
  // Sort by length descending to match longer phrases first
  const sortedKeys = Object.keys(ruToEnDict).sort((a, b) => b.length - a.length);
  
  for (const ru of sortedKeys) {
    const en = ruToEnDict[ru];
    result = result.replace(new RegExp(ru, 'gi'), en);
  }
  
  // Capitalize first letter
  return result.charAt(0).toUpperCase() + result.slice(1);
}

const stylePrompts: Record<string, string> = {
  realistic: 'photorealistic, highly detailed, 8k, professional photography, sharp focus',
  anime: 'anime style, manga, vibrant colors, detailed illustration, cel shading',
  cyberpunk: 'cyberpunk style, neon lights, dark atmosphere, futuristic, sci-fi, rain reflections',
  cartoon: 'cartoon style, colorful, playful, illustration, 2D, clean lines',
  watercolor: 'watercolor painting, soft edges, flowing colors, artistic, paper texture',
  fantasy: 'fantasy art, magical, ethereal glow, epic, detailed, concept art',
  pixel: 'pixel art, retro style, 16-bit, game art, nostalgic',
  oil_painting: 'oil painting, classical art, rich textures, brush strokes, renaissance style',
  dark_gothic: 'dark gothic art, moody, dramatic lighting, shadows, mysterious, horror elements',
  minimalism: 'minimalist design, clean, simple shapes, negative space, modern, flat colors',
  steampunk: 'steampunk style, brass gears, victorian era, mechanical, vintage technology',
  vaporwave: 'vaporwave aesthetic, retro 80s, pink purple gradient, glitch art, nostalgic',
  pencil_sketch: 'pencil sketch, hand drawn, black and white, detailed linework, paper texture',
  comic: 'comic book style, bold outlines, halftone dots, dynamic, action art',
  impressionism: 'impressionist painting, loose brushwork, light and color, Monet style',
  synthwave: 'synthwave, retro futuristic, neon grid, sunset, 80s aesthetic, chrome',
  clay: 'claymation style, 3D render, plasticine, cute, tactile, stop motion feel',
  stained_glass: 'stained glass window, colorful mosaic, religious art style, lead lines',
  ukiyo_e: 'ukiyo-e japanese woodblock print, traditional, waves, nature, flat perspective',
  pop_art: 'pop art style, Andy Warhol inspired, bold colors, dots, high contrast',
};

const styleOptions = [
  { value: 'realistic', label: 'РЕАЛИЗМ', icon: <Camera className="w-5 h-5" />, desc: 'Фотореализм 8K' },
  { value: 'anime', label: 'АНИМЕ', icon: <Paintbrush className="w-5 h-5" />, desc: 'Японская анимация' },
  { value: 'cyberpunk', label: 'КИБЕРПАНК', icon: <Zap className="w-5 h-5" />, desc: 'Неон и футуризм' },
  { value: 'synthwave', label: 'SYNTHWAVE', icon: <Music className="w-5 h-5" />, desc: 'Ретро 80-е' },
  { value: 'fantasy', label: 'ФЭНТЕЗИ', icon: <Crown className="w-5 h-5" />, desc: 'Магия и эпос' },
  { value: 'dark_gothic', label: 'ГОТИКА', icon: <Ghost className="w-5 h-5" />, desc: 'Тёмная эстетика' },
  { value: 'watercolor', label: 'АКВАРЕЛЬ', icon: <Droplets className="w-5 h-5" />, desc: 'Мягкие краски' },
  { value: 'oil_painting', label: 'МАСЛО', icon: <Paintbrush className="w-5 h-5" />, desc: 'Классическая живопись' },
  { value: 'pixel', label: 'ПИКСЕЛИ', icon: <Grid3X3 className="w-5 h-5" />, desc: 'Ретро-игра' },
  { value: 'steampunk', label: 'СТИМПАНК', icon: <Settings2 className="w-5 h-5" />, desc: 'Механика и пар' },
  { value: 'vaporwave', label: 'VAPORWAVE', icon: <Sunset className="w-5 h-5" />, desc: 'Эстетика 80-х' },
  { value: 'minimalism', label: 'МИНИМАЛИЗМ', icon: <Minus className="w-5 h-5" />, desc: 'Чистый дизайн' },
  { value: 'comic', label: 'КОМИКС', icon: <BookOpen className="w-5 h-5" />, desc: 'Книжный стиль' },
  { value: 'pencil_sketch', label: 'КАРАНДАШ', icon: <Pencil className="w-5 h-5" />, desc: 'Рисунок от руки' },
  { value: 'impressionism', label: 'ИМПРЕССИОНИЗМ', icon: <Sun className="w-5 h-5" />, desc: 'Свет и цвет' },
  { value: 'ukiyo_e', label: 'УКИЁ-Э', icon: <Globe className="w-5 h-5" />, desc: 'Японская гравюра' },
  { value: 'pop_art', label: 'ПОП-АРТ', icon: <Star className="w-5 h-5" />, desc: 'Уорхолл' },
  { value: 'clay', label: 'ПЛАСТИЛИН', icon: <Heart className="w-5 h-5" />, desc: 'Пластилиновый мир' },
  { value: 'stained_glass', label: 'ВИТРАЖ', icon: <Sparkles className="w-5 h-5" />, desc: 'Цветное стекло' },
  { value: 'cartoon', label: 'МУЛЬТФИЛЬМ', icon: <Smile className="w-5 h-5" />, desc: 'Яркий мультяшный' },
];

const sizeOptions = [
  { value: '512x512', label: '512', desc: 'Быстро' },
  { value: '768x768', label: '768', desc: 'Средне' },
  { value: '1024x1024', label: '1024', desc: 'Детально' },
];

export default function ImageGenerator() {
  const [prompt, setPrompt] = useState('');
  const [translatedPrompt, setTranslatedPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);
  const [selectedImage, setSelectedImage] = useState<GeneratedImage | null>(null);
  const [style, setStyle] = useState('cyberpunk');
  const [size, setSize] = useState('512x512');
  const [showTranslation, setShowTranslation] = useState(false);
  const [error, setError] = useState('');

  // Auto-translate when prompt changes
  useEffect(() => {
    if (prompt.trim()) {
      const timer = setTimeout(() => {
        const translated = translateRuToEn(prompt);
        setTranslatedPrompt(translated);
        setShowTranslation(true);
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setTranslatedPrompt('');
      setShowTranslation(false);
    }
  }, [prompt]);

  const generateImage = async () => {
    if (!prompt.trim()) return;

    setError('');
    setIsGenerating(true);

    const finalPrompt = `${translatedPrompt || prompt}, ${stylePrompts[style]}`;

    const newImage: GeneratedImage = {
      id: Date.now().toString(),
      promptRu: prompt,
      promptEn: finalPrompt,
      url: '',
      style,
      size,
      createdAt: new Date(),
      status: 'loading',
    };

    setGeneratedImages((prev) => [newImage, ...prev]);
    setSelectedImage(newImage);

    try {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token');
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ prompt: translatedPrompt || prompt, style }),
      });

      if (res.status === 429) {
        const err = await res.json();
        throw new Error(err.error || 'Лимит генерации исчерпан');
      }

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка генерации');
      }

      const data = await res.json();
      const imageUrl = data.image;

      if (data.remaining !== undefined && data.remaining >= 0) {
        console.log(`Осталось генераций: ${data.remaining} из ${data.limit}`);
      }

      setGeneratedImages((prev) =>
        prev.map((item) =>
          item.id === newImage.id ? { ...item, url: imageUrl, status: 'ready' } : item
        )
      );
      setSelectedImage((prev) => prev?.id === newImage.id ? { ...prev, url: imageUrl, status: 'ready' } : prev);
      setIsGenerating(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Ошибка генерации';
      setGeneratedImages((prev) =>
        prev.map((item) =>
          item.id === newImage.id ? { ...item, status: 'error' } : item
        )
      );
      setSelectedImage((prev) => prev?.id === newImage.id ? { ...prev, status: 'error' } : prev);
      setError(msg);
      setIsGenerating(false);
    }
  };

  const downloadImage = async () => {
    if (!selectedImage || selectedImage.status !== 'ready' || !selectedImage.url) return;
    try {
      if (selectedImage.url.startsWith('data:')) {
        // Base64 image — convert to blob
        const res = await fetch(selectedImage.url);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `nexus-${selectedImage.id}.webp`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      } else {
        const response = await fetch(selectedImage.url);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `nexus-${selectedImage.id}.png`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    } catch {
      console.error('Failed to download');
    }
  };

  const deleteImage = (id: string) => {
    setGeneratedImages((prev) => prev.filter((img) => img.id !== id));
    if (selectedImage?.id === id) {
      setSelectedImage(null);
    }
  };

  return (
    <div className="space-y-6 cyber-grid">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
          <Sparkles className="w-7 h-7 md:w-8 md:h-8" />
          ГЕНЕРАТОР ИЗОБРАЖЕНИЙ
        </h1>
        <p className="text-gray-400 mt-1 font-mono text-sm">// НЕЙРОСЕТЬ СОЗДАСТ ИЗОБРАЖЕНИЕ ПО ОПИСАНИЮ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Controls */}
        <div className="space-y-4">
          {/* Prompt Input */}
          <div className="glass rounded-xl p-4 neon-border-animated">
            <h2 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
              <Wand2 className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              ОПИШИТЕ ИЗОБРАЖЕНИЕ
            </h2>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="// КОРОТКО ОПИШИТЕ ЧТО ВЫ ХОТИТЕ УВИДЕТЬ..."
              className="w-full px-4 py-3 bg-white/5 border rounded-lg text-gray-200 h-28 resize-none"
              style={{ borderColor: 'var(--color-border)' }}
            />
            
            {/* Translation preview */}
            {showTranslation && translatedPrompt && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 p-3 rounded-lg bg-white/5 border"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Languages className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
                  <span className="text-xs font-mono" style={{ color: 'var(--color-primary)' }}>
                    // АВТОПЕРЕВОД ДЛЯ НЕЙРОСЕТИ
                  </span>
                </div>
                <p className="text-sm text-gray-300 font-mono">{translatedPrompt}</p>
              </motion.div>
            )}
          </div>

          {/* Style Selection */}
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">СТИЛЬ ГЕНЕРАЦИИ</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {styleOptions.map((opt) => (
                <motion.button
                  key={opt.value}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setStyle(opt.value)}
                  className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-all text-center ${
                    style === opt.value
                      ? 'border shadow-lg'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                  }`}
                  style={style === opt.value ? {
                    backgroundColor: 'var(--color-glow)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-primary)',
                    boxShadow: `0 0 12px var(--color-glow)`
                  } : {}}
                >
                  <div style={{ color: style === opt.value ? 'var(--color-primary)' : '#9ca3af' }}>
                    {opt.icon}
                  </div>
                  <div className="text-[10px] font-bold leading-tight">{opt.label}</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Size Selection */}
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">РАЗМЕР</h2>
            <div className="flex gap-2">
              {sizeOptions.map((opt) => (
                <motion.button
                  key={opt.value}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSize(opt.value)}
                  className={`flex-1 py-3 px-4 rounded-lg text-center transition-all ${
                    size === opt.value
                      ? 'border shadow-lg'
                      : 'bg-white/5 text-gray-400 hover:bg-white/10 border border-transparent'
                  }`}
                  style={size === opt.value ? {
                    backgroundColor: 'var(--color-glow)',
                    borderColor: 'var(--color-border)',
                    color: 'var(--color-primary)',
                  } : {}}
                >
                  <div className="text-lg font-bold font-mono">{opt.label}</div>
                  <div className="text-xs opacity-60">{opt.desc}</div>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Error */}
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 text-red-400" />
              <span className="text-sm text-red-400">{error}</span>
            </motion.div>
          )}

          {/* Generate Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={generateImage}
            disabled={!prompt.trim() || isGenerating}
            className="w-full py-4 px-4 rounded-lg font-bold text-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed neon-glow-pulse"
            style={{
              backgroundColor: 'var(--color-primary)',
              color: '#000'
            }}
          >
            {isGenerating ? (
              <span className="flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" />
                ГЕНЕРАЦИЯ...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-2">
                <Sparkles className="w-5 h-5" />
                СГЕНЕРИРОВАТЬ
              </span>
            )}
          </motion.button>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-4 neon-border-animated">
            <h2 className="text-sm font-medium text-gray-300 mb-4 flex items-center gap-2">
              <ImageIcon className="w-4 h-4" style={{ color: 'var(--color-primary)' }} />
              РЕЗУЛЬТАТ
            </h2>
            <div className="relative aspect-square rounded-lg overflow-hidden bg-black/30">
              {selectedImage ? (
                <>
                  {selectedImage.status === 'loading' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <div className="relative">
                          <Loader2 className="w-16 h-16 mx-auto mb-4 animate-spin" style={{ color: 'var(--color-primary)' }} />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-8 h-8 rounded-full" style={{ backgroundColor: 'var(--color-glow)' }} />
                          </div>
                        </div>
                        <p className="text-sm font-mono" style={{ color: 'var(--color-primary)' }}>
                          // НЕЙРОСЕТЬ ГЕНЕРИРУЕТ...
                        </p>
                        <p className="text-xs text-gray-500 mt-1">GigaChat 3 Ultra — генерация (15-60 сек)</p>
                      </div>
                    </div>
                  )}
                  <img loading="lazy" decoding="async" src={selectedImage.url}
                    alt={selectedImage.promptRu}
                    className={`w-full h-full object-contain transition-opacity duration-500 ${
                      selectedImage.status === 'loading' ? 'opacity-0' : 'opacity-100'
                    }`}
                  />
                  {selectedImage.status === 'error' && (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center">
                        <AlertCircle className="w-12 h-12 mx-auto mb-3 text-red-400" />
                        <p className="text-red-400">Ошибка генерации</p>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-gray-500">
                  <div className="text-center">
                    <ImageIcon className="w-20 h-20 mx-auto mb-4 opacity-30" />
                    <p className="font-mono text-sm">// ИЗОБРАЖЕНИЕ ЗДЕСЬ</p>
                    <p className="text-xs mt-1">Введите промпт и нажмите "Сгенерировать"</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Action Buttons */}
          {selectedImage && selectedImage.status === 'ready' && (
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={downloadImage}
                className="flex-1 py-3 px-4 rounded-lg font-medium flex items-center justify-center gap-2 transition-all"
                style={{
                  backgroundColor: 'var(--color-primary)',
                  color: '#000'
                }}
              >
                <Download className="w-4 h-4" />
                СКАЧАТЬ PNG
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  setPrompt(selectedImage.promptRu);
                  generateImage();
                }}
                className="py-3 px-4 rounded-lg bg-white/5 border text-gray-400 hover:text-gray-200 transition-all"
                style={{ borderColor: 'var(--color-border)' }}
              >
                <RefreshCw className="w-4 h-4" />
              </motion.button>
            </div>
          )}

          {/* Prompt Info */}
          {selectedImage && (
            <div className="glass rounded-xl p-4">
              <h3 className="text-xs font-mono mb-2" style={{ color: 'var(--color-primary)' }}>
                // ИСПОЛЬЗОВАННЫЙ ПРОМПТ
              </h3>
              <p className="text-xs text-gray-400 font-mono break-all">{selectedImage.promptEn}</p>
            </div>
          )}

          {/* History */}
          {generatedImages.length > 0 && (
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  ИСТОРИЯ ({generatedImages.length})
                </h2>
                <button
                  onClick={() => {
                    setGeneratedImages([]);
                    setSelectedImage(null);
                  }}
                  className="text-xs text-gray-400 hover:text-red-400 transition-colors"
                >
                  <Trash className="w-3 h-3 inline mr-1" />
                  ОЧИСТИТЬ
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2 max-h-[200px] overflow-y-auto">
                <AnimatePresence>
                  {generatedImages.map((img) => (
                    <motion.button
                      key={img.id}
                      layout
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      exit={{ opacity: 0, scale: 0.9 }}
                      onClick={() => setSelectedImage(img)}
                      className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                        selectedImage?.id === img.id
                          ? 'shadow-lg'
                          : 'border-transparent hover:border-gray-600'
                      }`}
                      style={selectedImage?.id === img.id ? { borderColor: 'var(--color-primary)' } : {}}
                    >
                      {img.status === 'loading' ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <Loader2 className="w-6 h-6 animate-spin" style={{ color: 'var(--color-primary)' }} />
                        </div>
                      ) : img.status === 'error' ? (
                        <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                          <AlertCircle className="w-6 h-6 text-red-400" />
                        </div>
                      ) : (
                        <img loading="lazy" decoding="async" src={img.url} alt={img.promptRu} className="w-full h-full object-cover" />
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteImage(img.id);
                        }}
                        className="absolute top-1 right-1 p-1 rounded-full bg-black/70 text-gray-400 hover:text-red-400 opacity-0 hover:opacity-100 transition-opacity"
                      >
                        <Trash className="w-3 h-3" />
                      </button>
                    </motion.button>
                  ))}
                </AnimatePresence>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
