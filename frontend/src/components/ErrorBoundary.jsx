import { Component } from 'react';
import { Card, Button } from './ui';

class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null
    };
  }

  static getDerivedStateFromError(error) {
    // Update state so the next render will show the fallback UI
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    // Log the error to an error reporting service
    this.setState({
      error: error,
      errorInfo: errorInfo
    });

    // In production, you could send this to a logging service
    if (import.meta.env.MODE !== 'development') {
      // TODO: Send to error tracking service (e.g., Sentry)
      // logErrorToService(error, errorInfo);
    } else {
      console.error('Error caught by boundary:', error, errorInfo);
    }
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null
    });
  }

  render() {
    if (this.state.hasError) {
      // Fallback UI
      return (
        <div className="error-boundary-container" style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '400px',
          padding: '2rem'
        }}>
          <Card style={{ maxWidth: '600px', width: '100%' }}>
            <div style={{ textAlign: 'center' }}>
              <h2 style={{ color: 'var(--color-error, #dc2626)', marginBottom: '1rem' }}>
                Something went wrong
              </h2>
              <p style={{ color: 'var(--color-text-secondary, #6b7280)', marginBottom: '1.5rem' }}>
                We're sorry for the inconvenience. An unexpected error occurred.
              </p>

              {import.meta.env.MODE === 'development' && this.state.error && (
                <div style={{
                  textAlign: 'left',
                  backgroundColor: '#f3f4f6',
                  padding: '1rem',
                  borderRadius: '0.5rem',
                  marginBottom: '1rem',
                  fontSize: '0.875rem',
                  fontFamily: 'monospace',
                  overflow: 'auto'
                }}>
                  <strong>Error:</strong> {this.state.error.toString()}
                  {this.state.errorInfo && (
                    <>
                      <br /><br />
                      <strong>Component Stack:</strong>
                      <pre style={{ whiteSpace: 'pre-wrap', marginTop: '0.5rem' }}>
                        {this.state.errorInfo.componentStack}
                      </pre>
                    </>
                  )}
                </div>
              )}

              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center' }}>
                <Button variant="primary" onClick={this.handleReset}>
                  Try Again
                </Button>
                <Button
                  variant="secondary"
                  onClick={() => window.location.href = '/modern/dashboard'}
                >
                  Go to Dashboard
                </Button>
              </div>
            </div>
          </Card>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
