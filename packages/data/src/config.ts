// Environment + config resolution. Adapters and workers read config here so the
// process.env surface stays in one place. Never logs secret values.

import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

/** Parse a .env file into process.env (without overwriting already-set vars). */
export function loadDotenv(path = ".env"): void {
  const abs = resolve(process.cwd(), path);
  if (!existsSync(abs)) return;
  for (const raw of readFileSync(abs, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let val = line.slice(eq + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = val;
  }
}

export interface Config {
  deployment: string;
  siteUrl: string;
  userAgent: string;
  archiveDir: string;
  dbPath: string;
  legacyDbPath: string;
  consultPort: number;
  anthropicApiKey: string | undefined;
  newsClassifierModel: string;
}

export function loadConfig(): Config {
  loadDotenv();
  const env = process.env;
  return {
    deployment: env.GEOFFERY_DEPLOYMENT_NAME ?? "local",
    siteUrl: env.GEOFFERY_SITE_URL ?? "http://127.0.0.1:4321",
    userAgent: env.GEOFFERY_USER_AGENT ?? "Geoffery local-dev (contact@evancastle.com)",
    archiveDir: resolve(process.cwd(), env.GEOFFERY_ARCHIVE_DIR ?? "./.data/archive"),
    dbPath: resolve(process.cwd(), env.GEOFFERY_DB ?? "./.data/geoffery.db"),
    legacyDbPath: resolve(
      process.cwd(),
      env.GEOFFERY_LEGACY_DB ?? "../geoffery_old/data/geoffery.db",
    ),
    consultPort: Number(env.GEOFFERY_CONSULT_PORT ?? "8787"),
    anthropicApiKey: env.ANTHROPIC_API_KEY || undefined,
    newsClassifierModel: env.GEOFFERY_NEWS_CLASSIFIER_MODEL ?? "claude-haiku-4-5-20251001",
  };
}
