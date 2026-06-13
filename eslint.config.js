// @ts-check
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "**/dist/**",
      "**/node_modules/**",
      "site/**",
      "**/*.json",
      ".data/**",
      // Cloudflare deploy entries: @cloudflare/workers-types ambient env, bundled
      // by wrangler (deploy-only). Not part of `npm run check`.
      "workers/*/src/worker.ts",
      "workers/_shared/**",
    ],
  },
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  // Core purity (spec §2): packages/core performs zero I/O. No node builtins,
  // no fetch, no env access, no storage adapters.
  {
    files: ["packages/core/src/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["node:*"], message: "core must be pure: no node builtins" },
            { group: ["@geoffery/data", "@geoffery/data/*"], message: "core must not import storage adapters" },
            { group: ["better-sqlite3", "hono", "@anthropic-ai/sdk"], message: "core must be pure: no I/O libraries" },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "fetch", message: "core must be pure: no network I/O" },
        { name: "process", message: "core must be pure: no env access" },
      ],
    },
  },
);
