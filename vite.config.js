import { defineConfig } from 'vite';

// En développement, on sert aussi les fonctions /api/* (identiques à celles déployées sur Vercel).
const devApi = () => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const m = req.url.match(/^\/api\/(quotes|history|news)(\?|$)/);
      if (!m) return next();
      try {
        const mod = await server.ssrLoadModule(`/api/${m[1]}.js`);
        await mod.default(req, res);
      } catch (e) {
        res.statusCode = 500;
        res.end(JSON.stringify({ error: String(e) }));
      }
    });
  },
});

export default defineConfig({
  base: '/',
  plugins: [devApi()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 800 },
});
