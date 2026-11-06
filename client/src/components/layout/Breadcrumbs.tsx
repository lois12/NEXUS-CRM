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
  'doc-converter': 'Конвертер документов',
  'photo-collage': 'Коллаж из фото',
  'short-links': 'Сокращатель ссылок',
  'ai-chat': 'AI Чат',
  'bg-remover': 'Удаление фона',
  'profile': 'Профиль',
  'users': 'Пользователи',
  'admin': 'Управление',
  'monitoring': 'Мониторинг',
  'surveys': 'Опросы',
  'lists': 'Списки',
  'widgets': 'Виджеты',
  'registrations': 'Регистрации',
  'participants': 'Участники',
  'checkin-scanner': 'Сканер QR',
  'aurora': 'Аврора',
  'control': 'CONTROL',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);

  if (pathParts.length === 0) return null;
  // hide on public / auth surfaces
  if (
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/reg/') ||
    location.pathname.startsWith('/control') ||
    location.pathname.startsWith('/opros/') ||
    location.pathname.startsWith('/survey/') ||
    location.pathname.startsWith('/w/') ||
    location.pathname.startsWith('/lists/public/') ||
    location.pathname.startsWith('/qr-confirm')
  ) {
    return null;
  }

  const crumbs = [
    { path: '/', label: 'Главная' },
    ...pathParts.map((part, i) => ({
      path: '/' + pathParts.slice(0, i + 1).join('/'),
      label: ROUTE_NAMES[part] || part,
    })),
  ];

  return (
    <nav className="flex items-center gap-1.5 mb-4 font-mono text-xs">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <div key={crumb.path} className="flex items-center gap-1.5">
            {i > 0 && (
              <ChevronRight className="w-3 h-3" style={{ color: 'var(--color-text-tertiary)', opacity: 0.5 }} />
            )}
            {isLast ? (
              <span className="nx-eyebrow">{crumb.label}</span>
            ) : (
              <Link
                to={crumb.path}
                className="hover:opacity-100 transition-opacity"
                style={{ color: 'var(--color-text-tertiary)', opacity: 0.6 }}
              >
                {i === 0 ? <Home className="w-3 h-3" /> : crumb.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
