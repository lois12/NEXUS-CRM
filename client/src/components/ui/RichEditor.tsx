import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Placeholder from '@tiptap/extension-placeholder';
import { 
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, Quote, Code, Minus,
  Link as LinkIcon, Unlink, Highlighter,
  Undo, Redo, Palette
} from 'lucide-react';
import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface RichEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
}

const COLORS = [
  '#ffffff', '#e0e0e0', '#a0a0a0', '#6b7280',
  '#ff3b30', '#ff6b6b', '#ff9500', '#ffcc00',
  '#34c759', '#00ff88', '#00d4ff', '#007aff',
  '#5856d6', '#bf00ff', '#ff2d55', '#af52de',
];

function ToolbarButton({ onClick, isActive, children, title }: { 
  onClick: () => void; isActive?: boolean; children: React.ReactNode; title: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      className={`p-1.5 rounded-lg transition-all ${
        isActive 
          ? 'text-white' 
          : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'
      }`}
      style={isActive ? { 
        backgroundColor: 'var(--color-glow)', 
        color: 'var(--color-primary)',
        border: '1px solid var(--color-border)'
      } : {}}
    >
      {children}
    </button>
  );
}

function Divider() {
  return <div className="w-px h-6 bg-white/10 mx-1" />;
}

export default function RichEditor({ content, onChange, placeholder = '// ВВЕДИТЕ ТЕКСТ...' }: RichEditorProps) {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showLinkInput, setShowLinkInput] = useState(false);
  const [linkUrl, setLinkUrl] = useState('');
  const [colorType, setColorType] = useState<'text' | 'highlight'>('text');
  const colorRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLDivElement>(null);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [1, 2, 3] },
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { class: 'text-[var(--color-primary)] underline cursor-pointer' } }),
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      TextStyle,
      Color,
      Highlight.configure({ multicolor: true }),
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => onChange(editor.getHTML()),
    editorProps: {
      attributes: {
        class: 'prose prose-invert max-w-none min-h-[150px] px-4 py-3 focus:outline-none font-sans text-gray-200',
      },
    },
  });

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (colorRef.current && !colorRef.current.contains(e.target as Node)) setShowColorPicker(false);
      if (linkRef.current && !linkRef.current.contains(e.target as Node)) setShowLinkInput(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (!editor) return null;

  const addLink = () => {
    if (linkUrl) {
      editor.chain().focus().extendMarkRange('link').setLink({ href: linkUrl }).run();
      setLinkUrl('');
      setShowLinkInput(false);
    }
  };

  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--color-border)' }}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-0.5 p-2 bg-white/3 border-b border-white/5">
        {/* Undo / Redo */}
        <ToolbarButton onClick={() => editor.chain().focus().undo().run()} title="Отменить">
          <Undo className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().redo().run()} title="Повторить">
          <Redo className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Text format */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} title="Жирный">
          <Bold className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} title="Курсив">
          <Italic className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} title="Подчёркнутый">
          <UnderlineIcon className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} title="Зачёркнутый">
          <Strikethrough className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Headings */}
        <select
          onChange={(e) => {
            const val = e.target.value;
            if (val === 'p') editor.chain().focus().setParagraph().run();
            else editor.chain().focus().toggleHeading({ level: parseInt(val) as 1 | 2 | 3 }).run();
          }}
          value={editor.isActive('heading', { level: 1 }) ? '1' : editor.isActive('heading', { level: 2 }) ? '2' : editor.isActive('heading', { level: 3 }) ? '3' : 'p'}
          className="px-2 py-1 text-xs rounded-lg bg-white/5 text-gray-300 border-none cursor-pointer"
          style={{ fontFamily: 'JetBrains Mono, monospace' }}
        >
          <option value="p">Обычный</option>
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
        </select>

        <Divider />

        {/* Alignment */}
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} title="Влево">
          <AlignLeft className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} title="Центр">
          <AlignCenter className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} title="Вправо">
          <AlignRight className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} title="По ширине">
          <AlignJustify className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Lists */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} title="Маркированный список">
          <List className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} isActive={editor.isActive('orderedList')} title="Нумерованный список">
          <ListOrdered className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Block elements */}
        <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} title="Цитата">
          <Quote className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} title="Код">
          <Code className="w-4 h-4" />
        </ToolbarButton>
        <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Разделитель">
          <Minus className="w-4 h-4" />
        </ToolbarButton>

        <Divider />

        {/* Color */}
        <div className="relative" ref={colorRef}>
          <ToolbarButton 
            onClick={() => { setColorType('text'); setShowColorPicker(!showColorPicker); }} 
            title="Цвет текста"
          >
            <Palette className="w-4 h-4" />
          </ToolbarButton>
          <AnimatePresence>
            {showColorPicker && colorType === 'text' && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute top-full left-0 mt-2 p-3 glass-frost rounded-xl z-50 shadow-2xl w-[220px]"
                style={{ border: '1px solid var(--color-border)' }}
              >
                <p className="text-[10px] font-mono mb-2" style={{ color: 'var(--color-primary)' }}>// БЫСТРЫЙ ВЫБОР</p>
                <div className="grid grid-cols-8 gap-1.5 mb-3">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => { editor.chain().focus().setColor(color).run(); setShowColorPicker(false); }}
                      className="w-6 h-6 rounded-md border border-white/10 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <div className="h-px bg-white/10 my-2" />
                <p className="text-[10px] font-mono mb-2" style={{ color: 'var(--color-primary)' }}>// ПАЛИТРА</p>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value="#ffffff"
                    onChange={(e) => { editor.chain().focus().setColor(e.target.value).run(); }}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
                    title="Выбрать цвет"
                  />
                  <span className="text-xs text-gray-400 font-mono">Любой цвет</span>
                </div>
                <button
                  type="button"
                  onClick={() => { editor.chain().focus().unsetColor().run(); setShowColorPicker(false); }}
                  className="w-full text-xs py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  СБРОСИТЬ ЦВЕТ
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Highlight */}
        <div className="relative">
          <ToolbarButton 
            onClick={() => { setColorType('highlight'); setShowColorPicker(!showColorPicker); }} 
            isActive={editor.isActive('highlight')} 
            title="Выделение"
          >
            <Highlighter className="w-4 h-4" />
          </ToolbarButton>
          <AnimatePresence>
            {showColorPicker && colorType === 'highlight' && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute top-full left-0 mt-2 p-3 glass-frost rounded-xl z-50 shadow-2xl w-[220px]"
                style={{ border: '1px solid var(--color-border)' }}
              >
                <p className="text-[10px] font-mono mb-2" style={{ color: 'var(--color-primary)' }}>// БЫСТРЫЙ ВЫБОР</p>
                <div className="grid grid-cols-8 gap-1.5 mb-3">
                  {COLORS.map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => { editor.chain().focus().toggleHighlight({ color }).run(); setShowColorPicker(false); }}
                      className="w-6 h-6 rounded-md border border-white/10 hover:scale-110 transition-transform cursor-pointer"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
                <div className="h-px bg-white/10 my-2" />
                <p className="text-[10px] font-mono mb-2" style={{ color: 'var(--color-primary)' }}>// ПАЛИТРА</p>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    type="color"
                    value="#ffff00"
                    onChange={(e) => { editor.chain().focus().toggleHighlight({ color: e.target.value }).run(); }}
                    className="w-10 h-10 rounded-lg cursor-pointer bg-transparent border-none"
                    title="Выбрать цвет выделения"
                  />
                  <span className="text-xs text-gray-400 font-mono">Любой цвет</span>
                </div>
                <button
                  type="button"
                  onClick={() => { editor.chain().focus().unsetHighlight().run(); setShowColorPicker(false); }}
                  className="w-full text-xs py-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-gray-200 transition-colors"
                >
                  СБРОСИТЬ ВЫДЕЛЕНИЕ
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <Divider />

        {/* Link */}
        <div className="relative" ref={linkRef}>
          <ToolbarButton 
            onClick={() => { 
              if (editor.isActive('link')) {
                editor.chain().focus().unsetLink().run();
              } else {
                setShowLinkInput(!showLinkInput);
              }
            }} 
            isActive={editor.isActive('link')} 
            title="Ссылка"
          >
            {editor.isActive('link') ? <Unlink className="w-4 h-4" /> : <LinkIcon className="w-4 h-4" />}
          </ToolbarButton>
          <AnimatePresence>
            {showLinkInput && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute top-full left-0 mt-2 p-3 glass-frost rounded-xl z-50 shadow-2xl flex gap-2"
                style={{ border: '1px solid var(--color-border)', minWidth: '250px' }}
              >
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  className="flex-1 px-3 py-1.5 text-sm rounded-lg bg-white/5 border border-white/10 text-gray-200"
                  onKeyDown={(e) => e.key === 'Enter' && addLink()}
                />
                <button
                  type="button"
                  onClick={addLink}
                  className="px-3 py-1.5 text-sm rounded-lg font-mono font-bold"
                  style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}
                >
                  OK
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Editor */}
      <div className="bg-black/20">
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
