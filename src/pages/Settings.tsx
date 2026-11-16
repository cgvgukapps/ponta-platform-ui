import { useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { Download, MoreHorizontal, Plug, Trash2, UserPlus } from 'lucide-react'
import { t } from '@/i18n'
import { useApp } from '@/state/app'
import { useAsync } from '@/lib/useAsync'
import { getSettings } from '@/api'
import { Button } from '@/components/ui/button'
import { Checkbox, Field, Input, Select, Switch } from '@/components/ui/form'
import { Skeleton, InlineAlert } from '@/components/ui/feedback'
import { Menu, MenuContent, MenuItem, MenuTrigger, Modal } from '@/components/ui/overlay'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Tag } from '@/components/ui/badges'

const TABS = ['organisation', 'members', 'connections', 'privacy', 'billing'] as const

function Panel({ title, description, children, className }: { title: string; description?: string; children: React.ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-hair bg-s1 ${className ?? ''}`}>
      <header className="border-b border-hair px-5 py-3.5">
        <h2 className="text-md font-semibold text-fg-1">{title}</h2>
        {description ? <p className="mt-0.5 text-sm text-fg-3">{description}</p> : null}
      </header>
      <div className="px-5 py-4">{children}</div>
    </section>
  )
}

export function SettingsPage() {
  const { tab = 'organisation' } = useParams()
  const nav = useNavigate()
  const { toast } = useApp()
  const q = useAsync(() => getSettings(), [])
  const [name, setName] = useState('Harlow Athletic FC')
  const [retention, setRetention] = useState('36')
  const [watermark, setWatermark] = useState(true)
  const [sharing, setSharing] = useState(false)
  const [del, setDel] = useState(false)
  const [confirm, setConfirm] = useState(false)
  const [invite, setInvite] = useState(false)

  if (!TABS.includes(tab as (typeof TABS)[number])) return <Navigate to="/settings/organisation" replace />
  const s = q.data

  return (
    <div className="mx-auto max-w-[960px] px-8 py-8">
      <h1 className="font-serif text-[30px] font-normal leading-9 tracking-tight text-fg-1">{t('settings.title')}</h1>
      <p className="mt-1 text-sm text-fg-3">{t('settings.sub')}</p>
      <Tabs value={tab} onValueChange={(v) => nav(`/settings/${v}`)} className="mt-6">
        <TabsList label={t('settings.title')}>
          {TABS.map((k) => (
            <TabsTrigger key={k} value={k}>
              {t(`settings.tab_${k}`)}
            </TabsTrigger>
          ))}
        </TabsList>

        {!s ? (
          <div className="mt-6 flex flex-col gap-3">
            <Skeleton className="h-40 w-full" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : (
          <>
            <TabsContent value="organisation" className="mt-6 flex flex-col gap-5">
              <Panel title={t('settings.org_title')} description={t('settings.org_desc')}>
                <div className="grid max-w-[560px] gap-4">
                  <Field label={t('settings.org_name')}>{(id) => <Input id={id} value={name} onChange={(e) => setName(e.target.value)} />}</Field>
                  <div className="grid grid-cols-2 gap-4">
                    <Field label={t('settings.org_kind')}>{(id) => <Input id={id} value={s.org.kind} readOnly />}</Field>
                    <Field label={t('settings.org_tz')}>{(id) => <Input id={id} value={s.org.timezone} readOnly />}</Field>
                  </div>
                  <div>
                    <p className="mb-1.5 text-sm font-medium text-fg-1">{t('settings.squads')}</p>
                    <div className="flex flex-wrap gap-2">
                      {s.org.squads.map((x: string) => (
                        <Tag key={x}>{x}</Tag>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="mt-5 flex gap-2">
                  <Button variant="primary" onClick={() => toast({ title: t('settings.saved') })}>
                    {t('common.save')}
                  </Button>
                </div>
              </Panel>
              <Panel title={t('settings.brief_title')} description={t('settings.brief_desc')}>
                <div className="flex flex-col gap-3">
                  <Switch checked={watermark} onCheckedChange={setWatermark} label={t('settings.brief_ai_mark')} />
                  <p className="-mt-1 pl-[44px] text-xs text-fg-3">{t('settings.brief_ai_hint')}</p>
                  <Switch checked={sharing} onCheckedChange={setSharing} label={t('settings.brief_share')} />
                </div>
              </Panel>
            </TabsContent>

            <TabsContent value="members" className="mt-6 flex flex-col gap-5">
              <Panel title={t('settings.members_title')} description={t('settings.members_desc')}>
                <div className="-mx-5 -mt-4">
                  <table className="w-full border-collapse text-sm">
                    <thead>
                      <tr className="border-b border-hair text-left text-xs font-medium text-fg-3">
                        <th className="px-5 py-2 font-medium">{t('settings.col_name')}</th>
                        <th className="px-3 py-2 font-medium">{t('settings.col_role')}</th>
                        <th className="px-3 py-2 font-medium">{t('settings.col_active')}</th>
                        <th className="w-10 px-3 py-2" />
                      </tr>
                    </thead>
                    <tbody>
                      {s.members.map((m: { id: string; name: string; email: string; role: string; lastActive: string }) => (
                        <tr key={m.id} className="border-b border-hair last:border-0">
                          <td className="px-5 py-2.5">
                            <p className="text-fg-1">{m.name}</p>
                            <p className="text-xs text-fg-3">{m.email}</p>
                          </td>
                          <td className="px-3 py-2.5 text-fg-1">{m.role}</td>
                          <td className="px-3 py-2.5 text-fg-3">{m.lastActive}</td>
                          <td className="px-3 py-2.5">
                            <Menu>
                              <MenuTrigger asChild>
                                <Button size="icon-sm" variant="ghost" aria-label={`${t('settings.member_actions')}: ${m.name}`}>
                                  <MoreHorizontal className="size-4" aria-hidden />
                                </Button>
                              </MenuTrigger>
                              <MenuContent align="end">
                                <MenuItem onSelect={() => toast({ title: t('settings.proto_action') })}>{t('settings.change_role')}</MenuItem>
                                <MenuItem danger disabled={m.role === 'Owner'} onSelect={() => toast({ title: t('settings.proto_action') })}>
                                  {t('settings.remove')}
                                </MenuItem>
                              </MenuContent>
                            </Menu>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4">
                  <Button onClick={() => setInvite(true)}>
                    <UserPlus className="size-3.5" aria-hidden />
                    {t('settings.invite')}
                  </Button>
                </div>
              </Panel>
              <Panel title={t('settings.roles_title')}>
                <dl className="grid gap-x-6 gap-y-2.5 sm:grid-cols-[160px_1fr]">
                  {s.roles.map((r: { role: string; can: string }) => (
                    <div key={r.role} className="contents">
                      <dt className="text-sm font-medium text-fg-1">{r.role}</dt>
                      <dd className="text-sm text-fg-2">{r.can}</dd>
                    </div>
                  ))}
                </dl>
              </Panel>
              <Modal
                open={invite}
                onOpenChange={setInvite}
                title={t('settings.invite')}
                description={t('settings.invite_desc')}
                footer={
                  <>
                    <Button variant="ghost" onClick={() => setInvite(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      variant="primary"
                      onClick={() => {
                        setInvite(false)
                        toast({ title: t('settings.invite_sent'), body: t('settings.proto_action') })
                      }}
                    >
                      {t('settings.send_invite')}
                    </Button>
                  </>
                }
              >
                <div className="grid gap-3">
                  <Field label={t('settings.email')}>{(id) => <Input id={id} type="email" placeholder="name@example.invalid" />}</Field>
                  <Field label={t('settings.col_role')}>
                    {() => <Select value="Analyst" onValueChange={() => undefined} aria-label={t('settings.col_role')} options={s.roles.map((r: { role: string }) => ({ value: r.role, label: r.role }))} />}
                  </Field>
                </div>
              </Modal>
            </TabsContent>

            <TabsContent value="connections" className="mt-6 flex flex-col gap-5">
              <Panel title={t('settings.conn_title')} description={t('settings.conn_desc')}>
                <ul className="-mx-5 -mt-4 divide-y divide-[var(--hairline)]">
                  {s.connections.map((c: { provider: string; name: string; kind: string; status: string; detail: string }) => (
                    <li key={c.provider} className="flex items-center gap-4 px-5 py-3">
                      <span className="flex size-8 items-center justify-center rounded-lg border border-transparent bg-s2 text-fg-2">
                        <Plug className="size-4" aria-hidden />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-medium text-fg-1">{c.name}</span>
                        <span className="block text-xs text-fg-3">{c.kind}</span>
                      </span>
                      {c.status === 'soon' ? <Tag dashed>{t('common.coming_soon')}</Tag> : <span className="text-sm text-fg-2">{c.detail}</span>}
                      <Button size="sm" variant="secondary" disabled>
                        {t('settings.connect')}
                      </Button>
                    </li>
                  ))}
                </ul>
              </Panel>
              <InlineAlert>{t('settings.conn_note')}</InlineAlert>
            </TabsContent>

            <TabsContent value="privacy" className="mt-6 flex flex-col gap-5">
              <Panel title={t('settings.priv_title')} description={t('settings.priv_desc')}>
                <div className="grid max-w-[560px] gap-5">
                  <Field label={t('settings.retention')} hint={t('settings.retention_hint')}>
                    {() => (
                      <Select
                        value={retention}
                        onValueChange={setRetention}
                        aria-label={t('settings.retention')}
                        options={[
                          { value: '12', label: t('settings.months', { n: 12 }) },
                          { value: '36', label: t('settings.months', { n: 36 }) },
                          { value: '60', label: t('settings.months', { n: 60 }) },
                          { value: '0', label: t('settings.until_deleted') },
                        ]}
                      />
                    )}
                  </Field>
                  <Checkbox checked label={t('settings.pseudonymise')} onCheckedChange={() => toast({ title: t('settings.pseudo_locked') })} />
                  <Field label={t('settings.region')}>{(id) => <Input id={id} readOnly value={t('settings.region_value')} />}</Field>
                </div>
              </Panel>
              <Panel title={t('settings.export_title')} description={t('settings.export_desc')}>
                <div className="flex gap-2">
                  <Button onClick={() => toast({ title: t('settings.export_requested'), body: t('settings.proto_action') })}>
                    <Download className="size-3.5" aria-hidden />
                    {t('settings.export_btn')}
                  </Button>
                </div>
              </Panel>
              <Panel title={t('settings.delete_title')} description={t('settings.delete_desc')}>
                <Button variant="destructive" onClick={() => setDel(true)}>
                  <Trash2 className="size-3.5" aria-hidden />
                  {t('settings.delete_btn')}
                </Button>
              </Panel>
              <Modal
                open={del}
                onOpenChange={(o) => {
                  setDel(o)
                  if (!o) setConfirm(false)
                }}
                title={t('settings.delete_modal')}
                description={t('settings.delete_modal_desc')}
                footer={
                  <>
                    <Button variant="ghost" onClick={() => setDel(false)}>
                      {t('common.cancel')}
                    </Button>
                    <Button
                      variant="destructive"
                      disabled={!confirm}
                      onClick={() => {
                        setDel(false)
                        setConfirm(false)
                        toast({ title: t('settings.proto_action') })
                      }}
                    >
                      {t('settings.delete_btn')}
                    </Button>
                  </>
                }
              >
                <Checkbox checked={confirm} onCheckedChange={setConfirm} label={t('settings.delete_confirm')} />
              </Modal>
            </TabsContent>

            <TabsContent value="billing" className="mt-6">
              <Panel title={t('settings.billing_title')}>
                <p className="max-w-[60ch] text-sm text-fg-2">{t('settings.billing_body')}</p>
              </Panel>
            </TabsContent>
          </>
        )}
      </Tabs>
    </div>
  )
}
