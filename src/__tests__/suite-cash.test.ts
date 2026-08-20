/**
 * CALCULATION_TEST_SUITE.md — core cash, distribution, and blind cases.
 * Every case is verified by the final cash-out amount in exact cents.
 */
import { describe, expect, it } from 'vitest';
import { countUnits } from '@/lib/chips';
import { recommendCashBlinds } from '@/lib/blinds';
import { totalMoneyIn } from '@/lib/ledger';
import { DOLLAR, FINE_SET, Game, STANDARD_SET, settlementClears } from './harness';

const $ = (dollars: number) => Math.round(dollars * 100);

/** Seat a table, start it, count the final stacks, and read the cash-outs. */
function play(buyIns: number[], finals: number[], set = STANDARD_SET) {
  const game = new Game(DOLLAR).chips(set).players(buyIns).start().totals(finals);
  return game;
}

describe('C — core cash and distribution', () => {
  it('C-01 one player buys in for $20 and finishes with $20', () => {
    const game = play([$(20)], [$(20)]);
    expect(game.cashouts()).toEqual([$(20)]);
    expect(game.payout().potCents).toBe($(20));
    expect(game.payout().countedCents).toBe($(20));
    expect(game.payout().transfers).toEqual([]);
  });

  it('C-02 two players, $25 and $15, loser pays winner $5', () => {
    const game = play([$(20), $(20)], [$(25), $(15)]);
    expect(game.cashouts()).toEqual([$(25), $(15)]);
    const { transfers } = game.payout();
    expect(transfers).toEqual([
      { fromPlayerId: game.id(1), toPlayerId: game.id(0), cents: $(5) },
    ]);
  });

  it('C-03 three players, $10 / $20 / $30', () => {
    const game = play([$(20), $(20), $(20)], [$(10), $(20), $(30)]);
    expect(game.cashouts()).toEqual([$(10), $(20), $(30)]);
    expect(settlementClears(game.payout())).toBe(true);
  });

  it('C-04 four uneven buy-ins totalling a $130 pot', () => {
    const game = play([$(10), $(20), $(40), $(60)], [$(5), $(15), $(45), $(65)]);
    expect(game.cashouts()).toEqual([$(5), $(15), $(45), $(65)]);
    expect(game.payout().potCents).toBe($(130));
    expect(settlementClears(game.payout())).toBe(true);
  });

  it('C-05 six players cash out $120 in total', () => {
    const finals = [$(2.5), $(5), $(7.5), $(15), $(35), $(55)];
    const game = play(Array(6).fill($(20)), finals);
    expect(game.cashouts()).toEqual(finals);
    expect(game.cashouts().reduce((a, b) => a + b, 0)).toBe($(120));
  });

  it('C-06 nine players cash out $90 in total', () => {
    const finals = [$(2.5), $(5), $(7.5), $(10), $(10), $(10), $(15), $(15), $(15)];
    const game = play(Array(9).fill($(10)), finals);
    expect(game.cashouts()).toEqual(finals);
    expect(game.cashouts().reduce((a, b) => a + b, 0)).toBe($(90));
  });

  it('C-07 wide stack range cashes out $85', () => {
    const game = play([$(5), $(20), $(60)], [$(2.5), $(32.5), $(50)]);
    expect(game.cashouts()).toEqual([$(2.5), $(32.5), $(50)]);
    expect(game.cashouts().reduce((a, b) => a + b, 0)).toBe($(85));
  });

  it('C-08 irregular 1c/3c/7c/11c denominations count exactly', () => {
    const game = new Game(DOLLAR)
      .chips(FINE_SET)
      .players([$(10), $(10), $(10)])
      .start()
      .counts([
        { White: 500, Red: 100, Green: 50, Black: 5 },
        { White: 400, Red: 50, Green: 60, Black: 4 },
        { White: 500, Red: 20, Green: 30, Black: 1 },
      ]);
    expect(game.cashouts()).toEqual([$(12.05), $(10.14), $(7.81)]);
  });

  it.each(['balanced', 'efficient', 'deep'] as const)(
    'C-09 %s distribution builds stacks worth exactly $20',
    (mode) => {
      const game = new Game(DOLLAR)
        .chips(STANDARD_SET)
        .players(Array(4).fill($(20)))
        .blinds(25, 50)
        .mode(mode)
        .reserve(2)
        .distribute()
        .start();

      expect(game.state.distribution!.feasible).toBe(true);
      for (const stack of game.state.distribution!.stacks) {
        expect(stack.totalUnits).toBe($(20));
      }

      // Cash out the stacks the box actually issued.
      const issued = game.state.players.map((_, i) =>
        countUnits(game.chipsIssued(i), game.state.chipSet),
      );
      game.totals(issued);
      expect(game.cashouts()).toEqual(Array(4).fill($(20)));
    },
  );

  it('C-10 uneven buy-ins with three reserve stacks each cash out exactly', () => {
    const buyIns = [$(20), $(20), $(40), $(20), $(60)];
    const game = new Game(DOLLAR)
      .chips(STANDARD_SET)
      .players(buyIns)
      .blinds(25, 50)
      .reserve(3)
      .distribute()
      .start();

    expect(game.state.distribution!.feasible).toBe(true);
    expect(game.state.distribution!.standardStackUnits).toBe($(20));

    const issued = game.state.players.map((_, i) =>
      countUnits(game.chipsIssued(i), game.state.chipSet),
    );
    expect(issued).toEqual(buyIns);
    game.totals(issued);
    expect(game.cashouts()).toEqual(buyIns);
  });

  it('C-11 a $20.10 buy-in cannot be made from 25c chips and says so', () => {
    const game = new Game(DOLLAR)
      .chips(STANDARD_SET)
      .players([$(20), $(20), $(20.1)])
      .blinds(25, 50)
      .distribute();

    const odd = game.state.distribution!.stacks.find((s) => s.targetUnits === $(20.1))!;
    expect(odd.exact).toBe(false);
    expect(game.state.distribution!.feasible).toBe(false);
    expect(game.state.distribution!.notices.some((n) => n.level === 'error')).toBe(true);
  });
});

describe('B — blind recommendation', () => {
  it('B-01 a $20 stack at 50BB recommends $0.25/$0.50', () => {
    const game = new Game(DOLLAR).chips(STANDARD_SET).players(Array(4).fill($(20)));
    const rec = recommendCashBlinds({
      stackUnits: $(20),
      depthTargetBB: 50,
      denominations: [25, 100, 500, 2500],
    });
    expect(rec.smallBlind).toBe(25);
    expect(rec.bigBlind).toBe(50);

    game.blinds(rec.smallBlind, rec.bigBlind).start().totals([$(20), $(20), $(20), $(20)]);
    expect(game.cashouts()).toEqual(Array(4).fill($(20)));
  });

  it('B-02 with no half-blind chip the blinds go equal and warn', () => {
    const rec = recommendCashBlinds({
      stackUnits: $(20),
      depthTargetBB: 50,
      denominations: [100, 500],
    });
    expect(rec.smallBlind).toBe(rec.bigBlind);
    expect(rec.notices.some((n) => /small blind/i.test(n.message))).toBe(true);

    const game = new Game(DOLLAR)
      .chips([
        ['Red', 100, 150],
        ['Green', 500, 100],
      ])
      .players([$(20), $(20)])
      .blinds(rec.smallBlind, rec.bigBlind)
      .start()
      .totals([$(20), $(20)]);
    expect(game.cashouts()).toEqual([$(20), $(20)]);
  });
});

describe('pot identity', () => {
  it('pot is money in less completed cashouts, for every case shape', () => {
    const game = new Game(DOLLAR)
      .chips(STANDARD_SET)
      .players([$(20), $(20), $(20)])
      .start()
      .dispatch();
    game.rebuy(0, $(20)).cashOut(2, $(15));
    const pot = totalMoneyIn(game.state.ledger) - $(15);
    game.totals([$(40), $(25), 0]);
    expect(game.payout().potCents).toBe(pot);
    expect(pot).toBe($(80) - $(15));
  });
});
