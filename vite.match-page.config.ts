import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'node:path'

// Separate build for the standalone match page: one entry, one JS chunk, one CSS file,
// so scripts/export-match-page.mjs can inline everything into a single HTML file.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': path.resolve(__dirname, 'src') } },
  publicDir: 'public',
  build: {
    outDir: 'dist-match-page',
    emptyOutDir: true,
    cssCodeSplit: false,
    // Inline the logo so the exported page stays one self-contained file.
    assetsInlineLimit: 64 * 1024,
    chunkSizeWarningLimit: 900,
    rollupOptions: { input: path.resolve(__dirname, 'match-page.html'), output: { inlineDynamicImports: true } },
  },
})
