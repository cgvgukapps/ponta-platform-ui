/** The prototype's fixed "now", so relative dates are stable in screenshots. */
export const NOW = new Date('2026-11-15T14:41:00Z')

export function fmtClock(t: number): string {
  const s = Math.max(0, Math.floor(t))
  const m = Math.floor(s / 60)
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}
export function fmtClockFine(t: number): string {
  const c = Math.max(0, t)
  const s = Math.floor(c)
  const f = Math.floor((c - s) * 100)
  return `${fmtClock(s)}.${String(f).padStart(2, '0')}`
}
const dateFmt = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
const dateShort = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const timeFmt = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: 'UTC' })
export const fmtDate = (iso: string) => dateFmt.format(new Date(iso))
export const fmtDateShort = (iso: string) => dateShort.format(new Date(iso))
export const fmtTime = (iso: string) => timeFmt.format(new Date(iso))
export const fmtDateTime = (iso: string) => `${fmtDate(iso)}, ${fmtTime(iso)}`

export function fmtRelative(iso: string | null): string {
  if (!iso) return 'Never'
  const diff = NOW.getTime() - new Date(iso).getTime()
  const min = Math.round(diff / 60000)
  if (min < 1) return 'Just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  const d = Math.round(h / 24)
  if (d < 14) return `${d} d ago`
  return fmtDateShort(iso)
}
export const fmt2 = (n: number) => n.toFixed(2)
export const fmt1 = (n: number) => n.toFixed(1)

/** Share as a percentage with one decimal, for example 94.9%. */
export const fmtShare = (part: number, whole: number) => `${((part / whole) * 100).toFixed(1)}%`
