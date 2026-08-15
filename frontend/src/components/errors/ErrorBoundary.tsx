import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 'var(--space-8)',
          maxWidth: '600px',
          margin: '40px auto',
          textAlign: 'center',
        }} className="glass-card">
          <div style={{
            width: '56px',
            height: '56px',
            borderRadius: 'var(--radius-full)',
            background: 'var(--color-error-bg)',
            color: 'var(--color-error)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--space-4)',
          }}>
            <AlertCircle size={28} />
          </div>
          <h2 style={{ fontSize: 'var(--text-xl)', marginBottom: 'var(--space-2)' }}>Something went wrong</h2>
          <p style={{ color: 'var(--color-text-muted)', fontSize: 'var(--text-sm)', marginBottom: 'var(--space-6)' }}>
            {this.state.error?.message || 'An unexpected rendering error occurred.'}
          </p>
          <button
            className="btn btn-primary btn-md"
            onClick={() => {
              this.setState({ hasError: false, error: null });
              window.location.reload();
            }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 'var(--space-2)', cursor: 'pointer' }}
          >
            <RefreshCw size={16} />
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
