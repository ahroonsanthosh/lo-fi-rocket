import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../src/tokens/tokens.css';
import '../src/styles.css';
import './mockup.css';
import { SCREENS } from './screens.js';

const params = new URLSearchParams(window.location.search);
const theme = params.get('theme');
if (theme === 'dark' || theme === 'light') document.documentElement.dataset['theme'] = theme;
const name = params.get('screen') ?? 'design';
const Screen = SCREENS[name] ?? SCREENS['design'];
const root = document.getElementById('root');
if (root !== null && Screen !== undefined) {
  createRoot(root).render(
    <StrictMode>
      <Screen />
    </StrictMode>,
  );
}
