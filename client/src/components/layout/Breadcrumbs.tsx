import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';

const ROUTE_NAMES: Record<string, string> = {
  '': 'Главная',
  'content': 'Контент-план',
  'materials': 'Материалы',
  'analytics': 'Аналитика',
  'qr': 'QR-генератор',
  'images': 'Генератор изображений',
  'ideas': 'Идеи',
  'kanban': 'Задачи',
  'partners': 'Партнёры',
  'vacations': 'Отпуска',
  'inventory': 'Оборудование',
  'events': 'Мероприятия',
  'projects': 'Проекты',
  'knowledge': 'База знаний',
  'brandbank': 'Банк промо',
  'ping': 'IP Ping',
  'random': 'Рандомайзер',
  'weather': 'Погода',
  'image-converter': 'Конвертер',
  'ai-chat': 'AI Чат',
  'bg-remover': 'Удаление фона',
  'profile': 'Профиль',
  'users': 'Пользователи',
  'admin': 'Управление',
  'monitoring': 'Мониторинг',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);

  if (pathParts.length === 0) return null;

  const crumbs = [
    { path: '/', label: 'Главная' },
    ...pathParts.map((part, i) => ({
      path: '/' + pathParts.slice(0, i + 1).join('/'),
      label: ROUTE_NAMES[part] || part,
    })),
  ];

  return (
    <nav className="flex items-center gap-1 mb-4 font-mono text-xs">
      {crumbs.map((crumb, i) => (
        <div key={crumb.path} className="flex items-center gap-1">
          {i > 0 && <ChevronRight className="w-3 h-3" style={{ color: '#3a3a50' }} />}
          {i === crumbs.length - 1 ? (
            <span style={{ color: 'var(--color-primary)', opacity: 0.8 }}>{crumb.label}</span>
          ) : (
            <Link
              to={crumb.path}
              className="hover:opacity-100 transition-opacity"
              style={{ color: '#4a4a60', opacity: 0.7 }}
            >
              {i === 0 ? <Home className="w-3 h-3" /> : crumb.label}
            </Link>
          )}
        </div>
      ))}
    </nav>
  );
}
