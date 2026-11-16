/**
 * WCAG contrast verification for the design tokens. Reads src/styles/tokens.css, resolves
 * rgba() colours against the surface they sit on, and checks each pair against its threshold:
 *   text 4.5:1 (AA), large text and graphics 3:1 (AA, WCAG 1.4.11).
 * Writes docs/contrast.md and exits non-zero if any pair fails.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'

type RGBA = [number, number, number, number]
const css = readFileSync('src/styles/tokens.css', 'utf8')

function block(selector: string): Record<string, string> {
  const start = css.indexOf(selector)
  const open = css.indexOf('{', start)
  const close = css.indexOf('\n}', open)
  const out: Record<string, string> = {}
  for (const m of css.slice(open, close).matchAll(/--([a-z0-9-]+):\s*([^;]+?)\s*(?:\/\*.*?\*\/)?;/g)) out[m[1]] = m[2].trim()
  return out
}
const dark = block(':root')
const print = { ...dark, ...block("[data-theme='print']") }

function parse(v: string): RGBA {
  const hex = v.match(/^#([0-9a-f]{6})$/i)
  if (hex) return [parseInt(hex[1].slice(0, 2), 16), parseInt(hex[1].slice(2, 4), 16), parseInt(hex[1].slice(4, 6), 16), 1]
  const rgba = v.match(/^rgba?\(([^)]+)\)$/)
  if (rgba) {
    const p = rgba[1].split(',').map((x) => parseFloat(x))
    return [p[0], p[1], p[2], p[3] ?? 1]
  }
  throw new Error(`cannot parse ${v}`)
}
const over = (fg: RGBA, bg: RGBA): RGBA => [0, 1, 2].map((i) => fg[i] * fg[3] + bg[i] * (1 - fg[3])).concat(1) as RGBA
const lin = (c: number) => ((c /= 255) <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)
const lum = (c: RGBA) => 0.2126 * lin(c[0]) + 0.7152 * lin(c[1]) + 0.0722 * lin(c[2])
const ratio = (a: RGBA, b: RGBA) => {
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

interface Pair {
  theme: 'dark' | 'print'
  fg: string
  bg: string
  min: number
  use: string
}
const T = (theme: 'dark' | 'print', fgs: string[], bgs: string[], min: number, use: string): Pair[] => fgs.flatMap((fg) => bgs.map((bg) => ({ theme, fg, bg, min, use })))

const pairs: Pair[] = [
  ...T('dark', ['fg-1', 'fg-2', 'fg-3', 'fg-4'], ['canvas', 'surface-1', 'surface-2', 'surface-3'], 4.5, 'Text'),
  ...T('dark', ['accent-text'], ['canvas', 'surface-1', 'surface-2', 'surface-3'], 4.5, 'Link and accent text'),
  ...T('dark', ['on-accent'], ['accent-fill', 'accent-fill-hover', 'accent-fill-active'], 4.5, 'Checked control (blue fill)'),
  ...T('dark', ['on-primary'], ['primary-fill', 'primary-fill-hover', 'primary-fill-active'], 4.5, 'Primary button label'),
  ...T('print', ['on-primary'], ['primary-fill', 'primary-fill-hover', 'primary-fill-active'], 4.5, 'Primary button label (print)'),
  ...T('dark', ['accent'], ['canvas', 'surface-1', 'surface-2'], 3, 'Focus ring, selection (graphic)'),
  ...T('dark', ['parity-ink', 'parity-ink-dim'], ['surface-1', 'surface-2', 'surface-3'], 4.5, 'Parity text and icon'),
  ...T('dark', ['parity-ink'], ['mix:parity-ink@0.25/surface-1', 'mix:parity-ink@0.25/surface-2'], 4.5, 'Degraded badge text on its light fill'),
  ...T('print', ['parity-ink'], ['mix:parity-ink@0.25/canvas'], 4.5, 'Print degraded badge text on its light fill'),
  ...T('dark', ['on-parity'], ['parity-ink', 'parity-ink-dim'], 4.5, 'Text on filled parity badge'),
  ...T('dark', ['dq-poor', 'dq-suboptimal', 'dq-good', 'dq-optimal'], ['surface-1', 'surface-2', 'surface-3'], 4.5, 'Decision quality band text'),
  ...T('dark', ['danger', 'warn'], ['canvas', 'surface-1', 'surface-2'], 4.5, 'Status text'),
  ...T('dark', ['on-team-home'], ['team-home'], 4.5, 'Shirt number on Home marker'),
  ...T('dark', ['on-team-away'], ['team-away'], 4.5, 'Shirt number on Away marker'),
  ...T('dark', ['team-home', 'team-away', 'highlight'], ['pitch'], 3, 'Pitch markers (graphic)'),
  ...T('dark', ['team-home', 'team-away'], ['surface-1'], 3, 'Team dot in panels (graphic)'),
  ...T('dark', ['pitch-line'], ['pitch'], 1.8, 'Pitch lines (decorative, not required)'),
  ...T('dark', ['control-border'], ['surface-1', 'canvas', 'surface-2'], 3, 'Form control edges (1.4.11)'),
  ...T('dark', ['conf-ink'], ['surface-1', 'surface-2'], 3, 'Confidence texture (graphic)'),
  ...T('print', ['fg-1', 'fg-2', 'fg-3', 'fg-4'], ['canvas', 'surface-2', 'surface-3'], 4.5, 'Print text'),
  ...T('print', ['accent-text'], ['canvas', 'surface-2'], 4.5, 'Print link text'),
  ...T('print', ['parity-ink', 'parity-ink-dim'], ['canvas', 'surface-2'], 4.5, 'Print parity text'),
  ...T('print', ['on-parity'], ['parity-ink', 'parity-ink-dim'], 4.5, 'Print filled parity badge'),
  ...T('print', ['dq-poor', 'dq-suboptimal', 'dq-good', 'dq-optimal'], ['canvas', 'surface-2'], 4.5, 'Print decision quality text'),
  ...T('print', ['control-border'], ['canvas'], 3, 'Print control edges'),
  ...T('print', ['conf-ink'], ['canvas'], 3, 'Print confidence texture'),
]

const rows: string[] = []
let fails = 0
for (const p of pairs) {
  const set = p.theme === 'dark' ? dark : print
  // 'mix:<token>@<alpha>/<surface>' is a tinted fill: the token at that alpha over the surface.
  const mix = p.bg.match(/^mix:([a-z0-9-]+)@([0-9.]+)\/([a-z0-9-]+)$/)
  const bg = mix ? over([...parse(set[mix[1]]).slice(0, 3), parseFloat(mix[2])] as RGBA, parse(set[mix[3]])) : parse(set[p.bg])
  const fg = over(parse(set[p.fg]), bg)
  const r = ratio(fg, bg)
  const ok = r >= p.min
  if (!ok) fails++
  rows.push(`| ${p.theme} | \`--${p.fg}\` | \`--${p.bg}\` | ${r.toFixed(2)}:1 | ${p.min}:1 | ${ok ? 'Pass' : 'FAIL'} | ${p.use} |`)
}

// Heat ramp: relative luminance must rise monotonically so ordering survives greyscale.
const heat = Array.from({ length: 9 }, (_, i) => lum(parse(dark[`heat-${i}`])))
const mono = heat.every((v, i) => i === 0 || v > heat[i - 1])
const heatVsPitch = Array.from({ length: 9 }, (_, i) => ratio(parse(dark[`heat-${i}`]), parse(dark.pitch)).toFixed(2))

const md = `# Contrast verification

Generated by \`npm run contrast\` from \`src/styles/tokens.css\`. Thresholds: 4.5:1 for text, 3:1 for graphics and control edges.
Semi-transparent tokens are composited over the surface listed in the row.

| Theme | Foreground | Background | Ratio | Needs | Result | Use |
| --- | --- | --- | --- | --- | --- | --- |
${rows.join('\n')}

## Heat ramp

Relative luminance rises on every step (${mono ? 'verified' : 'NOT monotonic'}), so the value surface stays ordered in greyscale and for colour-blind viewers.
Contrast of each step against the pitch fill: ${heatVsPitch.map((v, i) => `heat-${i} ${v}`).join(', ')}.
Heat is always drawn with the overlay legend and never carries meaning alone: the value is also readable in the explainability card.

## Result

${fails === 0 ? 'All required pairs pass.' : `${fails} pair(s) fail.`} Pitch lines are decorative and held to 1.8:1 only.
`
mkdirSync('docs', { recursive: true })
writeFileSync('docs/contrast.md', md)
console.log(md.split('\n').filter((l) => /FAIL|Result|pass|fail/i.test(l)).join('\n'))
console.log(`${pairs.length} pairs, ${fails} failing`)
if (fails) process.exitCode = 1
