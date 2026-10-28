/* =========================================================
   Leaderboard & all-time GSP records (computed live from data)
   ========================================================= */
// landing results are graded by the HS standards and percentiles, but not ranked as records
const LB_EXCLUDE = new Set([...ASYM_KEYS, 'ttt', 'djGct', 'brakeTime', 'imtpTtpf', 'f100Pct', 'dropBox', 'peakLandF', 'propTime', 'cmDepth', 'bm', 'dsi', 'dlPlf', 'dlPlfRel', 'dlTts']);
const LB_POPULAR = ['sprint10', 'sprint10yd', 'sprint20', 'sprint40yd', 'fly10', 'fly10yd', 'vmax', 'proAgility', 'cmj', 'vj', 'broad', 'rsiMod', 'cmjRelPP', 'cmjPP', 'djRsi', 'imtpRel'];
/* Two-year age bands (the coach's choice), used by the leaderboard and percentiles */
const AGE_GROUPS = [['all', 'All ages'], ['u12', '11 & under'], ['12', '12–13'], ['14', '14–15'], ['16', '16–17'], ['18', '18–19'], ['20', '20–21'], ['22', '22–23'], ['24', '24–25'], ['26', '26–27'], ['28', '28–29'], ['30', '30+']];
function ageGroupOf(age) { return age == null ? null : age <= 11 ? 'u12' : age >= 30 ? '30' : String(age % 2 ? age - 1 : age); }
function ageAt(dob, date) {
  if (!isDS(dob) || !isDS(date)) return null;
  const b = parseDS(dob), d = parseDS(date);
  let a = d.getFullYear() - b.getFullYear();
  if (d.getMonth() < b.getMonth() || (d.getMonth() === b.getMonth() && d.getDate() < b.getDate())) a--;
  return a;
}
function lbMetricDefs() {
  const tests = METRICS.filter(m => m.dir !== 0 && !LB_EXCLUDE.has(m.key)).map(m => ({ key: m.key, label: m.label, cat: TEST_CATS.find(c => c.key === m.cat)?.label || '', dir: m.dir, fmt: v => fmtMetric(m, v) }));
  const lifts = [...new Set(S.maxes.map(x => x.exerciseId))].map(getExercise).filter(Boolean).sort((a, b) => a.name.localeCompare(b.name)).flatMap(ex => [
    { key: 'lift:' + ex.id, label: `${ex.name} 1RM`, cat: 'Strength (tested 1RM)', dir: 1, fmt: v => fmtMass(v) },
    { key: 'rel:' + ex.id, label: `${ex.name} 1RM ÷ body mass`, cat: 'Strength (tested 1RM)', dir: 1, fmt: v => fmtNum(v, 2) + ' × BW' },
  ]);
  return [...tests, ...lifts];
}
function lbDef(key) { return lbMetricDefs().find(d => d.key === key); }
function bodyMassOn(aid, date) {
  const t = testsFor(aid).filter(x => x.bodyMassKg && x.date <= date).pop() || testsFor(aid).find(x => x.bodyMassKg);
  return t?.bodyMassKg ?? getAthlete(aid)?.massKg ?? null;
}
/* Every result for a metric: { aid, v, date, at } */
function lbEntries(key) {
  if (key.startsWith('lift:') || key.startsWith('rel:')) {
    const exId = key.split(':')[1], rel = key.startsWith('rel:');
    return S.maxes.filter(x => x.exerciseId === exId && x.kg > 0 && getAthlete(x.athleteId)).map(x => {
      const bm = rel ? bodyMassOn(x.athleteId, x.date) : null;
      return { aid: x.athleteId, v: rel ? (bm ? x.kg / bm : null) : x.kg, date: x.date, at: x.createdAt || 0 };
    }).filter(e => e.v != null);
  }
  const out = [];
  S.tests.forEach(t => {
    if (!getAthlete(t.athleteId)) return;
    let tm = TM_CACHE.get(t);
    if (!tm) { tm = testMetrics(t); TM_CACHE.set(t, tm); }
    const v = tm[key];
    if (v != null && Number.isFinite(v) && v > 0) out.push({ aid: t.athleteId, v, date: t.date, at: t.createdAt || 0 });
  });
  return out;
}
const TM_CACHE = new WeakMap();
const better = (dir, a, b) => (dir === -1 ? a < b : a > b);
function lbFilter(entries, f) {
  return entries.filter(e => {
    const a = getAthlete(e.aid);
    if (!f.archived && a.archived) return false;
    if (f.sex !== 'all' && a.sex !== f.sex) return false;
    if (f.sport !== 'all' && (a.sport || '') !== f.sport) return false;
    if (f.age !== 'all' && ageGroupOf(ageAt(a.dob, e.date)) !== f.age) return false;
    if (f.period !== 'all' && e.date < addDays(today(), -(+f.period))) return false;
    return true;
  });
}
function lbRank(entries, dir) {
  const best = new Map();
  entries.forEach(e => { const b = best.get(e.aid); if (!b || better(dir, e.v, b.v) || (e.v === b.v && e.date < b.date)) best.set(e.aid, e); });
  return [...best.values()].sort((x, y) => (dir === -1 ? x.v - y.v : y.v - x.v) || x.date.localeCompare(y.date));
}
/* Chronological record progression for one metric */
function recordHistory(key, dir, entries) {
  const list = [...entries].sort((a, b) => a.date.localeCompare(b.date) || a.at - b.at);
  const out = []; let best = null;
  list.forEach(e => { if (!best || better(dir, e.v, best.v)) { out.push({ ...e, prev: best }); best = e; } });
  return out;
}

/* ---------- New-record detection (runs after every save) ---------- */
let RECORD_BASE = null;
function currentRecords() {
  const map = {};
  lbMetricDefs().forEach(d => { const r = lbRank(lbEntries(d.key), d.dir)[0]; if (r) map[d.key] = r; });
  return map;
}
function recordBaseline() { try { RECORD_BASE = currentRecords(); } catch (e) { RECORD_BASE = {}; } }
function checkNewRecords() {
  if (!RECORD_BASE) return recordBaseline();
  let now;
  try { now = currentRecords(); } catch (e) { return; }
  const broken = [];
  Object.entries(now).forEach(([k, r]) => {
    const old = RECORD_BASE[k], d = lbDef(k);
    if (d && old && better(d.dir, r.v, old.v)) broken.push({ d, r });
  });
  RECORD_BASE = now;
  broken.slice(0, 3).forEach(({ d, r }) => toast(`🏆 New GSP record — ${d.label}: ${athleteName(getAthlete(r.aid), true)} ${d.fmt(r.v)}`));
}
function recentRecordsBanner() {
  if (!S.tests.length) return '';
  const since = addDays(today(), -7);
  const recent = [];
  lbMetricDefs().forEach(d => {
    const h = recordHistory(d.key, d.dir, lbEntries(d.key));
    h.filter(x => x.prev && x.date >= since).forEach(x => recent.push({ d, x }));
  });
  if (!recent.length) return '';
  recent.sort((a, b) => b.x.date.localeCompare(a.x.date));
  return `<a class="banner record" href="#/leaderboard/records">${icon('trophy')}<div class="grow"><b>${plural(recent.length, 'new GSP record')} this week:</b> ${recent.slice(0, 3).map(({ d, x }) => `${esc(athleteName(getAthlete(x.aid), true))} — ${esc(d.label)} ${esc(d.fmt(x.v))}`).join(' · ')}${recent.length > 3 ? ' …' : ''}</div>${icon('chevR', 'sm')}</a>`;
}

/* ---------- Views ---------- */
ROUTES.leaderboard = r => {
  const tab = r.parts[0] === 'records' ? 'records' : 'board';
  const L = (UI.lb ||= { key: 'sprint10', period: 'all', sex: 'all', age: 'all', sport: 'all', archived: true });
  const defs = lbMetricDefs();
  if (!defs.some(d => d.key === L.key)) L.key = defs[0]?.key;
  const sports = [...new Set(S.athletes.map(a => a.sport).filter(Boolean))].sort();
  const filters = `<div class="lb-filters">
      ${sel('period', [['all', 'All time'], ['365', 'Last 12 months'], ['90', 'Last 90 days'], ['30', 'Last 30 days']], L.period, 'data-change="lbSet" data-k="period" aria-label="Period"')}
      ${sel('sex', [['all', 'All athletes'], ['F', 'Female'], ['M', 'Male']], L.sex, 'data-change="lbSet" data-k="sex" aria-label="Sex"')}
      ${sel('age', AGE_GROUPS, L.age, 'data-change="lbSet" data-k="age" aria-label="Age group"')}
      ${sel('sport', [['all', 'All sports'], ...sports.map(s => [s, s])], L.sport, 'data-change="lbSet" data-k="sport" aria-label="Sport"')}
      <label class="check small" style="padding:0"><input type="checkbox" data-change="lbArchived" ${L.archived ? 'checked' : ''}> Include former athletes</label>
    </div>`;
  const tabs = `<nav class="tabs" style="margin-top:0">${[['board', 'Leaderboard'], ['records', 'GSP Records']].map(([k, l]) => `<a href="#/leaderboard${k === 'records' ? '/records' : ''}" class="${k === tab ? 'active' : ''}">${l}</a>`).join('')}</nav>`;
  if (!S.tests.length && !S.maxes.length) return { title: 'Leaderboard', body: tabs + `<div class="card">${emptyState_('trophy', 'No results yet', 'Rankings and all-time GSP records build automatically as you enter test results.', '<a class="btn primary" href="#/athletes">Go to athletes</a>')}</div>` };
  const body = tab === 'records' ? tabs + filters + recordsView(defs, L) : tabs + boardView(defs, L, filters);
  return { title: 'Leaderboard', body, nav: 'leaderboard', actions: `<button class="btn" data-act="lbPrint">${icon('download', 'sm')}<span class="lbl">Print</span></button>` };
};
function boardView(defs, L, filters) {
  const d = defs.find(x => x.key === L.key);
  const all = lbEntries(d.key);
  const rows = lbRank(lbFilter(all, L), d.dir);
  const recordAll = lbRank(lbFilter(all, { ...L, period: 'all', sex: 'all', age: 'all', sport: 'all', archived: true }), d.dir)[0];
  const cats = [...new Set(defs.map(x => x.cat))];
  const withData = new Set(defs.filter(x => lbEntries(x.key).length).map(x => x.key));
  const picker = `<select data-change="lbKey" aria-label="Test" class="lb-picker">${cats.map(c => `<optgroup label="${esc(c)}">${defs.filter(x => x.cat === c).map(x => `<option value="${esc(x.key)}" ${x.key === L.key ? 'selected' : ''} ${withData.has(x.key) ? '' : 'disabled'}>${esc(x.label)}${withData.has(x.key) ? '' : ' (no data)'}</option>`).join('')}</optgroup>`).join('')}</select>`;
  const chips = `<div class="chips scroll" style="margin:10px 0 4px">${LB_POPULAR.filter(k => withData.has(k)).map(k => `<button class="chip ${k === L.key ? 'on' : ''}" data-act="lbChip" data-k="${k}">${esc(M[k].label)}</button>`).join('')}</div>`;
  const recent = addDays(today(), -14);
  const podium = rows.slice(0, 3);
  return `
    <div class="card">${picker}${chips}${filters}</div>
    ${rows.length ? `
    <div class="podium">${[1, 0, 2].map(i => podium[i] ? (() => { const e = podium[i], a = getAthlete(e.aid); return `<a class="pod p${i + 1}" href="#/athlete/${a.id}/testing">${avatar(a, 'lg')}<div class="pod-name">${esc(athleteName(a, true))}</div><div class="pod-val">${esc(d.fmt(e.v))}</div><div class="pod-step"><span>${i + 1}</span></div></a>`; })() : '<div class="pod empty"></div>').join('')}</div>
    <div class="card flush"><div class="table-wrap"><table class="t lb-table"><thead><tr><th>#</th><th>Athlete</th><th class="n">${esc(d.label)}</th><th>Date</th><th class="hide-sm">Age</th><th class="hide-sm">Sport</th></tr></thead><tbody>
      ${rows.map((e, i) => { const a = getAthlete(e.aid); const isRec = recordAll && recordAll.aid === e.aid && recordAll.v === e.v; return `<tr class="click" data-act="lbOpen" data-a="${a.id}"><td><span class="rank r${i + 1}">${i + 1}</span></td><td><div style="display:flex;align-items:center;gap:10px">${avatar(a, 'sm')}<span><b>${esc(athleteName(a))}</b>${a.archived ? ' <span class="badge">Former</span>' : ''}</span></div></td>
        <td class="n"><b>${esc(d.fmt(e.v))}</b> ${isRec ? `<span class="badge rec">${icon('trophy', 'sm')}GSP record</span>` : e.date >= recent ? '<span class="badge good">New</span>' : ''}</td><td class="nowrap small">${esc(fmtDateFull(e.date))}</td><td class="hide-sm small">${ageAt(a.dob, e.date) ?? '–'}</td><td class="hide-sm small">${esc(a.sport || '–')}</td></tr>`; }).join('')}
    </tbody></table></div></div>
    <p class="faint small" style="margin-top:10px">Each athlete’s best result for the period. ${d.dir === -1 ? 'Lower is better.' : 'Higher is better.'} Rankings update instantly as results are added.</p>` :
    `<div class="card">${emptyState_('trophy', 'No results match', 'Try a different test or widen the filters.')}</div>`}`;
}
function recordsView(defs, L) {
  const cards = defs.map(d => {
    const entries = lbFilter(lbEntries(d.key), { ...L, period: 'all' });
    const h = recordHistory(d.key, d.dir, entries);
    if (!h.length) return '';
    const rec = h[h.length - 1], a = getAthlete(rec.aid);
    const sexBest = ['F', 'M'].map(sx => [sx, lbRank(entries.filter(e => getAthlete(e.aid).sex === sx), d.dir)[0]]).filter(x => x[1]);
    return `<div class="rec-card" data-act="lbChipBoard" data-k="${esc(d.key)}">
      <div class="rec-label">${esc(d.label)}</div>
      <div class="rec-val">${esc(d.fmt(rec.v))}</div>
      <div class="rec-who">${avatar(a, 'sm')}<span><b>${esc(athleteName(a))}</b><span class="faint"> · ${esc(fmtDate(rec.date, { month: 'short', day: 'numeric', year: 'numeric' }))}</span></span></div>
      ${L.sex === 'all' && sexBest.length > 1 ? `<div class="rec-sub">${sexBest.map(([sx, e]) => `<span>${sx === 'F' ? 'Girls' : 'Boys'}: <b>${esc(d.fmt(e.v))}</b> ${esc(athleteName(getAthlete(e.aid), true))}</span>`).join('')}</div>` : ''}
      ${h.length > 1 ? `<div class="rec-sub faint">Broken ${plural(h.length - 1, 'time')} · previous ${esc(d.fmt(h[h.length - 2].v))}</div>` : ''}
    </div>`;
  }).filter(Boolean);
  const timeline = defs.flatMap(d => recordHistory(d.key, d.dir, lbFilter(lbEntries(d.key), { ...L, period: 'all' })).filter(x => x.prev).map(x => ({ d, x }))).sort((a, b) => b.x.date.localeCompare(a.x.date)).slice(0, 25);
  const b = brand();
  return `
    <div class="rec-hero" style="--bp:${esc(b.primary)};--ba:${esc(b.accent)}"><div>${brandMark(b)}</div><div class="rec-hero-t">ALL-TIME RECORDS${L.sex !== 'all' ? ` · ${L.sex === 'F' ? 'GIRLS' : 'BOYS'}` : ''}${L.age !== 'all' ? ` · ${esc(AGE_GROUPS.find(x => x[0] === L.age)[1].toUpperCase())}` : ''}</div></div>
    ${cards.length ? `<div class="rec-grid">${cards.join('')}</div>` : `<div class="card">${emptyState_('trophy', 'No records for this group yet', 'Records appear as results are entered.')}</div>`}
    ${timeline.length ? `<div class="section-title">Recently broken</div><div class="card" style="padding:4px 14px">${timeline.map(({ d, x }) => `<div class="row"><span class="row-time" style="width:70px">${esc(fmtDate(x.date))}</span>${avatar(getAthlete(x.aid), 'sm')}<span class="row-main"><span class="row-title">${esc(athleteName(getAthlete(x.aid)))} — ${esc(d.label)} <b>${esc(d.fmt(x.v))}</b></span><span class="row-sub">Previous record ${esc(d.fmt(x.prev.v))} (${esc(athleteName(getAthlete(x.prev.aid), true))})</span></span>${icon('trophy', 'sm')}</div>`).join('')}</div>` : ''}`;
}
A.lbSet = el => { UI.lb[el.dataset.k] = el.value; refresh(); };
A.lbArchived = el => { UI.lb.archived = el.checked; refresh(); };
A.lbKey = el => { UI.lb.key = el.value; refresh(); };
A.lbChip = el => { UI.lb.key = el.dataset.k; refresh(); };
A.lbChipBoard = el => { UI.lb.key = el.dataset.k; go('#/leaderboard'); };
A.lbOpen = el => go(`#/athlete/${el.dataset.a}/testing`);
A.lbPrint = () => window.print();
