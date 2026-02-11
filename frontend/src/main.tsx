import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';
import { initSentry } from './services/sentry';
import { initAnalytics } from './services/analytics';

// Initialize production services
async function initializeApp() {
  // Initialize error tracking
  await initSentry();

  // Initialize analytics
  initAnalytics();

  // Register service worker for PWA
  if ('serviceWorker' in navigator && import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch((error) => {
        console.warn('Service worker registration failed:', error);
      });
    });
  }
}

import { GoogleOAuthProvider } from '@react-oauth/google';

// Initialize and render
initializeApp().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
     <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID || ""}>
        <App />
      </GoogleOAuthProvider>
    </React.StrictMode>
  );
});
