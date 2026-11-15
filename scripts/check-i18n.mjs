// Reports i18n keys used in src/ that are missing from src/i18n/en.ts, and keys never used.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const walk = (d) => readdirSync(d).flatMap((f) => (statSync(join(d, f)).isDirectory() ? walk(join(d, f)) : [join(d, f)]))
const files = walk('src').filter((f) => /\.(ts|tsx)$/.test(f))
const en = readFileSync('src/i18n/en.ts', 'utf8')
const defined = new Set([...en.matchAll(/^\s*'([^']+)':/gm)].map((m) => m[1]))
const prefixes = 'add|ai|ask|band|brief|chip|common|conf|event|explain|family|gate|kind|legend|lib|locked|match|metric|nav|notfound|outcome|parity|period|player|print|proc|replay|settings|shell|signin|stage|status|table|threshold|tier'
const re = new RegExp(`'((?:${prefixes})\\.[a-z_0-9./]+)'`, 'g')
const used = new Map()
for (const f of files) {
  if (f.endsWith('en.ts')) continue
  const s = readFileSync(f, 'utf8')
  for (const m of s.matchAll(re)) used.set(m[1], f)
}
const missing = [...used].filter(([k]) => !defined.has(k))
console.log(`used ${used.size}, defined ${defined.size}`)
if (missing.length) {
  console.log('MISSING:')
  for (const [k, f] of missing) console.log(' ', k, ' <-', f)
  process.exitCode = 1
}
