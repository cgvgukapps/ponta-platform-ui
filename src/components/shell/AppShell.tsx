import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import * as Dialog from '@radix-ui/react-dialog'
import { Rows3, MessageSquare, Settings, ChevronDown, Check, Search, FlaskConical, LogOut, User as UserIcon, Plus, CornerDownLeft } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { useApp } from '@/state/app'
import { getMatchesSync, getOrgsSync } from '@/api'
import { fmtDate } from '@/lib/format'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuRadioGroup, MenuRadioItem, MenuSeparator, MenuTrigger, Tooltip } from '@/components/ui/overlay'
import { Toaster } from '@/components/ui/feedback'

// The link gets a plain string className: Radix Tooltip (asChild) merges props by string concatenation,
// which turns a NavLink className function into garbage and strips all styling when the rail is collapsed.
/**
 * Navigation rail (reference): a narrow, slightly darker column of icons with tooltips. The
 * Ponta mark sits in a top cell aligned with the top bar; the active item is a soft fill with
 * a Ponta blue icon. Unbuilt areas (Players, Shortlists, Team dashboards) are not shown.
 */
function RailItem({ to, base, icon, label }: { to: string; base?: string; icon: React.ReactNode; label: string }) {
  const { pathname } = useLocation()
  const prefix = base ?? to
  const isActive = pathname === prefix || pathname.startsWith(`${prefix}/`)
  return (
    <Tooltip content={label} side="right">
      <Link
        to={to}
        aria-current={isActive ? 'page' : undefined}
        className={cn(
          'flex size-10 items-center justify-center rounded-lg transition-colors duration-[var(--dur-fast)] [&>svg]:size-[18px]',
          isActive ? 'bg-s2 text-accent' : 'text-fg-3 hover:bg-s1 hover:text-fg-1',
        )}
      >
        {icon}
        <span className="sr-only">{label}</span>
      </Link>
    </Tooltip>
  )
}

function RailButton({ icon, label, onClick, shortcut }: { icon: React.ReactNode; label: string; onClick: () => void; shortcut?: string }) {
  return (
    <Tooltip content={shortcut ? `${label} (${shortcut})` : label} side="right">
      <button type="button" onClick={onClick} aria-label={label} aria-keyshortcuts={shortcut} className="flex size-10 items-center justify-center rounded-lg text-fg-3 transition-colors hover:bg-s1 hover:text-fg-1 [&>svg]:size-[18px]">
        {icon}
      </button>
    </Tooltip>
  )
}

/** The context switcher in the top bar (reference: large quiet text with a chevron). */
function OrgSwitcher() {
  const { orgId, setOrgId, squad, setSquad } = useApp()
  const orgs = getOrgsSync()
  const org = orgs.find((o) => o.id === orgId)!
  const squadName = org.squads.find((s) => s.id === squad)?.name ?? ''
  return (
    <Menu>
      <MenuTrigger asChild>
        <button aria-label={t('shell.org_switcher')} className="-ml-2 flex h-10 items-center gap-2 rounded-lg px-2 text-left transition-colors hover:bg-s1">
          <span className="text-lg font-normal text-fg-1">{org.name}</span>
          <span className="text-lg font-normal text-fg-4">·</span>
          <span className="text-lg font-normal text-fg-3">{squadName}</span>
          <ChevronDown className="ml-0.5 size-4 text-fg-3" aria-hidden />
        </button>
      </MenuTrigger>
      <MenuContent className="w-64" side="bottom" align="start">
        <MenuLabel>{t('shell.organisation')}</MenuLabel>
        {orgs.map((o) => (
          <MenuItem key={o.id} onSelect={() => setOrgId(o.id)}>
            <span className="flex-1 truncate">{o.name}</span>
            {o.id === orgId ? <Check className="size-3.5 text-fg-2" aria-hidden /> : null}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuLabel>{t('shell.squad')}</MenuLabel>
        {org.squads.map((s) => (
          <MenuItem key={s.id} onSelect={() => setSquad(s.id)}>
            <span className="flex-1 truncate">{s.name}</span>
            {s.id === squad ? <Check className="size-3.5 text-fg-2" aria-hidden /> : null}
          </MenuItem>
        ))}
        <MenuSeparator />
        <MenuItem disabled>
          <Plus className="size-3.5" aria-hidden />
          {t('shell.add_squad')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

/** Account menu as an avatar in the top bar (reference). */
function UserMenu() {
  const { signOut, nameMode, setNameMode } = useApp()
  const nav = useNavigate()
  return (
    <Menu>
      <MenuTrigger asChild>
        <button aria-label={t('shell.user_menu')} className="flex size-9 items-center justify-center rounded-full bg-s3 text-xs font-medium text-fg-1 ring-1 ring-[var(--hairline-strong)] transition-colors hover:bg-s2">
          TL
        </button>
      </MenuTrigger>
      <MenuContent className="w-60" side="bottom" align="end">
        <div className="px-2.5 py-2">
          <p className="truncate text-sm text-fg-1">Tom Lindqvist</p>
          <p className="truncate text-xs text-fg-3">{t('shell.role_analyst')}</p>
        </div>
        <MenuSeparator />
        {/* Names live only in this browser, from the club's roster; the AI layer always works on codes. */}
        <MenuLabel>{t('shell.players_as')}</MenuLabel>
        <MenuRadioGroup value={nameMode} onValueChange={(v) => setNameMode(v === 'codes' ? 'codes' : 'names')}>
          <MenuRadioItem value="names">{t('shell.show_names')}</MenuRadioItem>
          <MenuRadioItem value="codes">{t('shell.show_codes')}</MenuRadioItem>
        </MenuRadioGroup>
        <MenuSeparator />
        <MenuItem disabled>
          <UserIcon className="size-3.5" aria-hidden />
          {t('shell.profile')}
        </MenuItem>
        <MenuItem onSelect={() => nav('/settings/organisation')}>
          <Settings className="size-3.5" aria-hidden />
          {t('nav.settings')}
        </MenuItem>
        <MenuSeparator />
        <MenuItem
          onSelect={() => {
            signOut()
            nav('/sign-in')
          }}
        >
          <LogOut className="size-3.5" aria-hidden />
          {t('shell.sign_out')}
        </MenuItem>
      </MenuContent>
    </Menu>
  )
}

/**
 * Search as a dialog (reference: search lives in the rail, not as a permanent field). It finds
 * matches in this workspace and opens them; moments and questions are searched in Ask Ponta.
 */
function SearchDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const nav = useNavigate()
  const { orgId } = useApp()
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const results = useMemo(() => {
    // Same scoping as listMatches: an empty organisation has no matches.
    const org = getOrgsSync().find((o) => o.id === orgId)
    const all = !org || org.empty ? [] : getMatchesSync()
    const needle = q.trim().toLowerCase()
    const hits = needle ? all.filter((m) => `${m.home} ${m.away} ${m.competition}`.toLowerCase().includes(needle)) : all
    return hits.slice(0, 7)
  }, [q, orgId])
  useEffect(() => {
    if (open) {
      setQ('')
      setActive(0)
    }
  }, [open])
  const go = (id: string) => {
    onOpenChange(false)
    nav(`/matches/${id}`)
  }
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-scrim" />
        <Dialog.Content
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            input.current?.focus()
          }}
          className="fixed left-1/2 top-[14vh] z-50 w-[620px] max-w-[calc(100vw-32px)] -translate-x-1/2 overflow-hidden rounded-2xl border border-hair-strong bg-s1 shadow-2xl"
        >
          <Dialog.Title className="sr-only">{t('shell.search_title')}</Dialog.Title>
          <div className="flex items-center gap-3 border-b border-hair px-4">
            <Search className="size-4 text-fg-3" aria-hidden />
            <input
              ref={input}
              value={q}
              onChange={(e) => {
                setQ(e.target.value)
                setActive(0)
              }}
              onKeyDown={(e) => {
                if (e.key === 'ArrowDown') {
                  e.preventDefault()
                  setActive((a) => Math.min(a + 1, results.length - 1))
                } else if (e.key === 'ArrowUp') {
                  e.preventDefault()
                  setActive((a) => Math.max(a - 1, 0))
                } else if (e.key === 'Enter' && results[active]) {
                  go(results[active].id)
                }
              }}
              aria-label={t('shell.search')}
              placeholder={t('shell.search_placeholder')}
              className="no-focus-ring h-14 flex-1 bg-transparent text-base text-fg-1 outline-none placeholder:text-fg-4"
            />
          </div>
          <div className="p-2">
            <p className="px-2.5 pb-1.5 pt-1 text-xs font-medium text-fg-4">{q.trim() ? t('shell.search_matches') : t('shell.search_recent')}</p>
            {results.length ? (
              <ul role="listbox" aria-label={t('shell.search_matches')}>
                {results.map((m, i) => (
                  <li key={m.id} role="option" aria-selected={i === active}>
                    <button
                      type="button"
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(m.id)}
                      className={cn('flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left text-sm', i === active ? 'bg-s2 text-fg-1' : 'text-fg-2')}
                    >
                      <Rows3 className="size-4 shrink-0 text-fg-3" aria-hidden />
                      <span className="min-w-0 flex-1 truncate">
                        {m.home} <span className="text-fg-3">{m.score ? `${m.score[0]}–${m.score[1]}` : 'v'}</span> {m.away}
                      </span>
                      <span className="shrink-0 text-xs text-fg-4">{fmtDate(m.date)}</span>
                      {i === active ? <CornerDownLeft className="size-3.5 shrink-0 text-fg-3" aria-hidden /> : null}
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-2.5 py-3 text-sm text-fg-3">{t('shell.search_none')}</p>
            )}
          </div>
          <div className="flex items-center justify-between border-t border-hair px-4 py-2.5 text-xs text-fg-4">
            <span>{t('shell.search_hint')}</span>
            <Link to="/ask" onClick={() => onOpenChange(false)} className="link">
              {t('shell.search_ask')}
            </Link>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

export function AppShell() {
  const [searchOpen, setSearchOpen] = useState(false)
  // "/" opens search, unless the user is typing.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement | null
      const typing = !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)
      if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
        e.preventDefault()
        setSearchOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="flex h-full min-h-0 bg-canvas text-fg-1">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-s3 focus:px-3 focus:py-1.5">
        {t('shell.skip')}
      </a>
      <aside aria-label={t('shell.primary_nav')} className="flex w-16 shrink-0 flex-col items-center border-r border-hair bg-desk">
        <div className="flex h-14 w-full shrink-0 items-center justify-center border-b border-hair">
          <NavLink to="/matches" aria-label={t('shell.home')}>
            <img src="/brand/ponta-icon-blue.png" alt="Ponta" className="h-5 w-auto" />
          </NavLink>
        </div>
        <nav className="mt-3 flex flex-col items-center gap-1" aria-label={t('shell.primary_nav')}>
          <RailItem to="/matches" icon={<Rows3 />} label={t('nav.matches')} />
          <RailItem to="/ask" icon={<MessageSquare />} label={t('nav.ask')} />
          <RailButton icon={<Search />} label={t('shell.search_title')} shortcut="/" onClick={() => setSearchOpen(true)} />
        </nav>
        <div className="mb-3 mt-auto flex flex-col items-center gap-1">
          <RailItem to="/settings/organisation" base="/settings" icon={<Settings />} label={t('nav.settings')} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-4 border-b border-hair bg-canvas px-6">
          <OrgSwitcher />
          <div className="ml-auto flex items-center gap-2.5">
            <Tooltip content={t('shell.env_tip')}>
              <span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-s1 px-3 text-xs text-fg-3" tabIndex={0}>
                <FlaskConical className="size-3.5" aria-hidden />
                {t('shell.env')}
              </span>
            </Tooltip>
            <button
              type="button"
              onClick={() => setSearchOpen(true)}
              aria-keyshortcuts="/"
              className="inline-flex h-9 items-center gap-2 rounded-full bg-s1 pl-3 pr-2 text-sm text-fg-3 transition-colors hover:bg-s2 hover:text-fg-1"
            >
              <Search className="size-4" aria-hidden />
              {t('shell.search_button')}
              <kbd className="ml-1 flex size-5 items-center justify-center rounded-md bg-s3 text-2xs text-fg-3">/</kbd>
            </button>
            <UserMenu />
          </div>
        </header>
        <main id="main" className="min-h-0 flex-1 overflow-auto" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <SearchDialog open={searchOpen} onOpenChange={setSearchOpen} />
      <Toaster />
    </div>
  )
}
