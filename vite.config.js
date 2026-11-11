import { defineConfig } from 'vite';

// En développement, on sert aussi les fonctions /api/* (identiques à celles déployées sur Vercel).
const devApi = () => ({
  name: 'dev-api',
  configureServer(server) {
    server.middlewares.use(async (req, res, next) => {
      const m = req.url.match(/^\/api\/(quotes|history|news|chat|knowledge|account-delete)(\?|$)/);
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

// URL publique du site pour les balises de partage (Vercel la fournit au build).
const siteUrl = () => {
  const host = process.env.SITE_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL || '';
  if (!host) return '';
  return host.startsWith('http') ? host.replace(/\/$/, '') : `https://${host}`;
};
const siteUrlPlugin = () => ({
  name: 'site-url',
  transformIndexHtml: (html) => html.replaceAll('__SITE_URL__', siteUrl()),
});

export default defineConfig({
  base: '/',
  plugins: [devApi(), siteUrlPlugin()],
  build: { outDir: 'dist', chunkSizeWarningLimit: 800 },
});
