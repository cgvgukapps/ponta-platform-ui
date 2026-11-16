import { useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { Rows3, MessageSquare, Settings, Users, Bookmark, LayoutDashboard, ChevronsUpDown, Check, PanelLeftClose, PanelLeftOpen, Search, FlaskConical, LogOut, User as UserIcon, Plus } from 'lucide-react'
import { cn } from '@/lib/cn'
import { t } from '@/i18n'
import { useApp } from '@/state/app'
import { getOrgsSync } from '@/api'
import { Menu, MenuContent, MenuItem, MenuLabel, MenuSeparator, MenuTrigger, Tooltip } from '@/components/ui/overlay'
import { Tag } from '@/components/ui/badges'
import { Toaster } from '@/components/ui/feedback'
import { useMediaQuery } from '@/lib/useMediaQuery'

// The link gets a plain string className: Radix Tooltip (asChild) merges props by string concatenation,
// which turns a NavLink className function into garbage and strips all styling when the rail is collapsed.
function NavItem({ to, icon, label, collapsed, tag, base }: { to: string; icon: React.ReactNode; label: string; collapsed: boolean; tag?: string; base?: string }) {
  const { pathname } = useLocation()
  const prefix = base ?? to
  const isActive = pathname === prefix || pathname.startsWith(`${prefix}/`)
  const link = (
    <Link
      to={to}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'relative flex h-8 items-center gap-2.5 rounded-md text-sm transition-colors duration-[var(--dur-fast)]',
        collapsed ? 'justify-center px-0' : 'px-3',
        isActive ? 'bg-s2 text-fg-1' : 'text-fg-2 hover:bg-s2 hover:text-fg-1',
      )}
    >
      <span className={cn('shrink-0 [&>svg]:size-4', isActive && 'text-accent-text')}>{icon}</span>
      {!collapsed ? <span className="flex-1 truncate">{label}</span> : <span className="sr-only">{label}</span>}
      {!collapsed && tag ? <Tag className="h-4 px-1 text-[10px] text-fg-3">{tag}</Tag> : null}
    </Link>
  )
  return collapsed ? <Tooltip content={tag ? `${label} (${tag})` : label} side="right">{link}</Tooltip> : link
}

/**
 * Unbuilt areas (Players, Shortlists, Team dashboards) are hidden from the navigation so design
 * partners are not shown a roadmap as product. Their routes still exist; set this to true to review them.
 */
const SHOW_LATER_NAV = false

function DisabledNav({ icon, label, collapsed, tag }: { icon: React.ReactNode; label: string; collapsed: boolean; tag: string }) {
  const inner = (
    <div aria-disabled="true" className={cn('flex h-8 cursor-not-allowed items-center gap-2.5 rounded-md text-sm text-fg-4', collapsed ? 'justify-center' : 'px-3')}>
      <span className="shrink-0 [&>svg]:size-4">{icon}</span>
      {!collapsed ? (
        <>
          <span className="flex-1 truncate">{label}</span>
          <Tag className="h-4 px-1 text-[10px] text-fg-4" dashed>
            {tag}
          </Tag>
        </>
      ) : (
        <span className="sr-only">{label}</span>
      )}
    </div>
  )
  return collapsed ? <Tooltip content={`${label} (${tag})`} side="right">{inner}</Tooltip> : inner
}

function OrgSwitcher({ collapsed }: { collapsed: boolean }) {
  const { orgId, setOrgId, squad, setSquad } = useApp()
  const orgs = getOrgsSync()
  const org = orgs.find((o) => o.id === orgId)!
  const squadName = org.squads.find((s) => s.id === squad)?.name ?? ''
  const initials = org.name
    .split(' ')
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
  return (
    <Menu>
      <MenuTrigger asChild>
        <button aria-label={t('shell.org_switcher')} className={cn('flex w-full items-center gap-2.5 rounded-lg bg-s2 text-left transition-colors hover:bg-s3', collapsed ? 'h-11 justify-center px-0' : 'h-11 px-[5px]')}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-md bg-s3 font-mono text-xs font-semibold text-fg-1">{initials}</span>
          {!collapsed ? (
            <>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-fg-1">{org.name}</span>
                <span className="block truncate text-xs text-fg-3">{squadName}</span>
              </span>
              <ChevronsUpDown className="size-3.5 shrink-0 text-fg-3" aria-hidden />
            </>
          ) : null}
        </button>
      </MenuTrigger>
      <MenuContent className="w-60" side={collapsed ? 'right' : 'bottom'}>
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

function UserMenu({ collapsed }: { collapsed: boolean }) {
  const { signOut } = useApp()
  const nav = useNavigate()
  return (
    <Menu>
      <MenuTrigger asChild>
        <button aria-label={t('shell.user_menu')} className={cn('flex w-full items-center gap-2.5 rounded-md text-left transition-colors hover:bg-s2', collapsed ? 'h-11 justify-center' : 'h-11 px-1.5')}>
          <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-s3 font-mono text-xs text-fg-1">TL</span>
          {!collapsed ? (
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm text-fg-1">Tom Lindqvist</span>
              <span className="block truncate text-xs text-fg-3">{t('shell.role_analyst')}</span>
            </span>
          ) : null}
        </button>
      </MenuTrigger>
      <MenuContent className="w-56" side="top">
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

export function AppShell() {
  const { railPref, setRailPref, toast } = useApp()
  const loc = useLocation()
  const onReplay = /\/replay$/.test(loc.pathname)
  const narrow = useMediaQuery('(max-width: 1359px)')
  const collapsed = railPref ?? (onReplay || narrow)
  const [q, setQ] = useState('')
  return (
    <div className="flex h-full min-h-0 bg-canvas text-fg-1">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-[100] focus:rounded-md focus:bg-s3 focus:px-3 focus:py-1.5">
        {t('shell.skip')}
      </a>
      <aside aria-label={t('shell.primary_nav')} className={cn('relative flex shrink-0 flex-col bg-canvas transition-[width] after:pointer-events-none after:absolute after:inset-y-0 after:right-0 after:w-px after:bg-hair duration-[var(--dur-slow)]', collapsed ? 'w-14' : 'w-60')}>
        <div className={cn('flex h-12 shrink-0 items-center', collapsed ? 'justify-center' : 'pl-[10.2px]')}>
          <NavLink to="/matches" aria-label={t('shell.home')}>
            {collapsed ? <img src="/brand/ponta-icon-blue.png" alt="Ponta" className="h-[18px] w-auto" /> : <img src="/brand/ponta-logo-white.png" alt="Ponta" className="h-[18px] w-auto" />}
          </NavLink>
        </div>
        <div className="px-2">
          <OrgSwitcher collapsed={collapsed} />
        </div>
        <nav className="mt-4 flex flex-col gap-0.5 px-2" aria-label={t('shell.primary_nav')}>
          <NavItem to="/matches" icon={<Rows3 />} label={t('nav.matches')} collapsed={collapsed} />
          <NavItem to="/ask" icon={<MessageSquare />} label={t('nav.ask')} collapsed={collapsed} />
          <NavItem to="/settings/organisation" base="/settings" icon={<Settings />} label={t('nav.settings')} collapsed={collapsed} />
        </nav>
        {SHOW_LATER_NAV ? (
        <div className="mt-5 flex flex-col gap-0.5 px-2" role="group" aria-label={t('nav.later_group')}>
          {!collapsed ? <p className="px-3 pb-1 text-xs font-medium text-fg-4">{t('nav.later_group')}</p> : <div className="flex h-5 items-center px-3" aria-hidden><div className="h-px w-full bg-hair" /></div>}
          <NavItem to="/players/h10" base="/players" icon={<Users />} label={t('nav.players')} collapsed={collapsed} tag={t('nav.later')} />
          <DisabledNav icon={<Bookmark />} label={t('nav.shortlists')} collapsed={collapsed} tag={t('nav.later')} />
          <DisabledNav icon={<LayoutDashboard />} label={t('nav.team_dashboards')} collapsed={collapsed} tag={t('nav.later')} />
        </div>
        ) : null}
        <div className="mt-auto flex flex-col gap-1 border-t border-hair p-2">
          <button
            onClick={() => setRailPref(!collapsed)}
            aria-label={collapsed ? t('shell.expand') : t('shell.collapse')}
            className={cn('flex h-8 items-center gap-2.5 rounded-md text-sm text-fg-3 hover:bg-s2 hover:text-fg-1', collapsed ? 'justify-center' : 'px-3')}
          >
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
            {!collapsed ? <span>{t('shell.collapse')}</span> : null}
          </button>
          <UserMenu collapsed={collapsed} />
        </div>
      </aside>
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-12 shrink-0 items-center gap-4 border-b border-hair bg-canvas px-5">
          <form
            role="search"
            className="relative w-[340px] max-w-full"
            onSubmit={(e) => {
              e.preventDefault()
              if (q.trim()) toast({ title: t('shell.search_visual'), body: t('shell.search_visual_body') })
            }}
          >
            <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-fg-3" aria-hidden />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              aria-label={t('shell.search')}
              placeholder={t('shell.search')}
              className="h-9 w-full rounded-lg bg-s2 pl-8 pr-10 text-sm text-fg-1 placeholder:text-fg-4 hover:bg-s3 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-accent"
            />
            <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-sm border border-hair-strong px-1 font-mono text-2xs text-fg-4">/</kbd>
          </form>
          <div className="ml-auto flex items-center gap-3">
            <Tooltip content={t('shell.env_tip')}>
              <span className="inline-flex h-6 items-center gap-1.5 rounded-sm border border-dashed border-hair-dashed px-2 font-mono text-2xs text-fg-2" tabIndex={0}>
                <FlaskConical className="size-3" aria-hidden />
                {t('shell.env')}
              </span>
            </Tooltip>
          </div>
        </header>
        <main id="main" className="min-h-0 flex-1 overflow-auto" tabIndex={-1}>
          <Outlet />
        </main>
      </div>
      <Toaster />
    </div>
  )
}
