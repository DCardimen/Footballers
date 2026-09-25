// v150 B — waiting for the live field on GAME STATE, not on a fixed number of short polls.
//
// The broadcast checks click through to PLAY WEEK n LIVE and then waited a fixed 16-24s for
// `__gridironScene.markers`. On a quiet box the field is up in ~5s; with the suite at --jobs 3-4
// on a 4-core box (load 20-40) the Phaser boot, the v132 loader's minimum show and the first
// play can take longer than that, and every assertion after "the live field is up" cascaded into
// a failure that had nothing to do with what the check measures (badgecheck, bobcheck, v104check,
// v93check, v92check, v108check in the 2026-09-24 baseline).
//
// waitLive() polls until the scene has men on the grass, for up to `ms` of wall time. While it
// waits it also finishes a pregame wizard that is still up (its own CONTINUE TO MATCH skip, which
// keeps the picks already made — `__v112SkipD`), because a click that landed while a page was
// still mounting leaves the wizard standing and nothing will ever start the game. It never
// clicks anything else, so a check that deliberately stops short of the field is not affected.
export async function waitLive (page, ms = 90000) {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    const st = await page.evaluate(() => {
      const sc = window.__gridironScene
      if (sc && sc.markers && sc.markers.length) return 'live'
      const skip = document.getElementById('v112Skip')
      if (skip && skip.getBoundingClientRect().width > 0 && document.getElementById('pregameV1513')) { skip.click(); return 'skipped' }
      return 'wait'
    }).catch(() => 'wait')
    if (st === 'live') return true
    await page.waitForTimeout(st === 'skipped' ? 1200 : 400)
  }
  return false
}
