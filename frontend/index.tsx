import './index.css';
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// The Vertex AI proxy shim rewrites window.fetch and window.WebSocket to route
// Vertex calls through the local Node backend, which needs a shared secret and
// a service-account token. None of that belongs in a public bundle, and neither
// /api-proxy nor /ws-proxy is routed in production, so the shim is loaded only
// under the dev server. `import.meta.env.DEV` is statically replaced by Vite,
// so the dynamic import is dead code that Rollup drops from the prod build.
if (import.meta.env.DEV) {
  void import('./vertex-ai-proxy-interceptor.js');
}

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

let root = (rootElement as any)._reactRoot;
if (!root) {
  root = ReactDOM.createRoot(rootElement);
  (rootElement as any)._reactRoot = root;
}

root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);