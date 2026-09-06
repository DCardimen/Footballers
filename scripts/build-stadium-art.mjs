// v92: cut the stadium sheet (floodlight towers) into public/rib_lights_v92.png and rewrite
// RIB_META_V92 in index.html. Thin wrapper over build-stadium-art.py (Pillow + numpy).
import { spawnSync } from 'node:child_process'
const r = spawnSync('python3', ['scripts/build-stadium-art.py'], { stdio: 'inherit' })
process.exit(r.status ?? 1)
