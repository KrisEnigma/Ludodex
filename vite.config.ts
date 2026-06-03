import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [{
    name: 'editor-route-rewrite',
    configureServer(server) {
      server.middlewares.use((req, _res, next) => {
        if (!req.url) return next();
        const url = new URL(req.url, 'http://localhost');
        if (url.pathname === '/skin-tester' || url.pathname === '/skin-tester/' || url.pathname === '/skin-tester/index.html') {
          req.url = `/src/skin-tester/index.html${url.search}`;
        }
        if (url.pathname === '/editor' || url.pathname === '/editor/' || url.pathname === '/editor.html') {
          req.url = '/editor/index.html';
        }
        next();
      });
    }
  }],
  server: {
    host: true,
    port: 5173,
    proxy: {
      '/api': {
        target: 'https://ludodex.krisenigma.com',
        changeOrigin: true,
        secure: true
      }
    }
  }
});
