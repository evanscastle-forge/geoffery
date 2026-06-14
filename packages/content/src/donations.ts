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

/** Tip-jar level 0 (empty) → 3 (overflowing) from the raised/goal ratio. */
export function jarLevel(total: number, goal: number): 0 | 1 | 2 | 3 {
  if (goal <= 0 || total <= 0) return 0;
  const r = total / goal;
  if (r >= 1) return 3;
  if (r >= 0.5) return 2;
  return 1;
}

/** Has this month reached its goal (→ bonus usage for everyone)? */
export function thresholdMet(m: DonationMonth | undefined): boolean {
  return !!m && m.goal > 0 && m.total >= m.goal;
}

/** Find a month by "YYYY-MM" key. */
export function monthOf(months: DonationMonth[], key: string): DonationMonth | undefined {
  return months.find((m) => m.month === key);
}
