import { challengesFor } from '../../lib/challenges';

/** A challenge id is `<day>-<stat>-<target>`; look its label up on that day's list. */
export const CHALLENGE_LABEL = (id: string) => challengesFor(id.slice(0, 10)).find((c) => c.id === id)?.label ?? 'Challenge';
