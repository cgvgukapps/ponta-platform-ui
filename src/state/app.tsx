import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

type SquadId = 'all' | 'first' | 'u21' | 'u18'
export interface Toast {
  id: number
  title: string
  body?: string
  tone?: 'neutral' | 'error'
}
interface AppState {
  orgId: string
  setOrgId: (id: string) => void
  squad: SquadId
  setSquad: (s: SquadId) => void
  railPref: boolean | null // null = automatic (collapsed on Replay)
  setRailPref: (v: boolean | null) => void
  signedIn: boolean
  signIn: () => void
  signOut: () => void
  toasts: Toast[]
  toast: (t: Omit<Toast, 'id'>) => void
  dismissToast: (id: number) => void
}
const Ctx = createContext<AppState | null>(null)

let tid = 1
export function AppProvider({ children }: { children: ReactNode }) {
  const [orgId, setOrgId] = useState('org_harlow')
  const [squad, setSquad] = useState<SquadId>('all')
  const [railPref, setRailPref] = useState<boolean | null>(null)
  const [signedIn, setSignedIn] = useState(() => sessionStorage.getItem('ponta.signedIn') === '1')
  const [toasts, setToasts] = useState<Toast[]>([])
  const dismissToast = useCallback((id: number) => setToasts((l) => l.filter((x) => x.id !== id)), [])
  const toast = useCallback(
    (t: Omit<Toast, 'id'>) => {
      const id = tid++
      setToasts((l) => [...l.slice(-2), { ...t, id }])
      setTimeout(() => dismissToast(id), 5000)
    },
    [dismissToast],
  )
  const value = useMemo<AppState>(
    () => ({
      orgId,
      setOrgId: (id) => {
        setOrgId(id)
        setSquad('all')
      },
      squad,
      setSquad,
      railPref,
      setRailPref,
      signedIn,
      signIn: () => {
        sessionStorage.setItem('ponta.signedIn', '1')
        setSignedIn(true)
      },
      signOut: () => {
        sessionStorage.removeItem('ponta.signedIn')
        setSignedIn(false)
      },
      toasts,
      toast,
      dismissToast,
    }),
    [orgId, squad, railPref, signedIn, toasts, toast, dismissToast],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}
export function useApp() {
  const v = useContext(Ctx)
  if (!v) throw new Error('AppProvider missing')
  return v
}
