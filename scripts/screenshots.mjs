// Captures every section-4 screen and the key states at 1440 x 900.
// Usage: npm run dev (in another terminal), then: npm run shots [-- filter] [-- --base http://127.0.0.1:5173]
// Uses the system Chrome (channel "chrome"); falls back to Playwright's bundled Chromium.
import { chromium } from 'playwright'
import { mkdirSync } from 'node:fs'

const args = process.argv.slice(2)
const baseIdx = args.indexOf('--base')
const BASE = baseIdx >= 0 ? args[baseIdx + 1] : 'http://127.0.0.1:5173'
const filter = args.filter((a, i) => !a.startsWith('--') && (baseIdx < 0 || i !== baseIdx + 1))
const OUT = 'docs/screenshots'
mkdirSync(OUT, { recursive: true })

let browser
try {
  browser = await chromium.launch({ channel: 'chrome' })
} catch {
  browser = await chromium.launch()
}

const issues = []
async function open(signedIn = true) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, reducedMotion: 'no-preference' })
  if (signedIn) await ctx.addInitScript(() => sessionStorage.setItem('ponta.signedIn', '1'))
  const page = await ctx.newPage()
  page.on('console', (m) => {
    const txt = m.text()
    if (m.type() === 'error' || /\[i18n\]/.test(txt)) issues.push(`${page.url()} :: ${txt}`)
  })
  page.on('pageerror', (e) => issues.push(`${page.url()} :: PAGEERROR ${e.message}`))
  return { ctx, page }
}
const wait = (page, ms) => page.waitForTimeout(ms)
const settle = async (page) => {
  await page.waitForLoadState('networkidle').catch(() => {})
  await wait(page, 900)
}

const SHOTS = [
  { name: '01-sign-in', signedIn: false, run: async (p) => { await p.goto(`${BASE}/sign-in`); await settle(p) } },
  { name: '02-library-table', run: async (p) => { await p.goto(`${BASE}/matches`); await settle(p) } },
  { name: '03-library-cards', run: async (p) => { await p.goto(`${BASE}/matches`); await settle(p); await p.getByRole('radio', { name: /cards/i }).click().catch(() => p.getByText('Cards', { exact: true }).click()); await wait(p, 400) } },
  { name: '04-library-empty-org', run: async (p) => { await p.goto(`${BASE}/matches`); await settle(p); await p.getByRole('button', { name: /switch organisation/i }).click(); await p.getByText('Northbridge Academy').click(); await wait(p, 900) } },
  { name: '05-add-data-source', run: async (p) => { await p.goto(`${BASE}/matches/new`); await settle(p) } },
  { name: '06-add-data-preview', run: async (p) => { await p.goto(`${BASE}/matches/new`); await settle(p); await p.getByRole('button', { name: /optical tracking/i }).first().click(); await wait(p, 2200) } },
  { name: '07-add-data-mismatch', run: async (p) => { await p.goto(`${BASE}/matches/new`); await settle(p); await p.getByRole('button', { name: /mismatched files/i }).first().click(); await wait(p, 2200) } },
  { name: '08-add-data-parity-gate', run: async (p) => { await p.goto(`${BASE}/matches/new`); await settle(p); await p.getByRole('button', { name: /optical tracking/i }).first().click(); await wait(p, 2200); await p.getByRole('button', { name: /check (parity|the data)/i }).click(); await wait(p, 900) } },
  { name: '08b-add-data-confirm', run: async (p) => { await p.goto(`${BASE}/matches/new`); await settle(p); await p.getByRole('button', { name: /optical tracking/i }).first().click(); await wait(p, 2200); await p.getByRole('button', { name: /check (parity|the data)/i }).click(); await wait(p, 900); await p.getByRole('button', { name: /process|continue/i }).last().click(); await wait(p, 600) } },
  { name: '08c-add-data-processing', run: async (p) => { await p.goto(`${BASE}/matches/new`); await settle(p); await p.getByRole('button', { name: /optical tracking/i }).first().click(); await wait(p, 2200); await p.getByRole('button', { name: /check (parity|the data)/i }).click(); await wait(p, 900); await p.getByRole('button', { name: /process|continue/i }).last().click(); await wait(p, 600); await p.getByRole('button', { name: /process match/i }).click(); await wait(p, 1500) } },
  { name: '09-parity-gate-m0412', run: async (p) => { await p.goto(`${BASE}/matches/m_0412/parity`); await settle(p) } },
  { name: '10-parity-event-only-blocked', run: async (p) => { await p.goto(`${BASE}/matches/m_0405/parity`); await settle(p) } },
  { name: '11-parity-t2-in-development', run: async (p) => { await p.goto(`${BASE}/matches/m_0386/parity`); await settle(p) } },
  { name: '12-brief', run: async (p) => { await p.goto(`${BASE}/matches/m_0412/brief`); await settle(p) } },
  { name: '13-brief-citation-hover-low-confidence', run: async (p) => { await p.goto(`${BASE}/matches/m_0412/brief`); await settle(p); await p.getByRole('link', { name: /evt_66190/ }).first().hover(); await wait(p, 700) } },
  { name: '14-brief-print', run: async (p) => { await p.goto(`${BASE}/matches/m_0412/brief/print`); await settle(p) } },
  { name: '15-replay-decision-quality', run: async (p) => { await p.goto(`${BASE}/matches/m_0412/replay?event=evt_99482`); await settle(p) } },
  { name: '16-replay-value-confidence', run: async (p) => { await p.goto(`${BASE}/matches/m_0412/replay?event=evt_99482`); await settle(p); await p.getByRole('button', { name: /^value/i }).click(); await p.getByRole('button', { name: /^confidence/i }).click(); await wait(p, 500) } },
  { name: '17-replay-low-confidence-moment', run: async (p) => { await p.goto(`${BASE}/matches/m_0412/replay?event=evt_66190`); await settle(p); await p.getByRole('button', { name: /^confidence/i }).click(); await wait(p, 500) } },
  { name: '18-replay-event-only', run: async (p) => { await p.goto(`${BASE}/matches/m_0405/replay`); await settle(p) } },
  { name: '19-replay-gps', run: async (p) => { await p.goto(`${BASE}/matches/m_0402/replay`); await settle(p) } },
  { name: '20-replay-players-table', run: async (p) => { await p.goto(`${BASE}/matches/m_0412/replay?event=evt_99482`); await settle(p); await p.getByRole('tab', { name: 'Players' }).click(); await wait(p, 600) } },
  { name: '21-ask-empty', run: async (p) => { await p.goto(`${BASE}/ask`); await settle(p) } },
  { name: '22-ask-answer', run: async (p) => { await p.goto(`${BASE}/ask/th_01`); await settle(p); await wait(p, 1200) } },
  { name: '23-ask-verifying', run: async (p) => { await p.goto(`${BASE}/ask?match=m_0412`); await settle(p); await p.getByRole('button', { name: /lose the ball under high pressure/i }).click(); await wait(p, 2700) } },
  { name: '24-ask-refusal', run: async (p) => { await p.goto(`${BASE}/ask/th_03`); await settle(p); await wait(p, 1200) } },
  { name: '25-settings', run: async (p) => { await p.goto(`${BASE}/settings/organisation`); await settle(p) } },
  { name: '26-settings-members', run: async (p) => { await p.goto(`${BASE}/settings/members`); await settle(p) } },
  { name: '27-player-profile-later', run: async (p) => { await p.goto(`${BASE}/players/h10`); await settle(p) } },
  { name: '28-processing', run: async (p) => { await p.goto(`${BASE}/matches/m_0418`); await settle(p) } },
  { name: '29-locked-brief', run: async (p) => { await p.goto(`${BASE}/matches/m_0386/brief`); await settle(p) } },
  { name: '30-needs-attention', run: async (p) => { await p.goto(`${BASE}/matches/m_0398`); await settle(p) } },
  { name: '31-system-sheet', run: async (p) => { await p.goto(`${BASE}/system`); await settle(p) } },
]

for (const s of SHOTS) {
  if (filter.length && !filter.some((f) => s.name.includes(f))) continue
  const { ctx, page } = await open(s.signedIn !== false)
  try {
    await s.run(page)
    await page.screenshot({ path: `${OUT}/${s.name}.png` })
    console.log('ok  ', s.name)
  } catch (e) {
    console.log('FAIL', s.name, String(e.message).split('\n')[0])
    await page.screenshot({ path: `${OUT}/${s.name}.FAILED.png` }).catch(() => {})
  }
  await ctx.close()
}
await browser.close()
if (issues.length) {
  console.log('\nConsole issues:')
  for (const i of [...new Set(issues)]) console.log(' ', i.slice(0, 300))
}
