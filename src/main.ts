import './style.css';
import { startApp } from './app';
import { registerServiceWorker } from './pwa';
import { browserStorage } from './storage';

startApp({ storage: browserStorage() });
if (import.meta.env.PROD) registerServiceWorker(navigator, window);
