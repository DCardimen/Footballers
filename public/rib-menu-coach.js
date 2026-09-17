(() => {
  'use strict';
  /* ===== v119 THE COACH'S TOUR — the guide, said out loud =====
   * A talking-head walkthrough of the whole game, driven by a switch on the main menu. The coach
   * is the three uploaded sheets cut into public/coach/ (build-coach-art.py): fifteen poses, each
   * drawn mouth-closed (`_a`) and mouth-open (`_b`), and a line of dialogue TYPES while the mouth
   * flips between the two — that is the whole talking trick. The tour dims the page behind him
   * (the menu stays there, readable, so the thing he is talking about is on screen) and can cut a
   * spotlight into that dim over a menu element: the CAREER tile, the prestige button, the guide.
   *
   * What it says is the HOW TO PLAY guide (rib-menu-howto.js), section by section, in a football
   * coach's voice: every number is the guide's own; nothing here is invented, it is the same
   * facts with a whistle round its neck. Twelve chapters — kickoff, the nine sections of the guide,
   * the menu itself, the final whistle — eight to nine minutes at the default pace; tapping the bubble
   * finishes a line early, NEXT skips the hold, SKIP leaves.
   *
   * The switch (`rib9-tile-coach`, data-rib-action="coach") is the door. ON means: the tour plays
   * the moment it is switched on, and — on a FIRST VISIT — right after the game's own three
   * welcome cards (`.onboard`, `#onNext`) are clicked through. Those cards had been buried under
   * the v89 menu overlay (z-index 190 against 9999) since the menu arrived, so nobody ever saw
   * them; v119 lifts them above it, and the coach follows them. A fresh install starts ON. The
   * tour switches itself OFF when it ends or is skipped, so nobody sits through it twice by
   * accident; switching it ON again replays it, and a tour cut short (the page reloaded) comes
   * back at the next menu mount until it is. The dev checks remove the cards without a click, so
   * they never meet it; `?coachTour` in the URL switches it on and starts it at the first mount.
   *
   * It is a body-level overlay like the guide (the menu re-renders its innerHTML on every data
   * change, so nothing lives inside #rib-main-menu-v2), and it leaves when the menu does. */

  const ID = 'rib-coach-v119';
  const KEY = 'rib.coachTour.v119';
  const ART = './public/coach/';
  const POSES = ['whoa', 'thinkcap', 'armscrossed', 'clipboard', 'relaxed', 'firedup', 'listen', 'shrug', 'flex', 'stop', 'welcome', 'tip', 'point', 'thumbsup', 'open'];
  // the pace: a character every TYPE_MS, punctuation breathes, then the line is HELD to be read
  const TYPE_MS = 18, PUNCT_MS = 140, HOLD_MS = 700, HOLD_PER_CHAR = 11, CHAPTER_MS = 500;
  const MOUTH_MIN = 75, MOUTH_MAX = 165;

  // ---- the spotlight targets: what is on the menu, by the router's own action names -----------
  const S = {
    career: '.rib9-tiles .rib9-tile:nth-child(1)', training: '.rib9-tiles .rib9-tile:nth-child(2)',
    goals: '.rib9-tiles [data-rib-action="goals"]', hall: '.rib9-tiles [data-rib-action="hall"]',
    locker: '.rib9-tiles [data-rib-action="locker"]', settings: '.rib9-tiles [data-rib-action="settings"]',
    howto: '.rib9-tiles [data-rib-action="howto"]', coach: '.rib9-tiles [data-rib-action="coach"]',
    prestige: '[data-rib-action="prestige"]', leaderboard: '[data-rib-action="view:leaderboard"]',
    hero: '.rib9-hero', player: '.rib9-player', latest: '.rib9-latest', motto: '.rib9-motto',
  };

  // ---- the script ----------------------------------------------------------------------------
  // { p: pose, t: text, s: spotlight selector (optional) }. The voice is a football coach's; the
  // facts are the guide's — same sections, same numbers, in order.
  const CHAPTERS = [
    { id: 'kickoff', title: 'KICKOFF', sub: 'WHO I AM AND WHY YOU ARE HERE', lines: [
      { p: 'welcome', t: "Alright, rookie. Eyes up here. I'm Coach. This is the walkthrough. Eight minutes, give or take, and then you go earn it." },
      { p: 'listen', t: "House rules. Tap my bubble and I finish my sentence quicker. NEXT moves us along. SKIP leaves, and I will remember that." },
      { p: 'clipboard', t: "Everything I say is on the clipboard. It's the HOW TO PLAY guide on your menu, and every number I quote is the game's own.", s: 'howto' },
      { p: 'point', t: "You. One player. Not a franchise, not a coach, not a fantasy team. One man on a roster, from Pee Wee to wherever the road runs out." },
      { p: 'armscrossed', t: "The season plays itself around you. What you own is the man: his position, his points, the shape of his week, and when he declares." },
    ] },
    { id: 'start', title: 'START HERE', sub: 'WHAT THIS GAME ACTUALLY IS', lines: [
      { p: 'tip', t: "There are nine levels, and every one of them keeps only a share of the players in it. The rest go home. That's football.", s: 'career' },
      { p: 'listen', t: "When your seasons at a level are used up, the button to play another one is gone. You declare. One roll. One shot. Miss it and the career is over." },
      { p: 'stop', t: "Careers are MEANT to end. Read that again. A realistic first career walks up to Varsity, declares into College, and finishes there." },
      { p: 'shrug', t: "Reaching College at all is a good first run. The game itself tells you a scholarship is rare. It is not being polite." },
      { p: 'thinkcap', t: "The DFL is not blocked by bad luck. It is blocked by your potential ceiling. And the ceiling is raised by the prestige tree.", s: 'prestige' },
      { p: 'clipboard', t: "The tree is bought with points you earn by FINISHING careers. A first DFL run is realistically eight to twelve careers away. Pack a lunch." },
      { p: 'flex', t: "What carries over is the tree's node levels, far more than the stars. Run two is barely different from run one. By run five you are a taller player." },
      { p: 'armscrossed', t: "Team-quality nodes are deliberately weak. The whole maxed set is worth about 1.4 points of margin a game. Read the ladder as a staircase, not a wall." },
    ] },
    { id: 'attrs', title: 'THE ATTRIBUTES', sub: 'ALL 17, AND WHAT THEY REALLY DO', lines: [
      { p: 'clipboard', t: "Seventeen numbers you can buy. I'll tell you what each one does to a PLAY, not what it sounds like on the sheet.", s: 'training' },
      { p: 'point', t: "Speed is top end: separation, and running a man down. Acceleration is how fast you get there. Agility is how little a turn costs you." },
      { p: 'firedup', t: "Strength is every contact on the field. Tackling is whether the stop lands or you whiff. Blocking comes off every shed roll. That's the trench in one number." },
      { p: 'tip', t: "Catching is the catch AND being chosen as the target in the first place. Throwing is velocity, range, accuracy. Vision is the carrier's lookahead." },
      { p: 'listen', t: "Awareness. The most-read number in the whole simulation. Diagnosing a play, resisting fakes, pursuit angles, protection calls, accuracy, finding the ball." },
      { p: 'open', t: "Quickness is the first step. Jumping is the high point. Stamina is the tank. Grit is falling forward and reloading after a hit. Discipline is not biting." },
      { p: 'shrug', t: "Ball control keeps the ball when it's punched at. And durability? Durability is the injury model and NOTHING else. It never enters a play." },
      { p: 'stop', t: "Now the five that surprise people. One: coverage cannot be bought. It is not a stat. The game makes it out of awareness plus speed, divided by two." },
      { p: 'whoa', t: "Two: vision does nothing below 75. Zero. It still pads your rating, so you'll feel smart buying it. You are not. Cross 75 or leave it alone." },
      { p: 'tip', t: "Three: jumping only matters on routes deeper than 13 yards, and only as the gap between you and the man covering you. Four: durability never touches a play." },
      { p: 'thumbsup', t: "Five, and this one is good news: awareness pays you back. Plus one skill point per fifty awareness, every single season." },
      { p: 'relaxed', t: "And stamina is a fourth-quarter stat. The late fade doesn't start until about 2.2 seconds into a play. It's for long plays and tired legs, not the first step." },
    ] },
    { id: 'rating', title: 'YOUR RATING', sub: 'HOW OVR IS BUILT, AND THE BODY YOU WERE DEALT', lines: [
      { p: 'clipboard', t: "Your OVR. Your attributes get averaged with your position's weights, then that average is bent through a curve. Generous low, brutal high." },
      { p: 'point', t: "A weighted mean of 99 is a 71 overall. 150 is an 87. Around 215 you touch 99, and past that the scale keeps going. The cap is 999. Yes, three digits." },
      { p: 'tip', t: "So the first fifty points of a stat are worth far more rating than the fifth fifty. Remember that when you're shopping." },
      { p: 'listen', t: "The tiers. 50 is a Prospect. 64 Draftable. 74 DFL Fringe. 80 a DFL Starter. 85 All-Star. 90 All-Pro. 95 Hall of Fame. 100, Transcendent." },
      { p: 'flex', t: "140 is Interstellar. 180 is Galaxy-Class. I've never coached one. I'd like to." },
      { p: 'whoa', t: "Now the biggest FREE swing in the game. Body fit. How well the body you rolled suits the position you picked is worth about minus 21 to plus 13 OVR." },
      { p: 'firedup', t: "It costs nothing. It lasts forever. It is one click on the position screen. Take the position your body fits. I will not say it nicer than that." },
      { p: 'thinkcap', t: "And height is real, even though the roster screen never mentions it. A shorter tackler gets under the pads and wraps clean." },
      { p: 'shrug', t: "A taller one tackles high and gets ducked, hurdled and trucked. Same height feeds the box-out at the catch. Nobody tells you. I just did." },
    ] },
    { id: 'position', title: 'YOUR POSITION', sub: 'NINE JOBS, NINE SETS OF WEIGHTS', lines: [
      { p: 'clipboard', t: "Nine positions, nine sets of weights, each summing to one. Anything not on your position's list contributes NOTHING to your rating.", s: 'career' },
      { p: 'point', t: "Quarterback: throwing .24, awareness .18, vision .12. Throwing is the ball. Awareness is the rest of the job. Grit is composure when the pocket goes." },
      { p: 'tip', t: "Running back: speed, agility, quickness, vision. Ball control keeps it when it's punched. And a back is the most compressed player in the game." },
      { p: 'listen', t: "Receiver: catching .20 is twice the stat it looks, the catch AND the targeting. Speed is separation. Tight end splits catching and blocking, and that's fine." },
      { p: 'firedup', t: "Offensive line: blocking .28, strength .24. Over half your rating is the whole trench. Defensive line: strength, tackling, quickness. Honest weights." },
      { p: 'open', t: "Linebacker: tackling lands the stop, awareness sets the angle, discipline keeps you off the fake. Corner and safety: awareness and speed, TWICE each." },
      { p: 'stop', t: "Weighted in the rating, and then they're the two halves of coverage. Corners looking for a coverage stat to buy: there isn't one. Buy awareness and speed." },
      { p: 'thinkcap', t: "Now the star-compression rule. A man far better than his teammates keeps only a FRACTION of his edge in the roll, and it depends on the position." },
      { p: 'whoa', t: "A running back keeps .18. A linebacker .27. Corner .28. Quarterback and offensive line .55. A defensive lineman keeps one point zero zero. Every point." },
      { p: 'point', t: "So if you want one man to decide games on a roster that doesn't deserve him, play defensive line. That's not advice. That's arithmetic." },
    ] },
    { id: 'points', title: 'SPENDING POINTS', sub: 'THE SOFT CAP SETS THE PRICE, NOT THE NUMBER', lines: [
      { p: 'clipboard', t: "Points arrive at the season rollover. Base of 4 plus level times 3, scaled by how the season went, plus awareness over 50, plus perks and bonuses.", s: 'training' },
      { p: 'listen', t: "Every attribute is priced against one line, the soft cap: your ceiling plus 12, times a share that starts at 60% at one star and reaches 85% at five." },
      { p: 'tip', t: "Below the cap, plus one costs one point. At or above it, plus one costs two, then three at ten over, four at twenty over, and up it goes." },
      { p: 'whoa', t: "Past 250 the whole bill is multiplied by five. Raising a 250 costs 105 points. I have seen people do it. I have seen people cry." },
      { p: 'point', t: "Spread while it's cheap. Nothing about a 59 is special and nothing about a 61 is special, except one costs a point and the other costs two." },
      { p: 'thumbsup', t: "Early on, a wide build buys far more rating per point than a spike. Spike later, when the cap has moved with your stars and your ceiling." },
    ] },
    { id: 'body', title: 'YOUR BODY', sub: 'INJURY, FATIGUE, AND WHAT A KNOCK REALLY COSTS', lines: [
      { p: 'armscrossed', t: "An injury roll happens every game. The base rises with your level, then it's multiplied by the class gap, durability, fatigue, traits, the tree and your gear." },
      { p: 'tip', t: "Class is a health stat. Be 25 OVR better than the other guys and the risk drops to about 11 percent. Be 25 worse and it climbs to 27. Roughly every 6 OVR of edge is 10% off." },
      { p: 'clipboard', t: "When one lands: 45% it's a knock with no games missed. 33% one game. 15% two. Season-ender, 0.4%. Average cost, 0.9 games per injury." },
      { p: 'stop', t: "The 45% that costs no games is NOT free. Being hurt at all makes you worn: minus 10% on every attribute the engine reads, and minus 10% on the grade. You'll play worse." },
      { p: 'listen', t: "Fatigue. You start the week at 14. Recovery and Treatment sheds about 11.6 a week. Chase the Highlight adds about 14.4. Three aggressive weeks put a fresh body past the line." },
      { p: 'whoa', t: "70 and above, you're worn. 25 and below, fresh, plus 5% on everything. Sitting a game sheds 22. The offseason caps you at 30 so you never start a season worse." },
      { p: 'shrug', t: "The honest word on durability: one point moves risk by about 0.19 percentage points. The screen rounds that to nothing. It isn't dead. It's slow. It never wins a play." },
      { p: 'relaxed', t: "In-game stamina is a different thing entirely. Every player has a tank that drains on sprints and refills between plays. Fourth-quarter legs really are shorter." },
    ] },
    { id: 'week', title: 'THE WEEK', sub: 'THE PLAN, THE COACH, THE SNAPS, THE ROLLS', lines: [
      { p: 'clipboard', t: "Before a game you get three reads built from the real opposing roster: throw at a weak secondary, run at a weak front, or stay balanced." },
      { p: 'point', t: "How much of your lean the coordinator actually applies rises with coach trust, your form, and the Field General node. Trust the mechanism, not the bar." },
      { p: 'listen', t: "The weekly plan is ROLLED, not chosen, weighted by your personality. Disciplined Execution is safe. Chase the Highlight is plus 7 and about 1.7 times the injury rate." },
      { p: 'tip', t: "Do the Dirty Work is the trust play: plus 3. Recovery buys your fatigue back. The other four are about the same risk, whatever the cards imply." },
      { p: 'armscrossed', t: "Coach trust starts around 28, not 50. You begin as a stranger. To me too. It moves by performance minus 50, over 13, every game, and it sets your snaps." },
      { p: 'firedup', t: "First String plays 88% of snaps. Starter 70. Rotation 46. Second String 27. Bench, ten. And snaps CAP your performance." },
      { p: 'stop', t: "Below a 12% share you can't grade above 76. Below 22, 84. Below 35, 92. You cannot grade out of a role you're not playing in. Climb the chart early." },
      { p: 'shrug', t: "Starting on the bench and playing your way up inside a season is the normal shape of a year. Expect it. Don't panic at it." },
      { p: 'thinkcap', t: "Your season grade is measured against the HIGHEST of four bars, and prestige raises it. Every success makes the next A harder. That's on purpose." },
      { p: 'whoa', t: "Growth and story decisions are rolled on a personality wheel. Green keeps the gain, red flips it to a loss. Fatigue drags the odds down HARD. Never go into a decision week worn." },
      { p: 'thumbsup', t: "Training: follow the game's own recommendation. Conditioning if your durability is low for the level, otherwise the program covering your weakest weighted stat." },
      { p: 'relaxed', t: "Two things that don't matter: there is no weather system, it's a label on a luck roll. And home versus away is cosmetic. Paint in the end zone. Plan around neither." },
    ] },
    { id: 'ladder', title: 'THE LADDER', sub: 'NINE LEVELS, ONE ROLL AT EACH DOOR', lines: [
      { p: 'clipboard', t: "Pee Wee, Youth League, Middle School, JV, Varsity, College, the DFL Combine, the DFL, and Interstellar. Nine levels. Each one keeps a share." },
      { p: 'point', t: "Pee Wee advances half. Varsity advances 12% of 110,000. College, 9% of 16,000. The DFL to Interstellar? Top 5 of 1,700, and only with a championship." },
      { p: 'listen', t: "Playoffs: one round at the bottom, two in the middle, none at the Combine, three at the DFL, four at Interstellar. You qualify at a 60% win rate." },
      { p: 'tip', t: "The shortest possible road to the DFL is 15 seasons and 133 regular-season games, ages 8 to 23. There is no shortcut. I checked." },
      { p: 'stop', t: "You cannot farm a level. When the seasons run out, the play-another-season button is gone. Levels 0 to 2 give you no spare years at all." },
      { p: 'armscrossed', t: "The call-up follows your national rank against the share that advances. Sitting exactly on the line is a coin flip. Top few hundred reads 95 to 98 percent." },
      { p: 'whoa', t: "But it's capped just short of certain. No rank, not even first in the nation, guarantees the call. And a declare is ONE shot. Miss it and the career ends on the spot." },
      { p: 'firedup', t: "What sets the rank? Production first, rating second. Snaps produce production. Which is why coach trust is a ranking stat. Everything in this game connects." },
    ] },
    { id: 'first', title: 'YOUR FIRST CAREER', sub: 'HOW TO SPEND IT WELL', lines: [
      { p: 'clipboard', t: "Run one: attributes around 8 to 12, a ceiling of 30, one star, a soft cap near 25. Within 18 points of the ceiling, growth runs at 12% efficiency.", s: 'career' },
      { p: 'thumbsup', t: "Levels 0 through 4 are close to automatic. The shares are enormous. Anything short of a disaster reads about 98% at the door. Expect to walk to Varsity." },
      { p: 'shrug', t: "College is where a first career usually ends. It wants a rating a first-run player can't reach. The ceiling is the wall, not the roll." },
      { p: 'tip', t: "That's the design, not a failure. Prestige pays for a career ending at Varsity, more for College, more still for a DFL run. You're farming the next man. He starts taller." },
      { p: 'point', t: "What the code rewards. One: spend every point in your position's weighted stats, heaviest first. The auto-allocate BY POSITION button does exactly that." },
      { p: 'stop', t: "The BALANCED button spreads across all 17, including stats your rating never reads. That is the trap. I've watched grown men fall in it." },
      { p: 'listen', t: "Two: stay under the soft cap while points cost one. Three: take the position your body fits. Four: follow the recommended training program." },
      { p: 'firedup', t: "Five: build coach trust early. Snap share caps performance, performance drives rank, rank is the declare. Six: declare on the LAST legal season unless the number's already high." },
      { p: 'whoa', t: "How runs get wasted: spreading across all 17. Declaring early at middling odds. A position the body doesn't fit. A whole level under the snap cap. Buying team nodes and expecting a carry." },
    ] },
    { id: 'menu', title: 'THE MENU', sub: 'EVERY DOOR ON THIS SCREEN', lines: [
      { p: 'tip', t: "Now the screen behind me. CAREER is where you start a man or play the next game. Everything you just heard happens through that door.", s: 'career' },
      { p: 'clipboard', t: "TRAINING is the upgrade sheet: your points, the soft cap, the auto-allocate buttons. Position first. Balanced never.", s: 'training' },
      { p: 'point', t: "GOALS is the milestone board: season targets, rewards, the things I'll be checking on. Yes, I check.", s: 'goals' },
      { p: 'relaxed', t: "HALL OF FAME is your legacy: careers finished, DFL seasons reached, rings. It fills slowly. That's what makes it worth something.", s: 'hall' },
      { p: 'open', t: "LOCKER is gear and appearance. Gear can lower injury risk, which you now know is a slow, honest stat. Looking good is a bonus.", s: 'locker' },
      { p: 'listen', t: "SETTINGS: field view, lighting, the camera, live speed. If the broadcast looks wrong on your phone, that's the door.", s: 'settings' },
      { p: 'flex', t: "PRESTIGE up top is the tree. Node levels carry over. That's the whole long game in one button.", s: 'prestige' },
      { p: 'thumbsup', t: "And HOW TO PLAY is my clipboard in writing, all nine sections, every number. Go back to it any time. I don't get tired of being right.", s: 'howto' },
    ] },
    { id: 'whistle', title: 'FINAL WHISTLE', sub: 'GO GET HIT', lines: [
      { p: 'armscrossed', t: "That's the walkthrough. I'm switching this tour OFF now so you don't have to hear me twice. Flip the tile if you ever want it again.", s: 'coach' },
      { p: 'welcome', t: "One player. Nine levels. Every one keeps only a share. Build the player. Earn every rep. Chase the league." },
      { p: 'firedup', t: "Now go get hit." },
    ] },
  ];

  // ---- state ----------------------------------------------------------------------------------
  const st = { open: false, ch: 0, li: 0, typing: false, auto: true, timer: 0, mouth: 0, raf: 0, spot: null, flips: 0, started: 0, preloaded: false };
  let armed = true, queryDone = false, onboardClicks = 0, sawOnboard = false, welcomed = false;

  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const store = { get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }, set(v) { try { localStorage.setItem(KEY, v); } catch (e) { /* private mode */ } } };
  // three states: nothing stored (a fresh install — ON on the tile; the tour follows the welcome
  // cards), 'on' (switched on by hand — plays now, and again at the next menu mount if it was cut
  // short), 'off' (finished, skipped, or switched off)
  const state = () => store.get();
  const enabled = () => state() !== 'off';
  const reduced = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);

  function refreshTile() {
    // the switch on the menu: flip its face in place (the next full re-render reads the same store)
    const tile = document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]'); if (!tile) return;
    const on = enabled();
    tile.classList.toggle('on', on); tile.setAttribute('aria-checked', on ? 'true' : 'false'); tile.setAttribute('aria-label', "Coach's tour, " + (on ? 'on' : 'off'));
    const small = tile.querySelector('small'); if (small) small.innerHTML = '<i class="rib9-sw"><i></i></i>' + (on ? 'ON · THE FULL WALKTHROUGH' : 'OFF · TAP TO PLAY IT');
  }

  function setEnabled(v) { store.set(v ? 'on' : 'off'); refreshTile(); }

  // ---- markup ---------------------------------------------------------------------------------
  function markup() {
    return `<div class="rib-coach-dim"></div>
      <div class="rib-coach-spot" data-c-spot hidden></div>
      <header class="rib-coach-top">
        <span class="rib9-mark">RIB</span><div><b>COACH'S TOUR</b><small data-c-crumb></small></div>
        <button type="button" class="rib-coach-skip" data-c-skip aria-label="Skip the tour">SKIP TOUR <i>×</i></button>
        <i class="rib-coach-bar"><b data-c-bar></b></i>
      </header>
      <div class="rib-coach-stage">
        <img class="rib-coach-man" data-c-man alt="" draggable="false">
        <div class="rib-coach-bubble" data-c-bubble role="group" aria-label="The coach">
          <div class="rib-coach-ch"><b data-c-ch></b><small data-c-sub></small></div>
          <p class="rib-coach-text" data-c-text aria-live="polite"></p>
          <div class="rib-coach-foot">
            <button type="button" data-c-back aria-label="Previous line">‹ BACK</button>
            <button type="button" data-c-auto class="on" aria-pressed="true" title="Play the lines on their own">AUTO</button>
            <button type="button" data-c-next class="rib-coach-next">NEXT ›</button>
          </div>
        </div>
      </div>`;
  }

  const q = (sel) => { const r = document.getElementById(ID); return r ? r.querySelector(sel) : null; };
  const line = () => CHAPTERS[st.ch].lines[st.li];
  const total = () => CHAPTERS.reduce((n, c) => n + c.lines.length, 0);
  const index = () => CHAPTERS.slice(0, st.ch).reduce((n, c) => n + c.lines.length, 0) + st.li;

  // ---- the pictures -------------------------------------------------------------------------------
  const cache = {};
  function src(pose, open) { return ART + pose + (open ? '_b' : '_a') + '.webp'; }
  function preload() {
    if (st.preloaded) return Promise.resolve();
    const all = []; POSES.forEach((p) => [0, 1].forEach((o) => { const im = new Image(); im.decoding = 'async'; im.src = src(p, o); cache[p + o] = im;
      all.push(new Promise((res) => { im.onload = res; im.onerror = res; })); }));
    return Promise.race([Promise.all(all), new Promise((res) => setTimeout(res, 2500))]).then(() => { st.preloaded = true; });
  }
  function mouth(open) { const im = q('[data-c-man]'); if (!im) return; const s = src(line().p, open); if (im.getAttribute('src') !== s) { im.setAttribute('src', s); if (open) st.flips++; } }
  function flap() {
    clearTimeout(st.mouth);
    if (!st.typing) { mouth(false); return; }
    const im = q('[data-c-man]'); const open = !!im && /_b\.webp$/.test(im.getAttribute('src') || '');
    mouth(!open);
    st.mouth = setTimeout(flap, (reduced() ? 1.8 : 1) * (MOUTH_MIN + Math.random() * (MOUTH_MAX - MOUTH_MIN)));
  }

  // ---- the spotlight: a hole in the dim over a menu element, re-measured every frame ----------------
  function spotOn(key) {
    cancelAnimationFrame(st.raf); st.spot = key ? S[key] || key : null;
    const spot = q('[data-c-spot]'), dim = q('.rib-coach-dim'); if (!spot) return;
    if (!st.spot) { spot.hidden = true; if (dim) dim.hidden = false; return; }
    const el0 = document.querySelector('#rib-main-menu-v2 ' + st.spot);
    if (!el0 || !(el0.getBoundingClientRect().width > 0)) { spot.hidden = true; if (dim) dim.hidden = false; st.spot = null; return; }
    // scroll the menu so the target sits in the band the coach and his bubble leave free: below
    // the tour's header, above the bubble (the middle of the screen is under the bubble on a phone)
    const menu = document.getElementById('rib-main-menu-v2'), bub = q('[data-c-bubble]');
    if (menu) { const r0 = el0.getBoundingClientRect(), top = 96, bottom = bub ? Math.max(top + 60, bub.getBoundingClientRect().top - 8) : innerHeight * 0.5;
      const want = top + (bottom - top) / 2, delta = (r0.top + r0.height / 2) - want;
      if (Math.abs(delta) > 4) { try { menu.scrollBy({ top: delta, behavior: reduced() ? 'auto' : 'smooth' }); } catch (e) { menu.scrollTop += delta; } } }
    if (dim) dim.hidden = true; spot.hidden = false;
    const tick = () => {
      const el = document.querySelector('#rib-main-menu-v2 ' + st.spot); const root = document.getElementById(ID);
      if (!el || !root) { spot.hidden = true; if (dim) dim.hidden = false; return; }
      const r = el.getBoundingClientRect(), pad = 6;
      spot.style.left = (r.left - pad) + 'px'; spot.style.top = (r.top - pad) + 'px'; spot.style.width = (r.width + pad * 2) + 'px'; spot.style.height = (r.height + pad * 2) + 'px';
      st.raf = requestAnimationFrame(tick);
    };
    tick();
  }

  // ---- playing a line -------------------------------------------------------------------------------
  function show() {
    const root = document.getElementById(ID); if (!root) return;
    const ch = CHAPTERS[st.ch], L = line();
    q('[data-c-crumb]').textContent = (st.ch + 1) + ' / ' + CHAPTERS.length + ' · ' + ch.title;
    q('[data-c-ch]').textContent = ch.title; q('[data-c-sub]').textContent = ch.sub;
    q('[data-c-bar]').style.width = Math.round(100 * index() / Math.max(1, total() - 1)) + '%';
    q('[data-c-back]').disabled = st.ch === 0 && st.li === 0;
    q('[data-c-next]').textContent = (st.ch === CHAPTERS.length - 1 && st.li === ch.lines.length - 1) ? 'DONE ✓' : 'NEXT ›';
    root.dataset.chapter = ch.id; root.dataset.pose = L.p;
    mouth(false); spotOn(L.s || null);
    type(L.t);
    try { const H = window.__RIB_COACH; H.linesShown = (H.linesShown || 0) + 1; H.last = { ch: ch.id, li: st.li, pose: L.p, spot: L.s || null }; } catch (e) { /* the hook */ }
  }
  function type(text) {
    clearTimeout(st.timer); st.typing = true; st.text = text; st.pos = 0;
    const p = q('[data-c-text]'); if (!p) return; p.textContent = '';
    flap();
    const step = () => {
      if (!st.typing) return;
      st.pos++; p.textContent = text.slice(0, st.pos);
      if (st.pos >= text.length) { done(); return; }
      const c = text[st.pos - 1], pause = /[.!?]/.test(c) ? PUNCT_MS : /[,;:]/.test(c) ? PUNCT_MS * 0.5 : 0;
      st.timer = setTimeout(step, TYPE_MS + pause);
    };
    st.timer = setTimeout(step, reduced() ? 0 : 120);
  }
  function done() {
    st.typing = false; clearTimeout(st.timer); mouth(false); clearTimeout(st.mouth);
    const p = q('[data-c-text]'); if (p) p.textContent = st.text;
    if (st.auto) st.timer = setTimeout(next, HOLD_MS + HOLD_PER_CHAR * st.text.length);
  }
  function tap() { if (st.typing) done(); else next(); }
  function next() {
    clearTimeout(st.timer);
    const ch = CHAPTERS[st.ch];
    if (st.li < ch.lines.length - 1) { st.li++; show(); return; }
    if (st.ch < CHAPTERS.length - 1) { st.ch++; st.li = 0; const root = document.getElementById(ID); if (root) { root.classList.add('rib-coach-turn'); setTimeout(() => root.classList.remove('rib-coach-turn'), CHAPTER_MS); } show(); return; }
    finish('done');
  }
  function back() {
    clearTimeout(st.timer);
    if (st.li > 0) st.li--; else if (st.ch > 0) { st.ch--; st.li = CHAPTERS[st.ch].lines.length - 1; }
    show();
  }
  function setAuto(v) { st.auto = !!v; const b = q('[data-c-auto]'); if (b) { b.classList.toggle('on', st.auto); b.setAttribute('aria-pressed', String(st.auto)); } if (st.auto && !st.typing) st.timer = setTimeout(next, HOLD_MS); if (!st.auto) clearTimeout(st.timer); }

  // ---- open / close -----------------------------------------------------------------------------------
  function open(opts) {
    if (document.getElementById(ID)) return true;
    if (!document.getElementById('rib-main-menu-v2')) return false;   // the tour is a view of the menu
    const root = document.createElement('div');
    root.id = ID; root.className = 'rib-coach'; root.setAttribute('role', 'dialog'); root.setAttribute('aria-modal', 'true'); root.setAttribute('aria-label', "Coach's tour"); root.tabIndex = -1;
    root.innerHTML = markup();
    document.body.appendChild(root); document.body.classList.add('rib-coach-open');
    st.open = true; st.ch = 0; st.li = 0; st.flips = 0; st.started = Date.now(); st.auto = !(opts && opts.auto === false);
    try { const H = window.__RIB_COACH; H.opens = (H.opens || 0) + 1; H.openedBy = (opts && opts.by) || 'tile'; } catch (e) { /* the hook */ }
    bind(root);
    preload().then(() => { if (document.getElementById(ID)) { root.classList.add('rib-coach-ready'); show(); (q('[data-c-next]') || root).focus({ preventScroll: true }); } });
    return true;
  }
  function close(why) {
    const root = document.getElementById(ID); if (!root) return false;
    clearTimeout(st.timer); clearTimeout(st.mouth); cancelAnimationFrame(st.raf); st.typing = false; st.open = false;
    root.remove(); document.body.classList.remove('rib-coach-open');
    try { const H = window.__RIB_COACH; H.closes = (H.closes || 0) + 1; H.closedBy = why || 'close'; } catch (e) { /* the hook */ }
    const tile = document.querySelector('#rib-main-menu-v2 [data-rib-action="coach"]'); if (tile) { try { tile.focus({ preventScroll: true }); } catch (e) { /* a nicety */ } }
    return true;
  }
  function finish(why) { setEnabled(false); close(why || 'done'); }   // the tour ends: the switch goes OFF, so it never plays twice by accident

  function bind(root) {
    root.addEventListener('click', (ev) => {
      if (ev.target.closest('[data-c-skip]')) { ev.preventDefault(); finish('skip'); return; }
      if (ev.target.closest('[data-c-next]')) { ev.preventDefault(); next(); return; }
      if (ev.target.closest('[data-c-back]')) { ev.preventDefault(); back(); return; }
      if (ev.target.closest('[data-c-auto]')) { ev.preventDefault(); setAuto(!st.auto); return; }
      if (ev.target.closest('[data-c-bubble]') || ev.target.closest('[data-c-man]')) { ev.preventDefault(); tap(); return; }
    });
    root.addEventListener('keydown', (ev) => {
      if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); finish('skip'); return; }
      if (ev.key === 'ArrowRight' || ev.key === ' ' || (ev.key === 'Enter' && !ev.target.closest('button'))) { ev.preventDefault(); tap(); return; }
      if (ev.key === 'ArrowLeft') { ev.preventDefault(); back(); return; }
      if (ev.key !== 'Tab') return;
      const stops = [...root.querySelectorAll('button')].filter((b) => !b.disabled && b.offsetParent !== null);
      if (!stops.length) return;
      const first = stops[0], last = stops[stops.length - 1];
      if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
      else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
    });
  }

  // ---- the switch ---------------------------------------------------------------------------------------
  function toggle() {
    if (st.open) { finish('skip'); return true; }
    if (state() === 'on') { setEnabled(false); return true; }   // switched on by hand and idle: off
    setEnabled(true); return open({ by: 'tile' });              // fresh or off: on, and play
  }

  // ---- the first visit (the welcome cards), the query door, and a switch left on ------------------------------
  const splashGone = () => { const sp = document.getElementById('splash'); return !sp || sp.classList.contains('gone') || getComputedStyle(sp).display === 'none'; };
  document.addEventListener('click', (ev) => { if (ev.target.closest && ev.target.closest('.onboard #onNext')) onboardClicks++; }, true);
  const watch = () => {
    if (document.querySelector('.onboard')) { sawOnboard = true; return; }   // the cards are up: wait for the player to read them
    const menu = document.getElementById('rib-main-menu-v2');
    if (!menu || st.open || !armed || !splashGone()) return;
    if (!queryDone && /[?&]coachTour\b/.test(location.search)) { queryDone = true; armed = false; setEnabled(true); open({ by: 'query' }); return; }   // the checks' and the screenshots' door: forces ON
    if (sawOnboard && !welcomed && onboardClicks >= 3 && enabled()) {   // the cards clicked through (a fresh install is ON): the coach takes over
      welcomed = true; armed = false; setEnabled(true);   // stored 'on': cut short, it plays again next time, until it is finished or skipped
      setTimeout(() => { if (!st.open && document.getElementById('rib-main-menu-v2')) open({ by: 'welcome' }); }, 500); return; }
    if (state() === 'on') { armed = false; open({ by: 'switch' }); }   // switched on by hand (or by the cards) and cut short: it plays again here
  };
  new MutationObserver(watch).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ['class'] });
  window.addEventListener('rib-menu-unmounted', () => { armed = true; if (document.getElementById(ID)) close('menu'); });
  window.addEventListener('resize', () => { if (st.spot) spotOn(st.spot); });

  function estimateMs() {
    let ms = 0;
    CHAPTERS.forEach((c) => c.lines.forEach((L) => { const n = L.t.length, punct = (L.t.match(/[.!?]/g) || []).length, commas = (L.t.match(/[,;:]/g) || []).length;
      ms += 120 + n * TYPE_MS + punct * PUNCT_MS + commas * PUNCT_MS * 0.5 + HOLD_MS + HOLD_PER_CHAR * n; }));
    return ms + CHAPTERS.length * CHAPTER_MS;
  }

  window.__RIB_COACH = {
    open: (o) => open(o), close: (w) => close(w || 'close'), toggle, next, back, tap, skip: () => finish('skip'), setAuto, setEnabled,
    get enabled() { return enabled(); }, get isOpen() { return !!document.getElementById(ID); },
    get chapter() { return st.open ? CHAPTERS[st.ch].id : null; }, get line() { return st.open ? st.li : -1; }, get typing() { return st.typing; },
    get flips() { return st.flips; }, get spot() { return st.spot; }, get auto() { return st.auto; },
    chapters: CHAPTERS.map((c) => ({ id: c.id, title: c.title, lines: c.lines.length })), poses: POSES.slice(), estimateMs, key: KEY,
  };
})();
