import { expect, test } from "vitest";
import { cleanName } from "./profanity.ts";

test("cleanName passes clean names through", () => {
  expect(cleanName("Maeve of Falador")).toBe("Maeve of Falador");
  expect(cleanName("  kandarin_keith ")).toBe("kandarin_keith");
});

test("cleanName masks profanity, keeping the first letter", () => {
  const masked = cleanName("shitlord");
  expect(masked.toLowerCase()).not.toContain("shit");
  expect(masked[0]).toBe("s");
  expect(masked).toContain("*");
});

test("cleanName falls back to a placeholder for blank input", () => {
  expect(cleanName("")).toBe("Anonymous patron");
  expect(cleanName("   ")).toBe("Anonymous patron");
  expect(cleanName(null)).toBe("Anonymous patron");
});

test("cleanName clamps very long names", () => {
  const out = cleanName("x".repeat(80));
  expect(out.length).toBeLessThanOrEqual(41); // 40 + ellipsis
  expect(out.endsWith("…")).toBe(true);
});
