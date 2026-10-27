/**
 * The Penguin Exhibit: a calm pond to watch. The penguin floats on its ring, now and then sips lemonade or
 * sunbathes, and can be dragged around or steered by tilting the phone. Nothing to win, nothing to buy.
 */
import { useEffect, useRef, useState } from 'react';
import { Button } from '../components/shared/ui';
import { ExhibitController } from '../exhibit/exhibitController';
import { listenToTilt, requestTilt, type TiltPermission } from '../exhibit/tilt';
import { useMetaStore } from '../stores/useMetaStore';
import { useNav } from '../stores/useNav';

type TiltStatus = 'off' | 'on' | Exclude<TiltPermission, 'granted'>;

const TILT_LABELS: Readonly<Record<TiltStatus, string>> = {
  off: '📱 Tilt to steer',
  on: '📱 Tilt on · tap to stop',
  denied: '📱 Tilt not allowed',
  unsupported: '📱 No tilt on this device',
};

export function ExhibitScreen() {
  const go = useNav((nav) => nav.go);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controller = usePond(canvasRef);
  const [tilt, setTilt] = useTilt(controller);
  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-sky-300">
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full touch-none" aria-label="A penguin floating on a rubber ring in a pool" />
      <header className="pointer-events-none absolute inset-x-0 top-0 flex items-center gap-3 px-4 pt-[max(1rem,env(safe-area-inset-top))]">
        <Button tone="ghost" className="pointer-events-auto !px-3" onClick={() => go('home')} aria-label="Back">
          ←
        </Button>
        <h1 className="font-display text-3xl font-extrabold text-[#ffffff] drop-shadow-[0_2px_0_rgba(15,13,51,0.55)]">Penguin Exhibit</h1>
      </header>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex flex-col items-center gap-2 px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <p className="rounded-full bg-[rgba(15,13,51,0.45)] px-4 py-1 text-center font-display font-extrabold text-[#ffffff]">Drag the penguin, or tilt your phone.</p>
        <Button tone={tilt === 'on' ? 'go' : 'cool'} className="pointer-events-auto" disabled={tilt === 'denied' || tilt === 'unsupported'} onClick={setTilt}>
          {TILT_LABELS[tilt]}
        </Button>
      </div>
    </div>
  );
}

/** Starts the pond on the canvas for as long as the screen is open. */
function usePond(canvasRef: React.RefObject<HTMLCanvasElement | null>): React.RefObject<ExhibitController | null> {
  const controller = useRef<ExhibitController | null>(null);
  const reducedMotion = useMetaStore((store) => store.settings.reducedMotion);
  useEffect(
    function runPond() {
      const canvas = canvasRef.current;
      if (canvas === null) {
        return undefined;
      }
      const isCalm = reducedMotion || matchMedia('(prefers-reduced-motion: reduce)').matches;
      // Every visit gets its own weather and trick order; the seed only has to differ between visits.
      const pond = new ExhibitController(canvas, { seed: `exhibit/${performance.timeOrigin + performance.now()}`, isCalm });
      controller.current = pond;
      pond.start();
      return function closePond() {
        pond.stop();
        controller.current = null;
      };
    },
    [canvasRef, reducedMotion],
  );
  return controller;
}

/** Tilt steering: off until the player taps, because iOS only asks for the sensor from a tap. */
function useTilt(controller: React.RefObject<ExhibitController | null>): readonly [TiltStatus, () => void] {
  const [status, setStatus] = useState<TiltStatus>('off');
  const stopListening = useRef<(() => void) | 'none'>('none');
  useEffect(function stopTiltOnLeave() {
    return function stopTilt() {
      if (stopListening.current !== 'none') {
        stopListening.current();
      }
    };
  }, []);
  async function turnOn(): Promise<void> {
    const permission = await requestTilt();
    if (permission !== 'granted') {
      setStatus(permission);
      return;
    }
    stopListening.current = listenToTilt((tilt) => controller.current?.setTilt(tilt));
    setStatus('on');
  }
  function toggle(): void {
    if (status !== 'on') {
      // The request resolves after the player answers the permission prompt; turnOn handles every outcome.
      void turnOn();
      return;
    }
    if (stopListening.current !== 'none') {
      stopListening.current();
      stopListening.current = 'none';
    }
    controller.current?.setTilt({ x: 0, y: 0 });
    setStatus('off');
  }
  return [status, toggle];
}
