import { useMatch, LockedPanel } from '@/components/shell/MatchLayout'
import { ParityGate } from '@/components/parity/ParityGate'
import { t } from '@/i18n'

export function ParityPage() {
  const match = useMatch()
  const to = match.briefStatus === 'ready' ? `/matches/${match.id}/brief` : match.pack ? `/matches/${match.id}/replay` : `/matches`
  void LockedPanel
  return <ParityGate match={match} continueLabel={match.briefStatus === 'ready' ? t('gate.continue_brief') : t('gate.continue_library')} continueTo={to} />
}
