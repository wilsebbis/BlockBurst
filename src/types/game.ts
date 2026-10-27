/**
 * Shared types for Block Burst.
 *
 * The game is split into two layers, the same way Cluck Crossing, AntLink and Bark Battle are:
 *  - the *logical* layer (RunConfig + GameState + Move), pure and deterministic: a run is its config plus the list
 *    of moves, and every tray the generator deals is a function of the seed, the tray number and the board;
 *  - the *visual* layer (canvas renderer, particles, drag), which only draws what the logical layer decided.
 * Same config + same moves => same run, on any device, at any frame rate.
 */

/** One piece in the tray: a catalogue shape and a colour index (1–7). */
export interface Piece {
  shape: string;
  colour: number;
}

/** Three slots; a slot empties when its piece is placed, and a fresh tray is dealt when all three are empty. */
export type Tray = (Piece | null)[];

/** Place the piece in `slot` with its top-left cell at (r, c). */
export interface Move {
  slot: number;
  r: number;
  c: number;
}

export type GameMode = 'classic' | 'daily' | 'adventure';

export interface RunConfig {
  mode: GameMode;
  seed: string;
  /** Adventure level number (1-based). */
  level?: number;
}

export type Goal = { kind: 'gems'; count: number } | { kind: 'score'; target: number };

export interface GameState {
  /** 64 cells, row-major. 0 is empty, 1–7 a block colour. */
  grid: number[];
  tray: Tray;
  /** How many trays have been dealt so far (the next deal uses this number). */
  trayIndex: number;
  score: number;
  /** Clears in a row. A combo survives up to two placements without a clear and ends on the third. */
  combo: number;
  sinceClear: number;
  maxCombo: number;
  lines: number;
  /** Most lines cleared by one placement. */
  bestMulti: number;
  perfects: number;
  placed: number;
  cells: number;
  /** Adventure: cells whose block carries a gem. A gem is collected when its line is cleared. */
  gems: number[];
  gemsCollected: number;
  goal: Goal | null;
  over: boolean;
  won: boolean;
}

/** What one move did, for the renderer, the sound and the score popups. */
export interface MoveEvents {
  placePoints: number;
  clearPoints: number;
  perfectPoints: number;
  rows: number[];
  cols: number[];
  /** Cleared cells with the colour they had, for particles. */
  cleared: { i: number; colour: number; gem: boolean }[];
  combo: number;
  perfect: boolean;
  gems: number;
  dealt: boolean;
}
