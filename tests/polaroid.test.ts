import { describe, expect, it } from 'vitest';
import { dateStamp, polaroidStamps, type PolaroidGame } from '../src/lib/polaroid';

const base: PolaroidGame = { score: 900, lines: 10, maxCombo: 2, bestMulti: 1, perfects: 0, newBest: false, rescued: 40, level: null };

describe('polaroid stamps', () => {
  it('a short ordinary game gets a gentle title and no badges', () => {
    expect(polaroidStamps(base)).toEqual({ title: 'A Quick Hello', badges: [] });
  });

  it('the rarest feat names the print', () => {
    expect(polaroidStamps({ ...base, perfects: 1, bestMulti: 5 }).title).toBe('Spotless');
    expect(polaroidStamps({ ...base, bestMulti: 4 }).title).toBe('The Great Flood');
    expect(polaroidStamps({ ...base, level: 12 }).title).toBe('Level 12, Cleared');
  });

  it('badges call out streaks and big moments, three at most', () => {
    const { badges } = polaroidStamps({ ...base, newBest: true, maxCombo: 5, bestMulti: 3, perfects: 2, rescued: 300 });
    expect(badges).toEqual(['👑 New best', '🔥 5-Combo Master', '➖ 3 lines at once']);
  });

  it('dates print like an old film camera', () => {
    expect(dateStamp(new Date(2026, 9, 7))).toBe("'26 10 07");
  });
});
