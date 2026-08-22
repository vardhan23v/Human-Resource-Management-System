import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './styles/tokens.css';
import './styles/global.css';

if ('serviceWorker' in navigator && (import.meta as any).env?.PROD) window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
