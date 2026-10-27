import { describe, expect, it } from 'vitest';
import { EXHIBIT_TUNING, PENGUIN_TRICKS } from '../src/exhibit/tuning';
import { createPond, stepPond, windAt, type PondEvent, type PondInput, type PondState } from '../src/exhibit/pond';
import { planTrick, type TrickPlan } from '../src/exhibit/tricks';
import { EXHIBIT_CHECKS } from '../src/exhibit/validate';

const SIZE = { width: 1, height: 2 };
const FRAME_MS = 16;
const CENTRE = { x: 0.5, y: 1 };
const STILL = { x: 0, y: 0 };

const calmInput = (overrides: Partial<PondInput> = {}): PondInput => ({ dtMs: FRAME_MS, size: SIZE, tilt: STILL, finger: 'none', ...overrides });

/** Runs the pond for a while with the same input every frame, collecting every event. */
function run(state: PondState, plan: { readonly input: PondInput; readonly frames: number }): { readonly state: PondState; readonly events: PondEvent[] } {
  let current = state;
  const events: PondEvent[] = [];
  for (let frame = 0; frame < plan.frames; frame += 1) {
    const result = stepPond(current, plan.input);
    current = result.nextState;
    events.push(...result.domainEvents);
  }
  return { state: current, events };
}

describe('the penguin pond', () => {
  it('starts with the penguin resting in the middle of the pond', () => {
    const pond = createPond({ seed: 'test', size: SIZE });

    expect(pond.position).toEqual(CENTRE);
    expect(pond.velocity).toEqual(STILL);
  });

  it('pulls the penguin towards a dragging finger and settles it there', () => {
    const pond = createPond({ seed: 'test', size: SIZE });
    const finger = { x: 0.3, y: 1.4 };

    const after = run(pond, { input: calmInput({ finger }), frames: 120 }).state;

    expect(after.position.x).toBeCloseTo(finger.x, 1);
    expect(after.position.y).toBeCloseTo(finger.y, 1);
  });

  it('slides the penguin the way the phone is tilted', () => {
    const pond = createPond({ seed: 'test', size: SIZE });

    const after = run(pond, { input: calmInput({ tilt: { x: 1, y: 0 } }), frames: 20 }).state;

    expect(after.position.x).toBeGreaterThan(CENTRE.x + 0.01);
    expect(Math.abs(after.position.y - CENTRE.y)).toBeLessThan(0.02);
  });

  it('lets the water slow a drifting penguin to a stop', () => {
    const resting = createPond({ seed: 'test', size: SIZE });
    const pushed = { ...resting, velocity: { x: 0.6, y: 0 } };

    const pushedAfter = run(pushed, { input: calmInput(), frames: 600 }).state;
    const restingAfter = run(resting, { input: calmInput(), frames: 600 }).state;

    // Whatever the wind is doing by then, the push itself has died away.
    expect(Math.abs(pushedAfter.velocity.x - restingAfter.velocity.x)).toBeLessThan(0.01);
  });

  it('keeps the whole ring inside the pond and bounces it off the edge with a splash', () => {
    const { radius } = EXHIBIT_TUNING.penguin;
    const pond = { ...createPond({ seed: 'test', size: SIZE }), velocity: { x: 1.5, y: 0 } };

    const { state, events } = run(pond, { input: calmInput(), frames: 60 });

    expect(state.position.x).toBeLessThanOrEqual(SIZE.width - radius);
    expect(events.some((event) => event.kind === 'penguin.bumped' && event.edge === 'right')).toBe(true);
  });

  it('blows gusts of wind on a schedule from the seed, so the same seed gives the same weather', () => {
    const first = run(createPond({ seed: 'same', size: SIZE }), { input: calmInput(), frames: 2_000 });
    const second = run(createPond({ seed: 'same', size: SIZE }), { input: calmInput(), frames: 2_000 });

    expect(first.events.filter((event) => event.kind === 'gust.started').length).toBeGreaterThan(0);
    expect(second.state).toEqual(first.state);
  });

  it('always has at least a light breeze, and a stronger wind during a gust', () => {
    const pond = createPond({ seed: 'test', size: SIZE });
    const duringGust = { ...pond, elapsedMs: pond.gust.startsAtMs + (pond.gust.durationMs / 2) };

    const calmSpeed = Math.hypot(windAt(pond).x, windAt(pond).y);
    const gustSpeed = Math.hypot(windAt(duringGust).x, windAt(duringGust).y);

    expect(calmSpeed).toBeCloseTo(EXHIBIT_TUNING.wind.breeze, 5);
    expect(gustSpeed).toBeGreaterThan(calmSpeed);
  });

  it('treats a long pause (a hidden tab) as one short step, so the penguin never jumps', () => {
    const pond = { ...createPond({ seed: 'test', size: SIZE }), velocity: { x: 0.5, y: 0 } };

    const after = stepPond(pond, calmInput({ dtMs: 60_000 })).nextState;

    expect(Math.abs(after.position.x - CENTRE.x)).toBeLessThan(0.05);
  });
});

describe('the penguin\'s tricks', () => {
  it('waits a little before the first trick', () => {
    const { min, max } = EXHIBIT_TUNING.tricks.firstAfterMs;

    const first = planTrick({ seed: 'test', after: 'none', nowMs: 0 });

    expect(first.startsAtMs).toBeGreaterThanOrEqual(min);
    expect(first.startsAtMs).toBeLessThanOrEqual(max);
  });

  it('never does the same trick twice in a row, and rests between tricks', () => {
    const { min, max } = EXHIBIT_TUNING.tricks.betweenMs;
    let plan: TrickPlan = planTrick({ seed: 'test', after: 'none', nowMs: 0 });

    for (let trick = 0; trick < 30; trick += 1) {
      const finishedAtMs = plan.startsAtMs + 8_000;
      const next = planTrick({ seed: 'test', after: plan, nowMs: finishedAtMs });

      expect(next.trick).not.toBe(plan.trick);
      expect(next.startsAtMs - finishedAtMs).toBeGreaterThanOrEqual(min);
      expect(next.startsAtMs - finishedAtMs).toBeLessThanOrEqual(max);
      plan = next;
    }
  });

  it('plans the same tricks from the same seed', () => {
    const first = planTrick({ seed: 'visit-3', after: 'none', nowMs: 0 });

    expect(planTrick({ seed: 'visit-3', after: 'none', nowMs: 0 })).toEqual(first);
    expect(PENGUIN_TRICKS.map((clip) => clip.trick)).toContain(first.trick);
  });
});

describe('the exhibit tuning', () => {
  it('passes every value check (ordered ranges, gusts that end before the next, a sensible ring, tricks listed once)', () => {
    expect(EXHIBIT_CHECKS.flatMap((check) => check())).toEqual([]);
  });
});
