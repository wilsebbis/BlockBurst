/**
 * A designed error state instead of a blank page. Progress lives in IndexedDB and an unfinished game in its move
 * log, so a reload loses nothing. A crash reporter (Sentry, Crashlytics) would hook in at componentDidCatch.
 */
import { Component, type ReactNode } from 'react';

export class ErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error): void {
    console.error('Block Burst hit an error:', error);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="app-bg flex h-full flex-col items-center justify-center gap-3 p-6 text-center text-white" role="alert">
        <p className="text-6xl" aria-hidden>
          🧱💥
        </p>
        <h1 className="font-display text-3xl font-extrabold">Something came loose</h1>
        <p className="max-w-xs text-sm font-bold text-white/80">Your progress is saved, and an unfinished game can be continued from Home. Reloading usually fixes this.</p>
        <button className="min-h-tap rounded-2xl border-[3px] border-night-950 bg-amber-400 px-6 font-display font-extrabold text-night-950 shadow-chunky-sm" onClick={() => location.reload()}>
          Reload
        </button>
      </div>
    );
  }
}
