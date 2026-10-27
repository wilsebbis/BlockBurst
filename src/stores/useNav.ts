import { create } from 'zustand';
import type { RunConfig } from '../types/game';

export type Screen = 'home' | 'play' | 'settings' | 'sanctuary' | 'exhibit';

/** The Adventure level to play: its config carries the level number and seed. */
export interface PlayRequest {
  cfg: RunConfig;
}

interface NavState {
  screen: Screen;
  play: PlayRequest | null;
  go(screen: Screen): void;
  start(req: PlayRequest): void;
}

export const useNav = create<NavState>((set) => ({
  screen: 'home',
  play: null,
  go: (screen) => set({ screen }),
  start: (req) => set({ screen: 'play', play: req }),
}));
