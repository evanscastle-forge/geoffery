// Item slug generation — part of the URL one-way door (spec §4 SEO).
// Slug from name once at first sight; never regenerate. Ported from `slug.py`.

export function slugify(name: string): string {
  const s = name
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/'/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "item";
}

/** Deterministic, collision-safe slug assignment over a catalogue. The lowest
 *  id to claim a slug keeps it; later collisions get a `-{id}` suffix. Slugs
 *  are never reassigned once minted. */
export function assignSlugs(items: { id: number; name: string }[]): Map<number, string> {
  const taken = new Set<string>();
  const out = new Map<number, string>();
  for (const item of [...items].sort((a, b) => a.id - b.id)) {
    let slug = slugify(item.name);
    if (taken.has(slug)) slug = `${slug}-${item.id}`;
    taken.add(slug);
    out.set(item.id, slug);
  }
  return out;
}
