import { Navigate } from 'react-router-dom'
import { useMatch } from '@/components/shell/MatchLayout'

export function MatchIndex() {
  const m = useMatch()
  return <Navigate to={m.briefStatus === 'ready' ? 'brief' : 'parity'} replace />
}
