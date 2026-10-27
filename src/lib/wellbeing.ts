/**
 * Natural stopping points ("Player psychology": the timing test). An optional, off-by-default break reminder that
 * only ever appears on the end-of-run screen, which is already a natural place to stop, never mid-run.
 */
export const BREAK_OPTIONS = [0, 20, 30, 45, 60];

export function suggestBreak(sessionMs: number, minutes: number, alreadyShown: boolean): boolean {
  return minutes > 0 && !alreadyShown && sessionMs >= minutes * 60_000;
}
