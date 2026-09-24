// Wire the sheet for the game-plan icons into the game after pack_plans.mjs. Since v149 A the sheet is NOT inlined as a
// data URL any more: public/ ships with the page, so the PNG the pack wrote IS the asset (the game
// asks for it through window.__RIB_ASSET). This checks that wiring and refreshes the inline RIB_META_PLAN
// cellmap from art/plan_v66.cellmap.json in whichever src/ file holds it. Idempotent; re-run after every
// pack_plans.mjs change.
import { bakeSheet } from '../lib/layout.mjs'
bakeSheet({ global: '__RIB_PLAN_V66', meta: 'RIB_META_PLAN', cellmap: 'art/plan_v66.cellmap.json' })
