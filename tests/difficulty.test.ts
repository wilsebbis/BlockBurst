import { describe, expect, it } from 'vitest';
import { clearRate, difficultyLine } from '../src/lib/difficulty';

describe('level difficulty', () => {
  it('is measured, not made up: the same level always gets the same clear rate', () => {
    const a = clearRate(3, 8);
    expect(a).toBe(clearRate(3, 8));
    expect(a).toBeGreaterThanOrEqual(0);
    expect(a).toBeLessThanOrEqual(1);
  });

  it("words the rate honestly, as Burst Bot's, with a friendly label", () => {
    expect(difficultyLine(1)).toBe('🌼 Breezy level · Burst Bot clears it 100% of the time');
    expect(difficultyLine(0.6)).toContain('🙂 Steady level');
    expect(difficultyLine(0.38)).toBe('🌶️ Tricky level · Burst Bot clears it 38% of the time');
    expect(difficultyLine(0.1)).toContain('🔥 Super hard level');
  });
});
