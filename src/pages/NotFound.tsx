import { Link } from 'react-router-dom'
import { Compass } from 'lucide-react'
import { EmptyState } from '@/components/ui/feedback'
import { buttonStyles } from '@/components/ui/button'
import { t } from '@/i18n'

export function NotFound() {
  return (
    <EmptyState
      icon={<Compass className="size-5" aria-hidden />}
      title={t('notfound.title')}
      body={t('notfound.body')}
      actions={
        <Link to="/matches" className={buttonStyles({ variant: 'secondary' })}>
          {t('notfound.back')}
        </Link>
      }
    />
  )
}
