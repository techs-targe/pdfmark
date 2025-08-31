import React, { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): State {
    return {
      hasError: true,
      error,
      errorInfo: null,
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      error,
      errorInfo,
    });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary p-8 bg-red-50 border border-red-200 rounded-lg m-4">
          <h2 className="text-2xl font-bold text-red-600 mb-4">Something went wrong</h2>
          <details className="whitespace-pre-wrap">
            <summary className="cursor-pointer text-red-700 font-semibold mb-2">
              Click for error details
            </summary>
            {this.state.error && (
              <div className="mt-4">
                <p className="font-bold text-red-600">Error:</p>
                <pre className="bg-red-100 p-4 rounded mt-2 overflow-auto">
                  {this.state.error.toString()}
                </pre>
                {this.state.error.stack && (
                  <>
                    <p className="font-bold text-red-600 mt-4">Stack trace:</p>
                    <pre className="bg-red-100 p-4 rounded mt-2 overflow-auto text-xs">
                      {this.state.error.stack}
                    </pre>
                  </>
                )}
              </div>
            )}
            {this.state.errorInfo && (
              <div className="mt-4">
                <p className="font-bold text-red-600">Component stack:</p>
                <pre className="bg-red-100 p-4 rounded mt-2 overflow-auto text-xs">
                  {this.state.errorInfo.componentStack}
                </pre>
              </div>
            )}
          </details>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
          >
            Reload Page
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}