/**
 * Tilt steering from the phone's orientation sensor. iOS asks the player for permission, and only from a tap;
 * elsewhere the sensor just works, or doesn't exist. The first reading is the neutral pose, so the penguin
 * stays put however the phone is held when tilt is switched on.
 */
import type { Vector } from './pond';

export type TiltPermission = 'granted' | 'denied' | 'unsupported';

/** Tilting this far, in degrees, is full tilt. */
const FULL_TILT_DEGREES = 25;
/** Small wobbles of the hand inside this many degrees are ignored. */
const DEAD_ZONE_DEGREES = 2.5;

interface OrientationWithPermission {
  readonly requestPermission?: () => Promise<'granted' | 'denied'>;
}

/** Asks for the orientation sensor. Call it from a tap: iOS refuses the request otherwise. */
export async function requestTilt(): Promise<TiltPermission> {
  if (typeof DeviceOrientationEvent === 'undefined') {
    return 'unsupported';
  }
  const withPermission = DeviceOrientationEvent as unknown as OrientationWithPermission;
  if (withPermission.requestPermission === undefined) {
    return 'granted';
  }
  try {
    return await withPermission.requestPermission();
  } catch {
    // A refused or failed request (no tap, an insecure page) means tilt stays off; the screen says so.
    return 'denied';
  }
}

/** Calls `onTilt` with each reading as -1..1 on both axes, relative to the first reading. Returns a stop. */
export function listenToTilt(onTilt: (tilt: Vector) => void): () => void {
  let neutral: { readonly beta: number; readonly gamma: number } | 'unset' = 'unset';
  function readOrientation(event: DeviceOrientationEvent): void {
    if (event.beta === null || event.gamma === null) {
      return;
    }
    if (neutral === 'unset') {
      neutral = { beta: event.beta, gamma: event.gamma };
    }
    onTilt({ x: tiltAxis(event.gamma - neutral.gamma), y: tiltAxis(event.beta - neutral.beta) });
  }
  window.addEventListener('deviceorientation', readOrientation);
  return function stopListening() {
    window.removeEventListener('deviceorientation', readOrientation);
  };
}

function tiltAxis(degrees: number): number {
  const isInDeadZone = Math.abs(degrees) < DEAD_ZONE_DEGREES;
  if (isInDeadZone) {
    return 0;
  }
  const beyondDeadZone = degrees - (Math.sign(degrees) * DEAD_ZONE_DEGREES);
  return Math.max(-1, Math.min(1, beyondDeadZone / (FULL_TILT_DEGREES - DEAD_ZONE_DEGREES)));
}
