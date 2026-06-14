// Monthly tip ledger (owner directive 2026-06-14). Curated by hand at MVP — real
// payments are stubbed, so this file is the source of truth for the donor list and
// the tip-jar fill. Amounts are never shown publicly (spec §8); `total`/`goal` (USD)
// drive only the jar level and the monthly bonus threshold. Display names are passed
// through cleanName() at render. Newest month first.

export interface DonationMonth {
  /** "YYYY-MM" */
  month: string;
  /** USD goal that, once reached, unlocks bonus consultations for everyone that month. */
  goal: number;
  /** USD raised so far this month (curated; never shown as a figure). */
  total: number;
  /** Donor display names, in the order given. */
  donors: string[];
}

// Placeholder seed — replace with real entries as tips arrive. The current month
// starts empty; one prior month is filled past its goal to show the "met" state.
export const DONATIONS: DonationMonth[] = [
  { month: "2026-06", goal: 50, total: 0, donors: [] },
  {
    month: "2026-05",
    goal: 50,
    total: 60,
    donors: ["Maeve of Falador", "kandarin_keith", "A. Patron", "Anonymous"],
  },
];

/**
 * Tip-jar fill level 0 (least full) → 4 (full) from the raised/goal ratio.
 * The full jar (4) is used only at or above the monthly goal; the rest spread the
 * 0–100% range across the other four images (owner directive 2026-06-14).
 */
export function jarLevel(total: number, goal: number): 0 | 1 | 2 | 3 | 4 {
  if (goal <= 0 || total <= 0) return 0;
  const r = total / goal;
  if (r >= 1) return 4;
  return Math.min(3, Math.floor(r * 4)) as 0 | 1 | 2 | 3;
}

/** Has this month reached its goal (→ bonus usage for everyone)? */
export function thresholdMet(m: DonationMonth | undefined): boolean {
  return !!m && m.goal > 0 && m.total >= m.goal;
}

/** Find a month by "YYYY-MM" key. */
export function monthOf(months: DonationMonth[], key: string): DonationMonth | undefined {
  return months.find((m) => m.month === key);
}

// --- Easter egg: a couple of procedurally-generated, very silly "patrons" per month.
// Deterministic from the month key so the same month always shows the same names; blended
// into the real donor list for the sharp-eyed to find (owner directive 2026-06-14).
const SILLY_FIRST = ["Bald", "Sir", "Lord", "Lil", "Big", "Old", "Lvl3", "Mega", "Tiny", "Grandmaster"];
const SILLY_PLACE = ["Falador", "Lumbridge", "Varrock", "Draynor", "Gielinor", "Wildy", "Barrows", "Karamja", "Edgeville", "Rimmington"];
const SILLY_NAME = ["Phil", "Larry", "Dan", "Gary", "Wendy", "Bob", "Betty", "Randy", "Vera", "Greg", "Doris"];

/** 1–2 deterministic silly patron names for a "YYYY-MM" month key. */
export function easterEggPatrons(monthKey: string): string[] {
  let s = 2166136261 >>> 0;
  for (const ch of `patron|${monthKey}`) {
    s ^= ch.charCodeAt(0);
    s = Math.imul(s, 16777619) >>> 0;
  }
  const rnd = () => ((s = (Math.imul(1664525, s) + 1013904223) >>> 0) / 0x100000000);
  const pick = <T>(a: T[]): T => a[Math.floor(rnd() * a.length)]!;
  const count = rnd() < 0.5 ? 1 : 2;
  const out: string[] = [];
  for (let i = 0; i < count; i++) {
    const pat = Math.floor(rnd() * 3);
    if (pat === 0) out.push(`${pick(SILLY_FIRST)} ${pick(SILLY_NAME)} of ${pick(SILLY_PLACE)}`);
    else if (pat === 1) out.push(`${pick(SILLY_PLACE)}${pick(SILLY_NAME)}`);
    else out.push(`xX_${pick(SILLY_PLACE)}_${pick(SILLY_NAME)}_Xx`);
  }
  return out;
}
