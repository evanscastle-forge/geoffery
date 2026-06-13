// Instant search: forgiving substring match over the static index, ranked so
// prefix matches sort first. Keyboard accessible.

import { memberStar } from "./memberStar.ts";

interface Idx {
  slug: string;
  name: string;
  members: boolean;
}

export function initSearch(): void {
  const input = document.getElementById("site-search") as HTMLInputElement | null;
  const results = document.getElementById("site-search-results");
  if (!input || !results) return;

  let index: Idx[] | null = null;
  async function ensure(): Promise<void> {
    if (index) return;
    try {
      const res = await fetch("/items.json");
      index = (await res.json()) as Idx[];
    } catch {
      index = [];
    }
  }

  function render(q: string): void {
    const norm = q.trim().toLowerCase();
    results!.innerHTML = "";
    if (!norm || !index) {
      results!.hidden = true;
      return;
    }
    const hits = index
      .filter((i) => i.name.toLowerCase().includes(norm))
      .sort((a, b) => {
        const ap = a.name.toLowerCase().startsWith(norm) ? 0 : 1;
        const bp = b.name.toLowerCase().startsWith(norm) ? 0 : 1;
        return ap - bp || a.name.length - b.name.length;
      })
      .slice(0, 10);
    if (hits.length === 0) {
      results!.hidden = true;
      return;
    }
    for (const h of hits) {
      const li = document.createElement("li");
      const a = document.createElement("a");
      a.href = `/item/${h.slug}/`;
      a.innerHTML = `<span>${h.name}</span>${memberStar(h.members)}`;
      li.appendChild(a);
      results!.appendChild(li);
    }
    results!.hidden = false;
  }

  input.addEventListener("focus", () => void ensure());
  input.addEventListener("input", async () => {
    await ensure();
    render(input.value);
  });
  document.addEventListener("click", (e) => {
    if (!results!.contains(e.target as Node) && e.target !== input) results!.hidden = true;
  });
}
