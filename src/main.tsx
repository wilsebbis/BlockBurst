import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { ErrorBoundary } from './components/shared/ErrorBoundary';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);

// Dev-only handle for poking at the game from the console or a test browser.
if (import.meta.env.DEV) {
  void Promise.all([import('./stores/useMetaStore'), import('./stores/useNav')]).then(([m, n]) => {
    Object.assign(window, { __burst: { meta: m.useMetaStore, nav: n.useNav } });
  });
}
