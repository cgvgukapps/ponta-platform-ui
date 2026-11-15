import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import '../index.css'
import { MatchPage } from './MatchPage'
import type { MatchPagePayload } from './types'
import samplePayload from './sample-payload.json'

/**
 * Entry for the standalone match page. The payload is read from an inline
 * <script id="ponta-payload" type="application/json"> written by
 * scripts/export-match-page.mjs, so the page works opened from disk. In development,
 * and when no payload is inlined, the synthetic sample payload is shown.
 */
function readPayload(): MatchPagePayload {
  const el = document.getElementById('ponta-payload')
  if (el?.textContent?.trim()) return JSON.parse(el.textContent) as MatchPagePayload
  return samplePayload as unknown as MatchPagePayload
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <MatchPage payload={readPayload()} />
  </StrictMode>,
)
