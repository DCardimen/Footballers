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
import fs from "node:fs";
import vm from "node:vm";

const html = fs.readFileSync(new URL("../index.html", import.meta.url), "utf8");
function grab(head, tail) {
  const i = html.indexOf(head); if (i < 0) throw new Error("missing " + head);
  const j = html.indexOf(tail, i); if (j < 0) throw new Error("missing end of " + head);
  return html.slice(i, j + tail.length);
}
const ctx = vm.createContext({ Math, Array, String });
vm.runInContext([
  grab("const LOGO_DB = [", "\n];"),
  grab("const LOGO_RULES = [", "\n];"),
  grab("const Ga=[", '"Octopi"];'),
  grab("const COLLEGE_V123=[", "];"),
  html.slice(html.indexOf("function dflClubV123"), html.indexOf("function Xs()")),
  "globalThis.OUT={LOGO_DB,LOGO_RULES,Ga,er,COLLEGE_V123,DFL_V123,dflClubV123};",
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
  Longhorns: "Longhorn", Thunder: "Storm", Wildcats: "Panther", Miners: "Mine", Rockets: "Meteor",
  Wolves: "Wolf", Grizzlies: "Grizzly", Panthers: "Panther", Eagles: "Eagle", Gators: "Gator",
  Sharks: "Shark", Bulls: "Bull", Razorbacks: "Boar", Rams: "Ram", Bison: "Bison",
  Lions: "Lion", Jaguars: "Jaguar", Hawks: "Hawk", Cobras: "Cobra", Dragons: "Dragon",
  Rhinos: "Rhino", Phoenix: "Phoenix", Krakens: "Kraken", Gorillas: "Gorilla", Owls: "Owl",
  Scorpions: "Scorpion", Mantises: "Mantis", Coyotes: "Hyena", Stags: "Stag", Jackals: "Jackal",
  Broncos: "Unicorn", Spartans: "Spartan", Knights: "Knight", Vikings: "Viking", Samurai: "Samurai",
  Trojans: "Trojan", Monarchs: "King", Barbarians: "Barbarian", Cavaliers: "Cavalier", Paladins: "Paladin",
  Buccaneers: "Pirate", Outlaws: "Outlaw", Reapers: "Reaper", Golems: "Golem", Blizzard: "Frost Knight",
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
