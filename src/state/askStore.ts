import { useSyncExternalStore } from 'react'
import { askPonta, type AskAnswer, type AskContext } from '@/api/ask'
import { listThreads } from '@/api'

export type Phase = 'reading' | 'finding' | 'streaming' | 'verifying' | 'done'
export interface Turn {
  id: string
  question: string
  matchId: string
  phase: Phase
  answer?: AskAnswer
  /** Words of the summary revealed so far (streaming). */
  words: number
  /** Citations verified so far. */
  verified: number
  /** What the question was asked about (a brief point's citations, a selected moment). */
  context?: AskContext
}
export interface Thread {
  id: string
  title: string
  matchId: string
  updatedAt: string
  turns: Turn[]
  loaded: boolean
}

const threads = new Map<string, Thread>()
let order: string[] = []
let version = 0
let seeded: Promise<void> | null = null
const subs = new Set<() => void>()
const emit = () => {
  version++
  subs.forEach((f) => f())
}
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))
const reduced = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches
let n = 0

export function seedThreads() {
  seeded ??= listThreads().then((list) => {
    for (const th of list) {
      threads.set(th.id, { id: th.id, title: th.title, matchId: th.matchId, updatedAt: th.updatedAt, loaded: false, turns: th.questions.map((q, i) => ({ id: `${th.id}_${i}`, question: q, matchId: th.matchId, phase: 'done', words: Infinity, verified: 0 })) })
    }
    order = [...order, ...list.map((l) => l.id)]
    emit()
  })
  return seeded
}

async function run(turn: Turn, animate: boolean) {
  const quick = !animate || reduced()
  if (animate) {
    turn.phase = 'reading'
    emit()
    await sleep(quick ? 150 : 520)
  }
  turn.phase = 'finding'
  emit()
  const ans = await askPonta(turn.matchId, turn.question, turn.context)
  turn.answer = ans
  if (!animate) {
    turn.phase = 'done'
    turn.words = Infinity
    turn.verified = ans.playlist.length
    emit()
    return
  }
  if (ans.kind === 'refusal') {
    await sleep(quick ? 0 : 350)
    turn.phase = 'done'
    emit()
    return
  }
  turn.phase = 'streaming'
  turn.words = 0
  const total = ans.summary.split(/\s+/).length
  emit()
  if (quick) turn.words = total
  else
    while (turn.words < total) {
      await sleep(24)
      turn.words += 1
      emit()
    }
  if (ans.playlist.length) {
    turn.phase = 'verifying'
    turn.verified = 0
    emit()
    for (let v = 1; v <= ans.playlist.length; v++) {
      await sleep(quick ? 0 : 280)
      turn.verified = v
      emit()
    }
    await sleep(quick ? 0 : 260)
  }
  turn.phase = 'done'
  emit()
}

/** Loads stored answers for a seeded thread without streaming animation. */
export function ensureLoaded(id: string) {
  const th = threads.get(id)
  if (!th || th.loaded) return
  th.loaded = true
  for (const turn of th.turns) {
    turn.phase = 'finding'
    void run(turn, false)
  }
  emit()
}

export function ask(threadId: string | null, matchId: string, question: string, context?: AskContext): string {
  let th = threadId ? threads.get(threadId) : undefined
  if (!th) {
    th = { id: `th_new_${++n}`, title: question.length > 52 ? question.slice(0, 50).trimEnd() + '…' : question, matchId, updatedAt: new Date('2026-11-15T14:41:00Z').toISOString(), turns: [], loaded: true }
    threads.set(th.id, th)
    order = [th.id, ...order]
  }
  const turn: Turn = { id: `${th.id}_t${th.turns.length}`, question, matchId, phase: 'reading', words: 0, verified: 0, context }
  th.turns.push(turn)
  th.matchId = matchId
  emit()
  void run(turn, true)
  return th.id
}

export function useAskStore() {
  useSyncExternalStore(
    (f) => {
      subs.add(f)
      return () => subs.delete(f)
    },
    () => version,
    () => 0,
  )
  return { threads: order.map((id) => threads.get(id)!).filter(Boolean), get: (id: string) => threads.get(id) }
}
