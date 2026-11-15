import { PITCH_L, PITCH_W } from './engine'

const circle = (x: number, y: number, r: number) => `M${x + r} ${y} a${r} ${r} 0 1 0 ${-2 * r} 0 a${r} ${r} 0 1 0 ${2 * r} 0`

/** Pitch line work in metres (105 x 68). One source for the canvas and the SVG thumbnails. */
export const PITCH_PATHS: string[] = [
  `M0 0H${PITCH_L}V${PITCH_W}H0Z`,
  `M${PITCH_L / 2} 0V${PITCH_W}`,
  circle(PITCH_L / 2, PITCH_W / 2, 9.15),
  `M0 13.84H16.5V54.16H0`,
  `M${PITCH_L} 13.84H${PITCH_L - 16.5}V54.16H${PITCH_L}`,
  `M0 24.84H5.5V43.16H0`,
  `M${PITCH_L} 24.84H${PITCH_L - 5.5}V43.16H${PITCH_L}`,
  `M16.5 26.68A9.15 9.15 0 0 1 16.5 41.32`,
  `M${PITCH_L - 16.5} 41.32A9.15 9.15 0 0 1 ${PITCH_L - 16.5} 26.68`,
  `M0 30.34H-2V37.66H0`,
  `M${PITCH_L} 30.34H${PITCH_L + 2}V37.66H${PITCH_L}`,
]
export const PITCH_SPOTS: [number, number][] = [
  [PITCH_L / 2, PITCH_W / 2],
  [11, 34],
  [PITCH_L - 11, 34],
]

/* ---- Hexagonal analysis grid (flat-top). Overlays are computed per hexagon. ---- */
export const HEX_R = 2.6
const colStep = 1.5 * HEX_R
const rowStep = Math.sqrt(3) * HEX_R
const centres: [number, number][] = []
for (let c = 0; c * colStep <= PITCH_L + HEX_R; c++) {
  for (let r = -1; r * rowStep <= PITCH_W + HEX_R; r++) {
    const x = c * colStep
    const y = r * rowStep + (c % 2 ? rowStep / 2 : 0)
    if (y > -HEX_R * 0.5 && y < PITCH_W + HEX_R * 0.5) centres.push([x, y])
  }
}
export const HEX_CENTRES = centres
export const HEX_COUNT = centres.length
export const HEX_CORNERS: [number, number][] = [0, 1, 2, 3, 4, 5].map((i) => {
  const a = (Math.PI / 3) * i
  return [Math.cos(a) * HEX_R, Math.sin(a) * HEX_R]
})
