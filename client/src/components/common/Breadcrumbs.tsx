import { useLocation, Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Главная',
  '/content': 'Контент-план',
  '/materials': 'Материалы',
  '/analytics': 'Аналитика',
  '/qr': 'QR-генератор',
  '/images': 'Генератор изображений',
  '/ideas': 'Идеи',
  '/kanban': 'Задачи',
  '/partners': 'Партнёры',
  '/vacations': 'Отпуска',
  '/inventory': 'Оборудование',
  '/events': 'Мероприятия',
  '/projects': 'Проекты',
  '/knowledge': 'База знаний',
  '/brandbank': 'Банк промо',
  '/users': 'Пользователи',
};

export default function Breadcrumbs() {
  const location = useLocation();
  const path = location.pathname;

  if (path === '/') return null;

  const label = ROUTE_LABELS[path];
  if (!label) return null;

  return (
    <nav className="flex items-center gap-1.5 mb-3 font-mono text-xs">
      <Link to="/" className="transition-colors hover:underline" style={{ color: 'var(--color-text-tertiary)' }}>
        Главная
      </Link>
      <ChevronRight className="w-3 h-3" style={{ color: 'var(--color-text-tertiary)' }} />
      <span style={{ color: 'var(--color-primary)' }}>{label}</span>
    </nav>
  );
}
