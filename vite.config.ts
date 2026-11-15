import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Static export: `vite build` emits plain files in dist/. The SPA fallback for deep
// links is handled by scripts/postbuild.mjs (200.html / 404.html) and by Vite's own
// history fallback in dev and preview.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  server: { port: 5173 },
  build: { chunkSizeWarningLimit: 900 },
})
