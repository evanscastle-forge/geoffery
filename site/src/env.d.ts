/// <reference types="astro/client" />

// Build provenance, injected via vite.define from run.sh (see astro.config.mjs).
interface ImportMetaEnv {
  /** package.json version — the human release identity surfaced at /version.json. */
  readonly GEOFFERY_APP_VERSION: string;
  /** short git sha of the deployed commit. */
  readonly GEOFFERY_COMMIT: string;
  /** ISO-8601 build timestamp. */
  readonly GEOFFERY_BUILT_AT: string;
}
