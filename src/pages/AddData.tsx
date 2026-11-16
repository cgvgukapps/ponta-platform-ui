import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Check, CheckCircle2, CircleDashed, FileText, Plug, TriangleAlert, Upload, X, Radio, Activity, ListChecks, ArrowLeft, ArrowRight, ArrowUpRight, FileWarning, Loader2 } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { PROCESSING_STAGES, type Match } from '@/lib/types'
import { getMatchSync } from '@/api'
import { PROVIDER_NAME } from '@/lib/providers'
import { Button, buttonStyles } from '@/components/ui/button'
import { InlineAlert, Skeleton, StageList } from '@/components/ui/feedback'
import { Tag, TierBadge } from '@/components/ui/badges'
import { ParityGate } from '@/components/parity/ParityGate'
import { useApp } from '@/state/app'

type SampleId = 'optical' | 'events' | 'gps' | 'mismatch'
interface Sample {
  id: SampleId
  matchId: string
  files: { name: string; size: string }[]
}
const SAMPLES: Sample[] = [
  { id: 'optical', matchId: 'm_0412', files: [{ name: 'Sample_Game_3_RawTrackingData_Home_Team.csv', size: '312 MB' }, { name: 'Sample_Game_3_RawTrackingData_Away_Team.csv', size: '311 MB' }, { name: 'Sample_Game_3_RawEventsData.csv', size: '1.2 MB' }] },
  { id: 'events', matchId: 'm_0405', files: [{ name: 'statsbomb_events_sample.json', size: '4.8 MB' }] },
  { id: 'gps', matchId: 'm_0402', files: [{ name: 'statsports_session_squad.csv', size: '86 MB' }] },
  { id: 'mismatch', matchId: 'm_0398', files: [{ name: 'Sample_Game_3_RawTrackingData_Home_Team.csv', size: '312 MB' }, { name: 'Sample_Game_1_RawEventsData.csv', size: '1.1 MB' }] },
]

const SAMPLE_ICON: Record<SampleId, React.ReactNode> = {
  optical: <Radio className="size-5" aria-hidden />,
  events: <ListChecks className="size-5" aria-hidden />,
  gps: <Activity className="size-5" aria-hidden />,
  mismatch: <FileWarning className="size-5" aria-hidden />,
}

const STEPS = ['source', 'preview', 'parity', 'process'] as const

/* ---------------- Shared wizard pieces ---------------- */

/** Four equal segments: a bar above each label, so progress reads at a glance and every step lines up with the grid. */
function Stepper({ step }: { step: number }) {
  return (
    // Pill stepper (reference 2): the current step expands to show its name; others are numbered dots.
    <ol className="inline-flex items-center gap-1.5 rounded-full bg-s1 p-1.5" aria-label={t('add.steps')}>
      {STEPS.map((s, i) => {
        const done = i < step
        const cur = i === step
        return (
          <li key={s} aria-current={cur ? 'step' : undefined} className={cn('flex h-10 items-center rounded-full transition-colors duration-[var(--dur-base)]', cur ? 'gap-2.5 bg-s3 pl-1.5 pr-4' : 'bg-s2')}>
            <span className={cn('flex size-7 shrink-0 items-center justify-center rounded-full text-sm tabular-nums', cur ? 'bg-primary-fill text-on-primary' : done ? 'text-fg-2' : 'text-fg-4', !cur && 'size-10')}>
              {done ? <Check className="size-4" aria-hidden /> : i + 1}
            </span>
            {cur ? <span className="text-sm font-medium text-fg-1">{t(`add.step_${s}`)}</span> : <span className="sr-only">{t(`add.step_${s}`)}</span>}
          </li>
        )
      })}
    </ol>
  )
}

/** Title block used by every step, so headings sit at the same size and position. */
function StepIntro({ title, body }: { title: string; body: string }) {
  return (
    <div className="mb-7 max-w-[640px]">
      <h2 className="font-serif text-[30px] font-normal leading-9 tracking-tight text-fg-1">{title}</h2>
      <p className="mt-1.5 text-base text-fg-3">{body}</p>
    </div>
  )
}

/** Small heading above a column or card. Fixed minimum height so neighbouring columns start on the same line. */
function SectionHead({ title, body }: { title: string; body?: string }) {
  return (
    <div className={cn('mb-3', body && 'min-h-[40px]')}>
      <h3 className="text-sm font-semibold text-fg-1">{title}</h3>
      {body ? <p className="mt-0.5 text-xs leading-4 text-fg-3">{body}</p> : null}
    </div>
  )
}

/** Navigation row. Pinned to the foot of the view so Back and Continue never move between steps. */
function WizardFooter({ children }: { children: React.ReactNode }) {
  return <div className="sticky bottom-0 z-10 -mx-8 mt-auto flex items-center justify-between gap-3 border-t border-hair bg-canvas/95 px-8 py-4 backdrop-blur">{children}</div>
}

const cardCls = 'overflow-hidden rounded-xl border border-hair bg-s1'

/* ---------------- Step 1: source ---------------- */

function ConnectRow({ icon, title, body }: { icon: React.ReactNode; title: string; body: string }) {
  return (
    <li aria-disabled="true" className="flex items-center gap-3 px-4 py-3.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-s2 text-fg-2">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-fg-1">{title}</p>
        <p className="mt-0.5 text-xs text-fg-3">{body}</p>
      </div>
      <Tag dashed className="shrink-0">
        {t('add.coming_soon')}
      </Tag>
    </li>
  )
}

function SourceStep({ onPick }: { onPick: (s: Sample) => void }) {
  const [over, setOver] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const sniff = (names: string[]): Sample => {
    const j = names.join(' ').toLowerCase()
    if (/statsports|gps|session/.test(j)) return SAMPLES[2]
    if (/statsbomb|events.*\.json|\.json/.test(j) && !/skillcorner/.test(j)) return SAMPLES[1]
    return SAMPLES[0]
  }
  return (
    <div className="flex-1 pb-10">
      <StepIntro title={t('add.source_title')} body={t('add.source_body')} />
      <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-8">
        <section aria-label={t('add.upload_title')}>
          <SectionHead title={t('add.upload_title')} body={t('add.upload_body')} />
          <div
            onDragOver={(e) => {
              e.preventDefault()
              setOver(true)
            }}
            onDragLeave={() => setOver(false)}
            onDrop={(e) => {
              e.preventDefault()
              setOver(false)
              const names = Array.from(e.dataTransfer.files).map((f) => f.name)
              onPick(sniff(names))
            }}
            className={cn('flex flex-col items-center justify-center rounded-xl border border-dashed px-8 py-12 text-center transition-colors duration-[var(--dur-base)]', over ? 'border-accent bg-accent-tint' : 'border-hair-dashed bg-s1')}
          >
            <span className="flex size-11 items-center justify-center rounded-full border border-hair-strong bg-s2 text-fg-2">
              <Upload className="size-5" aria-hidden />
            </span>
            <p className="mt-4 text-md font-medium text-fg-1">{t('add.drop_title')}</p>
            <p className="mt-1.5 max-w-[46ch] text-sm leading-5 text-fg-3">{t('add.drop_body')}</p>
            <input ref={input} type="file" multiple className="sr-only" aria-label={t('add.browse')} onChange={(e) => onPick(sniff(Array.from(e.target.files ?? []).map((f) => f.name)))} />
            <Button variant="secondary" className="mt-5" onClick={() => input.current?.click()}>
              {t('add.browse')}
            </Button>
            <p className="mt-5 max-w-[52ch] text-xs leading-4 text-fg-4">{t('add.native_note')}</p>
          </div>

          <div className="mt-8">
            <SectionHead title={t('add.samples_title')} body={t('add.samples_body')} />
            <ul className="grid grid-cols-2 gap-3">
              {SAMPLES.map((s) => (
                <li key={s.id}>
                  {/* Reference card: an icon tile on top, then a title and one line. */}
                  <button onClick={() => onPick(s)} className="group flex h-full w-full flex-col items-start rounded-xl border border-hair bg-s1 p-4 text-left transition-colors hover:border-hair-hover hover:bg-s2">
                    <span className="flex w-full items-start justify-between">
                      <span className="flex size-10 items-center justify-center rounded-[10px] bg-accent-tint text-accent">{SAMPLE_ICON[s.id]}</span>
                      <ArrowUpRight className="size-4 text-fg-4 transition-colors group-hover:text-fg-1" aria-hidden />
                    </span>
                    <span className="mt-4 block text-sm font-medium text-fg-1">{t(`add.sample_${s.id}`)}</span>
                    <span className="mt-1 block text-xs leading-4 text-fg-3">{t(`add.sample_${s.id}_body`)}</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <aside className="flex flex-col gap-6" aria-label={t('add.connect_title')}>
          <section>
            <SectionHead title={t('add.connect_title')} body={t('add.connect_body')} />
            <ul className={cn(cardCls, 'divide-y divide-hair')}>
              <ConnectRow icon={<Radio className="size-4" aria-hidden />} title={t('kind.optical')} body={t('add.cat_optical')} />
              <ConnectRow icon={<Activity className="size-4" aria-hidden />} title={t('kind.gps')} body={t('add.cat_gps')} />
              <ConnectRow icon={<ListChecks className="size-4" aria-hidden />} title={t('kind.events')} body={t('add.cat_events')} />
            </ul>
          </section>
          <section>
            <SectionHead title={t('add.formats_title')} />
            <div className={cardCls}>
              <ul className="divide-y divide-hair text-sm">
                {(['metrica', 'skillcorner', 'statsbomb', 'statsports'] as const).map((p) => (
                  <li key={p} className="flex items-center justify-between gap-3 px-4 py-2.5">
                    <span className="text-fg-1">{PROVIDER_NAME[p]}</span>
                    <span className="text-right text-xs text-fg-3">{t(`add.format_${p}`)}</span>
                  </li>
                ))}
              </ul>
              <div className="flex items-start justify-between gap-3 border-t border-hair bg-s2 px-4 py-3">
                <p className="text-xs leading-4 text-fg-3">
                  {t('add.also_soon')} <span className="text-fg-2">Catapult, Second Spectrum, Hawk-Eye, TRACAB</span>
                </p>
                <Tag dashed className="shrink-0">
                  {t('add.coming_soon')}
                </Tag>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </div>
  )
}

/* ---------------- Step 2: preview ---------------- */

function PreviewStep({ sample, match, onBack, onNext, onReplace, resolved }: { sample: Sample; match: Match; onBack: () => void; onNext: () => void; onReplace: () => void; resolved: boolean }) {
  const [scanned, setScanned] = useState(false)
  useEffect(() => {
    const id = setTimeout(() => setScanned(true), 1100)
    return () => clearTimeout(id)
  }, [])
  const mismatch = sample.id === 'mismatch' && !resolved
  const src = match.sources[0]
  const rows: [string, string, 'ok' | 'warn'][] = [
    [t('add.det_provider'), `${PROVIDER_NAME[src.provider]} (${t(`kind.${src.kind}`)})`, 'ok'],
    [t('add.det_format'), match.ingest.format, 'ok'],
    [t('add.det_rate'), match.ingest.hz ? `${match.ingest.hz} Hz` : t('gate.stat_events_only'), 'ok'],
    [t('add.det_duration'), `${match.ingest.durationMin} min`, 'ok'],
    [t('add.det_teams'), mismatch ? t('add.det_teams_mismatch') : `${match.home} v ${match.away}`, mismatch ? 'warn' : 'ok'],
    [t('add.det_players'), String(match.ingest.players), 'ok'],
    [t('add.det_dropped'), match.ingest.droppedPct !== null ? `${match.ingest.droppedPct}%` : t('common.not_applicable'), 'ok'],
    [t('add.det_occluded'), match.ingest.occludedPct !== null ? `${match.ingest.occludedPct}%` : t('common.not_applicable'), 'ok'],
  ]
  const warnings = rows.filter((r) => r[2] === 'warn').length
  return (
    <>
      <div className="flex-1 pb-10">
        <StepIntro title={t('add.preview_title')} body={t('add.preview_body')} />
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-8">
          <section aria-label={t('add.det_title')}>
            <div className={cardCls}>
              <div className="flex h-11 items-center justify-between gap-3 border-b border-hair px-4">
                <h3 className="text-sm font-semibold text-fg-1">{t('add.det_title')}</h3>
                {!scanned ? (
                  <span className="flex items-center gap-2 text-xs text-fg-3" role="status">
                    <Loader2 className="size-3.5 animate-spin-slow" aria-hidden />
                    {t('add.det_scanning')}
                  </span>
                ) : warnings ? (
                  <span className="flex items-center gap-1.5 text-xs text-warn">
                    <TriangleAlert className="size-3.5" aria-hidden />
                    {t('add.det_attention', { n: warnings })}
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs text-fg-3">
                    <Check className="size-3.5" aria-hidden />
                    {t('add.det_passed', { n: rows.length, total: rows.length })}
                  </span>
                )}
              </div>
              <table className="w-full text-sm">
                <caption className="sr-only">{t('add.det_title')}</caption>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className={cn('border-b border-hair last:border-0', scanned && 'anim-fade-up')} style={scanned ? { animationDelay: `${i * 30}ms` } : undefined}>
                      <th scope="row" className="w-[200px] px-4 py-3 text-left text-sm font-normal text-fg-3">{r[0]}</th>
                      <td className="py-3 pr-2">
                        {scanned ? <span className={cn('font-mono text-sm tabular-nums', r[2] === 'warn' ? 'text-warn' : 'text-fg-1')}>{r[1]}</span> : <Skeleton className="h-4 w-48" />}
                      </td>
                      <td className="w-10 py-3 pr-4 text-right">
                        {scanned ? r[2] === 'warn' ? <TriangleAlert className="ml-auto size-4 text-warn" aria-label={t('add.mismatch_title')} /> : <Check className="ml-auto size-4 text-fg-3" aria-hidden /> : null}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {scanned && mismatch ? (
              <InlineAlert className="mt-4" tone="warn" icon={<TriangleAlert className="size-4" />} title={t('add.mismatch_title')}>
                <p>{t('add.mismatch_body')}</p>
                <div className="mt-3 flex gap-2">
                  <Button size="sm" onClick={onReplace}>{t('add.mismatch_replace')}</Button>
                  <Button size="sm" variant="ghost" onClick={onBack}>{t('add.mismatch_back')}</Button>
                </div>
              </InlineAlert>
            ) : null}
          </section>

          <section aria-label={t('add.files')}>
            <div className={cardCls}>
              <div className="flex h-11 items-center justify-between gap-3 border-b border-hair px-4">
                <h3 className="text-sm font-semibold text-fg-1">{t('add.files')}</h3>
                <span className="font-mono text-xs tabular-nums text-fg-3">{sample.files.length}</span>
              </div>
              <ul className="divide-y divide-hair">
                {sample.files.map((f, i) => {
                  const name = resolved && sample.id === 'mismatch' && i === 1 ? f.name.replace('Game_1', 'Game_3') : f.name
                  return (
                    <li key={f.name} className="flex items-start gap-3 px-4 py-3">
                      <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg border border-transparent bg-s2 text-fg-3">
                        <FileText className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="break-all font-mono text-xs leading-4 text-fg-1">{name}</p>
                        <p className="mt-0.5 font-mono text-2xs text-fg-4">{f.size}</p>
                      </div>
                      <span className="mt-1 shrink-0">
                        {scanned ? (
                          mismatch && i === 1 ? <TriangleAlert className="size-4 text-warn" aria-label={t('add.mismatch_title')} /> : <CheckCircle2 className="size-4 text-fg-3" aria-hidden />
                        ) : (
                          <CircleDashed className="size-4 animate-spin-slow text-fg-4" aria-hidden />
                        )}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </div>
          </section>
        </div>
      </div>
      <WizardFooter>
        <Button variant="ghost" onClick={onBack}>
          <ArrowLeft className="size-3.5" aria-hidden />
          {t('common.back')}
        </Button>
        <Button variant="primary" size="lg" disabled={!scanned || mismatch} onClick={onNext}>
          {t('add.to_parity')}
          <ArrowRight className="size-4" aria-hidden />
        </Button>
      </WizardFooter>
    </>
  )
}

/* ---------------- Step 4: confirm and process ---------------- */

function ProcessStep({ match, onBack }: { match: Match; onBack: () => void }) {
  const [phase, setPhase] = useState<'confirm' | 'running' | 'done'>('confirm')
  const [stage, setStage] = useState(0)
  const [prog, setProg] = useState(0)
  const nav = useNavigate()
  const { toast } = useApp()
  const reduced = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  useEffect(() => {
    if (phase !== 'running') return
    const tick = reduced ? 120 : 90
    const id = setInterval(() => {
      setProg((p) => {
        if (p >= 1) {
          setStage((s) => {
            if (s >= PROCESSING_STAGES.length - 1) {
              setPhase('done')
              return s
            }
            return s + 1
          })
          return 0
        }
        return p + 0.1
      })
    }, tick)
    return () => clearInterval(id)
  }, [phase, reduced])
  const stages = PROCESSING_STAGES.map((s) => t(`stage.${s}`))
  const dest = match.briefStatus === 'ready' ? `/matches/${match.id}/brief` : `/matches/${match.id}/parity`
  const intro = phase === 'confirm' ? ['add.confirm_title', 'add.confirm_body'] : phase === 'running' ? ['add.running_title', 'add.running_body'] : ['add.done_title', 'add.done_body']
  const rows: [string, React.ReactNode][] = [
    [t('add.confirm_match'), `${match.home} v ${match.away}`],
    [t('add.confirm_source'), match.sources.map((s) => `${PROVIDER_NAME[s.provider]} (${t(`kind.${s.kind}`)})`).join(', ')],
    [t('add.confirm_tier'), <TierBadge key="t" tier={match.tier} status={match.tierStatus} />],
    [t('add.confirm_outputs'), t(match.pack === 'events' ? 'add.out_events' : match.pack === 'gps' ? 'add.out_gps' : 'add.out_optical')],
  ]
  return (
    <>
      <div className="flex-1 pb-10">
        <StepIntro title={t(intro[0])} body={t(intro[1])} />
        <div className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-8">
          <section aria-label={t('add.summary_title')}>
            <div className={cardCls}>
              <div className="flex h-11 items-center border-b border-hair px-4">
                <h3 className="text-sm font-semibold text-fg-1">{t('add.summary_title')}</h3>
              </div>
              <dl className="divide-y divide-hair text-sm">
                {rows.map(([k, v], i) => (
                  <div key={i} className="grid grid-cols-[200px_minmax(0,1fr)] items-start gap-4 px-4 py-3">
                    <dt className="text-fg-3">{k}</dt>
                    <dd className="text-fg-1">{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {phase === 'confirm' ? <p className="mt-4 text-xs text-fg-4">{t('add.proto_note')}</p> : null}
          </section>

          <section aria-label={t('add.stages_title')}>
            <div className={cardCls}>
              <div className="flex h-11 items-center justify-between border-b border-hair px-4">
                <h3 className="text-sm font-semibold text-fg-1">{t('add.stages_title')}</h3>
                {phase === 'done' ? (
                  <span className="flex items-center gap-1.5 text-xs text-fg-3">
                    <Check className="size-3.5" aria-hidden />
                    {t('add.stages_done')}
                  </span>
                ) : phase === 'running' ? (
                  <span className="font-mono text-xs tabular-nums text-fg-3">{Math.min(stage + 1, stages.length)} / {stages.length}</span>
                ) : null}
              </div>
              <div className="px-4 py-4">
                <StageList stages={stages} current={phase === 'done' ? stages.length : phase === 'confirm' ? -1 : stage} progress={prog} />
              </div>
            </div>
          </section>
        </div>
      </div>
      <WizardFooter>
        {phase === 'done' ? (
          <>
            <Link to="/matches" className={buttonStyles({ variant: 'ghost' })}>{t('add.to_library')}</Link>
            <Button variant="primary" size="lg" onClick={() => { toast({ title: t('add.toast_ready'), body: t('add.toast_ready_body') }); nav(dest) }}>
              {t('add.open_brief')}
              <ArrowRight className="size-4" aria-hidden />
            </Button>
          </>
        ) : (
          <>
            <Button variant="ghost" onClick={onBack} disabled={phase === 'running'}>
              <ArrowLeft className="size-3.5" aria-hidden />
              {t('common.back')}
            </Button>
            <Button variant="primary" size="lg" loading={phase === 'running'} disabled={phase === 'running'} onClick={() => setPhase('running')}>
              {t('add.process')}
            </Button>
          </>
        )}
      </WizardFooter>
    </>
  )
}

/* ---------------- Page ---------------- */

export function AddData() {
  const [step, setStep] = useState(0)
  const [sample, setSample] = useState<Sample | null>(null)
  const [resolved, setResolved] = useState(false)
  const [params] = useSearchParams()
  const forMatch = params.get('match')
  const match = sample ? getMatchSync(sample.matchId)! : null
  const parityMatch = sample && match ? (sample.id === 'mismatch' ? getMatchSync('m_0412')! : match) : null
  const forMatchRow = forMatch ? getMatchSync(forMatch) : null
  return (
    <div className="mx-auto flex min-h-full max-w-[1160px] flex-col px-8 pt-6">
      <header className="flex items-center justify-between gap-4">
        <nav aria-label={t('add.breadcrumb')} className="flex items-center gap-2 text-sm">
          <Link to="/matches" className="text-fg-3 hover:text-fg-1">
            {t('lib.title')}
          </Link>
          <span aria-hidden className="text-fg-4">/</span>
          <h1 className="font-medium text-fg-1">{t('add.title')}</h1>
        </nav>
        <Link to="/matches" aria-label={t('common.cancel')} className="rounded-md p-1.5 text-fg-3 hover:bg-s2 hover:text-fg-1">
          <X className="size-4" aria-hidden />
        </Link>
      </header>
      <div className="mt-5">
        <Stepper step={step} />
      </div>
      {forMatch ? (
        <InlineAlert className="mt-5" icon={<Plug className="size-4" />}>
          {t('add.for_match', { match: forMatchRow ? `${forMatchRow.home} v ${forMatchRow.away}` : forMatch })}
        </InlineAlert>
      ) : null}
      <div className="mt-8 flex flex-1 flex-col">
        {step === 0 && (
          <SourceStep
            onPick={(s) => {
              setSample(s)
              setResolved(false)
              setStep(1)
            }}
          />
        )}
        {step === 1 && sample && match ? <PreviewStep sample={sample} match={match} resolved={resolved} onBack={() => setStep(0)} onReplace={() => setResolved(true)} onNext={() => setStep(2)} /> : null}
        {step === 2 && parityMatch ? (
          <ParityGate embedded match={parityMatch} continueLabel={t('add.to_process')} onContinue={() => setStep(3)} hideStats footerExtra={<Button variant="ghost" onClick={() => setStep(1)}><ArrowLeft className="size-3.5" aria-hidden />{t('common.back')}</Button>} />
        ) : null}
        {step === 3 && parityMatch ? <ProcessStep match={parityMatch} onBack={() => setStep(2)} /> : null}
      </div>
    </div>
  )
}
