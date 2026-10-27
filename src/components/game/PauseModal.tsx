import { ModalShell } from './ModalShell';
import { Button } from '../shared/ui';

/** Pause sells nothing: resume, start over, or leave (an unfinished game can be continued from Home). */
export function PauseModal({ onResume, onRestart, onQuit, canSave }: { onResume(): void; onRestart(): void; onQuit(): void; canSave: boolean }) {
  return (
    <ModalShell label="Paused">
      <h2 className="text-center font-display text-3xl font-extrabold">Paused</h2>
      <p className="mt-1 text-center text-sm font-bold text-white/70">Take your time. Nothing moves until you're back.</p>
      <div className="mt-4 grid gap-2">
        <Button tone="go" onClick={onResume} autoFocus>
          ▶ Resume
        </Button>
        <Button tone="ghost" onClick={onRestart}>
          ↺ Start over
        </Button>
        <Button tone="ghost" onClick={onQuit}>
          🏠 Home{canSave ? ' (continue later)' : ''}
        </Button>
      </div>
    </ModalShell>
  );
}
