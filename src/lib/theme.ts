/** Reads design tokens from CSS custom properties so canvas drawing never hard-codes colour. */
export interface CanvasTheme {
  pitch: string
  line: string
  hex: string
  home: string
  away: string
  highlight: string
  fg: string
  canvas: string
  onHome: string
  onAway: string
  heat: string[]
}
let cached: CanvasTheme | null = null
export function readTheme(force = false): CanvasTheme {
  if (cached && !force) return cached
  const cs = getComputedStyle(document.documentElement)
  const v = (n: string) => cs.getPropertyValue(n).trim()
  cached = {
    pitch: v('--pitch'),
    line: v('--pitch-line'),
    hex: v('--pitch-hex'),
    home: v('--team-home'),
    away: v('--team-away'),
    highlight: v('--highlight'),
    fg: v('--fg-1'),
    canvas: v('--canvas'),
    onHome: v('--on-team-home'),
    onAway: v('--on-team-away'),
    heat: [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => v(`--heat-${i}`)),
  }
  return cached
}

function hexToRgb(h: string): [number, number, number] {
  const s = h.replace('#', '')
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)]
}

/** 64-step lookup table over the heat gradient. */
export function heatLUT(stops: string[]): string[] {
  const rgb = stops.map(hexToRgb)
  const out: string[] = []
  for (let i = 0; i < 64; i++) {
    const x = (i / 63) * (rgb.length - 1)
    const k = Math.min(rgb.length - 2, Math.floor(x))
    const f = x - k
    const c = rgb[k].map((a, j) => Math.round(a + (rgb[k + 1][j] - a) * f))
    out.push(`${c[0]},${c[1]},${c[2]}`)
  }
  return out
}
export const rgbOf = hexToRgb
