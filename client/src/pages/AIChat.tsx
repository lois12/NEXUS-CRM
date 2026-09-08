import { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Bot, User, Loader2, Copy, CheckCheck, Sparkles, Plus, MessageSquare, X, Menu } from 'lucide-react';
import { formatTimeKR } from '../utils/timezone';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatSession {
  id: string;
  title: string;
  messages: Message[];
  createdAt: Date;
}

const SYSTEM_PROMPT = 'Ты — полезный AI-ассистент CRM-системы NEXUS. Отвечай кратко и по делу на русском языке. Помогай с рабочими задачами: тексты, идеи, аналитика, советы.';

const STORAGE_KEY = 'nexus_ai_chats';

function loadChats(): ChatSession[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      return JSON.parse(saved).map((c: any) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        messages: c.messages.map((m: any) => ({ ...m, timestamp: new Date(m.timestamp) })),
      }));
    }
  } catch {}
  return [];
}

function saveChats(chats: ChatSession[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(chats.slice(-20)));
  } catch {}
}

function generateTitle(messages: Message[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser) return 'Новый чат';
  const text = firstUser.content.slice(0, 40);
  return text.length < firstUser.content.length ? text + '...' : text;
}

export default function AIChat() {
  const [chats, setChats] = useState<ChatSession[]>(loadChats);
  const [activeChatId, setActiveChatId] = useState<string>(() => {
    const saved = loadChats();
    return saved.length > 0 ? saved[saved.length - 1].id : '';
  });
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const activeChat = chats.find(c => c.id === activeChatId);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeChat?.messages.length]);

  useEffect(() => {
    saveChats(chats);
  }, [chats]);

  const createNewChat = () => {
    const newChat: ChatSession = {
      id: Date.now().toString(),
      title: 'Новый чат',
      messages: [],
      createdAt: new Date(),
    };
    setChats(prev => [...prev, newChat]);
    setActiveChatId(newChat.id);
    inputRef.current?.focus();
  };

  const deleteChat = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setChats(prev => {
      const filtered = prev.filter(c => c.id !== id);
      if (activeChatId === id) {
        setActiveChatId(filtered.length > 0 ? filtered[filtered.length - 1].id : '');
      }
      return filtered;
    });
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading || !activeChatId) return;

    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: text,
      timestamp: new Date(),
    };

    // Update chat with user message
    setChats(prev => prev.map(c => {
      if (c.id !== activeChatId) return c;
      const updated = { ...c, messages: [...c.messages, userMsg] };
      updated.title = generateTitle(updated.messages);
      return updated;
    }));
    setInput('');
    setIsLoading(true);

    try {
      const token = localStorage.getItem('nexus_token') || sessionStorage.getItem('nexus_token');
      const chat = chats.find(c => c.id === activeChatId);
      const history = chat ? chat.messages.slice(-20) : [];

      const res = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          messages: [
            { role: 'system', content: SYSTEM_PROMPT },
            ...history.map(m => ({ role: m.role, content: m.content })),
            { role: 'user', content: text },
          ],
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Ошибка запроса');
      }

      const data = await res.json();
      const assistantMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: data.reply,
        timestamp: new Date(),
      };
      setChats(prev => prev.map(c => c.id !== activeChatId ? c : { ...c, messages: [...c.messages, assistantMsg] }));
    } catch (err: any) {
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Ошибка: ${err.message}`,
        timestamp: new Date(),
      };
      setChats(prev => prev.map(c => c.id !== activeChatId ? c : { ...c, messages: [...c.messages, errorMsg] }));
    } finally {
      setIsLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const copyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Create first chat if none
  if (chats.length === 0) {
    const firstChat: ChatSession = { id: '1', title: 'Новый чат', messages: [], createdAt: new Date() };
    setChats([firstChat]);
    setActiveChatId('1');
  }

  return (
    <div className="flex h-dvh-minus-header cyber-grid gap-3 relative">
      {/* Mobile sidebar toggle */}
      <button onClick={() => setShowSidebar(!showSidebar)}
        className="md:hidden fixed top-20 left-3 z-50 p-2 rounded-lg glass"
        style={{ border: '1px solid rgba(255,255,255,0.1)' }}>
        <Menu className="w-5 h-5 text-gray-400" />
      </button>

      {/* Chat list sidebar */}
      <div className={`${showSidebar ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 absolute md:relative z-40 w-56 flex-shrink-0 glass rounded-xl flex flex-col overflow-hidden transition-transform h-full`}>
        <div className="p-3 border-b border-white/5">
          <button onClick={createNewChat}
            className="w-full flex items-center gap-2 px-3 py-2.5 rounded-lg font-mono text-xs font-medium transition-all"
            style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
            <Plus className="w-4 h-4" />
            НОВЫЙ ЧАТ
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {chats.slice().reverse().map(chat => (
            <button key={chat.id} onClick={() => { setActiveChatId(chat.id); setShowSidebar(false); }}
              className={`w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left text-xs transition-all group ${
                chat.id === activeChatId ? 'bg-white/10 text-white' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'
              }`}>
              <MessageSquare className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="flex-1 truncate font-mono">{chat.title}</span>
              {chats.length > 1 && (
                <button onClick={(e) => deleteChat(chat.id, e)}
                  className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all flex-shrink-0">
                  <X className="w-3 h-3" />
                </button>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Main chat area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h1 className="text-xl font-bold font-mono neon-text flex items-center gap-2" style={{ color: 'var(--color-primary)' }}>
              <Sparkles className="w-5 h-5" />
              AI АССИСТЕНТ
            </h1>
            <p className="text-gray-500 font-mono text-xs">// GIGACHAT 3 ULTRA</p>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto glass rounded-xl p-4 space-y-4 min-h-0">
          {!activeChat || activeChat.messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <Bot className="w-14 h-14 mb-4 opacity-30" />
              <p className="font-mono text-sm mb-1">// AI АССИСТЕНТ</p>
              <p className="text-xs text-center max-w-md mb-6">Задайте вопрос, попросите написать текст или помочь с задачей</p>
              <div className="grid grid-cols-2 gap-2 max-w-md w-full">
                {['Напиши пост про туризм', 'Придумай 5 идей для reels', 'Переведи на английский', 'Составь план мероприятия'].map((q) => (
                  <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    className="text-left text-xs font-mono p-3 rounded-lg bg-white/5 border border-white/5 hover:border-white/15 text-gray-400 hover:text-gray-200 transition-all">
                    {q}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              <AnimatePresence>
                {activeChat.messages.map((msg) => (
                  <motion.div key={msg.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                    className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    {msg.role === 'assistant' && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-glow)' }}>
                        <Bot className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                      </div>
                    )}
                    <div className={`max-w-[80%] group relative ${msg.role === 'user' ? 'order-1' : ''}`}>
                      <div className={`px-4 py-2.5 rounded-2xl text-sm whitespace-pre-wrap ${
                        msg.role === 'user' ? 'rounded-br-md' : 'rounded-bl-md bg-white/5 border border-white/5'
                      }`} style={msg.role === 'user' ? { backgroundColor: 'var(--color-primary)', color: '#000' } : {}}>
                        {msg.content}
                      </div>
                      <div className="flex items-center gap-2 mt-1 px-1">
                        <span className="text-[10px] text-gray-600 font-mono">
                          {formatTimeKR(msg.timestamp)}
                        </span>
                        {msg.role === 'assistant' && (
                          <button onClick={() => copyText(msg.id, msg.content)}
                            className="opacity-0 group-hover:opacity-100 transition-opacity text-gray-500 hover:text-gray-300">
                            {copiedId === msg.id ? <CheckCheck className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          </button>
                        )}
                      </div>
                    </div>
                    {msg.role === 'user' && (
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 bg-white/10 order-2">
                        <User className="w-3.5 h-3.5 text-gray-300" />
                      </div>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>

              {isLoading && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--color-glow)' }}>
                    <Bot className="w-3.5 h-3.5" style={{ color: 'var(--color-primary)' }} />
                  </div>
                  <div className="px-4 py-2.5 rounded-2xl rounded-bl-md bg-white/5 border border-white/5">
                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-primary)' }} />
                  </div>
                </motion.div>
              )}
            </>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input */}
        <div className="mt-3 glass rounded-xl p-3">
          <div className="flex gap-2">
            <textarea ref={inputRef} value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={handleKeyDown}
              placeholder="// ЗАДАЙТЕ ВОПРОС..." rows={1}
              className="flex-1 bg-white/5 border border-white/10 rounded-lg px-4 py-2.5 text-sm text-gray-200 placeholder-gray-600 resize-none focus:outline-none focus:border-white/20 font-mono"
              style={{ minHeight: '42px', maxHeight: '100px' }}
              onInput={(e) => { const t = e.currentTarget; t.style.height = 'auto'; t.style.height = Math.min(t.scrollHeight, 100) + 'px'; }} />
            <button onClick={sendMessage} disabled={!input.trim() || isLoading}
              className="px-4 py-2.5 rounded-lg font-bold transition-all disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              style={{ backgroundColor: 'var(--color-primary)', color: '#000' }}>
              {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
