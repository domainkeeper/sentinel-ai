import { Component } from 'react';
import type { ErrorInfo, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  label?: string;
}

interface State {
  hasError: boolean;
  message: string;
  id: string;
}

/**
 * View-scoped error boundary. A failing view shows a styled, still-Sentinel
 * fallback instead of taking down the shell or nav. In development the raw
 * message is surfaced; in production a generic message is shown (no stack).
 */
export class RouteBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '', id: '' };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message || 'Unexpected error', id: '' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error(`[sentinel:view] ${this.props.label ?? 'view'}`.trim(), {
      message: error.message,
      stack: errorInfo.componentStack,
    });
  }

  private reset = () => {
    this.setState({ hasError: false, message: '', id: '' });
  };

  render(): ReactNode {
    if (!this.state.hasError) {
      return this.props.children;
    }

    const isDev = import.meta.env.DEV;

    return (
      <div className="feed-state feed-state--error" role="alert">
        <p className="section-title">This view hit a runtime error</p>
        <p className="placeholder-body">
          {isDev ? this.state.message : 'An unexpected error occurred rendering this section.'}
        </p>
        <div className="feed-state__actions">
          <button className="feed-state__retry" type="button" onClick={this.reset}>
            Retry view
          </button>
          <button
            className="feed-state__reload"
            type="button"
            onClick={() => window.location.reload()}
          >
            Reload app
          </button>
        </div>
      </div>
    );
  }
}

export default RouteBoundary;