import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Sidebar from './Sidebar';
import Header from './Header';
import Breadcrumbs from './Breadcrumbs';

const pageVariants = {
  initial: {
    opacity: 0,
    y: 12,
  },
  animate: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.2,
      ease: 'easeOut',
    },
  },
  exit: {
    opacity: 0,
    y: -6,
    transition: {
      duration: 0.1,
      ease: 'easeIn',
    },
  },
};

export default function Layout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="flex h-dvh overflow-hidden">
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <div className="flex-shrink-0" style={{ height: 'env(safe-area-inset-top, 0px)' }} />
        <Header onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} />
        <main className="flex-1 overflow-y-auto p-3 md:p-6">
          <div className="max-w-[1600px] mx-auto">
            <Breadcrumbs />
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                variants={pageVariants}
                initial="initial"
                animate="animate"
                exit="exit"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>
    </div>
  );
}
