/** Opt-in haptic taps (navigator.vibrate). Off by default; respects the player's setting every call. */
import { useMetaStore } from '../stores/useMetaStore';

export function buzz(pattern: number | number[] = 12): void {
  if (!useMetaStore.getState().settings.haptics) return;
  if (typeof navigator !== 'undefined' && 'vibrate' in navigator) navigator.vibrate(pattern);
}
