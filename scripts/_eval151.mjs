// temp (v151 D) — evaluate a JS file's body in the game page and print its JSON. Not committed.
import { chromium } from 'playwright'
import fs from 'node:fs'
import { CHROME, GAME_URL } from './lib/env.mjs'
const browser = await chromium.launch({ executablePath: CHROME })
const page = await browser.newPage()
const errs = []
page.on('pageerror', e => errs.push(e.message))
await page.goto(GAME_URL, { waitUntil: 'networkidle' }); await page.waitForTimeout(1500)
await page.waitForFunction(() => typeof window.__simGameV2 === 'function' && typeof window.buildPlayScript === 'function', null, { timeout: 60000 })
const body = fs.readFileSync(process.argv[2], 'utf8')
const arg = JSON.parse(process.env.ARG || '{}')
const R = await page.evaluate(({ body, arg }) => { const f = new Function('arg', body); return f(arg) }, { body, arg })
console.log(JSON.stringify(R))
if (errs.length) console.log('pageerrors', errs.slice(0, 3))
await browser.close()
