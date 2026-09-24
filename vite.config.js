import fs from 'node:fs'
import path from 'node:path'
import { defineConfig } from 'vite'
import { stampLayoutRefs } from './scripts/lib/layout.mjs'

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

/* v149 A: the game's scripts and sheets live in src/ as CLASSIC files (docs/LAYOUT.md), loaded by
 * <script src> / <link> tags that stand exactly where the inline blocks stood. Vite must not touch
 * them: in dev its transform pipeline rewrites any .js it serves outside public/ (it reformats the
 * code and replaces process.env), so src/ is served RAW here, ahead of Vite's own middleware; in a
 * build the tags carry `vite-ignore` (left as written, the attribute stripped), so the folder is
 * copied beside index.html and every reference stamped with its content hash for the cache. */
function serveSrcRaw() {
  const TYPES = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' }
  return {
    name: 'rib-serve-src-raw',
    apply: 'serve',
    configureServer(server) {
      const root = path.resolve(server.config.root, 'src')
      server.middlewares.use((req, res, next) => {
        const url = (req.url || '').split('?')[0]
        if (!url.startsWith('/src/')) return next()
        const file = path.resolve(root, decodeURIComponent(url.slice('/src/'.length)))
        const type = TYPES[path.extname(file)]
        if (!type || !file.startsWith(root + path.sep) || !fs.existsSync(file)) return next()
        res.setHeader('Content-Type', type)
        res.setHeader('Cache-Control', 'no-cache')
        res.end(fs.readFileSync(file))
      })
    },
  }
}
function shipSrcDir() {
  return {
    name: 'rib-ship-src-dir',
    apply: 'build',
    transformIndexHtml: { order: 'post', handler: (html) => stampLayoutRefs(html) },
    closeBundle() {
      const from = path.resolve(process.cwd(), 'src')
      if (fs.existsSync(from)) fs.cpSync(from, path.resolve(process.cwd(), 'dist', 'src'), { recursive: true })
    },
  }
}

export default defineConfig({
  server: { host: true, port: 5173 },
  build: { target: 'es2020' },
  plugins: [serveSrcRaw(), mirrorPublicDir(), shipSrcDir()],
})
