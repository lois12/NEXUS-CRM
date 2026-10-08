import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Download } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
  isChunkError: boolean;
}

const CHUNK_PATTERNS = [
  /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i,
  /error loading dynamically imported module/i,
  /Loading chunk [\w-]+ failed/i,
  /ChunkLoadError/i,
  /Loading CSS chunk [\w-]+ failed/i,
  /Unable to preload CSS/i,
];

function isChunkError(error?: Error | string): boolean {
  const msg = String((error as Error)?.message || error || '');
  return CHUNK_PATTERNS.some((re) => re.test(msg));
}

const RELOAD_KEY = 'nexus_chunk_reload_at';

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, isChunkError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      isChunkError: isChunkError(error),
    };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);

    // Stale bundle after deploy — auto-refresh once (not in a loop)
    if (isChunkError(error)) {
      const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0);
      const now = Date.now();
      if (now - last > 15_000) {
        sessionStorage.setItem(RELOAD_KEY, String(now));
        // give the user a beat to see it's intentional
        setTimeout(() => {
          window.location.reload();
        }, 600);
      }
    }
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined, isChunkError: false });
  };

  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      const chunk = this.state.isChunkError;
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
              style={{ backgroundColor: chunk ? 'rgba(0,212,255,0.15)' : 'rgba(255,59,48,0.2)' }}
            >
              {chunk ? (
                <Download className="w-8 h-8" style={{ color: 'var(--color-accent, #00d4ff)' }} />
              ) : (
                <AlertTriangle className="w-8 h-8" style={{ color: 'var(--color-danger, #ff3b30)' }} />
              )}
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              {chunk ? 'Вышла новая версия' : 'Что-то пошло не так'}
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              {chunk
                ? 'Обновите страницу — приложение было обновлено на сервере.'
                : this.state.error?.message || 'Произошла непредвиденная ошибка'}
            </p>
            {chunk ? (
              <button
                onClick={this.handleReload}
                className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg transition-colors font-mono text-sm"
                style={{
                  backgroundColor: 'rgba(0,255,136,0.2)',
                  border: '1px solid rgba(0,255,136,0.5)',
                  color: 'var(--color-primary)',
                }}
              >
                <RefreshCw className="w-4 h-4" />
                ОБНОВИТЬ СТРАНИЦУ
              </button>
            ) : (
              <div className="flex items-center justify-center gap-2">
                <button
                  onClick={this.handleReset}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg transition-colors font-mono text-sm"
                  style={{
                    backgroundColor: 'rgba(0,255,136,0.2)',
                    border: '1px solid rgba(0,255,136,0.5)',
                    color: 'var(--color-primary)',
                  }}
                >
                  <RefreshCw className="w-4 h-4" />
                  Попробовать снова
                </button>
                <button
                  onClick={this.handleReload}
                  className="px-4 py-2 rounded-lg transition-colors font-mono text-sm"
                  style={{
                    border: '1px solid rgba(255,255,255,0.12)',
                    color: 'var(--color-text-secondary)',
                  }}
                >
                  F5
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
