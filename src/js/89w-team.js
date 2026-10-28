/* =========================================================
   Team testing
   Teams are saved rosters. A test day (collection "teamtests") holds the tests, trials per test,
   the scoring rule and who was absent. Each athlete's results are saved as their own test record
   (teamTestId links it to the day), so they show on the profile, charts, leaderboard and
   percentiles exactly like any other test.
   ========================================================= */
const TT_PRESETS = [
  ['Speed & agility', ['sprint10yd', 'fly10yd', 'proAgility']],
  ['Combine', ['sprint40yd', 'proAgility', 'vj', 'broad']],
  ['Jumps', ['cmj', 'broad', 'rsiMod']],
  ['Force plate', ['cmj', 'rsiMod', 'imtpPF']],
];
/* Same rule as the evaluation, so results stay comparable with it: force-plate trials are
   averaged, field tests keep the best trial. The coach can change it per test. */
function ttDefaultScore(k) { const d = M[k]; return !d || !d.dir || ['cmjfp', 'iso'].includes(d.cat) || ['cmj', 'sj'].includes(k) ? 'avg' : 'best'; }
function ttDefaultN(k) { const c = M[k]?.cat; return EVAL_SPEED[k]?.n || (c === 'jump' || c === 'cmjfp' ? 3 : 2); }
function ttAllKeys() { return METRICS.filter(d => !d.calc && !d.context && !d.side).map(d => d.key); }
const ttKeys = s => (s.keys || []).filter(k => M[k]);
/* The coach's names for the speed tests (as in the evaluation) */
const ttLabel = k => {
  const d = M[k], lc = l => (/^[A-Z][a-z]/.test(l) ? l[0].toLowerCase() + l.slice(1) : l);
  if (EVAL_SPEED[k]) return EVAL_SPEED[k].label;
  if (d.cat === 'iso' && !/IMTP|calf|isometric/i.test(d.label)) return 'IMTP ' + lc(d.label);
  if (d.cat === 'cmjfp' && !/CMJ|RSI/i.test(d.label)) return 'CMJ ' + lc(d.label);
  return d.label;
};
const ttN = (s, k) => s.n?.[k] || ttDefaultN(k);
const ttMode = (s, k) => (M[k]?.dir ? s.score?.[k] || ttDefaultScore(k) : 'avg');
const ttRecs = s => S.tests.filter(t => t.teamTestId === s.id);
const ttRec = (s, aid) => S.tests.find(t => t.teamTestId === s.id && t.athleteId === aid) || null;
const byName = (a, b) => athleteName(a).localeCompare(athleteName(b));
function ttTeam(id) { return id ? getRec('teams', id) : null; }
function ttTitle(s) { return s.name || ttTeam(s.teamId)?.name || s.teamName || 'Group testing'; }
function ttRoster(s) { return (s.athleteIds || []).map(getAthlete).filter(Boolean).sort(byName); }
function teamRoster(t) { return (t.athleteIds || []).map(getAthlete).filter(Boolean).sort(byName); }
function teamDays(t) { return S.teamtests.filter(s => s.teamId === t.id).sort(byKey('date')); }
function athleteTeams(aid) { return S.teams.filter(t => (t.athleteIds || []).includes(aid)).sort((a, b) => a.name.localeCompare(b.name)); }

function ttScore(k, arr, mode) {
  if (!arr.length) return null;
  if (mode === 'avg' || !M[k].dir) return mean(arr);
  return M[k].dir === -1 ? Math.min(...arr) : Math.max(...arr);
}
/* Trials behind a saved result (falls back to the result itself if it was edited elsewhere) */
function ttTrials(s, rec, k) {
  const v = rec?.m?.[k], tr = rec?.trials?.[k];
  if (v == null) return [];
  return tr?.length && Math.abs(ttScore(k, tr, ttMode(s, k)) - v) <= 1e-6 * Math.max(1, Math.abs(v)) ? tr : [v];
}
const ttDisp = (k, v) => inVal(metricDisp(M[k], v), M[k].kind === 'len' ? 1 : M[k].unit === 's' ? 3 : Math.max(M[k].dec, 2));
/* One typed trial → { v } in stored units, { bad }, or null when empty. The 10-yard tests accept MPH from the timer. */
function ttParse(k, raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const d = M[k];
  let x = num(s);
  if (x == null || x <= 0) return { bad: true };
  x = evalSecs(k, x);
  if ((d.unit === '%' && x > 100) || (d.unit === 's' && x > (d.cat === 'sprint' ? 20 : 120))) return { bad: true };
  return { v: metricIn(d, x) };
}
function ttUnitLabel(s, k) {
  const u = EVAL_SPEED[k]?.mph ? 's or mph' : metricUnit(M[k]) || '', n = ttN(s, k);
  return `${u ? u + ' · ' : ''}${n === 1 ? '1 trial' : `${ttMode(s, k) === 'avg' ? 'average' : 'best'} of ${n}`}`;
}
function ttStatus(s, aid) {
  if ((s.absentIds || []).includes(aid)) return 'absent';
  const t = ttRec(s, aid), keys = ttKeys(s);
  const n = t ? keys.filter(k => t.m?.[k] != null).length : 0;
  return !n ? 'todo' : n >= keys.length ? 'done' : 'part';
}
const TT_ST = { done: ['✓', 'Done', 'good'], part: ['◐', 'Partly done', 'warn'], todo: ['○', 'Not tested', ''], absent: ['–', 'Absent', 'bad'] };
function ttProgress(s) {
  const st = ttRoster(s).map(a => ttStatus(s, a.id));
  const c = x => st.filter(y => y === x).length;
  return { total: st.length, done: c('done'), part: c('part'), absent: c('absent') };
}

/* ---------- Comparisons ---------- */
/* The athlete's earlier results for a test (other records on or before the test day) */
function ttPrior(s, aid, k) {
  const pts = testsFor(aid).filter(t => t.teamTestId !== s.id && t.date <= s.date).map(t => ({ date: t.date, v: testMetrics(t)[k] })).filter(p => p.v != null && Number.isFinite(p.v));
  if (!pts.length) return null;
  const vals = pts.map(p => p.v), d = M[k];
  return { last: pts[pts.length - 1], best: d.dir === -1 ? Math.min(...vals) : d.dir === 1 ? Math.max(...vals) : null, n: pts.length };
}
function ttCompare(d, v, h) {
  const pct = h?.last.v ? (v - h.last.v) / Math.abs(h.last.v) * 100 : null;
  return { pct, cls: changeClass(d, pct), pb: !!(h && h.best != null && better(d.dir, v, h.best)) };
}
const ttTeamVals = (s, k, except) => ttRecs(s).filter(t => t.athleteId !== except).map(t => t.m?.[k]).filter(Number.isFinite);
/* Typo guard: a result far from the athlete's last result (or the team's middle result on a first test) */
function ttUnusual(k, v, h, teamVals) {
  const d = M[k], sorted = [...teamVals].sort((a, b) => a - b);
  const ref = h ? h.last.v : sorted.length >= 3 ? sorted[Math.floor(sorted.length / 2)] : null;
  if (!(ref > 0)) return null;
  const off = (v - ref) / ref * 100;
  if (Math.abs(off) <= (d.unit === 's' ? 25 : 40)) return null;
  const word = d.unit === 's' ? (off > 0 ? 'slower' : 'faster') : off > 0 ? 'higher' : 'lower';
  return `${fmtNum(Math.abs(off), 0)}% ${word} than ${h ? 'their last result' : 'the team’s middle result'}. Double-check it.`;
}
/* Average change per athlete since the team's previous test day with this test (same athletes only) */
function ttTeamChange(s, k) {
  if (!s.teamId) return null;
  const prev = S.teamtests.filter(x => x.teamId === s.teamId && x.id !== s.id && x.date < s.date && ttKeys(x).includes(k)).sort(byKey('date')).pop();
  if (!prev) return null;
  const before = new Map(ttRecs(prev).filter(t => t.m?.[k] > 0).map(t => [t.athleteId, t.m[k]]));
  const pcts = ttRecs(s).filter(t => t.m?.[k] != null && before.has(t.athleteId)).map(t => (t.m[k] - before.get(t.athleteId)) / before.get(t.athleteId) * 100);
  return pcts.length ? { prev, pct: mean(pcts), n: pcts.length } : null;
}
function ttFbHtml(s, aid, k, trials) {
  const d = M[k], mode = ttMode(s, k), h = ttPrior(s, aid, k);
  const v = ttScore(k, trials, mode);
  if (v == null) return h ? `<span class="faint">${h.best != null ? `PB ${esc(fmtMetric(d, h.best))} · ` : ''}last ${esc(fmtMetric(d, h.last.v))}</span>` : '<span class="faint">First test</span>';
  const c = ttCompare(d, v, h);
  const mph = EVAL_SPEED[k]?.mph ? ` · ${fmtNum(EVAL_SPEED[k].mph / v / MPH, 1)} mph` : '';
  const warn = ttUnusual(k, v, h, ttTeamVals(s, k, aid)) || (mode === 'avg' ? trialQuality({ [k]: trials })[0] : null);
  return `<b>${trials.length > 1 ? (mode === 'avg' ? 'Avg ' : 'Best ') : ''}${esc(fmtMetric(d, v))}</b>${mph}${c.pb ? ' <span class="badge good">New PB</span>' : ''}${c.pct != null ? ' ' + deltaHtml(d, c.pct, 'vs last') : ''}${warn ? `<div class="vl-warn">${esc(warn)}</div>` : ''}`;
}

/* ---------- Saving (each entry saves as soon as the coach leaves the box) ---------- */
function ttLastBm(s, aid) {
  return testsFor(aid).filter(t => t.teamTestId !== s.id && t.bodyMassKg && t.date <= s.date).pop()?.bodyMassKg ?? getAthlete(aid)?.massKg ?? null;
}
/* vals: { key: [trials in stored units] } for the tests shown; bm: kg, null (not entered) or undefined (not shown) */
function ttSave(s, aid, vals, bm) {
  if (!getAthlete(aid) || (s.absentIds || []).includes(aid)) return null;
  const ex = ttRec(s, aid);
  const m = { ...(ex?.m || {}) }, trials = { ...(ex?.trials || {}) };
  Object.entries(vals).forEach(([k, arr]) => {
    if (arr.length) { m[k] = ttScore(k, arr, ttMode(s, k)); trials[k] = arr; } else { delete m[k]; delete trials[k]; }
  });
  if (!Object.keys(m).length) { if (ex) removeRec('tests', ex.id); return null; }
  const bodyMassKg = bm > 0 ? bm : bm === null || !ex ? ttLastBm(s, aid) : ex.bodyMassKg ?? null;
  if (ex && JSON.stringify(ex.m) === JSON.stringify(m) && JSON.stringify(ex.trials || {}) === JSON.stringify(trials) && (ex.bodyMassKg ?? null) === bodyMassKg) return ex;
  return upsert('tests', { ...(ex || { athleteId: aid, sides: {}, isoType: 'IMTP', teamTestId: s.id, notes: `Team testing · ${ttTitle(s)}` }), date: s.date, m, trials, bodyMassKg });
}
/* Read one athlete's boxes from the page and save them. Returns entries that aren't valid numbers. */
function ttSaveFromDom(root, sid, aid) {
  const s = getRec('teamtests', sid);
  if (!s || !aid) return [];
  const vals = {}, bad = [];
  ttKeys(s).forEach(k => {
    const ins = $$(`input[data-tt="${aid}|${k}"]`, root);
    if (!ins.length) return;
    vals[k] = [];
    ins.forEach(i => { const p = ttParse(k, i.value); if (p?.v != null) vals[k].push(p.v); else if (p?.bad) bad.push(`${athleteName(getAthlete(aid), true)} · ${ttLabel(k)} “${i.value.trim()}”`); });
  });
  const bmIn = $(`input[data-ttbm="${aid}"]`, root);
  let bm;
  if (bmIn) { const x = num(bmIn.value); bm = x > 0 ? U.massIn(x) : null; }
  ttSave(s, aid, vals, bm);
  return bad;
}
function ttFlush(root, sid) {
  const bad = [...root._dirty].flatMap(aid => ttSaveFromDom(root, sid, aid));
  root._dirty.clear();
  if (bad.length) toast(`Not saved (not a valid number): ${bad.slice(0, 3).join('; ')}`, 'err');
}
function ttLive(root, sid, g) {
  const s = getRec('teamtests', sid), [aid, k] = g.split('|');
  if (!s || !M[k]) return;
  const ins = $$(`input[data-tt="${g}"]`, root), arr = [];
  let bad = false;
  ins.forEach(i => { const p = ttParse(k, i.value); i.classList.toggle('bad', !!p?.bad); if (p?.bad) bad = true; if (p?.v != null) arr.push(p.v); });
  const out = $(`[data-fb="${g}"]`, root);
  if (out) out.innerHTML = bad ? `<span class="vl-bad">${M[k].unit === 's' ? `Enter seconds, e.g. 1.65${EVAL_SPEED[k]?.mph ? ', or the MPH' : ''}` : 'Not a valid number'}</span>` : ttFbHtml(s, aid, k, arr);
}
function ttRefreshHead(sid) {
  const s = getRec('teamtests', sid), el = $('#ttHead');
  if (s && el) el.outerHTML = ttHeadHtml(s);
  const aid = $('#ttRoot')?.dataset.a;
  if (s && aid) { const st = ttStatus(s, aid), b = $('#ttSt'); if (b) { b.className = `badge ${TT_ST[st][2]}`; b.textContent = TT_ST[st][1]; } const o = $(`.tt-pick option[value="${aid}"]`); if (o) o.textContent = `${TT_ST[st][0]}  ${athleteName(getAthlete(aid))}`; }
  const k = $('#ttRoot')?.dataset.k;
  if (s && k) { const c = $(`[data-cnt="${k}"]`), here = ttRoster(s).filter(a => !(s.absentIds || []).includes(a.id)); if (c) c.textContent = `${here.filter(a => ttRec(s, a.id)?.m?.[k] != null).length}/${here.length}`; }
}
document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && UI.leave) { try { UI.leave(); } catch (e) { console.error(e); } flush(); } });

/* ---------- Entry rows ---------- */
function ttRow(s, a, k, rec, label) {
  const tr = ttTrials(s, rec, k), n = Math.max(ttN(s, k), tr.length);
  const ins = [...Array(n).keys()].map(i => `<input type="text" inputmode="decimal" enterkeyhint="next" data-tt="${a.id}|${k}" data-i="${i}" placeholder="${n > 1 ? 'Trial ' + (i + 1) : 'Result'}" aria-label="${esc(`${athleteName(a, true)} ${ttLabel(k)} trial ${i + 1}`)}" value="${tr[i] != null ? esc(ttDisp(k, tr[i])) : ''}">`).join('');
  return `<div class="tt-row" style="--n:${n}"><div class="tt-label">${label}</div>${ins}<div class="tt-out" data-fb="${a.id}|${k}">${ttFbHtml(s, a.id, k, tr)}</div></div>`;
}
function ttHeadHtml(s) {
  const p = ttProgress(s), here = p.total - p.absent, team = ttTeam(s.teamId);
  const pct = here ? Math.round((p.done + p.part / 2) / here * 100) : 0;
  return `<div class="tt-head" id="ttHead"><div class="muted small">${esc(fmtDateLong(s.date))}${team ? ` · <a href="#/teams/${team.id}">${esc(team.name)}</a>` : ''} · ${esc(ttKeys(s).map(k => ttLabel(k)).join(', ') || 'No tests')}</div>
    <div class="tt-prog" role="progressbar" aria-label="Athletes done" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></div>
    <div class="small"><b>${p.done}</b> of ${here} done${p.part ? ` · ${p.part} partly done` : ''}${p.absent ? ` · ${p.absent} absent` : ''}${s.done ? ' · <span class="badge good">Finished</span>' : ''}</div></div>`;
}

/* ---------- Views: by athlete, by test (station), results ---------- */
function ttAthleteView(s, roster, aid) {
  const i = Math.max(0, roster.findIndex(a => a.id === aid)), a = roster[i];
  const keys = ttKeys(s), rec = ttRec(s, a.id), st = ttStatus(s, a.id), age = ageAt(a.dob, s.date);
  const prev = roster[i - 1], next = roster[i + 1];
  const needBm = keys.some(k => ['cmjfp', 'iso'].includes(M[k].cat));
  const lastBm = ttLastBm(s, a.id);
  const goBtn = (x, html) => `<button class="btn primary" data-act="ttGo" data-s="${s.id}" ${x ? `data-a="${x.id}"` : 'data-v="results"'}>${html}</button>`;
  return `
    <div class="tt-pager">
      <button class="btn icon" data-act="ttGo" data-s="${s.id}" data-a="${prev?.id || a.id}" ${prev ? '' : 'disabled'} aria-label="Previous athlete">${icon('chevL')}</button>
      <select class="tt-pick" data-change="ttPick" data-s="${s.id}" aria-label="Choose athlete">${roster.map(x => `<option value="${x.id}" ${x.id === a.id ? 'selected' : ''}>${TT_ST[ttStatus(s, x.id)][0]}  ${esc(athleteName(x))}</option>`).join('')}</select>
      <button class="btn icon" data-act="ttGo" data-s="${s.id}" data-a="${next?.id || a.id}" ${next ? '' : 'disabled'} aria-label="Next athlete">${icon('chevR')}</button>
    </div>
    <div class="card tt-card" id="ttRoot" data-s="${s.id}" data-a="${a.id}">
      <div class="tt-ath">${avatar(a, 'lg')}<div class="grow" style="min-width:0"><h2>${esc(athleteName(a))}</h2><div class="muted small">${esc([age != null ? `Age ${age}` : '', a.sex === 'F' ? 'Female' : a.sex === 'M' ? 'Male' : '', a.sport, a.position].filter(Boolean).join(' · ') || 'Add age and sex on the profile for comparisons')}</div></div>
        <span class="badge ${TT_ST[st][2]}" id="ttSt">${TT_ST[st][1]}</span></div>
      ${st === 'absent' ? `<div class="banner warn" style="margin:14px 0 0">${icon('info')}<div class="grow">Marked absent for this test day.</div><button class="btn sm" data-act="ttAbsent" data-s="${s.id}" data-a="${a.id}">Mark present</button></div>` : `
        ${needBm ? `<div class="tt-bm">${field('Body mass today', `<input type="text" inputmode="decimal" data-ttbm="${a.id}" value="${rec?.bodyMassKg ? esc(inVal(U.massOut(rec.bodyMassKg), 1)) : ''}" placeholder="${lastBm ? esc(inVal(U.massOut(lastBm), 1)) : ''}">`, { unit: U.mass(), hint: lastBm ? 'Leave blank to use their last known body mass' : 'Used for relative force and power' })}</div>` : ''}
        ${keys.map(k => ttRow(s, a, k, rec, `${esc(ttLabel(k))}<div class="faint tiny">${esc(ttUnitLabel(s, k))}</div>`)).join('')}`}
      <div class="tt-foot">
        ${st === 'absent' ? '' : `<button class="btn" data-act="ttAbsent" data-s="${s.id}" data-a="${a.id}">Absent</button>`}
        <span class="grow"></span>
        ${next ? goBtn(next, `Next: ${esc(athleteName(next, true))} ${icon('chevR', 'sm')}`) : goBtn(null, `Team results ${icon('chevR', 'sm')}`)}
      </div>
    </div>`;
}
function ttStationView(s, roster, k) {
  const keys = ttKeys(s), d = M[k];
  const recs = new Map(ttRecs(s).map(t => [t.athleteId, t]));
  const abs = new Set(s.absentIds || []);
  const here = roster.filter(a => !abs.has(a.id)), away = roster.filter(a => abs.has(a.id));
  const count = x => here.filter(a => recs.get(a.id)?.m?.[x] != null).length;
  const nx = keys[keys.indexOf(k) + 1];
  return `
    <div class="chips scroll tt-keys">${keys.map(x => `<button class="chip ${x === k ? 'on' : ''}" data-act="ttGo" data-s="${s.id}" data-v="test" data-k="${x}">${esc(ttLabel(x))} <span class="tt-cnt" data-cnt="${x}">${count(x)}/${here.length}</span></button>`).join('')}</div>
    <div class="card" id="ttRoot" data-s="${s.id}" data-k="${k}">
      <div class="card-head"><h3>${esc(ttLabel(k))}</h3><span class="sub">${esc(ttUnitLabel(s, k))}</span></div>
      ${here.map(a => ttRow(s, a, k, recs.get(a.id), `${avatar(a, 'sm')}<span>${esc(athleteName(a, true))}</span>`)).join('') || '<div class="muted small">Everyone is marked absent.</div>'}
      ${away.length ? `<div class="faint small" style="margin-top:12px">Absent: ${away.map(a => `${esc(athleteName(a, true))} (<button class="link" data-act="ttAbsent" data-s="${s.id}" data-a="${a.id}">mark present</button>)`).join(' · ')}</div>` : ''}
      <div class="tt-foot"><span class="grow"></span>${nx ? `<button class="btn primary" data-act="ttGo" data-s="${s.id}" data-v="test" data-k="${nx}">Next test: ${esc(ttLabel(nx))} ${icon('chevR', 'sm')}</button>` : `<button class="btn primary" data-act="ttGo" data-s="${s.id}" data-v="results">Team results ${icon('chevR', 'sm')}</button>`}</div>
    </div>`;
}
function ttRanked(s, roster, k) {
  const d = M[k], recs = new Map(ttRecs(s).map(t => [t.athleteId, t]));
  const rows = roster.map(a => { const v = recs.get(a.id)?.m?.[k]; if (v == null) return null; const h = ttPrior(s, a.id, k); return { a, v, h, ...ttCompare(d, v, h) }; }).filter(Boolean);
  rows.sort((x, y) => (d.dir === -1 ? x.v - y.v : y.v - x.v));
  rows.forEach((r, i) => { r.rank = i && rows[i - 1].v === r.v ? rows[i - 1].rank : i + 1; });
  const vals = rows.map(r => r.v);
  return { k, d, rows, avg: mean(vals), sd: sd(vals), team: ttTeamChange(s, k) };
}
function ttResultsView(s, roster) {
  const keys = ttKeys(s), recs = new Map(ttRecs(s).map(t => [t.athleteId, t])), abs = new Set(s.absentIds || []);
  const p = ttProgress(s);
  const tested = roster.filter(a => recs.has(a.id));
  const finish = `<button class="btn ${s.done ? '' : 'primary'}" data-act="ttFinish" data-s="${s.id}">${icon(s.done ? 'edit' : 'check', 'sm')}${s.done ? 'Reopen test day' : 'Finish test day'}</button>`;
  if (!tested.length) return `<div class="card">${emptyState_('clipboard', 'No results yet', 'Rankings, personal bests and changes appear here as you enter results.', `<button class="btn primary" data-act="ttGo" data-s="${s.id}" data-v="athlete">Start entering results</button>`)}</div>`;
  const per = keys.map(k => ttRanked(s, roster, k));
  const all = per.flatMap(x => x.rows.map(r => ({ ...r, d: x.d, k: x.k })));
  const pbs = all.filter(r => r.pb), up = all.filter(r => r.cls === 'good' && !r.pb), down = all.filter(r => r.cls === 'bad');
  const left = roster.filter(a => !abs.has(a.id) && ttStatus(s, a.id) !== 'done');
  const who = r => `<b>${esc(athleteName(r.a, true))}</b> ${esc(ttLabel(r.k))} ${esc(fmtMetric(r.d, r.v))}`;
  const val = (d, v) => esc(fmtMetric(d, v));
  const card = x => `<div class="card"><div class="card-head"><h3>${esc(ttLabel(x.k))}</h3><span class="sub">${esc(ttUnitLabel(s, x.k).replace('s or mph · ', 's · '))}</span></div>
      <div class="tt-teamline">Team average <b>${val(x.d, x.avg)}</b>${x.sd != null ? ` ± ${esc(fmtNum(metricDisp(x.d, x.sd), x.d.kind === 'len' ? 1 : x.d.dec))}` : ''} · ${plural(x.rows.length, 'athlete')}${x.team ? ` · since ${esc(fmtDate(x.team.prev.date))} ${deltaHtml(x.d, x.team.pct)} <span class="faint">(avg of ${x.team.n} athletes)</span>` : ''}</div>
      <div class="list">${x.rows.map(r => `<a class="row" href="#/athlete/${r.a.id}/testing">${x.d.dir ? `<span class="rank r${r.rank}">${r.rank}</span>` : ''}${avatar(r.a, 'sm')}<span class="row-main"><span class="row-title">${esc(athleteName(r.a))}${r.pb ? ' <span class="badge good">PB</span>' : ''}</span><span class="row-sub">${r.h ? `Last ${val(x.d, r.h.last.v)} ${deltaHtml(x.d, r.pct)}` : 'First test'}</span></span><b class="nowrap">${val(x.d, r.v)}</b></a>`).join('')}</div></div>`;
  const list = (title, cls, rows, note = '') => rows.length ? `<div class="tt-hl"><div class="kicker ${cls}">${title} (${rows.length})</div>${note ? `<div class="faint tiny">${note}</div>` : ''}<div class="small">${rows.slice(0, 12).map(who).join(' · ')}${rows.length > 12 ? ' …' : ''}</div></div>` : '';
  const table = `<div class="card flush"><div class="card-head" style="padding:14px 16px 4px"><h3>All results</h3><span class="sub">rank in brackets</span></div><div class="table-wrap"><table class="t tt-table"><thead><tr><th>Athlete</th>${per.map(x => `<th class="n">${esc(ttLabel(x.k))}<div class="faint" style="text-transform:none;letter-spacing:0">${esc(metricUnit(x.d) || '')}</div></th>`).join('')}</tr></thead><tbody>
      ${roster.map(a => `<tr class="click" data-act="lbOpen" data-a="${a.id}"><td class="nowrap"><b>${esc(athleteName(a))}</b>${abs.has(a.id) ? ' <span class="badge bad">Absent</span>' : ''}</td>${per.map(x => { const r = x.rows.find(y => y.a.id === a.id); return `<td class="n nowrap">${r ? `${esc(fmtNum(metricDisp(x.d, r.v), x.d.kind === 'len' ? 1 : x.d.dec))}${x.d.dir ? ` <span class="faint">(${r.rank})</span>` : ''}${r.pb ? ' ★' : ''}` : '–'}</td>`; }).join('')}</tr>`).join('')}
      <tr class="tt-avg"><td><b>Team average</b></td>${per.map(x => `<td class="n"><b>${x.avg != null ? esc(fmtNum(metricDisp(x.d, x.avg), x.d.kind === 'len' ? 1 : x.d.dec)) : '–'}</b></td>`).join('')}</tr>
    </tbody></table></div><p class="faint tiny" style="padding:0 16px 12px;margin:0">★ personal best. Changes are coloured only when they are bigger than the test’s typical error (normal day-to-day noise).</p></div>`;
  return `
    <div class="stats">
      <div class="stat"><div class="stat-label">Tested</div><div class="stat-value">${tested.length}<span class="faint small"> / ${p.total - p.absent}</span></div></div>
      <div class="stat"><div class="stat-label">Absent</div><div class="stat-value">${p.absent}</div></div>
      <div class="stat"><div class="stat-label">New PBs</div><div class="stat-value">${pbs.length}</div></div>
      <div class="stat"><div class="stat-label">Tests</div><div class="stat-value">${keys.length}</div></div>
    </div>
    ${pbs.length || up.length || down.length || left.length ? `<div class="card"><div class="card-head"><h3>Highlights</h3></div>
      ${list('New personal bests', 'vl-ok', pbs)}${list('Better than last time', 'vl-ok', up, 'By more than normal test noise.')}${list('Down from last time', 'vl-bad', down, 'By more than normal test noise. Check fatigue, technique or the entry.')}
      ${left.length ? `<div class="tt-hl"><div class="kicker">Still to test (${left.length})</div><div class="small">${left.map(a => `<button class="link" data-act="ttGo" data-s="${s.id}" data-a="${a.id}">${esc(athleteName(a, true))}</button>`).join(' · ')}</div></div>` : ''}</div>` : ''}
    <div class="tt-grid">${per.map(card).join('')}</div>
    ${table}
    <div class="tt-foot">${finish}<span class="grow"></span><button class="btn" data-act="ttCsv" data-s="${s.id}">${icon('download', 'sm')}Export CSV</button></div>`;
}

ROUTES.teamtest = r => {
  const s = getRec('teamtests', r.parts[0]);
  if (!s) return { title: 'Team Testing', nav: 'teams', back: '#/teams', body: `<div class="card">${emptyState_('clipboard', 'Test day not found', 'It may have been deleted on another device.', '<a class="btn primary" href="#/teams">Back to Team Testing</a>')}</div>` };
  const mem = ((UI.tt ||= {})[s.id] ||= {});
  const v = ['athlete', 'test', 'results'].includes(r.q.v) ? r.q.v : mem.v || 'athlete';
  mem.v = v;
  if (r.q.a) mem.a = r.q.a;
  if (r.q.k) mem.k = r.q.k;
  const roster = ttRoster(s), keys = ttKeys(s), team = ttTeam(s.teamId);
  if (!keys.includes(mem.k)) mem.k = keys[0];
  if (!roster.some(a => a.id === mem.a)) mem.a = roster.find(a => ttStatus(s, a.id) !== 'done' && ttStatus(s, a.id) !== 'absent')?.id || roster[0]?.id;
  const tabs = `<nav class="tabs tt-tabs">${[['athlete', 'By athlete'], ['test', 'By test'], ['results', 'Results']].map(([x, l]) => `<a href="#/teamtest/${s.id}?v=${x}" class="${x === v ? 'active' : ''}">${l}</a>`).join('')}</nav>`;
  let main;
  if (!roster.length || !keys.length) main = `<div class="card">${emptyState_('clipboard', !keys.length ? 'No tests chosen' : 'No athletes on this test day', 'Edit the test day to add them.', `<button class="btn primary" data-act="ttEdit" data-s="${s.id}">${icon('edit', 'sm')}Edit test day</button>`)}</div>`;
  else main = v === 'results' ? ttResultsView(s, roster) : v === 'test' ? ttStationView(s, roster, mem.k) : ttAthleteView(s, roster, mem.a);
  const awake = `<button class="btn ${UI.floorAwake ? 'primary' : ''}" data-act="floorAwake" aria-label="Keep the screen on">${icon('zap', 'sm')}<span class="lbl">${UI.floorAwake ? 'Screen stays on' : 'Keep screen on'}</span></button>`;
  return {
    title: ttTitle(s), nav: 'teams', back: team ? `#/teams/${team.id}` : '#/teams',
    body: ttHeadHtml(s) + tabs + main,
    actions: `${v === 'results' ? `<button class="btn" data-act="lbPrint">${icon('file', 'sm')}<span class="lbl">Print</span></button>` : awake}<button class="btn" data-act="ttEdit" data-s="${s.id}">${icon('edit', 'sm')}<span class="lbl">Edit</span></button>`,
    mount() {
      if (UI.floorAwake) setWakeLock(true);
      const root = $('#ttRoot');
      if (!root || v === 'results') return;
      root._dirty = new Set();
      const aidOf = el => el.dataset.tt?.split('|')[0] || el.dataset.ttbm;
      root.addEventListener('input', e => {
        const aid = aidOf(e.target);
        if (!aid) return;
        root._dirty.add(aid);
        if (e.target.dataset.tt) ttLive(root, s.id, e.target.dataset.tt);
      });
      root.addEventListener('change', e => {
        const aid = aidOf(e.target);
        if (!aid) return;
        root._dirty.delete(aid);
        ttSaveFromDom(root, s.id, aid);
        ttRefreshHead(s.id);
        $$('input[data-tt]', root).filter(i => i.dataset.tt.startsWith(aid + '|') && i.dataset.i === '0').forEach(i => ttLive(root, s.id, i.dataset.tt));
      });
      root.addEventListener('keydown', e => {
        if (e.key !== 'Enter' || !e.target.matches('input[data-tt], input[data-ttbm]')) return;
        e.preventDefault();
        const ins = $$('input[data-tt], input[data-ttbm]', root), nx = ins[ins.indexOf(e.target) + 1];
        if (nx) { nx.focus(); nx.select?.(); } else e.target.blur();
      });
      UI.leave = () => ttFlush(root, s.id);
    },
  };
};
A.ttGo = el => {
  const q = new URLSearchParams();
  q.set('v', el.dataset.v || 'athlete');
  if (el.dataset.a) q.set('a', el.dataset.a);
  if (el.dataset.k) q.set('k', el.dataset.k);
  go(`#/teamtest/${el.dataset.s}?${q}`);
};
A.ttPick = el => go(`#/teamtest/${el.dataset.s}?v=athlete&a=${encodeURIComponent(el.value)}`);
A.ttAbsent = async el => {
  const s = getRec('teamtests', el.dataset.s), aid = el.dataset.a;
  if (!s) return;
  const abs = new Set(s.absentIds || []);
  if (abs.has(aid)) abs.delete(aid);
  else {
    const rec = ttRec(s, aid);
    if (rec && !(await confirmBox(`Mark ${athleteName(getAthlete(aid), true)} absent?`, 'Their results from this test day will be removed.', { ok: 'Mark absent' }))) return;
    if (rec) removeRec('tests', rec.id);
    abs.add(aid);
  }
  upsert('teamtests', { ...getRec('teamtests', s.id), absentIds: [...abs] });
  refresh();
};
A.ttFinish = el => {
  const s = getRec('teamtests', el.dataset.s);
  if (!s) return;
  upsert('teamtests', { ...s, done: !s.done });
  toast(s.done ? 'Test day reopened' : 'Test day finished');
  refresh();
};
A.ttCsv = el => {
  const s = getRec('teamtests', el.dataset.s);
  if (!s) return;
  const keys = ttKeys(s), recs = new Map(ttRecs(s).map(t => [t.athleteId, t]));
  const nT = Object.fromEntries(keys.map(k => [k, Math.max(ttN(s, k), ...ttRecs(s).map(t => ttTrials(s, t, k).length))]));
  const q = v => { const x = String(v ?? ''); return /[",\n]/.test(x) ? `"${x.replace(/"/g, '""')}"` : x; };
  const dv = (k, v) => (v == null ? '' : round(metricDisp(M[k], v), M[k].kind === 'len' ? 1 : Math.max(M[k].dec, 2)));
  const rng = k => [...Array(nT[k]).keys()];
  const head = ['Athlete', 'Sex', 'Age', 'Status', ...keys.flatMap(k => { const u = metricUnit(M[k]); return [`${ttLabel(k)}${u ? ` (${u})` : ''} ${ttMode(s, k) === 'avg' ? 'average' : 'best'}`, ...rng(k).map(i => `${ttLabel(k)} trial ${i + 1}`)]; }), `Body mass (${U.mass()})`];
  const rows = ttRoster(s).map(a => {
    const t = recs.get(a.id);
    return [athleteName(a), a.sex || '', ageAt(a.dob, s.date) ?? '', TT_ST[ttStatus(s, a.id)][1], ...keys.flatMap(k => { const tr = ttTrials(s, t, k); return [dv(k, t?.m?.[k]), ...rng(k).map(i => dv(k, tr[i]))]; }), t?.bodyMassKg ? round(U.massOut(t.bodyMassKg), 1) : ''].map(q).join(',');
  });
  const slug = ttTitle(s).replace(/[^A-Za-z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase() || 'team';
  downloadBlob(new Blob(['﻿' + [head.map(q).join(','), ...rows].join('\n')], { type: 'text/csv' }), `team-test-${slug}-${s.date}.csv`);
  toast('CSV exported');
};

/* ---------- Setting up a test day ---------- */
function ttPicker(selected, first = []) {
  const all = sortedAthletes().filter(a => !a.archived || selected.includes(a.id));
  if (!all.length) return '<div class="muted small" style="padding:8px 0">No athletes yet.</div>';
  const top = all.filter(a => first.includes(a.id)), rest = all.filter(a => !first.includes(a.id));
  const lab = a => `<label data-name="${esc(athleteName(a).toLowerCase())}"><input type="checkbox" name="ids[]" value="${a.id}" ${selected.includes(a.id) ? 'checked' : ''}><span>${esc(athleteName(a))}${a.archived ? ' (archived)' : ''}</span></label>`;
  return `<div class="picker tt-picker">${all.length > 8 ? `<div class="searchbox">${icon('search', 'sm')}<input type="search" placeholder="Search athletes" data-picker-search></div>` : ''}<div class="picker-list">${top.map(lab).join('')}${top.length && rest.length ? '<div class="kicker tt-div">Other athletes</div>' : ''}${rest.map(lab).join('')}</div></div>`;
}
A.ttStart = el => {
  if (!S.athletes.length && !S.teams.length) { toast('Create a team first'); return A.ttTeam(); }
  ttSetup({ teamId: el?.dataset?.team || '' });
};
A.ttEdit = el => { const s = getRec('teamtests', el.dataset.s); if (s) ttSetup(s); };
function ttSetup(src) {
  const ed = src.id ? src : null;
  const teams = [...S.teams].sort((a, b) => a.name.localeCompare(b.name));
  const fromTeam = t => ({ keys: (t?.keys || []).filter(k => M[k]), n: { ...(t?.n || {}) }, score: { ...(t?.score || {}) } });
  const team0 = ttTeam(src.teamId) || (!ed && teams.length ? teams[0] : null);
  const st = ed ? { teamId: ed.teamId || '', keys: ttKeys(ed), n: { ...(ed.n || {}) }, score: { ...(ed.score || {}) }, ids: [...ed.athleteIds] }
    : { teamId: team0?.id || '', ...fromTeam(team0), ids: team0 ? teamRoster(team0).filter(a => !a.archived).map(a => a.id) : [] };
  const common = groupMetrics().filter(k => M[k]), more = ttAllKeys().filter(k => !common.includes(k));
  const chip = k => `<button type="button" class="chip ${st.keys.includes(k) ? 'on' : ''}" data-ttk="${k}">${esc(ttLabel(k))}</button>`;
  const selHtml = () => (st.keys.length ? st.keys.map((k, i) => `<div class="tt-selrow"><span class="tt-seln">${i + 1}</span><b class="grow">${esc(ttLabel(k))}</b>
      <select data-ttn="${k}" aria-label="${esc(ttLabel(k))} trials">${[1, 2, 3, 4, 5].map(n => `<option value="${n}" ${ttN(st, k) === n ? 'selected' : ''}>${n === 1 ? '1 trial' : n + ' trials'}</option>`).join('')}</select>
      ${M[k].dir ? `<select data-tts="${k}" aria-label="${esc(ttLabel(k))} scoring"><option value="best" ${ttMode(st, k) === 'best' ? 'selected' : ''}>Best counts</option><option value="avg" ${ttMode(st, k) === 'avg' ? 'selected' : ''}>Average counts</option></select>` : '<span class="faint small">Average</span>'}
      <button type="button" class="link ev-x" data-ttk="${k}" aria-label="Remove ${esc(ttLabel(k))}">×</button></div>`).join('') : '<div class="muted small">Tap tests above to add them. They run in the order you pick them.</div>');
  const firstIds = () => (ttTeam(st.teamId)?.athleteIds || []);
  openModal({
    title: ed ? 'Edit test day' : 'Start team testing', size: 'wide', submit: ed ? 'Save' : 'Start',
    body: `
      ${field('Team', sel('teamId', [...teams.map(t => [t.id, t.name]), ['', 'No team: choose athletes']], st.teamId, 'data-ttteam'), { hint: teams.length ? '' : 'Tip: create a team on the Team Testing page to save its roster.' })}
      <div class="fields">${field('Date', inp('date', ed?.date || today(), 'type="date"'))}${field('Name (optional)', inp('name', ed?.name || '', 'placeholder="e.g. Preseason testing"'))}</div>
      <div class="field"><span class="field-label">Quick picks</span><div class="chips">${TT_PRESETS.map(([l], i) => `<button type="button" class="chip" data-ttp="${i}">${esc(l)}</button>`).join('')}</div></div>
      <div class="field"><span class="field-label">Tests</span><div class="chips" id="ttChips">${common.map(chip).join('')}</div>
        <details class="group" style="margin-top:10px"><summary>More tests</summary><div class="group-body">${TEST_CATS.filter(c => more.some(k => M[k].cat === c.key)).map(c => `<div class="kicker" style="margin:8px 0 6px">${esc(c.label)}</div><div class="chips">${more.filter(k => M[k].cat === c.key).map(chip).join('')}</div>`).join('')}</div></details></div>
      <div class="field"><span class="field-label">Order, trials and scoring</span><div id="ttSel" class="tt-sel">${selHtml()}</div>
        <span class="hint">Speed tests keep the best trial; force-plate trials are averaged, the same as the evaluation, so results compare over time.</span></div>
      <div class="field"><span class="field-label">Athletes <span class="u"><button type="button" class="link" data-ttall>All</button> · <button type="button" class="link" data-ttnone>None</button></span></span><div id="ttIds">${ttPicker(st.ids, firstIds())}</div>
        <span class="hint">You can also mark athletes absent while testing.</span></div>`,
    onSubmit: async v => {
      if (!isDS(v.date)) return 'Choose a date.';
      if (!st.keys.length) return 'Choose at least one test.';
      const ids = v.ids || [];
      if (!ids.length) return 'Choose at least one athlete.';
      const n = Object.fromEntries(st.keys.map(k => [k, ttN(st, k)])), score = Object.fromEntries(st.keys.map(k => [k, ttMode(st, k)]));
      let s2;
      if (ed) {
        const recs = ttRecs(ed), oldKeys = ttKeys(ed);
        const goneK = oldKeys.filter(k => !st.keys.includes(k) && recs.some(t => t.m?.[k] != null));
        const goneA = recs.filter(t => !ids.includes(t.athleteId));
        if (goneK.length || goneA.length) {
          const msg = [goneK.length ? `Results for ${goneK.map(k => ttLabel(k)).join(', ')} will be deleted.` : '', goneA.length ? `Results for ${goneA.map(t => athleteName(getAthlete(t.athleteId), true)).join(', ')} will be deleted.` : ''].join(' ');
          if (!(await confirmBox('Remove results?', esc(msg), { ok: 'Remove' }))) return false;
        }
        const oldTitle = ttTitle(ed);
        s2 = upsert('teamtests', { ...ed, teamId: st.teamId, teamName: ttTeam(st.teamId)?.name || '', name: v.name.trim(), date: v.date, keys: [...st.keys], n, score, athleteIds: ids, absentIds: (ed.absentIds || []).filter(id => ids.includes(id)) });
        recs.forEach(t => {
          if (!ids.includes(t.athleteId)) return removeRec('tests', t.id);
          // keep anything added to this record outside team testing; rescore the tests from their trials
          const m = Object.fromEntries(Object.entries(t.m || {}).filter(([k]) => !oldKeys.includes(k)));
          const trials = Object.fromEntries(Object.entries(t.trials || {}).filter(([k]) => !oldKeys.includes(k)));
          st.keys.forEach(k => { const arr = ttTrials(ed, t, k); if (arr.length) { trials[k] = arr; m[k] = ttScore(k, arr, score[k]); } });
          if (!Object.keys(m).length) return removeRec('tests', t.id);
          const notes = t.notes === `Team testing · ${oldTitle}` ? `Team testing · ${ttTitle(s2)}` : t.notes;
          if (JSON.stringify([t.m, t.trials || {}, t.date, t.notes]) !== JSON.stringify([m, trials, v.date, notes])) upsert('tests', { ...t, date: v.date, m, trials, notes });
        });
      } else s2 = upsert('teamtests', { teamId: st.teamId, teamName: ttTeam(st.teamId)?.name || '', name: v.name.trim(), date: v.date, keys: [...st.keys], n, score, athleteIds: ids, absentIds: [], done: false });
      const t = ttTeam(st.teamId);
      if (t && JSON.stringify([t.keys, t.n, t.score]) !== JSON.stringify([st.keys, n, score])) upsert('teams', { ...t, keys: [...st.keys], n, score });
      toast(ed ? 'Test day saved' : 'Test day started');
      if (ed) refresh(); else go(`#/teamtest/${s2.id}?v=athlete`);
    },
    onDelete: ed ? async () => {
      const n = ttRecs(ed).length;
      if (!(await confirmBox('Delete this test day?', n ? `${plural(n, 'athlete')}’s results from this day will also be deleted from their profiles.` : ''))) return false;
      ttRecs(ed).forEach(t => removeRec('tests', t.id));
      removeRec('teamtests', ed.id);
      toast('Test day deleted');
      go(ed.teamId && ttTeam(ed.teamId) ? '#/teams/' + ed.teamId : '#/teams');
    } : null,
    deleteLabel: 'Delete test day',
    onMount: m => {
      const redrawSel = () => { $('#ttSel', m.wrap).innerHTML = selHtml(); $$('[data-ttk].chip', m.wrap).forEach(c => c.classList.toggle('on', st.keys.includes(c.dataset.ttk))); };
      m.wrap.addEventListener('click', e => {
        const k = e.target.closest('[data-ttk]'), p = e.target.closest('[data-ttp]');
        if (k || p) st.touched = true;
        if (k) { const key = k.dataset.ttk; st.keys = st.keys.includes(key) ? st.keys.filter(x => x !== key) : [...st.keys, key]; redrawSel(); }
        if (p) { const add = TT_PRESETS[+p.dataset.ttp][1].filter(x => M[x] && !st.keys.includes(x)); st.keys = add.length ? [...st.keys, ...add] : st.keys.filter(x => !TT_PRESETS[+p.dataset.ttp][1].includes(x)); redrawSel(); }
        if (e.target.closest('[data-ttall]')) $$('#ttIds input[type=checkbox]', m.wrap).forEach(i => { if (i.closest('label').style.display !== 'none') i.checked = true; });
        if (e.target.closest('[data-ttnone]')) $$('#ttIds input[type=checkbox]', m.wrap).forEach(i => { i.checked = false; });
      });
      m.wrap.addEventListener('change', e => {
        const t = e.target;
        if (t.dataset.ttn) st.n[t.dataset.ttn] = +t.value;
        if (t.dataset.tts) st.score[t.dataset.tts] = t.value;
        if (t.matches('[data-ttteam]')) {
          st.teamId = t.value;
          const tm = ttTeam(st.teamId);
          if (tm) { st.ids = teamRoster(tm).filter(a => !a.archived).map(a => a.id); if (!ed && !st.touched) Object.assign(st, fromTeam(tm)); }
          $('#ttIds', m.wrap).innerHTML = ttPicker(tm ? st.ids : $$('#ttIds input:checked', m.wrap).map(i => i.value), firstIds());
          redrawSel();
        }
      });
    },
  });
}

/* ---------- Teams (rosters) ---------- */
/* Roster lines: "First Last, sex, birth date". Commas, tabs (pasted from a spreadsheet) or semicolons. */
function ttDob(p) {
  let y, mo, d, x = p.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (x) { y = +x[1]; mo = +x[2]; d = +x[3]; }
  else if ((x = p.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2}|\d{4})$/))) { mo = +x[1]; d = +x[2]; y = +x[3]; if (y < 100) y += y <= new Date().getFullYear() % 100 ? 2000 : 1900; }
  else return '';
  const dt = new Date(y, mo - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo - 1 || dt.getDate() !== d || y < 1940 || toDS(dt) > today()) return '';
  return toDS(dt);
}
function ttParseRoster(text) {
  const key = (f, l) => `${f} ${l}`.trim().toLowerCase().replace(/\s+/g, ' ');
  const known = new Map(S.athletes.map(a => [key(a.firstName, a.lastName || ''), a]));
  const seen = new Set();
  return String(text || '').split(/\r?\n/).map(l => l.trim()).filter(Boolean).slice(0, 200).map(line => {
    const parts = line.split(/\t|,|;/).map(p => p.trim()).filter(Boolean);
    const words = (parts.shift() || '').split(/\s+/).filter(Boolean);
    let sex = '', dob = '', err = '';
    parts.forEach(p => {
      if (/^(m|male|boy)$/i.test(p)) sex = 'M';
      else if (/^(f|female|girl)$/i.test(p)) sex = 'F';
      else if (/\d/.test(p)) { const ds = ttDob(p); if (ds) dob = ds; else err = `birth date “${p}” not recognised (use 4/12/2010)`; }
      else if (words.length === 1) words.push(...p.split(/\s+/));
    });
    const firstName = (words[0] || '').slice(0, 60), lastName = words.slice(1).join(' ').slice(0, 60), k = key(firstName, lastName);
    const dup = seen.has(k);
    seen.add(k);
    return { line, firstName, lastName, sex, dob, err, dup, existing: known.get(k) || null };
  }).filter(r => r.firstName && !r.dup);
}
function ttRosterPreview(rows) {
  if (!rows.length) return '';
  const fresh = rows.filter(r => !r.existing && !r.err), old = rows.filter(r => r.existing), bad = rows.filter(r => r.err);
  return `${fresh.length ? `<div>New athletes (${fresh.length}): ${fresh.map(r => `<b>${esc(`${r.firstName} ${r.lastName}`.trim())}</b>${r.sex || r.dob ? ` <span class="faint">(${esc([r.sex, r.dob ? `age ${ageAt(r.dob, today())}` : ''].filter(Boolean).join(', '))})</span>` : ''}`).join(', ')}</div>` : ''}
    ${old.length ? `<div class="muted">Already in GSP HQ, added to the team: ${old.map(r => esc(athleteName(r.existing))).join(', ')}</div>` : ''}
    ${bad.length ? `<div class="vl-bad">${bad.map(r => esc(`${r.line}: ${r.err}`)).join('<br>')}</div>` : ''}`;
}
A.ttTeam = el => {
  const t = el?.dataset?.id ? getRec('teams', el.dataset.id) : null;
  const from = el?.dataset?.from || '';
  const fromAth = from ? activeAthletes().filter(a => (a.team || '').trim().toLowerCase() === from.toLowerCase()) : [];
  const sports = [...new Set(S.athletes.map(a => a.sport).filter(Boolean))].sort();
  const x = t ? { ...t } : { name: from, sport: fromAth.find(a => a.sport)?.sport || '', athleteIds: fromAth.map(a => a.id) };
  openModal({
    title: t ? 'Edit team' : 'New team', size: 'wide', submit: t ? 'Save' : 'Create team',
    body: `
      <div class="fields">${field('Team name', inp('name', x.name, 'autocapitalize="words" placeholder="e.g. Hunterdon Central Girls Soccer"' + (t ? '' : ' autofocus')))}${field('Sport', inp('sport', x.sport, 'list="ttSports" placeholder="e.g. Soccer"'))}</div>
      <datalist id="ttSports">${sports.map(s => `<option value="${esc(s)}">`).join('')}</datalist>
      <div class="field"><span class="field-label">Athletes on this team</span>${ttPicker(x.athleteIds, x.athleteIds)}</div>
      ${field('Add new athletes', ta('newAth', '', 'rows="4" placeholder="One per line: First Last, sex, birth date&#10;Jane Smith, F, 4/12/2010&#10;Mike Jones, M"'), { hint: 'Sex and birth date are optional, but they’re needed for age-group and sex comparisons. You can paste a roster straight from a spreadsheet.' })}
      <div id="ttNewPrev" class="small tt-newprev"></div>`,
    onSubmit: v => {
      const name = v.name.trim().slice(0, 120);
      if (!name) return 'Give the team a name.';
      if (S.teams.some(o => o.id !== x.id && o.name.trim().toLowerCase() === name.toLowerCase())) return 'You already have a team with that name.';
      const rows = ttParseRoster(v.newAth);
      const bad = rows.filter(r => r.err);
      if (bad.length) return 'Check these lines: ' + bad.map(r => `“${r.line}”: ${r.err}`).join('; ');
      const ids = new Set(v.ids || []);
      let added = 0;
      rows.forEach(r => {
        if (r.existing) { ids.add(r.existing.id); return; }
        const a = upsert('athletes', { firstName: r.firstName, lastName: r.lastName, sport: v.sport.trim(), position: '', team: name, dob: r.dob, sex: r.sex, heightCm: null, massKg: null, email: '', phone: '', goals: '', injuries: '', archived: false, color: '' });
        ids.add(a.id); added++;
      });
      const before = new Set(x.athleteIds || []);
      const rec = upsert('teams', { ...x, name, sport: v.sport.trim().slice(0, 60), athleteIds: [...ids] });
      // athletes who just joined go onto the team's unfinished test days too
      const joined = [...ids].filter(id => !before.has(id));
      if (t && joined.length) S.teamtests.filter(s => s.teamId === t.id && !s.done).forEach(s => upsert('teamtests', { ...s, athleteIds: [...new Set([...s.athleteIds, ...joined])] }));
      toast(t ? 'Team saved' : `Team created${added ? ` with ${plural(added, 'new athlete')}` : ''}`);
      if (t) refresh(); else go('#/teams/' + rec.id);
    },
    onDelete: t ? async () => {
      if (!(await confirmBox(`Delete ${t.name}?`, 'Only the team list is removed. The athletes, their results and past test days are kept.'))) return false;
      removeRec('teams', t.id); toast('Team deleted'); go('#/teams');
    } : null,
    deleteLabel: 'Delete team',
    onMount: m => {
      const ta2 = $('[name=newAth]', m.wrap);
      ta2.addEventListener('input', () => { $('#ttNewPrev', m.wrap).innerHTML = ttRosterPreview(ttParseRoster(ta2.value)); });
    },
  });
};
function ttDayRow(s) {
  const p = ttProgress(s);
  return `<a class="row" href="#/teamtest/${s.id}${s.done ? '?v=results' : ''}"><span class="row-time" style="width:64px">${esc(fmtDate(s.date))}</span><span class="row-main"><span class="row-title">${esc(ttTitle(s))} ${s.done ? '<span class="badge good">Finished</span>' : '<span class="badge warn">In progress</span>'}</span><span class="row-sub">${esc(ttKeys(s).map(k => ttLabel(k)).join(' · '))}</span></span><span class="small muted nowrap">${p.done + p.part}/${p.total - p.absent}</span>${icon('chevR', 'sm')}</a>`;
}
function teamCard(t) {
  const roster = teamRoster(t), last = teamDays(t).pop();
  return `<div class="card tt-team"><a class="tt-team-top" href="#/teams/${t.id}"><span class="tt-mark">${esc(initials({ firstName: t.name.split(' ')[0], lastName: t.name.split(' ').slice(1).join(' ') }))}</span><span class="grow" style="min-width:0"><b class="tt-team-name">${esc(t.name)}</b><span class="muted small" style="display:block">${esc([t.sport, plural(roster.length, 'athlete')].filter(Boolean).join(' · '))}${last ? ` · tested ${esc(fmtDate(last.date))}` : ''}</span></span>${icon('chevR', 'sm')}</a>
    ${roster.length ? `<div class="tt-avs">${roster.slice(0, 10).map(a => avatar(a, 'sm')).join('')}${roster.length > 10 ? `<span class="faint small">+${roster.length - 10}</span>` : ''}</div>` : ''}
    <div class="tt-team-act"><button class="btn sm primary" data-act="ttStart" data-team="${t.id}">${icon('clipboard', 'sm')}Start testing</button><button class="btn sm" data-act="ttTeam" data-id="${t.id}">${icon('edit', 'sm')}Edit roster</button></div></div>`;
}
function teamSuggestions() {
  const have = new Set(S.teams.map(t => t.name.trim().toLowerCase())), m = new Map();
  activeAthletes().forEach(a => {
    const n = (a.team || '').trim(), k = n.toLowerCase();
    if (n && !have.has(k)) m.set(k, { name: m.get(k)?.name || n, n: (m.get(k)?.n || 0) + 1 });
  });
  return [...m.values()].sort((a, b) => b.n - a.n || a.name.localeCompare(b.name)).slice(0, 8);
}
function teamPage(id) {
  const t = getRec('teams', id);
  if (!t) return { title: 'Team', nav: 'teams', back: '#/teams', body: `<div class="card">${emptyState_('users', 'Team not found', 'It may have been deleted on another device.', '<a class="btn primary" href="#/teams">Back to Team Testing</a>')}</div>` };
  const roster = teamRoster(t), days = teamDays(t);
  const latest = days[days.length - 1];
  const keys = [...new Set(days.flatMap(ttKeys))];
  const prog = keys.map(k => {
    const s = [...days].reverse().find(x => ttKeys(x).includes(k) && ttRecs(x).some(r => r.m?.[k] != null));
    if (!s) return null;
    const vals = ttRecs(s).map(r => r.m?.[k]).filter(Number.isFinite);
    return { k, d: M[k], s, avg: mean(vals), n: vals.length, ch: ttTeamChange(s, k) };
  }).filter(Boolean);
  const body = `
    <div class="stats">
      <div class="stat"><div class="stat-label">Athletes</div><div class="stat-value">${roster.length}</div></div>
      <div class="stat"><div class="stat-label">Test days</div><div class="stat-value">${days.length}</div></div>
      <div class="stat"><div class="stat-label">Last tested</div><div class="stat-value" style="font-size:24px">${latest ? esc(fmtDate(latest.date)) : '–'}</div></div>
      <div class="stat"><div class="stat-label">Sport</div><div class="stat-value" style="font-size:24px">${esc(t.sport || '–')}</div></div>
    </div>
    <div class="grid two"><div class="col">
      <div class="card"><div class="card-head"><h3>Test days</h3><button class="btn sm primary" data-act="ttStart" data-team="${t.id}">${icon('plus', 'sm')}New test day</button></div>
        ${days.length ? `<div class="list">${[...days].reverse().map(ttDayRow).join('')}</div>` : '<div class="muted small">No test days yet. Tap New test day to test the whole team.</div>'}</div>
      ${prog.length ? `<div class="card"><div class="card-head"><h3>Team progress</h3><span class="sub">latest team average</span></div><div class="table-wrap"><table class="t"><thead><tr><th>Test</th><th class="n">Average</th><th>Change</th></tr></thead><tbody>
        ${prog.map(x => `<tr><td><b>${esc(ttLabel(x.k))}</b><div class="faint tiny">${esc(fmtDate(x.s.date))} · ${plural(x.n, 'athlete')}</div></td><td class="n nowrap">${esc(fmtMetric(x.d, x.avg))}</td><td class="small">${x.ch ? `${deltaHtml(x.d, x.ch.pct)} <span class="faint">since ${esc(fmtDate(x.ch.prev.date))}, ${x.ch.n} athletes</span>` : '<span class="faint">first test</span>'}</td></tr>`).join('')}
      </tbody></table></div><p class="faint tiny" style="margin:8px 0 0">Change = the average of each athlete’s own change, using only athletes tested both times.</p></div>` : ''}
    </div><div class="col">
      <div class="card"><div class="card-head"><h3>Roster</h3><button class="btn sm" data-act="ttTeam" data-id="${t.id}">${icon('edit', 'sm')}Edit</button></div>
        ${roster.length ? `<div class="list">${roster.map(a => { const age = ageFrom(a.dob); return `<a class="row" href="#/athlete/${a.id}">${avatar(a, 'sm')}<span class="row-main"><span class="row-title">${esc(athleteName(a))}${a.archived ? ' <span class="badge">Archived</span>' : ''}</span><span class="row-sub">${esc([age != null ? `Age ${age}` : 'No birth date', a.sex === 'F' ? 'Female' : a.sex === 'M' ? 'Male' : '', a.position].filter(Boolean).join(' · '))}</span></span>${icon('chevR', 'sm')}</a>`; }).join('')}</div>` : '<div class="muted small">No athletes yet. Tap Edit to add them.</div>'}</div>
    </div></div>`;
  return { title: t.name, nav: 'teams', back: '#/teams', body, actions: `<button class="btn" data-act="ttTeam" data-id="${t.id}">${icon('edit', 'sm')}<span class="lbl">Edit team</span></button><button class="btn primary" data-act="ttStart" data-team="${t.id}">${icon('clipboard', 'sm')}<span class="lbl">Start testing</span></button>` };
}
ROUTES.teams = r => {
  if (r.parts[0]) return teamPage(r.parts[0]);
  const teams = [...S.teams].sort((a, b) => a.name.localeCompare(b.name));
  const byDate = (a, b) => b.date.localeCompare(a.date) || (b.createdAt || 0) - (a.createdAt || 0);
  const open = S.teamtests.filter(s => !s.done).sort(byDate), past = S.teamtests.filter(s => s.done).sort(byDate).slice(0, 15);
  const sugg = teamSuggestions();
  const body = `
    ${open.length ? `<div class="section-title">In progress</div><div class="card" style="padding:4px 14px">${open.map(ttDayRow).join('')}</div>` : ''}
    <div class="section-title">Teams</div>
    ${teams.length ? `<div class="tt-grid">${teams.map(teamCard).join('')}</div>` : `<div class="card">${emptyState_('users', 'No teams yet', 'Create a team and add its athletes once. Then test everyone, one athlete at a time or station by station. Every result goes straight to that athlete’s profile.', `<button class="btn primary" data-act="ttTeam">${icon('plus', 'sm')}Create a team</button>`)}</div>`}
    ${sugg.length ? `<div class="card"><div class="card-head"><h3>Make teams from your athletes</h3></div><p class="muted small" style="margin-top:0">Based on the Team / school field on athlete profiles.</p><div class="chips">${sugg.map(g => `<button class="chip" data-act="ttTeam" data-from="${esc(g.name)}">${icon('plus', 'sm')}${esc(g.name)} <span class="faint">${g.n}</span></button>`).join('')}</div></div>` : ''}
    ${past.length ? `<div class="section-title">Past test days</div><div class="card" style="padding:4px 14px">${past.map(ttDayRow).join('')}</div>` : ''}
    <div class="card"><div class="card-head"><h3>How team testing works</h3></div><ol class="small muted tt-how">
      <li>Create a team and add its athletes. You can paste a roster.</li>
      <li>Tap <b>Start testing</b>, then pick the tests and how many trials.</li>
      <li>Enter results <b>by athlete</b> (all of one athlete’s tests, then the next) or <b>by test</b> (one station, the whole team in a list). Each entry saves as you go, offline too.</li>
      <li><b>Results</b> shows team rankings, personal bests and changes. Every result is also saved on each athlete’s own profile.</li></ol></div>`;
  return { title: 'Team Testing', nav: 'teams', body, actions: `<button class="btn" data-act="groupTest">${icon('grid', 'sm')}<span class="lbl">Quick grid</span></button><button class="btn" data-act="ttTeam">${icon('plus', 'sm')}<span class="lbl">New team</span></button><button class="btn primary" data-act="ttStart">${icon('clipboard', 'sm')}<span class="lbl">Start testing</span></button>` };
};
