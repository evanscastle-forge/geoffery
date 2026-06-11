"""4-significant-figure rounding for recommended prices (D-011).

`round_sig(value, sigs, direction)` rounds an integer/float to at most
`sigs` significant figures. The direction argument biases the rounding
to favor fill on the user's side:

* `'up'`   — recommended for BUY offers (you pay a touch more so the
             offer fills). Equivalent to ceiling-at-step.
* `'down'` — recommended for SELL offers (you accept a touch less so the
             offer fills). Equivalent to floor-at-step.
* `'nearest'` — half-to-even bank-rounding, for non-recommendation uses.

The accuracy scorer evaluates the rounded number, never the internal
unrounded one — see `.claude/DECISIONS.md` D-011 "Price rounding rule".
"""

from __future__ import annotations

import math
from typing import Literal

Direction = Literal["up", "down", "nearest"]


def _step(value: int | float, sigs: int) -> int:
    """The 10**k step size for rounding a positive value to `sigs` sig figs."""
    if value == 0:
        return 1
    magnitude = math.floor(math.log10(abs(value)))
    # the lowest-kept place is at 10 ** (magnitude - sigs + 1)
    return 10 ** max(0, magnitude - sigs + 1)


def round_sig(value: int | float, sigs: int = 4, direction: Direction = "nearest") -> int:
    """Round `value` to no more than `sigs` significant figures.

    Returns an integer (recommended prices are integer gp).
    Direction biases as documented above. Zero and negative numbers are
    passed through with appropriate sign handling; in practice this is
    only ever called on non-negative gp prices.
    """
    if value == 0 or value is None:
        return 0
    sign = -1 if value < 0 else 1
    abs_value = abs(float(value))

    # For numbers already shorter than `sigs` figures, no rounding is needed.
    if abs_value < 10 ** (sigs - 1):
        return sign * int(round(abs_value))

    step = _step(abs_value, sigs)
    if step <= 1:
        return sign * int(round(abs_value))

    if direction == "up":
        rounded = math.ceil(abs_value / step) * step
    elif direction == "down":
        rounded = math.floor(abs_value / step) * step
    else:
        # half-to-even (banker's rounding) is what builtin round() does on
        # floats; the result is an integer multiple of step.
        rounded = round(abs_value / step) * step

    return int(sign * rounded)


def round_for_side(value: int | float, side: Literal["buy", "sell"], sigs: int = 4) -> int:
    """Convenience: round a recommended price for the given side.

    Buys round up (pay a touch more → fills faster).
    Sells round down (accept a touch less → fills faster).
    """
    return round_sig(value, sigs, "up" if side == "buy" else "down")
