import { defineConfig } from "astro/config";

// Static site (spec §2/§4): all pages prerendered, fast, mobile-first.
export default defineConfig({
  site: process.env.GEOFFERY_SITE_URL || "http://127.0.0.1:4321",
  server: { port: 4321, host: false },
  build: { format: "directory" },
  devToolbar: { enabled: false },
  // Dev: proxy the consult API to the local Hono worker so the bell's relative
  // /api/consult stays same-origin. In prod this is a Pages Function.
  vite: {
    server: {
      proxy: {
        "/api": { target: `http://127.0.0.1:${process.env.GEOFFERY_CONSULT_PORT || 8787}`, changeOrigin: true },
      },
    },
  },
});
