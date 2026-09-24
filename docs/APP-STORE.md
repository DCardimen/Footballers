# Shipping *Running It Back* — PWA, App Store, Google Play (v149 D "IT INSTALLS")

This is the release checklist. It assumes the product decisions in `docs/COMMERCIAL.md` (premium, one-time
price, no ads, no in-app purchases, single-player) and the engineering findings in `docs/AUDIT.md` §4–§5.
Steps marked **OWNER** need a human with accounts, money, a Mac or a signature; everything else is already in
the repo.

---

## 0. What is in the repo now

| Piece | Where | Notes |
|---|---|---|
| Web manifest | `public/manifest.webmanifest` | name, short name, standalone, portrait, `#070b12` theme + background, 192/512 `any` + 192/512 `maskable` |
| Icons | `public/icon-*.png`, `apple-touch-icon*.png`, `favicon-32.png`, `icon-1024.png` | cut from the film's crest by `python3 scripts/build-app-icons.py` (`npm run icons`); proof at `art/icons/icons_proof.png` |
| Capacitor asset sources | `resources/icon-only.png`, `icon-foreground.png`, `icon-background.png`, `splash.png`, `splash-dark.png`, `store/play-feature-1024x500.png` | inputs for `npm run cap:assets` |
| Service worker | template `pwa/sw.js`; built to `dist/sw.js` / `_site/sw.js` by `scripts/lib/pwa.mjs` | registered only on a built site, never in `vite` dev, never in the native shell |
| Platform layer | `src/26-platform.js` (loaded last) | `ribDialog`, `ribSave`, `ribHaptics`, Android back, keep-awake, freshness off in the shell, save mirror; hook `window.__PLATFORM_V149` |
| Capacitor config | `capacitor.config.json` | `webDir: "dist"`, splash/status bar, `ios.contentInset: "never"` |
| Capacitor packages | `package.json` (+ lock) | core/cli/android/ios 8.5 + app, haptics, status-bar, splash-screen, browser, filesystem, share, preferences, community keep-awake |
| Gate | `scripts/v149Dcheck.mjs` (`npm run check:pwa`) | builds, serves, goes offline, flips builds, stubs Capacitor |
| Policy templates | `docs/PRIVACY.md`, `docs/TERMS.md` | fill the brackets, host them (Pages can) |
| Art provenance | `docs/ART-PROVENANCE.md` (`python3 scripts/art-provenance.py`) | **must be resolved before submission — §7** |

---

## 1. The PWA (web install) — ready

* Deploy as today (`.github/workflows/pages.yml` → `scripts/assemble-pages.mjs`). The assembled `_site/` now has
  `sw.js` and the page carries `<meta name="rib-sw" content="./sw.js">`.
* **Offline**: after one online visit the whole game (page, all `src/`, menu, sheets, fonts, coach/vault/badge art —
  ~13 MB) is in Cache Storage; a career can be continued with no network. The two film encodes are not precached
  (byte-range streams); offline the splash falls back to the still/chase the game already has.
* **Updates**: navigations are network-first, so an online visit always gets what the server sends; v106.1's
  `freshV106` still compares `<meta name="rib-build">` to `rib-build.json` and reloads once, and its
  `fetch(location.href, {cache:'reload'})` passes straight through the worker. A deploy changes `sw.js` (its
  version is the build's), so the new worker installs (re-fetching only files whose content hash moved), skips
  waiting and claims the page. The running page keeps its code; the next load is the new build.
* Escape hatch: `?noSW` unregisters the worker in that browser.
* Android Chrome offers "Install app" (manifest + worker + icons). iOS: Share → Add to Home Screen.

## 2. Accounts — OWNER

| | Apple | Google |
|---|---|---|
| Program | Apple Developer Program, $99/year (individual or organisation — organisation needs a D-U-N-S number) | Play Console, $25 once. **New personal accounts must run a closed test with ≥12 testers for 14 days before production** |
| Paid app | Agreements, Tax and Banking → Paid Apps agreement signed, bank + tax forms | Payments profile (merchant account) set up before a price can be set |
| Hardware | a Mac with current Xcode (iOS builds cannot be made on Linux) | any OS with Android Studio |

## 3. Identity — OWNER

* **Bundle / application id**: `capacitor.config.json` says `com.runningitback.game` — a **placeholder**. Pick a
  reverse-DNS id you control (e.g. `com.<yourname>.runningitback`) **before** `cap add`; it can never change after
  the first upload to either store.
* Display name "Running It Back" (short name fits the 12-character home-screen label on most launchers).
* Version: set `package.json` `version` to the marketing version (e.g. `1.0.0`); iOS `CFBundleShortVersionString` /
  Android `versionName` follow it, and `CFBundleVersion` / `versionCode` must increase on every upload (use the CI
  run number).

## 4. Build the native projects — OWNER (once), then every release

```bash
npm ci                              # installs the Capacitor packages listed in package.json
# edit capacitor.config.json appId first (§3)
npm run cap:add                     # = cap add android && cap add ios   (creates android/ and ios/ — commit them)
npm run cap:assets                  # icons + splash for both platforms from resources/ (downloads @capacitor/assets)
npm run cap:sync                    # vite build → dist/ → copied into both projects + plugins wired
npm run cap:android                 # opens Android Studio
npm run cap:ios                     # opens Xcode (Mac)
```

After `cap add`, set in the native projects (not expressible in capacitor.config.json):

* **Portrait lock** — iOS: target → General → Device Orientation: Portrait only (and `UIRequiresFullScreen` YES
  on iPad, or add iPad landscape support). Android: `android:screenOrientation="portrait"` on the main activity.
* **iOS status bar**: `UIViewControllerBasedStatusBarAppearance` = YES (the StatusBar plugin needs it).
* **Android back**: nothing to do — `src/26-platform.js` registers `App.addListener('backButton')`.
* **Encryption export compliance** (iOS): `ITSAppUsesNonExemptEncryption` = NO (the game uses only HTTPS/OS crypto).
* **Android target SDK**: Play requires the current target API level (API 35 in 2025–26); Capacitor 8's template
  meets it.

### Signing

* iOS: Xcode → Signing & Capabilities → your team, "Automatically manage signing". Archive → Distribute → App
  Store Connect.
* Android: create an upload key once (`keytool -genkey -v -keystore upload.jks -alias upload -keyalg RSA -keysize 2048 -validity 10000`),
  keep it and its passwords somewhere safe (not in the repo), enrol in **Play App Signing**, build a signed
  **AAB** (Build → Generate Signed Bundle).

## 5. What the native shell does (src/26-platform.js)

| Concern | Behaviour |
|---|---|
| Service worker | not registered (`__PLATFORM_V149.sw.state === 'native'`) — the bundle is local |
| v106.1 freshness | held (`__RIB_FRESH_V106.state === 'native'`): `rib-build.json` is never fetched, nothing reloads |
| Hardware back (Android) | open dialog → closes it; vault / how-to / coach / stat card → closes; live game, sim, a decision screen (event, position pick, club offers, career end) → held with a toast; a screen with its own **Back** → presses it; browse screens → `go(hub or menu)`; hub → menu; **menu → `App.exitApp()`** |
| Haptics | `navigator.vibrate` is pointed at `Haptics.impact` (single pulse; LIGHT < 15 ms < MEDIUM < 40 ms < HEAVY) or `Haptics.vibrate` (a pattern), so the game's four existing calls work on iOS too; `ribHaptics.impact/notify` for new code |
| Keep awake | during view `live`: `KeepAwake.keepAwake()` (Wake Lock API on the web), released on leaving |
| Splash | the native splash hides as soon as the page runs (fallback: auto-hide after 1.5 s) and the game's own film takes over |
| Status bar | overlays the web view, light text; the CSS already pads with `env(safe-area-inset-*)` |
| Save | mirrored into Capacitor Preferences 1.5 s after every save and on `pause`; if iOS purges the WebView's localStorage, the next launch restores it and reloads once |
| `window.open('')` (uniform preview) | opens in an in-app frame dialog instead of a new window WKWebView would drop; external `http(s)` links open in the system browser (`@capacitor/browser`) |

**Safe areas / `contentInset`**: `ios.contentInset` is `"never"` so WKWebView does not inset the scroll view and the
page's own `env(safe-area-inset-*)` padding (35 uses, `viewport-fit=cover`) is the only inset. `"always"` would
stack the two. Verify on a notched iPhone and a gesture-nav Android phone: the v146 E top bar and bottom nav must
clear the notch / home indicator. Android 15 enforces edge-to-edge, which is what the CSS expects.

## 6. Store listing assets

| Asset | Apple | Google | Source |
|---|---|---|---|
| App icon | 1024×1024 PNG, **no alpha**, no rounded corners | 512×512 PNG (32-bit ok) | `public/icon-1024.png`, `public/icon-512.png` |
| Adaptive icon | — | foreground/background layers | `resources/icon-foreground.png` / `icon-background.png` via `cap:assets` |
| Feature graphic | — | 1024×500 | `resources/store/play-feature-1024x500.png` |
| Screenshots | 6.9" iPhone 1320×2868 (or 1290×2796) required; 13" iPad 2064×2752 if iPad is supported | phone: 2–8, 16:9 or 9:16, min 320 px side (1080×1920 recommended); tablets optional | take on device, or `SHOT_W=430 SHOT_H=932 node scripts/v146Eshot.mjs` at device scale |
| Preview video | optional, 15–30 s | optional YouTube link | |
| Text | name ≤30, subtitle ≤30, keywords ≤100, description | title ≤30, short ≤80, full ≤4000 | |

**OWNER: approve the icon.** It is the film's crest (RUNNING IT BACK over a football) on its own night sky. At
home-screen size the lettering is small; a simplified mark (the football + "RIB") may read better — the art is
generated by one script, so a new source is one change. The source film's provenance is part of §7.

## 7. Art provenance — OWNER, blocking

`docs/COMMERCIAL.md` states "all art produced by the owner". The files disagree:
**132 of the 320 tracked image files carry an embedded C2PA Content Credential from OpenAI with the IPTC
digital-source type `trainedAlgorithmicMedia`** — the generator's own statement that the image is AI-generated
(ChatGPT/DALL·E). The full per-file list is `docs/ART-PROVENANCE.md` (regenerate with
`python3 scripts/art-provenance.py`). In summary:

* repo root: `ChatGPT Image Jul 14, 2026, 11_22_41 PM.png`, `Screenshot_20260722_223926_ChatGPT.jpg`, and six
  `* pixel art.png` sheets (duplicates of `art/source/`)
* `art/file_0000….png` ×36 (ChatGPT download names), `art/Screenshot_20260916_233648_ChatGPT.jpg`
* `art/menu/` ×29 → shipped as `public/menu/*.webp` (hero, portrait, cards, tiles, badges, the wordmark)
* `art/field/` ×23 → `public/rib_field_v91.png`, `rib_lights_v92.png` (every player animation)
* `art/source/` ×16 → the sideline, crowd, referees, wheel, skill and plan sheets
* `art/ui/` ×14, `art/badges/` ×3 → `public/badges/`, `art/coach/` ×3 → `public/coach/`

What the owner must confirm and write down (keep it with the release):

1. How each group was made (prompted in ChatGPT, drawn, edited after generation, bought) and by whom.
2. That the OpenAI terms in force when they were made assign the output to the user (they do for current
   ChatGPT terms) and that no prompt reproduced a third party's protected character, logo or artwork.
3. Correct `docs/COMMERCIAL.md` to say "AI-assisted art, generated and edited by the owner" if that is the truth.
4. The film master `art/splash/rib_loop_master_v116.mp4` and the vault room art (`art/Prestige/`) carry no record —
   confirm their origin too (the app icon is cut from the film).
5. Consider deleting the loose root-level copies and the `file_0000…` originals that nothing builds from.

Neither store forbids AI-assisted art. Apple's review guideline 5.2 (IP) and Google's IP policy both require that you
have the rights to what you ship, and a dispute is decided on your records — hence the list.

## 8. Age rating questionnaires

Answers for the current build (no chat, no user content, no purchases, no ads):

| Question (paraphrased) | Answer |
|---|---|
| Violence | **Cartoon or fantasy violence: infrequent/mild** — sports contact: tackles, big hits, a player can be knocked off his feet; injuries are text ("out 3 weeks"); no blood, no weapons |
| Realistic violence, horror, sexual content, nudity, profanity, drugs/alcohol/tobacco, gambling (real money) | None |
| Simulated gambling | **No.** Wheels and rolls decide game outcomes; nothing is wagered, nothing is bought (§9) |
| User-generated content / chat / user interaction | None (the optional leaderboards in `docs/LEADERBOARDS.md` are not live — if enabled, answer "users can see others' handles" and add reporting) |
| Shares location / personal info | No |
| Unrestricted web access | No |
| In-app purchases / ads | No / No |

Expected: Apple **9+** (infrequent mild cartoon violence) — possibly 4+; IARC **Everyone / PEGI 3–7 / ESRB E**. A
"Pee Wee" career start may attract young players: do **not** opt into the Families program / "designed for
children" unless you want its extra rules; target audience 13+ in Play's Target Audience form is the simple path.

## 9. Loot boxes, wheels and gear rolls

The game has random rewards: gear drops with rarity tiers and rolled modifiers (v147 C), the season-commitment,
story, plan and rivalry wheels, and fate rolls. **All of them are earned by playing. None can be bought, and no
currency that can be bought exists.** Store answers:

* Apple: "Does your app contain loot boxes?" — **No** (guideline 3.1.1 applies only to paid random items).
* Google: "Does your app contain randomised items available for purchase (loot boxes)?" — **No.**

**Keep it that way.** If an IAP or any paid currency is ever added, it must never buy a spin, a re-roll, a gear
drop or anything else random; if it ever does, both stores require the odds to be shown before purchase, and
Belgium / the Netherlands restrict it outright. The "SPIN THE WHEEL" / "roll" wording is fine with no purchase
attached.

## 10. Privacy — data safety and nutrition labels

Current behaviour (verified in code): no accounts, no analytics, no ads, no crash reporting, no third-party SDKs.
The save lives on the device (localStorage + Capacitor Preferences in the shell). Network use: the web build
fetches `rib-build.json` from its own host (no identifiers); the native app makes no network requests at all.
The optional leaderboards (Supabase, `docs/LEADERBOARDS.md`) are **not enabled**.

* **Apple App Privacy**: "Data Not Collected". No tracking → no ATT prompt.
* **Google Data safety**: "No data collected", "No data shared"; encryption in transit — N/A (no data); deletion —
  N/A (uninstalling removes the save; Settings › Erase All Progress also does).
* **Privacy policy URL**: required by both even so. Fill in `docs/PRIVACY.md`, publish it (e.g.
  `https://<user>.github.io/Footballers/privacy.html`), link it in both listings and from Settings.
* **If leaderboards / cloud saves / crash reporting are turned on later**, the answers change: a handle and device
  id (`rib_lb_device`) are "User IDs / Other identifiers", linked to the user, used for app functionality — update
  both forms and the policy **before** that build ships.

## 11. Trademark check (preliminary — OWNER to confirm)

* In-game strings: clean. "NFL"/"DFL" appear only in code identifiers; the league is the fictional **UFF**; towns and
  50 pro clubs are generated (`namecheck.mjs` is the gate); no real league or team marks.
* The name: a web search on 2026-09-24 found no registered "RUNNING IT BACK" mark for games or software. Near
  marks exist in other classes — **LET'S RUN IT BACK** (Primetime Basketball League, US serial 88068747, class 41
  entertainment / basketball) and **RUN THAT BACK** (serial 88477250) — so the phrase is in use in sports
  entertainment. **Before paying for listings, search USPTO (tmsearch.uspto.gov), EUIPO and the App Store / Play
  store for "Running It Back" in classes 9 (downloadable game software) and 41 (online games)**, and consider
  filing your own class 9/41 application once the name is final.

## 12. Submission checklist

- [ ] §3 appId chosen and set; `cap add` run; native projects committed
- [ ] §7 art provenance written down; COMMERCIAL.md corrected
- [ ] §6 icon approved; screenshots taken on device
- [ ] PRIVACY.md / TERMS.md filled in, published, linked from the listings (and ideally Settings)
- [ ] Portrait lock set natively; safe areas checked on a notched iPhone and an Android 15 phone
- [ ] A long session on a low-end Android phone (AUDIT §5: memory, frame time at 4×)
- [ ] Save survives an app update: install build N, play, install N+1 over it (TestFlight / internal testing track)
- [ ] Airplane mode: launch, continue a career, play a live game
- [ ] Hardware back walks the screens and exits at the menu; nothing mid-game is abandoned
- [ ] Settings › Save File & Backups: export shares a file, import from it restores
- [ ] Age rating, data safety / privacy labels, loot-box answers as §8–§10
- [ ] Play: closed test with 12 testers × 14 days (new personal accounts) → production
- [ ] Apple: TestFlight → App Review (expect questions on the privacy URL and the paid-app agreement)

## 13. In-game edits still wanted (owned by the game code; not made here)

`ribDialog` exists so these can move off the browser's blocking dialogs. Each `confirm()` becomes
`ribDialog.confirm(msg, {danger:true}).then(ok => ok && …)`; each `prompt()` becomes `ribDialog.prompt(…)`:

| File | Function | Call |
|---|---|---|
| `src/07-career-app.js` | `or` (chaos: max all) | `confirm("Set chaos to your FULL capacity …")` |
| `src/07-career-app.js` | `rerollGateV112` | `confirm("⚠ REROLL PENALTY …")` — returns synchronously to its caller; the caller must become async |
| `src/07-career-app.js` | `Tr` (confirmNew) | `confirm("Start a Run it back? …")` |
| `src/07-career-app.js` | `Rr` (exportSave) | `prompt("Copy your backup code:", e)` ×2 → `ribDialog.show({input:{value:e, multiline:true, readonly:true}})`, or simply call `ribSave.exportFile()` |
| `src/07-career-app.js` | `Pr` (importSave) | `prompt("Paste your backup code:")` → `ribSave.importText(code)` — **and see below** |
| `src/07-career-app.js` | `Cr` (hardReset) | `confirm("Erase ALL progress …")` ×2 → one `ribDialog.confirm(…, {danger:true, ok:'Erase'})`; call `ribSave.backups.snapshot('before-erase')` first |
| `src/07-career-app.js` | `Md` (retireV12) | `confirm("Retire from football now? …")` |
| `src/07-career-app.js` | team creator uniform preview (v15.3, `gridironUniformPreview`) | `window.open('', …)` + `w.document.write` → `ribDialog.frame('Uniform preview').then(w => w.document.write(…))` (the shell shim already routes it there) |
| `src/20-leaderboards.js` | handle entry | `window.prompt("Leaderboard name (max 16 chars):", cur)` |
| `index.html` inline script 2 | the sandbox `confirm` auto-accept shim | can go once no `confirm()` is left |

**The import skips the boot migrations — needs an in-game fix.** `Pr` does `o = t; o.tree ||= {}; I(); te("menu")`:
none of `mc()`'s defaults (`body`, `challenges`, `hof`, `inventory`, `evergreenRefundV146`, the old `shop` → `tree`
move…) or `ks()`/`Ws()` run on the imported object, so an older save imported into a newer build renders with
missing fields until the next cold start. `ribSave.importText` avoids it by writing the save and **reloading**, so
the boot migrates it. The minimal game fix: make `Pr` write through `GridironStorage.save(t)` and `location.reload()`
(or call `ribSave.importText(code)`), and — longer term — the ordered `MIGRATIONS` list AUDIT §2.2 describes.

Other small hooks that would replace this file's DOM polling:

* Settings: a slot for the "Save File & Backups" button (it is injected after `importSave()`'s button by a 700 ms tick).
* An `afterRender(view)` event (AUDIT §2.4) — the platform layer would drop its tick.
* `ji()` / `vib()` / the vault's haptic could call `ribHaptics` directly instead of relying on the `navigator.vibrate` shim.
* `bake-menu-into-index.mjs` re-inserts the menu block just before `</body>`, i.e. after the platform tag; the
  platform file copes with either order (it traps `__RIB_FRESH_V106`), but the bake could insert before the
  `26-platform.js` tag to keep the documented order.
