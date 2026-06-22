import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import './index.css';
import App from './App.jsx';
import { applyTheme } from './stores/themeStore.js';

// Apply saved theme before first render to avoid flash
const saved = (() => { try { return JSON.parse(localStorage.getItem('cricket-theme') || '{}').state?.theme || 'system'; } catch { return 'system'; } })();
applyTheme(saved);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
      <Toaster position="top-center" />
    </BrowserRouter>
  </StrictMode>
);
