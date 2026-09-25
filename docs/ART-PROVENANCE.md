# Art provenance (generated — `python3 scripts/art-provenance.py`)

139 of 344 tracked image/video files carry an embedded AI-generation record or a tool name. A C2PA manifest with `trainedAlgorithmicMedia` is the generator itself stating the picture was produced by a generative model; OpenAI embeds one in every ChatGPT / DALL·E image. Files in `public/` are re-encoded cuts (the build scripts strip metadata), so they carry no record of their own — they inherit it from their source.

**docs/COMMERCIAL.md says "all art produced by the owner". The owner must confirm, per group below, how the art was made and that they hold the rights to ship it** (docs/APP-STORE.md §7).

## By folder

| folder | files with a record |
|---|---|
| `(repo root)` | 8 |
| `art` | 36 |
| `art/badges` | 3 |
| `art/coach` | 3 |
| `art/field` | 23 |
| `art/legacy` | 5 |
| `art/menu` | 31 |
| `art/source` | 16 |
| `art/ui` | 14 |

## What ships, and what it is cut from

| shipped | source | cut by |
|---|---|---|
| `public/menu/*.webp` | `art/menu/*.png` | scripts/build-menu-art.py |
| `public/coach/*.webp` | `art/coach/coach_sheet_*_v119.png` | scripts/build-coach-art.py |
| `public/badges/*.webp` | `art/badges/sheet-*.png` | scripts/build-badge-art.mjs |
| `public/rib_field_v91.png` | `art/field/*.png` | scripts/build-field-art.mjs / .py |
| `public/rib_lights_v92.png` | `art/field/lights.png` | scripts/build-stadium-art.mjs |
| `public/rib_side_v78.png, rib_crowd_v57.png, rib_refs_v49.png, rib_wheel_v50.png, rib_skill_v64.png, rib_plan_v66.png` | `art/source/*pixel art.png` | the spritekit bake_*.mjs |
| `public/rib_logos_v44.png` | `art/football-logo-sheet-*.png` | the v44 emblem bake |
| `public/vault/*.webp` | `art/Prestige/*` | scripts/build-vault-art.py |
| `public/legacy/*.webp` | `art/legacy/sheet-*.png` | scripts/build-legacy-medals.py |
| `public/rib_film_v116.{mp4,webm,jpg} and the app icons` | `art/splash/rib_loop_master_v116.mp4` | scripts/build-splash-film.mjs, scripts/build-app-icons.py |

## Every file

| file | size | evidence |
|---|---|---|
| `ChatGPT Image Jul 14, 2026, 11_22_41 PM.png` | 2577 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, file name says ChatGPT |
| `Screenshot_20260722_223926_ChatGPT.jpg` | 1796 KB | file name says ChatGPT |
| `art/Screenshot_20260916_233648_ChatGPT.jpg` | 139 KB | file name says ChatGPT |
| `art/badges/sheet-downs.png` | 1836 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/badges/sheet-plays.png` | 2393 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/badges/sheet-scores.png` | 2370 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/coach/coach_sheet_1_v119.png` | 1462 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/coach/coach_sheet_2_v119.png` | 1521 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/coach/coach_sheet_3_v119.png` | 1389 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/catch_throw.png` | 1226 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/contact.png` | 1184 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/exchange_mini.png` | 1127 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/exchange_quarter.png` | 1268 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/football.png` | 754 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/getup.png` | 1069 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/helmet_turn.png` | 479 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/kit_layers.png` | 740 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/lights.png` | 1325 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/qb_handoff_v118.png` | 616 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/qb_throw_cross_v118.png` | 298 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/qb_throw_right_v118.png` | 606 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/qb_toss_v118.png` | 575 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/reactions.png` | 1178 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/run8.png` | 1878 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/snap_catch_mini.png` | 1447 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/stances.png` | 687 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/throw_back.png` | 925 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/throw_dir_a.png` | 1096 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/throw_dir_b.png` | 1004 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/throw_front.png` | 1059 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/throw_quarter_a.png` | 837 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/field/throw_quarter_b.png` | 983 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/file_0000000001b881f5a558b829e2bb452e.png` | 1829 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_000000002e0c81f5aa68e97165409572.png` | 1989 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_0000000057f481f597e8b859c9670c69.png` | 1604 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_000000005a1481f59f2d63cff5996b07.png` | 2181 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_0000000064b881f5afb80facbf9f910b.png` | 1988 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_0000000069b881f5b3959606dc75e2f4.png` | 1730 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000704c81f5bbb498e0412d71d2.png` | 1626 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000794c81f5b51d8c45e5646ebf.png` | 2270 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_000000007d1881f992b4a27d1ad6d128.png` | 597 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_0000000082d881f5aa30ee27d96802ef.png` | 2031 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_000000009c4081fb9d89afdb375d4c6c.png` | 1777 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_000000009ea481f596bae157d43e21bd.png` | 1793 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000a0c881f5bbc8fd0be6313c0e.png` | 1793 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000a73c81f58395fae3edf949a7.png` | 1706 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000a94481f58585e1b1163109e2.png` | 2386 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000ab5881f5849caf92ac2e72b4.png` | 1818 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000ae1881f59ff290cfe8c7c66e.png` | 2173 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000ae3881f5b17572deaccc4041.png` | 2373 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000b6fc81f5a98bc4581b9e6dd1.png` | 2011 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000bb7081f5a6a3d23c877af9c0.png` | 2139 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000be8c81f5ac2de724d8cd071b.png` | 1876 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000c6fc81f5b222a2642355102b.png` | 2113 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000cb8c81f5bb0a46afbf1556cc.png` | 2364 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000cc6881f598bc13fc632dad7e.png` | 1802 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000def081f58ad0a997692521b7.png` | 2079 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000e01481f59f344208d006b76b.png` | 2361 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000e1f481f5bf8dc4efacb61f6a.png` | 2327 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000ee5481f5860ba476e59f8c58.png` | 1770 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000ef3c81f5b4940437f75da9be.png` | 2278 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000efcc81f59fc1c11ce26094ae.png` | 1961 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000f6dc81f5bd4413b619aabee3.png` | 1984 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000f72881f5852485c8454279e0.png` | 1685 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000fd8481f58b3c6761284a2f68.png` | 1809 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000fef081f5a6a6b67d04b903ec.png` | 2131 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/file_00000000ff3481f58c36694c6d49d608.png` | 1833 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest, ChatGPT download name |
| `art/legacy/sheet-001-100.png` | 2377 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/legacy/sheet-101-200.png` | 2524 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/legacy/sheet-201-300.png` | 2679 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/legacy/sheet-301-400.png` | 2685 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/legacy/sheet-401-500.png` | 2772 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/badge-sheet.png` | 2518 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/badge_brain.png` | 2675 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/badge_clock.png` | 2477 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/badge_crown.png` | 2498 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/badge_eye.png` | 2545 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/badge_fist.png` | 2517 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/badge_lightning.png` | 2741 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/badge_shield.png` | 2395 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/badge_shoe.png` | 2845 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/badge_target.png` | 2442 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/card_continue.png` | 1776 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/card_trophy.png` | 1552 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/hero_tunnel.png` | 1780 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/hero_tunnel_wall.png` | 2076 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/icon_career.png` | 2565 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/icon_goals.png` | 2033 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/icon_hall.png` | 1535 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/icon_locker.png` | 1754 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/icon_settings.png` | 2512 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/icon_training.png` | 1606 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/legacy_crown.png` | 1432 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/legacy_gem.png` | 1359 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/legacy_helmet.png` | 1552 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/legacy_laurel.png` | 1335 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/legacy_star.png` | 1106 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/legacy_target.png` | 1578 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/logo_wordmark.png` | 2561 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/portrait_helmet.png` | 1570 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/swash_underline.png` | 512 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/trophy_interstellar_champions.png` | 2975 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/menu/trophy_uff_champions.png` | 2610 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/block and pancake pixel art.png` | 1704 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/catches pixel art.png` | 1777 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/crowd stands pixel art.png` | 2152 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/cuts and jukes pixel art.png` | 1493 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/diving tackle pixel art.png` | 1615 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/get up pixel art.png` | 1492 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/outcome icons pixel art.png` | 1702 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/referee crew pixel art.png` | 1467 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/sideline equipment pixel art.png` | 1774 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/sideline gear pixel art.png` | 1623 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/sideline medical pixel art.png` | 1827 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/sideline officials pixel art.png` | 1168 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/sideline staff pixel art.png` | 1258 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/stiff arm and hurdle pixel art.png` | 1954 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/wheel hardware pixel art.png` | 1341 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/source/wheel icons pixel art.png` | 1613 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/component-sheet-01.png` | 1672 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/component-sheet-02.png` | 1810 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/component-sheet-03.png` | 1864 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/component-sheet-04.png` | 1670 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/component-sheet-05.png` | 1893 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/component-sheet-06.png` | 1712 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/component-sheet-07.png` | 1878 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/component-sheet-08.png` | 1740 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/component-sheet-09.png` | 1605 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/component-sheet-10.png` | 1771 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/legacy-sheet-01.png` | 1462 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/legacy-sheet-02.png` | 1924 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/legacy-sheet-03.png` | 1385 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `art/ui/ui-kit-sheet.png` | 2141 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `block and pancake pixel art.png` | 1704 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `catches pixel art.png` | 1777 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `cuts and jukes pixel art.png` | 1493 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `diving tackle pixel art.png` | 1615 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `get up pixel art.png` | 1492 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
| `stiff arm and hurdle pixel art.png` | 1954 KB | C2PA manifest, IPTC: trainedAlgorithmicMedia, "OpenAI" in the manifest |
