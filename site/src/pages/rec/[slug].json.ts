// Per-item recommendation payload the bell fetches on demand (keeps pages light;
// the full aggregates.json is never shipped to the client).
import type { APIRoute, GetStaticPaths } from "astro";
import { aggregates } from "../../lib/data";

export const getStaticPaths: GetStaticPaths = () =>
  Object.values(aggregates()).map((a) => ({ params: { slug: a.slug } }));

export const GET: APIRoute = ({ params }) => {
  const a = aggregates()[params.slug as string];
  if (!a) return new Response("null", { status: 404, headers: { "content-type": "application/json" } });
  return new Response(
    JSON.stringify({
      slug: a.slug,
      name: a.name,
      band: a.band,
      regimePower: a.regimePower,
      regimeStability: a.regimeStability,
      liquidityBand: a.liquidityBand,
      rec: a.rec,
      hasNews: a.wikiNotices.length > 0,
    }),
    { headers: { "content-type": "application/json" } },
  );
};
