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
  // Engine firewall (spec §6): the offer engine never reads news/wiki signals.
  {
    files: ["packages/core/src/offers.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["*news*", "*wiki*"], message: "firewall: offers must not import news/wiki types" },
          ],
        },
      ],
    },
  },
);
