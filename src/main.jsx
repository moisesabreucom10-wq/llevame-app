import React, { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Global error handler for debugging startup issues
window.onerror = function (message, source, lineno, colno, error) {
  console.error('GLOBAL ERROR:', message, 'at', source, ':', lineno, ':', colno);
  if (error) console.error('STACK:', error.stack);
  // Intentar mostrar el error en pantalla si el root está vacío
  const root = document.getElementById('root');
  if (root && root.innerHTML === '') {
    root.innerHTML = `<div style="color:red; padding:20px; font-size: 14px;">
       <h1>Startup Error</h1>
       <p>${message}</p>
       <pre>${error ? error.stack : ''}</pre>
     </div>`;
  }
};

window.onunhandledrejection = function (event) {
  console.error('UNHANDLED PROMISE REJECTION:', event.reason);
  const root = document.getElementById('root');
  if (root) {
    root.innerHTML += `<div style="color:red; border:1px solid red; margin:10px; padding:10px;">
         <h3>Promise Rejection</h3>
         <p>${event.reason ? event.reason.toString() : 'Unknown reason'}</p>
       </div>`;
  }
};

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null, errorInfo: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error("React Error Boundary caught an error:", error, errorInfo);
    this.setState({ error, errorInfo });
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '20px', color: 'red' }}>
          <h1>Algo salió mal en React.</h1>
          <details style={{ whiteSpace: 'pre-wrap' }}>
            {this.state.error && this.state.error.toString()}
            <br />
            {this.state.errorInfo && this.state.errorInfo.componentStack}
          </details>
        </div>
      );
    }

    return this.props.children;
  }
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
)
