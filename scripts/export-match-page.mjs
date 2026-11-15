// Turn the built match page (dist/match-page.html) into ONE self-contained HTML file:
// its scripts, styles and fonts inlined, and a payload JSON inlined as
// <script id="ponta-payload">. The result opens from disk, offline, with no server.
//
//   node scripts/export-match-page.mjs <payload.json> <out.html>
//
// Run `npm run build` first. Real payloads (from ponta-platform's tools/match_page_payload.py)
// are derived from licensed or unverified sample data: write them outside this repository.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import path from 'node:path'

const [payloadPath, outPath] = process.argv.slice(2)
if (!payloadPath || !outPath) {
  console.error('usage: node scripts/export-match-page.mjs <payload.json> <out.html>')
  process.exit(2)
}
const dist = 'dist-match-page'
const entry = path.join(dist, 'match-page.html')
if (!existsSync(entry)) {
  console.error('dist-match-page/match-page.html not found: run npm run build first')
  process.exit(2)
}
const fromDist = (p) => path.join(dist, p.replace(/^\//, ''))
const mime = { '.woff2': 'font/woff2', '.png': 'image/png', '.svg': 'image/svg+xml' }
const dataUri = (file) => `data:${mime[path.extname(file)] ?? 'application/octet-stream'};base64,${readFileSync(file).toString('base64')}`

let html = readFileSync(entry, 'utf8')
const payload = JSON.parse(readFileSync(payloadPath, 'utf8'))

// Styles: inline, with font and image urls turned into data URIs.
html = html.replace(/<link rel="stylesheet"[^>]*href="([^"]+)"[^>]*>/g, (_, href) => {
  const css = readFileSync(fromDist(href), 'utf8').replace(/url\((['"]?)(\/[^)'"]+)\1\)/g, (m, q, u) => (existsSync(fromDist(u)) ? `url(${dataUri(fromDist(u))})` : m))
  return `<style>${css}</style>`
})
// Module preloads are not needed once scripts are inline.
html = html.replace(/<link rel="modulepreload"[^>]*>/g, '')
// Scripts: inline the entry and every chunk it imports, bundled into one module.
html = html.replace(/<script type="module" crossorigin src="([^"]+)"><\/script>/g, (_, src) => {
  const seen = new Set()
  const chunks = []
  const visit = (file) => {
    if (seen.has(file)) return
    seen.add(file)
    let code = readFileSync(fromDist(file), 'utf8')
    code = code.replace(/import\s*["']\.\/([^"']+)["'];?/g, (m, dep) => { visit(path.posix.join(path.posix.dirname(file), dep)); return '' })
    chunks.push({ file, code })
  }
  visit(src)
  if (chunks.length > 1 || /from\s*["']\.\//.test(chunks[0].code)) {
    console.error('The match page entry imports other chunks by name; inline export needs a single chunk. Check vite.config.ts.')
    process.exit(1)
  }
  return `<script type="module">${chunks[0].code.replace(/<\/script/gi, '<\\/script')}</script>`
})
// Payload, escaped so it cannot close the script tag.
const json = JSON.stringify(payload).replace(/</g, '\\u003c')
html = html.replace(/<script id="ponta-payload" type="application\/json"><\/script>/, `<script id="ponta-payload" type="application/json">${json}</script>`)
writeFileSync(outPath, html)
console.log(`export-match-page: wrote ${outPath} (${(html.length / 1024).toFixed(0)} KB)`)
