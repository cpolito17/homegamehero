/**
 * Exact-sum chip fitting.
 *
 * Making a stack worth exactly the buy-in out of a limited box of chips is a
 * bounded knapsack with an equality constraint. The counts are small and the
 * values share a large common factor, so a DP over the reduced amount is both
 * exact and fast — no heuristics, no "close enough" stacks.
 */

export interface FillItem {
  /** Value of one chip of this denomination, in raw units. */
  value: number;
  /** How many of this denomination are available. */
  cap: number;
}

export interface FillResult {
  /** Chips used, index-aligned with the input items. */
  counts: number[];
  /** Value actually reached. Equals the target when `exact` is true. */
  total: number;
  exact: boolean;
}

/** Product cap that keeps the DP inside a few megabytes and a few milliseconds. */
const MAX_TABLE = 8_000_000;
const MAX_TARGET = 60_000;

function gcd2(a: number, b: number): number {
  let x = Math.abs(a);
  let y = Math.abs(b);
  while (y) [x, y] = [y, x % y];
  return x;
}

/** Split a bounded count into powers of two so it can be run as a 0/1 knapsack. */
function binarySplit(cap: number): number[] {
  const chunks: number[] = [];
  let remaining = cap;
  let size = 1;
  while (remaining > 0) {
    const take = Math.min(size, remaining);
    chunks.push(take);
    remaining -= take;
    size *= 2;
  }
  return chunks;
}

function greedy(target: number, items: FillItem[], objective: 'min' | 'max'): FillResult {
  const counts = new Array<number>(items.length).fill(0);
  const order = items
    .map((item, index) => ({ index, value: item.value }))
    .sort((a, b) => (objective === 'min' ? b.value - a.value : a.value - b.value));

  let remaining = target;
  for (const { index } of order) {
    const item = items[index]!;
    if (item.value <= 0) continue;
    const take = Math.min(item.cap, Math.floor(remaining / item.value));
    counts[index] = take;
    remaining -= take * item.value;
  }
  // A max-chip greedy can strand a remainder the small chips can't cover; mop it
  // up with the large ones so we at least land as close as possible.
  if (remaining > 0 && objective === 'max') {
    for (const { index } of items
      .map((item, index) => ({ index, value: item.value }))
      .sort((a, b) => b.value - a.value)) {
      const item = items[index]!;
      const room = item.cap - counts[index]!;
      const take = Math.min(room, Math.floor(remaining / item.value));
      counts[index]! += take;
      remaining -= take * item.value;
    }
  }
  return { counts, total: target - remaining, exact: remaining === 0 };
}

/**
 * Fits chips to `target`.
 *
 * `objective` decides the shape of the stack when several fit: 'min' uses the
 * fewest chips (preserving the box), 'max' uses the most (a tall stack).
 *
 * When the target is unreachable — wrong multiple, or not enough chips — this
 * returns the closest reachable value *below* it rather than failing, so callers
 * can show the host how far off they are.
 */
export function fillExact(
  target: number,
  items: FillItem[],
  objective: 'min' | 'max' = 'min',
): FillResult {
  const usable = items.map((item) => ({
    value: Math.max(0, Math.floor(item.value)),
    cap: Math.max(0, Math.floor(item.cap)),
  }));

  if (target <= 0) return { counts: usable.map(() => 0), total: 0, exact: target === 0 };
  if (usable.every((i) => i.value <= 0 || i.cap <= 0)) {
    return { counts: usable.map(() => 0), total: 0, exact: false };
  }

  // Reduce by the common factor. Real chip ladders share one (25, 100, 500 -> 25),
  // which shrinks the table by that factor and makes the DP trivially cheap.
  const active = usable.filter((i) => i.value > 0 && i.cap > 0);
  let divisor = active.reduce((acc, i) => gcd2(acc, i.value), 0) || 1;
  divisor = gcd2(divisor, target) || 1;

  const reducedTarget = Math.floor(target / divisor);
  const scaled = usable.map((i) => ({
    value: i.value > 0 ? i.value / divisor : 0,
    cap: i.cap,
  }));

  // Non-integer after reduction means this denomination can never contribute to
  // an exact fill of this target; drop it from the DP.
  const dpItems = scaled.map((i) => ({
    value: Number.isInteger(i.value) ? i.value : 0,
    cap: Number.isInteger(i.value) ? Math.min(i.cap, Math.ceil(reducedTarget / (i.value || 1))) : 0,
  }));

  type Piece = { itemIndex: number; chunk: number; weight: number };
  const pieces: Piece[] = [];
  for (let i = 0; i < dpItems.length; i++) {
    const { value, cap } = dpItems[i]!;
    if (value <= 0 || cap <= 0) continue;
    for (const chunk of binarySplit(cap)) pieces.push({ itemIndex: i, chunk, weight: chunk * value });
  }

  if (
    pieces.length === 0 ||
    reducedTarget > MAX_TARGET ||
    pieces.length * (reducedTarget + 1) > MAX_TABLE
  ) {
    return greedy(target, usable, objective);
  }

  const NONE = objective === 'min' ? Infinity : -Infinity;
  const dp = new Float64Array(reducedTarget + 1).fill(NONE);
  dp[0] = 0;
  const took = new Uint8Array(pieces.length * (reducedTarget + 1));

  for (let p = 0; p < pieces.length; p++) {
    const { chunk, weight } = pieces[p]!;
    const base = p * (reducedTarget + 1);
    for (let s = reducedTarget; s >= weight; s--) {
      const prev = dp[s - weight]!;
      if (prev === NONE || !Number.isFinite(prev)) continue;
      const candidate = prev + chunk;
      const current = dp[s]!;
      const better =
        objective === 'min'
          ? candidate < current || !Number.isFinite(current)
          : candidate > current || !Number.isFinite(current);
      if (better) {
        dp[s] = candidate;
        took[base + s] = 1;
      }
    }
  }

  let reached = -1;
  for (let s = reducedTarget; s >= 0; s--) {
    if (Number.isFinite(dp[s]!)) {
      reached = s;
      break;
    }
  }
  if (reached < 0) return { counts: usable.map(() => 0), total: 0, exact: false };

  const counts = new Array<number>(usable.length).fill(0);
  let s = reached;
  for (let p = pieces.length - 1; p >= 0; p--) {
    const piece = pieces[p]!;
    if (took[p * (reducedTarget + 1) + s] === 1 && s >= piece.weight) {
      counts[piece.itemIndex]! += piece.chunk;
      s -= piece.weight;
    }
  }

  const total = reached * divisor;
  return { counts, total, exact: total === target };
}

/**
 * Fits `target` while honouring a set of chips already committed to the stack.
 * Used by the balanced profile, which places chips by intent first and then
 * closes the gap exactly.
 */
export function fillRemainder(
  target: number,
  items: FillItem[],
  preset: number[],
  objective: 'min' | 'max' = 'min',
): FillResult | null {
  const placedValue = preset.reduce((sum, count, i) => sum + count * (items[i]?.value ?? 0), 0);
  const residual = target - placedValue;
  if (residual < 0) return null;
  if (residual === 0) {
    return { counts: preset.slice(), total: target, exact: true };
  }

  const room = items.map((item, i) => ({ value: item.value, cap: item.cap - (preset[i] ?? 0) }));
  const fill = fillExact(residual, room, objective);
  if (!fill.exact) return null;

  return {
    counts: preset.map((count, i) => count + (fill.counts[i] ?? 0)),
    total: target,
    exact: true,
  };
}
