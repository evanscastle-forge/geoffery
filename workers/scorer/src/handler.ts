// Scorer handler (spec §5): evaluate each consultation whose tolerance window has
// closed against subsequent 5m data, then rebuild per-cohort calibration. All
// decision logic is @geoffery/core (pure); this binds storage.

import { WINDOWS, fillRateByCohort, scorePrediction } from "@geoffery/core";
import type { Outcome } from "@geoffery/core";
import {
  heartbeat,
  insertOutcomeStatement,
  pendingConsultations,
  replaceCalibration,
  scoredPairs,
  snapshotsInWindow,
  type SqlStore,
} from "@geoffery/data";

export interface ScoreStats {
  considered: number;
  evaluated: number;
  filled: number;
  windowNotClosed: number;
}

const OUTCOME_BATCH = 100;

export async function runScorer(
  store: SqlStore,
  now: number = Math.floor(Date.now() / 1000),
): Promise<ScoreStats> {
  try {
    const pending = await pendingConsultations(store);
    let filled = 0;
    let notClosed = 0;

    // D1 cannot read inside a batch, so gather outcomes first (awaiting each
    // window read), then commit them as bounded atomic batches.
    const outcomes: Outcome[] = [];
    for (const c of pending) {
      const [startOff, endOff] = WINDOWS[c.tolerance];
      if (c.createdAt + endOff > now) {
        notClosed++;
        continue;
      }
      const snaps = await snapshotsInWindow(store, c.itemId, c.createdAt + startOff, c.createdAt + endOff);
      const outcome = scorePrediction(
        { id: c.id, side: c.side, tolerance: c.tolerance, recommendedPrice: c.recommendedPrice, createdAt: c.createdAt },
        snaps,
        now,
      );
      if (!outcome) {
        notClosed++;
        continue;
      }
      outcomes.push(outcome);
      if (outcome.filled) filled++;
    }

    const statements = outcomes.map(insertOutcomeStatement);
    for (let i = 0; i < statements.length; i += OUTCOME_BATCH) {
      await store.batch(statements.slice(i, i + OUTCOME_BATCH));
    }

    if (outcomes.length > 0) {
      await replaceCalibration(store, fillRateByCohort(await scoredPairs(store)), now);
    }

    await heartbeat(store, "scorer", true);
    return { considered: pending.length, evaluated: outcomes.length, filled, windowNotClosed: notClosed };
  } catch (e) {
    await heartbeat(store, "scorer", false, String(e));
    throw e;
  }
}
