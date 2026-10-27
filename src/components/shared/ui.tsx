import clsx from 'clsx';
import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { synth } from '../../engine/WebAudioSynthesizer';

type Tone = 'gold' | 'go' | 'cool' | 'hot' | 'grape' | 'ghost' | 'dark';

const TONES: Record<Tone, string> = {
  gold: 'bg-amber-400 text-night-950 hover:bg-amber-300',
  go: 'bg-emerald-400 text-night-950 hover:bg-emerald-300',
  cool: 'bg-sky-400 text-night-950 hover:bg-sky-300',
  hot: 'bg-rose-500 text-white hover:bg-rose-400',
  grape: 'bg-violet-500 text-white hover:bg-violet-400',
  ghost: 'bg-white/10 text-white hover:bg-white/20',
  dark: 'bg-night-950 text-white hover:bg-night-800',
};

/** Buttons are at least 48 px tall (touch targets) and press down with transform only. */
export function Button({ tone = 'gold', className, children, onClick, ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone }) {
  return (
    <button
      {...rest}
      onClick={(e) => {
        synth.unlock();
        synth.playTap();
        onClick?.(e);
      }}
      className={clsx(
        'inline-flex min-h-tap items-center justify-center gap-2 rounded-2xl border-[3px] border-night-950 px-4 py-2 font-display font-extrabold shadow-chunky-sm transition-transform duration-150 ease-out active:translate-y-0.5 active:shadow-none disabled:cursor-not-allowed disabled:opacity-45',
        TONES[tone],
        className,
      )}
    >
      {children}
    </button>
  );
}

export function Panel({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={clsx('rounded-blob border-[3px] border-night-950 bg-night-800/90 p-4 shadow-chunky', className)}>{children}</div>;
}

export function ScreenHeader({ title, onBack, right }: { title: string; onBack: () => void; right?: ReactNode }) {
  return (
    <header className="flex items-center gap-3 px-4 pb-2 pt-[max(1rem,env(safe-area-inset-top))]">
      <Button tone="ghost" className="!px-3" onClick={onBack} aria-label="Back">
        ←
      </Button>
      <h1 className="flex-1 truncate font-display text-3xl font-extrabold text-white text-outline">{title}</h1>
      {right}
    </header>
  );
}

export function Pill({ children, className, title }: { children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx('inline-flex items-center gap-1 rounded-full border-2 border-night-950 bg-night-950/60 px-2.5 py-0.5 font-display text-sm font-extrabold text-white', className)}>
      {children}
    </span>
  );
}

export function Meter({ value, className, tone = 'bg-emerald-400', label }: { value: number; className?: string; tone?: string; label?: string }) {
  const pct = Math.round(Math.min(1, Math.max(0, value)) * 100);
  return (
    <div className={clsx('h-3 overflow-hidden rounded-full border-2 border-night-950 bg-night-950/70', className)} role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      {/* scaleX, not width: the bar animates on the compositor. */}
      <div className={clsx('h-full w-full origin-left transition-transform duration-300 ease-out', tone)} style={{ transform: `scaleX(${pct / 100})` }} />
    </div>
  );
}

export function Screen({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={clsx('mx-auto flex h-full w-full max-w-lg flex-col overflow-y-auto pb-28', className)}>{children}</div>;
}

export function Section({ title, children, className }: { title: string; children: ReactNode; className?: string }) {
  return (
    <section className={clsx('mt-4 px-4', className)}>
      <h2 className="mb-2 font-display text-lg font-extrabold text-white/90">{title}</h2>
      {children}
    </section>
  );
}
