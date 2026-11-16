import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { Team } from './types'
import { playerLabel } from './events'
import { getRosterSync } from '@/api'
import { useApp } from '@/state/app'

/**
 * Client-side names (brief v2, 5.1). Everything the AI layer and the mock text carry uses codes:
 * `home_5` in data, `{home_5}` as a token in brief text. The client swaps a code for the club's name
 * when names are on and the roster has that player; otherwise the code label ("Home 5") stays.
 * Pitch markers always keep shirt numbers.
 */
export type Who = (team: Team, num: number) => string

const WhoCtx = createContext<Who>(playerLabel)

export function makeWho(match: { home: string; away: string } | null | undefined, mode: 'names' | 'codes'): Who {
  if (!match || mode === 'codes') return playerLabel
  const home = getRosterSync(match.home)
  const away = getRosterSync(match.away)
  return (team, num) => (team === 'h' ? home : away)?.[num] ?? playerLabel(team, num)
}

export function WhoProvider({ match, children }: { match: { home: string; away: string } | null | undefined; children: ReactNode }) {
  const { nameMode } = useApp()
  const who = useMemo(() => makeWho(match, nameMode), [match, nameMode])
  return <WhoCtx.Provider value={who}>{children}</WhoCtx.Provider>
}

/** The resolver for the match in view. Outside a match it returns codes. */
export const useWho = () => useContext(WhoCtx)

const TOKEN = /\{(home|away)_(\d+)\}/g

/** Replace reference tokens in generated text with names or codes. */
export function fillRefs(text: string, who: Who): string {
  return text.replace(TOKEN, (_, side: string, n: string) => who(side === 'home' ? 'h' : 'a', Number(n)))
}

/** A name in a tight cell: truncates with the full name on hover, never pushes a numeric column. */
export function PlayerName({ team, num, className }: { team: Team; num: number; className?: string }) {
  const who = useWho()
  const name = who(team, num)
  return (
    <span className={['block min-w-0 truncate', className].filter(Boolean).join(' ')} title={name}>
      {name}
    </span>
  )
}

/**
 * The reverse of `fillRefs`: before a question leaves the client, names from the roster and code
 * labels ("Home 5") become tokens, so whatever the AI layer receives stays pseudonymised.
 */
export function toRefs(text: string, match: { home: string; away: string } | null | undefined): string {
  let out = text
  if (match) {
    const pairs: [string, string][] = []
    for (const [side, team] of [['home', match.home], ['away', match.away]] as const) {
      const r = getRosterSync(team)
      if (r) for (const [num, name] of Object.entries(r)) pairs.push([name, `{${side}_${num}}`])
    }
    // Longest names first, so "Callum Brightwater-Lee" is not caught by "Callum Brightwater".
    pairs.sort((a, b) => b[0].length - a[0].length)
    for (const [name, tok] of pairs) out = out.split(name).join(tok)
  }
  return out.replace(/\b(Home|Away) (\d{1,2})\b/g, (_, side: string, n: string) => `{${side.toLowerCase()}_${n}}`)
}
