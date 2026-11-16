import { useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { FlaskConical, KeyRound } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Field, Input } from '@/components/ui/form'
import { t } from '@/i18n'
import { useApp } from '@/state/app'

export function SignIn() {
  const { signIn } = useApp()
  const nav = useNavigate()
  const loc = useLocation() as { state?: { from?: string } }
  const [email, setEmail] = useState('')
  const [pw, setPw] = useState('')
  const [busy, setBusy] = useState(false)
  const go = () => {
    setBusy(true)
    setTimeout(() => {
      signIn()
      nav(loc.state?.from ?? '/matches', { replace: true })
    }, 500)
  }
  return (
    <div className="relative flex min-h-full flex-col items-center justify-center overflow-hidden bg-canvas px-6 py-12">
      {/* Reference: the same soft blue horizon as the Ask empty state, behind one card. */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-[60%]" style={{ background: 'radial-gradient(90% 65% at 50% 115%, var(--glow), transparent 62%)' }} />
      <img src="/brand/ponta-logo-white.png" alt="Ponta" className="relative mb-8 h-6 w-auto" />
      <main className="relative w-full max-w-[400px] rounded-2xl border border-hair bg-s1 px-8 pb-8 pt-7 shadow-[0_24px_60px_-28px_rgba(0,0,0,0.6)]" id="main">
        <h1 className="font-serif text-[30px] font-normal leading-9 tracking-tight text-fg-1">{t('signin.title')}</h1>
        <p className="mt-1.5 text-sm text-fg-3">{t('signin.tagline')}</p>
        <form
          className="mt-8 flex flex-col gap-4"
          onSubmit={(e) => {
            e.preventDefault()
            go()
          }}
        >
          <Field label={t('signin.email')}>{(id) => <Input id={id} type="email" autoComplete="email" placeholder="you@club.example" value={email} onChange={(e) => setEmail(e.target.value)} className="h-10" />}</Field>
          <Field label={t('signin.password')}>{(id) => <Input id={id} type="password" autoComplete="current-password" value={pw} onChange={(e) => setPw(e.target.value)} className="h-10" />}</Field>
          <Button type="submit" variant="primary" size="lg" loading={busy} className="mt-1">
            {t('signin.submit')}
          </Button>
          <div className="flex items-center gap-3 text-xs text-fg-4" aria-hidden>
            <span className="h-px flex-1 bg-hair" />
            {t('signin.or')}
            <span className="h-px flex-1 bg-hair" />
          </div>
          <Button type="button" variant="secondary" size="lg" onClick={go}>
            <KeyRound className="size-4" aria-hidden />
            {t('signin.sso')}
          </Button>
        </form>
      </main>
      <p className="relative mt-6 flex max-w-[400px] items-center gap-2 text-xs text-fg-3">
        <FlaskConical className="size-3.5 shrink-0" aria-hidden />
        {t('signin.prototype')}
      </p>
    </div>
  )
}
