import type { GameState, GameSummary, RosterPlayer, SavedChipSet } from './types';

const PREFIX = 'hgh';
export const SCHEMA_VERSION = 1;

const KEYS = {
  game: `${PREFIX}.game.v${SCHEMA_VERSION}`,
  chipSets: `${PREFIX}.chipsets.v${SCHEMA_VERSION}`,
  roster: `${PREFIX}.roster.v${SCHEMA_VERSION}`,
  history: `${PREFIX}.history.v${SCHEMA_VERSION}`,
} as const;

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    // Corrupt or unavailable storage shouldn't take the app down mid-game.
    return fallback;
  }
}

function write(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* private mode, quota, or no storage at all — the app still works in memory */
  }
}

/**
 * Migrates a stored game forward. Nothing to do at v1, but the hook exists so a
 * saved game from an older build never comes back as a half-populated object.
 */
function migrateGame(state: GameState): GameState | null {
  if (!state || typeof state !== 'object') return null;
  if (state.version !== SCHEMA_VERSION) return null;
  return state;
}

export function loadGame(): GameState | null {
  const stored = read<GameState | null>(KEYS.game, null);
  return stored ? migrateGame(stored) : null;
}

export function saveGame(state: GameState): void {
  write(KEYS.game, state);
}

export function clearGame(): void {
  try {
    localStorage.removeItem(KEYS.game);
  } catch {
    /* ignore */
  }
}

export function loadChipSets(): SavedChipSet[] {
  return read<SavedChipSet[]>(KEYS.chipSets, []);
}

export function saveChipSets(sets: SavedChipSet[]): void {
  write(KEYS.chipSets, sets);
}

export function loadRoster(): RosterPlayer[] {
  return read<RosterPlayer[]>(KEYS.roster, []);
}

export function saveRoster(players: RosterPlayer[]): void {
  write(KEYS.roster, players);
}

/** Remembers everyone who has played, most recent first, capped so it stays useful. */
export function rememberPlayers(names: string[]): RosterPlayer[] {
  const existing = loadRoster();
  const byName = new Map(existing.map((p) => [p.name.toLowerCase(), p]));
  const now = Date.now();

  for (const name of names) {
    const key = name.trim().toLowerCase();
    if (!key) continue;
    const found = byName.get(key);
    if (found) found.lastPlayedAt = now;
    else byName.set(key, { id: key, name: name.trim(), lastPlayedAt: now });
  }

  const merged = [...byName.values()].sort((a, b) => b.lastPlayedAt - a.lastPlayedAt).slice(0, 60);
  saveRoster(merged);
  return merged;
}

export function loadHistory(): GameSummary[] {
  return read<GameSummary[]>(KEYS.history, []);
}

export function pushHistory(summary: GameSummary): GameSummary[] {
  const history = [summary, ...loadHistory()].slice(0, 50);
  write(KEYS.history, history);
  return history;
}

export function clearHistory(): void {
  write(KEYS.history, []);
}
