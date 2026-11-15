import { lazy, Suspense } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AppShell } from '@/components/shell/AppShell'
import { MatchLayout } from '@/components/shell/MatchLayout'
import { useApp } from '@/state/app'
import { SignIn } from '@/pages/SignIn'
import { Library } from '@/pages/Library'
import { AddData } from '@/pages/AddData'
import { ParityPage } from '@/pages/Parity'
import { BriefPage } from '@/pages/Brief'
import { AskPage } from '@/pages/Ask'
import { SettingsPage } from '@/pages/Settings'
import { MatchIndex } from '@/pages/MatchIndex'
import { NotFound } from '@/pages/NotFound'
import { Skeleton } from '@/components/ui/feedback'

const ReplayPage = lazy(() => import('@/pages/Replay').then((m) => ({ default: m.ReplayPage })))
const BriefPrint = lazy(() => import('@/pages/BriefPrint').then((m) => ({ default: m.BriefPrint })))
const PlayerProfile = lazy(() => import('@/pages/PlayerProfile').then((m) => ({ default: m.PlayerProfile })))
const SystemSheet = lazy(() => import('@/pages/SystemSheet').then((m) => ({ default: m.SystemSheet })))

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { signedIn } = useApp()
  const loc = useLocation()
  if (!signedIn) return <Navigate to="/sign-in" replace state={{ from: loc.pathname + loc.search }} />
  return <>{children}</>
}

const Fallback = () => (
  <div className="p-6">
    <Skeleton className="mb-3 h-6 w-64" />
    <Skeleton className="h-96 w-full" />
  </div>
)

export function App() {
  return (
    <Suspense fallback={<Fallback />}>
      <Routes>
        <Route path="/sign-in" element={<SignIn />} />
        <Route
          path="/matches/:id/brief/print"
          element={
            <RequireAuth>
              <BriefPrint />
            </RequireAuth>
          }
        />
        <Route
          element={
            <RequireAuth>
              <AppShell />
            </RequireAuth>
          }
        >
          <Route index element={<Navigate to="/matches" replace />} />
          <Route path="/matches" element={<Library />} />
          <Route path="/matches/new" element={<AddData />} />
          <Route path="/matches/:id" element={<MatchLayout />}>
            <Route index element={<MatchIndex />} />
            <Route path="parity" element={<ParityPage />} />
            <Route path="brief" element={<BriefPage />} />
            <Route path="replay" element={<ReplayPage />} />
          </Route>
          <Route path="/ask" element={<AskPage />} />
          <Route path="/ask/:threadId" element={<AskPage />} />
          <Route path="/settings" element={<Navigate to="/settings/organisation" replace />} />
          <Route path="/settings/:tab" element={<SettingsPage />} />
          <Route path="/players/:id" element={<PlayerProfile />} />
          <Route path="/system" element={<SystemSheet />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
