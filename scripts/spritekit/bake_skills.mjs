// Wire the sheet for the skill icons into the game after pack_skills.mjs. Since v149 A the sheet is NOT inlined as a
// data URL any more: public/ ships with the page, so the PNG the pack wrote IS the asset (the game
// asks for it through window.__RIB_ASSET). This checks that wiring and refreshes the inline RIB_META_SKILL
// cellmap from art/skill_v64.cellmap.json in whichever src/ file holds it. Idempotent; re-run after every
// pack_skills.mjs change.
import { bakeSheet } from '../lib/layout.mjs'
bakeSheet({ global: '__RIB_SKILL_V64', meta: 'RIB_META_SKILL', cellmap: 'art/skill_v64.cellmap.json' })
