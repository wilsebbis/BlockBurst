import { create } from 'zustand';
import type { RunMode } from '../lib/progression';
import type { RunConfig } from '../types/game';

export type Screen = 'home' | 'play' | 'daily' | 'adventure' | 'ranks' | 'leagues' | 'crew' | 'challenges' | 'collection' | 'shop' | 'store' | 'pass' | 'events' | 'profile' | 'settings' | 'sanctuary';

export interface PlayRequest {
  cfg: RunConfig;
  mode: RunMode;
  day: string | null;
}

interface NavState {
  screen: Screen;
  returnTo: Screen;
  play: PlayRequest | null;
  go(screen: Screen): void;
  start(req: PlayRequest, from: Screen): void;
}

export const useNav = create<NavState>((set) => ({
  screen: 'home',
  returnTo: 'home',
  play: null,
  go: (screen) => set({ screen }),
  start: (req, from) => set({ screen: 'play', play: req, returnTo: from }),
}));
