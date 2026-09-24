// Wire the sheet for the officials into the game after pack_refs.mjs. Since v149 A the sheet is NOT inlined as a
// data URL any more: public/ ships with the page, so the PNG the pack wrote IS the asset (the game
// asks for it through window.__RIB_ASSET). This checks that wiring and refreshes the inline RIB_META_REF
// cellmap from art/refs_v49.cellmap.json in whichever src/ file holds it. Idempotent; re-run after every
// pack_refs.mjs change.
import { bakeSheet } from '../lib/layout.mjs'
bakeSheet({ global: '__RIB_REFS_V49', meta: 'RIB_META_REF', cellmap: 'art/refs_v49.cellmap.json' })
