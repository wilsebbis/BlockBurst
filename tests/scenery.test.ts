import { describe, expect, it } from 'vitest';
import { WORLDS } from '../src/engine/levels';
import { SCENES } from '../src/engine/scenes';
import { sceneFor, WORLD_SCENES } from '../src/lib/scenery';

describe('scenery', () => {
  it('each Adventure world keeps one scene for all its levels', () => {
    expect(sceneFor({ pick: 'journey', level: 1 })).toBe('beach');
    expect(sceneFor({ pick: 'journey', level: 10 })).toBe('beach');
    expect(sceneFor({ pick: 'journey', level: 11 })).toBe('forest');
    expect(sceneFor({ pick: 'journey', level: 21 })).toBe('caverns');
  });

  it('gives every world a scene, and the scenes loop with the trail', () => {
    expect(WORLD_SCENES.length).toBe(WORLDS.length);
    expect(sceneFor({ pick: 'journey', level: WORLDS.length * 10 + 1 })).toBe('beach');
    for (const id of WORLD_SCENES) expect(SCENES.map((scene) => scene.id)).toContain(id);
  });

  it('a scene picked in Settings wins on every level', () => {
    expect(sceneFor({ pick: 'nursery', level: 1 })).toBe('nursery');
    expect(sceneFor({ pick: 'pond', level: 33 })).toBe('pond');
  });
});
