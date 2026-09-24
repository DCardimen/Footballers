/* ===== v15.8: persistent season rosters + prestige roster department ===== */
(function () {
  'use strict';
  const C = (v, a, b) => Math.max(a, Math.min(b, v));
  const UPGRADES = {
    recruiting: {
      name: 'Recruiting Department',
      desc: 'Raises incoming freshman quality and reduces weak depth players.',
      max: 10,
      base: 3
    },
    qbGuru: { name: 'QB Guru', desc: 'Improves QB awareness, throwing and development odds.', max: 8, base: 4 },
    skillLab: {
      name: 'Skill Position Lab',
      desc: 'Improves RB, WR and TE speed, agility and catching.',
      max: 8,
      base: 4
    },
    trench: {
      name: 'Trench Development',
      desc: 'Improves offensive and defensive line strength, blocking and tackling.',
      max: 8,
      base: 4
    },
    dbAcademy: { name: 'DB Academy', desc: 'Improves CB/S speed, awareness, pursuit and tackling.', max: 8, base: 4 },
    strength: {
      name: 'Strength Program',
      desc: 'Raises strength, weight efficiency and tackle power across the roster.',
      max: 10,
      base: 3
    },
    sportsScience: {
      name: 'Sports Science',
      desc: 'Improves development while reducing fatigue and injury regression.',
      max: 8,
      base: 5
    },
    facilities: {
      name: 'Facilities',
      desc: 'Improves all development and makes stars more likely to return.',
      max: 10,
      base: 4
    },
    portal: {
      name: 'Transfer Portal Influence',
      desc: 'Adds a better chance to replace roster holes with immediate contributors.',
      max: 6,
      base: 6
    },
    leadership: {
      name: 'Leadership Program',
      desc: 'Raises awareness, chemistry and consistency for returning starters.',
      max: 8,
      base: 4
    },
    scouting: {
      name: 'Scouting Department',
      desc: 'Reveals development traits and improves position-fit accuracy.',
      max: 6,
      base: 5
    },
    retention: {
      name: 'Player Retention',
      desc: 'Reduces unexpected transfers and preserves experienced depth.',
      max: 6,
      base: 6
    }
  };
  function state() {
    try {
      return window.__GRIDIRON_AUDIT__?.getState?.() || window.o || null;
    } catch (e) {
      return null;
    }
  }
  function seasonKey(p) {
    return [p?.level || 0, p?.seasonSeed || 0, p?.seasonNumber || p?.seasonsAtLevel || 0].join(':');
  }
  function ensureMeta(roster, seed) {
    const years = ['FR', 'SO', 'JR', 'SR'];
    roster.forEach((x, i) => {
      if (x.year == null) x.year = years[(seed + i * 7) % 4];
      if (x.jersey == null) x.jersey = 1 + ((seed + i * 13) % 99);
      if (x.devTrait == null) {
        const n = (seed + i * 17) % 100;
        x.devTrait =
          n < 5
            ? 'Generational'
            : n < 17
              ? 'Superstar'
              : n < 38
                ? 'Fast'
                : n < 82
                  ? 'Normal'
                  : n < 94
                    ? 'Slow'
                    : 'Bust';
      }
      if (x.potential == null)
        x.potential = C(
          x.ovr + ({ Generational: 24, Superstar: 17, Fast: 11, Normal: 6, Slow: 3, Bust: 0 }[x.devTrait] || 5),
          1,
          999
        );
      if (x.hometown == null)
        x.hometown = ['Indiana', 'Ohio', 'Texas', 'Florida', 'Georgia', 'California', 'Michigan', 'Pennsylvania'][
          (seed + i * 5) % 8
        ];
    });
    return roster;
  }
  function upgradeLevel(k) {
    const s = state();
    s.rosterPrestigeV158 = s.rosterPrestigeV158 || {};
    return s.rosterPrestigeV158[k] || 0;
  }
  function applyProgramBoost(roster) {
    const q = upgradeLevel('qbGuru'),
      sk = upgradeLevel('skillLab'),
      tr = upgradeLevel('trench'),
      db = upgradeLevel('dbAcademy'),
      st = upgradeLevel('strength'),
      lead = upgradeLevel('leadership');
    roster.forEach(p => {
      let boost = 0;
      if (p.pos === 'QB') boost += q * 0.22;
      if (['RB', 'WR', 'TE'].includes(p.pos)) boost += sk * 0.18;
      if (['LT', 'LG', 'C', 'RG', 'RT', 'DT', 'EDGE'].includes(p.pos)) boost += tr * 0.18;
      if (['CB', 'S'].includes(p.pos)) boost += db * 0.2;
      boost += st * 0.08 + lead * 0.05;
      p.programBoostV158 = boost;
    });
  }
  function ensureUserRoster() {
    const s = state(),
      p = s?.player;
    if (!p || !window.__GRIDIRON_GENERATE_ROSTER_V157) return null;
    const key = seasonKey(p);
    p.rosterHistoryV158 = p.rosterHistoryV158 || {};
    if (!p.teamRosterV158 || p.teamRosterSeasonV158 !== key) {
      // v20: the roster displays on the SAME scale the sim plays at (Wr's per-level
      // team baseline), so pregame comparisons stop mixing scales
      const target = Math.round(
        Number(p.teamOvr || p.teamRating || p.schoolRating) || [18, 30, 42, 54, 66, 78, 86, 90][p.level || 0] || 55
      );
      let pack = window.__GRIDIRON_GENERATE_ROSTER_V157(target, (p.seasonSeed || 1) + (p.level || 0) * 1009);
      ensureMeta(pack.players, p.seasonSeed || 1);
      applyProgramBoost(pack.players);
      p.teamRosterV158 = pack.players;
      p.teamRosterSeasonV158 = key;
      p.rosterHistoryV158[key] = JSON.parse(JSON.stringify(pack.players));
    }
    return p.teamRosterV158;
  }
  function teamSummary(roster) {
    const avg = roster.reduce((a, b) => a + b.ovr, 0) / Math.max(1, roster.length),
      stars = roster.filter(x => x.tier === 'star').length,
      returning = roster.filter(x => x.year !== 'SR').length;
    const groups = {
      QB: ['QB'],
      SKILL: ['RB', 'WR', 'TE'],
      OL: ['LT', 'LG', 'C', 'RG', 'RT'],
      FRONT: ['EDGE', 'DT', 'LB'],
      DB: ['CB', 'S'],
      ST: ['K', 'P']
    };
    const grades = {};
    Object.entries(groups).forEach(([k, v]) => {
      const a = roster.filter(x => v.includes(x.pos));
      grades[k] = a.length ? a.reduce((s, x) => s + x.ovr, 0) / a.length : avg;
    });
    return { avg, stars, returning, grades };
  }
  function grade(v, avg) {
    const d = v - avg;
    return d >= 10 ? 'A+' : d >= 6 ? 'A' : d >= 3 ? 'B+' : d >= 0 ? 'B' : d >= -3 ? 'C+' : d >= -7 ? 'C' : 'D';
  }
  function renderRoster() {
    const roster = ensureUserRoster() || [],
      sum = teamSummary(roster);
    return `<div class="rp-note-v158">This roster is generated once at the start of the season and remains intact through every game. Ratings may develop, fatigue or decline, but players are only added or removed during the offseason.</div><div class="rp-grid-v158"><div class="rp-stat-v158"><b>${Math.round(sum.avg)}</b><small>ROSTER AVG</small></div><div class="rp-stat-v158"><b>${sum.stars}</b><small>STAR PLAYERS</small></div><div class="rp-stat-v158"><b>${sum.returning}/22</b><small>PROJECTED RETURNERS</small></div></div><div class="card tight"><div class="h2" style="margin-top:0">Unit Composition</div>${Object.entries(
      sum.grades
    )
      .map(
        ([k, v]) => `<div class="contract-row"><span>${k}</span><b>${grade(v, sum.avg)} · ${Math.round(v)}</b></div>`
      )
      .join(
        ''
      )}</div><div class="card tight"><div class="h2" style="margin-top:0">Persistent Depth Chart</div>${roster.map(p => `<div class="rp-pos-v158"><b>${p.pos}</b><span class="${p.star ? 'star' : ''}">${p.name} <small>#${p.jersey} · ${p.year}</small></span><span>${p.ovr} OVR</span><span class="rp-tier-v158">${p.devTrait}</span></div>`).join('')}</div>`;
  }
  function cost(k) {
    const u = UPGRADES[k],
      lv = upgradeLevel(k);
    return Math.round(u.base * (1 + lv * 0.7));
  }
  function renderUpgrades() {
    const s = state();
    return `<div class="rp-note-v158">Roster prestige is permanent across careers. These upgrades change recruiting classes, development, retention and positional composition—not just a single team-overall number.</div><div class="rp-grid-v158"><div class="rp-stat-v158"><b>${Math.round(s?.pp || 0)}</b><small>PRESTIGE POINTS</small></div><div class="rp-stat-v158"><b>${upgradeLevel('recruiting')}</b><small>RECRUITING</small></div><div class="rp-stat-v158"><b>${upgradeLevel('facilities')}</b><small>FACILITIES</small></div></div>${Object.entries(
      UPGRADES
    )
      .map(([k, u]) => {
        const lv = upgradeLevel(k),
          c = cost(k);
        return `<div class="rp-upgrade-v158"><div><b>${u.name} · ${lv}/${u.max}</b><small>${u.desc}</small></div><button ${lv >= u.max || Number(s?.pp || 0) < c ? 'disabled' : ''} onclick="buyRosterPrestigeV158('${k}')">${lv >= u.max ? 'MAX' : c + ' PP'}</button></div>`;
      })
      .join('')}`;
  }
  window.openRosterPrestigeV158 = function (tab) {
    document.getElementById('rosterPrestigeV158')?.remove();
    document.body.insertAdjacentHTML(
      'beforeend',
      `<div class="roster-prestige-v158" id="rosterPrestigeV158"><div class="rp-panel-v158"><button class="rp-close-v158" onclick="closeRosterPrestigeV158()">×</button><div class="eyebrow">PRESTIGE · ROSTER DEPARTMENT</div><div class="h1">Build a Program</div><div class="rp-tabs-v158"><button class="${tab !== 'upgrades' ? 'on' : ''}" onclick="openRosterPrestigeV158('roster')">Current Roster</button><button class="${tab === 'upgrades' ? 'on' : ''}" onclick="openRosterPrestigeV158('upgrades')">Program Upgrades</button></div>${tab === 'upgrades' ? renderUpgrades() : renderRoster()}</div></div>`
    );
  };
  window.closeRosterPrestigeV158 = () => document.getElementById('rosterPrestigeV158')?.remove();
  window.buyRosterPrestigeV158 = function (k) {
    const s = state(),
      u = UPGRADES[k];
    if (!s || !u) return;
    s.rosterPrestigeV158 = s.rosterPrestigeV158 || {};
    const lv = s.rosterPrestigeV158[k] || 0,
      c = cost(k);
    if (lv >= u.max || Number(s.pp || 0) < c) return;
    s.pp -= c;
    s.rosterPrestigeV158[k] = lv + 1;
    try {
      window.__GRIDIRON_AUDIT__?.setState?.(s);
      window.I?.();
    } catch (e) {}
    openRosterPrestigeV158('upgrades');
  };
  // Opponent roster persistence: same school + season returns the same player objects every week.
  try {
    if (typeof rt === 'function') {
      const prior = rt;
      rt = function () {
        const args = [...arguments],
          team = prior.apply(this, args),
          s = state(),
          p = s?.player;
        if (!team || !p) return team;
        s.teamRosterCacheV158 = s.teamRosterCacheV158 || {};
        const school = String(team.name || team.team || args[0] || 'Opponent'),
          key = seasonKey(p) + '|' + school;
        let roster = s.teamRosterCacheV158[key];
        if (!roster) {
          roster =
            team.rosterV157 ||
            team.roster ||
            window.__GRIDIRON_GENERATE_ROSTER_V157(
              Math.round(team.rating || 17),
              (p.seasonSeed || 1) + school.length * 997
            ).players;
          ensureMeta(roster, (p.seasonSeed || 1) + school.length);
          s.teamRosterCacheV158[key] = roster;
        }
        team.rosterV157 = roster;
        team.roster = roster;
        team.averagePlayerRatingV157 = roster.reduce((a, b) => a + b.ovr, 0) / roster.length;
        return team;
      };
    }
  } catch (e) {
    console.warn('[v15.8 persistent opponent roster]', e);
  }
  // Add roster-specific access inside the existing prestige interaction without replacing the old tree.
  document.addEventListener(
    'click',
    e => {
      const chip = e.target.closest?.('.prestige-chip');
      if (chip)
        setTimeout(() => {
          const sc = document.getElementById('screen');
          if (sc && !sc.querySelector('.roster-dept-entry-v158'))
            sc.insertAdjacentHTML(
              'afterbegin',
              '<div class="card tap roster-dept-entry-v158" onclick="openRosterPrestigeV158(\'upgrades\')"><div class="eyebrow">NEW PRESTIGE BRANCH</div><div class="h2" style="margin:2px 0">Roster Department</div><div class="sub">Persistent depth charts, recruiting, development, retention, unit grades and offseason roster turnover.</div></div>'
            );
        }, 80);
    },
    true
  );
  const oldRender = window.render || window.q;
  if (typeof oldRender === 'function') {
    const wrapped = function () {
      const r = oldRender.apply(this, arguments);
      ensureUserRoster();
      return r;
    };
    window.render = wrapped;
    try {
      q = wrapped;
    } catch (e) {}
  }
  ensureUserRoster();
  window.__GRIDIRON_SIMULATE_V158 = function (iterations) {
    iterations = Math.max(1000, iterations || 50000);
    const errors = [];
    for (let i = 0; i < iterations; i++) {
      const pack = window.__GRIDIRON_GENERATE_ROSTER_V157(1 + (i % 70), 1000 + i);
      ensureMeta(pack.players, i);
      const a = pack.players.map(x => x.id + ':' + x.name + ':' + x.pos).join('|'),
        b = pack.players.map(x => x.id + ':' + x.name + ':' + x.pos).join('|');
      if (a !== b) errors.push('composition changed ' + i);
      if (Math.abs(pack.players.reduce((s, x) => s + x.ovr, 0) / 22 - (1 + (i % 70))) > 1e-9)
        errors.push('average ' + i);
      if (
        pack.players.filter(x => x.tier === 'star').length < 1 ||
        pack.players.filter(x => x.tier === 'star').length > 4
      )
        errors.push('stars ' + i);
      if (errors.length > 20) break;
    }
    return { ok: !errors.length, iterations, errors };
  };
  window.__GRIDIRON_FEATURES__ = Object.assign({}, window.__GRIDIRON_FEATURES__ || {}, {
    persistentSeasonRostersV158: true,
    rosterPrestigeBranchV158: true,
    recruitingDevelopmentV158: true,
    offseasonOnlyTurnoverV158: true,
    unitCompositionV158: true
  });
})();
