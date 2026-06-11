// Public endpoint for the client-side search index. Astro emits this as a
// static file at /items.json — the search component fetches it on focus.
import type { APIRoute } from 'astro';
import { items } from '../lib/data';

export const GET: APIRoute = () => {
  return new Response(JSON.stringify(items), {
    headers: {
      'content-type': 'application/json',
      'cache-control': 'public, max-age=3600',
    },
  });
};
