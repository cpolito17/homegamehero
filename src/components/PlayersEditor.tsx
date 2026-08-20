import { useMemo, useState } from 'react';
import { formatMoney, parseMoney } from '@/lib/money';
import { loadRoster } from '@/lib/storage';
import { useDispatch, useGameState } from '@/state/store';
import { X } from '@phosphor-icons/react';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { Card, EmptyState, Field, NumberInput, SectionTitle, Stat, TextInput } from './Ui';

export function PlayersEditor() {
  const state = useGameState();
  const dispatch = useDispatch();
  const [roster] = useState(() => loadRoster());

  const isTournament = state.format === 'tournament';
  const buyIns = state.players.map((p) => p.buyInCents);
  const pot = buyIns.reduce((a, b) => a + b, 0);
  const buyInKey = buyIns.join(',');
  const unequal = useMemo(() => new Set(buyInKey.split(',')).size > 1, [buyInKey]);

  const suggestions = roster.filter(
    (r) => !state.players.some((p) => p.name.toLowerCase() === r.name.toLowerCase()),
  );

  return (
    <Card>
      <SectionTitle
        title="Players"
        hint={
          isTournament
            ? 'Everyone pays the same to enter a tournament. Rebuys and add-ons come later.'
            : 'Set one buy-in for the table, then override anyone sitting down for more.'
        }
      />

      {isTournament ? (
        <Field label="Buy-in (everyone)" hint="Change this in the tournament settings below.">
          <div className="field flex items-center justify-between text-ink-300">
            <span className="num">{formatMoney(state.tournament.buyInCents)}</span>
            <span className="text-xs text-ink-500">fixed</span>
          </div>
        </Field>
      ) : (
        <Field label="Buy-in for everyone" hint="Applies to every player, including new ones.">
          <NumberInput
            value={state.cash.universalBuyInCents}
            onCommit={(cents) => dispatch({ type: 'applyUniversalBuyIn', cents })}
            parse={parseMoney}
            format={(v) => formatMoney(v)}
            placeholder="$20"
          />
        </Field>
      )}

      <div className="mt-4 space-y-2">
        {state.players.length === 0 && (
          <EmptyState title="Nobody's sitting down yet" hint="Add players to size the stacks." />
        )}

        {state.players.map((player, index) => (
          <div key={player.id} className="grid grid-cols-[1.6rem_1fr_6.5rem_auto] items-center gap-2">
            <span className="num text-center text-xs text-ink-600">{index + 1}</span>

            <TextInput
              value={player.name}
              onChange={(name) => dispatch({ type: 'updatePlayer', id: player.id, patch: { name } })}
              className="!px-2.5 !py-2 !text-sm"
              placeholder={`Player ${index + 1}`}
              list="roster-names"
            />

            <NumberInput
              value={isTournament ? state.tournament.buyInCents : player.buyInCents}
              onCommit={(buyInCents) =>
                dispatch({ type: 'updatePlayer', id: player.id, patch: { buyInCents } })
              }
              parse={parseMoney}
              format={(v) => formatMoney(v)}
              disabled={isTournament}
              className={`!px-2.5 !py-2 text-right !text-sm num ${
                !isTournament && player.buyInCents !== state.cash.universalBuyInCents
                  ? '!border-gold-500/40 !text-gold-300'
                  : ''
              }`}
              ariaLabel={`${player.name} buy-in`}
            />

            <Pressable
              depth="sm"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition-colors duration-200 ease-standard hover:bg-red-500/15 hover:text-red-300"
              onClick={() => dispatch({ type: 'removePlayer', id: player.id })}
              aria-label={`Remove ${player.name}`}
            >
              <Icon as={X} size={15} />
            </Pressable>
          </div>
        ))}

        <datalist id="roster-names">
          {roster.map((r) => (
            <option key={r.id} value={r.name} />
          ))}
        </datalist>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost !py-2 !text-xs" onClick={() => dispatch({ type: 'addPlayer' })}>
          + Player
        </button>
        {suggestions.slice(0, 5).map((r) => (
          <button
            key={r.id}
            type="button"
            className="btn-ghost !py-2 !text-xs !text-ink-400"
            onClick={() => dispatch({ type: 'addPlayer', name: r.name })}
          >
            + {r.name}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-2">
        <Stat label="Players" mono value={state.players.length} />
        <Stat
          label="Money on the table" mono
          value={formatMoney(pot)}
          tone="money"
          sub={unequal ? 'Uneven buy-ins' : undefined}
        />
      </div>
    </Card>
  );
}
