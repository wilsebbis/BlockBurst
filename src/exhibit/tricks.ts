/** When the exhibit's penguin does a trick, and which one: seeded, never the same trick twice in a row. */
import { EXHIBIT_TUNING, PENGUIN_TRICKS, type PenguinTrick } from './tuning';
import { createRng } from '../engine/rng';

export interface TrickPlan {
  readonly trickNumber: number;
  readonly trick: PenguinTrick;
  readonly startsAtMs: number;
}

/** Plans the next trick from `nowMs`: the visit's first trick, or the one after `after` has finished. */
export function planTrick(request: { readonly seed: string; readonly after: TrickPlan | 'none'; readonly nowMs: number }): TrickPlan {
  const isFirst = request.after === 'none';
  const trickNumber = request.after === 'none' ? 0 : request.after.trickNumber + 1;
  const rng = createRng(`${request.seed}/trick/${trickNumber}`);
  const wait = isFirst ? EXHIBIT_TUNING.tricks.firstAfterMs : EXHIBIT_TUNING.tricks.betweenMs;
  const previous = request.after === 'none' ? 'none' : request.after.trick;
  const allTricks = PENGUIN_TRICKS.map((clip) => clip.trick);
  const freshTricks = allTricks.filter((trick) => trick !== previous);
  const choices = freshTricks.length > 0 ? freshTricks : allTricks;
  return { trickNumber, trick: rng.pick(choices), startsAtMs: request.nowMs + rng.range(wait.min, wait.max) };
}
