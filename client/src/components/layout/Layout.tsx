import { useEffect, useRef, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import Header from './Header';
import Breadcrumbs from './Breadcrumbs';
import PresenceToasts from '../common/PresenceToasts';

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);

  // переход между страницами — всегда сверху: без этого новая страница
  // открывается на старом смещении скролла и «прыгает» картинкой
  useEffect(() => {
    mainRef.current?.scrollTo(0, 0);
  }, [location.pathname]);

  return (
    <div className="flex h-dvh overflow-hidden">
      <PresenceToasts />
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0 nx-stage">
        <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main ref={mainRef} className="flex-1 overflow-y-auto px-3 md:px-6">
          <div className="max-w-[1600px] mx-auto py-6 md:py-8">
            <Breadcrumbs />
            {/* без exit-анимации: AnimatePresence mode="wait" давал пустой кадр между страницами */}
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
