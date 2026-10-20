import './style.css';
import { startApp } from './app';
import { browserStorage } from './storage';

startApp({ storage: browserStorage() });
