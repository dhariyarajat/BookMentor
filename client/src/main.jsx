import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import './index.css';

// Apply the saved theme before first paint to avoid a flash of the wrong theme.
// toggle(force) also REMOVES a stale `.dark` class left over from old sessions/HMR.
try {
  document.documentElement.classList.toggle('dark', localStorage.getItem('mb_theme') === 'dark');
} catch {
  /* storage unavailable */
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ThemeProvider>
      <App />
    </ThemeProvider>
  </React.StrictMode>
);
