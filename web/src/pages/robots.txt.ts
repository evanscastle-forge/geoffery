// Deployment-aware robots.txt.
//   prod  → public-friendly, sitemap pointer
//   qa    → deny-all (CF Access is the primary gate; this is belt+suspenders)
//   local → deny-all (no crawler should ever see it anyway)
import type { APIRoute } from 'astro';
import { isProd } from '../lib/env';

export const GET: APIRoute = ({ site }) => {
  const body = isProd
    ? `User-agent: *
Allow: /

Sitemap: ${site}sitemap-index.xml
`
    : `User-agent: *
Disallow: /
`;
  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=600',
    },
  });
};
