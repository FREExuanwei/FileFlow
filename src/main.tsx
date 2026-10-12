import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './app/App';
import { LanguageProvider } from './i18n/Provider';
import './styles/app.css';
import './styles/dialog.css';
import './styles/workspace.css';
import './styles/colors.css';
import './styles/ai-ready.css';
import './styles/phase7.css';

createRoot(document.getElementById('root')!).render(<StrictMode><LanguageProvider><App /></LanguageProvider></StrictMode>);
