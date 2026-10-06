// Dev check (v123 THE LEAGUE HAS A MAP): the league's names.
//
// Pure Node — lifts LOGO_DB / LOGO_RULES and the v123 town and mascot pools straight
// out of index.html, so no dev server is needed. Asserts:
//   * the pools are big and have no duplicates (120+ towns, 80+ mascots)
//   * EVERY mascot is matched by a LOGO_RULES pattern — none falls through to
//     logoForName's hash, which is what used to put an eagle on the Buffaloes
//   * the emblem each mascot resolves to is the RIGHT one, mascot by mascot
//     (EXPECT below is the whole table; a new mascot must be added to it)
//   * no generated team name — town + mascot, at any level, and no DFL club —
//     is a real NFL or major college team, and no town is an NFL host city
//   * the college suffixes and the fifty DFL clubs are well formed and unique
//   * v188: no kit palette reproduces a real NFL or major college team's two colours
import fs from "node:fs";
import vm from "node:vm";
import { readGameHtml } from './lib/layout.mjs'   // v149 A: index.html + src/ put back together

const html = readGameHtml();
function grab(head, tail) {
  const i = html.indexOf(head); if (i < 0) throw new Error("missing " + head);
  const j = html.indexOf(tail, i); if (j < 0) throw new Error("missing end of " + head);
  return html.slice(i, j + tail.length);
}
const ctx = vm.createContext({ Math, Array, String });
vm.runInContext([
  grab("const LOGO_DB = [", "\n];"),
  grab("const LOGO_RULES = [", "\n];"),
  // v149 C: the career app is formatted (docs/NAMES.md); one `const TOWNS = [...], MASCOTS = [...]` ends on "Octopi" (Ga → TOWNS, er → MASCOTS, Xs → newTeamIdentity)
  grab("const TOWNS = [", '"Octopi"') + "];",
  grab("const COLLEGE_V123 = [", "];"),
  html.slice(html.indexOf("function dflClubV123"), html.indexOf("function newTeamIdentity()")),
  "globalThis.OUT={LOGO_DB,LOGO_RULES,Ga:TOWNS,er:MASCOTS,COLLEGE_V123,DFL_V123,dflClubV123};",
].join("\n"), ctx);
const { LOGO_DB, LOGO_RULES, Ga, er, COLLEGE_V123, DFL_V123 } = ctx.OUT;

const fails = [];
const ok = (cond, msg) => { if (!cond) fails.push(msg); };
const emblem = (name) => {
  const s = String(name).toLowerCase();
  for (let i = 0; i < LOGO_RULES.length; i++) if (LOGO_RULES[i][0].test(s)) return LOGO_DB[LOGO_RULES[i][1]].n;
  return null;                                   // null = it would fall through to the hash
};

/* mascot -> the emblem it MUST wear. Every entry was read off the packed sheet. */
const EXPECT = {
  Bulldogs: "Jackal", Mustangs: "Unicorn", Wolverines: "Hyena", Firebirds: "Phoenix", Tigers: "Tiger",
  Hornets: "Hornet", Rebels: "Outlaw", Yetis: "Yeti", Pirates: "Pirate", Bearcats: "Grizzly",
  Steers: "Longhorn", Thunder: "Storm", Wildcats: "Panther", Miners: "Mine", Rockets: "Meteor",
  Wolves: "Wolf", Grizzlies: "Grizzly", Panthers: "Panther", Eagles: "Eagle", Gators: "Gator",
  Sharks: "Shark", Bulls: "Bull", Warthogs: "Boar", Rams: "Ram", Bison: "Bison",
  Lions: "Lion", Jaguars: "Jaguar", Hawks: "Hawk", Cobras: "Cobra", Dragons: "Dragon",
  Rhinos: "Rhino", Phoenix: "Phoenix", Krakens: "Kraken", Gorillas: "Gorilla", Owls: "Owl",
  Scorpions: "Scorpion", Mantises: "Mantis", Coyotes: "Hyena", Stags: "Stag", Jackals: "Jackal",
  Broncos: "Unicorn", Spartans: "Spartan", Knights: "Knight", Vikings: "Viking", Samurai: "Samurai",
  Trojans: "Trojan", Monarchs: "King", Barbarians: "Barbarian", Cavaliers: "Cavalier", Paladins: "Paladin",
  Corsairs: "Pirate", Outlaws: "Outlaw", Reapers: "Reaper", Golems: "Golem", Blizzard: "Frost Knight",
  Sorcerers: "Sorcerer", Emperors: "King", Crows: "Crow", Berserkers: "Berserker", Wyverns: "Wyvern",
  Drakes: "Drake", Valkyries: "Valkyrie", Inferno: "Wildfire", Bees: "Killer Bee", Widows: "Widow",
  Fireflies: "Firefly", Centipedes: "Centipede", Crabs: "Crab", Sasquatch: "Sasquatch", Meteors: "Meteor",
  Lumberjacks: "Lumberjack", Anglers: "Angler", "Polar Bears": "Polar Bear", Phantoms: "Phantom", Demons: "Demon",
  Eclipse: "Moon Knight", Icebergs: "Iceberg", Volcanoes: "Volcano", Express: "Express", Anvils: "Forge",
  Drillers: "Oiler", Summits: "Summit", Swampers: "Swamp Thing", Beacons: "Lighthouse", Invaders: "Invader",
  Hydras: "Sea Serpent", Voltage: "Bolt", Octopi: "Octopus",
};

ok(Ga.length >= 120, `towns ${Ga.length} < 120`);
ok(er.length >= 80, `mascots ${er.length} < 80`);
ok(new Set(Ga).size === Ga.length, "duplicate town");
ok(new Set(er).size === er.length, "duplicate mascot");

const missed = [], wrong = [];
for (const m of er) {
  const got = emblem(m);
  if (got === null) { missed.push(m); continue; }
  if (!EXPECT[m]) { wrong.push(`${m}: not in EXPECT (add it)`); continue; }
  if (got !== EXPECT[m]) wrong.push(`${m}: wears ${got}, expected ${EXPECT[m]}`);
}
ok(missed.length === 0, "mascots with NO emblem rule (hash fallback): " + missed.join(", "));
ok(wrong.length === 0, "mascot/emblem mismatch: " + wrong.join(" | "));

/* ---- no real team ---- */
const NFL = { Arizona: "Cardinals", Atlanta: "Falcons", Baltimore: "Ravens", Buffalo: "Bills", Carolina: "Panthers",
  Chicago: "Bears", Cincinnati: "Bengals", Cleveland: "Browns", Dallas: "Cowboys", Denver: "Broncos",
  Detroit: "Lions", "Green Bay": "Packers", Houston: "Texans", Indianapolis: "Colts", Jacksonville: "Jaguars",
  "Kansas City": "Chiefs", "Las Vegas": "Raiders", "Los Angeles": "Rams", Miami: "Dolphins", Minnesota: "Vikings",
  "New England": "Patriots", "New Orleans": "Saints", "New York": "Giants", Philadelphia: "Eagles",
  Pittsburgh: "Steelers", "San Francisco": "49ers", Seattle: "Seahawks", "Tampa Bay": "Buccaneers",
  Tennessee: "Titans", Washington: "Commanders" };
const COLLEGE_REAL = ["Alabama Crimson Tide", "Ohio State Buckeyes", "Michigan Wolverines", "Georgia Bulldogs",
  "Texas Longhorns", "Oklahoma Sooners", "Notre Dame Fighting Irish", "Clemson Tigers", "LSU Tigers",
  "Auburn Tigers", "Florida Gators", "Penn State Nittany Lions", "Oregon Ducks", "Washington Huskies",
  "Wisconsin Badgers", "Nebraska Cornhuskers", "Tennessee Volunteers", "Miami Hurricanes", "Florida State Seminoles",
  "USC Trojans", "UCLA Bruins", "Texas A&M Aggies", "Michigan State Spartans", "Iowa Hawkeyes",
  "Arkansas Razorbacks", "Kentucky Wildcats", "Missouri Tigers", "Baylor Bears", "TCU Horned Frogs",
  "Utah Utes", "BYU Cougars", "Colorado Buffaloes", "Arizona State Sun Devils", "Kansas State Wildcats",
  "Oklahoma State Cowboys", "Virginia Tech Hokies", "North Carolina Tar Heels", "Duke Blue Devils",
  "Louisville Cardinals", "Pittsburgh Panthers", "Syracuse Orange", "Boston College Eagles",
  "West Virginia Mountaineers", "Purdue Boilermakers", "Illinois Fighting Illini", "Minnesota Golden Gophers",
  "Indiana Hoosiers", "Maryland Terrapins", "Rutgers Scarlet Knights", "Northwestern Wildcats",
  "Mississippi State Bulldogs", "Ole Miss Rebels", "South Carolina Gamecocks", "Vanderbilt Commodores",
  "Houston Cougars", "Cincinnati Bearcats", "UCF Knights", "Boise State Broncos", "Memphis Tigers",
  "Navy Midshipmen", "Army Black Knights", "Air Force Falcons", "Stanford Cardinal", "California Golden Bears",
  "Oregon State Beavers", "Washington State Cougars", "Texas Tech Red Raiders", "Iowa State Cyclones",
  "Kansas Jayhawks", "Wake Forest Demon Deacons", "NC State Wolfpack", "Virginia Cavaliers", "Georgia Tech Yellow Jackets"];
const real = new Set([...Object.entries(NFL).map(([c, n]) => `${c} ${n}`), ...COLLEGE_REAL].map(s => s.toLowerCase()));
const nflCity = new Set(Object.keys(NFL).map(s => s.toLowerCase()));

const clash = [], cityClash = [];
for (const t of Ga) {
  if (nflCity.has(t.toLowerCase())) cityClash.push(t);
  for (const m of er) if (real.has(`${t} ${m}`.toLowerCase())) clash.push(`${t} ${m}`);
  for (const c of COLLEGE_V123) if (real.has(`${t} ${c}`.toLowerCase())) clash.push(`${t} ${c}`);
}
ok(cityClash.length === 0, "town is an NFL host city: " + cityClash.join(", "));
ok(clash.length === 0, "generated name is a real team: " + clash.join(", "));

/* ---- v188: no real team's COLOURS ----
 * A team's look is its name, its emblem and its colours together; the kit palettes (TEAM_PALETTES, the emblem-matched
 * 40–52 included) must not reproduce a real NFL or major college pair. A palette fails when BOTH its colours sit within
 * ΔRGB 40 of a real team's two colours (either order). */
const palSrc = (() => { const i = html.indexOf("const TEAM_PALETTES = window.TEAM_PALETTES = ["); const j = html.indexOf("]];", i); return html.slice(i, j + 3); })();
const PALS = [...palSrc.matchAll(/\[("#[0-9a-fA-F]{6}"(?:,"#[0-9a-fA-F]{6}")*)\]/g)].map(m => m[1].split(",").map(x => x.replace(/"/g, "")));
const REAL_COLOURS = {
  Cardinals: ["#97233f", "#ffb612"], Falcons: ["#a71930", "#000000"], Ravens: ["#241773", "#9e7c0c"], Bills: ["#00338d", "#c60c30"],
  Panthers: ["#0085ca", "#101820"], Bears: ["#0b162a", "#c83803"], Bengals: ["#fb4f14", "#000000"], Browns: ["#311d00", "#ff3c00"],
  Cowboys: ["#003594", "#869397"], Broncos: ["#fb4f14", "#002244"], Lions: ["#0076b6", "#b0b7bc"], Packers: ["#203731", "#ffb612"],
  Texans: ["#03202f", "#a71930"], Colts: ["#002c5f", "#a2aaad"], Jaguars: ["#006778", "#d7a22a"], Chiefs: ["#e31837", "#ffb81c"],
  Raiders: ["#000000", "#a5acaf"], Chargers: ["#0080c6", "#ffc20e"], Rams: ["#003594", "#ffa300"], Dolphins: ["#008e97", "#fc4c02"],
  Vikings: ["#4f2683", "#ffc62f"], Patriots: ["#002244", "#c60c30"], Saints: ["#d3bc8d", "#101820"], Giants: ["#0b2265", "#a71930"],
  Jets: ["#125740", "#ffffff"], Eagles: ["#004c54", "#a5acaf"], Steelers: ["#ffb612", "#101820"], "49ers": ["#aa0000", "#b3995d"],
  Seahawks: ["#002244", "#69be28"], Buccaneers: ["#d50a0a", "#34302b"], Titans: ["#0c2340", "#4b92db"], Commanders: ["#5a1414", "#ffb612"],
  Texas: ["#bf5700", "#ffffff"], Alabama: ["#9e1b32", "#ffffff"], "Ohio State": ["#bb0000", "#666666"], Michigan: ["#00274c", "#ffcb05"],
  Georgia: ["#ba0c2f", "#000000"], Oklahoma: ["#841617", "#fdf9d8"], Clemson: ["#f56600", "#522d80"], LSU: ["#461d7c", "#fdd023"],
  Auburn: ["#0c2340", "#e87722"], Florida: ["#fa4616", "#0021a5"], Oregon: ["#154733", "#fee123"], USC: ["#990000", "#ffc72c"],
  "Michigan State": ["#18453b", "#ffffff"], Arkansas: ["#9d2235", "#ffffff"], Tennessee: ["#ff8200", "#ffffff"], "Notre Dame": ["#0c2340", "#c99700"],
  Miami: ["#f47321", "#005030"], "Florida State": ["#782f40", "#ceb888"], "Penn State": ["#041e42", "#ffffff"], Colorado: ["#000000", "#cfb87c"],
};
const rgb = h => [1, 3, 5].map(k => parseInt(h.slice(k, k + 2), 16));
const near = (a, b) => { const x = rgb(a), y = rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]) < 40; };
const colourClash = [];
PALS.forEach((P, i) => {
  for (const [team, [c1, c2]] of Object.entries(REAL_COLOURS))
    if ((near(P[0], c1) && near(P[1], c2)) || (near(P[0], c2) && near(P[1], c1))) colourClash.push(`palette ${i} ${P[0]}/${P[1]} ≈ ${team} ${c1}/${c2}`);
});
ok(PALS.length >= 50, `palettes found ${PALS.length} < 50`);
ok(colourClash.length === 0, "a kit palette reproduces a real team's colours: " + colourClash.join(" | "));

/* ---- the DFL ---- */
ok(DFL_V123.length === 50, `DFL clubs ${DFL_V123.length} != 50`);
ok(new Set(DFL_V123).size === 50, "duplicate DFL club");
const dflBad = DFL_V123.filter(c => emblem(c.split(" ").pop()) === null || real.has(c.toLowerCase()));
ok(dflBad.length === 0, "DFL club with no emblem or a real name: " + dflBad.join(", "));
ok(COLLEGE_V123.length >= 6, `college suffixes ${COLLEGE_V123.length} < 6`);

const out = {
  towns: Ga.length, mascots: er.length, colleges: COLLEGE_V123.length, dfl: DFL_V123.length,
  emblemsUsed: new Set(er.map(emblem)).size, hashFallbacks: missed.length, mismatches: wrong.length,
  realTeamClashes: clash.length + cityClash.length,
  sampleYouth: [0, 37, 91].map(i => `${Ga[i]} ${er[i % er.length]}`),
  sampleCollege: [0, 37, 91].map(i => `${Ga[i]} ${COLLEGE_V123[i % COLLEGE_V123.length]}`),
  sampleDFL: DFL_V123.slice(0, 6),
};
console.log(JSON.stringify(out, null, 2));
if (fails.length) { console.log("\nFAIL:\n" + fails.map(f => "  ✗ " + f).join("\n")); process.exit(1); }
console.log("\n✓ namecheck: " + er.length + " mascots, every one on its own emblem, no real team");
