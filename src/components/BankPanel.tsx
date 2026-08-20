import { useState } from 'react';
import { activeColors, countChips, remainingInventory } from '@/lib/chips';
import { chipsHandedOut, tableStakeCents, totalMoneyIn, totalMoneyOut } from '@/lib/ledger';
import { formatMoney } from '@/lib/money';
import { useDispatch, useGameState } from '@/state/store';
import { ChipDot } from './Chips';
import { Card, ConfirmButton, SectionTitle, Stat } from './Ui';

export function BankPanel() {
  const state = useGameState();
  const dispatch = useDispatch();
  const [showLedger, setShowLedger] = useState(false);

  const handedOut = chipsHandedOut(state.ledger);
  const left = remainingInventory(state.chipSet, handedOut);
  const colors = activeColors(state.chipSet);

  const inCents = totalMoneyIn(state.ledger);
  const outCents = totalMoneyOut(state.ledger);
  const onTable = tableStakeCents(state.ledger);

  const shortages = colors.filter((c) => (left[c.id] ?? 0) < 0);

  return (
    <Card>
      <SectionTitle
        title="The box"
        hint="What's left to hand out, and the money it has to cover."
        action={
          <button
            type="button"
            className="btn-ghost !py-2 !text-xs"
            onClick={() => setShowLedger((v) => !v)}
          >
            {showLedger ? 'Hide' : 'History'}
          </button>
        }
      />

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Paid in" mono value={formatMoney(inCents)} />
        <Stat label="Paid out" mono value={formatMoney(outCents)} />
        <Stat label="On the table" mono value={formatMoney(onTable)} tone="money" />
      </div>

      <div className="mt-3 space-y-1.5">
        {colors.map((color) => {
          const remaining = left[color.id] ?? 0;
          const pct = color.quantity > 0 ? Math.max(0, remaining) / color.quantity : 0;
          return (
            <div key={color.id} className="flex items-center gap-2">
              <ChipDot hex={color.hex} size={16} />
              <span className="w-16 shrink-0 truncate text-xs text-ink-400">{color.label}</span>
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-ink-900">
                <div
                  className={`h-full rounded-full transition-all ${
                    remaining < 0 ? 'bg-red-500' : pct < 0.15 ? 'bg-gold-500' : 'bg-felt-500'
                  }`}
                  style={{ width: `${Math.min(100, Math.max(0, pct * 100))}%` }}
                />
              </div>
              <span
                className={`num w-14 shrink-0 text-right text-xs ${
                  remaining < 0 ? 'text-red-300' : 'text-ink-400'
                }`}
              >
                {remaining} / {color.quantity}
              </span>
            </div>
          );
        })}
      </div>

      {shortages.length > 0 && (
        <p className="mt-3 rounded-control border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
          You've handed out more {shortages.map((c) => c.label.toLowerCase()).join(', ')} chips than
          you own. Someone's rebuy came out of thin air.
        </p>
      )}

      {showLedger && (
        <div className="mt-4 border-t border-white/5 pt-3">
          {state.ledger.length === 0 ? (
            <p className="text-sm text-ink-500">Nothing logged yet.</p>
          ) : (
            <ul className="space-y-1.5">
              {state.ledger
                .slice()
                .reverse()
                .map((entry) => {
                  const player = state.players.find((p) => p.id === entry.playerId);
                  return (
                    <li key={entry.id} className="flex items-center justify-between gap-2 text-xs">
                      <span className="min-w-0 truncate text-ink-400">
                        <span className="text-ink-200">{player?.name ?? 'Unknown'}</span>{' '}
                        {entry.kind === 'cashout' ? 'cashed out' : entry.kind}
                        {entry.chips && countChips(entry.chips) > 0 && (
                          <span className="text-ink-600"> · {countChips(entry.chips)} chips</span>
                        )}
                      </span>
                      <span className="flex shrink-0 items-center gap-2">
                        <span
                          className={`num ${entry.kind === 'cashout' ? 'text-red-300' : 'text-felt-300'}`}
                        >
                          {entry.kind === 'cashout' ? '−' : '+'}
                          {formatMoney(entry.amountCents)}
                        </span>
                        <ConfirmButton
                          className="rounded px-1.5 py-0.5 text-ink-600 transition hover:bg-red-500/15 hover:text-red-300"
                          confirmLabel="✓"
                          onConfirm={() => dispatch({ type: 'undoLedger', entryId: entry.id })}
                        >
                          undo
                        </ConfirmButton>
                      </span>
                    </li>
                  );
                })}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
