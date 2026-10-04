/** App pages that can be put into technical maintenance (path → label). */
export const MAINT_PAGES: { path: string; label: string }[] = [
  { path: '/', label: 'Обзор' },
  { path: '/kanban', label: 'Задачи' },
  { path: '/profile', label: 'Профиль' },
  { path: '/content', label: 'Контент-план' },
  { path: '/analytics', label: 'Аналитика' },
  { path: '/partners', label: 'Партнёры' },
  { path: '/brandbank', label: 'Банк промо' },
  { path: '/events', label: 'Мероприятия' },
  { path: '/projects', label: 'Проекты' },
  { path: '/qr', label: 'QR-генератор' },
  { path: '/image-converter', label: 'Конвертер изображений' },
  { path: '/doc-converter', label: 'Конвертер документов' },
  { path: '/photo-collage', label: 'Коллаж из фото' },
  { path: '/short-links', label: 'Сокращатель ссылок' },
  { path: '/bg-remover', label: 'Удаление фона' },
  { path: '/random', label: 'Рандомайзер' },
  { path: '/ping', label: 'IP Ping' },
  { path: '/ai-chat', label: 'AI Чат' },
  { path: '/images', label: 'Генератор изображений' },
  { path: '/aurora', label: 'Северное сияние' },
  { path: '/knowledge', label: 'База знаний' },
  { path: '/ideas', label: 'Идеи' },
  { path: '/registrations', label: 'Регистрация' },
  { path: '/widgets', label: 'Виджеты' },
  { path: '/lists', label: 'Списки' },
  { path: '/weather', label: 'Погода' },
  { path: '/inventory', label: 'Инвентарь' },
  { path: '/materials', label: 'Файлы' },
];

/** Is this pathname under maintenance? (prefix match so /doc-converter/x and /reg work) */
export function isPathMaintained(pathname: string, pages: string[]): boolean {
  return pages.some((p) => {
    if (p === '/') return pathname === '/';
    return pathname === p || pathname.startsWith(p + '/');
  });
}
