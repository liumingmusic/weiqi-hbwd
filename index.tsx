import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

// NOTE: Do not import './index.css' here as we use CDN tailwind.

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

// Service Worker Registration for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Use relative path 'sw.js' instead of absolute '/sw.js'
    // This allows deployment to subdirectories (like GitHub Pages)
    navigator.serviceWorker.register('sw.js')
      .then(registration => {
        console.log('SW registered: ', registration);
      })
      .catch(registrationError => {
        console.log('SW registration failed: ', registrationError);
      });
  });
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);