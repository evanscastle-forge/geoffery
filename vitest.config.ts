import { defineConfig } from "vitest/config";
import type { Plugin } from "vite";

// node:sqlite (the SqliteStore seam) is a native builtin too new to be in vite's
// auto-externalized list (module.builtinModules has "node:sqlite" but not the
// bare "sqlite" vite checks), so vite tries to bundle it and fails. Shim it to a
// runtime createRequire so Node loads the native module (v22.5+) under vitest.
const SHIM_ID = "\0node-sqlite-shim";
const provideNodeSqlite: Plugin = {
  name: "provide-node-sqlite",
  enforce: "pre",
  resolveId(id) {
    if (id === "node:sqlite" || id === "sqlite") return SHIM_ID;
    return null;
  },
  load(id) {
    if (id !== SHIM_ID) return null;
    return [
      'import { createRequire } from "node:module";',
      "const require = createRequire(import.meta.url);",
      'const sqlite = require("node:sqlite");',
      "export const DatabaseSync = sqlite.DatabaseSync;",
      "export default sqlite;",
    ].join("\n");
  },
};

export default defineConfig({
  plugins: [provideNodeSqlite],
  test: {
    include: ["packages/**/*.test.ts", "workers/**/*.test.ts", "tools/**/*.test.ts"],
    environment: "node",
  },
});
