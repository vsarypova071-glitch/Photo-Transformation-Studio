 import React from 'react';
 import ReactDOM from 'react-dom/client';
 import App from './App';
 import './index.css';
 import { initLogger } from './utils/logger';
 
 // Initialize global error handlers
 initLogger();
 
 ReactDOM.createRoot(document.getElementById('root')!).render(
   <React.StrictMode>
     <App />
   </React.StrictMode>
 );