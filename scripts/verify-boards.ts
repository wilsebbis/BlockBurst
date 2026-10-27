/**
 * Check the upcoming Daily Boards and the Adventure trail, and print a report:
 *   npm run verify-boards            # the next 14 Daily Boards and Adventure levels 1–70
 *   npm run verify-boards -- 30 140  # 30 days, levels 1–140
 *
 * For each Daily Board, Burst Bot plays it with the real rules and generator, and the run is replayed from its
 * move log to the same score (what a server does before listing it). Each Adventure level must be beaten by the
 * bot in its par.
 */
import { playOut } from '../src/engine/bot';
import { levelFor } from '../src/engine/levels';
import { adventureConfig, initialState } from '../src/engine/rules';
import { replay } from '../src/engine/RunLog';
import { dailySeed } from '../src/lib/bots';
import { addDays, utcDateKey } from '../src/lib/dates';

const days = Number(process.argv[2] ?? 14);
const levels = Number(process.argv[3] ?? 70);
let failed = 0;

console.log(`Daily Boards from ${utcDateKey()}\n`);
console.log('day         ok  moves  trays   score   lines  combo  replay');
for (let i = 0; i < days; i++) {
  const day = addDays(utcDateKey(), i);
  const cfg = { mode: 'daily' as const, seed: dailySeed(day) };
  const r = playOut(cfg, initialState(cfg), 2000);
  const again = replay(cfg, r.moves);
  const ok = r.state.over && !again.error && again.state.score === r.state.score;
  if (!ok) failed++;
  console.log(`${day}  ${ok ? '✅' : '❌'}  ${String(r.moves.length).padStart(5)}  ${String(r.state.trayIndex).padStart(5)}  ${String(r.state.score).padStart(7)}  ${String(r.state.lines).padStart(5)}  ${String(r.state.maxCombo).padStart(5)}  ${again.error ?? 'same score'}`);
}

console.log(`\nAdventure levels 1–${levels}\n`);
const t = performance.now();
let line = '';
for (let n = 1; n <= levels; n++) {
  const spec = levelFor(n);
  const cfg = adventureConfig(n);
  const r = playOut(cfg, initialState(cfg), 400);
  const ok = r.state.won && r.moves.length === spec.par;
  if (!ok) failed++;
  line += `${ok ? '✅' : '❌'}${String(n).padStart(4)} ${spec.goal.kind === 'gems' ? `💎${spec.goal.count}` : `🎯${spec.goal.target}`} par ${spec.par}`.padEnd(24);
  if (n % 4 === 0 || n === levels) {
    console.log(line);
    line = '';
  }
}
console.log(`\n(${Math.round(performance.now() - t)} ms)`);
if (failed) {
  console.error(`\n${failed} check(s) failed.`);
  process.exit(1);
}
console.log('Every Daily Board replays cleanly and every level is beatable.');
