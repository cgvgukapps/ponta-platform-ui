import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, Printer } from 'lucide-react'
import { t } from '@/i18n'
import { useAsync } from '@/lib/useAsync'
import { getBrief, getMatch } from '@/api'
import { loadPack } from '@/api/packs'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/feedback'
import { BriefBody, BriefHeader, BriefLimitations } from '@/components/brief/BriefContent'
import { DqBand, EstimateBand } from '@/components/ui/badges'
import { fmtClock } from '@/lib/format'
import { describeEvent, eventTypeLabel } from '@/lib/events'

/** The only light-themed surface in the product: a clean A4 page for printing and PDF export. */
export function BriefPrint() {
  const { id = '' } = useParams()
  const match = useAsync(() => getMatch(id), [id])
  const brief = useAsync(() => getBrief(id), [id])
  const pack = useAsync(() => loadPack(id), [id])
  const ready = match.data && brief.data && pack.data
  const refs: string[] = []
  if (brief.data) for (const th of brief.data.themes) for (const b of th.bullets) for (const c of b.citations) if (!refs.includes(c)) refs.push(c)
  return (
    <div data-theme="print" className="min-h-full bg-desk py-6 print:bg-white print:py-0" style={{ color: 'var(--fg-1)' }}>
      <div className="no-print mx-auto mb-4 flex w-[794px] items-center justify-between">
        <Link to={`/matches/${id}/brief`} className="inline-flex items-center gap-1.5 text-sm text-fg-2 hover:underline">
          <ArrowLeft className="size-3.5" aria-hidden />
          {t('print.back')}
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-fg-3">{t('print.note')}</span>
          <Button variant="primary" onClick={() => window.print()}>
            <Printer className="size-3.5" aria-hidden />
            {t('print.print')}
          </Button>
        </div>
      </div>
      <div className="print-page mx-auto w-[794px] bg-canvas px-[56px] py-[52px] shadow-[0_0_0_1px_var(--hairline)]">
        {!ready ? (
          <>
            <Skeleton className="h-6 w-48" />
            <Skeleton className="mt-4 h-96 w-full" />
          </>
        ) : (
          <>
            <div className="mb-6 flex items-center justify-between border-b border-hair pb-4">
              <img src="/brand/ponta-logo-black.png" alt="Ponta" className="h-5 w-auto" onError={(e) => ((e.currentTarget.style.display = 'none'), undefined)} />
              <span className="font-mono text-2xs uppercase tracking-wider text-fg-4">{t('print.sample')}</span>
            </div>
            <BriefHeader match={match.data!} brief={brief.data!} lp={pack.data!} variant="print" />
            <div className="mt-6">
              <BriefBody brief={brief.data!} lp={pack.data!} matchId={id} variant="print" />
            </div>
            <div className="mt-7">
              <BriefLimitations brief={brief.data!} />
            </div>
            <section className="avoid-break mt-7 border-t border-hair pt-5" aria-labelledby="cited">
              <h2 id="cited" className="font-mono text-xs font-medium uppercase tracking-wider text-fg-3">
                {t('print.cited')}
              </h2>
              <table className="mt-2 w-full border-collapse text-xs">
                <thead>
                  <tr className="border-b border-hair-strong text-left font-mono text-2xs uppercase tracking-wider text-fg-3">
                    <th className="py-1.5 pr-2 font-medium">{t('print.col_ref')}</th>
                    <th className="py-1.5 pr-2 font-medium">{t('print.col_event')}</th>
                    <th className="py-1.5 pr-2 font-medium">{t('print.col_time')}</th>
                    <th className="py-1.5 pr-2 font-medium">{t('print.col_what')}</th>
                    <th className="py-1.5 pr-2 font-medium">{t('print.col_dq')}</th>
                    <th className="py-1.5 text-right font-medium">{t('print.col_conf')}</th>
                  </tr>
                </thead>
                <tbody className="tabular-nums">
                  {refs.map((rid, i) => {
                    const e = pack.data!.byId.get(rid)
                    if (!e) return null
                    return (
                      <tr key={rid} className="border-b border-hair">
                        <td className="py-1.5 pr-2 font-mono">[{i + 1}]</td>
                        <td className="py-1.5 pr-2 font-mono">{e.id}</td>
                        <td className="py-1.5 pr-2 font-mono">{fmtClock(e.t)}</td>
                        <td className="py-1.5 pr-2">{eventTypeLabel(e)}, {describeEvent(e)}</td>
                        <td className="py-1.5 pr-2">{e.band ? <DqBand band={e.band} size="sm" /> : e.est ? <EstimateBand lo={e.est.lo} hi={e.est.hi} size="sm" /> : <span className="text-fg-4">{t('common.not_applicable')}</span>}</td>
                        <td className="py-1.5 text-right font-mono">{e.conf.toFixed(2)}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </section>
            <p className="mt-6 border-t border-hair pt-3 text-2xs text-fg-4">{t('print.footer')}</p>
          </>
        )}
      </div>
    </div>
  )
}
