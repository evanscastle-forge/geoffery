// Exchange Ledger copy (spec §8) as a TS module, so it imports cleanly under both
// Node type-stripping (workers) and Vite SSR (site) without JSON import attributes.
// Tier sequence: bronze → iron → steel → black → mithril → adamant → rune → dragon.
// Generic fantasy-metal aesthetics in house style — never game sprites. Within a
// tier, order alphabetically; amounts never shown.

export interface LedgerName {
  name: string;
  score: number;
  founding?: boolean;
  activeSeal?: boolean;
}

export const LEDGER = {
  tiers: {
    dragon: { label: "Dragon", remark: "Of dragon standing. The ledger remembers." },
    rune: { label: "Rune", remark: "Rune-marked. A generous hand." },
    adamant: { label: "Adamant", remark: "Adamant. Steadfast support." },
    mithril: { label: "Mithril", remark: "Mithril. Lighter than it looks, and worth more." },
    black: { label: "Black", remark: "Black. Quietly substantial." },
    steel: { label: "Steel", remark: "Steel. Dependable." },
    iron: { label: "Iron", remark: "Iron. A solid second coin." },
    bronze: { label: "Bronze", remark: "Bronze — the first coin in the jar. Every household begins here." },
  },
  foundingNote: "Of the founding household. Here from the first.",
  activeSeal: "A current supporter.",
  // Donor names land here as tips are recorded (post-MVP wiring writes them).
  names: [] as LedgerName[],
};
