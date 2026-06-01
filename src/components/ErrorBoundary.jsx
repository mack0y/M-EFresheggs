import { Component } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { getUserFriendlyError } from '../lib/errors';

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('Error boundary caught:', error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      const message = this.props.fallbackMessage || getUserFriendlyError(this.state.error);

      return (
        <div className="error-boundary">
          <div className="error-boundary-card">
            <div className="error-boundary-icon">
              <AlertTriangle size={28} />
            </div>
            <h2>Something went wrong</h2>
            <p className="error-boundary-message">{message}</p>
            {this.props.showDetails && (
              <details className="error-boundary-details">
                <summary>Error details</summary>
                <pre>{this.state.error?.stack || this.state.error?.message || 'Unknown error'}</pre>
              </details>
            )}
            <button className="btn btn-primary" onClick={this.handleRetry}>
              <RefreshCw size={16} />
              Try Again
            </button>
          </div>

          <style>{`
            .error-boundary {
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 60vh;
              padding: 2rem;
            }

            .error-boundary-card {
              text-align: center;
              background: var(--color-card);
              border: 1px solid var(--color-border-light);
              border-radius: var(--radius-xl);
              padding: 2.5rem;
              max-width: 440px;
              width: 100%;
              box-shadow: var(--shadow-lg);
            }

            .error-boundary-icon {
              display: inline-flex;
              align-items: center;
              justify-content: center;
              width: 64px;
              height: 64px;
              border-radius: 50%;
              background: var(--color-danger-bg);
              color: var(--color-danger);
              margin-bottom: 1rem;
            }

            .error-boundary-card h2 {
              margin-bottom: 0.5rem;
              font-size: 1.25rem;
              font-weight: var(--font-weight-semibold);
            }

            .error-boundary-message {
              color: var(--color-text-secondary);
              font-size: 0.9375rem;
              margin-bottom: 1.5rem;
              line-height: 1.5;
            }

            .error-boundary-details {
              margin-bottom: 1.25rem;
              text-align: left;
            }

            .error-boundary-details summary {
              font-size: 0.8125rem;
              color: var(--color-text-muted);
              cursor: pointer;
              padding: 0.25rem 0;
            }

            .error-boundary-details pre {
              background: #1a1a1a;
              color: #e0e0e0;
              padding: 0.75rem;
              border-radius: var(--radius-sm);
              font-size: 0.75rem;
              margin-top: 0.375rem;
              overflow-x: auto;
              max-height: 200px;
              font-family: var(--font-mono);
              line-height: 1.4;
            }
          `}</style>
        </div>
      );
    }

    return this.props.children;
  }
}
