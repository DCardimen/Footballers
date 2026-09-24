// Wire the sheet for the team area into the game after pack_sideline.mjs. Since v149 A the sheet is NOT inlined as a
// data URL any more: public/ ships with the page, so the PNG the pack wrote IS the asset (the game
// asks for it through window.__RIB_ASSET). This checks that wiring and refreshes the inline RIB_META_SIDE
// cellmap from art/side_v78.cellmap.json in whichever src/ file holds it. Idempotent; re-run after every
// pack_sideline.mjs change.
import { bakeSheet } from '../lib/layout.mjs'
bakeSheet({ global: '__RIB_SIDE_V78', meta: 'RIB_META_SIDE', cellmap: 'art/side_v78.cellmap.json' })
