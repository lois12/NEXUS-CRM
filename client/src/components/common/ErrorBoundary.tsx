import { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--color-bg)' }}>
          <div className="glass rounded-2xl p-8 max-w-md w-full text-center">
            <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4" style={{ backgroundColor: 'rgba(255,59,48,0.2)' }}>
              <AlertTriangle className="w-8 h-8" style={{ color: 'var(--color-danger)' }} />
            </div>
            <h2 className="text-xl font-semibold mb-2" style={{ color: 'var(--color-text-primary)' }}>
              Что-то пошло не так
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-secondary)' }}>
              {this.state.error?.message || 'Произошла непредвиденная ошибка'}
            </p>
            <button onClick={this.handleReset}
              className="flex items-center gap-2 mx-auto px-4 py-2 rounded-lg transition-colors font-mono text-sm"
              style={{ backgroundColor: 'rgba(0,255,136,0.2)', border: '1px solid rgba(0,255,136,0.5)', color: 'var(--color-primary)' }}>
              <RefreshCw className="w-4 h-4" />
              Попробовать снова
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
