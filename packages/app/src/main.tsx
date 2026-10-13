import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App.js';
// Lato (SIL Open Font License 1.1), bundled so the app works offline (D-UI-6).
import '@fontsource/lato/latin-300.css';
import '@fontsource/lato/latin-400.css';
import '@fontsource/lato/latin-700.css';
import '@lo-fi-rocket/ui/tokens.css';
import '@lo-fi-rocket/ui/styles.css';
import './styles.css';

const container = document.getElementById('root');
if (container === null) {
  throw new Error('Root element #root not found in index.html');
}

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
