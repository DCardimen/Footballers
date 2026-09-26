(() => {
  'use strict';
  /* ===== v111 HOW TO PLAY — the in-game guide =====
   * A self-contained view that opens OVER the v89 menu. It deliberately does not live inside
   * #rib-main-menu-v2: mountMenu() rebuilds that element's innerHTML on every data change, so a
   * panel parked in there would be wiped mid-read. This one is its own body-level overlay, the
   * open/closed set of accordions lives in a module-level Set, and the router
   * (rib-menu-navigation.js) hands us data-rib-action="howto" before findOriginal is consulted —
   * the guide has no counterpart in the legacy app to click.
   *
   * Every number below is the game's own. Nothing here is invented: if a mechanic is not in the
   * simulation it is not in this guide, and where the screen and the code disagree the guide
   * says so rather than repeating the screen. */

  const ID = 'rib-howto-v111';
  const OPENER = '[data-rib-action="howto"]';

  // ---- small markup helpers ---------------------------------------------------
  const esc = (v) => String(v == null ? '' : v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const tab = (head, rows, cls = '') => `<div class="rib9-fq-tw"><table class="rib9-fq-tab ${cls}">
    <thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${c}</td>` : `<th scope="row">${c}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
  const attr = (rows) => `<dl class="rib9-fq-attrs">${rows.map(([n, t]) => `<div><dt>${n}</dt><dd>${t}</dd></div>`).join('')}</dl>`;
  const note = (title, body) => `<div class="rib9-fq-note"><b>${title}</b><span>${body}</span></div>`;
  const chips = (list) => `<ul class="rib9-fq-chips">${list.map(([k, v]) => `<li><b>${k}</b><i>${v}</i></li>`).join('')}</ul>`;
  const list = (items, cls = '') => `<ul class="rib9-fq-list ${cls}">${items.map((i) => `<li>${i}</li>`).join('')}</ul>`;
  // v153 F: the four numbers — what each is, how it is earned, what it does (a list, not a table: the prose does not fit a phone row)
  const cur = (rows) => `<dl class="rib9-fq-attrs rib9-fq-cur">${rows.map(([n, what, how, does]) => `<div><dt>${n}</dt><dd>${what}<br><i>Earned:</i> ${how}<br><i>Does:</i> ${does}</dd></div>`).join('')}</dl>`;
  const num = (items) => `<ol class="rib9-fq-num-list">${items.map((i) => `<li>${i}</li>`).join('')}</ol>`;

  // the nine positions: the weights the rating actually reads, then the handful of numbers that
  // decide plays, then the money players burn on stats their rating never opens.
  const POS = [
    ['QB', 'QUARTERBACK', [['THROWING', '.24'], ['AWARENESS', '.18'], ['VISION', '.12'], ['GRIT', '.09'], ['BALL CONTROL', '.08'], ['AGILITY', '.07'], ['DISCIPLINE', '.07'], ['SPEED', '.05'], ['STAMINA', '.05'], ['QUICKNESS', '.05']],
      'Throwing is the ball — velocity, deep range, accuracy. Awareness is the rest of the position: the read, the protection call, and accuracy again. Grit is composure when the pocket goes.',
      'Vision is your third-heaviest weight and it does nothing on the field until 75. Below that you are buying rating, not a quarterback. Catching, blocking, tackling, jumping, strength, acceleration and durability are never read by a QB rating at all.'],
    ['RB', 'RUNNING BACK', [['SPEED', '.16'], ['AGILITY', '.15'], ['QUICKNESS', '.13'], ['VISION', '.13'], ['ACCELERATION', '.10'], ['BALL CONTROL', '.10'], ['STRENGTH', '.08'], ['GRIT', '.07'], ['STAMINA', '.05'], ['AWARENESS', '.03']],
      'Speed, agility and quickness are the carry: top end, what a cut costs you, and the first step. Ball control is what keeps the ball when it is punched at. Vision is the cutback and the bounce — once it is live.',
      'Vision under 75 is dead weight on the grass, and the back is the position that misses it most. A back is also the most compressed player in the game (.18) — on a weak roster the engine keeps less than a fifth of your edge over your own teammates.'],
    ['WR', 'WIDE RECEIVER', [['CATCHING', '.20'], ['SPEED', '.18'], ['AGILITY', '.12'], ['QUICKNESS', '.10'], ['ACCELERATION', '.10'], ['JUMPING', '.10'], ['STAMINA', '.08'], ['VISION', '.06'], ['AWARENESS', '.06']],
      'Catching is twice the stat it looks: it is the catch itself AND whether you are chosen as the target in the first place. Speed is separation. Agility wins the break.',
      'Jumping pays on routes deeper than 13 yards and nowhere else, and only as the difference against the man covering you. Vision at .06 is rating, not receiving, until 75.'],
    ['TE', 'TIGHT END', [['CATCHING', '.16'], ['BLOCKING', '.16'], ['STRENGTH', '.14'], ['AWARENESS', '.10'], ['SPEED', '.09'], ['JUMPING', '.08'], ['GRIT', '.08'], ['STAMINA', '.07'], ['DISCIPLINE', '.07'], ['TACKLING', '.05']],
      'The only position whose two heaviest weights pull in opposite directions. Blocking is subtracted from every shed roll on the field; strength is every contact after it. Catching is the other half of the job.',
      'Splitting catching and blocking evenly is fine on a tight end — it is the one build where it is not a mistake. Jumping is still deep-route-only.'],
    ['OL', 'OFFENSIVE LINE', [['BLOCKING', '.28'], ['STRENGTH', '.24'], ['AWARENESS', '.14'], ['GRIT', '.10'], ['AGILITY', '.08'], ['STAMINA', '.08'], ['DISCIPLINE', '.08']],
      'Blocking and strength are over half your rating and they are the whole trench: blocking comes off every shed roll, strength decides the contact that follows. Awareness makes the protection call.',
      'Seven weighted stats — the other ten never touch your rating. And an offensive lineman keeps .55 of his edge over his teammates, so a good one is genuinely felt.'],
    ['DL', 'DEFENSIVE LINE', [['STRENGTH', '.24'], ['TACKLING', '.18'], ['QUICKNESS', '.12'], ['ACCELERATION', '.12'], ['GRIT', '.12'], ['STAMINA', '.08'], ['AWARENESS', '.07'], ['DISCIPLINE', '.07']],
      'Strength sheds and drives, tackling decides whether the stop lands, quickness is the first step and the shed contest. Grit is how fast you reload after one.',
      'Nothing, if you are honest about the weights. This is the position where a star is not compressed at all — see the note below.'],
    ['LB', 'LINEBACKER', [['TACKLING', '.20'], ['STRENGTH', '.14'], ['AWARENESS', '.13'], ['DISCIPLINE', '.11'], ['SPEED', '.11'], ['VISION', '.11'], ['GRIT', '.10'], ['STAMINA', '.10']],
      'Tackling lands the stop. Awareness diagnoses the play and sets the pursuit angle. Discipline is what keeps you from biting on the fake you were about to bite on.',
      'Vision at .11 again buys rating and nothing else until 75. Eight weighted stats, flat-ish — there is no single number that carries a linebacker.'],
    ['CB', 'CORNERBACK', [['SPEED', '.20'], ['AGILITY', '.15'], ['QUICKNESS', '.14'], ['AWARENESS', '.12'], ['ACCELERATION', '.10'], ['JUMPING', '.09'], ['CATCHING', '.08'], ['DISCIPLINE', '.06'], ['STAMINA', '.06']],
      'Speed and awareness, twice each: they are weighted here AND they are the two halves of coverage, the number that dominates every separation, interception, break-up and closing-speed roll you will ever take. Catching is the interception itself.',
      'Looking for a coverage stat to buy. There is not one. You buy awareness and speed, and coverage comes out of them.'],
    ['S', 'SAFETY', [['AWARENESS', '.16'], ['SPEED', '.15'], ['TACKLING', '.15'], ['VISION', '.12'], ['AGILITY', '.10'], ['GRIT', '.10'], ['DISCIPLINE', '.08'], ['CATCHING', '.08'], ['JUMPING', '.06']],
      'Awareness and speed again — coverage is half of each — with tackling level with them, because a safety is the last man. Discipline holds the deep third together.',
      'Vision at .12 under 75, and jumping at .06 outside deep routes. A safety who buys those two is a corner who cannot cover and a linebacker who cannot tackle.'],
  ];

  const LEVELS = [
    ['0', 'Pee Wee', '8-9', '8', '2', '50%', '1,800,000'],
    ['1', 'Youth League', '10-12', '8', '3', '45%', '1,100,000'],
    ['2', 'Middle School', 'Grades 6-8', '9', '3', '35%', '600,000'],
    ['3', 'JV', 'Grades 9-10', '9', '2-3', '25%', '280,000'],
    ['4', 'Varsity', 'Grades 11-12', '10', '2-3', '12%', '110,000'],
    ['5', 'College', 'Fresh-Senior', '12', '2-4', '9%', '16,000'],
    ['6', 'UFF Combine', 'Draft Year', '4', '1-3', '32%', '1,500'],
    ['7', 'The UFF', 'The League', '17', '1+', '0.3%', '1,700'],
    ['8', 'Interstellar', 'Beyond Earth', '14', '1+', '—', '96'],
  ];

  // ---- the guide itself -------------------------------------------------------
  const SECTIONS = [
    {
      id: 'start', title: 'START HERE', sub: 'WHAT THIS GAME ACTUALLY IS', body: `
      <p>You are <b>one player</b>. Not a franchise, not a coach — one man on a roster, from Pee Wee
      to wherever you run out of road. The season plays itself around you. What you own is the man:
      the position he plays, the points he spends, the shape of his week, and the moment he declares
      for the next level.</p>
      <p>There are <b>nine levels</b>, and each one keeps only a share of the players in it. When your
      seasons at a level are gone, the button to play another disappears and you declare — one roll,
      one shot. Miss it and the career ends there.</p>
      ${note('CAREERS ARE MEANT TO END.', 'This is not a game you win on the first run. A realistic first career walks up to Varsity, declares into College, and finishes there. Reaching College at all is a good first run — the game itself says a scholarship is rare.')}
      <p>The UFF is not blocked by bad luck. It is blocked by your <b>potential ceiling</b>, and the
      ceiling is raised by the prestige tree, which is bought with points earned by <b>finishing</b>
      careers. A first UFF run is realistically a high-single-digit to low-double-digit number of
      careers away. The Interstellar League — top 5 of 1,700, and gated behind winning an UFF
      championship — is a project beyond even that.</p>
      <h4>What actually carries over</h4>
      <p>The tree's <b>node levels</b>, far more than your medal count itself. Run 2 is barely
      different from run 1. By run 5 you are a noticeably better <i>player</i> — a much higher
      per-season ceiling — but only an even <i>team</i>. Team-quality nodes are deliberately weak:
      the entire maxed set is worth about <b>1.4 points of margin a game</b>.</p>
      <p>So read the ladder as a staircase, not a wall. Each career is meant to end, and each one
      makes the next one taller.</p>` },

    /* ===== v153 F STARS, HONORS, PP, LEGACY — four numbers, four jobs =====
     * The owner: "stars vs medals, two different types of medals is confusing". Honors wore a medal (🎖️)
     * and v152 A's Legacy Rank is 500 medals. Honors wear the crest (⚜️) now; the medal means the Legacy
     * Rank and nothing else, and this section says which number does what.
     * v156 A: Honors are gone — the medals (the Legacy Rank) are the family's rank and unlock the tree.
     * Three numbers, three jobs. The section id stays 'currency' (faqcheck, deep links). */
    {
      id: 'currency', title: 'STARS, PP & MEDALS', sub: 'THREE NUMBERS, THREE JOBS — WHICH IS WHICH', body: `
      <p>Three numbers follow you around this game and they do not mean the same thing. One belongs
      to the <b>player</b>; two belong to the <b>family</b> — the account — and outlive every career.</p>
      ${cur([
        ['<b>★</b> STARS', 'The <b>recruit rating</b>, 1 to 5 — what the scouts think of <i>this</i> player.', 'Rolled with the player; raised by the tree, a Path, and holding your own in a tougher tier.', 'Sets his soft cap: 60% of the ceiling at 1★, 85% at 5★. Gone when his career ends.'],
        ['<b>🪙</b> PP', '<b>Prestige Points</b> — the gold coin, the only money.', 'Every career end, titles, challenges, objectives, the Legacy milestones. Chaos multiplies it.', 'Spent in the VAULT and on prestige-tree nodes. Every node you buy is kept by every son after.'],
        ['<b>🎖️</b> MEDALS', 'The <b>Legacy Rank</b> — one medal per rank, and the family’s <b>rank</b>. Never spent.', 'Legacy XP, every season and at every career end (G.O.A.T. and Immortal add to it). Chaos multiplies it.', 'Your medal count unlocks the deeper nodes of the prestige tree (“Needs 🎖️ N medals”) and a Path at 12 medals; it lifts every soft cap, and every tenth rank pays a PP bounty. Never resets.'],
      ])}
      ${note('THE STAR IS THE PLAYER. THE COIN AND THE MEDAL ARE THE FAMILY.', 'A four-star recruit is a player rating. “Needs 🎖️ 35 medals” is the account’s rank. Nothing in the game ever asks for a thirty-five-star player, because there is no such thing.')}
      <h4>What the medals unlock</h4>
      <p>The first gated nodes want <b>12 medals</b> — about one finished career. The middle of the tree
      asks for 35 to 80 (a handful of careers, the bronze medals), the top of the Apex 200 to 260 (gold into
      ruby, dozens of careers), and the Impossible branch 260 to 420 — a lifetime. <b>Reputation</b> takes 5%
      off every medal requirement per level. A save from before medals kept every node it could already buy.</p>
      <h4>The Legacy Rank</h4>
      <p>The rank above every career: <b>500 medals</b> in one climb, from bronze through silver
      (ranks 1–200) to gold and enamel — crowns, wings, gems, eagles, lions — ending on Rank 500,
      <b>Ultimate Legacy</b>. Past 500 the climb keeps going as an endless <b>Legacy Level</b>.
      Ranks come in ten tiers of fifty:</p>
      ${tab(['RANKS', 'TIER', 'RANKS', 'TIER'], [
        ['1–50', 'Rookie', '251–300', 'Hall of Fame'],
        ['51–100', 'Established', '301–350', 'Icon'],
        ['101–150', 'Elite', '351–400', 'All-Time Great'],
        ['151–200', 'Superstar', '401–450', 'Immortal'],
        ['201–250', 'Legendary', '451–500', 'Mythic'],
      ], 'rib9-fq-two')}
      <h4>Where Legacy XP comes from</h4>
      ${list([
        '<b>Every season:</b> the level’s base (40 at Pee Wee up to 450 in the UFF and 650 Interstellar) times your grade (F ×0.6 up to A+ ×1.6), plus a championship (×3 the base, and a UFF ring adds 2,500 — 4,000 Interstellar), plus half the base per playoff win and the base again per award.',
        '<b>Every career end:</b> the stage you reached (100 at Pee Wee up to 3,500 for the UFF and 6,000 Interstellar), 25 per season you lasted, and 20 per point of peak OVR over 60. Walking away pays half.',
        '<b>Chaos multiplies all of it</b> — +8% per chaos point, up to ×5. See CHAOS.',
      ])}
      <p>Ranks 1–20 fly by (a first career is about a dozen of them); Rank 100 is roughly ten good
      careers; Rank 500 is a few hundred.</p>
      ${note('EVERY TENTH RANK IS A MILESTONE.', 'It pays a PP bounty into the vault — 25 PP at Rank 10, about 790 at Rank 100, three times as much on every fiftieth (a new tier), and ten times at Rank 500 (about 88,000 PP).')}
      <h4>Where to see it</h4>
      <p>The medal sits by your name on the main menu, the top bar, career setup and the boards —
      tap it for your <b>PROFILE</b>. There, <b>THE TROPHY CASE</b> shows the current medal, the bar
      to the next rank and the next milestone, and <b>THE COLLECTION BOOK</b> has ten pages, one a
      tier: every medal you have earned (when, and by which son), and the rest as silhouettes with
      what they cost. The season report and the career-end screen pour the XP into the bar as it is
      paid.</p>` },

    {
      id: 'attrs', title: 'THE ATTRIBUTES', sub: 'ALL 17, AND WHAT THEY REALLY DO', body: `
      <p>Seventeen buyable numbers. Every one of them is described here by what it does to a play,
      not by what it sounds like.</p>
      ${attr([
        ['SPEED', 'Top speed on the field: separation from coverage, and running a man down.'],
        ['ACCELERATION', 'How fast he reaches that top speed — the launch burst out of a cut.'],
        ['AGILITY', 'How little speed a turn costs him. Steering, breaking tackles, winning separation at a route break.'],
        ['STRENGTH', 'Every contact: breaking tackles, stiff arms, holding a block, shedding one, driving a pile, punching a ball loose.'],
        ['TACKLING', 'Whether the tackle lands or he whiffs, how well he wraps, and resisting a broken tackle.'],
        ['BLOCKING', 'Subtracted from every shed roll on the field. The whole trench, in one number.'],
        ['CATCHING', 'The catch — and being chosen as the target in the first place.'],
        ['AWARENESS', 'The most-read number in the simulation. How fast he diagnoses a play, resistance to fakes, pursuit angles, protection calls, QB accuracy, a receiver finding the ball.'],
        ['QUICKNESS', 'First-step latency, shed contests, elusiveness, play recognition.'],
        ['THROWING', 'Ball velocity, deep range, accuracy.'],
        ['VISION', 'The carrier’s lookahead: seeing the cutback and the bounce.'],
        ['JUMPING', 'The high point — on routes deeper than 13 yards, and only as a difference against the defender.'],
        ['STAMINA', 'The in-game tank: slower burn, faster recovery, a shorter gassed window.'],
        ['GRIT', 'Falling forward, second effort for the sticks, how fast a tackler reloads, a quarterback’s composure.'],
        ['BALL CONTROL', 'Holding onto the ball when it is punched at; securing a contested catch.'],
        ['DISCIPLINE', 'Not biting on fakes, not overpursuing, holding contain.'],
        ['DURABILITY', 'The injury model, and nothing else. It never enters a play.'],
      ])}
      <h4>The five that surprise people</h4>
      ${list([
        '<b>Coverage cannot be bought.</b> It is not an attribute. The game makes it out of <b>(awareness + speed) / 2</b>, and it is the dominant term in every separation, interception, break-up and closing-speed roll on defense. A corner buys awareness and speed twice over.',
        '<b>Vision does nothing below 75.</b> The read radius returns zero under that line. It still counts toward your rating, so buying it raises your OVR while changing nothing on the grass. Cross 75 or leave it alone.',
        '<b>Jumping only matters deep.</b> Routes past 13 yards, and only as the gap between your jumping and the defender’s. On everything shorter it is not consulted.',
        '<b>Durability never touches a play.</b> It cannot make you faster, stronger or surer-handed. It is purely how often the injury roll bites — see YOUR BODY.',
        '<b>Awareness pays you back in points.</b> On top of everything above, it earns <b>+1 skill point per 50 awareness, every season</b>.',
      ])}
      ${note('STAMINA IS A FOURTH-QUARTER STAT.', 'The late-play fade does not begin until about 2.2 seconds into a play. Stamina is for long plays and tired legs, not for the first step.')}` },

    {
      id: 'rating', title: 'YOUR RATING', sub: 'HOW OVR IS BUILT — AND THE BODY YOU WERE DEALT', body: `
      <p>Your attributes are averaged using your position’s weights, and that average is bent
      through a curve. The curve is generous low and brutal high:</p>
      ${tab(['WEIGHTED MEAN', 'OVR'], [['99', '71'], ['150', '87'], ['215', '~93, then 99'], ['past 215', 'open-ended (cap 999)']])}
      <p>So the first fifty points of a stat are worth far more rating than the fifth fifty. Past 99
      the scale keeps going — the top of this game is a long way above the top of a real one.</p>
      <h4>The tiers</h4>
      ${tab(['OVR', 'THEY CALL YOU'], [['50', 'Prospect'], ['64', 'Draftable'], ['74', 'UFF Fringe'], ['80', 'UFF Starter'], ['85', 'All-Star'], ['90', 'All-Pro'], ['95', 'Hall of Fame'], ['100', 'Transcendent'], ['140', 'Interstellar'], ['180', 'Galaxy-Class']])}
      ${note('BODY FIT IS THE BIGGEST FREE SWING IN THE GAME.', 'On top of the curve, how well your rolled body suits the position you chose is worth roughly −21 to +13 OVR. It costs nothing, it lasts forever, and it is one click on the position screen. Take the position your body fits.')}
      <h4>Height is real, and the screen never mentions it</h4>
      <p>Tackle leverage reads the actual height difference between the two men. A <b>shorter</b>
      tackler gets under the pads and wraps clean; a <b>taller</b> one tackles high and gets ducked,
      hurdled and trucked more often. The same height feeds the box-out at the catch point. Nobody
      tells you this on the roster screen. Now you know.</p>` },

    {
      id: 'position', title: 'YOUR POSITION', sub: 'NINE JOBS, NINE SETS OF WEIGHTS', body: `
      <p>Your position’s weights decide which attributes your rating reads at all — each set sums
      to 1.000, and anything not on the list contributes nothing to your OVR. Heaviest first:</p>
      ${POS.map(([code, name, w, movers, trap]) => `<div class="rib9-fq-pos">
        <div class="rib9-fq-pos-h"><b>${code}</b><span>${name}</span></div>
        ${chips(w)}
        <p><i>What moves outcomes.</i> ${movers}</p>
        <p class="rib9-fq-trap"><i>What players over-buy.</i> ${trap}</p>
      </div>`).join('')}
      <h4>The star-compression rule</h4>
      <p>A player far better than his own teammates keeps only <b>a fraction of his edge</b> in the
      roll, and the fraction depends on the position:</p>
      ${tab(['POS', 'KEEPS', 'POS', 'KEEPS'], [
        ['RB', '.18', 'S', '.40'],
        ['LB', '.27', 'QB', '.55'],
        ['CB', '.28', 'OL', '.55'],
        ['TE', '.32', 'DL', '<b>1.00</b>'],
        ['WR', '.36', '', ''],
      ], 'rib9-fq-two')}
      <p>Read that honestly. A superstar running back behind a weak line is rolled at less than a
      fifth of his advantage — the team drags him back to it. A <b>dominant defensive lineman keeps
      every point of his</b>. If you want one man to decide games on a roster that does not deserve
      him, play defensive line.</p>` },

    {
      id: 'points', title: 'SPENDING POINTS', sub: 'THE SOFT CAP SETS THE PRICE, NOT THE NUMBER', body: `
      <p>Points arrive at the season rollover: a base of <b>4 + (level × 3)</b>, scaled by how the
      season went, plus <b>awareness / 50</b>, plus perks, team and award bonuses.</p>
      <h4>The soft cap</h4>
      <p>Every attribute is priced against one line:</p>
      <p class="rib9-fq-eq">(potential ceiling + 12) × (0.60 + (recruit stars − 1) × 0.0625 + 0.01 × medal level)</p>
      <p>At 1 recruit star that is <b>60%</b> of your ceiling-plus-twelve; at 5 stars, <b>85%</b>. Your
      medals add on top: the <b>medal level</b> is 6 at 12 medals, 16 at 50, 26 at 100, 40 at 200 and 64
      at 420 — so +6%, +16%, +26%, +40%, +64%.</p>
      <h4>The price</h4>
      ${list([
        'Below the soft cap, +1 costs <b>1 point</b>.',
        'At or above it, +1 costs <b>2 + floor((value − soft cap) / 10)</b> — so 2, then 3 at ten over, 4 at twenty over, and up.',
        'Past 250, the whole cost is multiplied by <b>5</b>.',
      ])}
      <p>Worked, with a soft cap of 60:</p>
      ${tab(['RAISING FROM', 'COSTS'], [['40', '1'], ['59', '1'], ['60', '2'], ['70', '3'], ['80', '4'], ['90', '5'], ['120', '8'], ['250', '105']])}
      ${note('SPREAD WHILE IT IS CHEAP.', 'Nothing about a 59 is special and nothing about a 61 is special — except that one costs a point and the other costs two, and the gap only widens. Early on, a wide build buys far more rating per point than a spiked one. Spike later, when the cap has moved with your stars and your ceiling.')}` },

    {
      id: 'body', title: 'YOUR BODY', sub: 'INJURY, FATIGUE, AND WHAT A KNOCK REALLY COSTS', body: `
      <p>An injury roll happens per game. The base rises with the level you are at, and is then
      multiplied by:</p>
      ${list([
        'the <b>class gap</b> against the opponent — 60 OVR of superiority floors it at 0.28×, being outmatched by the same margin caps it at 1.9×. Roughly every 6 OVR of edge is 10% off the risk.',
        '<b>durability</b> — 1.35 − (resist × 0.009), floored at 0.45, so it stops improving at resist 100.',
        '<b>fatigue</b> — linear, about +0.9% relative risk per point.',
        'traits — Iron Frame 0.7×, Glass Bones 1.35×.',
        'the prestige tree and your gear, together capped at an 85% reduction.',
      ])}
      <p>The result is clamped between 1.5% and 55%. Measured, in an even matchup with no traits:</p>
      ${tab(['DURABILITY', 'FAT 0', 'FAT 30', 'FAT 70'], [['10', '21.4%', '27.2%', '34.9%'], ['50', '15.3%', '19.4%', '24.9%'], ['90', '9.2%', '11.7%', '15.0%']])}
      <p>At durability 50 and fatigue 30, being <b>25 OVR better</b> than the opponent drops it to
      11.3%; being 25 OVR worse pushes it to 27.5%. Class is a health stat.</p>
      <h4>When one lands</h4>
      ${tab(['SEVERITY', 'CHANCE'], [['A knock — no games missed', '45%'], ['One game', '33%'], ['Two games', '15%'], ['Three to five', '6.6%'], ['Season-ending', '0.4%']])}
      <p>Average cost: <b>0.9 games per injury</b>. Playing worn skews it worse — the average rises
      to 1.11. Across a real season that is roughly <b>one game missed per ten-game season</b> in
      your prime, and about 2.4 games across a 17-game UFF season before the age and plan gates
      (1.26 after them). A season-ender is about one season in ninety at UFF length.</p>
      ${note('THE 45% THAT COSTS NO GAMES IS NOT FREE.', 'Being hurt at all trips the worn condition: −10% on every attribute the engine reads AND −10% on the game grade that comes out of it, until it clears. You will play, and you will play worse.')}
      <h4>Fatigue</h4>
      <p>You start at <b>14</b>. Each week adds your plan (−10 for Recovery &amp; Treatment up to
      +16 for Chase the Highlight), plus 0.12 per snap, plus an age term past 28, minus recovery.
      With typical recovery and 40 snaps that lands around:</p>
      ${tab(['WEEKLY PLAN', 'FATIGUE / WEEK'], [['Recovery &amp; Treatment', '−11.6'], ['Disciplined Execution', 'about flat'], ['Chase the Highlight', '+14.4']])}
      ${list([
        '<b>Fatigue is a slope.</b> Nothing to 40, then a straight line down: −10% on everything at 70, −20% at 100 — and worse injuries all the way down.',
        '<b>25 and below: fresh.</b> +5% on everything.',
        'Three aggressive weeks in a row put a fresh body past the worn line.',
        'Sitting a game out sheds 22. The offseason caps you at 30, so you never start a season worse than that.',
      ])}
      <h4>The honest word on durability</h4>
      <p>One point of durability moves risk by about <b>0.19 percentage points</b> — roughly 0.018
      games a season. Ten points is about 0.18 games. The display rounds that to nothing, which is
      why players call it a dead stat. It is not dead; it is <b>slow</b>. It compounds across a
      career, and it never helps you win a single play.</p>
      ${note('IN-GAME STAMINA IS A DIFFERENT THING.', 'Season fatigue is the week. Inside a game every player also has a tank that drains on sprints and refills between plays; empty it and he is slower for several plays. Game wear lowers the tank’s ceiling as the game goes on, so fourth-quarter legs really are shorter.')}` },

    {
      id: 'week', title: 'THE WEEK', sub: 'THE PLAN, THE COACH, THE SNAPS, THE ROLLS', body: `
      <h4>The game plan</h4>
      <p>Before a game you get three reads, built from the <b>real opposing roster</b>: throw at a
      weak secondary, run at a weak front, or stay balanced. One is flagged when a unit is clearly
      weaker. How much of your lean the coordinator actually applies rises with <b>coach trust</b>,
      your recent form, and the Field General prestige node.</p>
      ${note('TRUST THE MECHANISM, NOT THE BAR.', 'The impact meter on that screen reads low — the script moves further your way than the percentage it prints. Pick the read you believe in and do not let the bar talk you out of it.')}
      <h4>The weekly plan</h4>
      <p>This one is <b>yours to choose</b>, on the fifth page of the pregame — every plan the staff drew
      up is a tile, and its card prints what it does. Each plan still carries a <b>roll</b> (clicks,
      nothing, or backfires — your personality loads the odds) that is revealed at kickoff, and VAR is
      its <b>swing</b>: ±3 × VAR on every attribute for the game, and ±6 × VAR on the grade. The
      projection under every pregame page is your box score for the game, with the range VARIANCE
      says it can land in. What the main plans do:</p>
      ${tab(['PLAN', 'PERF', 'VAR', 'SNAPS', 'TRUST'], [
        ['Disciplined Execution', '+2', '0.55×', '—', '+1'],
        ['Demand the Spotlight', '+5', '1.28×', '+10%', '—'],
        ['Chase the Highlight', '+7', '1.72×', '+4%', '−1'],
        ['Do the Dirty Work', '−1', '0.80×', '+6%', '<b>+3</b>'],
        ['Recovery &amp; Treatment', '−3', '0.70×', '−5%', '—'],
      ])}
      <p>On risk: only <b>Chase the Highlight</b> is genuinely more dangerous — about 1.7× the
      injury rate. The other four come out the same in practice, whatever their cards imply.</p>
      <h4>Coach trust and the snap-share cap</h4>
      <p>Trust starts around <b>28</b>, not 50 — you begin as a stranger. It moves by roughly
      <b>(performance − 50) / 13</b> every game, and it feeds your depth-chart score. Your role
      sets your snaps:</p>
      ${tab(['ROLE', 'SNAP SHARE'], [['First String', '88%'], ['Starter', '70%'], ['Rotation', '46%'], ['Second String', '27%'], ['Bench', '10%']])}
      ${note('SNAPS CAP YOUR PERFORMANCE.', 'Below a 12% share your performance cannot exceed 76. Below 22% it caps at 84. Below 35% it caps at 92. You cannot grade out of a role you are not playing in — so climbing the chart early in a season is not a nicety, it is the ceiling on everything downstream, including your national rank.')}
      <p>Starting on the bench and playing your way up inside a season is the normal shape of a year.
      Expect it; do not panic at it.</p>
      <h4>The coach decides your snaps</h4>
      <p>NORMAL on the pregame screen is the share of your unit's snaps the coach trusts you with —
      about <b>half</b> for a stranger, all of them once he trusts you. Ask for more (HEAVY, EVERY
      SNAP) and he gives you a <b>part</b> of the extra, more the more he trusts you; the asking
      itself multiplies your wear and your injury risk, and that multiplier fades to nothing at full
      trust. More trust is more say, and only ever for <i>more</i> snaps.</p>
      <h4>The season grade</h4>
      <p>Your season is compared to a bar that is the <b>highest</b> of: a per-level floor, your
      rating against the level’s benchmark, a prestige term, and a memory of your own last season.
      Two things follow. A low snap share is graded more leniently. And <b>prestige raises the bar you
      are judged against</b> — every success makes the next A harder to earn.</p>
      <h4>Growth and story rolls</h4>
      <p>Growth and story decisions are <b>rolled on a personality-weighted wheel</b>, not chosen.
      Each outcome grades green, neutral or red: green keeps the full gain and can mint a small
      permanent increase, red flips it into a loss. Trust, momentum and composure nudge the odds up.
      <b>Fatigue nudges them down hard</b> — at 70, fatigue is nearly the whole negative swing
      available. Going into a decision week worn is how good seasons turn red.</p>
      <h4>Training</h4>
      <p>Your program sets a priority bonus and decides which stats grow fastest. The game’s own
      recommendation is the one to follow: <b>conditioning</b> if your durability is low for your
      level, otherwise the program covering your <b>weakest weighted stat</b>. Ignore the injury-risk
      lines printed on the program cards — nothing reads that field.</p>
      ${note('TWO THINGS THAT DO NOT MATTER.', 'There is no weather system — “bad weather” is a label on a luck roll with no physics behind it. And home versus away is cosmetic: it changes the schedule glyph and the paint in the end zone, and nothing else. Plan around neither.')}` },

    {
      id: 'ladder', title: 'THE LADDER', sub: 'NINE LEVELS, ONE ROLL AT EACH DOOR', body: `
      ${tab(['LEVEL', 'GM', 'SSNS', 'UP', 'FIELD'], LEVELS.map(([n, name, ages, games, seasons, share, field]) =>
        [`<b>${n}</b> ${name}<small>${ages}</small>`, games, seasons, share, field]), 'rib9-fq-ladder')}
      <p class="rib9-fq-cap">GM = regular-season games. SSNS = seasons you may spend there. UP = the
      share of the level that advances. FIELD = how many players are at that level with you.</p>
      ${note('THE UFF IS NOT THE TOP.', 'The UFF is level 7. Level 8 is the Interstellar League — 96 players, and the call-up is gated behind winning an UFF championship, not merely ranking well.')}
      <p>Playoffs: one round at levels 0–1, two at 2–5, <b>none at the Combine</b>, three at the
      UFF, four at Interstellar. You qualify at a 60% win rate. The shortest possible road to the UFF
      is <b>15 seasons and 133 regular-season games</b>, ages 8 to 23.</p>
      ${note('YOU CANNOT FARM A LEVEL.', 'When your seasons at a level run out, the “play another season” button is simply gone and you must declare. Levels 0 to 2 give you no spare years at all.')}
      <h4>The call-up</h4>
      <p>Your promotion chance follows your <b>national rank</b> against the share of the level that
      advances. The real numbers:</p>
      ${tab(['DOOR', 'LAST MAN IN', '50% AT', 'SINGLE DIGITS PAST'], [
        ['Varsity', '#13,200 of 110,000', '#13,200', '#19,800'],
        ['College', '#1,440 of 16,000', '#1,440', '#2,160'],
        ['Combine', '#480 of 1,500', '#480', '#720'],
        ['UFF → Interstellar', '#5 of 1,700', '#5', '#10 is 4.9%'],
      ], 'rib9-fq-callup')}
      <p>Sitting exactly on the advancing share is a coin flip. Top few hundred in the country and
      you are reading 95–98%. But the roll is <b>capped just short of certain</b> — no rank, not even
      first in the nation, guarantees the call.</p>
      <h4>What sets the rank</h4>
      <p><b>Production first, rating second.</b> Your per-game production against the level’s
      baseline sets your rank; your OVR percentile then multiplies it by up to about 3× either
      way. Production sitting right at the baseline is on a very steep part of the curve, so a small
      change in output moves your rank a long way. Snaps produce production — which is why coach
      trust is a ranking stat.</p>
      ${note('A DECLARE IS ONE SHOT.', 'Miss the roll and the career ends on the spot. There is no retry, no second window, no next week.')}` },

    /* ===== v153 F CHAOS — the endgame dial, explained ===== */
    {
      id: 'chaos', title: 'CHAOS', sub: 'THE ENDGAME DIAL — HARDER WORLD, BIGGER LEGACY', body: `
      <p>Chaos is the game’s hard mode, and it is the fastest way up the Legacy Rank. It lives on the
      <b>RINGS &amp; CHAOS</b> screen (the 💍 DYNASTY button under the prestige tree) and it applies
      to <b>every career</b> you play while it is on — from Pee Wee up.</p>
      <h4>Unlocking it</h4>
      ${list([
        'Win a <b>UFF championship</b> with a player who peaked at <b>85+ OVR</b>, with <b>20 season objectives</b> completed across your careers.',
        'It opens with a <b>capacity of 6</b> chaos points. Win a championship with chaos set to your <b>full</b> capacity and the capacity grows: +6 for a UFF title, +10 for an Interstellar one.',
      ])}
      <h4>What the dials do</h4>
      <p>Every one of the 17 attributes has a dial from 0 to 10. Each point makes the world’s
      players stronger at that stat, and the whole world gets harder with the total: every opponent
      and every rival for your roster spot jumps about 22 OVR the moment the first point goes on,
      and about one more per point after that. Every level’s call-up bar rises with it, and the
      near-automatic promotions of the first three levels are gone. <b>MAXIMUM CHAOS</b> fills your
      whole capacity at once.</p>
      <p>The one gift on the way in: every chaos point raises the <b>attribute cap</b> by 3, so the
      harder the world, the higher your man can climb.</p>
      <h4>What it pays</h4>
      ${tab(['CHAOS', 'PP', 'LEGACY XP'], [
        ['0', '×1', '×1'],
        ['1', '×3.5', '×1.08'],
        ['6 (first capacity)', '×7.3', '×1.48'],
        ['10', '×13', '×1.8'],
        ['20', '×58', '×2.6'],
        ['50+', 'more still', '<b>×5</b> (the cap)'],
      ])}
      ${list([
        '<b>PP:</b> ×3 the moment one point is on, then ×1.16 more for every point — on career ends, titles, challenges and milestones. The prestige tree’s chaos nodes raise it further.',
        '<b>Legacy XP:</b> +8% per chaos point on every season and every career end, up to ×5. The season report and career-end card show it as its own line.',
        'Both are shown live on the Chaos card, and the Legacy multiplier in your trophy case.',
      ])}
      ${note('THE RISK IS REAL.', 'A career that flames out early under chaos banks only part of the PP multiplier — the full bonus is paid to careers that reach the UFF. Opponents are vastly better, so a first year that used to be automatic can end the run. Turn it up a few points at a time, and keep a build that can win at the level you are at.')}
      <p>Any dial can be turned back down at any time on the same screen.</p>` },

    {
      id: 'first', title: 'YOUR FIRST CAREER', sub: 'HOW TO SPEND IT WELL', body: `
      <p>Run 1 starts with attributes around <b>8–12</b>, a potential ceiling of <b>30</b>, one
      star and a soft cap near <b>25</b>. Natural growth stalls as you approach the ceiling: within
      18 points of it, growth runs at <b>12% efficiency</b>. That number is the whole story of a
      first career.</p>
      ${list([
        '<b>Levels 0 through 4 are close to automatic.</b> The advancing shares are enormous (50%, 45%, 35%, 25%, 12% of huge fields), so anything short of a disaster leaves you far inside and your call-up reads around 98%. Expect to walk to Varsity.',
        '<b>College is where a first career usually ends.</b> It wants a rating a first-run player cannot reach. The <i>ceiling</i> is the wall, not the declare roll, and the two spare years generally cannot fix it.',
        '<b>That is the design, not a failure.</b> A finished career pays PP for the vault and Legacy XP — the medals that unlock the tree. A first career is worth about a dozen medals, and a Path unlocks at 12. You are farming the next man, and he starts taller.',
      ])}
      <h4>What the code actually rewards</h4>
      ${num([
        'Spend every point in your position’s weighted stats, heaviest first. The auto-allocate <b>by position</b> button does exactly this. The <b>balanced</b> button spreads across all 17, including stats your rating never reads — that is the trap.',
        'Stay under the soft cap while points cost 1 each. On run 1, spreading beats spiking.',
        'Take the position your rolled body fits. Worth −21 to +13 OVR, free, forever — the largest one-click swing in the game.',
        'Follow the recommended training program.',
        'Build coach trust early. Snap share caps your performance, performance drives your rank, and rank is the declare.',
        'Declare on the <b>last</b> legal season, not the first, unless the number is already high. Check how many seasons you have left — at zero, the choice is gone.',
      ])}
      <h4>How runs get wasted</h4>
      ${list([
        'Spreading points across all 17 attributes.',
        'Declaring early at middling odds.',
        'Picking a position your body does not fit.',
        'Ignoring coach trust and spending a whole level under the snap-share cap.',
        'Buying team-quality nodes and expecting them to carry you — the entire maxed set is about 1.4 points a game.',
      ], 'rib9-fq-bad')}
      <p class="rib9-fq-sign">Now go get hit.</p>` },
  ];

  // ---- state: the open accordions live here, not in the DOM --------------------
  const openIds = new Set();
  let opener = null;

  const chev = '<svg class="rib9-fq-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 10l5 5 5-5"/></svg>';

  function markup() {
    return `<div class="rib9-fq-shell">
      <header class="rib9-fq-top">
        <div class="rib9-fq-title"><span class="rib9-mark">RIB</span><div><b>HOW TO PLAY</b><small>THE COACH’S VERSION</small></div></div>
        <button class="rib9-fq-close" type="button" data-fq-close aria-label="Close how to play">CLOSE <i>×</i></button>
      </header>
      <p class="rib9-fq-lede">One player, one career, nine levels that each keep only a share of the
      men in them. Everything below is how the simulation really behaves, and every number in it is
      the game’s own — tap a heading to open it.</p>
      <div class="rib9-fq-secs">
        ${SECTIONS.map((s, i) => {
          const on = openIds.has(s.id);
          return `<section class="rib9-fq-sec${on ? ' on' : ''}" data-fq-sec="${s.id}">
            <h3><button class="rib9-fq-head" type="button" data-fq="${s.id}" id="fq-h-${s.id}" aria-expanded="${on}" aria-controls="fq-b-${s.id}">
              <i class="rib9-fq-n">${String(i + 1).padStart(2, '0')}</i>
              <span><b>${esc(s.title)}</b><small>${esc(s.sub)}</small></span>${chev}</button></h3>
            <div class="rib9-fq-body" id="fq-b-${s.id}" role="region" aria-labelledby="fq-h-${s.id}"${on ? '' : ' hidden'}>${s.body}</div>
          </section>`;
        }).join('')}
      </div>
      <footer class="rib9-fq-foot">
        <button class="rib9-fq-back" type="button" data-fq-close>‹ BACK TO THE MENU</button>
        <span>BUILD A PLAYER. EARN EVERY REP. CHASE THE LEAGUE.</span>
      </footer>
    </div>`;
  }

  function toggle(id, force) {
    const root = document.getElementById(ID); if (!root) return;
    const head = root.querySelector(`[data-fq="${id}"]`), sec = root.querySelector(`[data-fq-sec="${id}"]`);
    const body = document.getElementById('fq-b-' + id);
    if (!head || !body || !sec) return;
    const on = force === undefined ? !openIds.has(id) : !!force;
    if (on) openIds.add(id); else openIds.delete(id);
    head.setAttribute('aria-expanded', String(on));
    body.hidden = !on;
    sec.classList.toggle('on', on);
  }

  function bind(root) {
    root.addEventListener('click', (event) => {
      const close = event.target.closest('[data-fq-close]');
      if (close) { event.preventDefault(); closeGuide(); return; }
      const head = event.target.closest('[data-fq]');
      if (head && root.contains(head)) { event.preventDefault(); toggle(head.dataset.fq); }
    });
    // the guide is a modal view: escape leaves, tab stays inside it
    root.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); closeGuide(); return; }
      if (event.key !== 'Tab') return;
      const stops = [...root.querySelectorAll('button')].filter((b) => b.offsetParent !== null);
      if (!stops.length) return;
      const first = stops[0], last = stops[stops.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
  }

  function openGuide() {
    if (document.getElementById(ID)) return true;
    opener = document.activeElement && document.activeElement.closest ? document.activeElement.closest(OPENER) : null;
    const root = document.createElement('div');
    root.id = ID;
    root.className = 'rib9-fq';
    root.setAttribute('role', 'dialog');
    root.setAttribute('aria-modal', 'true');
    root.setAttribute('aria-label', 'How to play');
    root.tabIndex = -1;
    root.innerHTML = markup();
    document.body.appendChild(root);
    document.body.classList.add('rib-howto-open');
    bind(root);
    (root.querySelector('.rib9-fq-close') || root).focus({ preventScroll: true });
    return true;
  }

  function closeGuide() {
    const root = document.getElementById(ID);
    if (!root) return false;
    root.remove();
    document.body.classList.remove('rib-howto-open');
    // the menu re-renders itself constantly, so the button we came from may be a different node
    const back = (opener && opener.isConnected && opener) || document.querySelector('#rib-main-menu-v2 ' + OPENER);
    opener = null;
    if (back) { try { back.focus({ preventScroll: true }); } catch (e) { /* focus is a nicety */ } }
    return true;
  }

  // the guide never outlives the menu it opened over
  window.addEventListener('rib-menu-unmounted', () => { if (document.getElementById(ID)) closeGuide(); });

  window.__RIB_HOWTO = {
    open: openGuide,
    close: closeGuide,
    toggle,
    get isOpen() { return !!document.getElementById(ID); },
    get openSections() { return [...openIds]; },
    sections: SECTIONS.map((s) => s.id),
  };
})();
