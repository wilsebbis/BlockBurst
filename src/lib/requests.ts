/** The play request for an Adventure level: its seed comes from the level number, so every replay starts the same. */
import { adventureConfig } from '../engine/rules';
import type { PlayRequest } from '../stores/useNav';

export const adventureRequest = (level: number): PlayRequest => ({ cfg: adventureConfig(level) });
