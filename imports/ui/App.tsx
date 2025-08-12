import React, { useEffect, useState } from 'react';
import { MessagesPage } from './MessagesPage';

function getSystemPrefersDark(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false;
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export const App: React.FC = () => {
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    try {
      const saved = localStorage.getItem('messages.theme');
      if (saved === 'dark' || saved === 'light') return saved;
    } catch {}
    return getSystemPrefersDark() ? 'dark' : 'light';
  });

  useEffect(() => {
    try { localStorage.setItem('messages.theme', theme); } catch {}
    document.documentElement.setAttribute('data-bs-theme', theme);
  }, [theme]);

  return (
    <div>
      <nav className="navbar navbar-expand navbar-light bg-body-tertiary border-bottom mb-2">
        <div className="container-fluid">
          <span className="navbar-brand fw-semibold">Realtime Messages</span>
          <div className="ms-auto d-flex align-items-center gap-2">
            <button
              type="button"
              className="btn btn-outline-primary rounded-circle d-flex align-items-center justify-content-center p-0"
              style={{ width: 36, height: 36 }}
              onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              aria-label="Toggle theme"
              title={theme === 'dark' ? 'Switch to light' : 'Switch to dark'}
            >
              <i className={`bi ${theme === 'dark' ? 'bi-sun-fill' : 'bi-moon-stars-fill'}`}></i>
            </button>
          </div>
        </div>
      </nav>
      <MessagesPage />
    </div>
  );
};
