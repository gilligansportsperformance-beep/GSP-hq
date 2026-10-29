/* =========================================================
   Import results: OVR Force, OVR Jump and OVR Sprint exports (OVR Connect saves CSV), or any
   spreadsheet. Several files at once. Columns are matched from their headers (and can be changed),
   each row goes to the right test from its test-type column (or the file), trials are scored like the
   rest of the app (force-plate trials averaged; sprints and field tests keep the best), and importing
   the same rows again changes nothing. Each test keeps the device it came from, so OVR Jump
   (flight time) heights stay apart from force-plate heights.
   ========================================================= */
function parseCsv(text) {
  text = text.replace(/^﻿/, '');
  const first = text.split(/\r?\n/).find(l => l.trim()) || '';
  const delim = [',', ';', '\t'].map(d => [d, first.split(d).length]).sort((a, b) => b[1] - a[1])[0][0];
  const rows = []; let row = [], cell = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) {
      if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += ch;
    } else if (ch === '"') q = true;
    else if (ch === delim) { row.push(cell); cell = ''; }
    else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
    else cell += ch;
  }
  if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
  const clean = rows.filter(r => r.some(c => c.trim() !== ''));
  if (clean.length < 2) return null;
  const headers = clean[0].map((h, i) => h.trim() || `Column ${i + 1}`);
  return { headers, rows: clean.slice(1).map(r => headers.map((_, i) => (r[i] ?? '').trim())) };
}
const IMPORT_GUESS = [
  [/time to stabili[sz]/, 'dlTts'], [/(drop|depth) landing.*(relative|xbw|× ?bw|\/ ?bw)|relative landing force/, 'dlPlfRel'], [/(drop|depth) landing.*force/, 'dlPlf'],
  [/force (at|@) ?200|\bf200\b|200 ?ms force/, 'imtpF200'], [/net impulse|impulse.*(100|200|250) ?ms/, 'imtpImp'], [/abalakov|arm swing/, 'vj'],
  [/fly(ing)?.*10 ?y|10 ?y.*fly|5 ?(\+|yd build)/, 'fly10yd'], [/fly(ing)?.*10 ?m\b|10 ?m\b.*fly/, 'fly10'], [/\b0 ?(-|–|to) ?10 ?y|10 ?y(ar)?d.*(accel|sprint|dash|split)|^10 ?yd/, 'sprint10yd'],
  [/\b20 ?y(ar)?ds?\b/, 'sprint20yd'], [/\b5 ?m\b/, 'sprint5'], [/\b20 ?m\b/, 'sprint20'], [/\b30 ?m\b/, 'sprint30'],
  [/5.?10.?5|pro.?agility/, 'proAgility'], [/\b505\b/, 'cod505'], [/broad/, 'broad'], [/depth jump|drop jump height|dj height/, 'djHeight'], [/vertical/, 'vj'],
  [/take.?off velocity/, 'takeoffVel'], [/\bm?rsi.?mod|\bmrsi\b|rsi.?modified/, 'rsiMod'], [/time to take.?off|\bttt\b|contraction time/, 'ttt'],
  [/counter.?movement depth|\bcm depth|\bdepth\b/, 'cmDepth'], [/braking (phase )?(time|duration)|eccentric duration|braking phase/, 'brakeTime'],
  [/peak braking force|braking peak force/, 'peakBrakeF'], [/braking rfd|decel.*rfd|eccentric.*rfd/, 'brakeRfd'], [/braking impulse|eccentric impulse/, 'brakeImp'],
  [/propulsive (phase )?(time|duration)|concentric duration/, 'propTime'], [/peak propulsive force|concentric peak force/, 'cmjPF'],
  [/propulsive impulse|concentric impulse/, 'propImp'], [/relative (peak )?power|power.*\/.*kg|w\/kg/, 'cmjRelPP'], [/peak power/, 'cmjPP'],
  [/landing asym/, 'landAsym'], [/braking asym|eccentric asym/, 'brakeAsym'], [/propulsive asym|concentric asym/, 'propAsym'],
  [/peak landing force|landing force/, 'peakLandF'], [/force (at|@) ?100|\bf100\b|100 ?ms force/, 'imtpF100'], [/time to peak force/, 'imtpTtpf'],
  [/relative peak force|peak force.*\/.*kg|n\/kg/, 'imtpRel'], [/average force|mean force/, 'imtpAvgF'], [/\brfd\b|rate of force/, 'imtpRfd'],
  [/contact time|\bgct\b/, 'djGct'], [/\brsi\b/, 'djRsi'], [/jump height|\bjh\b/, 'cmj'], [/peak force/, 'cmjPF'],
  [/body ?(weight|mass)|\bweight\b|\bmass\b|\bbw\b/, '_bm'], [/sprint.*10|10 ?m\b/, 'sprint10'], [/40 ?y/, 'sprint40yd'],
];
function guessColumn(h) {
  const l = h.toLowerCase().trim();
  if (/^(athlete|name|full name|player|athlete name|user)$/.test(l) || /athlete name|full name/.test(l)) return '_name';
  if (/^first( name)?$/.test(l)) return '_first';
  if (/^last( name)?$/.test(l)) return '_last';
  if (/date|time ?stamp|recorded|tested|^time$|session/.test(l) && !/time to|contact time|braking time|propulsive time|flight time/.test(l)) return '_date';
  if (/^(test|test type|type|mode|jump type|exercise|protocol|test name|drill)$/.test(l)) return '_type';
  if (/^(side|leg|limb)$/.test(l)) return '_side';
  if (/^(distance|dist|split distance)\b/.test(l)) return '_dist';
  if (/flight time|air time|time in air/.test(l)) return '_flight';
  const g = IMPORT_GUESS.find(([re]) => re.test(l));
  if (g) return g[1];
  if (/^(time|result|total time|finish|finish time|sprint time)\s*(\((s|sec|seconds|ms)\))?$/.test(l)) return '_time';
  return '';
}
function guessUnit(h, key) {
  const l = h.toLowerCase();
  if (key === '_bm') return /lb/.test(l) ? 'lb' : /\bn\b|\(n\)/.test(l) ? 'N' : 'kg';
  if (key === '_dist') return /\(m\)|\bmeters?\b|\bmetres?\b/.test(l) ? 'm' : /yd|yard/.test(l) ? 'yd' : U.imp() ? 'yd' : 'm';
  if (key === '_time' || key === '_flight') return /\bms\b|\(ms\)|millisec/.test(l) ? 'ms' : 's';
  const d = M[key];
  if (!d) return '';
  if (d.kind === 'len') return /\(in|inch|"/.test(l) ? 'in' : /\(m\)|\bm\b(?!s)/.test(l) && !/cm/.test(l) ? 'm' : 'cm';
  if (d.unit === 's') return /\bms\b|\(ms\)|millisec/.test(l) ? 'ms' : 's';
  return '';
}
/* Dates as US month/day by default; day/month when the first number can't be a month */
function parseDateAny(s) {
  s = String(s || '').trim();
  let m;
  if ((m = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/))) return `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`;
  if ((m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})/))) {
    const y = m[3].length === 2 ? 2000 + +m[3] : +m[3];
    const [mo, d] = +m[1] > 12 && +m[2] <= 12 ? [+m[2], +m[1]] : [+m[1], +m[2]];
    return mo >= 1 && mo <= 12 && d >= 1 && d <= 31 ? `${y}-${pad(mo)}-${pad(d)}` : null;
  }
  const t = Date.parse(s);
  return Number.isFinite(t) ? toDS(new Date(t)) : null;
}
function convertImport(key, unit, v) {
  if (key === '_bm') return unit === 'lb' ? v / 2.2046226218 : unit === 'N' ? v / 9.81 : v;
  const d = M[key];
  if (!d) return v;
  if (d.kind === 'len') return unit === 'in' ? v * 2.54 : unit === 'm' ? v * 100 : v;
  if (d.unit === 's' && unit === 'ms') return v / 1000;
  return v;
}

/* ---------- Which test a row is ---------- */
const IMP_KINDS = [['auto', 'As the columns are matched'], ['cmj', 'Countermovement jump (hands on hips)'], ['sj', 'Squat jump'], ['abk', 'Vertical / Abalakov (arm swing)'], ['dj', 'Drop / depth jump (RSI)'], ['hop', '10/5 or repeated hops (RSI)'],
  ['land', 'Drop landing'], ['imtp', 'IMTP'], ['isq', 'Isometric squat'], ['slimtp', 'Single-leg IMTP'], ['calf', 'Calf isometric'], ['sprint', 'Sprint / agility'], ['skip', 'Skip these rows']];
function impKindOf(text) {
  const l = String(text || '').toLowerCase();
  if (!l.trim()) return 'auto';
  if (/single.?leg|\bsl\b|one.?leg|unilateral/.test(l) && /imtp|mid.?thigh|pull|isometric|\biso\b/.test(l)) return 'slimtp';
  if (/calf|plantar/.test(l)) return 'calf';
  if (/iso(metric)? ?squat|\bisq\b/.test(l)) return 'isq';
  if (/imtp|mid.?thigh|isometric|\biso\b/.test(l)) return 'imtp';
  if (/landing/.test(l)) return 'land';
  if (/10.?\/?.?5|repeat|pogo|hops?\b/.test(l)) return 'hop';
  if (/drop|depth|rebound|\bdj\b|\brsi\b|\bgct\b|contact/.test(l)) return 'dj';
  if (/abalakov|arm.?swing|with arms|vertical/.test(l)) return 'abk';
  if (/squat ?jump|\bsj\b|static jump/.test(l)) return 'sj';
  if (/sprint|dash|fly|split|\d+ ?(yd|yards?|m)\b|agility|5.?10.?5|\b505\b|shuttle|accel/.test(l)) return 'sprint';
  if (/cmj|counter|jump/.test(l)) return 'cmj';
  return 'auto';
}
const impSide = s => { const l = String(s || '').trim().toLowerCase(); return /^(l|left|lt)$/.test(l) ? 'L' : /^(r|right|rt)$/.test(l) ? 'R' : null; };
/* A matched column → the metric for this kind of test (null = not part of this test) */
function impRoute(k, kind, side) {
  const c = M[k]?.cat;
  if (kind === 'auto' || c === 'sprint' || k === 'broad') return k;
  const H = ['cmj', 'sj', 'vj', 'djHeight'], F = ['cmjPF', 'imtpPF'], R = ['djRsi', 'rsiMod', 'rsi105'];
  const lr = (l, r) => (side === 'L' ? l : side === 'R' ? r : null);
  switch (kind) {
    case 'cmj': return H.includes(k) ? 'cmj' : k === 'imtpPF' ? 'cmjPF' : k === 'djRsi' || k === 'rsi105' ? 'rsiMod' : c === 'cmjfp' ? k : null;
    case 'sj': return H.includes(k) ? 'sj' : null;
    case 'abk': return H.includes(k) ? 'vj' : null;
    case 'dj': return H.includes(k) ? 'djHeight' : R.includes(k) ? 'djRsi' : ['djGct', 'dropBox'].includes(k) ? k : null;
    case 'hop': return R.includes(k) ? 'rsi105' : null;
    case 'land': return [...F, 'peakLandF', 'dlPlf'].includes(k) ? 'dlPlf' : ['dlPlfRel', 'dlTts', 'landAsym'].includes(k) ? k : null;
    case 'imtp': case 'isq': return F.includes(k) ? 'imtpPF' : c === 'iso' && !/^(sl|calf)/.test(k) ? k : null;
    case 'slimtp': return ['slImtpL', 'slImtpR'].includes(k) ? k : F.includes(k) ? lr('slImtpL', 'slImtpR') : null;
    case 'calf': return ['calfIsoL', 'calfIsoR'].includes(k) ? k : F.includes(k) ? lr('calfIsoL', 'calfIsoR') : null;
    case 'sprint': return null;
  }
  return k;
}
/* Sprint rows written as a distance and a time */
function impSprintKey(distRaw, unit, typeText) {
  const s = String(distRaw || '').toLowerCase(), t = String(typeText || '').toLowerCase(), both = s + ' ' + t;
  if (/5.?10.?5|pro.?agility/.test(both)) return 'proAgility';
  if (/\b505\b/.test(both)) return 'cod505';
  const n = num((s.match(/\d+(\.\d+)?/) || [''])[0]) ?? num((t.match(/\d+(\.\d+)?/) || [''])[0]);
  const yd = /yd|yard/.test(s) || (!/\d ?m\b|meter|metre/.test(s) && (/yd|yard/.test(t) || (!/\d ?m\b|meter|metre/.test(t) && unit === 'yd')));
  if (/fly/.test(both)) return n === 10 ? (yd ? 'fly10yd' : 'fly10') : null;
  if (yd) return { 10: 'sprint10yd', 20: 'sprint20yd', 40: 'sprint40yd' }[n] || null;
  return { 5: 'sprint5', 10: 'sprint10', 20: 'sprint20', 30: 'sprint30' }[n] || null;
}
function impDeviceGuess(f, map) {
  const keys = f.headers.map(h => map[h.toLowerCase()]).filter(Boolean), n = f.name.toLowerCase();
  const fp = keys.some(k => ['cmjfp', 'iso', 'land'].includes(M[k]?.cat));
  if (/force|plate|imtp/.test(n) || fp) return 'OVR Force';
  if (/sprint|timing|gate|dash/.test(n) || (keys.some(k => M[k]?.cat === 'sprint' || k === '_dist' || k === '_time') && !keys.some(k => ['jump', 'rsi'].includes(M[k]?.cat)))) return 'OVR Sprint';
  if (/jump/.test(n) || keys.includes('_flight') || keys.includes('djGct')) return 'OVR Jump';
  return '';
}
/* Names: "Last, First" turned round, spacing tidied */
function impName(raw) {
  const n = String(raw || '').trim(), mm = n.match(/^\s*([^,]+),\s*(.+)$/);
  return (mm ? `${mm[2]} ${mm[1]}` : n).replace(/\s+/g, ' ').trim();
}
const impNorm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function impMatch(name) {
  const l = impNorm(name), as = S.athletes, full = a => impNorm(athleteName(a));
  const one = list => (list.length === 1 ? list[0] : null);
  let m = as.find(a => full(a) === l) || as.find(a => impNorm(`${a.lastName} ${a.firstName}`) === l);
  if (m) return m;
  const [f, ...rest] = l.split(' '), last = rest.join(' ');
  if (!last) return one(as.filter(a => impNorm(a.firstName) === f));
  // "L Carter" or "Liam C"
  if (f.length === 1) return one(as.filter(a => impNorm(a.lastName) === last && impNorm(a.firstName).startsWith(f)));
  if (last.length === 1) return one(as.filter(a => impNorm(a.firstName) === f && impNorm(a.lastName).startsWith(last)));
  return null;
}
/* An athlete named in the file name ("Liam_Carter_CMJ.csv") */
function impAthleteFromFile(name) {
  const n = ' ' + impNorm(name.replace(/\.[a-z]+$/i, '').replace(/[_.-]+/g, ' ')) + ' ';
  const hits = S.athletes.filter(a => a.lastName && n.includes(' ' + impNorm(athleteName(a)) + ' '));
  return hits.length === 1 ? hits[0].id : '';
}

/* ---------- Building the tests from the rows ---------- */
function impBuild(st) {
  const out = new Map(), seen = new Set(), types = new Map(), names = new Set();
  const warn = { noAth: 0, noDate: 0, skip: 0, dup: 0, sprint: 0, side: 0 };
  st.files.forEach(f => {
    const L = f.headers.map(h => h.toLowerCase()), K = L.map(l => st.map[l] || ''), at = k => K.indexOf(k);
    const iName = at('_name'), iFirst = at('_first'), iLast = at('_last'), iDate = at('_date'), iType = at('_type'), iSide = at('_side'), iDist = at('_dist'), iTime = at('_time'), iFl = at('_flight');
    const fi = st.filterCol ? L.indexOf(st.filterCol) : -1, ft = st.filterText.trim().toLowerCase();
    const hasName = iName >= 0 || iFirst >= 0 || iLast >= 0;
    f.rows.forEach(r => {
      if (fi >= 0 && ft && !String(r[fi] || '').toLowerCase().includes(ft)) return;
      const name = iName >= 0 ? impName(r[iName]) : hasName ? [iFirst >= 0 ? r[iFirst] : '', iLast >= 0 ? r[iLast] : ''].join(' ').replace(/\s+/g, ' ').trim() : '';
      if (name && !(name in st.names)) st.names[name] = impMatch(name)?.id || '_new';
      if (name) names.add(name);
      const aid = name ? st.names[name] : f.aid;
      if (!aid) { warn.noAth++; return; }
      if (aid === '_skip') return;
      const date = iDate >= 0 ? parseDateAny(r[iDate]) : f.date || null;
      if (!date) { warn.noDate++; return; }
      const typeText = iType >= 0 ? String(r[iType] || '').trim() : '';
      if (typeText) types.set(typeText, (types.get(typeText) || 0) + 1);
      const kind = typeText ? (st.kinds[typeText] || impKindOf(typeText)) : (f.kind || 'auto');
      if (kind === 'skip') { warn.skip++; return; }
      // the same row twice (overlapping exports) counts once
      const sig = `${name || '#' + f.aid}|` + L.map((l, i) => `${l}=${r[i]}`).sort().join('|');
      if (seen.has(sig)) { warn.dup++; return; }
      seen.add(sig);
      const side = iSide >= 0 ? impSide(r[iSide]) : null, vals = {};
      let needSide = false;
      K.forEach((k, i) => {
        if (!k || (k.startsWith('_') && k !== '_bm')) return;
        const v = num(r[i]);
        if (v == null || !Number.isFinite(v)) return;
        const cv = convertImport(k, st.units[L[i]], v);
        if (k === '_bm') { if (cv > 0) vals._bm = cv; return; }
        const rk = impRoute(k, kind, side);
        if (rk) vals[rk] = cv; else if ((kind === 'slimtp' || kind === 'calf') && ['cmjPF', 'imtpPF'].includes(k)) needSide = true;
      });
      if (needSide) warn.side++;
      // a flight time gives the height when the row has none (h = g·t² / 8)
      if (iFl >= 0) {
        const t0 = num(r[iFl]), t = t0 > 0 ? (st.units[L[iFl]] === 'ms' ? t0 / 1000 : t0) : null, hk = impRoute('cmj', kind === 'auto' ? 'cmj' : kind, side);
        if (t > 0 && t < 2 && hk && M[hk]?.kind === 'len' && vals[hk] == null) vals[hk] = 9.81 * t * t / 8 * 100;
      }
      // a distance and a time give the sprint test
      if (iTime >= 0 && (kind === 'sprint' || kind === 'auto')) {
        const t0 = num(r[iTime]);
        if (t0 > 0) { const sk = impSprintKey(iDist >= 0 ? r[iDist] : '', iDist >= 0 ? st.units[L[iDist]] : '', typeText || f.name); if (sk) vals[sk] = st.units[L[iTime]] === 'ms' ? t0 / 1000 : t0; else warn.sprint++; }
      }
      const keys = Object.keys(vals).filter(k => k !== '_bm');
      if (!keys.length) return;
      const iso = kind === 'isq' ? 'ISQ' : null, dev = f.device || '';
      const gk = `${aid === '_new' ? 'new:' + name : aid}|${date}|${dev}|${iso || ''}`;
      const g = out.get(gk) || { aid, name, date, dev, iso, vals: {}, bm: [], files: new Set() };
      keys.forEach(k => (g.vals[k] ||= []).push(vals[k]));
      if (vals._bm) g.bm.push(vals._bm);
      g.files.add(f.name);
      out.set(gk, g);
    });
  });
  const groups = [...out.values()].map(g => {
    const m = {}, trials = {};
    Object.entries(g.vals).forEach(([k, arr]) => {
      const mode = st.agg === 'auto' ? ttDefaultScore(k) : st.agg === 'mean' ? 'avg' : st.agg;
      m[k] = mode === 'last' ? arr[arr.length - 1] : ttScore(k, arr, mode === 'avg' ? 'avg' : 'best');
      if (arr.length > 1) trials[k] = arr;
    });
    return { ...g, m, trials, bmKg: g.bm.length ? mean(g.bm) : null };
  }).sort((x, y) => x.date.localeCompare(y.date));
  return { groups, warn, types, names: [...names].sort() };
}
/* Where a day's results go: the test it made last time, else a hand-entered test that day (not one
   logged in a session, and never a different device), else a new test. OVR Jump gets its own test. */
const impDevKey = dev => ({ 'OVR Force': 'force', 'OVR Jump': 'jump', 'OVR Sprint': 'sprint' }[dev] || 'other');
function impTarget(aid, date, dev, iso) {
  const id = `imp~${aid}~${date}~${impDevKey(dev)}${iso === 'ISQ' ? '~isq' : ''}`, mine = getRec('tests', id);
  if (mine) return { rec: mine, id };
  if (dev !== 'OVR Jump') {
    const same = S.tests.find(t => t.athleteId === aid && t.date === date && !t.workoutId && !String(t.id).startsWith('imp~') && (!t.device || t.device === dev) && (iso === 'ISQ' ? t.isoType === 'ISQ' : t.isoType !== 'ISQ'));
    if (same) return { rec: same, id: same.id };
  }
  return { rec: null, id };
}
const impSame = (a = {}, b = {}) => Object.keys(a).every(k => b[k] != null && Math.abs(a[k] - b[k]) <= 1e-9 * Math.max(1, Math.abs(a[k])));
/* Plan (dry run) or write the import. Returns counts and what's needed to undo it. */
function impApply(groups, { dry = false } = {}) {
  const res = { added: 0, updated: 0, same: 0, athletes: new Set(), newNames: new Set() }, undo = { tests: [], athletes: [] }, created = {};
  groups.forEach(g => {
    let aid = g.aid;
    if (aid === '_new') {
      res.newNames.add(g.name);
      if (dry) { res.added++; return; }
      if (!created[g.name]) {
        const parts = g.name.split(' ');
        created[g.name] = upsert('athletes', { firstName: parts[0], lastName: parts.slice(1).join(' '), sport: '', position: '', team: '', dob: '', sex: '', heightCm: null, massKg: g.bmKg, email: '', phone: '', goals: '', injuries: '', archived: false, color: '' }).id;
        undo.athletes.push(created[g.name]);
      }
      aid = created[g.name];
    }
    // results already logged in a session that day are kept as they are
    const m = { ...g.m }, trials = { ...g.trials };
    S.tests.filter(t => t.athleteId === aid && t.date === g.date && t.workoutId).forEach(t => Object.keys(m).forEach(k => {
      if (t.m?.[k] != null && (!FT_KEYS.includes(k) || jumpMethod(t.device) === jumpMethod(g.dev))) { delete m[k]; delete trials[k]; }
    }));
    res.athletes.add(aid);
    if (!Object.keys(m).length) { res.same++; return; }
    const { rec, id } = impTarget(aid, g.date, g.dev, g.iso);
    if (rec && impSame(m, rec.m) && Object.keys(trials).every(k => JSON.stringify(trials[k]) === JSON.stringify(rec.trials?.[k]))) { res.same++; return; }
    if (dry) { rec ? res.updated++ : res.added++; return; }
    undo.tests.push({ id, before: rec ? JSON.parse(JSON.stringify(rec)) : null });
    upsert('tests', { ...(rec || { athleteId: aid, sides: {}, notes: `Imported from ${[...g.files].join(', ')}`.slice(0, 300) }), id, athleteId: aid, date: g.date,
      m: { ...(rec?.m || {}), ...m }, trials: { ...(rec?.trials || {}), ...trials }, isoType: rec?.isoType || g.iso || 'IMTP', device: rec?.device || g.dev || undefined,
      bodyMassKg: rec?.bodyMassKg ?? g.bmKg ?? getAthlete(aid)?.massKg ?? null });
    rec ? res.updated++ : res.added++;
  });
  return { res, undo, created: Object.values(created) };
}
function impUndo(u) {
  u.tests.forEach(({ id, before }) => { if (before) upsert('tests', before); else removeRec('tests', id); });
  u.athletes.forEach(id => { S.tests.filter(t => t.athleteId === id).forEach(t => removeRec('tests', t.id)); removeRec('athletes', id); });
}

/* ---------- The import wizard ---------- */
A.importCsv = el => {
  const preAid = el?.dataset?.a && getAthlete(el.dataset.a) ? el.dataset.a : '';
  // test-type choices are remembered (like the column matches), so re-importing a file gives the same tests
  const st = { step: 1, files: [], map: {}, units: {}, filterCol: '', filterText: '', agg: 'auto', names: {}, kinds: { ...(S.settings.importKinds || {}) } };
  const SPECIAL = [['', '— ignore —'], ['_name', 'Athlete name'], ['_first', 'First name'], ['_last', 'Last name'], ['_date', 'Date'], ['_type', 'Test type'], ['_side', 'Side (left / right)'], ['_bm', 'Body mass'],
    ['_dist', 'Sprint distance'], ['_time', 'Sprint time (with a distance column)'], ['_flight', 'Flight time (height is calculated)']];
  const metricOpts = [...SPECIAL, ...TEST_CATS.filter(c => !['derived', 'body'].includes(c.key)).flatMap(c => METRICS.filter(m => m.cat === c.key && !m.calc).map(m => [m.key, `${c.label.replace('OVR Force · ', '')} · ${m.label}`]))];
  const DEVICES = [['OVR Force', 'OVR Force (force plate)'], ['OVR Jump', 'OVR Jump (flight time)'], ['OVR Sprint', 'OVR Sprint (timing gates)'], ['', 'Other / not sure']];
  const cols = () => { const seen = new Map(); st.files.forEach(f => f.headers.forEach(h => { const l = h.toLowerCase(); if (!seen.has(l)) seen.set(l, { h, l, ex: [] }); const c = seen.get(l), i = f.headers.indexOf(h); f.rows.slice(0, 3).forEach(r => { if (r[i] && c.ex.length < 2) c.ex.push(r[i]); }); })); return [...seen.values()]; };
  const fileHas = (f, key) => f.headers.some(h => st.map[h.toLowerCase()] === key);
  const unitOpts = k => (k === '_bm' ? [['kg', 'kg'], ['lb', 'lb'], ['N', 'N (weight)']] : k === '_dist' ? [['yd', 'yd'], ['m', 'm']] : k === '_time' || k === '_flight' ? [['s', 's'], ['ms', 'ms']] : M[k]?.kind === 'len' ? [['cm', 'cm'], ['in', 'in'], ['m', 'm']] : M[k]?.unit === 's' ? [['s', 's'], ['ms', 'ms']] : null);
  const athOpts = (sel0, first) => [...first, ...sortedAthletes().map(a => [a.id, athleteName(a)])].map(([v, l]) => `<option value="${esc(v)}" ${v === sel0 ? 'selected' : ''}>${esc(l)}</option>`).join('');
  const stepHtml = () => {
    if (st.step === 1) return `<p class="muted">Export your results as <b>CSV</b> files from <b>OVR Connect</b> (OVR Force, OVR Jump or OVR Sprint), Excel, Numbers or Google Sheets, then choose them. You can pick <b>several files at once</b>. The first row of each file must be the column headers.</p>
      <div class="chips" style="margin-bottom:12px"><button type="button" class="btn primary" data-pick>${icon('upload', 'sm')}Choose CSV files</button></div>
      ${field('…or paste rows from a spreadsheet', '<textarea rows="6" data-paste placeholder="Name, Date, Test, Jump Height (in), RSI, …"></textarea>')}
      <button type="button" class="btn" data-parse-paste>Use pasted data</button>
      <p class="faint small" style="margin-top:12px">Importing the same rows again changes nothing, so it’s safe to import a full history export more than once.</p>`;
    if (st.step === 2) {
      const C = cols(), rows = st.files.reduce((n, f) => n + f.rows.length, 0);
      return `<div class="imp-files">${st.files.map((f, i) => `<div class="imp-file"><div class="imp-fh"><b>${esc(f.name)}</b><span class="faint small">${plural(f.rows.length, 'row')}</span><button type="button" class="link" data-rmfile="${i}" aria-label="Remove ${esc(f.name)}">Remove</button></div>
          <div class="fields three collapse">${field('Device', `<select data-fdev="${i}">${DEVICES.map(([v, l]) => `<option value="${esc(v)}" ${v === f.device ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`)}
          ${!fileHas(f, '_name') && !fileHas(f, '_first') && !fileHas(f, '_last') ? field('All rows are for', `<select data-fath="${i}">${athOpts(f.aid, [['', 'Choose athlete…']])}</select>`) : ''}
          ${!fileHas(f, '_type') ? field('Test in this file', `<select data-fkind="${i}">${IMP_KINDS.filter(([k]) => k !== 'skip').map(([v, l]) => `<option value="${v}" ${v === (f.kind || 'auto') ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select>`) : ''}
          ${!fileHas(f, '_date') ? field('Test date', `<input type="date" data-fdate="${i}" value="${esc(f.date || '')}">`) : ''}</div></div>`).join('')}
        <button type="button" class="btn sm" data-pick>${icon('plus', 'sm')}Add more files</button></div>
        <p class="muted small" style="margin-top:14px">${plural(rows, 'row')} in ${plural(st.files.length, 'file')}. Match each column to a metric (guessed from the headers) and check the units. OVR Jump times jumps by flight time, so its heights are kept apart from force-plate heights.</p>
        <div class="table-wrap"><table class="t map-table"><thead><tr><th>Column</th><th>Example</th><th>Import as</th><th>Unit</th></tr></thead><tbody>
        ${C.map((c, i) => { const k = st.map[c.l] || '', uo = unitOpts(k);
          return `<tr><td><b>${esc(c.h)}</b></td><td class="small muted">${esc(c.ex.join(' · ').slice(0, 40))}</td>
          <td><select data-map="${i}">${metricOpts.map(([v, l]) => `<option value="${v}" ${v === k ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td>
          <td>${uo ? `<select data-unit="${i}">${uo.map(([v, l]) => `<option value="${v}" ${v === st.units[c.l] ? 'selected' : ''}>${l}</option>`).join('')}</select>` : '<span class="faint small">—</span>'}</td></tr>`; }).join('')}
        </tbody></table></div>
        <div class="fields" style="margin-top:14px">
          ${field('Only rows where column…', `<select data-fcol><option value="">(all rows)</option>${C.map((c, i) => `<option value="${i}" ${c.l === st.filterCol ? 'selected' : ''}>${esc(c.h)}</option>`).join('')}</select>`, { hint: 'Optional, e.g. Test type contains “CMJ”.' })}
          ${field('…contains', `<input type="text" data-ftext value="${esc(st.filterText)}" placeholder="CMJ">`)}
          ${field('Several trials on the same day', `<select data-agg>${[['auto', 'As in the app: force plate averaged, sprints best'], ['mean', 'Average them'], ['best', 'Keep the best'], ['last', 'Keep the last']].map(([v, l]) => `<option value="${v}" ${v === st.agg ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
        </div>`;
    }
    const B = impBuild(st);
    if (st.step === 3) {
      const T = [...B.types.entries()].sort((a, b) => b[1] - a[1]);
      return `${T.length ? `<div class="section-title" style="margin-top:0">Tests in the files</div><p class="muted small">Each row goes to the test its type says. Check the guesses, especially “Vertical jump”: with an arm swing it’s the Abalakov; hands on hips is a CMJ.</p>
        <div class="table-wrap"><table class="t"><thead><tr><th>Type in file</th><th class="n">Rows</th><th>Import as</th></tr></thead><tbody>
        ${T.map(([t, n]) => `<tr><td><b>${esc(t)}</b></td><td class="n">${n}</td><td><select data-kind="${esc(t)}">${IMP_KINDS.map(([v, l]) => `<option value="${v}" ${v === (st.kinds[t] || impKindOf(t)) ? 'selected' : ''}>${esc(l)}</option>`).join('')}</select></td></tr>`).join('')}
        </tbody></table></div>` : ''}
        ${B.names.length ? `<div class="section-title">Athletes</div><p class="muted small">Match the names in the files to your athletes. New names are created as new athletes.</p>
        <div class="chips" style="margin-bottom:8px"><button type="button" class="btn sm" data-allnew="_new">Create all unmatched</button><button type="button" class="btn sm" data-allnew="_skip">Skip all unmatched</button></div>
        <div class="table-wrap"><table class="t"><thead><tr><th>Name in file</th><th>Athlete</th></tr></thead><tbody>
        ${B.names.map(n => `<tr><td><b>${esc(n)}</b></td><td><select data-name="${esc(n)}">${athOpts(st.names[n], [['_new', '+ Create new athlete'], ['_skip', 'Skip']])}</select></td></tr>`).join('')}
        </tbody></table></div>` : '<p class="muted small">All rows are for the athletes chosen for each file.</p>'}`;
    }
    const plan = impApply(B.groups, { dry: true }).res, W = B.warn;
    const devs = {}; B.groups.forEach(g => { const d = g.dev || 'Other'; devs[d] = (devs[d] || 0) + 1; });
    const dates = B.groups.map(g => g.date), ath = new Set(B.groups.map(g => (g.aid === '_new' ? 'new:' + g.name : g.aid)));
    const keys = [...new Set(B.groups.flatMap(g => Object.keys(g.m)))];
    const unitsTxt = cols().filter(c => unitOpts(st.map[c.l] || '') && st.map[c.l]).map(c => `${c.h}: ${st.units[c.l]}`).slice(0, 8).join(' · ');
    const warns = [W.noAth ? `${plural(W.noAth, 'row')} without an athlete (choose one for the file)` : '', W.noDate ? `${plural(W.noDate, 'row')} without a date` : '', W.skip ? `${plural(W.skip, 'row')} skipped by test type` : '',
      W.dup ? `${plural(W.dup, 'duplicate row')} counted once` : '', W.sprint ? `${plural(W.sprint, 'sprint row')} with a distance the app doesn’t track (5, 10, 20, 30 m; 10, 20, 40 yd; flying 10)` : '', W.side ? `${plural(W.side, 'single-leg row')} without a left/right side` : ''].filter(Boolean);
    return `<div class="computed" style="margin:0 0 12px">${B.groups.length ? `Ready to import <b>${plural(B.groups.length, 'test day')}</b> for <b>${plural(ath.size, 'athlete')}</b>${plan.newNames.size ? ` (${plan.newNames.size} new)` : ''}, ${esc(fmtDate(dates[0]))} – ${esc(fmtDate(dates[dates.length - 1]))}:
        <b>${plan.added}</b> new, <b>${plan.updated}</b> adding to tests already in the app${plan.same ? `, <b>${plan.same}</b> already imported (no change)` : ''}.` : 'Nothing to import yet: check the columns, athletes and test types.'}</div>
      ${B.groups.length ? `<div class="chips" style="margin-bottom:10px">${Object.entries(devs).map(([d, n]) => `<span class="badge info">${esc(d)} · ${n}</span>`).join('')}</div>` : ''}
      ${warns.length ? `<div class="banner warn" style="margin:0 0 12px">${icon('alert')}<div class="grow small">${warns.map(esc).join('<br>')}</div></div>` : ''}
      ${keys.length ? `<p class="small muted" style="margin:0 0 8px"><b>Metrics:</b> ${keys.map(k => esc(M[k].label)).join(', ')}</p>` : ''}
      ${unitsTxt ? `<p class="small muted" style="margin:0 0 8px"><b>Units:</b> ${esc(unitsTxt)}. Change them on the Columns step if they’re wrong.</p>` : ''}
      <div class="table-wrap"><table class="t"><thead><tr><th>Athlete</th><th>Date</th><th>Results</th></tr></thead><tbody>
      ${B.groups.slice(-12).reverse().map(g => `<tr><td>${esc(g.aid === '_new' ? g.name + ' (new)' : athleteName(getAthlete(g.aid)))}${g.dev ? `<div class="faint tiny">${esc(g.dev)}</div>` : ''}</td><td class="nowrap">${esc(fmtDate(g.date))}</td><td class="small">${Object.entries(g.m).slice(0, 4).map(([k, v]) => `${esc(M[k].label)} <b>${esc(fmtMetric(M[k], v))}</b>`).join(' · ')}${Object.keys(g.m).length > 4 ? ` <span class="faint">+${Object.keys(g.m).length - 4}</span>` : ''}</td></tr>`).join('')}
      </tbody></table></div>${B.groups.length > 12 ? `<p class="faint small">Showing the latest 12 of ${B.groups.length}.</p>` : ''}
      <p class="faint small">Results add to a hand-entered test on the same day; results logged in a session stay as they are. OVR Jump results get their own test, so their heights stay apart from force-plate heights.</p>`;
  };
  const m = openModal({
    title: 'Import results', size: 'wide', submit: 'Next',
    body: '<div id="impStep"></div><input type="file" class="hidden" accept=".csv,.tsv,.txt,text/csv,text/plain" multiple data-file>',
    footer: '<button type="button" class="btn" data-back>Back</button>',
    onSubmit: () => {
      if (st.step === 1) return 'Choose a file or paste data first.';
      if (st.step === 2) {
        const anyName = Object.values(st.map).some(k => ['_name', '_first', '_last'].includes(k));
        if (!anyName && st.files.some(f => !f.aid)) return 'Map a column to “Athlete name”, or choose the athlete for each file.';
        if (!Object.values(st.map).some(k => k && (!k.startsWith('_') || ['_bm', '_time', '_flight'].includes(k)))) return 'Map at least one metric column.';
        if (!impBuild(st).groups.length && !Object.values(st.map).includes('_type')) return 'No results found: check the columns, the athlete and the test for each file.';
        S.settings.importMap = { ...(S.settings.importMap || {}), ...Object.fromEntries(cols().map(c => [c.l, [st.map[c.l] || '', st.units[c.l] || '']])) };
        persist();
        st.step = 3; draw(); return false;
      }
      if (st.step === 3) {
        const used = [...impBuild(st).types.keys()];
        S.settings.importKinds = { ...(S.settings.importKinds || {}), ...Object.fromEntries(used.map(t => [t, st.kinds[t] || impKindOf(t)])) };
        persist();
        st.step = 4; draw(); return false;
      }
      const B = impBuild(st);
      if (!B.groups.length) return 'Nothing to import: check the columns, athletes and test types.';
      const { res, undo, created } = impApply(B.groups);
      refresh();
      setTimeout(() => impResultModal(res, undo, created), 60);
    },
  });
  const draw = () => {
    $('#impStep', m.wrap).innerHTML = stepHtml();
    $('.modal-head button[type=submit]', m.wrap).textContent = st.step === 4 ? 'Import' : 'Next';
    $('[data-back]', m.wrap).classList.toggle('hidden', st.step === 1);
    m.error('');
  };
  const addFile = (text, name) => {
    const csv = parseCsv(text);
    if (!csv) return `“${name}” has no rows: each file needs a header row and at least one data row.`;
    const saved = S.settings.importMap || {};
    csv.headers.forEach(h => {
      const l = h.toLowerCase();
      if (l in st.map) return;
      st.map[l] = saved[l]?.[0] ?? guessColumn(h);
      st.units[l] = saved[l]?.[1] || guessUnit(h, st.map[l]);
    });
    const f = { name, headers: csv.headers, rows: csv.rows, aid: preAid || impAthleteFromFile(name), kind: impKindOf(name.replace(/\.[a-z]+$/i, '')), date: '' };
    if (f.kind === 'auto' || f.kind === 'skip') f.kind = 'auto';
    f.device = impDeviceGuess(f, st.map);
    st.files.push(f);
    return '';
  };
  draw();
  m.wrap.addEventListener('click', e => {
    const t = e.target;
    if (t.closest('[data-pick]')) $('[data-file]', m.wrap).click();
    if (t.closest('[data-parse-paste]')) { const x = $('[data-paste]', m.wrap).value; if (!x.trim()) return m.error('Paste some rows first.'); const err = addFile(x, 'pasted data'); if (err) return m.error(err); st.step = 2; draw(); }
    if (t.closest('[data-back]')) { st.step = Math.max(1, st.step - 1); if (st.step === 1) st.files = []; draw(); }
    const rf = t.closest('[data-rmfile]');
    if (rf) { st.files.splice(+rf.dataset.rmfile, 1); if (!st.files.length) st.step = 1; draw(); }
    const an = t.closest('[data-allnew]');
    if (an) { Object.keys(st.names).forEach(n => { if (!getAthlete(st.names[n])) st.names[n] = an.dataset.allnew; }); draw(); }
  });
  m.wrap.addEventListener('change', async e => {
    const t = e.target, C = st.step === 2 ? cols() : null;
    if (t.matches('[data-file]')) {
      const fs = [...(t.files || [])]; t.value = '';
      const errs = [];
      for (const f of fs) { const err = addFile(await f.text(), f.name); if (err) errs.push(err); }
      if (st.files.length) st.step = Math.max(st.step, 2);
      draw();
      if (errs.length) m.error(errs.join(' '));
      return;
    }
    if (t.dataset.map != null && C) { const c = C[+t.dataset.map]; st.map[c.l] = t.value; st.units[c.l] = guessUnit(c.h, t.value); st.files.forEach(f => { if (f.headers.some(h => h.toLowerCase() === c.l)) f.device = f.deviceSet ? f.device : impDeviceGuess(f, st.map); }); draw(); }
    if (t.dataset.unit != null && C) st.units[C[+t.dataset.unit].l] = t.value;
    if (t.matches('[data-fcol]') && C) st.filterCol = t.value === '' ? '' : C[+t.value].l;
    if (t.matches('[data-agg]')) st.agg = t.value;
    if (t.dataset.fdev != null) { const f = st.files[+t.dataset.fdev]; f.device = t.value; f.deviceSet = true; }
    if (t.dataset.fath != null) { st.files[+t.dataset.fath].aid = t.value; }
    if (t.dataset.fkind != null) st.files[+t.dataset.fkind].kind = t.value;
    if (t.dataset.fdate != null) st.files[+t.dataset.fdate].date = isDS(t.value) ? t.value : '';
    if (t.dataset.name != null) st.names[t.dataset.name] = t.value;
    if (t.dataset.kind != null) st.kinds[t.dataset.kind] = t.value;
  });
  m.wrap.addEventListener('input', e => { if (e.target.matches('[data-ftext]')) st.filterText = e.target.value; });
};

/* ---------- After the import: what changed, undo, and details for new athletes ---------- */
function impResultModal(res, undo, created) {
  let undone = false;
  openModal({
    title: 'Import complete', size: 'narrow', submit: 'Done', cancel: 'Close', onSubmit: () => {},
    body: `<div class="computed" style="margin:0 0 12px"><b>${plural(res.added, 'new test day')}</b>${res.updated ? ` and <b>${res.updated}</b> added to existing tests` : ''} for <b>${plural(res.athletes.size, 'athlete')}</b>${created.length ? ` (${created.length} new)` : ''}${res.same ? `; ${plural(res.same, 'day')} already in the app` : ''}.</div>
      <p class="small muted">Profiles, standards, percentiles, leaderboards, PRs and trends now include this history.</p>
      ${created.length ? `<div class="banner info" style="margin:0 0 12px">${icon('users')}<div class="grow small"><b>${plural(created.length, 'new athlete')}</b> need sex and birth date for the standards and percentiles.</div><button type="button" class="btn sm primary" data-imp-details>Add details</button></div>` : ''}
      <button type="button" class="btn sm danger-ghost" data-imp-undo>Undo this import</button>`,
    onMount: mm => {
      mm.wrap.addEventListener('click', async e => {
        if (e.target.closest('[data-imp-details]')) { mm.close(); impDetails(created); }
        if (e.target.closest('[data-imp-undo]') && !undone) {
          if (!(await confirmBox('Undo this import?', 'Tests it added are removed, tests it added to go back to how they were, and athletes it created are removed.', { ok: 'Undo' }))) return;
          undone = true; impUndo(undo); mm.close(); toast('Import undone'); refresh();
        }
      });
    },
  });
}
/* Sex and birth date for the athletes an import created, all on one screen */
function impDetails(ids) {
  const list = ids.map(getAthlete).filter(Boolean);
  if (!list.length) return;
  openModal({
    title: 'New athletes', size: 'narrow', submit: 'Save',
    body: `<p class="small muted" style="margin-top:0">Needed for the standards and percentiles. You can also fill these in later on each profile.</p>
      ${list.map(a => `<div class="imp-ath" data-ia="${a.id}"><b>${esc(athleteName(a))}</b><div class="fields" style="margin:6px 0 0">
        ${field('Sex', `<select data-isex><option value="">—</option><option value="F" ${a.sex === 'F' ? 'selected' : ''}>Female</option><option value="M" ${a.sex === 'M' ? 'selected' : ''}>Male</option></select>`)}
        ${field('Birth date', `<input data-idob data-dob inputmode="numeric" placeholder="MM/DD/YYYY" maxlength="10" value="${esc(ttDobOut(a.dob))}">`)}</div></div>`).join('')}`,
    onSubmit: (v, form, mm) => {
      const bad = [];
      $$('[data-ia]', mm.wrap).forEach(row => {
        const a = getAthlete(row.dataset.ia), sex = $('[data-isex]', row).value, raw = $('[data-idob]', row).value.trim(), dob = raw ? ttDob(raw) : '';
        if (raw && !dob) { bad.push(athleteName(a)); return; }
        if (a && ((sex && sex !== a.sex) || (dob && dob !== a.dob))) upsert('athletes', { ...a, sex: sex || a.sex || '', dob: dob || a.dob || '' });
      });
      if (bad.length) return `Birth date not recognised for ${bad.join(', ')}. Use MM/DD/YYYY.`;
      toast('Saved'); refresh();
    },
  });
}
