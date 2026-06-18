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
    // Build provenance from run.sh → import.meta.env (consumed by /version.json + footer).
    // GEOFFERY_BUILD_VERSION is the short git sha; GEOFFERY_APP_VERSION is package.json.
    define: {
      "import.meta.env.GEOFFERY_APP_VERSION": JSON.stringify(process.env.GEOFFERY_APP_VERSION || "0.0.0-dev"),
      "import.meta.env.GEOFFERY_COMMIT": JSON.stringify(process.env.GEOFFERY_BUILD_VERSION || "unknown"),
      "import.meta.env.GEOFFERY_BUILT_AT": JSON.stringify(process.env.GEOFFERY_BUILT_AT || ""),
    },
    server: {
      proxy: {
        "/api": { target: `http://127.0.0.1:${process.env.GEOFFERY_CONSULT_PORT || 8787}`, changeOrigin: true },
      },
    },
  },
});
