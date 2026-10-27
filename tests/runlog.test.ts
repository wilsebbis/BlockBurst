import { describe, expect, it } from 'vitest';
import { playOut } from '../src/engine/bot';
import { initialState } from '../src/engine/rules';
import { decodeLog, encodeLog, hashLog, MIN_MS_PER_MOVE, replay, verifyRun } from '../src/engine/RunLog';
import type { RunConfig } from '../src/types/game';

const cfg: RunConfig = { mode: 'daily', seed: 'burst/daily/v1/2026-10-25' };
const run = playOut(cfg, initialState(cfg), 1000);

describe('run log', () => {
  it('encodes and decodes moves losslessly', () => {
    expect(decodeLog(encodeLog(run.moves))).toEqual(run.moves);
    expect(decodeLog('')).toEqual([]);
  });

  it('replays to the same final state', () => {
    const r = replay(cfg, run.moves);
    expect(r.error).toBeUndefined();
    expect(r.state).toEqual(run.state);
  });

  it('the hash chain depends on the config and every move', async () => {
    const h = await hashLog(cfg, run.moves);
    expect(await hashLog(cfg, run.moves)).toBe(h);
    expect(await hashLog({ ...cfg, seed: 'other' }, run.moves)).not.toBe(h);
    const tampered = run.moves.slice();
    tampered[3] = { ...tampered[3], c: (tampered[3].c + 1) % 8 };
    expect(await hashLog(cfg, tampered)).not.toBe(h);
  });

  it('verifies an honest run and rejects forgeries', async () => {
    const hash = await hashLog(cfg, run.moves);
    const claim = { score: run.state.score, lines: run.state.lines, timeMs: run.moves.length * 2000, hash };
    expect((await verifyRun(cfg, run.moves, claim)).ok).toBe(true);
    expect((await verifyRun(cfg, run.moves, { ...claim, score: claim.score + 10 })).reason).toBe('score mismatch');
    expect((await verifyRun(cfg, run.moves, { ...claim, lines: claim.lines + 1 })).reason).toBe('lines mismatch');
    expect((await verifyRun(cfg, run.moves, { ...claim, hash: 'x' })).reason).toBe('hash mismatch');
    expect((await verifyRun(cfg, run.moves, { ...claim, timeMs: run.moves.length * MIN_MS_PER_MOVE - 1 })).reason).toBe('too fast');
    expect((await verifyRun(cfg, run.moves.slice(0, 5), claim)).reason).toBe('run did not end');
    expect((await verifyRun(cfg, [...run.moves, { slot: 0, r: 0, c: 0 }], claim)).reason).toMatch(/after the run ended/);
    const illegal = run.moves.slice();
    illegal[1] = { ...illegal[0] };
    expect((await verifyRun(cfg, illegal, claim)).reason).toMatch(/illegal move/);
  });
});
