import type { APIRoute } from "astro";
import { meta } from "../lib/data";

// Build provenance for whatever bundle is live: `curl https://geoffery.gg/version.json`.
// `version` is the package.json semver (release identity); `commit` + `builtAt` pin the
// exact build; `deployment` comes from the data export's meta.json. The prod deploy guard
// (ops/run.sh) reads this to refuse shipping an older version over what's already live.
export const GET: APIRoute = () =>
  new Response(
    JSON.stringify(
      {
        version: import.meta.env.GEOFFERY_APP_VERSION,
        commit: import.meta.env.GEOFFERY_COMMIT,
        builtAt: import.meta.env.GEOFFERY_BUILT_AT,
        deployment: meta().deployment,
      },
      null,
      2,
    ),
    { headers: { "content-type": "application/json" } },
  );
