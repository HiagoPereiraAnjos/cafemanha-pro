
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

const installStyledAlert = () => {
  if (typeof window === 'undefined') return;
  if ((window as any).__styledAlertInstalled) return;
  (window as any).__styledAlertInstalled = true;

  const queue: string[] = [];
  let isOpen = false;

  const openNext = () => {
    if (isOpen || queue.length === 0) return;
    isOpen = true;

    const message = queue.shift() || '';

    const backdrop = document.createElement('div');
    backdrop.style.position = 'fixed';
    backdrop.style.inset = '0';
    backdrop.style.background = 'rgba(15,23,42,0.45)';
    backdrop.style.backdropFilter = 'blur(4px)';
    backdrop.style.display = 'flex';
    backdrop.style.alignItems = 'center';
    backdrop.style.justifyContent = 'center';
    backdrop.style.padding = '16px';
    backdrop.style.zIndex = '9999';

    const card = document.createElement('div');
    card.style.width = '100%';
    card.style.maxWidth = '420px';
    card.style.background = '#ffffff';
    card.style.border = '1px solid #e2e8f0';
    card.style.borderRadius = '20px';
    card.style.boxShadow = '0 20px 45px rgba(2,6,23,0.2)';
    card.style.padding = '24px';

    const title = document.createElement('h3');
    title.textContent = 'Aviso do Sistema';
    title.style.margin = '0 0 10px 0';
    title.style.fontSize = '20px';
    title.style.fontWeight = '700';
    title.style.color = '#0f172a';

    const body = document.createElement('p');
    body.textContent = message;
    body.style.margin = '0 0 18px 0';
    body.style.whiteSpace = 'pre-wrap';
    body.style.fontSize = '15px';
    body.style.lineHeight = '1.45';
    body.style.color = '#334155';

    const actions = document.createElement('div');
    actions.style.display = 'flex';
    actions.style.justifyContent = 'flex-end';

    const okButton = document.createElement('button');
    okButton.textContent = 'OK';
    okButton.style.border = 'none';
    okButton.style.background = '#2563eb';
    okButton.style.color = '#fff';
    okButton.style.padding = '10px 16px';
    okButton.style.borderRadius = '12px';
    okButton.style.fontWeight = '600';
    okButton.style.cursor = 'pointer';

    const close = () => {
      if (backdrop.parentElement) {
        backdrop.parentElement.removeChild(backdrop);
      }
      isOpen = false;
      openNext();
    };

    okButton.onclick = close;
    backdrop.onclick = (ev) => {
      if (ev.target === backdrop) close();
    };

    actions.appendChild(okButton);
    card.appendChild(title);
    card.appendChild(body);
    card.appendChild(actions);
    backdrop.appendChild(card);
    document.body.appendChild(backdrop);
  };

  window.alert = (message?: unknown) => {
    queue.push(String(message ?? ''));
    openNext();
  };
};

installStyledAlert();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
