import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("Initializing App...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("Could not find root element");
  throw new Error("Could not find root element to mount to");
}

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  console.log("App rendered successfully");
} catch (error) {
  console.error("Error rendering app:", error);
  rootElement.innerHTML = `
    <div style="padding: 20px; color: #dc2626; font-family: sans-serif; text-align: center;">
      <h2>Something went wrong</h2>
      <p>Please check the console for details.</p>
      <button onclick="window.location.reload()" style="padding: 10px 20px; background: #dc2626; color: white; border: none; border-radius: 5px; cursor: pointer;">Reload</button>
    </div>
  `;
}