// Wire the sheet for the stands into the game after pack_crowd.mjs. Since v149 A the sheet is NOT inlined as a
// data URL any more: public/ ships with the page, so the PNG the pack wrote IS the asset (the game
// asks for it through window.__RIB_ASSET). This checks that wiring and refreshes the inline RIB_META_CROWD
// cellmap from art/crowd_v57.cellmap.json in whichever src/ file holds it. Idempotent; re-run after every
// pack_crowd.mjs change.
import { bakeSheet } from '../lib/layout.mjs'
bakeSheet({ global: '__RIB_CROWD_V57', meta: 'RIB_META_CROWD', cellmap: 'art/crowd_v57.cellmap.json' })
