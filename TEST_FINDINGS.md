# Test Findings — CALCULATION_TEST_SUITE.md

**Commit tested:** `59bc0f3` (baseline) → fixes applied on top
**Date:** 2026-08-20
**Runner:** Vitest, driving the real reducer and payout engine

## How the cases were run

Each case is encoded as an automated test in `src/__tests__/`, driving the same
code path the browser drives. The harness (`src/__tests__/harness.ts`) dispatches
real reducer actions and then calls `computeCashPayout` with exactly the inputs
`src/phases/Payout.tsx` passes it:

```ts
chipUnits:      payoutUnitsFor(state, p.id)
buyInCents:     moneyIn(state.ledger, p.id)
cashedOutCents: moneyOut(state.ledger, p.id)
left:           Boolean(p.leftAt)
```

This means a case exercises the production calculation, not a reimplementation of
it. Every money assertion is in exact integer cents with no tolerance.

**What this does not cover:** input parsing in the browser, focus and blur
behaviour of the number fields, and the disabled state of controls. Those were
checked by hand at 1440px and 390px. One of the three defects below (F-3) lives
in a control's `disabled` expression and was found by reading the guard the
automated case depends on, then confirmed against the reducer.

## Automated check baseline

| Check | Before | After |
| --- | --- | --- |
| `npm test` | 132 passed | 189 passed |
| `npm run typecheck` | clean | clean |
| `npm run lint` | 0 errors, 5 warnings | 0 errors, 5 warnings |
| `npm run build` | pass | pass |
| `npm run check:contrast` | all pairs pass | all pairs pass |

The 5 lint warnings are pre-existing `react-refresh/only-export-components`
notices on files that export both a component and a helper. Not calculation
related, not introduced by this work.

## Defects found

### F-1 — The whole pot was awarded to the first player when nothing was counted

**Severity: Critical.** Real money, silently misdirected.

`allocateProportional(total, weights)` in `src/lib/money.ts` had a fallback: when
every weight was zero it assigned the entire total to slot 0. In the payout path
the weights are each player's counted chips, so opening the Payout phase with
`Scale to pot` selected and nothing yet counted declared player one the winner of
the whole pot.

Its comment claimed it avoided "inventing a spread", which is exactly what it did.

- **First wrong value:** `allocateProportional(10000, [0,0,0,0])` → `[10000,0,0,0]`, expected `[0,0,0,0]`.
- **Reproduction:** four players, $20/$20/$20/$40. Start the game, open Payout, choose Scale to pot, enter nothing.
- **Fix:** allocate nothing when there is no weight to split on, and let the caller surface the unaccounted total.
- **Regression tests:** `suite-discrepancy.test.ts` D-10c; `money.test.ts` "allocates nothing when there is no weight to split on".

The pre-existing unit test asserted the defective behaviour
(`expect(allocateProportional(500, [0, 0])).toEqual([500, 0])`) under the name
"handles zero weights without inventing a spread". The oracle was wrong, not the
observation, so the test was corrected along with the code.

### F-2 — An empty count reported that the totals came out even

**Severity: Medium.** Misleading validation, surfaced by the same case as F-1.

With `Scale to pot` selected and a non-zero pot, `computeCashPayout` always
pushed the info notice "Payouts scaled to match the cash actually in the pot, so
the total comes out even." After F-1 was fixed, an empty count pays everyone zero,
so that message was actively false: the pot is entirely unpaid.

- **Fix:** when nothing is counted against a live pot, raise an error notice saying there is no share to scale, instead of the reassuring info notice.
- **Regression test:** `suite-discrepancy.test.ts` D-10c asserts an error-level notice.

### F-3 — Busted players could rebuy after the rebuy window closed

**Severity: High.** Money entering the prize pool after entries close.

In `src/components/GamePlayers.tsx` the control read:

```tsx
disabled={rebuyLocked && !busted}
```

so once past the cutoff the Rebuy button was *enabled* for exactly the players
most likely to press it. The rule was also enforced nowhere else: the `rebuy`
reducer case accepted any rebuy at any level, so the cutoff rested entirely on a
`disabled` attribute.

- **Reproduction:** tournament, rebuys through level 1, advance the clock to level 2, bust a player, press Rebuy. The pool grows past $60.
- **Fix:** `disabled={rebuyLocked}`, plus a new `rebuysClosed(state)` guard in the reducer's `rebuy` case so the rule holds regardless of the UI.
- **Regression test:** `suite-tournament.test.ts` T-07 attempts a rebuy from both an active and a busted player past the cutoff and asserts the pool stays at $60.

## Mutation verification

Each fix was confirmed to be genuinely guarded by reintroducing the defect and
observing the suite fail:

| Defect reintroduced | Tests that failed |
| --- | --- |
| F-1 allocator fallback | 2 (D-10c, money allocator) |
| F-3 rebuy cutoff guard | 1 (T-07) |

## Case results

All cases pass after the fixes above.

| Case | Result | Notes |
| --- | --- | --- |
| C-01 one player | Pass | $20 in, $20 out, no transfers |
| C-02 two players | Pass | $25/$15, one $5 transfer |
| C-03 three players | Pass | $10/$20/$30 |
| C-04 four uneven buy-ins | Pass | pot $130 |
| C-05 six players | Pass | total $120 |
| C-06 nine players | Pass | total $90 |
| C-07 wide stack range | Pass | total $85 |
| C-08 1c/3c/7c/11c set | Pass | $12.05 / $10.14 / $7.81 |
| C-09 balanced profile | Pass | every stack exactly $20 |
| C-09 efficient profile | Pass | every stack exactly $20 |
| C-09 deep profile | Pass | every stack exactly $20 |
| C-10 uneven with 3 reserves | Pass | standard stack $20, issued = buy-ins |
| C-11 unmakeable $20.10 | Pass | stack not exact, distribution infeasible, error raised |
| B-01 standard blinds | Pass | $0.25/$0.50 at 50BB |
| B-02 no half-blind chip | Pass | equal blinds with warning |
| L-01 one rebuy | Pass | pot and payout $100 |
| L-02 multiple rebuys | Pass | total $90 |
| L-03 rebuy past an empty box | Pass | short issue is flagged, box never goes negative, -$20 delta surfaced |
| L-04 early cashout | Pass | pot $45, paid $60 |
| L-05 rebuy then cashout | Pass | pot $50, paid $80 |
| L-06 two early cashouts | Pass | paid $100 |
| L-07 undo a cashout | Pass | player reactivated, pot $60 |
| L-08 everyone leaves early | Pass | pot $0, both cashouts preserved |
| L-09 late arrival | Pass | pot $60, counted once |
| L-09b late arrival with rebuy | Pass | pot $80, both entries booked once |
| D-01 undercount, Recount | Pass | -$10 delta raised as an error |
| D-02 undercount, Scale | Pass | $33.34 / $22.22 / $22.22 / $22.22 = $100 |
| D-03 undercount, Pay as counted | Pass | $90 with warning |
| D-04 overcount, Scale | Pass | $36.37 / $27.27 / $18.18 / $18.18 = $100 |
| D-05 overcount, Pay as counted | Pass | $110 with warning |
| D-06 largest remainder | Pass | $5.00 / $4.99 / $5.01 = $15 |
| D-07 points, exact | Pass | $30 / $10 |
| D-08 points, 3 per dollar | Pass | $0.34 / $0.33 / $0.33 = $1.00 |
| D-09 colour vs total entry | Pass | identical results |
| D-10a all-zero count | Pass | unresolved, error raised, no payout |
| D-10b negative entry | Pass | no negative payout in any resolution |
| D-10c all-zero, Scale | **Fail → fixed** | F-1 and F-2 |
| E-01 duplicate denominations | Pass | $20 / $20 |
| E-02 single denomination | Pass | $10 each, coarse-blind notice |
| E-03 zero-quantity colour | Pass | excluded from the working set |
| E-04 $1,234.56 | Pass | exact |
| E-05a clean colour-up | Pass | value conserved |
| E-05b unprotected race | Pass | $2 in, $2 out, nothing created |
| E-05c protected short stack | Pass | value created and reported |
| E-05d protected race at payout | Pass | $20.49 / $19.51 scaled; $21 / $20 accepted |
| E-06 settlement conservation | Pass | exactly the two expected transfers |
| T-01 three-player freezeout | Pass | $30 / $18 / $12 |
| T-02 odd-cent pool | Pass | $50.03 / $30.01 / $20.01 = $100.05 |
| T-03 rebuy and add-on | Pass | pool $130, $78 / $39 / $13 |
| T-04 two rebuys | Pass | pool $80 |
| T-05 multiple survivors | Pass | A, B, D, C order and prizes |
| T-06 invalid split | Pass | 90% split rejected |
| T-07 rebuy cutoff | **Fail → fixed** | F-3 |
| T-08 tournament points | Pass | $40 / $20 / $12 / $8 |
| T-09 one-player tournament | Pass | $20 |
| T-10 schedule integration | Pass | monotonic blinds, breaks, antes from level 5, $160 |

## Notes on two oracles

**T-03** describes Player B's $30 as an "add-on". The reducer labels a ledger
entry `addon` only when the amount equals the configured add-on price, so a $30
entry against a $20 add-on price is recorded as a rebuy. The label is cosmetic;
both kinds feed the pool identically and the $130 oracle holds either way. Left
as is rather than reshaping the ledger to satisfy a naming detail.

**L-09** gives the late player a rebuy but states a $60 pot, which is the total
for three $20 entries with no rebuy. The case is covered both ways: L-09 asserts
the $60 reading, and L-09b adds the rebuy explicitly and asserts $80, which is
the arithmetic the description implies.
