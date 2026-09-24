// v149 B — one dev server for run-checks.mjs: `node scripts/lib/serve.mjs <port>`.
// The same vite, the same vite.config.js, started through the API rather than the CLI, so the
// process's command line does not say "vite" — a `pkill -f vite` somebody runs to clean up their own
// server does not take a check run's servers down with it mid-check.
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const port = +process.argv[2] || 5400
const server = await createServer({ root: ROOT, configFile: path.join(ROOT, 'vite.config.js'), clearScreen: false, server: { port, strictPort: true } })
await server.listen()
server.printUrls()
for (const sig of ['SIGTERM', 'SIGINT']) process.on(sig, async () => { try { await server.close() } finally { process.exit(0) } })
