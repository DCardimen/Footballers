# NAMES — what the career app's names used to be (v149 C, "THE CODE READS")

Until v149 C the career app (`src/07-career-app.js`, the old block 7) was minifier output: 6,442
lines, the longest 30,380 characters, and every top-level name one to three letters (`o`, `q`, `M`,
`Yr`, `ms`…). v149 C did two things to it, each in its own commit and each **proven** not to change
the program:

1. **Formatted** it (and the dense `src/10-season-rosters-v158.js`) with Prettier —
   `scripts/readable/format.mjs`. 6,442 → 30,250 lines (29,950 at first; re-wrapped once more after
   the renames), longest line 30,380 → 1,760 (the long ones
   left are HTML inside template literals, whose text is output and is not touched). The proof: the
   file before and after parses (acorn) to the same tree, positions and comments ignored, with three
   spellings normalised on both sides because they are not behaviour — `a||(b||c)` vs `(a||b)||c`
   (same value, same short-circuit order), a stray `;` after a block (an `EmptyStatement`), and a
   literal's raw spelling (`'x'`/`"x"`, `.5`/`0.5` — the value is compared). Template literals keep
   their raw text in the comparison.
2. **Renamed 406 top-level bindings** of its IIFE — `scripts/readable/rename.mjs`, map in
   `scripts/readable/names.mjs` (the tables below are generated from it). Scope-aware: a binding and
   every reference that resolves to it, never a property name, never a string, never a local that
   shadows it; a rename that would capture a local or a global is refused. The proof, per batch:
   (1) the old tree with exactly those identifiers swapped **is** the new tree, and (2) every one of
   the file's identifier references resolves to the same binding (same scope, same variable) it did
   before.

**Every `window.*` name is unchanged** — they are property names, and the checks, the other `src/`
files, `public/*.js` and the inline `onclick="…"` handlers call them. So `window.go` is still `go`
(the binding behind it is now `goView`), `window.buy` is still `buy` (`buyNode`), the audit hook
`window.__GRIDIRON_AUDIT__` keeps every key (`playerOVR`, `nodeLvl`, `genContracts`…), `window.S` is
still the state getter, and `window.__RANK_V52.sn/.kr` keep their keys. Where an export name was
already descriptive, the binding took it (`fs` → `finishSeasonGames`, `Yl` → `buyNode` for
`window.buy`).

## Where the names came from

The evidence column says which of these a name rests on:

- **`module:X`** — the strongest. The bundler kept two frozen module-namespace objects, `jo` (the v11
  career systems, exported to the audit as `V11`) and `Do` (the v12 pro life, `V12`), and their keys
  are the ORIGINAL source names: `{ensureCondition: gt, createOpponentProfile: rt, netWorth: Ge, …}`.
  Those names were put back verbatim (`L` was `bounded`; it is `clamp` here because that is what every
  reader will look for).
- **`audit:X`** / **`window.X`** — the key the game already exports the function under.
- otherwise the definition, quoted.

A few names are NOT the audit's first guess, on evidence: `F` is `showToast` (a global `toast` is read
elsewhere in the file, so `toast` would have captured it); `us` is `genContracts` — docs/AUDIT.md
§1.3 says that export key is wrong, but `us` does write `player.contracts` (the season's three goals),
so the key was right; `go` (the IIFE's own) is `showNflOffersV11`, which is what the v11 export block
calls it and which ends its confusion with `window.go`.

## Translating older notes

CLAUDE.md, README.md, docs/ARCHITECTURE.md, docs/AUDIT.md, commit messages and the comments inside the
file still use the old names (`q` wrapper, `ms`/`no`, `Yr`, `Wr`'s `h()`, `mc()`, `Le`, `tt`…). Look
them up in the alphabetical list at the end. Comments inside `07` were deliberately left as they were:
they are history, and a rename that edits prose cannot be proven.

Local names inside functions (`e`, `t`, `a`, `s`, `n`…) are unchanged: they are parameters and
temporaries whose meaning is local, and renaming thousands of them by hand could not be evidenced.
About 140 short top-level names remain (of 930 bindings), each referenced one to four times; their
definitions sit next to their uses, and the same tools take more rows in `names.mjs` when one earns a name. `W1` is `wholeNum` now, `window.__W1_V101` still exports it.

## Porting a branch that still has the old names

A branch cut before v149 C edits the minified text (or the monolith). To bring it over:

```bash
npm i --no-save acorn eslint-scope prettier       # the tools' only dependencies, not the game's
git show <branch>:index.html > /tmp/mono.html      # if the branch predates the split (docs/LAYOUT.md)
node scripts/layout-split.mjs /tmp/mono.html
node scripts/readable/format.mjs                   # 07 + 10, refuses unless the program is the same
node scripts/readable/rename.mjs                   # every batch; already-applied pairs are skipped
git diff                                           # the branch's own edits, in today's names
```

`rename.mjs` refuses (and says where) if the branch added a local that a new name would capture —
rename that local, not the map.

## Checks that read the source text

A check that greps `07` must match readable text now, and should not depend on line breaks: write
`\s*` where the formatter may put a space or a newline, and use today's names. The ones v149 C moved:
`bootviewcheck` (`boot()` guarded by `safeBootV140(function (`), `v146Echeck` (`const _qV146 = render;
render = function`), `v142check` (`${ATTR_INFO[e].icon}…`, `\n\s*function statInfoBtnV142(`),
`namecheck` (`TOWNS` / `MASCOTS` / `COLLEGE_V123` / `newTeamIdentity`), `equaltalentcheck` (also its patch: `randName()`, was `Hr`) and
`v149Echeck` (`window.setSpeed` is `function setSpeed(`, was `ml`), `starimpactcheck` (their roster hook anchors on `/attrs:\s*youSimAttrs\(\),\s*stat:\s*a\s*\}\);/`).
`starimpactcheck` still loads the scripts WITHOUT `07` (as it has since v141 moved the games into the
career app), so it cannot install its hook — a pre-existing break, not v149 C's.

## The map

### Batch 1 — the core (the 61 most-referenced names)

| old | new | what it is | evidence |
|---|---|---|---|
| `o` | `state` | the whole save: {prestige, pp, tree, player, view, …} | let o=null; mc() sets o=dr()\|\|Zs(); audit:getState returns it; window.S getter |
| `f` | `clamp99` | clamp with defaults 1..99 | f=(e,t=1,a=99)=>Math.max(t,Math.min(a,e)) |
| `S` | `escHtml` | HTML-escape a value | replaces & < > " ' with entities |
| `M` | `nodeLvl` | level bought of a prestige-tree node | return o.tree&&o.tree[e]\|\|0; audit:nodeLvl |
| `x` | `byId` | document.getElementById | x=e=>document.getElementById(e) |
| `A` | `LEVELS` | the nine levels, Pee Wee → Interstellar | [{key:"peewee",name:"Pee Wee",…}]; audit:LEVELS |
| `E` | `choiceDef` | builds a decision choice record | E=(e,t,a,s,n,i,r)=>({id,label,description,risk,baseChance,success,failure}) |
| `I` | `saveGame` | persist the state | GridironStorage.save(o) / localStorage.setItem(tn,…) |
| `F` | `showToast` | show the #toast line for 1.9s | x("toast").textContent=e … setTimeout(…,1900) ('toast' itself is a global read elsewhere, so not that) |
| `L` | `clamp` | clamp(v, lo, hi) | L=(e,t,a)=>Math.max(t,Math.min(a,e)); module:bounded |
| `Le` | `ATTR_INFO` | attribute metadata (name, desc, icon, metric) | {speed:{name:"Speed",desc:"Straight-line burst",…}} |
| `D` | `randRange` | uniform float in [a, b) | D=(e,t)=>e+Math.random()*(t-e) |
| `G` | `treeFx` | sum of a named effect over the bought tree nodes | Σ ot[a].fx[e]*o.tree[a]; audit:treeFx |
| `q` | `render` | the view renderer (wrapped 11 times) | function q(){an();const e=o.view;… if(e==="menu")return Mn() …} |
| `W` | `randPick` | random element of an array | W=e=>e[Math.floor(Math.random()*e.length)] |
| `ae` | `playerOvr` | a player's OVR | return en(e.attrs,e.pos,e.body); audit:playerOVR |
| `ee` | `ATTR_KEYS` | the attribute keys | ee=Object.keys(Le); audit:ATTRS |
| `Ee` | `POSITIONS` | positions and their OVR weights | {QB:{name:"Quarterback",w:{…}}}; audit:POSITIONS |
| `z` | `formatMoney` | $…K / $…M | module:formatMoney |
| `we` | `attrCap` | the absolute attribute ceiling | return qo+G("capPlus")+Ie()*3 |
| `te` | `goView` | set the view, save, render | o.view=e,I(),q(); window.go |
| `Z` | `liveCtl` | the live playback controller | Z={idx,speed,playing,anim,t} in hl() |
| `le` | `randInt` | uniform integer in [a, b] | le=(e,t)=>Math.floor(D(e,t+1)) |
| `re` | `ensureFinanceState` | the pro life / finance state (level 7+), created on first read | module:ensureFinanceState; builds e.lifeV12 |
| `Ne` | `POS_STATS` | per-position stat lines with per-level baselines | {QB:{primary:"passYds",stats:[{key,name,per:[…]}]}} |
| `pt` | `PROGRAMS` | the offseason training programs | {balanced:{name:"Balanced Program",…}}; audit:TRAINING |
| `ot` | `TREE_NODES` | prestige node registry by key | audit:TREE_NODES |
| `ye` | `bigMoment` | the moment banner + cinema flash | x("momentBanner"), x("cinemaFlash"); window.bigMoment |
| `fe` | `seededRng` | deterministic RNG from string keys | module:seededRng |
| `Se` | `pathVal` | a value off the chosen prestige path | const a=Ci();return a&&a[e]!=null?a[e]:t\|\|0; audit:pathVal |
| `Oe` | `hasTrait` | player has a trait | e.traits.includes(t); audit:hasTrait |
| `dt` | `TRAITS` | trait definitions | {xfactor:{name:"X-Factor",…},lateBloomer:{…}} |
| `ve` | `hypeState` | o.experience95 (coach, hype, streak, stories), created on first read | o.experience95\|\|(o.experience95={coach:50,hype:18,…}) |
| `Xe` | `teamName` | the player's team name for his level | town+mascot / town+college / DFL club (v123) |
| `Re` | `ensureV11` | bring the player up to the v11 schema | audit:ensureV11 |
| `Je` | `getOrigin` | the player's origin record | It.find(t=>t.id===e.originV11); module:getOrigin |
| `Ce` | `insertAfter` | insertAdjacentHTML("afterend") | e&&t&&e.insertAdjacentHTML("afterend",t) |
| `Be` | `sample` | random element with a given rng | module:sample |
| `Ie` | `chaosTotal` | sum of the chaos dials | Σ o.chaos[t] |
| `Ve` | `leadStat` | the leaders board's selected stat key | let ze="leaders",nt=null,Ve=null; Ve=n.primary |
| `je` | `addClamped` | e[k] = clamp(e[k] + d, lo, hi) | a&&(e[t]=L((e[t]\|\|0)+a,s,n)) |
| `He` | `processWeek95` | after-week pulse (hype, coach, streak) | audit:processWeek95 |
| `Ge` | `netWorth` | cash + investments + house − debt | module:netWorth |
| `sa` | `TREE` | the prestige tree branches | audit:TREE |
| `ft` | `seasonModFx` | a value off the season modifier in force | cs.find(s=>s.key===t.seasonMod)[e] |
| `We` | `pushStory` | push a story onto the hub feed (keeps 8) | ve().stories.unshift({icon,title,deck,at}) |
| `tt` | `simSeason` | the season roll (wrapped 6 times) | audit:simSeason |
| `jt` | `fmtInt` | round and format with en-US commas | Math.round(e).toLocaleString("en-US") |
| `Pa` | `playerPower` | OVR + the gear's power | ae(e)+Ze("power") |
| `Ze` | `gearFx` | sum of an effect over equipped gear | audit:gearFx |
| `wt` | `simRemainingWeeks` | sim the rest of the season | window.simRemainingWeeks |
| `Ot` | `LIFESTYLES` | meals / recovery / luxury options | module:LIFESTYLES |
| `et` | `rollGamePerf` | the per-game performance roll (wrapped 5 times) | function et(e,t=0,a){…Pa(e)…A[e.level].need…} |
| `ze` | `leadTab` | leaders screen tab ("leaders"/"standings") | let ze="leaders" |
| `yt` | `GAME_PLANS` | the weekly game plans | [{id:"disciplined",name:"Disciplined Execution",…}] |
| `Nt` | `STORY_ARCS` | story-arc definitions | module:STORY_ARCS; window.__NtV18 |
| `ht` | `effectivePrestige` | diminishing prestige curve × prestigeEffectMult | module:effectivePrestige |
| `mt` | `PATHS` | prestige paths (The Phenom, …) | {phenom:{name:"The Phenom",…}} |
| `At` | `nodeCost` | price of the next level of a node | audit:nodeCost |
| `Ga` | `TOWNS` | the 120 invented towns (v123) | ["Fairview","Riverton",…] |
| `kt` | `newPlayer` | create a new player | audit:newPlayer |

### Batch 2 — the v11 / v12 module namespaces (original export names)

| old | new | what it is | evidence |
|---|---|---|---|
| `jo` | `V11_MODULE` | frozen namespace of the v11 career systems | Object.freeze(Object.defineProperty({…},Symbol.toStringTag,{value:"Module"})); audit:V11 |
| `Ua` | `LEGACY_OBJECTIVES` | origin objectives ("Become a Varsity starter") | module:LEGACY_OBJECTIVES |
| `Cs` | `LEGACY_UNLOCKS` | legacy-token unlocks | module:LEGACY_UNLOCKS |
| `Dn` | `MILESTONES` | legacy milestones (First Start, …) | module:MILESTONES |
| `It` | `ORIGINS` | the origin cards | module:ORIGINS |
| `Fn` | `PLAN_IDS` | game-plan ids | module:PLAN_IDS |
| `ma` | `SPECIALIZATIONS` | account specializations (Tactician, …) | module:SPECIALIZATIONS |
| `Xn` | `acceptNflOffer` | sign a pro offer | module:acceptNflOffer |
| `As` | `applyOrigin` | apply an origin to a player | module:applyOrigin |
| `Zn` | `buyLegacyUnlock` | spend legacy tokens | module:buyLegacyUnlock |
| `Is` | `careerLegacyGrade` | legacy grade of a career | module:careerLegacyGrade |
| `Vs` | `conditionModifiers` | fatigue/injury modifiers off the condition | module:conditionModifiers |
| `rt` | `createOpponentProfile` | seeded opponent profile (strength/weakness) | module:createOpponentProfile |
| `$a` | `ensureAccountState` | account-level v11 fields | module:ensureAccountState |
| `gt` | `ensureCondition` | player.conditionV11, created on first read | module:ensureCondition |
| `wa` | `ensureNflState` | player.nflStateV11 (level 7+) | module:ensureNflState |
| `ii` | `ensurePlayerState` | player-level v11 fields | module:ensurePlayerState |
| `Gt` | `ensureRival` | the role rival (roleRivalV11) | module:ensureRival |
| `js` | `evaluateLegacyObjectives` | score the origin objectives | module:evaluateLegacyObjectives |
| `Bs` | `evaluateMilestones` | score the legacy milestones | module:evaluateMilestones |
| `Jn` | `evaluateNflSeason` | pro season review | module:evaluateNflSeason |
| `Qn` | `evaluateNflWeek` | pro week review (security, waivers → v146 B strike) | module:evaluateNflWeek |
| `Na` | `generateNflOffers` | pro contract offers | module:generateNflOffers |
| `_n` | `makeHighLeverageMoments` | the in-game decision moments | module:makeHighLeverageMoments |
| `Wn` | `matchupPlanModifier` | plan vs opponent matchup effect | module:matchupPlanModifier |
| `Kn` | `maybeStartStoryArc` | story arc trigger (now `return null` — retired) | module:maybeStartStoryArc |
| `Ka` | `nflSalaryForStatus` | salary for a pro roster status | module:nflSalaryForStatus |
| `ei` | `originGrowthMultiplier` | origin growth effect | module:originGrowthMultiplier |
| `ti` | `originPerformanceModifier` | origin performance effect | module:originPerformanceModifier |
| `si` | `pathCap` | path cap on a decision chance | module:pathCap |
| `ai` | `prestigeCap` | cap on prestige-fed bonuses (see v146 C note: pointsFlat/coachStart) | module:prestigeCap |
| `ni` | `resetSeasonSystems` | reset per-season v11 state | module:resetSeasonSystems |
| `Un` | `resolveHighLeverageMoment` | resolve an in-game moment | module:resolveHighLeverageMoment |
| `Yn` | `resolveRivalWeek` | resolve the role rival's week | module:resolveRivalWeek |
| `zn` | `resolveStoryChoice` | answer a story stage | module:resolveStoryChoice |
| `qn` | `restBetweenSeasons` | the offseason rest | module:restBetweenSeasons |
| `Et` | `roleRank` | depth-role string → 0..5 | module:roleRank |
| `Gn` | `rollInjury` | the injury roll | module:rollInjury |
| `bt` | `scoutOpponent` | the scouting report on an opponent | module:scoutOpponent |
| `Es` | `selectOriginOptions` | the origin draft's cards | module:selectOriginOptions |
| `Ls` | `shuffled` | shuffled copy | module:shuffled |
| `Hn` | `updateConditionAfterGame` | fatigue/injury after a game | module:updateConditionAfterGame |
| `Do` | `V12_MODULE` | frozen namespace of the v12 pro-life systems | audit:V12 |
| `Fa` | `HOUSES` | houses | module:HOUSES |
| `ri` | `LIFE_EVENTS` | life events | module:LIFE_EVENTS |
| `Sa` | `LIFE_GOALS` | life goals | module:LIFE_GOALS |
| `oi` | `LIFE_VERSION` | life schema version (12) | module:LIFE_VERSION |
| `za` | `PORTFOLIOS` | investment portfolios | module:PORTFOLIOS |
| `Ft` | `RETIREMENT_PLANS` | retirement plans | module:RETIREMENT_PLANS |
| `ci` | `applyPendingVow` | apply a pending vow | module:applyPendingVow |
| `yi` | `buyHouse` | buy a house | module:buyHouse |
| `qs` | `canRetire` | may the player retire (v147 A: any time from level 7) | module:canRetire |
| `No` | `capDecisionChance` | cap a decision chance | module:capDecisionChance |
| `vi` | `chooseLifestyle` | set a lifestyle option | module:chooseLifestyle |
| `ki` | `contributeGoal` | put money into a life goal | module:contributeGoal |
| `xa` | `emergencyReserve` | cash reserve the finances keep | module:emergencyReserve |
| `Ws` | `ensureAccountV12` | account-level v12 fields | module:ensureAccountV12 |
| `aa` | `evaluateLifeGoals` | score the life goals | module:evaluateLifeGoals |
| `Ns` | `expectedGrade` | expected grade for a matchup | module:expectedGrade |
| `ya` | `houseById` | house record by id | module:houseById |
| `gi` | `invest` | move cash into a portfolio | module:invest |
| `Hs` | `lifeGoalById` | life goal by id | module:lifeGoalById |
| `ta` | `lifestyleEffects` | weekly cost/recovery/perf of the lifestyle | module:lifestyleEffects |
| `Ma` | `liquidInvestments` | sum of the investments | module:liquidInvestments |
| `wi` | `maybeQueueLifeEvent` | queue a life event every third week | module:maybeQueueLifeEvent |
| `Gs` | `portfolioById` | portfolio by id | module:portfolioById |
| `pi` | `processNflFinancialWeek` | pro week's money | module:processNflFinancialWeek |
| `Io` | `rawPrestigePowerRatio` | prestige power ratio | module:rawPrestigePowerRatio |
| `li` | `recoveryProjection` | recovery projection | module:recoveryProjection |
| `Ds` | `regretScenario` | what-if line on the career end | module:regretScenario |
| `$i` | `resolveLifeEvent` | answer a life event | module:resolveLifeEvent |
| `Si` | `retirePlayer` | retire the pro | module:retirePlayer |
| `ui` | `retirementAssets` | assets counted toward retirement | module:retirementAssets |
| `fi` | `retirementPlanById` | retirement plan by id | module:retirementPlanById |
| `Ht` | `retirementReadiness` | net worth vs target, ready flag | module:retirementReadiness |
| `di` | `safeAnnualIncome` | 4% of investments | module:safeAnnualIncome |
| `hi` | `setRetirementPlan` | choose a retirement plan | module:setRetirementPlan |
| `Fs` | `tunedInjuryRisk` | injury risk tuned by fatigue/age | module:tunedInjuryRisk |
| `bi` | `withdraw` | move money out of a portfolio | module:withdraw |

### Batch 3 — names the audit hook or a `window.*` export already gives

| old | new | what it is | evidence |
|---|---|---|---|
| `Zs` | `freshState` | a new empty save | audit:freshState |
| `ns` | `suggestPositions` | rank positions for a body/attrs | audit:suggestPositions |
| `as` | `genRivals` | the national rivals | audit:genRivals |
| `cr` | `devRating` | development rating | audit:devRating |
| `Hi` | `recommendTraining` | the coach's recommended program | audit:recommendTraining |
| `La` | `startSeasonGames` | build and start the season | audit:startSeasonGames; window.startSeasonGames |
| `ls` | `buildSeasonSchedule` | the season's fixtures | audit:buildSeasonSchedule |
| `dn` | `ensurePlayoffs` | open the playoffs when the regular season is done | audit:ensurePlayoffs |
| `ca` | `resolveWeekV11` | resolve a week the v11 way | audit:resolveSequentialWeekV11 |
| `qt` | `advanceChance` | promotion odds | audit:advanceChance |
| `Bt` | `maxSeasons` | seasons allowed at this level | audit:maxSeasonsAllowed |
| `ss` | `minSeasons` | seasons required at this level | audit:minSeasonsRequired |
| `na` | `advanceLevel` | move up a level | audit:advance; window.advance |
| `Vi` | `grantMilestone` | pay a level milestone | audit:grantMilestone |
| `Qs` | `prestigeStarReward` | honors earned by a career | audit:prestigeStarReward |
| `ms` | `screenGameOver` | career-end (cut) screen — also pays PP, drops gear, writes the lineage | audit:screenGameOver |
| `no` | `screenWin` | career-end (won) screen — also pays PP, drops gear, writes the lineage | audit:screenWin |
| `Za` | `SEASON_EVENTS` | season events (Rivalry Week, …) | audit:EVENTS; window.__ZaV18 |
| `Xa` | `nodeUnlocked` | node requirement met | audit:nodeUnlocked |
| `Gi` | `chooseTier` | commit to a school tier | audit:chooseTier; window.chooseTier |
| `oo` | `choosePath` | commit to a prestige path | audit:choosePath; window.choosePath |
| `ks` | `ensureV12` | bring the state up to v12 | audit:ensureV12 |
| `ds` | `rollSeasonMod` | roll the season modifier | audit:rollSeasonMod |
| `us` | `genContracts` | roll three season goals into player.contracts | audit:genContracts (sets e.contracts — the audit doc calls the name wrong, it is right) |
| `bn` | `depthChartCore` | the unwrapped depth-chart roll | const bn=ra; audit:depthChartCoreV11 |
| `ea` | `playoffRoundNames` | playoff round names by level | audit:playoffRoundNames |
| `Us` | `tierPPMult` | PP multiplier off the chosen tiers | audit:tierPPMult |
| `Ca` | `hofWings` | Hall of Fame wings owned | audit:hofWings |
| `Zt` | `posMasteryCount` | positions mastered | audit:posMasteryCount |
| `vt` | `eraMult` | 1.2^era | audit:eraMult |
| `Qa` | `chaosEarnedMult` | chaos PP multiplier by level | audit:chaosEarnedMult |
| `Yr` | `simGameV2` | the v16 emergent game engine (one game) | window.__simGameV2 |
| `Nl` | `alloc` | spend/refund a skill point | window.alloc |
| `jl` | `autoAllocKey` | auto-spend on the key stats | window.autoAllocKey |
| `Il` | `autoAllocSpread` | auto-spend across the sheet | window.autoAllocSpread |
| `Fr` | `chooseEvent` | answer a season event | window.chooseEvent |
| `$c` | `chooseGamePlan103` | pick a weekly plan | window.chooseGamePlan103 |
| `Ir` | `chooseTraining` | commit a training program | window.chooseTraining |
| `Ya` | `closeGamePlan103` | close the plan overlay | window.closeGamePlan103 |
| `Tr` | `confirmNew` | confirm a new career | window.confirmNew |
| `Gl` | `continueNFL` | continue into the pro level | window.continueNFL |
| `Vl` | `declareAdvance` | declare for the next level | window.declareAdvance |
| `Ar` | `declareFromHub` | declare from the hub | window.declareFromHub |
| `Fl` | `doneUpgrade` | leave the upgrade sheet | window.doneUpgrade |
| `fn` | `endCareer` | end the career (gameover view) | window.endCareer |
| `zr` | `equipGear` | equip an item | window.equipGear |
| `Rr` | `exportSave` | backup code | window.exportSave |
| `fs` | `finishSeasonGames` | finish the season | window.finishSeasonGames |
| `Ea` | `finishWeekGame` | finish the watched game | window.finishWeekGame |
| `Cr` | `hardReset` | erase all progress | window.hardReset |
| `Pr` | `importSave` | restore a backup code | window.importSave |
| `rs` | `pickPos` | choose a position | window.pickPos |
| `lt` | `playWeek` | play the next week | window.playWeek |
| `$t` | `prepareWeek103` | open the weekly plan overlay | window.prepareWeek103 |
| `Hl` | `prestigeReset` | legacy reset | window.prestigeReset |
| `El` | `quickSimSeason` | quick sim (unused global) | window.quickSimSeason |
| `ql` | `respecTree` | refund the tree | window.respecTree |
| `Qr` | `scrapGear` | scrap an item | window.scrapGear |
| `Ra` | `screenDynasty` | Rings & Chaos screen | window.screenDynasty |
| `Bi` | `screenHof` | Hall of Fame screen | window.screenHof |
| `ts` | `screenLocker` | the gear locker | window.screenLocker |
| `Wl` | `setBranch` | prestige branch tab | window.setBranch |
| `ir` | `setChaos` | set a chaos dial | window.setChaos |
| `Mr` | `setLeadPos` | leaders board position | window.setLeadPos |
| `xr` | `setLeadSort` | leaders board stat | window.setLeadSort |
| `rl` | `setRosterTab` | live roster tab | window.setRosterTab |
| `ml` | `setSpeed` | live play speed | window.setSpeed |
| `Sr` | `setStatsTab` | leaders/standings tab | window.setStatsTab |
| `ys` | `shopBack` | back out of the shop | window.shopBack |
| `pl` | `skipLive` | skip the live game | window.skipLive |
| `Di` | `startCareer` | start a career | window.startCareer |
| `Br` | `startSeason` | go to the training board | window.startSeason |
| `ar` | `toggleSetting` | flip a setting | window.toggleSetting |
| `il` | `watchLive` | open the live view | window.watchLive |
| `ho` | `breakthroughTakeover104` | the breakthrough takeover card | window.breakthroughTakeover104 |
| `nr` | `buyMastery` | buy a stat mastery | window.buyMastery |
| `or` | `chaosMaxAll` | max every chaos dial | window.chaosMaxAll |
| `Yl` | `buyNode` | THE one authoritative prestige purchase | window.buy |

### Batch 4 — screens, live playback, gear, tables, ranking

| old | new | what it is | evidence |
|---|---|---|---|
| `Er` | `screenHub` | the hub | x("screen").innerHTML — hub view |
| `sl` | `screenSeason` | the season screen | dn(e); the fixtures |
| `Al` | `screenResult` | the season report card | v.grade … "BREAKOUT SEASON" |
| `jr` | `screenTraining` | Choose Your Training board | "Choose Your Training" |
| `Lr` | `screenChoosePos` | position choice | ns(e.attrs,e.body) |
| `Fi` | `screenSettings` | Settings & Save | "Settings & Sa…" |
| `ps` | `screenPrestige` | the prestige tree ("What the Family Learned") | x("screen").innerHTML — the tree |
| `St` | `screenLife` | the pro life screen | level<7 → hub; re(e), Ht(e) |
| `Mn` | `screenMenuLegacy` | the old in-app menu (behind the v89 menu) | "A Football Life Simulator" hero |
| `un` | `screenUpgrade` | Train Your Player (skill points) | "Train Your Player" |
| `io` | `screenPath` | Choose Your Legend (prestige path) | "Choose Your Legend" |
| `os` | `screenLeaders` | leaders / standings | ze, nt, Ve; Ni(…) |
| `hl` | `startLivePlayback` | start the live game | Z={idx:-1,speed,playing:!0,…} |
| `Ia` | `liveTick` | one live-playback step | Z.idx++ … requestAnimationFrame(()=>Ia()) |
| `to` | `endLive` | tear down the live game | cancelAnimationFrame(Z.anim), Z=null, Ea() |
| `ln` | `dropGear` | roll and store a gear drop | o.inventory.push(Kr(e)) |
| `Kr` | `rollGear` | roll a gear item | rarity weights off ba |
| `ba` | `RARITIES` | gear rarities | [{key:"common",…},{key:"rare",…}] |
| `on` | `GEAR_SLOTS` | gear slots | [{key:"cleats"},{key:"gloves"},{key:"chain"}] |
| `rn` | `GEAR_EFFECTS` | gear effect kinds | [{key:"power"},{key:"perfFlat"},{key:"ppMult"},…] |
| `ka` | `rarityIndex` | index of an item's rarity | ba.findIndex(t=>t.key===e.rarity) |
| `es` | `completeChallenges` | pay the account challenges | audit:completeChallengesV134 |
| `zt` | `CHALLENGES` | account challenges (v134 goals) | [{id:"ring",pp,check},…] |
| `sn` | `nationalRank` | national/position rank | NAT_POOL, POS_POOL; window.__RANK_V52.sn |
| `mc` | `boot` | load the save and migrate it | o=dr()\|\|Zs(); o.tree\|\|(o.tree={}); … |
| `dr` | `loadSave` | read the save | GridironStorage.load() / localStorage.getItem(tn) |
| `tn` | `SAVE_KEY` | localStorage key | tn="gridiron_save_v1" |
| `cs` | `SEASON_MODS` | season modifiers | [{key:"passRen",name:"Passing Renaissance",…}] |
| `Ui` | `enshrineHof` | add a career to the Hall of Fame | o.hof.push({name,pos,peak,…}) |
| `Ys` | `TIERS` | school tiers per level | {varsity:[{key:"power",name:"Powerhouse HS",…}]} |
| `_s` | `tiersFor` | tiers for a level key | Ys[e]\|\|null |
| `Kt` | `currentTier` | the chosen tier at this level | Ys[t].find(s=>s.key===e.tiers[t]) |
| `Rn` | `ERA_NAMES` | era names | ["ROOKIE ERA","THE ASCENSION",…] |
| `nn` | `eraName` | name of the current era | Rn[o.era] |
| `Co` | `hashFnv1a` | FNV-1a string hash | 2166136261 … Math.imul(t,16777619) |
| `Po` | `RngCore` | the seeded generator class seededRng wraps | class Po{state;next(){…}between(){…}integer(){…}} |
| `Ei` | `mulberry32` | mulberry32 PRNG | e=(e+1831565813)\|0 … Math.imul(e^e>>>15,1\|e) |
| `Lo` | `OPP_STRENGTHS` | opponent strengths | [["Relentless pass rush","disciplined","explosive"],…] |
| `ja` | `OPP_WEAKNESSES` | opponent weaknesses | [["Slow linebackers in space","explosive"],…] |
| `Ta` | `POS_BODY` | ideal height/weight per position | {QB:{h:[75,4],w:[225,25],…}} |
| `Uo` | `bodyFit` | how well a body fits a position (0..1) | height/weight distance off Ta[t] |
| `pa` | `physFit` | body fit as a ± score | Math.round((Uo(e,t)-.6)*35) |
| `Ti` | `perfScale` | production scale off a perf number | Math.pow(Math.max(e,6)/60,2.15) |
| `Oi` | `allStatDefs` | every stat line, de-duplicated across positions | Object.entries(Ne) … e[n.key].pos.push(a) |
| `Ni` | `genNationalLeaders` | the generated top 25 for a stat | Ei(seed) … for(l<25) |
| `wr` | `seasonPaceLine` | the player's season line at pace | is(e.pos, avg perf, e.level) |
| `br` | `eliteScore` | production vs the level's elite line | (a/(n*s)-.45)/eliteSlopeV125(e,t) |
| `kr` | `prodRankFor` | national rank from production | window.__RANK_V52.kr |
| `Wr` | `buildGameRosters` | the two elevens for a sim game (v141: every sheet key) | l=["QB","RB","RB","WR",…], d=["DL",…] |
| `qr` | `youSimAttrs` | the you-player's sheet as FieldSim agent keys (v141) | simScaleV141 over a.attrs; __V141.rosterKeys |
| `xn` | `jerseyNum` | a jersey number for a position | {QB:[1,19],RB:[20,49],…} |
| `gs` | `gamePlanOverlay` | the weekly-plan overlay markup | '<div class="game…' inserted by $t |
| `bs` | `gamePlanOverlayV11` | the v11 weekly-plan overlay (with scouting) | bt(s.opponentV11,…) inserted by the v11 prepareWeek |

### Batch 5 — the rest of the frequency list, by evidence

| old | new | what it is | evidence |
|---|---|---|---|
| `at` | `ensureWeekly103` | the v103 weekly-loop fields | momentum103, composure103, roleBattle103, … |
| `Yt` | `startWeek` | start the next week (sit-out, pro offers) | findIndex(n=>!n.played); mustSitV18 |
| `it` | `chaosPPMult` | PP multiplier off chaos | 3*Math.pow(1.16,e)*(1+G("chaosPP")) |
| `zs` | `fmtHeight` | inches → 6'2" | Math.floor(e/12)+"'"+e%12+'"' |
| `nt` | `leadPos` | leaders board position | let ze="leaders",nt=null |
| `Da` | `eventReq` | season-event requirement (+22 a level) | Math.round(e+t*22) |
| `er` | `MASCOTS` | the 88 mascots (v123) | ["Bulldogs","Mustangs",…] |
| `ut` | `settingOn` | a settings flag | o.settings&&o.settings[e]\|\|!1 |
| `Vt` | `fmtLeadVal` | leaders board value | Math.round(+t) |
| `ct` | `pathPointAt` | interpolate a keyframed path at time t | {t,x,y} keyframes |
| `Qe` | `allocSpent` | points spent per attribute this visit | Qe[e]=(Qe[e]\|\|0)+1 |
| `Q2` | `allocCosts` | stack of what each point cost (for refunds) | (Q2[e]=Q2[e]\|\|[]).push(c) |
| `Wt` | `gamePlanById` | weekly plan by id | yt.find(t=>t.id===e)\|\|yt[0] |
| `Dt` | `randOppName` | a random opponent name for the level | COMBINE FIELD / DFL club / town+college / mascot |
| `cl` | `liveBoxLine` | the live box line for a position | case "QB": [["C/ATT",…],["YDS",…]] |
| `Lt` | `lifeTab` | the life screen tab | let Lt="overview" |
| `Jt` | `chaosCap` | the chaos cap | o.chaosCap\|\|0 |
| `Xt` | `PATH_HONORS` | honors needed to choose a path | const Xt=6; o.prestige>=Xt |
| `Ji` | `liveStatCols` | stat columns per position (live roster) | case "QB": [["pass","PASS YDS"],…] |
| `Ut` | `branchTab` | the prestige tree's open branch | let Ut="physical" |
| `oa` | `ensureDepth` | coach trust / depth fields | coachTrust, depthRole, snapShare, … |
| `ra` | `depthChart` | the depth-chart roll (FIRST STRING … BENCH) | a>=16?"FIRST STRING":… |
| `mn` | `ageProfile` | development profile by age | {key:"child",name:"YOUTH DEVELOPMENT",…} |
| `la` | `ensureWorld` | decision queue, arcs, world state | decisionQueue, careerArcs, worldState, … |
| `Os` | `ensureStoryState` | story queue fields | storyDecisionQueueV11, storyArcHistoryV11, … |
| `Ks` | `chaosOppBoost` | what chaos adds to the opponents | 22+e*1.05+…+G("chaosEnemy") |
| `ga` | `playSfx` | a synthesised sound | AudioContext oscillator; {tap,good,big,bad} |
| `is` | `prodStats` | a stat line for a perf (v147 C gear production) | Ne[e].stats … per[a] |
| `Ha` | `baselineStats` | the stat line at perf 60, no gear | return is(e,60,t,1) |
| `ha` | `toggleRow` | a settings toggle row | onclick="toggleSetting(…)" |
| `Aa` | `decorateScreen` | post-render hub/season decorations | .pulse-card, .story-feed |
| `va` | `nflSurvivalCard` | the UFF roster survival card | class="card nfl-survival-v11" |
| `Ja` | `masteryLvl` | stat mastery level | o.mastery[e]\|\|0 |
| `Mi` | `masteryCost` | next mastery price | 1+Math.floor(Ja(e)/3) |
| `_o` | `masteryMult` | mastery effect on a stat | 1+.08*t / 1+.04*t / 1-.06*t |
| `Ts` | `MASTERY_MAX` | mastery levels per stat | const Ts=10 |
| `Xs` | `newTeamIdentity` | town + mascot + pro club | {town:W(Ga),mascot:W(er),dfl:…} |
| `en` | `calcOvr` | OVR from attrs, position and body | Σ attrs[d]*Ee[t].w[d] |
| `an` | `syncCounters` | refresh the header counters | x("prestigeCount"), x("ppCount") |
| `qa` | `renderLiveRoster` | the live roster box | x("rosterBox") |
| `vs` | `branchNodesHtml` | a branch's node cards | sa[e].nodes.map(…) |
| `Jr` | `seasonModStatProd` | the season modifier's statProd | cs.find(…).statProd |
| `qo` | `ATTR_HARD_CAP` | the attribute cap before bonuses (999) | qo=999; we()=qo+… |
| `Sn` | `toastTimer` | the toast's timeout handle | clearTimeout(Sn),Sn=setTimeout(…,1900) |
| `Ki` | `madePlayoffs` | win share ≥ 60% | t>0&&e/t>=.6 |
| `Ci` | `currentPath` | the chosen prestige path | o.path?mt[o.path]:null |
| `ro` | `hubHeadline` | the hub's headline pair | '${n} can't stop winning' … |
| `Kl` | `storyFeedHtml` | Career Headlines feed | "Career Headlines" … story-feed |

### Batch 6 — the v11/v12 window export blocks, and the long tail by definition

| old | new | what it is | evidence |
|---|---|---|---|
| `Vc` | `chooseOriginV11` | pick an origin card | Object.assign(window,{chooseOriginV11: Vc}) |
| `Bc` | `chooseSpecializationV11` | pick a specialization | window.chooseSpecializationV11 |
| `Nc` | `chooseGamePlanV11` | pick the weekly plan (v135: opens the wizard) | window.chooseGamePlanV11 |
| `Dc` | `resolveMomentV11` | answer an in-game moment | window.resolveMomentV11 |
| `Uc` | `resolveStoryChoiceV11` | answer a story stage | window.resolveStoryChoiceV11 |
| `go` | `showNflOffersV11` | the pro offers overlay (NOT window.go — that is goView) | window.showNflOffersV11 |
| `Wc` | `acceptNflOfferV11` | sign an offer | window.acceptNflOfferV11 |
| `Yc` | `declineNflOffersV11` | decline the offers | window.declineNflOffersV11 |
| `Xc` | `showPositionChangeV11` | the position-change overlay | window.showPositionChangeV11 |
| `Zc` | `changePositionV11` | change position | window.changePositionV11 |
| `id` | `buyLegacyUnlockV11` | spend legacy tokens (button) | window.buyLegacyUnlockV11 |
| `hd` | `chooseRegretVowV12` | answer the regret vow | window.chooseRegretVowV12 |
| `vd` | `setLifeTabV12` | life screen tab | window.setLifeTabV12 |
| `yd` | `showLifeV12` | open the life screen | window.showLifeV12 |
| `gd` | `chooseLifestyleV12` | lifestyle button | window.chooseLifestyleV12 |
| `bd` | `setRetirementPlanV12` | retirement plan button | window.setRetirementPlanV12 |
| `kd` | `buyHouseV12` | buy-house button | window.buyHouseV12 |
| `wd` | `investV12` | invest button | window.investV12 |
| `$d` | `withdrawV12` | withdraw button | window.withdrawV12 |
| `Sd` | `fundGoalV12` | fund-goal button | window.fundGoalV12 |
| `Md` | `retireV12` | retire (v147 A: retireNowV147 → this) | window.retireV12 |
| `Td` | `resolveLifeEventV12` | life event button | window.resolveLifeEventV12 |
| `W1` | `wholeNum` | round to a whole number, 0 for non-finite (v101 WHOLE NUMBERS) | Number.isFinite(n)?Math.round(n):0; window.__W1_V101 |
| `_a` | `statColor` | red / blue / green / gold for a value | e<35?"#ff6b72":e>68?…:"#f0bb45" |
| `ws` | `lifestyleById` | lifestyle option by category and id | Ot[e].find(a=>a.id===t)\|\|Ot[e][0] |
| `Ri` | `bodyLabel` | "Massive" / "Big" / … for a body | e.weight>=290?"Massive":… |
| `Js` | `objectivesDone` | objectives completed on the account | o.objectivesCompleted\|\|0 |
| `Xo` | `FIRST_NAMES` | player first names (also the son's, v136) | name: W(Xo)+" "+W(Zo) |
| `Zo` | `LAST_NAMES` | player surnames | name: W(Xo)+" "+W(Zo) |
| `Qo` | `RIVAL_FIRST` | national rivals' first names | genRivals: W(Qo)+" "+W(Jo) |
| `Jo` | `RIVAL_LAST` | national rivals' surnames | genRivals: W(Qo)+" "+W(Jo) |
| `Rs` | `NEMESIS_FIRST` | nemesis first names | _i: e.nemesis={name:W(Rs)+" "+W(Ps)} |
| `Ps` | `NEMESIS_LAST` | nemesis surnames | _i: e.nemesis={name:W(Rs)+" "+W(Ps)} |
| `_i` | `rollNemesis` | give the player a nemesis | e.nemesis={name,pos,beaten:0} |
| `Dr` | `ROSTER_FIRST` | team-mate first names | Hr(): W(Dr)+" "+W(Gr) |
| `Gr` | `ROSTER_LAST` | team-mate surnames | Hr(): W(Dr)+" "+W(Gr) |
| `Hr` | `randName` | a random team-mate name | return W(Dr)+" "+W(Gr) |
| `Zr` | `NEMESIS_TAUNTS` | what the nemesis says about you | ["says you peaked in Pee Wee.",…] |
| `el` | `nemesisBanner` | the nemesis banner | '<div class="nem-banner">😈 …' |
| `$s` | `ovrTier` | OVR → {label, color} | e>=180?{label:"GALAXY-CLASS",…} |
| `Vr` | `attrRow` | one row of the hub's attribute sheet (v142 ⓘ) | W1(t.attrs[e]), t.lastGains[e] |
| `gn` | `planColor` | colour of a plan id | e==="disciplined"?"#8ec3ee":… |
| `Ms` | `originCard` | the origin card on the hub | '<div class="card origi…' |
| `yo` | `fmtMoneyShort` | $…K / $…M, no sign | e>=1e6?"$"+Math.round(e/1e6)+"M":… |
| `xs` | `lifeChoiceBtn` | a life choice button | '<button class="life-choice-v12 …' |
| `wn` | `INJURIES` | injury table (name, min, max weeks, weight) | [["Ankle sprain",1,2,.18],…] |
| `mi` | `taxRate` | tax rate by salary bracket | e<=1e6?.36:e<=3e6?.405:… |
| `Ho` | `tierGrowth` | the tier's growth multiplier | Kt(e).growth |
| `Go` | `tierComp` | the tier's competition multiplier | Kt(e).comp |
| `Ic` | `planStreak` | how many weeks in a row a plan was chosen | for(s of e.planHistoryV11)if(s===t)a++;else break |
| `pn` | `weeklyLoopCard` | the weekly-loop card | '<div class="card weekly-loop-card">' |
| `tr` | `ovrGradeClass` | OVR → g-elite / g-hi / g-mid / g-lo | e>=200?"g-elite":… |
| `ji` | `haptic` | navigator.vibrate if haptics are on | ut("haptics")&&navigator.vibrate |
| `Tn` | `gearPowerBonus` | the gear's power as a whole number | Math.max(0,Math.round(Ze("power"))) |
| `Wi` | `nextEraChaos` | chaos needed for the next era | (o.era\|\|0)*15 |
| `_r` | `tryNextEra` | advance the era if the chaos is there | Ie()>=Wi()…o.era++ |
| `Yi` | `seasonModBanner` | the season modifier banner | cs.find(a=>a.key===e.seasonMod) → html |
| `zi` | `rosterSide` | live roster tab ("us"/"opp") | let zi="us"; setRosterTab |
| `Qi` | `renderLiveBox` | the live box score | x("fullBox").innerHTML |
| `Pn` | `routePath` | waypoints of a named route | case "slant": [{x,y},…] |
| `Cn` | `pickRoute` | a route for a distance | e<=5?W(["slant","drag","curl"]):… |
| `Ln` | `gradeColor` | colour of a letter grade | e[0]==="A"?"var(--good)":… |
| `En` | `depthCard` | the depth-chart card | '<div class="card depth-card …' |
| `Qt` | `RETIRE_AGE` | base retirement age (v134: retireAgeV134 adds longevity) | const Qt=45; retireAgeV134=()=>Qt+M("longevity") |
| `An` | `ageCard` | the age-curve card | '<div class="card age-card">' |
| `dc` | `ageYear` | a year of age on the sheet (v139 ageCutV139 inside) | window.__ageV139.year → dc(e,t); wraps simSeason |
| `uo` | `processWeek95Core` | processWeek95 as it was before the v11 wrapper | const uo=He; He=function… |
| `po` | `playWeekCore` | playWeek as it was before the v103 wrapper | const po=lt |
| `mo` | `scoutCard` | the scouting card for a week | a.scouted\|\|bt(a,t,…) |
| `Nn` | `retirementCard` | the retirement-readiness card | Ht(e) → html |
| `wo` | `financeCard` | the finance summary card | re(e), Ht(e), ta(e) → html |
| `ko` | `storyOverlay` | the story decision overlay | '<div class="decision-overlay story-overlay-v11">' |
| `jn` | `storyArcCard` | the active story arc card | e.activeStoryArcV11, storyArcHistoryV11 |
| `sr` | `MILESTONE_PP` | PP per level milestone | Vi: sr[e]*(1+G("mileMult")) |
| `vr` | `ADVANCE_BASE` | base promotion odds by level | qt: vr[i] |
| `Ko` | `chaosUnlockReady` | Chaos Mode unlock condition | level>=7 && peak>=85 && Js()>=20 |
| `zo` | `chaosUnlockReq` | Chaos Mode unlock copy | 'UFF title · 85 OVR … · 20 objectives' |
| `Wo` | `chaosMaxed` | chaos at the cap | Ie()>=Jt() |
| `Or` | `screenTier` | choose a school tier | _s(t.key) → the tier cards |
| `Nr` | `screenEvent` | the season event screen (v136 A defers the rivalry) | Za.find(s=>s.id===e.pendingEvent) |
| `Ur` | `GEAR_ADJECTIVES` | gear name adjectives by rarity | {common:["Worn","Standard",…],…} |
| `tl` | `hofScore` | Hall of Fame score of a career | e.peak*2+e.power*.5+e.titles*15+… |
| `Ai` | `rollTraits` | the starting traits | Object.keys(dt) good / bad → pick |
| `Eo` | `OPP_TENDENCIES` | opponent scheme tendencies | ["Disguises pressure until the snap",…] |
| `Vo` | `SCOUT_NOTES` | scouting notes | ["Excellent practice player",…] |
| `so` | `refreshAllocButtons` | enable/disable the +/- buttons on the skills sheet | x("plus-"+a), x("minus-"+a) |
| `hr` | `showTutorial` | the first-run tutorial cards | if(o.tutorialSeen)return; "BUILD THE PLAYER" |

### Alphabetical, old → new

`_a`→`statColor` · `_i`→`rollNemesis` · `_n`→`makeHighLeverageMoments` · `_o`→`masteryMult` · `_r`→`tryNextEra` · `_s`→`tiersFor` · `$a`→`ensureAccountState` · `$c`→`chooseGamePlan103` · `$d`→`withdrawV12` · `$i`→`resolveLifeEvent` · `$s`→`ovrTier` · `$t`→`prepareWeek103` · `A`→`LEVELS` · `aa`→`evaluateLifeGoals` · `Aa`→`decorateScreen` · `ae`→`playerOvr` · `ai`→`prestigeCap` · `Ai`→`rollTraits` · `Al`→`screenResult` · `an`→`syncCounters` · `An`→`ageCard` · `ar`→`toggleSetting` · `Ar`→`declareFromHub` · `as`→`genRivals` · `As`→`applyOrigin` · `at`→`ensureWeekly103` · `At`→`nodeCost` · `ba`→`RARITIES` · `Bc`→`chooseSpecializationV11` · `bd`→`setRetirementPlanV12` · `Be`→`sample` · `bi`→`withdraw` · `Bi`→`screenHof` · `bn`→`depthChartCore` · `br`→`eliteScore` · `Br`→`startSeason` · `bs`→`gamePlanOverlayV11` · `Bs`→`evaluateMilestones` · `bt`→`scoutOpponent` · `Bt`→`maxSeasons` · `ca`→`resolveWeekV11` · `Ca`→`hofWings` · `Ce`→`insertAfter` · `ci`→`applyPendingVow` · `Ci`→`currentPath` · `cl`→`liveBoxLine` · `Cn`→`pickRoute` · `Co`→`hashFnv1a` · `cr`→`devRating` · `Cr`→`hardReset` · `cs`→`SEASON_MODS` · `Cs`→`LEGACY_UNLOCKS` · `ct`→`pathPointAt` · `D`→`randRange` · `Da`→`eventReq` · `dc`→`ageYear` · `Dc`→`resolveMomentV11` · `di`→`safeAnnualIncome` · `Di`→`startCareer` · `dn`→`ensurePlayoffs` · `Dn`→`MILESTONES` · `Do`→`V12_MODULE` · `dr`→`loadSave` · `Dr`→`ROSTER_FIRST` · `ds`→`rollSeasonMod` · `Ds`→`regretScenario` · `dt`→`TRAITS` · `Dt`→`randOppName` · `E`→`choiceDef` · `ea`→`playoffRoundNames` · `Ea`→`finishWeekGame` · `ee`→`ATTR_KEYS` · `Ee`→`POSITIONS` · `ei`→`originGrowthMultiplier` · `Ei`→`mulberry32` · `el`→`nemesisBanner` · `El`→`quickSimSeason` · `en`→`calcOvr` · `En`→`depthCard` · `Eo`→`OPP_TENDENCIES` · `er`→`MASCOTS` · `Er`→`screenHub` · `es`→`completeChallenges` · `Es`→`selectOriginOptions` · `et`→`rollGamePerf` · `Et`→`roleRank` · `f`→`clamp99` · `F`→`showToast` · `Fa`→`HOUSES` · `fe`→`seededRng` · `fi`→`retirementPlanById` · `Fi`→`screenSettings` · `Fl`→`doneUpgrade` · `fn`→`endCareer` · `Fn`→`PLAN_IDS` · `Fr`→`chooseEvent` · `fs`→`finishSeasonGames` · `Fs`→`tunedInjuryRisk` · `ft`→`seasonModFx` · `Ft`→`RETIREMENT_PLANS` · `G`→`treeFx` · `ga`→`playSfx` · `Ga`→`TOWNS` · `gd`→`chooseLifestyleV12` · `Ge`→`netWorth` · `gi`→`invest` · `Gi`→`chooseTier` · `Gl`→`continueNFL` · `gn`→`planColor` · `Gn`→`rollInjury` · `go`→`showNflOffersV11` · `Go`→`tierComp` · `Gr`→`ROSTER_LAST` · `gs`→`gamePlanOverlay` · `Gs`→`portfolioById` · `gt`→`ensureCondition` · `Gt`→`ensureRival` · `ha`→`toggleRow` · `Ha`→`baselineStats` · `hd`→`chooseRegretVowV12` · `He`→`processWeek95` · `hi`→`setRetirementPlan` · `Hi`→`recommendTraining` · `hl`→`startLivePlayback` · `Hl`→`prestigeReset` · `Hn`→`updateConditionAfterGame` · `ho`→`breakthroughTakeover104` · `Ho`→`tierGrowth` · `hr`→`showTutorial` · `Hr`→`randName` · `Hs`→`lifeGoalById` · `ht`→`effectivePrestige` · `Ht`→`retirementReadiness` · `I`→`saveGame` · `Ia`→`liveTick` · `Ic`→`planStreak` · `id`→`buyLegacyUnlockV11` · `Ie`→`chaosTotal` · `ii`→`ensurePlayerState` · `il`→`watchLive` · `Il`→`autoAllocSpread` · `io`→`screenPath` · `Io`→`rawPrestigePowerRatio` · `ir`→`setChaos` · `Ir`→`chooseTraining` · `is`→`prodStats` · `Is`→`careerLegacyGrade` · `it`→`chaosPPMult` · `It`→`ORIGINS` · `ja`→`OPP_WEAKNESSES` · `Ja`→`masteryLvl` · `je`→`addClamped` · `Je`→`getOrigin` · `ji`→`haptic` · `Ji`→`liveStatCols` · `jl`→`autoAllocKey` · `jn`→`storyArcCard` · `Jn`→`evaluateNflSeason` · `jo`→`V11_MODULE` · `Jo`→`RIVAL_LAST` · `jr`→`screenTraining` · `Jr`→`seasonModStatProd` · `js`→`evaluateLegacyObjectives` · `Js`→`objectivesDone` · `jt`→`fmtInt` · `Jt`→`chaosCap` · `ka`→`rarityIndex` · `Ka`→`nflSalaryForStatus` · `kd`→`buyHouseV12` · `ki`→`contributeGoal` · `Ki`→`madePlayoffs` · `Kl`→`storyFeedHtml` · `Kn`→`maybeStartStoryArc` · `ko`→`storyOverlay` · `Ko`→`chaosUnlockReady` · `kr`→`prodRankFor` · `Kr`→`rollGear` · `ks`→`ensureV12` · `Ks`→`chaosOppBoost` · `kt`→`newPlayer` · `Kt`→`currentTier` · `L`→`clamp` · `la`→`ensureWorld` · `La`→`startSeasonGames` · `le`→`randInt` · `Le`→`ATTR_INFO` · `li`→`recoveryProjection` · `ln`→`dropGear` · `Ln`→`gradeColor` · `Lo`→`OPP_STRENGTHS` · `Lr`→`screenChoosePos` · `ls`→`buildSeasonSchedule` · `Ls`→`shuffled` · `lt`→`playWeek` · `Lt`→`lifeTab` · `M`→`nodeLvl` · `ma`→`SPECIALIZATIONS` · `Ma`→`liquidInvestments` · `mc`→`boot` · `Md`→`retireV12` · `mi`→`taxRate` · `Mi`→`masteryCost` · `ml`→`setSpeed` · `mn`→`ageProfile` · `Mn`→`screenMenuLegacy` · `mo`→`scoutCard` · `Mr`→`setLeadPos` · `ms`→`screenGameOver` · `Ms`→`originCard` · `mt`→`PATHS` · `na`→`advanceLevel` · `Na`→`generateNflOffers` · `Nc`→`chooseGamePlanV11` · `Ne`→`POS_STATS` · `ni`→`resetSeasonSystems` · `Ni`→`genNationalLeaders` · `Nl`→`alloc` · `nn`→`eraName` · `Nn`→`retirementCard` · `no`→`screenWin` · `No`→`capDecisionChance` · `nr`→`buyMastery` · `Nr`→`screenEvent` · `ns`→`suggestPositions` · `Ns`→`expectedGrade` · `nt`→`leadPos` · `Nt`→`STORY_ARCS` · `o`→`state` · `oa`→`ensureDepth` · `Oe`→`hasTrait` · `oi`→`LIFE_VERSION` · `Oi`→`allStatDefs` · `on`→`GEAR_SLOTS` · `oo`→`choosePath` · `or`→`chaosMaxAll` · `Or`→`screenTier` · `os`→`screenLeaders` · `Os`→`ensureStoryState` · `ot`→`TREE_NODES` · `Ot`→`LIFESTYLES` · `pa`→`physFit` · `Pa`→`playerPower` · `pi`→`processNflFinancialWeek` · `pl`→`skipLive` · `pn`→`weeklyLoopCard` · `Pn`→`routePath` · `po`→`playWeekCore` · `Po`→`RngCore` · `Pr`→`importSave` · `ps`→`screenPrestige` · `Ps`→`NEMESIS_LAST` · `pt`→`PROGRAMS` · `q`→`render` · `Q2`→`allocCosts` · `qa`→`renderLiveRoster` · `Qa`→`chaosEarnedMult` · `Qe`→`allocSpent` · `Qi`→`renderLiveBox` · `ql`→`respecTree` · `qn`→`restBetweenSeasons` · `Qn`→`evaluateNflWeek` · `qo`→`ATTR_HARD_CAP` · `Qo`→`RIVAL_FIRST` · `qr`→`youSimAttrs` · `Qr`→`scrapGear` · `qs`→`canRetire` · `Qs`→`prestigeStarReward` · `qt`→`advanceChance` · `Qt`→`RETIRE_AGE` · `ra`→`depthChart` · `Ra`→`screenDynasty` · `re`→`ensureFinanceState` · `Re`→`ensureV11` · `ri`→`LIFE_EVENTS` · `Ri`→`bodyLabel` · `rl`→`setRosterTab` · `rn`→`GEAR_EFFECTS` · `Rn`→`ERA_NAMES` · `ro`→`hubHeadline` · `Rr`→`exportSave` · `rs`→`pickPos` · `Rs`→`NEMESIS_FIRST` · `rt`→`createOpponentProfile` · `S`→`escHtml` · `sa`→`TREE` · `Sa`→`LIFE_GOALS` · `Sd`→`fundGoalV12` · `Se`→`pathVal` · `si`→`pathCap` · `Si`→`retirePlayer` · `sl`→`screenSeason` · `sn`→`nationalRank` · `Sn`→`toastTimer` · `so`→`refreshAllocButtons` · `sr`→`MILESTONE_PP` · `Sr`→`setStatsTab` · `ss`→`minSeasons` · `St`→`screenLife` · `ta`→`lifestyleEffects` · `Ta`→`POS_BODY` · `Td`→`resolveLifeEventV12` · `te`→`goView` · `ti`→`originPerformanceModifier` · `Ti`→`perfScale` · `tl`→`hofScore` · `tn`→`SAVE_KEY` · `Tn`→`gearPowerBonus` · `to`→`endLive` · `tr`→`ovrGradeClass` · `Tr`→`confirmNew` · `ts`→`screenLocker` · `Ts`→`MASTERY_MAX` · `tt`→`simSeason` · `Ua`→`LEGACY_OBJECTIVES` · `Uc`→`resolveStoryChoiceV11` · `ui`→`retirementAssets` · `Ui`→`enshrineHof` · `un`→`screenUpgrade` · `Un`→`resolveHighLeverageMoment` · `uo`→`processWeek95Core` · `Uo`→`bodyFit` · `Ur`→`GEAR_ADJECTIVES` · `us`→`genContracts` · `Us`→`tierPPMult` · `ut`→`settingOn` · `Ut`→`branchTab` · `va`→`nflSurvivalCard` · `Vc`→`chooseOriginV11` · `vd`→`setLifeTabV12` · `ve`→`hypeState` · `Ve`→`leadStat` · `vi`→`chooseLifestyle` · `Vi`→`grantMilestone` · `Vl`→`declareAdvance` · `Vo`→`SCOUT_NOTES` · `vr`→`ADVANCE_BASE` · `Vr`→`attrRow` · `vs`→`branchNodesHtml` · `Vs`→`conditionModifiers` · `vt`→`eraMult` · `Vt`→`fmtLeadVal` · `W`→`randPick` · `W1`→`wholeNum` · `wa`→`ensureNflState` · `Wc`→`acceptNflOfferV11` · `wd`→`investV12` · `we`→`attrCap` · `We`→`pushStory` · `wi`→`maybeQueueLifeEvent` · `Wi`→`nextEraChaos` · `Wl`→`setBranch` · `wn`→`INJURIES` · `Wn`→`matchupPlanModifier` · `wo`→`financeCard` · `Wo`→`chaosMaxed` · `wr`→`seasonPaceLine` · `Wr`→`buildGameRosters` · `ws`→`lifestyleById` · `Ws`→`ensureAccountV12` · `wt`→`simRemainingWeeks` · `Wt`→`gamePlanById` · `x`→`byId` · `xa`→`emergencyReserve` · `Xa`→`nodeUnlocked` · `Xc`→`showPositionChangeV11` · `Xe`→`teamName` · `xn`→`jerseyNum` · `Xn`→`acceptNflOffer` · `Xo`→`FIRST_NAMES` · `xr`→`setLeadSort` · `xs`→`lifeChoiceBtn` · `Xs`→`newTeamIdentity` · `Xt`→`PATH_HONORS` · `ya`→`houseById` · `Ya`→`closeGamePlan103` · `Yc`→`declineNflOffersV11` · `yd`→`showLifeV12` · `ye`→`bigMoment` · `yi`→`buyHouse` · `Yi`→`seasonModBanner` · `Yl`→`buyNode` · `Yn`→`resolveRivalWeek` · `yo`→`fmtMoneyShort` · `Yr`→`simGameV2` · `ys`→`shopBack` · `Ys`→`TIERS` · `yt`→`GAME_PLANS` · `Yt`→`startWeek` · `z`→`formatMoney` · `Z`→`liveCtl` · `za`→`PORTFOLIOS` · `Za`→`SEASON_EVENTS` · `Zc`→`changePositionV11` · `ze`→`leadTab` · `Ze`→`gearFx` · `zi`→`rosterSide` · `zn`→`resolveStoryChoice` · `Zn`→`buyLegacyUnlock` · `zo`→`chaosUnlockReq` · `Zo`→`LAST_NAMES` · `zr`→`equipGear` · `Zr`→`NEMESIS_TAUNTS` · `zs`→`fmtHeight` · `Zs`→`freshState` · `zt`→`CHALLENGES` · `Zt`→`posMasteryCount`
