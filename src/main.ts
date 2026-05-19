import '@fontsource/space-mono/400.css';
import '@fontsource/space-mono/700.css';
import './index.css';
import { Router } from './views/Router';

const app = document.querySelector<HTMLDivElement>('#app');
if (!app) {
  throw new Error('Missing #app root element');
}

const router = new Router(app);
router.goToMenu();
