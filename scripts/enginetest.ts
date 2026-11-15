import { Engine, SLOTS } from '../src/lib/engine'
import pack from '../src/mock/packs/optical.json'
const eng = new Engine(pack.events as never, { htAt: pack.htAt, duration: pack.duration, players: true, showHome: true, showAway: true, showBall: true })
let max = 0, sum = 0, n = 0
const t0 = performance.now()
for (let t = 100; t < 5600; t += 0.5) {
  if (Math.abs(t - 2790) < 12) continue
  const f = eng.frame(t)
  for (const p of f.players) { sum += p.speed; n++; if (p.speed > max) max = p.speed }
}
console.log('frames/s cost ms per frame', ((performance.now() - t0) / 11000).toFixed(3))
console.log('mean speed', (sum / n).toFixed(2), 'max', max.toFixed(1))
for (const [team, num] of [['h', 10], ['h', 1], ['a', 7]] as const) console.log(team, num, 'distance km at 90:', (eng.distanceAt(team, num, 5400) / 1000).toFixed(1))
// jump check: max displacement between consecutive 40ms frames
let jump = 0, jt = 0
let prev = eng.frame(100)
for (let t = 100.04; t < 5600; t += 0.04) {
  if (Math.abs(t - 2790) < 12) { prev = eng.frame(t); continue }
  const f = eng.frame(t)
  for (let i = 0; i < f.players.length; i++) { const d = Math.hypot(f.players[i].x - prev.players[i].x, f.players[i].y - prev.players[i].y); if (d > jump) { jump = d; jt = t } }
  const bd = Math.hypot(f.ball.x - prev.ball.x, f.ball.y - prev.ball.y)
  if (bd > 8) console.log('ball jump', bd.toFixed(1), 'at', t.toFixed(2))
  prev = f
}
console.log('max player step per frame (m)', jump.toFixed(2), 'at', jt.toFixed(1), '=> m/s', (jump / 0.04).toFixed(1))
void SLOTS
