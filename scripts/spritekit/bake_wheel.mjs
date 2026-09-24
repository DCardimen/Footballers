// Wire the sheet for the wheel art into the game after pack_wheel.mjs. Since v149 A the sheet is NOT inlined as a
// data URL any more: public/ ships with the page, so the PNG the pack wrote IS the asset (the game
// asks for it through window.__RIB_ASSET). This checks that wiring and refreshes the inline RIB_META_WHEEL
// cellmap from art/wheel_v50.cellmap.json in whichever src/ file holds it. Idempotent; re-run after every
// pack_wheel.mjs change.
import { bakeSheet } from '../lib/layout.mjs'
bakeSheet({ global: '__RIB_WHEEL_V50', meta: 'RIB_META_WHEEL', cellmap: 'art/wheel_v50.cellmap.json' })
