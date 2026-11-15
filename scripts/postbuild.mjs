// Static-hosting SPA fallback: deep links such as /matches/m_0412/replay resolve to the
// app shell. Most static hosts accept 200.html or 404.html as the fallback document.
import { copyFileSync, existsSync } from 'node:fs'
const idx = 'dist/index.html'
if (existsSync(idx)) {
  copyFileSync(idx, 'dist/200.html')
  copyFileSync(idx, 'dist/404.html')
  console.log('postbuild: wrote dist/200.html and dist/404.html (SPA fallback)')
}

// The standalone match page, built from the synthetic sample payload as a single file
// that opens offline. Real payloads are exported outside the repo with export-match-page.mjs.
import { execFileSync } from 'node:child_process'
if (existsSync('dist-match-page/match-page.html')) {
  execFileSync('node', ['scripts/export-match-page.mjs', 'src/match-page/sample-payload.json', 'dist/match-page-sample.html'], { stdio: 'inherit' })
}
