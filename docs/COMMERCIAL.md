# Commercial roadmap — shipping *Running It Back* as a paid mobile game

This is the durable plan for turning the current build into a sellable product.
It records the product decisions, what has already been done toward that goal,
and the concrete remaining path to the App Store / Google Play. Update it as
scope evolves — it is meant to be the single source of truth for "what does
commercial v1 mean."

## Product definition (locked)

| Decision | Choice |
|---|---|
| Platform | **Mobile** — iOS + Android |
| Monetization | **Premium, one-time $2.99 for the whole game** (no ads, no IAP) |
| IP posture | **Real cities, fully fictional team names** (no real-league marks) |
| Core fantasy | **Single-player** — be one player, live a career |
| Marquee replay hook | **Score Attack** — a single-player high-score mode |
| Art | Cohesive look; **all art produced by the owner** |
| Audience | Sim / sports fans (depth-seekers) |
| Budget / team | Solo, self-produced |
| Goal | A passion project made **real and complete** |

The game is a single self-contained `index.html` (Phaser bundled inline, art
baked as data URLs). That is a strength for mobile packaging: the whole app is
static assets, so it wraps cleanly in a native shell and runs fully offline.

## What has been done toward commercial v1

- **Score Attack mode (v46).** A self-contained arcade high-score loop — "The
  Gauntlet." Pick a position, play endless one-game rounds, choose **Steady** vs
  **Go for glory** each round (risk/reward), beat a rising score bar to survive,
  and chase a persistent personal best. Built entirely on the stable exported
  engine (`window.__simGameV2`), so it never touches career state. Best score and
  best streak persist to the save (`o.highScore` / `o.highStreak`). Scoring is
  calibrated across all positions in `scripts/hsprobe.mjs`; end-to-end behavior is
  guarded by `scripts/hscheck.mjs`.
- **IP-safety pass.** All real NFL team nicknames were replaced with fictional
  ones in both the player's own team pool (`er`) and the opponent generator
  (`Dt`). Real *city* names are retained by design. No real-league logos or marks
  are used (team emblems are procedurally generated). See the audit note below.
- **Installable-app packaging.** A web app manifest (`public/manifest.webmanifest`),
  maskable icon set (`public/icon-*.png`, generated from `public/icon.svg` via
  `scripts/genicons.mjs`), and iOS/Android install meta tags are wired into
  `index.html`. The game can now be "Added to Home Screen" and is ready to wrap
  with Capacitor.
- **Capacitor config** (`capacitor.config.json`) targeting `_site` as the web
  directory (the same output the Pages workflow assembles).

## The path to the stores

### 1. Wrap the web build with Capacitor

Capacitor packages the static web app into native iOS/Android projects. The web
assets are the assembled Pages site (`_site`), so build that first.

```bash
# one-time
npm install -D @capacitor/cli
npm install @capacitor/core @capacitor/ios @capacitor/android

# assemble the web build Capacitor will wrap (already used by Pages)
node scripts/assemble-pages.mjs _site

# init uses capacitor.config.json already in the repo, then add platforms
npx cap add ios
npx cap add android

# after any web change: re-assemble, then sync into the native projects
node scripts/assemble-pages.mjs _site && npx cap sync
```

Open and run the native projects:

```bash
npx cap open ios       # Xcode  (needs a Mac + Apple Developer account, $99/yr)
npx cap open android   # Android Studio
```

### 2. App icons & splash

- Replace the placeholder `public/icon.svg` with final art, then re-run
  `node scripts/genicons.mjs` to regenerate the PNG sizes.
- Generate the full native icon/splash sets with
  [`@capacitor/assets`](https://github.com/ionic-team/capacitor-assets):
  `npx @capacitor/assets generate` (needs a 1024×1024 icon and a splash source).
- Store listing art needed: 1024×1024 icon (no alpha for iOS), feature graphic
  (Play: 1024×500), and phone screenshots (App Store: 6.7" + 5.5"; Play: min 2).

### 3. Store setup — premium ($2.99)

- **App Store Connect:** create the app, set price tier to $2.99, no IAP. Fill
  privacy nutrition labels — if you add **no** analytics/tracking, you can
  truthfully declare "no data collected," which is the simplest review path.
- **Google Play Console:** one-time $25 registration; set the app as **Paid** at
  $2.99; complete the Data safety form (again simplest if you collect nothing).
- Both stores require a privacy policy URL even for a paid, no-data game — host a
  one-page policy (GitHub Pages can serve it).

### 4. Pre-submission checklist

- [ ] Runs fully offline in the native shell (no network calls block gameplay).
      **Action item:** the Google-Fonts `@import` in `<head>` currently fetches
      from a CDN — self-host those fonts so first launch works with no network
      and to avoid a review flag. (This is why fonts fail to load in the sandbox
      dev server today.)
- [ ] Save data survives app updates (localStorage persists in Capacitor's
      WebView; verify on a real device before launch).
- [ ] Portrait-lock is honored (manifest sets it; also set it in the native
      projects' Info.plist / AndroidManifest).
- [ ] Safe-area insets look right on notched devices (the UI already uses
      `env(safe-area-inset-*)`).
- [ ] Age rating questionnaires completed (no violence beyond cartoon sports).
- [ ] Test on a low-end Android device — the inline Phaser bundle + baked assets
      make a large single document; confirm memory/startup are acceptable.

## IP-safety audit (keep current)

Goal: **real cities allowed, fictional team names only, no real-league marks.**

- Player's own team nicknames — `er` array (career-app block). Real NFL names
  removed (`Falcons`→`Firebirds`, `Chiefs`→`Sentinels`).
- Opponent name generator — `Dt()` tiers. Real NFL names removed
  (`Colts`,`Rams`,`Bears`,`Broncos`,`Panthers`,`Raiders`,`Chargers`,`Eagles`,
  `Titans`,`Jaguars`,`Falcons` → fictional equivalents).
- City list in `Dt()` (`Dallas`, `Miami`, …) — real cities, retained by design.
- Team emblems/palettes are procedurally generated — no real logos embedded.
- **Before launch, also review:** player-name generator (avoid generating famous
  real athletes' full names), any stadium/brand strings, and the app name for
  trademark conflicts (search the App Store / USPTO for "Running It Back").

## Fast-follows (post-launch, ranked by impact on a premium sim)

1. **Onboarding polish** — the first-run tutorial is functional; make it sell the
   fantasy in the first 60 seconds (this drives refunds/ratings on premium).
2. **Audio** — even minimal SFX + a menu loop dramatically lifts perceived value;
   package audio as local assets (no CDN).
3. **Score Attack depth** — per-position leaderboards (local first), daily seed
   challenge, unlockable positions, a share-your-score card. Cheap retention.
4. **Meta progression tie-in** — let Score Attack feed prestige/cosmetics so the
   arcade mode and the career reinforce each other.
5. **Analytics (optional)** — if you want funnel data, add a privacy-light,
   on-device-friendly analytics SDK; note it changes your store privacy labels.
6. **Store optimization** — icon A/B, a 15–30s trailer, and a tight screenshot
   set matter more than any single feature for a $2.99 title.

## Known risks / honest caveats

- One giant `index.html` is great for packaging but hard to maintain; keep new
  systems in isolated appended blocks (as Score Attack is) to limit blast radius.
- Startup cost on low-end devices is the main technical unknown — measure early.
- A premium price on mobile is a hard sell without a strong icon, trailer, and
  the first-session hook landing. The product work above matters as much as code.
```
