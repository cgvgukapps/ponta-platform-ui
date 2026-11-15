import { t } from '@/i18n'
import type { Overlays } from './PitchCanvas'
import { TeamDot } from '@/components/ui/badges'

function Item({ swatch, label, hint, off }: { swatch: React.ReactNode; label: string; hint: string; off?: boolean }) {
  return (
    <li className={off ? 'flex items-start gap-2 opacity-35' : 'flex items-start gap-2'} aria-hidden={off || undefined}>
      <span className="mt-0.5 flex h-4 w-8 shrink-0 items-center justify-center">{swatch}</span>
      <span className="min-w-0 text-xs leading-4">
        <span className="font-medium text-fg-1">{label}</span> <span className="text-fg-3">{hint}</span>
      </span>
    </li>
  )
}

/** Every legend slot is always present (dimmed when its overlay is off), so the pitch never jumps. */
export function Legend({ overlays, eventOnly }: { overlays: Overlays; eventOnly: boolean }) {
  return (
    <ul className="grid grid-cols-2 gap-x-6 gap-y-1.5" aria-label={t('legend.title')}>
      <Item
        swatch={
          <span className="flex items-center gap-1">
            <TeamDot team="h" size={9} />
            <TeamDot team="a" size={9} />
          </span>
        }
        label={t('legend.teams')}
        hint={t('legend.teams_hint')}
      />
      <Item
        swatch={<span className={eventOnly ? 'size-2.5 rounded-full border border-dashed border-fg-1' : 'size-2.5 rounded-full bg-fg-1'} />}
        label={t('legend.ball')}
        hint={eventOnly ? t('legend.ball_interp') : t('legend.ball_hint')}
      />
      {!eventOnly ? (
        <Item
          off={!overlays.control}
          swatch={
            <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden>
              <polygon points="7,1 12,1 15,7 12,13 7,13 4,7" fill="var(--team-home)" opacity="0.7" />
              <polygon points="18,1 23,1 26,7 23,13 18,13 15,7" fill="var(--team-away)" opacity="0.7" />
            </svg>
          }
          label={t('legend.control')}
          hint={t('legend.control_hint')}
        />
      ) : null}
      {!eventOnly ? (
        <Item
          off={!overlays.value}
          swatch={<span className="h-2.5 w-7 rounded-[2px]" style={{ background: 'linear-gradient(90deg,var(--heat-0),var(--heat-2),var(--heat-4),var(--heat-6),var(--heat-8))' }} />}
          label={t('legend.value')}
          hint={t('legend.value_hint')}
        />
      ) : null}
      <Item
        off={!(overlays.corridors || overlays.carries)}
        swatch={
          <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden>
            <line x1="1" y1="5" x2="28" y2="5" stroke="var(--highlight)" strokeWidth="2.4" />
            <line x1="1" y1="11" x2="28" y2="11" stroke="var(--fg-1)" strokeWidth="1.4" strokeDasharray="5 3" />
          </svg>
        }
        label={t('legend.options')}
        hint={t('legend.options_hint')}
      />
      {!eventOnly ? (
        <Item
          off={!overlays.confidence}
          swatch={
            <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden>
              <polygon points="7,1 23,1 28,7 23,13 7,13 2,7" fill="var(--conf-ink)" fillOpacity="0.12" stroke="var(--conf-ink)" strokeWidth="1.2" strokeDasharray="2.4 2" />
            </svg>
          }
          label={t('legend.confidence')}
          hint={t('legend.confidence_hint')}
        />
      ) : null}
      <Item
        swatch={
          <svg width="30" height="14" viewBox="0 0 30 14" aria-hidden>
            <circle cx="9" cy="7" r="5" fill="none" stroke="var(--highlight)" strokeWidth="2" />
            <path d="M22 7 l4 -4 l4 4 l-4 4z" fill="none" stroke="var(--highlight)" strokeWidth="2" transform="translate(-3 0)" />
          </svg>
        }
        label={t('legend.selected')}
        hint={t('legend.selected_hint')}
      />
    </ul>
  )
}
