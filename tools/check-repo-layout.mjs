#!/usr/bin/env node
// Repo-layout gate: the top level stays lean (see .claude/CHARTER.md → "Repo layout").
// Compares git-visible top-level entries against an allowlist and fails on surprises.
// Owned by the `db` agent (WHO-FIXES-WHAT.md). `git ls-files -co --exclude-standard`
// lists tracked + untracked files while honouring .gitignore, so a stray new file is
// caught but gitignored cruft (node_modules, .data, local, .env, .git) is not.
import { execSync } from "node:child_process";

// Allowed top-level entries. New prose docs go in docs/, relocatable config in config/.
const ALLOWED = new Set([
  // spec & governance docs (read every session)
  "README.md",
  "BUILD-SPEC.md",
  "SYSTEM_ARCHITECTURE.md",
  "DECISIONS.md",
  "WHO-FIXES-WHAT.md",
  // build configs tooling resolves from root
  "package.json",
  "package-lock.json",
  "tsconfig.json",
  "vitest.config.ts",
  "eslint.config.js",
  // dotfiles discovered only at root
  ".gitignore",
  ".mcp.json",
  ".nvmrc",
  ".env.example",
  // directories
  ".claude",
  "config",
  "docs",
  "ops",
  "packages",
  "site",
  "tools",
  "workers",
]);

const visible = execSync("git ls-files --cached --others --exclude-standard", {
  encoding: "utf8",
})
  .split("\n")
  .filter(Boolean);

const topLevel = new Set(visible.map((p) => p.split("/")[0]));

const unexpected = [...topLevel].filter((e) => !ALLOWED.has(e)).sort();

if (unexpected.length > 0) {
  console.error("repo layout check FAILED — unexpected top-level entries:");
  for (const e of unexpected) console.error(`  - ${e}`);
  console.error(
    "\nThe repo root stays lean. A new prose doc belongs in docs/; relocatable build\n" +
      "config belongs in config/. If this entry truly must live at the root, add it to\n" +
      "the allowlist in tools/check-repo-layout.mjs (db owns this — see CHARTER 'Repo layout').",
  );
  process.exit(1);
}

console.log(`repo layout check PASSED: ${topLevel.size} top-level entries, all allowed`);
