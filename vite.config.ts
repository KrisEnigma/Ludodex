import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'editor-route-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/editor' || url.pathname === '/editor/' || url.pathname === '/editor.html') {
          req.url = '/editor/index.html';
        }
        next();
      });
    }
  }],
  server: {
    host: true,
    port: 5173
  }
});
