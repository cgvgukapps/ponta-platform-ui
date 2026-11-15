import { useSyncExternalStore } from 'react'
import { clamp } from '@/lib/prng'

/**
 * Playback clock. Lives outside React state so the canvas can redraw at 25 Hz or better
 * without re-rendering the page. React components subscribe to quantised slices of it.
 */
export class PlaybackStore {
  t = 0
  playing = false
  speed = 1
  private subs = new Set<() => void>()
  private raf = 0
  private last = 0
  constructor(
    readonly duration: number,
    readonly htAt: number,
  ) {}

  subscribe = (fn: () => void) => {
    this.subs.add(fn)
    return () => {
      this.subs.delete(fn)
    }
  }
  private emit() {
    this.subs.forEach((f) => f())
  }
  seek(t: number) {
    this.t = clamp(t, 0, this.duration)
    this.emit()
  }
  setSpeed(s: number) {
    this.speed = s
    this.emit()
  }
  play() {
    if (this.playing) return
    if (this.t >= this.duration - 0.1) this.t = 0
    this.playing = true
    this.last = performance.now()
    this.raf = requestAnimationFrame(this.loop)
    this.emit()
  }
  pause() {
    if (!this.playing) return
    this.playing = false
    cancelAnimationFrame(this.raf)
    this.emit()
  }
  toggle() {
    this.playing ? this.pause() : this.play()
  }
  private loop = (now: number) => {
    if (!this.playing) return
    const dt = Math.min(0.1, (now - this.last) / 1000)
    this.last = now
    // The half-time interval is skipped quickly: nothing happens on the pitch.
    const inBreak = this.t > this.htAt - 7 && this.t < this.htAt + 3.5
    this.t += dt * this.speed * (inBreak ? 8 : 1)
    if (this.t >= this.duration) {
      this.t = this.duration
      this.playing = false
    }
    this.emit()
    if (this.playing) this.raf = requestAnimationFrame(this.loop)
  }
  destroy() {
    cancelAnimationFrame(this.raf)
    this.playing = false
    this.subs.clear()
  }
}

/** Current time, quantised to `step` seconds so components re-render only when it changes. */
export function useClock(store: PlaybackStore, step: number): number {
  return useSyncExternalStore(
    store.subscribe,
    () => Math.floor(store.t / step) * step,
    () => 0,
  )
}
export function usePlaying(store: PlaybackStore): boolean {
  return useSyncExternalStore(store.subscribe, () => store.playing, () => false)
}
export function useSpeed(store: PlaybackStore): number {
  return useSyncExternalStore(store.subscribe, () => store.speed, () => 1)
}
