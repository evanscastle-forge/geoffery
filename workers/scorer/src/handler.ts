// Scorer handler (spec §5): evaluate each consultation whose tolerance window has
// closed against subsequent 5m data, then rebuild per-cohort calibration. All
// decision logic is @geoffery/core (pure); this binds storage.

import { WINDOWS, fillRateByCohort, scorePrediction } from "@geoffery/core";
import {
  heartbeat,
  insertOutcome,
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

export function runScorer(store: SqlStore, now: number = Math.floor(Date.now() / 1000)): ScoreStats {
  try {
    const pending = pendingConsultations(store);
    let evaluated = 0;
    let filled = 0;
    let notClosed = 0;

    store.transaction(() => {
      for (const c of pending) {
        const [, endOff] = WINDOWS[c.tolerance];
        if (c.createdAt + endOff > now) {
          notClosed++;
          continue;
        }
        const [startOff, end] = [WINDOWS[c.tolerance][0], WINDOWS[c.tolerance][1]];
        const snaps = snapshotsInWindow(store, c.itemId, c.createdAt + startOff, c.createdAt + end);
        const outcome = scorePrediction(
          { id: c.id, side: c.side, tolerance: c.tolerance, recommendedPrice: c.recommendedPrice, createdAt: c.createdAt },
          snaps,
          now,
        );
        if (!outcome) {
          notClosed++;
          continue;
        }
        insertOutcome(store, outcome);
        evaluated++;
        if (outcome.filled) filled++;
      }
    });

    if (evaluated > 0) {
      replaceCalibration(store, fillRateByCohort(scoredPairs(store)), now);
    }

    heartbeat(store, "scorer", true);
    return { considered: pending.length, evaluated, filled, windowNotClosed: notClosed };
  } catch (e) {
    heartbeat(store, "scorer", false, String(e));
    throw e;
  }
}
