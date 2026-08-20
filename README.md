# HomeGameHero

A chip, blind, and payout calculator for home poker games. Runs entirely in the
browser, works offline, and keeps everything on the host's device.

Three phases, matching how a night actually goes:

**Pre-Game.** Log the chips you own, add the players and their buy-ins, get a
blind recommendation, and calculate a stack for everyone.
**Game.** Hand out rebuys, cash people out when they leave early, and run the
tournament clock.
**Payout.** Enter what each player has in front of them, press one button, and
find out who gets paid what.

## What it does

### Chips

Your chip set is the input everything else is derived from: colours, how many of
each you own, and what they're worth. Values can be printed on the chips or
assigned by colour, or a mix where the blanks get values that fill in around
the printed ones.

When assigning values, the smallest denomination goes to whichever colour you own
the most of. Getting that backwards, and putting the $1 value on the stack of 20
chips, is the usual reason a home game runs out of chips halfway through.

Chips can carry dollar values (a chip marked 25 is 25¢) or abstract points, set
in Pre-Game. Points need an exchange rate for a cash game; a tournament doesn't
need one at all, since nobody cashes a chip in.

### Blinds

Cash blinds come from stack depth, not from the size of the pot. A 50 big blind
stack plays the same with three players or nine. What changes with player count
is whether the chips go around, which the distribution solver handles separately.
Pick a depth (100 / 50 / 30 big blinds) and the app finds the closest blind level
your chips can actually pay. Every manual edit snaps to a chip increment, and it
tells you when there's no chip small enough to make half a big blind.

Tournament schedules are generated from the starting stack, field size, and how
long you want the night to run. The end condition is chip-driven: play finishes
when the big blind is large enough relative to all the chips in play that a stack
can't survive an orbit. Working back from there gives the growth rate per level.
Big blinds always land on twice the chip increment, so the small blind is always
payable and never goes backwards between levels.

### Stack distribution

Three profiles on one axis: how many physical chips each stack holds.

| Profile | What it's for |
| --- | --- |
| **Balanced** (default) | Enough small chips to post blinds for ~10 orbits, then a ramp upward. |
| **Efficient** | The fewest chips that still play properly. Keeps the box full for rebuys. |
| **Deep stack** | As many chips as the box allows. Looks great, drains inventory fastest. |

Every stack is worth *exactly* the buy-in. The solver is an exact-sum bounded
knapsack over your actual inventory, not a heuristic that gets close. If a buy-in
can't be made exactly from the chips you own, it says so rather than handing out a
stack that's a quarter light.

Two details that matter in practice:

- **Rebuys are reserved for.** Deal out the whole box and the first rebuy has
  nothing to pay with. Set how many spare stacks to hold back and the solver plans
  around them.
- **Uneven buy-ins don't starve anyone.** The smallest chip is split evenly
  between stacks, because an orbit of blinds costs the same whether you sat down
  for $20 or $60. Larger denominations split by stack size.

### Payout

Enter chip counts per colour, or a single total per player, and press one button.

The counted chips almost never match the money that went in. One rolls under the
table, someone pockets a souvenir, a stack gets miscounted. The app shows the gap
and makes you choose: recount, scale everyone's payout to the cash actually in the
pot, or pay the chip count as-is and be over. It won't invent or destroy money
quietly.

Then it reduces everyone's net position to the fewest payments that settle the
night: two Venmos instead of six.

Tournaments pay by finishing place instead. The percentage table is yours to set
(it remembers what you used last time) and prizes are allocated with the
largest-remainder method so they add up to the pool exactly.

### Colour-up

Once every blind is a clean multiple of the next chip up, the smallest chip is
just clutter. The app spots that moment, converts each stack, and hands the odd
chips to the biggest remainders, the deterministic equivalent of dealing cards
for them, which settles the argument about who eats the rounding before it starts.
Short stacks are kept alive by default rather than being raced out.

## Design system

The interface is built to be operated one-handed, at a table, in bad light,
sometimes late. Everything below follows from that.

**Type.** Geist for interface text, Geist Mono for every figure. Money and chip
counts get the mono face on purpose: unambiguous `0`/`O` and `1`/`l` matters when
someone is reading a payout at one in the morning, and tabular figures keep
columns of amounts aligned. Tracking is size-specific rather than one value
everywhere: display type tightens to `-0.045em`, body sits near zero, small text
opens up slightly. Words never get the mono face, only numbers do.

**Colour.** One accent, green, for anything interactive. Gold is reserved
strictly for currency amounts and appears nowhere else, which is why the payout
screen reads at a glance. Green and red carry win/loss. Nothing else is coloured.

**Radii.** Four tokens (`--r-shell` 22px, `--r-core` 16px, `--r-control` 12px,
`--r-inner` 8px) plus full pills for chips and toggles. A core seated in a shell
with 6px of padding uses shell-radius minus that padding so the curves stay
parallel instead of drifting.

**Surfaces.** Two weights. `panel` is a single layer for routine content.
`shell` + `core` is the nested pair, used only where the moment warrants it: the
tournament clock, the stack list, the final payout. Reserving the heavier
treatment is what keeps it meaning something.

**Chrome as material.** The phase switch and the action bar are translucent
layers that content scrolls beneath, not opaque strips that permanently claim a
band of the viewport. Where they overlap content, a scrim fades the content into
them rather than cutting it with a hairline.

**Motion.** Springs, not fixed-duration curves, because a spring animates from
wherever the element currently is: grab a moving panel and it follows you instead
of finishing its old animation first. Critically damped (`bounce: 0`) by default;
overshoot is reserved for motion a gesture set going. Buttons respond on
pointer-down rather than on click, because that is the moment the user expects an
answer. Every animation is either hierarchy, feedback, or a state transition;
nothing loops for decoration.

**Accessibility.** `prefers-reduced-motion` keeps the feedback and drops the
travel. `prefers-reduced-transparency` makes every material solid.
`prefers-contrast: more` puts real edges back on. Contrast is not eyeballed:
`npm run check:contrast` composites every translucent surface down to a real
colour and asserts WCAG AA across all 23 text-on-surface pairs. It fails the
build rather than warning.


## Running it

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # unit tests for all the maths
npm run typecheck
npm run lint
npm run check:contrast   # WCAG AA audit of every text-on-surface pair
npm run build      # static output in dist/
```

## Deploying to Cloudflare

The app is static: no server, no database, no API. `wrangler.jsonc` is set up to
serve `dist/` as a Worker with static assets and SPA fallback.

```bash
npm run build
npx wrangler deploy      # or: npm run deploy
```

You'll need to be logged in (`npx wrangler login`) or have `CLOUDFLARE_API_TOKEN`
and `CLOUDFLARE_ACCOUNT_ID` in the environment. Change `name` in `wrangler.jsonc`
if you want a different `*.workers.dev` subdomain, and add a `routes` entry to put
it on a custom domain.

To deploy automatically on push instead, add a workflow that runs the two commands
above with those two values as repository secrets.

## Data and privacy

Everything lives in `localStorage` on the device you're using: the game in
progress, saved chip sets, the player roster, and past game summaries. There is no
account, no sync, and nothing leaves the browser. Clearing site data clears your
history.

A service worker precaches the app, so it keeps working with no signal. Add it to
your home screen and it runs like an app.

## Layout

```
src/
  lib/            pure logic, no React
    money.ts        integer-cent arithmetic, chip-unit conversion
    chips.ts        inventory, denomination assignment, feasibility
    knapsack.ts     exact-sum bounded knapsack
    distribution.ts stack building across a shared box of chips
    blinds.ts       cash recommendation, tournament schedules
    payout.ts       payouts, discrepancy handling, settlement, prizes
    colorup.ts      chip race
    ledger.ts       money in and out
    storage.ts      localStorage
  state/          reducer, defaults, provider
  components/     shared UI
  phases/         PreGame, Game, Payout
```

The `lib/` modules are independent of React and carry the test suite. Money is an
integer number of cents everywhere; floats never touch a dollar amount.
