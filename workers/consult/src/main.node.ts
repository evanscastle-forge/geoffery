// Node entry for the consult worker: a small Hono HTTP server. The Astro dev
// server proxies /api/* here. On Cloudflare this becomes a Pages Function /
// Worker fetch() handler binding D1 — same handler body, different entry.

import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { loadConfig, openStore } from "@geoffery/data";
import { logConsultation, type ConsultRequest } from "./handler.ts";

const cfg = loadConfig();
const store = openStore(cfg.dbPath);
const app = new Hono();

const CLIENT_COOKIE = "geoffery_cid";

function clientIdFrom(cookie: string | undefined): string {
  const m = cookie?.match(/geoffery_cid=([^;]+)/);
  return m ? decodeURIComponent(m[1]!) : crypto.randomUUID();
}

app.get("/api/health", (c) => c.json({ ok: true, deployment: cfg.deployment }));

app.post("/api/consult", async (c) => {
  let body: ConsultRequest;
  try {
    body = (await c.req.json()) as ConsultRequest;
  } catch {
    return c.json({ ok: false, error: "bad json" }, 400);
  }
  const cid = clientIdFrom(c.req.header("cookie"));
  const result = logConsultation(store, body, cid);
  if (result.ok) {
    c.header(
      "set-cookie",
      `${CLIENT_COOKIE}=${encodeURIComponent(cid)}; Path=/; Max-Age=31536000; SameSite=Lax`,
    );
    return c.json(result, 201);
  }
  return c.json(result, 400);
});

const port = cfg.consultPort;
serve({ fetch: app.fetch, port }, () => {
  console.log(`consult worker listening on http://127.0.0.1:${port}`);
});
