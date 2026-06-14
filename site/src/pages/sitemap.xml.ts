// Sitemap with lastmod tied to real price movement (spec §4): each item's
// lastmod is its aggregate computed_at.
import type { APIRoute } from "astro";
import { aggregates, meta } from "../lib/data";

export const GET: APIRoute = ({ site }) => {
  const base = (site?.toString() || "http://127.0.0.1:4321/").replace(/\/$/, "");
  const m = meta();
  const iso = (ts: number) => new Date((ts || m.exportedAt) * 1000).toISOString();
  const statics = ["/", "/about/", "/money/"];
  const urls: string[] = [];
  for (const p of statics) urls.push(`<url><loc>${base}${p}</loc></url>`);
  for (const a of Object.values(aggregates())) {
    urls.push(`<url><loc>${base}/item/${a.slug}/</loc><lastmod>${iso(a.computedAt)}</lastmod></url>`);
  }
  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join("\n")}\n</urlset>\n`;
  return new Response(xml, { headers: { "content-type": "application/xml" } });
};
