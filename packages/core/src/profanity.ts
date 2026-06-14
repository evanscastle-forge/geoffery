// Basic profanity masking for user-supplied donor names (owner directive 2026-06-14).
// A small, deliberately conservative word list — it masks matches and clamps length.
// A courtesy filter, not a guarantee: curated names still get a human eye before they ship.

const BANNED = [
  "fuck", "shit", "cunt", "bitch", "bastard", "asshole", "dick", "piss",
  "slut", "whore", "nigger", "faggot", "retard", "rape",
];
const RE = new RegExp(`(${BANNED.join("|")})`, "gi");
const MAX_LEN = 40;

/** Mask profanity in a display name; blank/empty → a neutral placeholder. */
export function cleanName(raw: string | null | undefined): string {
  const s = (raw ?? "").replace(/\s+/g, " ").trim();
  if (!s) return "Anonymous patron";
  const masked = s.replace(RE, (m) => m[0] + "*".repeat(Math.max(1, m.length - 1)));
  return masked.length > MAX_LEN ? masked.slice(0, MAX_LEN).trimEnd() + "…" : masked;
}
