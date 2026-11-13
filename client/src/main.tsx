import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import ErrorBoundary from './components/common/ErrorBoundary';
import './styles/globals.css';

// Слабые устройства: убираем blur/анимации (главный вор производительности).
// Класс low-fx ставится до первого рендера, чтобы не было мигания.
if (typeof document !== 'undefined') {
  const nav = navigator as Navigator & { deviceMemory?: number };
  const cores = nav.hardwareConcurrency ?? 8;
  const mem = nav.deviceMemory ?? 8;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (cores <= 4 || mem <= 4 || reduced) {
    document.documentElement.classList.add('low-fx');
  }
}

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
