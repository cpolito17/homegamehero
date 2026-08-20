# HomeGameHero Calculation Test Suite

## Purpose

This document defines an end-to-end calculation test suite for HomeGameHero.
It covers cash games, tournaments, chip distribution, rebuys, cashouts,
discrepancies, points, rounding, colour-up, settlements, and invalid input.

The expected amounts in this document are independent test oracles. Do not
change an expected amount to match the application. If the application and an
oracle disagree, record the failure, determine which rule is correct, and fix
the implementation or this document only after that decision is justified.

The suite is based on the current project structure:

- `src/state/reducer.ts` owns state transitions and ledger entries.
- `src/lib/money.ts` owns cents, points, parsing, rounding, and proportional allocation.
- `src/lib/chips.ts`, `src/lib/knapsack.ts`, and `src/lib/distribution.ts` build stacks and reserves.
- `src/lib/ledger.ts` calculates money in, cashouts, table stake, and chip inventory.
- `src/lib/payout.ts` calculates cash payouts, settlements, and tournament prizes.
- `src/lib/blinds.ts` calculates cash blinds and tournament schedules.
- `src/lib/colorup.ts` calculates chip races.
- `src/phases/` and `src/components/` provide the browser workflows.

## Required invariants

Every test must verify the final cash amount, not only an intermediate display.
Use exact cents. Do not use a tolerance for money.

For a cash game:

```text
pot = total buy-ins + rebuys + add-ons - completed cashouts
```

For a balanced count:

```text
sum(final active payouts) + sum(previous cashouts) = total money in
```

For `Scale to pot`, active payouts must sum to the current pot exactly.

For `Pay as counted`, active payouts must sum to the counted chip value.

For a tournament:

```text
prize pool = total buy-ins + rebuys + add-ons
```

Prize amounts must sum to the prize pool exactly. A player who already cashed
out must not participate in active cash-game transfers. A settled player must
remain visible in the final summary with the amount already paid.

## Test profiles

Use a fresh game for every case unless the case explicitly requires a mid-game
action.

### Standard dollar set

Use these values and quantities:

| Colour | Value | Quantity |
| --- | ---: | ---: |
| White | 25 cents | 200 |
| Red | $1 | 150 |
| Green | $5 | 100 |
| Black | $25 | 50 |

Use dollar scale, `$20` buy-ins, `$0.25/$0.50` blinds, Balanced distribution,
and two reserve stacks unless a case says otherwise.

### Fine dollar set

Use four colours worth 1 cent, 3 cents, 7 cents, and 11 cents. Use at least
2,000, 500, 300, and 100 chips respectively.

### Points set

Use 25, 100, 500, and 2,500 point chips with 50 points per dollar.

For the points-rounding case, configure 3 points per dollar.

## Standard execution procedure

1. Start a fresh local game.
2. Select the format and chip scale required by the case.
3. Configure the chip values, quantities, players, buy-ins, blinds, and reserve.
4. Calculate the distribution when the case uses the distribution workflow.
5. Start the game.
6. Perform rebuys, add-ons, cashouts, eliminations, or colour-ups required by the case.
7. Open the Payout phase.
8. Enter final chips by colour when the case specifies colour counts. Otherwise use total entry mode.
9. Select the required discrepancy resolution.
10. Record the displayed pot, counted value, difference, final payout for every player, and every transfer.
11. Compare the result with the oracle in this document.

For a negative test, the expected result may be an error, a blocked action, or
an unresolved payout. A negative test passes only when the application prevents
an invalid cashout or clearly exposes the inconsistency.

## Recording findings

Create `TEST_FINDINGS.md` when the suite is run. Record one row for every case:

| Case | Result | Expected | Actual | Reproduction | Severity | Fix commit |
| --- | --- | --- | --- | --- | --- | --- |
| C-01 | Pass/Fail/Blocked | Exact oracle | Observed result | Steps and inputs | Critical/High/Medium/Low | Commit SHA |

For every failure, include:

- the commit SHA tested;
- browser and viewport, if the failure is visual or workflow-related;
- exact chip values and quantities;
- exact player counts and buy-ins;
- every ledger action in order;
- final chip counts or totals;
- expected and actual pot, counted value, difference, payouts, and transfers;
- a screenshot or console output when useful;
- the suspected source file and function;
- whether the issue is a calculation error, validation error, state error, or display error.

Do not report only “the payout is wrong.” Record the first incorrect intermediate
value. This makes the defect reproducible.

## Instructions for a future agent

### Before running

1. Read this file completely.
2. Inspect the current branch, commit SHA, and worktree status.
3. Read the current versions of the source files named above. Do not assume the
   implementation still matches this document.
4. Confirm that the expected rules have not changed intentionally.
5. Do not modify the test oracles before running the affected cases.

### Run the automated checks first

From the repository root, run:

```bash
npm install
npm test
npm run typecheck
npm run lint
npm run build
npm run check:contrast
```

Record all failures before changing application code. Existing unit tests do
not replace the end-to-end cases below.

### Run the browser cases

1. Start the development server with `npm run dev`.
2. Open the local Vite URL.
3. Run each case in a fresh game.
4. Use reduced motion only if it does not hide a workflow problem.
5. Verify the visible payout and the underlying displayed pot/count/difference.
6. Use browser console inspection if a result is missing, stale, or `NaN`.
7. Save findings continuously. Do not rely on memory.

### Fixing failures

For each failure:

1. Reproduce it with the smallest input that still fails.
2. Identify the first wrong state or calculation value.
3. Add or update a focused regression unit test in the relevant `__tests__` directory.
4. Implement the smallest correct fix.
5. Re-run the focused test.
6. Re-run the full automated checks.
7. Re-run every browser case affected by the change.
8. Update `TEST_FINDINGS.md` with the root cause, fix, and verification result.

Do not weaken validation, hide a discrepancy, round away a missing cent, or
change a test oracle only to make the suite pass. Preserve unrelated work in the
worktree. Commit application fixes separately from documentation changes when
practical.

## Calculation and workflow cases

### Core cash and distribution

#### C-01 — One player

One player buys in for `$20` and finishes with `$20`.

Expected: pot `$20`; counted `$20`; final cashout `$20`; no transfers.

#### C-02 — Two players

Two players buy in for `$20`. Final totals are `$25` and `$15`.

Expected cashouts: `$25` and `$15`. Expected transfer: `$5` from the loser to the winner.

#### C-03 — Three players

Three `$20` buy-ins. Final totals are `$10`, `$20`, and `$30`.

Expected cashouts: `$10`, `$20`, and `$30`.

#### C-04 — Four uneven buy-ins

Buy-ins are `$10`, `$20`, `$40`, and `$60`. Final totals are `$5`, `$15`, `$45`, and `$65`.

Expected cashouts: `$5`, `$15`, `$45`, and `$65`. Pot: `$130`.

#### C-05 — Six players

Six `$20` buy-ins. Final totals are `$2.50`, `$5`, `$7.50`, `$15`, `$35`, and `$55`.

Expected total cashout: `$120`.

#### C-06 — Nine players

Nine `$10` buy-ins. Final totals are `$2.50`, `$5`, `$7.50`, `$10`, `$10`, `$10`, `$15`, `$15`, and `$15`.

Expected total cashout: `$90`.

#### C-07 — Wide stack range

Buy-ins are `$5`, `$20`, and `$60`. Final totals are `$2.50`, `$32.50`, and `$50`.

Expected total cashout: `$85`.

#### C-08 — Irregular chip denominations

Use the fine dollar set. Three players buy in for `$10` each. Enter these colour counts:

- Player A: 500×1-cent, 100×3-cent, 50×7-cent, 5×11-cent = `$12.05`.
- Player B: 400×1-cent, 50×3-cent, 60×7-cent, 4×11-cent = `$10.14`.
- Player C: 500×1-cent, 20×3-cent, 30×7-cent, 1×11-cent = `$7.81`.

Expected cashouts: `$12.05`, `$10.14`, and `$7.81`.

#### C-09 — Distribution profile comparison

Four `$20` players with two reserve stacks. Run Balanced, Efficient, and Deep as separate runs.
Use the generated per-colour stacks in the Payout phase.

Expected for every profile: each player cashes out exactly `$20`; every generated stack is worth `$20`.

#### C-10 — Uneven distribution with reserves

Buy-ins are `$20`, `$20`, `$40`, `$20`, and `$60`. Hold back three reserve stacks.
Use the generated stacks at payout.

Expected cashouts: `$20`, `$20`, `$40`, `$20`, and `$60`. The reserve standard stack is `$20`.

#### C-11 — Unmakeable buy-in

Use the standard set and give one player a `$20.10` buy-in.

Expected: exact-fit error. No valid final cashout may be produced from an unmakeable stack.

### Blind cases

#### B-01 — Standard blind recommendation

Use a `$20` stack, the standard chip set, and a 50-BB target.

Expected recommendation: `$0.25/$0.50`. Complete the game with a `$20` final stack and verify a `$20` cashout.

#### B-02 — No half-big-blind chip

Use only `$1` and `$5` chips. A player buys in for `$20`.

Expected blinds: `$1/$1`, with the equal-blind warning. Final cashout remains `$20`.

### Ledger, rebuy, and cashout cases

#### L-01 — One rebuy

Four players buy in for `$20`. Player A rebuys for `$20`. Final totals are `$35`, `$25`, `$20`, and `$20`.

Expected pot and total cashout: `$100`.

#### L-02 — Multiple rebuys

Three players buy in for `$20`.

- Player A rebuys for `$10` and `$15`.
- Player B rebuys for `$5`.

Final totals are `$45`, `$30`, and `$15`.

Expected total cashout: `$90`.

#### L-03 — Rebuy after the box is exhausted

Use only `$1` chips, with 80 chips available. Four players buy in for `$20`, consuming the box.
Player A attempts a `$20` rebuy.

Expected: the rebuy is rejected or clearly marked unavailable. The application must not silently add
`$20` to the pot without issuing chips.

If it records the rebuy, the diagnostic oracle is: pot `$100`, counted `$80`, delta `-$20`, and no
valid unscaled cashout.

#### L-04 — Early cashout

Three players buy in for `$20`. Player A cashes out for `$15` and leaves. The two active players finish
with `$25` and `$20`.

Expected cashouts: `$15`, `$25`, and `$20`. Total paid: `$60`. Current pot after the cashout: `$45`.

#### L-05 — Rebuy followed by cashout

Three players buy in for `$20`. Player A rebuys for `$20`, then cashes out for `$30`. The remaining
players finish with `$30` and `$20`.

Expected cashouts: `$30`, `$30`, and `$20`. Current pot: `$50`. Total paid: `$80`.

#### L-06 — Multiple early cashouts

Five players buy in for `$20`.

- Player A cashes out for `$15`.
- Player B cashes out for `$30`.
- Players C, D, and E finish with `$10`, `$20`, and `$25`.

Expected cashouts: `$15`, `$30`, `$10`, `$20`, and `$25`. Total paid: `$100`.

#### L-07 — Undo a cashout

Three players buy in for `$20`. Player A cashes out for `$15`, then undo the cashout ledger entry.
Final totals are `$10`, `$20`, and `$30`.

Expected: all three players are active; pot `$60`; cashouts `$10`, `$20`, and `$30`.

#### L-08 — Everyone cashes out early

Two players buy in for `$20`. Player A cashes out for `$12`; Player B cashes out for `$28`.

Expected: both previous cashouts remain visible, current pot `$0`, no active payout required, and the
night can still be closed.

#### L-09 — Late arrival

Start with two `$20` players. Add a late player during the game and give that player one `$20` rebuy.
Final totals are `$20`, `$20`, and `$20`.

Expected pot and total cashout: `$60`. The late player must not be counted twice.

### Discrepancy and conversion cases

For D-01 through D-05, use buy-ins of `$20`, `$20`, `$20`, and `$40`.

#### D-01 — Undercount with Recount selected

Enter final totals of `$30`, `$20`, `$20`, and `$20`. The pot is `$100`, and counted chips are `$90`.

Expected: no accepted cashout while Recount is selected. Finishing the night must be blocked.

#### D-02 — Undercount scaled to the pot

Use the same setup as D-01 and select Scale to pot.

Expected cashouts: `$33.34`, `$22.22`, `$22.22`, and `$22.22`. Total: `$100`.

#### D-03 — Undercount paid as counted

Use the same setup as D-01 and select Pay as counted.

Expected cashouts: `$30`, `$20`, `$20`, and `$20`. Total: `$90`, with a warning.

#### D-04 — Overcount scaled to the pot

Enter final totals of `$40`, `$30`, `$20`, and `$20`. The pot is `$100`, and counted chips are `$110`.

Expected cashouts: `$36.37`, `$27.27`, `$18.18`, and `$18.18`. Total: `$100`.

#### D-05 — Overcount paid as counted

Use the same setup as D-04 and select Pay as counted.

Expected cashouts: `$40`, `$30`, `$20`, and `$20`. Total: `$110`, with a warning.

#### D-06 — Largest-remainder cent allocation

Use the fine set. Three players buy in for `$5`. Enter final totals of `$3.33`, `$3.33`, and `$3.34`.
Select Scale to pot.

Expected cashouts: `$5.00`, `$4.99`, and `$5.01`. Total: `$15`.

#### D-07 — Points scale with exact conversion

Use 50 points per dollar. Two players buy in for `$20`. Final totals are 1,500 and 500 points.

Expected cashouts: `$30` and `$10`.

#### D-08 — Points scale with rounding

Configure 3 points per dollar. Set buy-ins to `$0.34`, `$0.33`, and `$0.33`. Enter one point for each
player.

Expected cashouts: `$0.34`, `$0.33`, and `$0.33`.

#### D-09 — Chip-count mode versus total mode

Two players buy in for `$20`.

By-colour entry:

- Player A: four 25-cent chips, five `$1` chips, and two `$5` chips = `$16`.
- Player B: four `$1` chips and four `$5` chips = `$24`.

Expected in chip mode: `$16` and `$24`. Switch to total mode and enter 1,600 and 2,400 units. The
result must remain identical.

#### D-10 — Zero and negative inputs

Run two subcases:

- All players enter zero chips against a positive pot.
- One player enters a negative total.

Expected: no negative cashout may be accepted. A zero-count case must remain unresolved rather than
silently settling the pot.

### Edge and settlement cases

#### E-01 — Duplicate chip denominations

Create two colours worth 25 cents each. Give Player A 80 chips of the first colour and Player B 80
chips of the second colour. Both players buy in for `$20`.

Expected cashouts: `$20` and `$20`.

#### E-02 — One denomination only

Use only `$1` chips. Three players buy in for `$10`.

Expected cashouts: `$10`, `$10`, and `$10`, with a coarse-betting warning.

#### E-03 — Blank and zero-quantity colours

Give one colour a value but zero quantity. Use two active colours for the final count. Two players buy
in for `$20` and finish with `$10` each.

Expected: the unused colour is excluded from calculations; cashouts are `$10` and `$10`.

#### E-04 — Large cent amount and formatted input

Use 1-cent chips. One player buys in for `$1,234.56`. Enter the final amount with comma formatting.

Expected exact cashout: `$1,234.56`.

#### E-05 — Colour-up accounting

Use 25-cent chips and `$1` chips with `$1/$2` blinds.

Run these variants:

1. Four 25-cent chips per player become one `$1` chip each. Expected cashouts: `$20/$20`.
2. Without short-stack protection, race seven small chips from A and one from B. After conversion, final
   totals of `$21/$19` must cash out as `$21/$19`.
3. With short-stack protection, the converted totals may become `$21/$20`. The application must show
   counted `$41` against a `$40` pot. Scaling should produce `$20.49/$19.51`; accepting the count
   produces `$21/$20`.

#### E-06 — Settlement transfer conservation

Five `$20` players finish with `$5`, `$15`, `$20`, `$25`, and `$35`.

Expected cashouts are those exact amounts. Expected transfers:

- Player 1 pays Player 5: `$15`.
- Player 2 pays Player 4: `$5`.

### Tournament cases

#### T-01 — Three-player freezeout

Three `$20` entries. Prize split: 50% / 30% / 20%. Finish order: A, B, C.

Expected prizes: `$30`, `$18`, and `$12`.

#### T-02 — Odd-cent prize pool

Five players buy in for `$20.01`. Prize split: 50% / 30% / 20%.

Pool: `$100.05`.

Expected prizes: `$50.03`, `$30.01`, and `$20.01`.

#### T-03 — Rebuy and add-on included

Four `$20` entries. Player A makes a `$20` rebuy. Player B takes a `$30` add-on. Split: 60% / 30% /
10%.

Expected pool: `$130`. Expected prizes: `$78`, `$39`, and `$13`.

#### T-04 — Multiple tournament rebuys

Three `$20` entries. Player A makes two `$10` rebuys. Split: 50% / 30% / 20%.

Expected pool: `$80`. Expected prizes: `$40`, `$24`, and `$16`.

#### T-05 — Multiple survivors

Four `$20` entries. Eliminate only Player C. Split: 40% / 30% / 20% / 10%.

Expected finish order: A, B, D, C. Expected prizes: A `$32`, B `$24`, D `$16`, C `$8`.

#### T-06 — Invalid prize split

Three `$20` entries. Configure a 60% / 30% split.

Expected: invalid split warning and no valid final cashout. The night must not finish while the split
totals 90%.

#### T-07 — Rebuy cutoff

Set rebuys through level 1. Advance the clock to level 2 and attempt a rebuy.

Expected: rebuy unavailable, pool remains `$60`, and a 100% winner payout is `$60`.

#### T-08 — Tournament points

Four `$20` entries using 50 points per dollar. Split: 50% / 25% / 15% / 10%.

Expected prizes: `$40`, `$20`, `$12`, and `$8`.

#### T-09 — One-player tournament

One `$20` entry with a 100% first-place split.

Expected prize: `$20`.

#### T-10 — Tournament schedule integration

Use eight `$20` entries, 15-minute levels, a 180-minute target, antes beginning at level 5, and breaks
every four levels.

Verify the schedule structure, then finish with a 100% winner split.

Expected final prize: `$160`.

## Completion criteria

The suite is complete only when:

- every case has a recorded result;
- every passing case matches its exact cashout oracle;
- every blocked case blocks the invalid action for the correct reason;
- every defect has a reproducible finding and regression test;
- `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and
  `npm run check:contrast` pass after the fixes;
- all affected browser cases pass again after the fixes.

