import type { ChipScale } from './money';

export type { ChipScale };

export type GameFormat = 'cash' | 'tournament';
export type Phase = 'pregame' | 'game' | 'payout';
export type DistributionMode = 'balanced' | 'efficient' | 'deep';

/** colorId -> number of chips */
export type ChipCount = Record<string, number>;

export interface ChipColor {
  id: string;
  label: string;
  /** Swatch colour for the UI. Purely cosmetic. */
  hex: string;
  /** How many of this colour the host physically owns. */
  quantity: number;
  /** Value in chip units. null means "not assigned yet" (a blank chip). */
  value: number | null;
}

export interface ChipSet {
  id: string;
  name: string;
  /** false => chips are blank and the host assigns values by colour. */
  hasPrintedValues: boolean;
  colors: ChipColor[];
}

export interface Player {
  id: string;
  name: string;
  /** Initial buy-in. Rebuys live in the ledger, not here. */
  buyInCents: number;
  seat: number;
  /**
   * Set when the player cashes out and leaves mid-game. Their money is already
   * settled in cash, so they drop out of the final count but stay in the summary.
   */
  leftAt?: number | null;
}

export type LedgerKind = 'buyin' | 'rebuy' | 'addon' | 'cashout';

export interface LedgerEntry {
  id: string;
  playerId: string;
  kind: LedgerKind;
  /** Money moving. Positive for buyin/rebuy/addon (in), positive for cashout (out). */
  amountCents: number;
  /** Chips handed over the table for this entry. Cashouts record chips returned. */
  chips: ChipCount;
  at: number;
  note?: string;
}

export interface CashConfig {
  universalBuyInCents: number;
  /** Target starting stack depth in big blinds. Drives the blind recommendation. */
  depthTargetBB: number;
  smallBlind: number;
  bigBlind: number;
  /** false once the host hand-edits the blinds, so we stop overwriting them. */
  blindsAuto: boolean;
}

export interface BlindLevel {
  index: number;
  smallBlind: number;
  bigBlind: number;
  /** Big-blind ante. 0 when no ante is in play. */
  ante: number;
  minutes: number;
  isBreak: boolean;
}

export interface PrizeSlot {
  place: number;
  /** Percent of the prize pool, 0-100. Must sum to 100 across all slots. */
  percent: number;
}

export interface TournamentConfig {
  buyInCents: number;
  startingStackUnits: number;
  levelMinutes: number;
  targetDurationMinutes: number;
  /** Level at which big-blind antes start. null = no antes. */
  anteStartLevel: number | null;
  breakEveryLevels: number;
  breakMinutes: number;
  /** Rebuys allowed through this level. 0 = freezeout. */
  rebuyThroughLevel: number;
  rebuyCents: number;
  rebuyStackUnits: number;
  addOnEnabled: boolean;
  addOnCents: number;
  addOnStackUnits: number;
  levels: BlindLevel[];
  /** Host-defined payout table. Not auto-generated — must sum to 100%. */
  prizeSplit: PrizeSlot[];
  levelsAuto: boolean;
}

export interface ClockState {
  /** Index into TournamentConfig.levels. */
  levelIndex: number;
  /** Epoch ms the clock was last started, or null while paused. */
  runningSince: number | null;
  /** Milliseconds left in the current level as of the last pause. */
  remainingMs: number;
}

export interface StackPlan {
  playerId: string;
  targetUnits: number;
  counts: ChipCount;
  totalUnits: number;
  chipCount: number;
  /** false when the inventory cannot make the target exactly. */
  exact: boolean;
}

export type NoticeLevel = 'info' | 'warn' | 'error';

export interface Notice {
  level: NoticeLevel;
  message: string;
}

export interface DistributionResult {
  mode: DistributionMode;
  stacks: StackPlan[];
  /** Chips held back to cover rebuys. */
  reserve: ChipCount;
  /** Whatever is still in the box after stacks and reserve. */
  leftover: ChipCount;
  /** How many standard stacks the reserve can actually cover. */
  reserveStacks: number;
  notices: Notice[];
  feasible: boolean;
  /** Value of one standard stack, for reference. */
  standardStackUnits: number;
}

export type PayoutEntryMode = 'chips' | 'total';
export type Discrepancy = 'none' | 'scale' | 'accept';

export interface PayoutState {
  entryMode: PayoutEntryMode;
  /** playerId -> per-colour chip counts */
  chipCounts: Record<string, ChipCount>;
  /** playerId -> total chip units, when entering a total instead of counting colours */
  totals: Record<string, number>;
  resolution: Discrepancy;
  computed: boolean;
}

export interface GameState {
  version: number;
  id: string;
  name: string;
  createdAt: number;
  updatedAt: number;
  format: GameFormat;
  scale: ChipScale;
  phase: Phase;
  chipSet: ChipSet;
  players: Player[];
  ledger: LedgerEntry[];
  cash: CashConfig;
  tournament: TournamentConfig;
  distribution: DistributionResult | null;
  distributionMode: DistributionMode;
  /** Extra stacks held back from the distribution to cover rebuys. */
  reserveStacks: number;
  clock: ClockState;
  /** Player ids in bust order, first out first. Tournament only. */
  eliminations: string[];
  /** Colours raced off the table. They stop appearing in chip counts. */
  retiredColorIds: string[];
  payout: PayoutState;
}

/** A saved chip set, reusable across games. */
export interface SavedChipSet {
  id: string;
  name: string;
  scale: ChipScale;
  chipSet: ChipSet;
  savedAt: number;
}

export interface RosterPlayer {
  id: string;
  name: string;
  lastPlayedAt: number;
}

export interface GameSummary {
  id: string;
  name: string;
  format: GameFormat;
  endedAt: number;
  potCents: number;
  players: { name: string; buyInCents: number; payoutCents: number }[];
}
