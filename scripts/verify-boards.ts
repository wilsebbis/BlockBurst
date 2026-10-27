/**
 * Prove the Adventure trail and print a report:
 *   npm run verify-boards        # levels 1–70
 *   npm run verify-boards -- 140 # levels 1–140
 *
 * Each level must be beaten by Burst Bot, playing the real rules and generator, in its par.
 */
import { playOut } from '../src/engine/bot';
import { levelFor } from '../src/engine/levels';
import { adventureConfig, initialState } from '../src/engine/rules';

const levels = Number(process.argv[2] ?? 70);
let failed = 0;

console.log(`Adventure levels 1–${levels}\n`);
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
console.log('Every level is beatable in its par.');
