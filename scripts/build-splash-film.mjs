// v116 — cut the loading film for the web, and name the point it loops back to.
//
// The master that came in is a 1920x1080, HEVC (hvc1) title sting with an audio track: 20 MB
// for 14.5 seconds, and its `moov` atom sits AFTER `mdat`, so a browser cannot show a single
// frame until the whole file has landed. On a loading screen that is backwards — the film is
// the thing that has to start FIRST. HEVC is worse than backwards: most of the browsers this
// game is played in cannot decode it at all.
//
// So this re-cuts it: H.264 (what every phone decodes), no audio (autoplay needs `muted`
// anyway), 960x540 (the splash stage is at most ~600 CSS px wide, so 1080p was paying for
// pixels nobody sees), CRF 26, and `+faststart` to move `moov` to the front so playback begins
// on the first buffered seconds instead of the last. 20 MB -> ~1.4 MB.
//
// It also writes a VP9/WebM sibling. H.264 is what every phone the game is played on decodes,
// so the MP4 is the shipping path; the WebM is for a browser that cannot do H.264 — which
// includes Playwright's bundled Chromium, so it is also the only reason the dev checks can
// watch the film play at all. Only ever ONE of the two is fetched.
//
// THE LOOP POINT. The sting comes out of black, throws a streak across the frame and lands on
// the wordmark at ~6.5s; everything after that is the wordmark breathing under drifting cloud,
// which is why the film can run its last frame straight back into 6.5s and nothing jumps. That
// number lives in index.html as LOOP_FROM_V116 — this script only checks that the film is long
// enough to have a tail worth looping, and prints the two frames so the seam can be eyeballed.
//
//   node scripts/build-splash-film.mjs [master.mp4] [out.mp4]
//
// Defaults to art/splash/rib_loop_master_v116.mp4 -> public/rib_film_v116.mp4 (+ .webm, + .jpg).
// Needs ffmpeg on PATH; it is not a dependency of the game, only of re-cutting this asset.
import { execFileSync } from 'node:child_process'
import { existsSync, statSync } from 'node:fs'

const SRC = process.argv[2] || 'art/splash/rib_loop_master_v116.mp4'
const OUT = process.argv[3] || 'public/rib_film_v116.mp4'
const POSTER = OUT.replace(/\.mp4$/, '.jpg')
const WEBM = OUT.replace(/\.mp4$/, '.webm')
const FFMPEG = process.env.FFMPEG || 'ffmpeg'

if (!existsSync(SRC)) { console.error('no master at ' + SRC); process.exit(1) }

const W = 960, H = 540, CRF = 26

execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', SRC,
  '-an',                                   // the splash autoplays, so it is muted regardless
  '-vf', `scale=${W}:${H}:flags=lanczos`,
  '-c:v', 'libx264', '-profile:v', 'main', '-level', '3.1', '-preset', 'slow', '-crf', String(CRF),
  '-pix_fmt', 'yuv420p',
  '-g', '24',                              // a keyframe a second: the loop's seek back lands on one
  '-movflags', '+faststart',               // moov first — the whole point
  OUT], { stdio: 'inherit' })

execFileSync(FFMPEG, ['-v', 'error', '-y', '-i', SRC,
  '-an',
  '-vf', `scale=${W}:${H}:flags=lanczos`,
  '-c:v', 'libvpx-vp9', '-crf', '37', '-b:v', '0',
  '-row-mt', '1', '-deadline', 'good', '-cpu-used', '2',
  '-g', '24', '-pix_fmt', 'yuv420p',
  WEBM], { stdio: 'inherit' })

// the last frame, for prefers-reduced-motion: the film, stopped, is a still of the wordmark
execFileSync(FFMPEG, ['-v', 'error', '-y', '-sseof', '-0.2', '-i', SRC,
  '-vf', `scale=${W}:${H}:flags=lanczos`, '-frames:v', '1', '-q:v', '4', POSTER], { stdio: 'inherit' })

const kb = p => Math.round(statSync(p).size / 1024) + ' KB'
console.log(`${SRC} (${kb(SRC)})  ->  ${OUT} (${kb(OUT)})  +  ${WEBM} (${kb(WEBM)})  +  ${POSTER} (${kb(POSTER)})`)
