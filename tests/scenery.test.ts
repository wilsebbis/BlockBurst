import { describe, expect, it } from 'vitest';
import { SCENES } from '../src/engine/scenes';
import { JOURNEY, JOURNEY_STEP, sceneFor } from '../src/lib/scenery';

describe('scenery', () => {
  it('Classic is a journey: it starts in the meadow and moves on every few thousand points, then loops', () => {
    const at = (score: number) => sceneFor({ pick: 'journey', mode: 'classic', day: null, score });
    expect(at(0)).toBe('meadow');
    expect(at(JOURNEY_STEP - 1)).toBe('meadow');
    expect(at(JOURNEY_STEP)).toBe('forest');
    expect(at(JOURNEY_STEP * JOURNEY.length)).toBe('meadow');
  });

  it('the journey visits every scene', () => {
    expect([...JOURNEY].sort()).toEqual(SCENES.map((s) => s.id).sort());
  });

  it('Adventure worlds keep one scene for all their levels, whatever the score', () => {
    expect(sceneFor({ pick: 'journey', mode: 'adventure', day: null, level: 1, score: 99999 })).toBe('beach');
    expect(sceneFor({ pick: 'journey', mode: 'adventure', day: null, level: 10, score: 0 })).toBe('beach');
    expect(sceneFor({ pick: 'journey', mode: 'adventure', day: null, level: 21, score: 0 })).toBe('caverns');
  });

  it('the Daily Board has one scene a day, the same for everyone, and it holds all game', () => {
    const a = sceneFor({ pick: 'journey', mode: 'daily', day: '2026-10-27', score: 0 });
    expect(sceneFor({ pick: 'journey', mode: 'daily', day: '2026-10-27', score: 20000 })).toBe(a);
  });

  it('a scene picked in Settings wins everywhere', () => {
    expect(sceneFor({ pick: 'snow', mode: 'classic', day: null, score: 9000 })).toBe('snow');
    expect(sceneFor({ pick: 'snow', mode: 'adventure', day: null, level: 3, score: 0 })).toBe('snow');
  });
});
