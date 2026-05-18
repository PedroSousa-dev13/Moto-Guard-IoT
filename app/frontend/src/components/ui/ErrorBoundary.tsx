import { Component, type ReactNode, type ErrorInfo } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import Button from './Button';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary]', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8 text-center">
          <div className="w-20 h-20 rounded-full bg-red/10 flex items-center justify-center text-red border border-red/20 mb-6">
            <AlertTriangle size={36} />
          </div>
          <h2 className="text-xl font-black text-text tracking-tight mb-2">Algo correu mal</h2>
          <p className="text-sm text-muted font-medium max-w-md mb-2 leading-relaxed">
            Ocorreu um erro inesperado ao carregar esta página.
          </p>
          {this.state.error && (
            <p className="text-xs font-mono text-red/70 bg-red/5 px-4 py-2 rounded-xl max-w-md mb-6 truncate">
              {this.state.error.message}
            </p>
          )}
          <Button variant="primary" size="lg" icon={<RefreshCw size={16} />} onClick={this.handleRetry}>
            Tentar novamente
          </ Button>
        </div>
      );
    }

    return this.props.children;
  }
}
