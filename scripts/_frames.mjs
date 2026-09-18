import { chromium } from 'playwright'
import fs from 'node:fs'
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' })
const page = await b.newPage({ viewport: { width: 900, height: 900 } })
await page.goto('file:///tmp/vid/')
const info = await page.evaluate(async () => {
  const v = document.createElement('video')
  v.src = 'rec.mp4'; v.muted = true
  await new Promise((r, j) => { v.onloadedmetadata = r; v.onerror = () => j('decode failed') })
  window.__v = v
  return { dur: v.duration, w: v.videoWidth, h: v.videoHeight }
})
console.log('video', JSON.stringify(info))
const times = process.argv.slice(2).map(Number)
for (const t of times) {
  const data = await page.evaluate(async (t) => {
    const v = window.__v
    await new Promise(r => { v.onseeked = r; v.currentTime = t })
    const c = document.createElement('canvas')
    const s = Math.min(1, 700 / v.videoWidth)
    c.width = Math.round(v.videoWidth * s); c.height = Math.round(v.videoHeight * s)
    c.getContext('2d').drawImage(v, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', 0.82)
  }, t)
  fs.writeFileSync(`/tmp/vid/f${String(t).padStart(5, '0')}.jpg`, Buffer.from(data.split(',')[1], 'base64'))
  console.log('frame', t)
}
await b.close()
