import { useMemo, useState } from 'react';
import {
  PALETTE,
  activeColors,
  assignValues,
  inventoryUnits,
  totalChipsOwned,
} from '@/lib/chips';
import { formatUnits, parseCount, parseUnits } from '@/lib/money';
import { loadChipSets, saveChipSets } from '@/lib/storage';
import { uid } from '@/lib/money';
import type { SavedChipSet } from '@/lib/types';
import { useDispatch, useGameState } from '@/state/store';
import { stackUnitsFor } from '@/state/reducer';
import { Card, ConfirmButton, Field, NumberInput, Notices, SectionTitle, Stat, TextInput, Toggle } from './Ui';
import { Check, X } from '@phosphor-icons/react';
import { Icon } from './Icon';
import { Pressable } from './Pressable';
import { ChipDot } from './Chips';

export function ChipSetEditor() {
  const state = useGameState();
  const dispatch = useDispatch();
  const [saved, setSaved] = useState<SavedChipSet[]>(() => loadChipSets());
  const [assignNotices, setAssignNotices] = useState<ReturnType<typeof assignValues>['notices']>([]);

  const standardStackUnits = useMemo(() => {
    const cents =
      state.format === 'tournament' ? state.tournament.buyInCents : state.cash.universalBuyInCents;
    return stackUnitsFor(state, cents);
  }, [state]);

  const totalValue = inventoryUnits(state.chipSet);
  const totalChips = totalChipsOwned(state.chipSet);
  const priced = activeColors(state.chipSet).length;

  const runAssign = (strategy: 'quantity' | 'convention') => {
    const result = assignValues(state.chipSet, {
      strategy,
      stackUnits: standardStackUnits,
      scale: state.scale,
      // With printed values on, only the blank colours need a value invented.
      onlyBlank: state.chipSet.hasPrintedValues,
    });
    dispatch({ type: 'setColors', colors: result.colors });
    setAssignNotices(result.notices);
  };

  const saveCurrent = () => {
    const entry: SavedChipSet = {
      id: uid('saved'),
      name: state.chipSet.name || 'Chip set',
      scale: state.scale,
      chipSet: state.chipSet,
      savedAt: Date.now(),
    };
    const next = [entry, ...saved.filter((s) => s.name !== entry.name)].slice(0, 12);
    saveChipSets(next);
    setSaved(next);
  };

  const loadSet = (entry: SavedChipSet) => {
    dispatch({ type: 'setScale', scale: entry.scale });
    dispatch({
      type: 'setChipSet',
      chipSet: { ...entry.chipSet, id: uid('set') },
    });
  };

  const removeSaved = (id: string) => {
    const next = saved.filter((s) => s.id !== id);
    saveChipSets(next);
    setSaved(next);
  };

  return (
    <Card>
      <SectionTitle
        title="Your chips"
        hint="What's physically in the box. Everything else is calculated from this."
        action={
          <button type="button" className="btn-ghost !py-2 !text-xs" onClick={saveCurrent}>
            Save set
          </button>
        }
      />

      <Field label="Set name">
        <TextInput
          value={state.chipSet.name}
          onChange={(name) => dispatch({ type: 'patchChipSet', patch: { name } })}
          placeholder="My chip set"
        />
      </Field>

      <div className="mt-4 border-t border-white/5 pt-3">
        <Toggle
          checked={state.chipSet.hasPrintedValues}
          onChange={(hasPrintedValues) =>
            dispatch({ type: 'patchChipSet', patch: { hasPrintedValues } })
          }
          label="Values are printed on the chips"
          hint={
            state.chipSet.hasPrintedValues
              ? 'Type in what each chip says. Leave a colour blank and it gets a value assigned around the printed ones.'
              : 'Blank chips. Values get assigned by colour, smallest going to whichever colour you own the most of.'
          }
        />
      </div>

      <div className="mt-4 space-y-2">
        <div className="grid grid-cols-[auto_1fr_4.5rem_5.5rem_auto] items-center gap-2 px-1 text-xs font-medium text-ink-500">
          <span className="w-6" />
          <span>Colour</span>
          <span className="text-right">Have</span>
          <span className="text-right">Worth</span>
          <span className="w-7" />
        </div>

        {state.chipSet.colors.map((color) => (
          <div
            key={color.id}
            className="grid grid-cols-[auto_1fr_4.5rem_5.5rem_auto] items-center gap-2"
          >
            <label className="relative h-6 w-6 cursor-pointer">
              <ChipDot hex={color.hex} size={24} />
              <input
                type="color"
                value={color.hex}
                aria-label={`${color.label} swatch`}
                onChange={(e) =>
                  dispatch({ type: 'updateColor', id: color.id, patch: { hex: e.target.value } })
                }
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
              />
            </label>

            <TextInput
              value={color.label}
              onChange={(label) =>
                dispatch({ type: 'updateColor', id: color.id, patch: { label } })
              }
              className="!px-2.5 !py-2 !text-sm"
              placeholder="Colour"
              list="chip-colour-names"
            />

            <NumberInput
              value={color.quantity}
              onCommit={(quantity) =>
                dispatch({ type: 'updateColor', id: color.id, patch: { quantity } })
              }
              parse={parseCount}
              format={(v) => (v ? String(v) : '')}
              inputMode="numeric"
              placeholder="0"
              className="!px-2.5 !py-2 text-right !text-sm num"
              ariaLabel={`${color.label} quantity`}
            />

            <NumberInput
              value={color.value ?? 0}
              onCommit={(value) =>
                dispatch({
                  type: 'updateColor',
                  id: color.id,
                  patch: { value: value > 0 ? value : null },
                })
              }
              parse={(raw) => (raw.trim() === '' ? 0 : parseUnits(raw, state.scale))}
              format={(v) => (v > 0 ? formatUnits(v, state.scale) : '')}
              placeholder={state.scale.kind === 'dollar' ? '$0' : '0'}
              className="!px-2.5 !py-2 text-right !text-sm num"
              ariaLabel={`${color.label} value`}
            />

            <Pressable
              depth="sm"
              className="flex h-8 w-8 items-center justify-center rounded-full text-ink-500 transition-colors duration-200 ease-standard hover:bg-red-500/15 hover:text-red-300"
              onClick={() => dispatch({ type: 'removeColor', id: color.id })}
              aria-label={`Remove ${color.label}`}
            >
              <Icon as={X} size={15} />
            </Pressable>
          </div>
        ))}

        <datalist id="chip-colour-names">
          {PALETTE.map((p) => (
            <option key={p.label} value={p.label} />
          ))}
        </datalist>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" className="btn-ghost !py-2 !text-xs" onClick={() => dispatch({ type: 'addColor' })}>
          + Colour
        </button>
        <button type="button" className="btn-ghost !py-2 !text-xs" onClick={() => runAssign('quantity')}>
          {state.chipSet.hasPrintedValues ? 'Fill blanks by quantity' : 'Assign by quantity'}
        </button>
        <button type="button" className="btn-ghost !py-2 !text-xs" onClick={() => runAssign('convention')}>
          Standard colours
        </button>
      </div>

      <Notices notices={assignNotices} className="mt-3" />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <Stat label="Chips" mono value={totalChips.toLocaleString('en-US')} />
        <Stat label="Total value" mono value={formatUnits(totalValue, state.scale)} tone="money" />
        <Stat label="Denominations" mono value={priced} />
      </div>

      {saved.length > 0 && (
        <div className="mt-4 border-t border-white/5 pt-3">
          <span className="label">Saved sets</span>
          <div className="flex flex-wrap gap-2">
            {saved.map((entry) => (
              <span key={entry.id} className="inline-flex items-center overflow-hidden rounded-inner border border-white/10">
                <button
                  type="button"
                  className="px-2.5 py-1.5 text-xs text-ink-200 transition hover:bg-white/5"
                  onClick={() => loadSet(entry)}
                >
                  {entry.name}
                </button>
                <ConfirmButton
                  className="flex items-center px-2 py-1.5 text-xs text-ink-500 transition-colors duration-200 ease-standard hover:bg-red-500/15 hover:text-red-300"
                  confirmLabel={<Icon as={Check} size={14} />}
                  onConfirm={() => removeSaved(entry.id)}
                >
                  <Icon as={X} size={14} />
                </ConfirmButton>
              </span>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}
