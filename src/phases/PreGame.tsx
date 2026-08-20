import { useMemo } from 'react';
import { BlindsPanel } from '@/components/BlindsPanel';
import { ChipSetEditor } from '@/components/ChipSetEditor';
import { DistributionPanel } from '@/components/DistributionPanel';
import { PlayersEditor } from '@/components/PlayersEditor';
import { TournamentPanel } from '@/components/TournamentPanel';
import { Play } from '@phosphor-icons/react';
import { ActionBar } from '@/components/ActionBar';
import {
  ActionButton,
  Card,
  Field,
  NumberInput,
  SectionTitle,
  Segmented,
  TileGrid,
  TileWide,
} from '@/components/Ui';
import { formatMoney, parseCount } from '@/lib/money';
import { rememberPlayers } from '@/lib/storage';
import type { GameFormat } from '@/lib/types';
import { useDispatch, useGameState } from '@/state/store';

export function PreGame() {
  const state = useGameState();
  const dispatch = useDispatch();

  const isTournament = state.format === 'tournament';
  const standardBuyInCents = isTournament
    ? state.tournament.buyInCents
    : state.cash.universalBuyInCents;

  // Points are only meaningful against a buy-in, so the host sets the stack and
  // the exchange rate falls out of it.
  const pointsForBuyIn = useMemo(() => {
    if (state.scale.kind !== 'points') return 0;
    return Math.round((standardBuyInCents / 100) * state.scale.unitsPerDollar);
  }, [state.scale, standardBuyInCents]);

  const setPointsForBuyIn = (points: number) => {
    const dollars = standardBuyInCents / 100;
    if (dollars <= 0 || points <= 0) return;
    dispatch({ type: 'setScale', scale: { kind: 'points', unitsPerDollar: points / dollars } });
    if (isTournament) {
      dispatch({ type: 'patchTournament', patch: { startingStackUnits: points } });
    }
  };

  const canStart = state.players.length > 0;

  const startGame = () => {
    rememberPlayers(state.players.map((p) => p.name));
    dispatch({ type: 'startGame' });
  };

  return (
    <>
      <TileGrid className="pb-36">
      <Card>
        <SectionTitle title="Format" hint="This changes how the night ends, so set it first." />

        <Segmented<GameFormat>
          value={state.format}
          options={[
            { value: 'cash', label: 'Cash game' },
            { value: 'tournament', label: 'Tournament' },
          ]}
          onChange={(format) => dispatch({ type: 'setFormat', format })}
        />
        <p className="mt-2 text-xs leading-snug text-ink-500">
          {isTournament
            ? 'Fixed entry, blinds go up on a clock, and payouts go by finishing place.'
            : 'Chips are cash, rebuy any time, and everyone counts chips at the end to get paid.'}
        </p>

        <div className="mt-4 border-t border-line/5 pt-4">
          <span className="label">What's on the chips</span>
          <Segmented
            value={state.scale.kind}
            options={[
              { value: 'dollar', label: 'Dollar values' },
              { value: 'points', label: 'Points' },
            ]}
            onChange={(kind) =>
              dispatch({
                type: 'setScale',
                scale:
                  kind === 'dollar'
                    ? { kind: 'dollar' }
                    : { kind: 'points', unitsPerDollar: 50 },
              })
            }
          />
          <p className="mt-2 text-xs leading-snug text-ink-500">
            {state.scale.kind === 'dollar'
              ? 'A chip marked 25 is worth 25¢. Payouts come straight off the chip count.'
              : isTournament
                ? "Chips are just tokens. Nobody cashes them in, so the numbers can be anything you like."
                : 'Chips are tokens, so cashing out needs an exchange rate.'}
          </p>

          {state.scale.kind === 'points' && (
            <div className="mt-3">
              <Field
                label={`Points for a ${formatMoney(standardBuyInCents)} buy-in`}
                hint={`Works out to ${Math.round(state.scale.unitsPerDollar).toLocaleString('en-US')} points per dollar.`}
              >
                <NumberInput
                  value={pointsForBuyIn}
                  onCommit={setPointsForBuyIn}
                  parse={parseCount}
                  format={(v) => v.toLocaleString('en-US')}
                  inputMode="numeric"
                  className="num"
                />
              </Field>
            </div>
          )}
        </div>
      </Card>

      <ChipSetEditor />
      <PlayersEditor />
      {isTournament ? <TournamentPanel /> : <BlindsPanel />}
      <TileWide>
        <DistributionPanel />
      </TileWide>

      </TileGrid>

      <ActionBar
        note={
          state.distribution
            ? 'Stacks ready. Hand them out and start the game.'
            : 'Calculate stacks first, or start now and sort the chips yourself.'
        }
      >
        <ActionButton onClick={startGame} disabled={!canStart} glyph={Play}>
          Start game
        </ActionButton>
      </ActionBar>
    </>
  );
}
