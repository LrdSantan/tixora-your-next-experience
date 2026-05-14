import React, { Component, ErrorInfo, ReactNode } from "react";

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
}

class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false
  };

  public static getDerivedStateFromError(_: Error): State {
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      // Use inline styles to avoid dependency on Tailwind/CSS-in-JS that might have crashed
      return (
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#080C0A',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontFamily: 'system-ui, -apple-system, sans-serif',
          padding: '20px'
        }}>
          <div style={{ maxWidth: '400px', width: '100%', textAlign: 'center' }}>
            <div style={{ marginBottom: '32px' }}>
              <span style={{ fontSize: '30px', fontWeight: '900', letterSpacing: '-0.05em', color: '#1A7A4A' }}>TIXORA</span>
            </div>
            <h1 style={{ fontSize: '24px', fontWeight: 'bold', marginBottom: '16px' }}>Something went wrong</h1>
            <p style={{ color: 'rgba(255,255,255,0.6)', marginBottom: '32px' }}>
              We hit an unexpected error. Try refreshing the page.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <button 
                onClick={() => window.location.reload()}
                style={{
                  backgroundColor: '#1A7A4A',
                  color: 'white',
                  border: 'none',
                  padding: '14px',
                  borderRadius: '12px',
                  fontWeight: 'bold',
                  fontSize: '16px',
                  cursor: 'pointer'
                }}
              >
                Refresh Page
              </button>
              <a 
                href="/"
                style={{
                  color: 'rgba(255,255,255,0.6)',
                  textDecoration: 'none',
                  padding: '12px',
                  fontWeight: '600'
                }}
              >
                Go Home
              </a>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default ErrorBoundary;
