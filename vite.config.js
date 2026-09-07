import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'

/* v101: the shipped site (scripts/assemble-pages.mjs) keeps every runtime asset under
 * ./public/ next to index.html, and index.html asks for them there through
 * window.__RIB_ASSET. `vite build` flattens public/ into the root of dist/, so the same
 * page 404s every sheet and the whole menu bundle. Mirror the folder so a dist build is
 * the same layout the deploy is — dev already serves both. */
function mirrorPublicDir() {
  return {
    name: 'rib-mirror-public-dir',
    apply: 'build',
    closeBundle() {
      const from = path.resolve(process.cwd(), 'public')
      const to = path.resolve(process.cwd(), 'dist', 'public')
      if (!fs.existsSync(from)) return
      fs.cpSync(from, to, { recursive: true })
    },
  }
}

export default defineConfig({
  server: { host: true, port: 5173 },
  build: { target: 'es2020' },
  plugins: [mirrorPublicDir()],
})
