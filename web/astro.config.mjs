// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

// The deployment name flows in via the launcher (scripts/run.sh). Default
// to "local" so a bare `npm run build` still works in a developer's editor.
const DEPLOYMENT = process.env.GEOFFERY_DEPLOYMENT_NAME ?? 'local';
const SITE = process.env.GEOFFERY_SITE_URL ?? 'http://127.0.0.1:4321';

// qa and local hide from search engines and skip the sitemap integration
// entirely — the only site we want indexed is prod. (Crawler-defence in
// depth: noindex meta on every page, robots.txt deny-all in qa/local,
// Cloudflare Access gating the qa zone, no canonical link from prod.)
const integrations = DEPLOYMENT === 'prod' ? [sitemap()] : [];

export default defineConfig({
  site: SITE,
  trailingSlash: 'never',
  integrations,
  redirects: {
    '/how-we-rate': '/methodology',
    '/how-we-make-money': '/tip-jar',
    '/wages': '/tip-jar',
    '/ledger': '/patrons',
  },
  build: {
    inlineStylesheets: 'auto',
  },
  compressHTML: true,
  vite: {
    define: {
      'import.meta.env.PUBLIC_GEOFFERY_DEPLOYMENT_NAME': JSON.stringify(DEPLOYMENT),
      'import.meta.env.PUBLIC_GEOFFERY_BUILD_VERSION': JSON.stringify(
        process.env.GEOFFERY_BUILD_VERSION ?? 'unbuilt'
      ),
    },
  },
});
