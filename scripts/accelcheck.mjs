// Dev check: v164 I THE START IS EARNED (src/04-engine.js `evolveSpeed`, `accelerationTest`). Pure Node, no roll.
// For ratings 25 / 50 / 60 / 75 / 90 (accel = burst = agility) it prints the time to 50 / 80 / 90% of top speed,
// the yards covered at 0.5 / 1.0 / 1.5 sim-seconds, the yards to 90% and the 0-10 yard split — sim ms, and real
// seconds (× TU simClockReal 2.5). Asserts: elite < mid < low on every time; the realism band (time to 90% between
// 0.8 and 2.2 real seconds at every rating); the 0-10 yard split spreads at least 0.15 real s from 25 to 90; the
// kill switch (TU accelV164 0) is the old near-instant v38 ramp.   node scripts/accelcheck.mjs
import fs from "node:fs";
import vm from "node:vm";
const src = fs.readFileSync(new URL("../src/04-engine.js", import.meta.url), "utf8");
const load = (tune) => { const ctx = vm.createContext({ console, Math }); ctx.window = ctx; ctx.globalThis = ctx; ctx.RIB_TUNE = Object.assign({}, tune || {});
  vm.runInContext(src, ctx, { filename: "04-engine.js" }); ctx.__getGridironState = () => ({ player: { level: 4 } }); return ctx; };
let pass = 0, fail = 0;
const ok = (c, m, d) => { console.log((c ? "ok   " : "FAIL ") + m + (d !== undefined ? "  " + (typeof d === "string" ? d : JSON.stringify(d)) : "")); c ? pass++ : fail++; };
const R = [25, 50, 60, 75, 90], REAL = 2.5;
const on = load({}), off = load({ accelV164: 0 });
const row = (ctx) => R.map((r) => ctx.__FieldSim._accelTest(r, r, r));
const A = row(on), B = row(off), s = (ms) => +(ms * REAL / 1000).toFixed(2);
console.log("rating | t50 t80 t90 (real s) | yd@0.5 yd@1.0 yd@1.5 (sim s) | yd to 90% | 0-10 yd split (real s) || OFF t90");
A.forEach((a, i) => console.log(`${String(R[i]).padStart(6)} | ${s(a.t50)} ${s(a.t80)} ${s(a.t90)} | ${a.yd05} ${a.yd10} ${a.yd15} | ${a.ydTo90} | ${s(a.split10Ms)} || ${s(B[i].t90)}`));
const inc = (k) => A.every((a, i) => i === 0 || a[k] <= A[i - 1][k]) && A[0][k] > A[A.length - 1][k];
ok(inc("t50") && inc("t80") && inc("t90") && inc("split10Ms"), "a better rating gets there sooner on every measure (t50, t80, t90, the 0-10 split)", A.map((a) => s(a.t90)).join(" > "));
ok(A.every((a) => s(a.t90) >= 0.8 && s(a.t90) <= 2.2), "the realism band: 90% of top speed takes 0.8-2.2 real seconds at every rating", A.map((a) => s(a.t90)).join(","));
ok(s(A[0].split10Ms) - s(A[4].split10Ms) >= 0.15, "the 0-10 yard split spreads at least 0.15 real s from a 25 to a 90", { low: s(A[0].split10Ms), elite: s(A[4].split10Ms) });
ok(A.every((a) => a.brake50 === B[R.indexOf(a.accel)].brake50), "braking is untouched", A.map((a) => a.brake50).join(","));
ok(B.every((b) => s(b.t90) < 0.7), "TU accelV164 0: the old near-instant ramp (every rating under 0.7 real s)", B.map((b) => s(b.t90)).join(","));
// ---- past the wall: sheet 215..600 through the career app's curve (07 simScaleV141, copied — keep in step) and HIS
// tail (04 makeAgents' g(): 99 + M·x/(x+T)); every step up the sheet must still move him, with diminishing returns
const simScale = (v) => { const w = 215; return v <= w ? 99 * (1 - Math.exp(-v / 78)) : 99 * (1 - Math.exp(-w / 78)) + Math.pow(v - w, 0.93) * 0.83; };
const tail = (v) => v <= 99 ? v : 99 + 30 * (v - 99) / (v - 99 + 120);
const SHEET = [215, 250, 300, 400, 600];
const H = SHEET.map((v) => { const r = tail(simScale(v)); const a = on.__FieldSim._accelTest(r, r, r); return { sheet: v, eng: +r.toFixed(1), t90: s(a.t90), split: s(a.split10Ms), top: Math.round(92 + r * 0.85) }; });
console.log("sheet | engine rating | t90 (real s) | 0-10 split (real s) | top speed px/s");
H.forEach((h) => console.log(`${String(h.sheet).padStart(5)} | ${h.eng} | ${h.t90} | ${h.split} | ${h.top}`));
ok(H.every((h, i) => i === 0 || (h.eng > H[i - 1].eng && h.split < H[i - 1].split && h.top >= H[i - 1].top)), "past the wall every step up the sheet still makes him quicker off the line and faster (250 → 400 → 600 all differ)", H.map((h) => h.split).join(" > "));
const g1 = H[2].split - H[3].split, g2 = H[3].split - H[4].split;
ok(g1 > 0 && g2 > 0 && g2 / 200 < g1 / 100, "with diminishing returns (per sheet point, 400 → 600 buys less than 300 → 400)", { "300→400": +g1.toFixed(3), "400→600": +g2.toFixed(3) });
ok(H[H.length - 1].t90 >= 0.7 && H[H.length - 1].top <= 200, "and never superhuman: a 600 sheet still takes >= 0.7 real s to 90% and tops out under 200 px/s", H[H.length - 1]);
console.log(JSON.stringify({ pass, fail, pageErrors: 0 }));
process.exit(fail ? 1 : 0);
