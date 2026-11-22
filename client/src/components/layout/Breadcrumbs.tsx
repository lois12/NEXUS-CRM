import { Link, useLocation } from 'react-router-dom';
import { ChevronRight, Home } from 'lucide-react';
import { navGroups } from './Sidebar';

/** Под-страницы, которые дополняют крошку (id-сегменты пропускаем) */
const SUB_ROUTE_NAMES: Record<string, string> = {
  participants: 'Участники',
};

/** Маршруты, которых нет в левом меню */
const FALLBACK_NAMES: Record<string, string> = {
  vacations: 'Отпуска',
  'checkin-scanner': 'Сканер QR',
};

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteMeta {
  to: string;
  label: string;
  groupLabel: string;
  groupTo: string;
}

/** Индекс из реального меню: маршрут → { раздел, страница } */
const routeIndex = new Map<string, RouteMeta>();
for (const g of navGroups) {
  for (const c of g.children) {
    if (!routeIndex.has(c.to)) {
      routeIndex.set(c.to, {
        to: c.to,
        label: c.label,
        groupLabel: g.label,
        groupTo: g.children[0]?.to || '/',
      });
    }
  }
}

function matchRoute(pathname: string): RouteMeta | null {
  let best: RouteMeta | null = null;
  for (const [to, meta] of routeIndex) {
    if (pathname === to || pathname.startsWith(to + '/')) {
      if (!best || to.length > best.to.length) best = meta;
    }
  }
  return best;
}

export default function Breadcrumbs() {
  const location = useLocation();
  const pathParts = location.pathname.split('/').filter(Boolean);

  if (pathParts.length === 0) return null;
  // прячем на публичных и auth-страницах
  if (
    location.pathname.startsWith('/login') ||
    location.pathname.startsWith('/reg/') ||
    location.pathname.startsWith('/control') ||
    location.pathname.startsWith('/opros/') ||
    location.pathname.startsWith('/survey/') ||
    location.pathname.startsWith('/quiz/') ||
    location.pathname.startsWith('/kviz/') ||
    location.pathname.startsWith('/w/') ||
    location.pathname.startsWith('/lists/public/') ||
    location.pathname.startsWith('/qr-confirm') ||
    location.pathname.startsWith('/pd-request')
  ) {
    return null;
  }

  const crumbs: { path: string; label: string; home?: boolean }[] = [
    { path: '/', label: 'Главная', home: true },
  ];

  const meta = matchRoute(location.pathname);
  if (meta) {
    // раздел меню — если не дублирует название страницы
    if (meta.groupLabel !== meta.label) {
      crumbs.push({ path: meta.groupTo, label: meta.groupLabel });
    }
    crumbs.push({ path: meta.to, label: meta.label });
    // хвост вложенных путей: /registrations/:id/participants → Участники (id пропускаем)
    const rest = location.pathname.slice(meta.to.length).split('/').filter(Boolean);
    for (const seg of rest) {
      if (UUID_RE.test(seg) || /^\d+$/.test(seg)) continue;
      crumbs.push({ path: `${meta.to}/${seg}`, label: SUB_ROUTE_NAMES[seg] || seg.replace(/-/g, ' ') });
    }
  } else {
    const label = FALLBACK_NAMES[pathParts[0]] || pathParts[0];
    crumbs.push({ path: '/' + pathParts[0], label });
  }

  return (
    <nav className="flex items-center gap-1.5 mb-4 font-mono text-xs">
      {crumbs.map((crumb, i) => {
        const isLast = i === crumbs.length - 1;
        return (
          <div key={crumb.path + i} className="flex items-center gap-1.5">
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
                {crumb.home ? <Home className="w-3 h-3" /> : crumb.label}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
