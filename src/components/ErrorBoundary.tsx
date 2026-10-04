import React from 'react';

interface Props { children: React.ReactNode; }
interface State { hasError: boolean; error: Error | null; }

export class ErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error('[ErrorBoundary] Uncaught error:', error, info.componentStack);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <div style={{
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        height: '100vh', gap: 16, padding: 32, fontFamily: 'sans-serif', textAlign: 'center',
        background: 'var(--bg-primary, #f8fafc)', color: 'var(--text-primary, #0f172a)',
      }}>
        <span style={{ fontSize: 48 }}>⚠️</span>
        <h2 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Something went wrong</h2>
        <p style={{ margin: 0, color: 'var(--text-secondary, #64748b)', maxWidth: 480, lineHeight: 1.6 }}>
          An unexpected error occurred. Your data is safe in local storage.
        </p>
        {this.state.error && (
          <pre style={{
            background: 'var(--bg-secondary, #f1f5f9)', padding: '12px 16px', borderRadius: 8,
            fontSize: 12, maxWidth: 560, overflowX: 'auto', textAlign: 'left',
            color: 'var(--danger, #ef4444)',
          }}>
            {this.state.error.message}
          </pre>
        )}
        <button
          onClick={this.handleReload}
          style={{
            padding: '10px 24px', borderRadius: 8, border: 'none', cursor: 'pointer',
            background: 'var(--accent, #3b82f6)', color: '#fff', fontWeight: 600, fontSize: 14,
          }}
        >
          Reload App
        </button>
      </div>
    );
  }
}
