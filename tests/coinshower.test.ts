import { describe, expect, it } from 'vitest';
import { CoinShower, type CoinEvent } from '../src/engine/coinShower';

function run(seed: number) {
  const events: CoinEvent[] = [];
  const shower = new CoinShower(390, 844, { x: 195, y: 350 }, (e) => events.push(e), seed, 36);
  let t = 0;
  while (!shower.done && t < 10) {
    shower.step(1 / 60);
    t += 1 / 60;
  }
  return { shower, events, t };
}

describe('coin shower', () => {
  it('bursts, falls, swoops and streams every coin into the corner and finishes in a few seconds', () => {
    const { shower, events, t } = run(7);
    expect(shower.done).toBe(true);
    expect(t).toBeGreaterThan(2);
    expect(t).toBeLessThan(5);
    expect(shower.collected).toBe(36);
    expect(events[0]).toBe('burst');
    expect(events.filter((e) => e === 'arrive')).toHaveLength(36);
    expect(events.filter((e) => e === 'finale')).toHaveLength(1);
    expect(events.indexOf('land')).toBeLessThan(events.indexOf('arrive'));
  });

  it('a seed plays the same shower every time', () => {
    expect(run(3).events).toEqual(run(3).events);
  });
});

describe('treasure chest', () => {
  it('waits until tapped, then rattles, pops and streams every coin home', async () => {
    const { TreasureChest } = await import('../src/engine/coinShower');
    const events: string[] = [];
    const chest = new TreasureChest(390, 844, (e) => events.push(e), 5);
    for (let i = 0; i < 600; i++) chest.step(1 / 60);
    expect(events).toEqual([]);
    expect(chest.done).toBe(false);
    chest.open();
    chest.open();
    let t = 0;
    while (!chest.done && t < 10) {
      chest.step(1 / 60);
      t += 1 / 60;
    }
    expect(chest.done).toBe(true);
    expect(events.slice(0, 3)).toEqual(['rattle', 'pop', 'burst']);
    expect(events.filter((e) => e === 'arrive')).toHaveLength(36);
  });
});

describe('coin motion', () => {
  it('no coin ever touches the floor or stops moving, on any seed or screen', () => {
    for (const [w, h] of [[390, 844], [320, 568], [1280, 800]] as const) {
      for (let seed = 1; seed <= 30; seed++) {
        const shower = new CoinShower(w, h, { x: w / 2, y: h * 0.42 }, () => {}, seed, 36);
        let t = 0;
        let lowest = Infinity;
        let slowest = Infinity;
        while (!shower.done && t < 10) {
          shower.step(1 / 60);
          t += 1 / 60;
          for (const c of shower.inFlight) {
            lowest = Math.min(lowest, c.floor - c.y);
            if (t > 0.3) slowest = Math.min(slowest, c.speed);
          }
        }
        expect(shower.done, `${w}x${h} seed ${seed}`).toBe(true);
        expect(lowest, `${w}x${h} seed ${seed}`).toBeGreaterThan(0);
        expect(slowest, `${w}x${h} seed ${seed}`).toBeGreaterThan(40);
      }
    }
  });
});
