import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { QRCodeSVG, QRCodeCanvas } from 'qrcode.react';
import {
  QrCode,
  Link,
  Mail,
  Phone,
  FileText,
  Download,
  Copy,
  Check,
  History,
  Trash,
} from 'lucide-react';
import { formatTimeKR } from '../utils/timezone';

type QRType = 'url' | 'text' | 'email' | 'phone';

interface QRHistoryItem {
  id: string;
  content: string;
  type: QRType;
  createdAt: Date;
}

const typeIcons: Record<QRType, typeof Link> = {
  url: Link,
  text: FileText,
  email: Mail,
  phone: Phone,
};

const typeLabels: Record<QRType, string> = {
  url: 'Ссылка',
  text: 'Текст',
  email: 'Email',
  phone: 'Телефон',
};

export default function QRGenerator() {
  const [content, setContent] = useState('');
  const [qrType, setQrType] = useState<QRType>('url');
  const [fgColor, setFgColor] = useState('#00ff88');
  const [bgColor, setBgColor] = useState('#0a0a0f');
  const [size, setSize] = useState(256);
  const [history, setHistory] = useState<QRHistoryItem[]>([]);
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLDivElement>(null);

  const generateQR = () => {
    if (!content.trim()) return;

    const newItem: QRHistoryItem = {
      id: Date.now().toString(),
      content,
      type: qrType,
      createdAt: new Date(),
    };

    setHistory((prev) => [newItem, ...prev.slice(0, 9)]);
  };

  const downloadQR = (format: 'png' | 'svg') => {
    if (format === 'png') {
      const canvas = canvasRef.current?.querySelector('canvas');
      if (canvas) {
        const url = canvas.toDataURL('image/png');
        const link = document.createElement('a');
        link.download = `qr-${Date.now()}.png`;
        link.href = url;
        link.click();
      }
    } else {
      const svg = canvasRef.current?.querySelector('svg');
      if (svg) {
        const svgData = new XMLSerializer().serializeToString(svg);
        const blob = new Blob([svgData], { type: 'image/svg+xml' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.download = `qr-${Date.now()}.svg`;
        link.href = url;
        link.click();
        URL.revokeObjectURL(url);
      }
    }
  };

  const copyToClipboard = () => {
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const clearHistory = () => {
    setHistory([]);
  };

  const getPlaceholder = () => {
    switch (qrType) {
      case 'url':
        return '// HTTPS://NEXUS-LINK.NET/...';
      case 'email':
        return '// OPERATOR@NEXUS-CORP.NET';
      case 'phone':
        return '// +7-XXX-XXX-XX-XX';
      default:
        return '// ВВЕДИТЕ ДАННЫЕ ДЛЯ КОДИРОВАНИЯ...';
    }
  };

  return (
    <div className="space-y-6 cyber-grid">
      {/* Header */}
      <div>
        <h1 className="text-2xl md:text-3xl font-bold font-mono neon-text flex items-center gap-3" style={{ color: 'var(--color-primary)' }}>
          <QrCode className="w-7 h-7 md:w-8 md:h-8" />
          QR-ГЕНЕРАТОР
        </h1>
        <p className="text-gray-400 mt-1 font-mono text-sm">// СОЗДАНИЕ QR-КОДОВ ДЛЯ ССЫЛОК, ТЕКСТА И КОНТАКТОВ</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
        {/* Generator */}
        <div className="space-y-4">
          {/* Type Selection */}
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Тип контента</h2>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {(Object.keys(typeIcons) as QRType[]).map((type) => {
                const Icon = typeIcons[type];
                return (
                  <button
                    key={type}
                    onClick={() => setQrType(type)}
                    className="flex flex-col items-center gap-2 p-3 rounded-lg transition-colors"
                    style={qrType === type
                      ? { backgroundColor: 'var(--color-primary)', color: '#000', border: '1px solid var(--color-primary)' }
                      : { backgroundColor: 'rgba(255,255,255,0.05)', color: '#9ca3af' }
                    }
                  >
                    <Icon className="w-5 h-5" />
                    <span className="text-xs">{typeLabels[type]}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Content Input */}
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Содержание</h2>
            <div className="relative">
              <input
                type="text"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder={getPlaceholder()}
                className="w-full px-4 py-3 bg-white/5 border border-cyber-border rounded-lg text-gray-200 placeholder-gray-500 pr-10"
              />
              <button
                onClick={copyToClipboard}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-200"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {/* Customization */}
          <div className="glass rounded-xl p-4">
            <h2 className="text-sm font-medium text-gray-300 mb-3">Настройки</h2>
            <div className="space-y-3">
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-400 w-24">Цвет</label>
                <input
                  type="color"
                  value={fgColor}
                  onChange={(e) => setFgColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                />
                <span className="text-sm text-gray-400">{fgColor}</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-400 w-24">Фон</label>
                <input
                  type="color"
                  value={bgColor}
                  onChange={(e) => setBgColor(e.target.value)}
                  className="w-10 h-10 rounded-lg cursor-pointer"
                />
                <span className="text-sm text-gray-400">{bgColor}</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm text-gray-400 w-24">Размер</label>
                <input
                  type="range"
                  min="128"
                  max="512"
                  step="32"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="flex-1"
                  style={{ accentColor: 'var(--color-primary)' }}
                />
                <span className="text-sm text-gray-400 w-12">{size}px</span>
              </div>
            </div>
          </div>

          {/* Generate Button */}
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={generateQR}
            disabled={!content.trim()}
            className="w-full py-3 px-4 rounded-xl font-mono font-bold transition-all neon-glow-pulse btn-scanline disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
          >
            <QrCode className="w-5 h-5 inline mr-2" />
            Сгенерировать QR-код
          </motion.button>
        </div>

        {/* Preview */}
        <div className="space-y-4">
          <div className="glass rounded-xl p-6">
            <h2 className="text-sm font-medium text-gray-300 mb-4">Предпросмотр</h2>
            <div
              ref={canvasRef}
              className="flex items-center justify-center p-8 rounded-lg bg-white/5 min-h-[300px]"
            >
              {content.trim() ? (
                <div className="flex flex-col items-center gap-4">
                  <QRCodeSVG
                    value={content}
                    size={size}
                    fgColor={fgColor}
                    bgColor={bgColor}
                    level="H"
                    includeMargin={true}
                  />
                  <QRCodeCanvas
                    value={content}
                    size={size}
                    fgColor={fgColor}
                    bgColor={bgColor}
                    level="H"
                    includeMargin={true}
                    className="hidden"
                  />
                </div>
              ) : (
                <div className="text-center text-gray-400">
                  <QrCode className="w-16 h-16 mx-auto mb-3 opacity-50" />
                  <p>Введите данные для генерации QR-кода</p>
                </div>
              )}
            </div>
          </div>

          {/* Download Buttons */}
          {content.trim() && (
            <div className="flex gap-3">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => downloadQR('png')}
                className="flex-1 py-2 px-4 rounded-xl glass text-gray-300 hover:text-gray-100 transition-colors font-mono text-sm"
              >
                <Download className="w-4 h-4 inline mr-2" />
                PNG
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => downloadQR('svg')}
                className="flex-1 py-2 px-4 rounded-xl font-mono text-sm transition-all"
                style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
              >
                <Download className="w-4 h-4 inline mr-2" />
                SVG
              </motion.button>
            </div>
          )}

          {/* History */}
          {history.length > 0 && (
            <div className="glass rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
                  <History className="w-4 h-4" />
                  История
                </h2>
                <button
                  onClick={clearHistory}
                  className="text-xs text-gray-400 hover:text-red-400"
                >
                  <Trash className="w-3 h-3 inline mr-1" />
                  Очистить
                </button>
              </div>
              <div className="space-y-2 max-h-[200px] overflow-y-auto">
                {history.map((item) => {
                  const Icon = typeIcons[item.type];
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setContent(item.content);
                        setQrType(item.type);
                      }}
                      className="w-full flex items-center gap-3 p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors text-left"
                    >
                      <Icon className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <span className="text-sm text-gray-200 truncate flex-1">{item.content}</span>
                      <span className="text-xs text-gray-400">
                        {formatTimeKR(item.createdAt)}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
