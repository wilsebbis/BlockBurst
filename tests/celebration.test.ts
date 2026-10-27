import { describe, expect, it } from 'vitest';
import { Celebration, type CelebrationEvent } from '../src/engine/celebration';

describe('win celebration', () => {
  it('spells the name, pops the banner, lands each star, then waits for the chest before the coins fly', () => {
    const events: CelebrationEvent[] = [];
    const c = new Celebration(390, 844, { title: 'Perfect!', ribbon: 'Level 4', stars: 3, coins: 82 }, (e) => events.push(e), 9);
    for (let i = 0; i < 60 * 8; i++) c.step(1 / 60);
    expect(events.filter((e) => e === 'letter')).toHaveLength(10);
    expect(events.filter((e) => e === 'star')).toHaveLength(3);
    expect(events.indexOf('banner')).toBeLessThan(events.indexOf('star'));
    expect(events).toContain('chest');
    expect(c.chestReady).toBe(true);
    expect(events).not.toContain('burst');
    expect(c.done).toBe(false);
    c.chest.open();
    for (let i = 0; i < 60 * 8 && !c.done; i++) c.step(1 / 60);
    expect(c.done).toBe(true);
    expect(events.filter((e) => e === 'arrive')).toHaveLength(36);
  });

  it('a new best gets one crown on the cushion instead of stars', () => {
    const events: CelebrationEvent[] = [];
    const c = new Celebration(390, 844, { title: 'New best!', ribbon: 'Classic', stars: 0, crown: true, coins: 20 }, (e) => events.push(e));
    for (let i = 0; i < 60 * 4; i++) c.step(1 / 60);
    expect(events.filter((e) => e === 'star')).toHaveLength(1);
  });

  it('a lost round lands no stars, never shows a chest, and stamps FAIL before its choices appear', () => {
    const events: CelebrationEvent[] = [];
    const c = new Celebration(390, 844, { title: 'So close!', ribbon: 'Level 2', stars: 0, fail: true, coins: 0 }, (e) => events.push(e));
    for (let i = 0; i < 60; i++) c.step(1 / 60);
    expect(c.done).toBe(false);
    for (let i = 0; i < 60 * 3; i++) c.step(1 / 60);
    expect(events).not.toContain('star');
    expect(events).not.toContain('chest');
    expect(events.filter((e) => e === 'stamp')).toHaveLength(1);
    expect(c.done).toBe(true);
  });
});
