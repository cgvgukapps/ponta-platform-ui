# Ponta platform: clickable prototype

A high-fidelity, front-end-only prototype of the authenticated Ponta product. Everything is mock data: there is no backend, no real sign-in and no model behind Ask Ponta. A "Prototype, sample data" badge is on every screen.

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:5173
```

Sign in with any address and password. The sign-in is a sessionStorage flag.

Static build (any static host; client-side routing with SPA fallback):

```bash
npm run build        # typecheck, vite build, writes dist/200.html and dist/404.html as SPA fallbacks
npm run preview
```

Other scripts:

| Script | What it does |
| --- | --- |
| `npm run typecheck` | Strict TypeScript. |
| `node scripts/check-i18n.mjs` | Reports keys used in code but missing from `src/i18n/en.ts`, and unused keys. |
| `npm run contrast` | Verifies WCAG contrast for every token pair and writes `docs/contrast.md`. Exits non-zero on failure. |
| `npm run gen:mock` | Regenerates the deterministic mock tracking and event data. |
| `npm run shots` | Captures `docs/screenshots/*` at 1440 × 900 with Playwright and system Chrome. |

## Shareable match page

`match-page.html` is a standalone, light, read-only page built from one JSON payload: the data check, coverage, rule-selected moments and optional analyst notes. `npm run build` writes `dist/match-page-sample.html` (synthetic sample, one self-contained file that opens offline). For a real match, see `docs/match-page-payload.md`.

## Where to start

| Route | Screen |
| --- | --- |
| `/matches` | Match Library (table and cards) |
| `/matches/new` | Add data, four steps |
| `/matches/m_0412/parity` | Parity report and gate |
| `/matches/m_0412/brief` | Match AI Brief; `/brief/print` is the light print view |
| `/matches/m_0412/replay` | Pitch Replay; keyboard help is in the transport row |
| `/ask` | Ask Ponta |
| `/settings` | Settings |
| `/players/h10` | Player profile, marked Later |
| `/system` | Token and component sheet |

Sample matches:

| ID | What it shows |
| --- | --- |
| `m_0412` | Optical tracking, Tier 1, 10 Full, 3 Degraded, 1 Blocked. The main demo match. |
| `m_0409` | SkillCorner optical, mostly Degraded (3 Full, 8 Degraded, 3 Blocked). |
| `m_0405`, `m_0366` | Event data only: estimate-style decision quality, no player positions. |
| `m_0402` | GPS-only session: no replay overlays, physical measures only. |
| `m_0386` | Tier 2, two unpaired sources: shown as In development and locked. |
| `m_0379` | Tier 3, paired sources: shown as In development and locked. |
| `m_0418`, `m_0415` | Processing and queued states. |
| `m_0398`, `m_0391` | Needs attention (mismatch) and failed ingestion. |

## Structure

```
src/styles/tokens.css      all colour, radius, motion tokens; print theme override
src/index.css              Tailwind v4 theme mapping, fonts, pattern classes
src/components/ui          primitives (Radix + cva), badges, citation chips, moment cards
src/components/replay      PlaybackStore, PitchCanvas, Timeline, ExplainCard, EventList, PlayerTable
src/lib/engine.ts          mock decision-quality engine over the generated tracking data
src/api                    async data layer over JSON; swap for real calls later
src/state/askStore.ts      mock Ask turns: reading, finding, streaming, verifying, done
src/i18n/en.ts             all UI strings behind t()
docs/                      design notes, contrast table, screenshots
```

See `docs/design-notes.md` for tokens, the colour-collision decisions, assumptions and rejected directions.
