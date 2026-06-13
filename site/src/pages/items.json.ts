// Search index endpoint — the bell + homepage search fetch this.
import type { APIRoute } from "astro";
import { items } from "../lib/data";

export const GET: APIRoute = () =>
  new Response(JSON.stringify(items()), {
    headers: { "content-type": "application/json" },
  });
