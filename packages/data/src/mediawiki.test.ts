import { expect, test } from "vitest";
import { shortSummary, sourcePages } from "./mediawiki.ts";

test("shortSummary strips wiki markup to original phrasing", () => {
  const body = "'''Big news''': the [[Twisted bow|twisted bow]] gets a {{buff}} buff.<ref>cite</ref>";
  const s = shortSummary(body);
  expect(s).toBe("Big news: the twisted bow gets a buff.");
  expect(s).not.toContain("[[");
  expect(s).not.toContain("{{");
  expect(s).not.toContain("<ref");
});

test("shortSummary truncates long bodies with an ellipsis", () => {
  const s = shortSummary("word ".repeat(200), 50);
  expect(s.length).toBeLessThanOrEqual(51);
  expect(s.endsWith("…")).toBe(true);
});

test("source pages include the three spec-named pages + current year", () => {
  const pages = sourcePages(new Date(Date.UTC(2026, 5, 12)));
  expect(pages).toContain("Upcoming_updates");
  expect(pages).toContain("Updates");
  expect(pages).toContain("2026");
});
