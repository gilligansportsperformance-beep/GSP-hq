/* =========================================================
   Percentiles: where an athlete stands on a test, compared with
   (1) GSP athletes of the same sex and age group (and sport when there are enough), and
   (2) published norm tables the coach loads, each with its citation.
   Nothing here is typed from memory: GSP percentiles are exact ranks in your own data,
   and published percentiles only exist for tables you load.
   ========================================================= */
const PCT_MIN_N = 5;
const PCT_LEVELS = [['auto', 'Best match (sex + age group, + sport if 5+)'], ['sas', 'Same sex, age group & sport'], ['sa', 'Same sex & age group'], ['s', 'Same sex, all ages'], ['all', 'All GSP athletes']];
const PCT_BASIS = [['latest', 'Latest result'], ['best12', 'Best in last 12 months'], ['best', 'All-time best']];
const NORM_PS = [5, 10, 25, 50, 75, 90, 95];
/* Published tables bundled with the app. Each needs the full citation in `source`. */
const NORMS_BUILTIN = [];

function pctKind(key) { return key.startsWith('lift:') ? 'mass' : M[key]?.kind || null; }
function pctUnit(key) { const k = pctKind(key); return k === 'len' ? U.len() : k === 'mass' ? U.mass() : key.startsWith('rel:') ? '× body mass' : M[key]?.unit || ''; }
function pctIn(key, x) { const k = pctKind(key); return k === 'len' ? U.lenIn(x) : k === 'mass' ? U.massIn(x) : x; }
function pctOut(key, v) { const k = pctKind(key); return k === 'len' ? U.lenOut(v) : k === 'mass' ? U.massOut(v) : v; }
function pctDec(key) { const k = pctKind(key); return k === 'len' || k === 'mass' ? 1 : key.startsWith('rel:') ? 2 : Math.max(M[key]?.dec ?? 2, 2); }

/* Tests on the percentile page: the leaderboard tests plus the high-school-standard metrics that aren't ranked
   as records (time to takeoff, drop landing) */
function pctDefs() {
  const d = lbMetricDefs(), have = new Set(d.map(x => x.key));
  HS_STD.forEach(s => {
    const m = M[s.key];
    if (m && m.dir && !have.has(s.key)) d.push({ key: s.key, label: m.label, cat: TEST_CATS.find(c => c.key === m.cat)?.label || '', dir: m.dir, fmt: v => fmtMetric(m, v) });
  });
  return d;
}
const pctDef = key => pctDefs().find(d => d.key === key);
/* One value per athlete (latest, best in 12 months, or all-time best), with age and group at that test date */
function pctPool(key, basis = 'latest') {
  const d = pctDef(key);
  if (!d) return [];
  const per = new Map(), since = addDays(today(), -365);
  lbEntries(key).forEach(e => {
    if (basis === 'best12' && e.date < since) return;
    const c = per.get(e.aid);
    if (!c || (basis === 'latest' ? e.date > c.date || (e.date === c.date && e.at > c.at) : better(d.dir, e.v, c.v))) per.set(e.aid, e);
  });
  return [...per.values()].map(e => {
    const a = getAthlete(e.aid), age = ageAt(a.dob, e.date);
    return { ...e, a, age, ag: ageGroupOf(age), sex: a.sex === 'M' || a.sex === 'F' ? a.sex : '', sport: (a.sport || '').trim().toLowerCase() };
  });
}
const PEER = {
  sas: me => p => p.sex === me.sex && p.ag === me.ag && p.sport === me.sport,
  sa: me => p => p.sex === me.sex && p.ag === me.ag,
  s: me => p => p.sex === me.sex,
  all: () => () => true,
};
/* Percentile rank = (results worse + ½ × equal results) ÷ group size × 100 */
function pctRank(vals, v, dir) {
  let worse = 0, eq = 0;
  vals.forEach(x => { if (x === v) eq++; else if (dir === -1 ? x > v : x < v) worse++; });
  return (worse + 0.5 * eq) / vals.length * 100;
}
function gspPct(me, pool, dir, level = 'auto') {
  const run = lv => {
    if (lv !== 'all' && !me.sex) return { lv, need: 'sex' };
    if ((lv === 'sa' || lv === 'sas') && !me.ag) return { lv, need: 'date of birth' };
    if (lv === 'sas' && !me.sport) return { lv, need: 'sport' };
    const g = pool.filter(PEER[lv](me));
    return g.length < PCT_MIN_N ? { lv, n: g.length, few: true } : { lv, n: g.length, p: pctRank(g.map(x => x.v), me.v, dir) };
  };
  if (level !== 'auto') return run(level);
  const a = run('sas');
  return a.p != null ? a : run('sa');
}
function pctGroupLabel(me, lv) {
  const sx = me.sex === 'F' ? 'Female' : me.sex === 'M' ? 'Male' : '';
  const ag = AGE_GROUPS.find(x => x[0] === me.ag)?.[1] || '';
  return lv === 'all' ? 'All GSP athletes' : lv === 's' ? `${sx}, all ages` : lv === 'sa' ? `${sx}, ${ag}` : `${sx}, ${ag}, ${me.a.sport}`;
}
function pctReliab(n) { return n >= 30 ? ['good', 'good sample'] : n >= 10 ? ['info', 'moderate sample'] : ['warn', 'small sample']; }
function pctBand(p) { return p >= 90 ? ['p-ex', 'Excellent'] : p >= 75 ? ['p-ab', 'Above average'] : p >= 25 ? ['p-av', 'Average'] : ['p-be', 'Below average']; }
function pctOrd(p) { const n = Math.round(p); const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th'; return n + s; }

/* ---------- Published norm tables ---------- */
function normTablesAll() { return [...NORMS_BUILTIN, ...(S.settings.normTables || [])]; }
function normFor(key, me) {
  const c = normTablesAll().filter(t => t.metric === key && (t.sex === 'all' || t.sex === me.sex)
    && (t.ageMin == null || (me.age != null && me.age >= t.ageMin)) && (t.ageMax == null || (me.age != null && me.age <= t.ageMax))
    && (!t.sport || t.sport.trim().toLowerCase() === me.sport));
  const score = t => (t.sport ? 4 : 0) + (t.sex !== 'all' ? 2 : 0) + (t.ageMin != null || t.ageMax != null ? 1 : 0);
  const span = t => (t.ageMax ?? 99) - (t.ageMin ?? 0);
  return c.sort((x, y) => score(y) - score(x) || span(x) - span(y) || (y.at || 0) - (x.at || 0))[0] || null;
}
/* Linear interpolation between the table's percentile points; beyond the ends shows <P5 / >P95 */
function normPct(t, v, dir) {
  const pts = [...t.points].sort((a, b) => a[0] - b[0]);
  const worse = (x, y) => (dir === -1 ? x > y : x < y);
  if (worse(v, pts[0][1])) return { p: pts[0][0], below: true };
  if (worse(pts[pts.length - 1][1], v)) return { p: pts[pts.length - 1][0], above: true };
  for (let i = 0; i < pts.length - 1; i++) {
    const [p1, v1] = pts[i], [p2, v2] = pts[i + 1];
    if (!worse(v, v1) && !worse(v2, v)) return { p: v2 === v1 ? (p1 + p2) / 2 : p1 + (p2 - p1) * (v - v1) / (v2 - v1) };
  }
  return null;
}
function normLabel(t) {
  const sx = t.sex === 'F' ? 'Female' : t.sex === 'M' ? 'Male' : 'Both sexes';
  const ag = t.ageMin != null && t.ageMax != null ? (t.ageMin === t.ageMax ? `age ${t.ageMin}` : `ages ${t.ageMin}–${t.ageMax}`) : t.ageMin != null ? `age ${t.ageMin}+` : t.ageMax != null ? `up to ${t.ageMax}` : 'all ages';
  return [sx, ag, t.sport, t.level].filter(Boolean).join(' · ');
}
function pctText(r) { return r.below ? `<P${r.p}` : r.above ? `>P${r.p}` : pctOrd(r.p); }

/* Everything shown for one athlete on one test */
function pctFor(key, aid, { level = 'auto', basis = 'latest', pool = null } = {}) {
  const d = pctDef(key);
  if (!d) return null;
  pool ||= pctPool(key, basis);
  const me = pool.find(x => x.aid === aid);
  if (!me) return null;
  const g = gspPct(me, pool, d.dir, level);
  const t = normFor(key, me);
  return { d, me, g, t, np: t ? normPct(t, me.v, d.dir) : null };
}
function pctBar(p) { return `<div class="pct-bar" role="img" aria-label="${pctOrd(p)} percentile"><span style="left:${clamp(p, 0, 100)}%"></span></div>`; }
function gspCell(r) {
  const g = r.g;
  if (g.p == null) return `<div class="faint small">${g.need ? `Add the athlete’s ${esc(g.need)} to compare.` : `Only ${g.n} in ${esc(pctGroupLabel(r.me, g.lv))}. Need ${PCT_MIN_N}+.`}</div>`;
  const [bc, bl] = pctBand(g.p), [rc, rl] = pctReliab(g.n);
  return `<div class="pct-val">${pctOrd(g.p)}<small>pct</small></div>${pctBar(g.p)}<div class="pct-meta"><span class="pct-band ${bc}">${bl}</span> · vs ${g.n} ${esc(pctGroupLabel(r.me, g.lv))} <span class="badge ${rc}">${rl}</span></div>`;
}
function normCell(r) {
  if (!r.t) return '<div class="faint small">No matching published table.</div>';
  if (!r.np) return '<div class="faint small">Couldn’t place this result in the table.</div>';
  const p = r.np.p, [bc, bl] = pctBand(p);
  return `<div class="pct-val">${esc(pctText(r.np))}<small>${r.np.below || r.np.above ? '' : 'pct'}</small></div>${pctBar(p)}<div class="pct-meta"><span class="pct-band ${bc}">${bl}</span> · ${esc(normLabel(r.t))}</div>`;
}

function stdPctCell(key, me) {
  const r = stdEval(me.a, key, me.v, me.date);
  if (!r) return '';
  if (r.need) return '<div class="faint small">Set the athlete’s sex to compare.</div>';
  return `<div class="std-pv">${stdBadge(r)}</div>${stdMeter(r)}<div class="pct-meta">${esc(stdVal(r))} · ${r.target ? 'target' : `${esc(SEX_WORD[r.sex])} 14–18`}${r.inAge ? '' : ` · <b>reference only</b> (age ${r.age ?? '?'})`}</div>`;
}

/* ---------- Page ---------- */
ROUTES.percentiles = r => {
  const P = (UI.pct ||= { key: 'sprint10', level: 'auto', basis: 'latest', sex: 'all', age: 'all', sport: 'all', former: false });
  const defs = pctDefs();
  const withData = new Set(defs.filter(x => lbEntries(x.key).length).map(x => x.key));
  if (r.q.k && defs.some(x => x.key === r.q.k)) P.key = r.q.k;
  if (!withData.has(P.key)) P.key = LB_POPULAR.find(k => withData.has(k)) || [...withData][0] || P.key;
  const d = defs.find(x => x.key === P.key);
  if (!withData.size || !d) return { title: 'Percentiles', nav: 'percentiles', body: `<div class="card">${emptyState_('trend', 'No results yet', 'Percentiles appear once you enter test results. They compare each athlete with GSP athletes of the same sex and age group, and with any published norm tables you load.', '<a class="btn primary" href="#/athletes">Go to athletes</a>')}</div>` };
  const hl = r.q.a || '';
  const cats = [...new Set(defs.map(x => x.cat))];
  const picker = `<select data-change="pctKey" aria-label="Test" class="lb-picker">${cats.map(c => `<optgroup label="${esc(c)}">${defs.filter(x => x.cat === c).map(x => `<option value="${esc(x.key)}" ${x.key === P.key ? 'selected' : ''} ${withData.has(x.key) ? '' : 'disabled'}>${esc(x.label)}${withData.has(x.key) ? '' : ' (no data)'}</option>`).join('')}</optgroup>`).join('')}</select>`;
  const chips = `<div class="chips scroll" style="margin:10px 0 4px">${LB_POPULAR.filter(k => withData.has(k)).map(k => `<button class="chip ${k === P.key ? 'on' : ''}" data-act="pctChip" data-k="${k}">${esc(M[k].label)}</button>`).join('')}</div>`;
  const sports = [...new Set(S.athletes.map(a => a.sport).filter(Boolean))].sort();
  const controls = `<div class="lb-filters">
    ${sel('level', PCT_LEVELS, P.level, 'data-change="pctSet" data-k="level" aria-label="Compare with"')}
    ${sel('basis', PCT_BASIS, P.basis, 'data-change="pctSet" data-k="basis" aria-label="Result used"')}
    ${sel('sex', [['all', 'All athletes'], ['F', 'Female'], ['M', 'Male']], P.sex, 'data-change="pctSet" data-k="sex" aria-label="Show"')}
    ${sel('age', AGE_GROUPS, P.age, 'data-change="pctSet" data-k="age" aria-label="Age group"')}
    ${sel('sport', [['all', 'All sports'], ...sports.map(s => [s, s])], P.sport, 'data-change="pctSet" data-k="sport" aria-label="Sport"')}
    <label class="check small" style="padding:0"><input type="checkbox" data-change="pctFormer" ${P.former ? 'checked' : ''}> Show former athletes</label>
  </div>`;
  const pool = pctPool(P.key, P.basis);
  const rows = pool.filter(e => (P.former || !e.a.archived) && (P.sex === 'all' || e.sex === P.sex) && (P.age === 'all' || e.ag === P.age) && (P.sport === 'all' || (e.a.sport || '') === P.sport))
    .map(e => pctFor(P.key, e.aid, { level: P.level, basis: P.basis, pool }))
    .sort((x, y) => (y.g.p ?? -1) - (x.g.p ?? -1) || (d.dir === -1 ? x.me.v - y.me.v : y.me.v - x.me.v));
  const tables = normTablesAll().filter(t => t.metric === P.key);
  const std = STD_BY[P.key] || null;
  const list = rows.map(x => `<div class="pct-row ${x.me.aid === hl ? 'hl' : ''} ${std ? 'has-std' : ''}">
      <a class="pct-who" href="#/athlete/${x.me.aid}/evaluation">${avatar(x.me.a, 'sm')}<span><b>${esc(athleteName(x.me.a))}</b>${x.me.a.archived ? ' <span class="badge">Former</span>' : ''}
        <span class="pct-meta">${[x.me.sex === 'F' ? 'F' : x.me.sex === 'M' ? 'M' : '', x.me.age != null ? `age ${x.me.age}` : 'no DOB', x.me.a.sport].filter(Boolean).map(esc).join(' · ')}</span>
        <span class="pct-res">${esc(d.fmt(x.me.v))} <span class="faint">· ${esc(fmtDate(x.me.date))}</span></span></span></a>
      <div class="pct-cell"><div class="kicker">GSP</div>${gspCell(x)}</div>
      <div class="pct-cell"><div class="kicker">Published norm</div>${normCell(x)}</div>
      ${std ? `<div class="pct-cell std"><div class="kicker">HS standard</div>${stdPctCell(P.key, x.me)}</div>` : ''}
    </div>`).join('');
  const body = `
    <div class="card">${picker}${chips}${controls}</div>
    ${rows.length ? `<div class="card">${list}</div>` : `<div class="card">${emptyState_('trend', 'No athletes match', 'Try a different test or widen the filters.')}</div>`}
    ${std ? `<div class="card"><div class="card-head"><h3>High-school standards · ${esc(std.label)}</h3><a class="btn sm" href="#/fpai/standards">${icon('list', 'sm')}Full chart</a></div>
      ${std.target ? `<div class="small">${stdTargetsHtml([std])}</div>` : stdTableHtml([std])}
      <p class="faint tiny" style="margin:8px 0 0">Your GSP standards for ages 14–18. A level counts once the result reaches the number where the chart starts it; a result in a gap between levels counts as the lower one.${std.net ? ' Relative IMTP force = force above body weight ÷ body weight.' : ''}</p></div>` : ''}
    <div class="grid two">
      <div class="card"><div class="card-head"><h3>Published norms · ${esc(d.label)}</h3></div>
        ${tables.length ? `<div class="list">${tables.map(t => `<button class="row" data-act="editNorm" data-id="${esc(t.id)}"><span class="row-main"><span class="row-title">${esc(normLabel(t))}</span><span class="row-sub">${esc(t.source)}</span></span><span class="small faint nowrap">P50 ${esc(fmtNum(pctOut(t.metric, (t.points.find(p => p[0] === 50) || [])[1] ?? NaN), pctDec(t.metric)))}</span></button>`).join('')}</div>`
          : `<p class="muted small" style="margin-top:0">None loaded for this test yet. Add a published percentile table (e.g. from a youth fitness study, your force-plate company’s norms or a governing body) to compare athletes with a wider population. The age, sex and sport you enter decide which athletes it applies to.</p>`}
        <div class="chips" style="margin-top:10px"><button class="btn sm primary" data-act="editNorm" data-k="${esc(P.key)}">${icon('plus', 'sm')}Add table</button><button class="btn sm" data-act="pasteNorms" data-k="${esc(P.key)}">${icon('upload', 'sm')}Paste several</button></div>
      </div>
      <div class="card prose small"><b>How percentiles work.</b>
        <ul><li><b>GSP:</b> the share of your athletes in the same group with a worse result (ties count half). Each athlete counts once (${esc(PCT_BASIS.find(b => b[0] === P.basis)[1].toLowerCase())}), and age is the age on the test date. Former athletes’ results are included. Groups under ${PCT_MIN_N} aren’t shown; under 10 treat as rough, 30+ is solid.</li>
        <li><b>Best match</b> uses the same sex and age group, narrowed to the same sport when 5+ athletes share it. It never mixes age groups, because growth changes results a lot at these ages.</li>
        <li><b>Published norm:</b> placed between the table’s percentile points. The most specific table wins: sport, then sex, then the narrowest age range. Only as good as the table, so keep the source.</li>
        <li>${d.dir === -1 ? 'Lower is better for this test.' : 'Higher is better for this test.'} Above the 75th = above average, 90th+ = excellent, below the 25th = below average.</li></ul></div>
    </div>`;
  return { title: 'Percentiles', nav: 'percentiles', body };
};
A.pctSet = el => { UI.pct[el.dataset.k] = el.value; refresh(); };
A.pctFormer = el => { UI.pct.former = el.checked; refresh(); };
A.pctKey = el => { UI.pct.key = el.value; go('#/percentiles'); };
A.pctChip = el => { UI.pct.key = el.dataset.k; go('#/percentiles'); };

/* ---------- Athlete Evaluation tab card ---------- */
function athPctCard(a) {
  const defs = pctDefs();
  const order = k => { const i = LB_POPULAR.indexOf(k); return i < 0 ? 99 : i; };
  const rows = defs.map(d => pctFor(d.key, a.id)).filter(Boolean).sort((x, y) => order(x.d.key) - order(y.d.key)).slice(0, 14);
  if (!rows.length) return '';
  return `<div class="card"><div class="card-head"><h3>Percentiles</h3><a class="btn sm" href="#/percentiles?a=${a.id}">${icon('trend', 'sm')}All</a></div>
    <div class="table-wrap"><table class="t pct-table"><thead><tr><th>Test</th><th class="n">Result</th><th class="n">GSP</th><th class="n">Norm</th></tr></thead><tbody>
    ${rows.map(x => `<tr class="click" data-act="pctOpen" data-k="${esc(x.d.key)}" data-a="${a.id}"><td>${esc(x.d.label)}<div class="faint tiny">${x.g.p != null ? `vs ${x.g.n} ${esc(pctGroupLabel(x.me, x.g.lv))}` : x.g.need ? `needs ${esc(x.g.need)}` : `only ${x.g.n} in group`}</div></td>
      <td class="n nowrap">${esc(x.d.fmt(x.me.v))}${STD_BY[x.d.key] ? `<div class="std-pc">${stdBadge(stdEval(a, x.d.key, x.me.v, x.me.date), true)}</div>` : ''}</td>
      <td class="n">${x.g.p != null ? `<b class="pct-band ${pctBand(x.g.p)[0]}">${pctOrd(x.g.p)}</b>` : '<span class="faint">—</span>'}</td>
      <td class="n">${x.np ? `<b class="pct-band ${pctBand(x.np.p)[0]}">${esc(pctText(x.np))}</b>` : '<span class="faint">—</span>'}</td></tr>`).join('')}
    </tbody></table></div>
    <p class="faint tiny" style="margin:8px 0 0">Latest result for each test. GSP = same sex and age group (and sport when 5+ share it). Norm = a published table you’ve loaded. The label under a result is its level on your high-school standards (ages 14–18).</p></div>`;
}
A.pctOpen = el => { (UI.pct ||= { key: 'sprint10', level: 'auto', basis: 'latest', sex: 'all', age: 'all', sport: 'all', former: false }).key = el.dataset.k; go(`#/percentiles?a=${el.dataset.a}`); };

/* ---------- Norm table editor ---------- */
function normTestSelect(key) {
  const defs = pctDefs(), cats = [...new Set(defs.map(x => x.cat))];
  return `<select name="metric">${cats.map(c => `<optgroup label="${esc(c)}">${defs.filter(x => x.cat === c).map(x => `<option value="${esc(x.key)}" ${x.key === key ? 'selected' : ''}>${esc(x.label)}</option>`).join('')}</optgroup>`).join('')}</select>`;
}
function normCheck(key, pts) {
  const d = pctDef(key);
  if (pts.length < 3) return 'Enter at least 3 percentile values.';
  for (let i = 1; i < pts.length; i++) {
    const up = pts[i][1] - pts[i - 1][1];
    if (d.dir === -1 ? up > 0 : up < 0) return `For ${d.label}, ${d.dir === -1 ? 'lower' : 'higher'} is better, so higher percentiles need ${d.dir === -1 ? 'lower (faster)' : 'higher'} values. Check the order, or whether the source ranks from best to worst.`;
  }
  if (pts[0][1] === pts[pts.length - 1][1]) return 'The values are all the same.';
  return '';
}
const normSports = () => `<datalist id="pctSports">${[...new Set(S.athletes.map(a => a.sport).filter(Boolean))].sort().map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
A.editNorm = el => {
  const t = el.dataset.id ? (S.settings.normTables || []).find(x => x.id === el.dataset.id) : null;
  if (el.dataset.id && !t) return toast('This table is built in and can’t be edited');
  const key0 = t?.metric || el.dataset.k || UI.pct?.key || 'sprint10';
  const val = p => { const x = t?.points.find(q => q[0] === p)?.[1]; return x != null ? inVal(pctOut(t.metric, x), pctDec(t.metric)) : ''; };
  openModal({
    title: t ? 'Edit norm table' : 'Add norm table', size: 'wide',
    body: `<p class="muted small" style="margin-top:0">Copy a published percentile table. For each percentile enter the result an athlete needs to be <b>better than that % of the group</b>, so for timed tests P90 is the faster (lower) time. Leave any you don’t have blank.</p>
      ${field('Test', normTestSelect(key0))}
      <div class="fields three">${field('Sex', sel('sex', [['all', 'Both'], ['F', 'Female'], ['M', 'Male']], t?.sex || 'all'))}${field('Age from', numInp('ageMin', t?.ageMin ?? '', 'inputmode="numeric" placeholder="any"'))}${field('Age to', numInp('ageMax', t?.ageMax ?? '', 'inputmode="numeric" placeholder="any"'))}</div>
      <div class="fields">${field('Sport', inp('sport', t?.sport || '', 'list="pctSports" placeholder="Blank = any sport"'))}${field('Population / level', inp('level', t?.level || '', 'placeholder="e.g. US high school"'))}</div>
      <div class="field"><span class="field-label"><span>Percentile values</span><span class="u" data-unit>${esc(pctUnit(key0))}</span></span><div class="norm-pts">${NORM_PS.map(p => field('P' + p, numInp('p' + p, val(p)))).join('')}</div></div>
      ${field('Source', ta('source', t?.source || '', 'rows="2" placeholder="Authors, year, title, journal or website"'), { hint: 'Required, so the numbers can always be checked.' })}
      ${normSports()}`,
    onSubmit: v => {
      const key = v.metric;
      if (!pctDef(key)) return 'Choose a test.';
      const ageMin = v.ageMin.trim() ? num(v.ageMin) : null, ageMax = v.ageMax.trim() ? num(v.ageMax) : null;
      if ([ageMin, ageMax].some(x => x != null && !(x >= 3 && x <= 99))) return 'Ages should be 3–99.';
      if (ageMin != null && ageMax != null && ageMin > ageMax) return 'Age from must be ≤ age to.';
      const pts = NORM_PS.map(p => [p, num(v['p' + p])]).filter(x => x[1] != null).map(([p, x]) => [p, pctIn(key, x)]);
      const err = normCheck(key, pts);
      if (err) return err;
      if (v.source.trim().length < 6) return 'Add the source (authors, year, title).';
      const rec = { id: t?.id || uid(), metric: key, sex: v.sex, ageMin: ageMin != null ? Math.round(ageMin) : null, ageMax: ageMax != null ? Math.round(ageMax) : null, sport: v.sport.trim().slice(0, 60), level: v.level.trim().slice(0, 80), source: v.source.trim().slice(0, 400), points: pts, at: Date.now() };
      S.settings.normTables = [...(S.settings.normTables || []).filter(x => x.id !== rec.id), rec];
      persist(); toast('Norm table saved'); refresh();
    },
    onDelete: t ? async () => {
      if (!(await confirmBox('Delete this norm table?', normLabel(t)))) return false;
      S.settings.normTables = (S.settings.normTables || []).filter(x => x.id !== t.id);
      persist(); toast('Norm table deleted'); refresh();
    } : null,
    onMount: m => { m.form.metric.addEventListener('change', () => { $('[data-unit]', m.wrap).textContent = pctUnit(m.form.metric.value); }); },
  });
};
/* Paste many rows at once: sex, age from, age to, P5, P10, P25, P50, P75, P90, P95 */
function parseNormRows(text, key, unit) {
  const conv = x => { const k = pctKind(key); if (k === 'len') return unit === 'in' ? x * 2.54 : unit === 'm' ? x * 100 : x; if (k === 'mass') return unit === 'lb' ? x / 2.2046226218 : x; return x; };
  const out = [], errs = [];
  let skipped = 0;
  String(text).split(/\r?\n/).forEach((line, i) => {
    if (!line.trim()) return;
    const c = line.split(/\t|,|;/).map(x => x.trim());
    const sx = /^(f|female|girls?|women|w)$/i.test(c[0]) ? 'F' : /^(m|male|boys?|men)$/i.test(c[0]) ? 'M' : /^(all|both|any|-)?$/i.test(c[0]) ? 'all' : null;
    if (!sx) { skipped++; return; }
    const ageMin = c[1] ? num(c[1]) : null, ageMax = c[2] ? num(c[2]) : null;
    if ((c[1] && ageMin == null) || (c[2] && ageMax == null)) { errs.push(`Line ${i + 1}: ages must be numbers`); return; }
    const pts = NORM_PS.map((p, j) => [p, c[3 + j] ? num(c[3 + j]) : null]).filter(x => x[1] != null).map(([p, x]) => [p, conv(x)]);
    const e = normCheck(key, pts);
    if (e) { errs.push(`Line ${i + 1}: ${e}`); return; }
    out.push({ sex: sx, ageMin: ageMin != null ? Math.round(ageMin) : null, ageMax: ageMax != null ? Math.round(ageMax) : null, points: pts });
  });
  return { out, errs, skipped };
}
A.pasteNorms = el => {
  const key0 = el.dataset.k || UI.pct?.key || 'sprint10';
  const unitOpts = k => (pctKind(k) === 'len' ? [['cm', 'cm'], ['in', 'in'], ['m', 'm']] : pctKind(k) === 'mass' ? [['kg', 'kg'], ['lb', 'lb']] : [['', pctUnit(k) || 'as entered']]);
  openModal({
    title: 'Paste norm tables', size: 'wide', submit: 'Add tables',
    body: `<p class="muted small" style="margin-top:0">One row per group, copied from a spreadsheet or typed: <b>sex, age from, age to, P5, P10, P25, P50, P75, P90, P95</b>. Sex can be F/M/Female/Male/Girls/Boys/All. Leave a cell empty if the source doesn’t give it. A header row is skipped.</p>
      ${field('Test', normTestSelect(key0))}
      <div class="fields three">${field('Units in the table', sel('unit', unitOpts(key0), U.imp() && pctKind(key0) === 'len' ? 'in' : U.imp() && pctKind(key0) === 'mass' ? 'lb' : unitOpts(key0)[0][0]))}${field('Sport', inp('sport', '', 'list="pctSports" placeholder="Blank = any sport"'))}${field('Population / level', inp('level', '', 'placeholder="e.g. European youth"'))}</div>
      ${field('Rows', ta('rows', '', 'rows="8" placeholder="F, 13, 13, 135, 142, 153, 166, 179, 190, 197\nM, 13, 13, 141, 150, 164, 179, 194, 206, 214" style="font-family:var(--mono);font-size:13px"'))}
      <div class="computed" id="normPrev" style="margin:0 0 14px">Paste rows to preview.</div>
      ${field('Source', ta('source', '', 'rows="2" placeholder="Authors, year, title, journal"'), { hint: 'Required. Applied to every table you add here.' })}
      ${normSports()}`,
    onSubmit: v => {
      if (!pctDef(v.metric)) return 'Choose a test.';
      const r = parseNormRows(v.rows, v.metric, v.unit);
      if (r.errs.length) return r.errs.slice(0, 3).join(' · ');
      if (!r.out.length) return 'No rows found. Check the format: sex, age from, age to, P5 … P95.';
      if (v.source.trim().length < 6) return 'Add the source (authors, year, title).';
      const add = r.out.map(x => ({ id: uid(), metric: v.metric, ...x, sport: v.sport.trim().slice(0, 60), level: v.level.trim().slice(0, 80), source: v.source.trim().slice(0, 400), at: Date.now() }));
      S.settings.normTables = [...(S.settings.normTables || []), ...add];
      persist(); toast(`${plural(add.length, 'norm table')} added`); refresh();
    },
    onMount: m => {
      const prev = () => {
        const r = parseNormRows(m.form.rows.value, m.form.metric.value, m.form.unit.value);
        const box = $('#normPrev', m.wrap);
        if (!m.form.rows.value.trim()) { box.textContent = 'Paste rows to preview.'; return; }
        box.innerHTML = `${r.out.length ? `<b>${plural(r.out.length, 'table')}</b> ready (${r.out.filter(x => x.sex === 'F').length} female, ${r.out.filter(x => x.sex === 'M').length} male, ${r.out.filter(x => x.sex === 'all').length} both)` : 'No valid rows yet'}${r.skipped ? ` · ${plural(r.skipped, 'line')} skipped` : ''}${r.errs.length ? `<div style="color:var(--bad);margin-top:4px">${r.errs.slice(0, 4).map(esc).join('<br>')}</div>` : ''}`;
      };
      m.form.rows.addEventListener('input', prev);
      m.form.metric.addEventListener('change', () => { m.form.unit.innerHTML = unitOpts(m.form.metric.value).map(o => `<option value="${esc(o[0])}">${esc(o[1])}</option>`).join(''); prev(); });
      m.form.unit.addEventListener('change', prev);
    },
  });
};
