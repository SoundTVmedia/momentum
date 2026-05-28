import { Component, ReactNode } from 'react';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
  recoveryAttempt: number;
}

const MAX_AUTO_RECOVERY_ATTEMPTS = 5;

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempt: 0,
    };
    this.recoveryTimer = null;
  }

  private recoveryTimer: ReturnType<typeof setTimeout> | null = null;

  static getDerivedStateFromError(error: Error): Partial<State> {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error boundary caught error:', error, errorInfo);

    this.setState((prev) => ({
      error,
      errorInfo,
      recoveryAttempt: prev.recoveryAttempt,
    }));

    this.scheduleAutoRecovery();
  }

  componentWillUnmount() {
    if (this.recoveryTimer) clearTimeout(this.recoveryTimer);
  }

  scheduleAutoRecovery = () => {
    if (this.recoveryTimer) return;
    const attempt = this.state.recoveryAttempt + 1;
    if (attempt > MAX_AUTO_RECOVERY_ATTEMPTS) return;

    const delayMs = Math.min(4000, 450 + attempt * 500);
    this.recoveryTimer = setTimeout(() => {
      this.recoveryTimer = null;
      this.setState({
        hasError: false,
        error: null,
        errorInfo: null,
        recoveryAttempt: attempt,
      });
    }, delayMs);
  };

  handleReset = () => {
    if (this.recoveryTimer) {
      clearTimeout(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
      recoveryAttempt: 0,
    });
  };

  handleReload = () => {
    window.location.reload();
  };

  handleGoHome = () => {
    window.location.href = '/';
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }

      // Default error UI
      return (
        <div className="min-h-screen text-white flex items-center justify-center px-4">
          <div className="max-w-lg w-full">
            <div className="glass-panel border border-red-500/30 rounded-xl p-8 text-center space-y-6">
              <div className="flex justify-center">
                <div className="w-20 h-20 bg-red-500/20 rounded-full flex items-center justify-center">
                  <AlertTriangle className="w-10 h-10 text-red-400" />
                </div>
              </div>

              <div>
                <h1 className="text-2xl font-bold text-white mb-2">
                  Oops! Something went wrong
                </h1>
                <p className="text-gray-300">
                  We encountered an unexpected error. Don&apos;t worry, your data is safe.
                </p>
                {this.state.recoveryAttempt < MAX_AUTO_RECOVERY_ATTEMPTS ? (
                  <p className="mt-3 text-sm text-momentum-flare/90 flex items-center justify-center gap-2">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    Retrying automatically…
                  </p>
                ) : null}
              </div>

              {process.env.NODE_ENV === 'development' && this.state.error && (
                <div className="text-left bg-red-500/10 border border-red-500/30 rounded-lg p-4 max-h-40 overflow-auto">
                  <p className="text-red-400 text-sm font-mono break-all">
                    {this.state.error.toString()}
                  </p>
                  {this.state.errorInfo && (
                    <pre className="text-xs text-red-300 mt-2 overflow-x-auto">
                      {this.state.errorInfo.componentStack}
                    </pre>
                  )}
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-3">
                <button
                  onClick={this.handleReset}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 bg-white/10 border border-white/20 rounded-lg text-white hover:bg-white/20 transition-colors"
                >
                  <RefreshCw className="w-5 h-5" />
                  <span>Try Again</span>
                </button>
                
                <button
                  onClick={this.handleGoHome}
                  className="flex-1 flex items-center justify-center space-x-2 px-6 py-3 momentum-grad-interactive rounded-lg text-white hover:scale-105 transition-transform"
                >
                  <Home className="w-5 h-5" />
                  <span>Go Home</span>
                </button>
              </div>

              <button
                onClick={this.handleReload}
                className="text-gray-400 hover:text-white transition-colors text-sm"
              >
                Or reload the page
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
