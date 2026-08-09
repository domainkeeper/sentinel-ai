import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  message: string;
}

/**
 * Top-level fallback so a single runtime error never blanks the whole app.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected error' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    // Surface for diagnostics without logging secrets or stack internals.
    console.error('[Sentinel] runtime boundary', error.message, errorInfo.componentStack);
  }

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="feed-state feed-state--error" role="alert">
        <p className="section-title">Something went wrong</p>
        <p className="placeholder-body">{this.state.message}</p>
        <button className="feed-state__retry" type="button" onClick={() => window.location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;