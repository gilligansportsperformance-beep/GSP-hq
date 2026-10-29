/* =========================================================
   Force-plate tests in the exercise library. Put a test in a workout, log it in the session,
   and the results save as an ordinary dated test, so the profile, standards, leaderboard,
   percentiles and reports update and earlier tests stay as they were. The main numbers are
   typed per trial and averaged (as in the evaluation and team testing); the rest are typed
   once from OVR's summary. Personal records (PRs) are worked out from all saved data.
   ========================================================= */
const FP_CAT = 'Force plate testing';
/* trials = typed per trial and averaged; main = shown; more = behind "More metrics" */
const FP_TESTS = {
  cmj: { id: 'fpt-cmj', name: 'CMJ Test', equipment: 'OVR Force · Jump mode', n: 3, trials: ['cmj', 'cmjPF'], main: ['cmjPP', 'rsiMod', 'ttt', 'brakeRfd'], more: ['takeoffVel', 'cmDepth', 'brakeTime', 'peakBrakeF', 'brakeImp', 'propTime', 'propImp', 'cmjRelPP', 'peakLandF', 'brakeAsym', 'propAsym', 'landAsym'],
    cues: 'Hands on hips. Stand still 1–2 s, then a fast dip and jump as high as possible. 3 trials, 30–60 s rest.' },
  sj: { id: 'fpt-sj', name: 'Squat Jump Test', equipment: 'OVR Force · Jump mode', n: 3, trials: ['sj'], main: [], more: [],
    cues: 'Hands on hips. Hold the bottom (≈90° knee) for 2–3 s, then jump with no dip. Discard any trial with a countermovement.' },
  abk: { id: 'fpt-abk', name: 'Abalakov Jump Test', equipment: 'OVR Force · Jump mode', n: 3, trials: ['vj'], main: [], more: [],
    cues: 'Countermovement jump with a free arm swing: full backswing with the dip, then drive the arms up hard.' },
  dj: { id: 'fpt-dj', name: 'Drop Jump Test (RSI)', equipment: 'OVR Force · Jump mode, box', n: 3, trials: [], main: ['djRsi', 'djGct', 'djHeight'], more: ['dropBox'],
    cues: 'Step off the box (don’t jump off), spend as little time on the ground as possible and bounce up high. Same box height every time. RSI is calculated from height ÷ contact time if left blank.' },
  hop: { id: 'fpt-hop', name: '10/5 Repeated Hop Test', equipment: 'OVR Force', n: 2, trials: [], main: ['rsi105'], more: [],
    cues: 'Ten continuous hops, as high and as quick off the ground as possible. Enter the RSI from the best five.' },
  land: { id: 'fpt-land', name: 'Drop Landing Test', equipment: 'OVR Force, 30 cm box (boys 30–45 cm)', n: 3, trials: [], main: ['dlPlf', 'dlTts'], more: ['dlPlfRel', 'landAsym'],
    cues: 'Step off the box, land on both feet and stick it as quietly as possible. Hold still until stable. Relative landing force is calculated from body mass if left blank.' },
  imtp: { id: 'fpt-imtp', name: 'IMTP Test', equipment: 'OVR Force · Force mode, rack', iso: 'IMTP', n: 3, trials: ['imtpPF'], main: ['imtpF100', 'imtpF200', 'imtpImp', 'imtpRfd'], more: ['imtpAvgF', 'imtpTtpf', 'imtpAsym'],
    cues: 'Bar at mid-thigh, knee ≈125–145°, hip ≈140–150°. Pre-tension, then pull as hard and fast as possible for 3–5 s. 2–3 trials, 1–2 min rest.', refs: ['comfort2019'] },
  isq: { id: 'fpt-isq', name: 'Isometric Squat Test', equipment: 'OVR Force · Force mode, rack', iso: 'ISQ', n: 3, trials: ['imtpPF'], main: ['imtpF100', 'imtpF200', 'imtpRfd'], more: ['imtpImp', 'imtpAvgF', 'imtpTtpf', 'imtpAsym'],
    cues: 'Bar on the back at a set knee angle. Pre-tension, then push up as hard and fast as possible for 3–5 s. 2–3 trials.' },
  slimtp: { id: 'fpt-slimtp', name: 'Single-Leg IMTP Test', equipment: 'OVR Force · Force mode, rack', n: 3, trials: ['slImtpL', 'slImtpR'], main: [], more: [],
    cues: 'Same bar height and set-up as the IMTP, one foot on the plate, other leg free. 2–3 trials each leg.' },
  calf: { id: 'fpt-calf', name: 'Isometric Calf Push Test', equipment: 'OVR Force · Force mode, fixed bar or strap', n: 3, trials: ['calfIsoL', 'calfIsoR'], main: [], more: [],
    cues: 'Push up into a fixed bar through the ball of the foot, same knee angle every time. 2–3 trials each leg.' },
};
const FP_ISO_NAME = { IMTP: 'IMTP', ISQ: 'isometric squat', CALF: 'calf isometric', OTHER: 'other isometric' };
const fpHas = k => Object.prototype.hasOwnProperty.call(FP_TESTS, k);
const fpTestOf = ex => (ex && fpHas(ex.fpTest) ? FP_TESTS[ex.fpTest] : null);
const fpKeys = t => [...t.trials, ...t.main, ...t.more];
const fpTrialsN = (it, t) => { const n = parseInt(it.sets, 10); return n >= 1 && n <= 5 ? n : t.n; };
/* What a test logs, in words (library and planner) */
function fpLogsText(t) {
  const L = k => M[k].label.replace(/ · /g, ' ');
  return [t.trials.length ? `${t.trials.map(L).join(', ')} (each trial, averaged)` : '', ...t.main.map(L)].filter(Boolean).join(', ') + (t.more.length ? `, plus ${plural(t.more.length, 'optional metric')}` : '');
}

/* ---------- Library: the tests are added once, with fixed ids so two devices never make duplicates.
   The fixed timestamp means the coach's own edits (and deletions) always win when devices sync. ---------- */
const FP_ADDED_AT = Date.UTC(2026, 0, 1);
function fpExerciseRec(k) {
  const t = FP_TESTS[k];
  return { id: t.id, name: t.name, category: FP_CAT, equipment: t.equipment, cues: t.cues, videoUrl: '', vbt: false, mvt: null, notes: '', fpTest: k };
}
function fpMissing() {
  return Object.keys(FP_TESTS).filter(k => { const t = FP_TESTS[k]; return !getExercise(t.id) && !S.exercises.some(e => e.fpTest === k || e.name.toLowerCase() === t.name.toLowerCase()); });
}
function ensureFpTests() {
  if (!S.exercises.length) return 0;   // an empty library gets them with the starter set
  const add = fpMissing().filter(k => !S.deleted[FP_TESTS[k].id]);
  add.forEach(k => S.exercises.push({ ...fpExerciseRec(k), createdAt: FP_ADDED_AT, updatedAt: FP_ADDED_AT }));
  if (add.length) persist();
  return add.length;
}

/* ---------- Session logger: one block per test ---------- */
const fpBlank = () => ({ trials: {}, one: {}, sides: {}, bad: {} });
function fpRecId(wid, i) { return i ? `${wid}~fp${i + 1}` : `${wid}~fp`; }
/* Tests that can share one saved test record (needed for DSI, EUR and arm swing); a repeated test,
   or an isometric squat next to an IMTP, gets its own record */
function fpGroups(items) {
  const groups = [];
  items.forEach(it => {
    const t = fpTestOf(getExercise(it.exerciseId));
    if (!t) return;
    const keys = fpKeys(t);
    let g = groups.find(x => !keys.some(k => x.keys.has(k)) && !(t.iso && x.iso && x.iso !== t.iso));
    if (!g) groups.push(g = { i: groups.length, keys: new Set(), iso: null, items: [] });
    keys.forEach(k => g.keys.add(k));
    if (t.iso) g.iso = t.iso;
    g.items.push(it);
  });
  return groups;
}
/* Trials behind a saved result (the result itself if it was edited elsewhere) */
function fpTrialsOf(rec, k) {
  const v = rec.m?.[k], tr = rec.trials?.[k];
  if (v == null) return [];
  return tr?.length && Math.abs(mean(tr) - v) <= 1e-6 * Math.max(1, Math.abs(v)) ? [...tr] : [v];
}
function lastBodyMass(aid) { return [...testsFor(aid)].reverse().find(t => t.bodyMassKg)?.bodyMassKg ?? getAthlete(aid)?.massKg ?? null; }
/* Logger state for a workout: what was saved for it, or blank */
function fpStateFor(w) {
  const st = { fp: {}, bm: null };
  if (w.id) fpGroups((w.items || [])).forEach(g => {
    const rec = getRec('tests', fpRecId(w.id, g.i));
    if (!rec) return;
    if (st.bm == null && rec.bodyMassKg) st.bm = rec.bodyMassKg;
    g.items.forEach(it => {
      const t = fpTestOf(getExercise(it.exerciseId)), e = (st.fp[it.id] = fpBlank());
      t.trials.forEach(k => { const tr = fpTrialsOf(rec, k); if (tr.length) e.trials[k] = tr; });
      [...t.main, ...t.more].forEach(k => { if (rec.m?.[k] != null) e.one[k] = rec.m[k]; });
      Object.entries(rec.sides || {}).forEach(([k, s]) => { if (fpKeys(t).includes(k)) e.sides[k] = s; });
    });
  });
  if (st.bm == null) st.bm = lastBodyMass(w.athleteId);
  return st;
}
/* Earlier results of one metric (everything except this workout, up to its date) */
const fpIsoKey = k => M[k]?.cat === 'iso' && k.startsWith('imtp');
function fpPrior(aid, date, wid, k, iso) {
  const pts = testsFor(aid).filter(t => (!wid || t.workoutId !== wid) && t.date <= date && (!iso || !fpIsoKey(k) || (t.isoType || 'IMTP') === iso))
    .map(t => ({ date: t.date, v: testMetrics(t)[k] })).filter(p => p.v != null && Number.isFinite(p.v));
  if (!pts.length) return null;
  const vals = pts.map(p => p.v), d = M[k];
  return { last: pts[pts.length - 1], best: d.dir === -1 ? Math.min(...vals) : d.dir === 1 ? Math.max(...vals) : null, n: pts.length };
}
/* PRs are judged on the numbers as shown, so a PR never looks equal to the old best */
const prRound = (k, v) => round(metricDisp(M[k], v), M[k].kind === 'len' ? 1 : M[k].dec);
function prBetter(k, v, b) { const x = prRound(k, v), y = prRound(k, b); return M[k].dir === -1 ? x < y : x > y; }
const prable = k => !!(M[k]?.dir && !LB_EXCLUDE.has(k));
function fpFb(w, k, vals, iso) {
  const d = M[k], h = fpPrior(w.athleteId, w.date, w.id, k, iso), v = vals.length ? mean(vals) : null;
  if (v == null) return h ? `<span class="faint">${h.best != null && prable(k) ? `PR ${esc(fmtMetric(d, h.best))} · ` : ''}last ${esc(fmtMetric(d, h.last.v))}</span>` : '<span class="faint">First result</span>';
  const pct = h?.last.v ? (v - h.last.v) / Math.abs(h.last.v) * 100 : null;
  const pr = prable(k) && h?.best != null && prBetter(k, v, h.best);
  const warn = ttUnusual(k, v, h, []) || (vals.length > 1 ? trialQuality({ [k]: vals })[0] : null);
  return `<b>${vals.length > 1 ? 'Avg ' : ''}${esc(fmtMetric(d, v))}</b>${pr ? ' <span class="badge pr">PR</span>' : ''}${pct != null ? ' ' + deltaHtml(d, pct, 'vs last') : ''}${warn ? `<div class="vl-warn">${esc(warn)}</div>` : ''}`;
}
function fpBlockHtml(it, st, w) {
  const ex = getExercise(it.exerciseId), t = fpTestOf(ex), e = (st.fp[it.id] ||= fpBlank()), n = fpTrialsN(it, t);
  const val = (k, v) => (v != null ? esc(ttDisp(k, v)) : '');
  const side = k => (M[k].side ? `<select data-fps="${it.id}" data-k="${k}" aria-label="${esc(M[k].label)}: greater side">${[['', 'Side'], ['Left', 'Left'], ['Right', 'Right']].map(([x, l]) => `<option value="${x}" ${e.sides[k] === x ? 'selected' : ''}>${l}</option>`).join('')}</select>` : '');
  const trialRow = k => { const d = M[k], arr = e.trials[k] || []; return `<div class="fp-tr" style="--n:${n}"><div class="fp-l">${esc(d.label)} <span class="faint">${esc(metricUnit(d))}</span></div>
    ${[...Array(n).keys()].map(i => `<input type="text" inputmode="decimal" data-fp="${it.id}" data-k="${k}" data-i="${i}" placeholder="Trial ${i + 1}" aria-label="${esc(d.label)} trial ${i + 1}" value="${val(k, arr[i])}">`).join('')}
    <div class="fp-fb" data-fb="${it.id}:${k}">${fpFb(w, k, arr.filter(x => x != null), t.iso)}</div></div>`; };
  const one = k => { const d = M[k]; return `<label class="fp-one"><span>${esc(d.label)}${metricUnit(d) ? ` <span class="faint">${esc(metricUnit(d))}</span>` : ''}</span>
    <span class="fp-in"><input type="text" inputmode="decimal" data-fp="${it.id}" data-k="${k}" value="${val(k, e.one[k])}" placeholder="${esc(d.hint?.startsWith('e.g.') ? d.hint.slice(5) : '')}">${side(k)}</span>
    <span class="fp-fb" data-fb="${it.id}:${k}">${e.one[k] != null ? fpFb(w, k, [e.one[k]], t.iso) : ''}</span></label>`; };
  const moreOpen = t.more.some(k => e.one[k] != null);
  const last = fpLastText(w, t);
  return `<div class="log-item fp-block" data-block="${it.id}"><div class="log-head"><div><b>${esc(ex?.name || 'Force plate test')}</b> <span class="badge info">${icon('activity', 'sm')}Force plate test</span></div>
      <div class="small muted"><b>Logs</b> ${esc(fpLogsText(t))}</div>${last ? `<div class="small faint log-last">${last}</div>` : ''}${t.iso === 'IMTP' ? imtpBasisNote() : ''}</div>
    ${t.trials.map(trialRow).join('')}
    ${t.main.length ? `<div class="fp-ones">${t.main.map(one).join('')}</div>` : ''}
    ${t.more.length ? `<details class="fp-more" ${moreOpen ? 'open' : ''}><summary>More metrics <span class="faint">(${t.more.length})</span></summary><div class="fp-ones">${t.more.map(one).join('')}</div></details>` : ''}
  </div>`;
}
function fpLastText(w, t) {
  const keys = [...t.trials, ...t.main].slice(0, 3);
  const prev = testsFor(w.athleteId).filter(x => (!w.id || x.workoutId !== w.id) && x.date <= w.date && keys.some(k => x.m?.[k] != null) && (!t.iso || (x.isoType || 'IMTP') === t.iso)).pop();
  if (!prev) return '';
  const tm = testMetrics(prev);
  return `<b>Last time</b> ${esc(fmtDate(prev.date))}: ${keys.filter(k => tm[k] != null).map(k => `${esc(M[k].label)} ${esc(fmtMetric(M[k], tm[k]))}`).join(' · ')}`;
}
/* Body mass for the day's tests and the calculated numbers, above the exercises */
function fpHeadHtml(w, st) {
  if (!(w.items || []).some(it => fpTestOf(getExercise(it.exerciseId)))) return '';
  return `<div class="fp-head"><div class="fields" style="margin:0">${field('Body mass (same day)', `<input type="text" inputmode="decimal" data-fp-bm value="${st.bm != null ? esc(inVal(U.massOut(st.bm), 1)) : ''}" placeholder="—">`, { unit: U.mass(), hint: 'For relative force and power, DSI and the standards', cls: 'full' })}</div>
    <div class="fp-calc small" data-fp-calc>${fpCalcText(w, st)}</div></div>`;
}
/* The saved test record(s) this logger state would produce */
function fpBuild(w, st) {
  const items = (w.items || []).filter(it => fpTestOf(getExercise(it.exerciseId)));
  return fpGroups(items).map(g => {
    const m = {}, trials = {}, sides = {};
    g.items.forEach(it => {
      const t = fpTestOf(getExercise(it.exerciseId)), e = st.fp[it.id];
      if (!e) return;
      t.trials.forEach(k => { const vals = (e.trials[k] || []).filter(x => x != null); if (vals.length) { trials[k] = vals; m[k] = mean(vals); } });
      [...t.main, ...t.more].forEach(k => { if (e.one[k] != null) m[k] = e.one[k]; });
      Object.entries(e.sides || {}).forEach(([k, s]) => { if (m[k] != null && (s === 'Left' || s === 'Right')) sides[k] = s; });
    });
    return { g, m, trials, sides, isoType: g.iso || 'IMTP' };
  });
}
function fpCalcText(w, st) {
  const out = [];
  fpBuild(w, st).forEach(b => {
    if (!Object.keys(b.m).length) return;
    const tm = testMetrics({ m: b.m, bodyMassKg: st.bm, isoType: b.isoType });
    [['rsiMod', 2], ['djRsi', 2], ['cmjRelPP', 1], ['imtpRel', 1], ['dlPlfRel', 2], ['dsi', 2], ['eur', 2], ['armSwing', 0]].forEach(([k, d]) => {
      const u = M[k].unit;
      if (b.m[k] == null && tm[k] != null) out.push(`${esc(M[k].label)} <b>${esc(fmtNum(tm[k], d))}${u === '%' ? '%' : u ? ' ' + esc(u) : ''}</b>`);
    });
  });
  return out.length ? `Calculated: ${out.join(' · ')}` : '<span class="faint">Calculated values (mRSI, relative power and force, DSI, EUR) appear here.</span>';
}
/* One typed value → { v } in stored units (cm, kg), { bad }, or null when empty. 0% asymmetry is allowed. */
function fpParse(k, raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const d = M[k], x = num(s);
  if (x == null || x < 0 || (x === 0 && !d.side) || (d.unit === '%' && x > 100) || (d.unit === 's' && x > 120)) return { bad: true };
  return { v: metricIn(d, x) };
}
/* Typing in a test block: trials and single values */
function fpInput(el, st, w, root) {
  const e = (st.fp[el.dataset.fp] ||= fpBlank()), k = el.dataset.k, raw = el.value, p = fpParse(k, raw);
  const i = el.dataset.i, slot = i != null ? `${k}:${i}` : k;
  if (p?.bad) e.bad[slot] = raw; else delete e.bad[slot];
  const v = p?.v ?? null;
  el.classList.toggle('bad', !!p?.bad);
  if (i != null) { const arr = (e.trials[k] ||= []); arr[+i] = v; } else if (v == null) delete e.one[k]; else e.one[k] = v;
  const it = (w.items || []).find(x => x.id === el.dataset.fp), t = fpTestOf(getExercise(it?.exerciseId));
  const fb = $(`[data-fb="${el.dataset.fp}:${k}"]`, root);
  if (fb && t) { const vals = i != null ? (e.trials[k] || []).filter(x => x != null) : v != null ? [v] : []; fb.innerHTML = vals.length || i != null ? fpFb(w, k, vals, t.iso) : ''; }
  const c = $('[data-fp-calc]', root);
  if (c) c.innerHTML = fpCalcText(w, st);
}
function fpError(w, st) {
  for (const it of w.items || []) {
    const t = fpTestOf(getExercise(it.exerciseId)), e = st.fp[it.id];
    if (!t || !e) continue;
    const bad = Object.keys(e.bad || {})[0];
    if (bad) { const [k, i] = bad.split(':'); return `${getExercise(it.exerciseId)?.name}: check ${M[k].label}${i != null ? ` (trial ${+i + 1})` : ''}. Enter a number in ${metricUnit(M[k]) || 'the shown unit'}.`; }
  }
  return '';
}

/* ---------- Saving: one test record per group, linked to the workout ---------- */
function fpSave(w, st) {
  const before = prBests(w.athleteId, { except: t => t.workoutId === w.id, upto: w.date });
  const keep = new Set(), saved = [];
  fpBuild(w, st).forEach(b => {
    const id = fpRecId(w.id, b.g.i), old = getRec('tests', id);
    if (!Object.keys(b.m).length) return;
    keep.add(id);
    saved.push(upsert('tests', { ...(old || {}), id, athleteId: w.athleteId, date: w.date, m: b.m, trials: b.trials, sides: b.sides, isoType: b.isoType,
      bodyMassKg: st.bm > 0 ? st.bm : (old?.bodyMassKg ?? null), workoutId: w.id, notes: old?.notes || `Logged in session${w.title ? `: ${w.title}` : ''}` }));
  });
  S.tests.filter(t => t.workoutId === w.id && !keep.has(t.id)).forEach(t => removeRec('tests', t.id));
  return { tests: saved, prs: newPrs(saved, before) };
}

/* ---------- Personal records ---------- */
/* PR slots: each metric, with isometric forces kept apart by isometric type */
function prSlotsOf(t) {
  const out = [];
  Object.entries(testMetrics(t)).forEach(([k, v]) => {
    if (!prable(k) || !Number.isFinite(v)) return;
    const iso = fpIsoKey(k) ? (t.isoType || 'IMTP') : null;
    out.push({ slot: iso ? `${k}|${iso}` : k, k, iso, v });
  });
  return out;
}
const prLabel = p => M[p.k].label + (p.iso ? ` (${FP_ISO_NAME[p.iso] || p.iso})` : '');
/* Best (and first) result per slot */
function prBests(aid, { except = null, upto = null } = {}) {
  const best = new Map();
  testsFor(aid).forEach(t => {
    if ((except && except(t)) || (upto && t.date > upto)) return;
    prSlotsOf(t).forEach(p => {
      const b = best.get(p.slot);
      if (!b) best.set(p.slot, { ...p, date: t.date, first: { v: p.v, date: t.date }, n: 1, prev: null });
      else { b.n++; if (prBetter(p.k, p.v, b.v)) Object.assign(b, { v: p.v, date: t.date, prev: { v: b.v, date: b.date } }); }
    });
  });
  return best;
}
function newPrs(recs, before) {
  const out = new Map();
  recs.forEach(t => prSlotsOf(t).forEach(p => {
    const b = before.get(p.slot);
    if (b && prBetter(p.k, p.v, b.v) && (!out.has(p.slot) || prBetter(p.k, p.v, out.get(p.slot).v))) out.set(p.slot, { ...p, was: b.v });
  }));
  return [...out.values()];
}
const prText = p => `${prLabel(p)} ${fmtMetric(M[p.k], p.v)} (was ${fmtMetric(M[p.k], p.was)})`;
const prOrder = k => { const i = LB_POPULAR.indexOf(k); return i < 0 ? 99 : i; };

/* Lifts: a rep PR = the heaviest load ever for at least that many reps */
function liftSets(aid, exId, { exceptWid = null, upto = null } = {}) {
  const out = [], ok = d => !upto || d <= upto;
  S.workouts.forEach(o => {
    if (o.athleteId !== aid || o.id === exceptWid || !o.log || !ok(o.date)) return;
    (o.items || []).forEach(it => { if (it.exerciseId === exId) (o.log[it.id] || []).forEach(r => { if (r.load > 0 && r.reps >= 1) out.push({ load: r.load, reps: r.reps }); }); });
  });
  S.vbt.forEach(l => { if (l.athleteId === aid && l.exerciseId === exId && l.load > 0 && ok(l.date) && (!l.workoutId || (l.workoutId !== exceptWid && !String(l.id).startsWith(l.workoutId + '~')))) out.push({ load: l.load, reps: l.n || 1 }); });
  S.maxes.forEach(x => { if (x.athleteId === aid && x.exerciseId === exId && x.kg > 0 && ok(x.date) && x.workoutId !== exceptWid) out.push({ load: x.kg, reps: 1 }); });
  return out;
}
function liftPrs(w) {
  const byEx = new Map();
  (w.items || []).forEach(it => {
    const ex = getExercise(it.exerciseId);
    if (!ex || fpTestOf(ex)) return;
    (w.log?.[it.id] || []).forEach(r => { if (r.load > 0 && r.reps >= 1) { if (!byEx.has(ex.id)) byEx.set(ex.id, []); byEx.get(ex.id).push(r); } });
  });
  const prs = [];
  byEx.forEach((sets, exId) => {
    const prev = liftSets(w.athleteId, exId, { exceptWid: w.id, upto: w.date });
    if (!prev.length) return;
    const top = new Map();   // heaviest set at each rep count
    sets.forEach(r => { const b = top.get(r.reps); if (!b || r.load > b.load) top.set(r.reps, r); });
    const hits = [...top.values()].map(r => {
      const cmp = prev.filter(p => p.reps >= r.reps);
      if (!cmp.length) return null;
      const was = Math.max(...cmp.map(p => p.load));
      return r.load > was + 0.05 ? { load: r.load, reps: r.reps, was } : null;
    }).filter(Boolean);
    // a heavier set with as many reps or more already says it
    const keep = hits.filter(h => !hits.some(o => o !== h && o.reps >= h.reps && o.load >= h.load)).sort((x, y) => y.load - x.load);
    if (keep.length) prs.push({ exId, hits: keep });
  });
  return prs;
}
const liftPrText = p => `${getExercise(p.exId)?.name || 'Lift'} ${p.hits.slice(0, 2).map(h => `${fmtMass(h.load)} × ${h.reps} (${h.reps === 1 ? 'heaviest ever' : `${h.reps}-rep PR`}, was ${fmtMass(h.was)})`).join(' and ')}`;
/* A single at RPE 10 is a tested 1RM: it saves to the athlete's maxes (and the 1RM leaderboard) */
function liftMaxesFromLog(w) {
  const best = new Map(), keep = new Set(), made = [];
  (w.items || []).forEach(it => {
    const ex = getExercise(it.exerciseId);
    if (!ex || fpTestOf(ex)) return;
    (w.log?.[it.id] || []).forEach(r => { if (r.reps === 1 && r.rpe === 10 && r.load > 0 && !(best.get(ex.id) >= r.load)) best.set(ex.id, r.load); });
  });
  best.forEach((kg, exId) => {
    const id = `${w.id}~max~${exId}`, old = getRec('maxes', id);
    keep.add(id);
    if (!old || old.kg !== kg || old.date !== w.date) made.push(upsert('maxes', { ...(old || {}), id, athleteId: w.athleteId, exerciseId: exId, kg, date: w.date, v1rm: old?.v1rm ?? null, notes: old?.notes || 'Single at RPE 10 in a logged session', workoutId: w.id }));
  });
  S.maxes.filter(x => x.workoutId === w.id && !keep.has(x.id)).forEach(x => removeRec('maxes', x.id));
  return made;
}

/* ---------- Workout card: what a test logged, with PRs ---------- */
function fpLoggedSummary(w, it) {
  const g = fpGroups((w.items || []).filter(x => fpTestOf(getExercise(x.exerciseId)))).find(x => x.items.includes(it));
  const rec = g && getRec('tests', fpRecId(w.id, g.i)), t = fpTestOf(getExercise(it.exerciseId));
  if (!rec || !t) return '';
  const tm = testMetrics(rec), before = prBests(w.athleteId, { except: x => x.workoutId === w.id, upto: w.date });
  const parts = [...t.trials, ...t.main].filter(k => tm[k] != null).slice(0, 4).map(k => {
    const slot = fpIsoKey(k) ? `${k}|${rec.isoType || 'IMTP'}` : k, b = before.get(slot);
    return `${esc(M[k].label)} <b>${esc(fmtMetric(M[k], tm[k]))}</b>${b && prable(k) && prBetter(k, tm[k], b.v) ? ' <span class="badge pr">PR</span>' : ''}`;
  });
  return parts.length ? `<div class="small" style="margin-top:4px;color:var(--accent)">${icon('check', 'sm')} Logged: ${parts.join(' · ')} · <a href="#/athlete/${w.athleteId}/testing">testing</a></div>` : '';
}

/* ---------- Profile: personal records, updated from every test, evaluation, team test and session ---------- */
function athPrCard(a) {
  const bests = prBests(a.id), since = addDays(today(), -14);
  const isNew = p => !!(p.prev && p.date >= since);
  // new PRs first, then the headline tests, then tests with more than one result
  const rows = [...bests.values()].sort((x, y) => isNew(y) - isNew(x) || prOrder(x.k) - prOrder(y.k) || (y.n > 1) - (x.n > 1) || prLabel(x).localeCompare(prLabel(y)));
  const lifts = [...new Set(S.maxes.filter(x => x.athleteId === a.id && x.kg > 0).map(x => x.exerciseId))].map(exId => {
    const list = S.maxes.filter(x => x.athleteId === a.id && x.exerciseId === exId && x.kg > 0).sort(byKey('date'));
    const best = list.reduce((b, x) => (!b || x.kg > b.kg + 0.05 ? x : b), null);
    return { ex: getExercise(exId), best, first: list[0], isNew: best.date >= since && list.some(x => x.date < best.date && x.kg < best.kg) };
  }).filter(x => x.ex);
  if (!rows.length && !lifts.length) return '';
  const row = p => {
    const d = M[p.k];
    const pct = p.n > 1 && p.first.date < p.date && p.first.v ? (p.v - p.first.v) / Math.abs(p.first.v) * 100 : null;
    return `<div class="pr-row"><div class="row-main"><div class="pr-name">${esc(prLabel(p))}${isNew(p) ? ' <span class="badge pr">New PR</span>' : ''}</div>
      <div class="pr-sub">${esc(fmtDate(p.date))}${pct != null ? ` · from ${esc(fmtMetric(d, p.first.v))} (${esc(fmtDate(p.first.date))}) ${deltaHtml(d, pct)}` : p.n === 1 ? ' · first result' : ''}</div></div>
      <div class="pr-val">${esc(fmtMetric(d, p.v))}</div></div>`;
  };
  const liftRow = x => `<div class="pr-row"><div class="row-main"><div class="pr-name">${esc(x.ex.name)} 1RM${x.isNew ? ' <span class="badge pr">New PR</span>' : ''}</div>
    <div class="pr-sub">${esc(fmtDate(x.best.date))}${x.first !== x.best ? ` · from ${esc(fmtMass(x.first.kg))} (${esc(fmtDate(x.first.date))})` : ''}</div></div><div class="pr-val">${esc(fmtMass(x.best.kg))}</div></div>`;
  const all = [...rows.filter(isNew).map(row), ...lifts.filter(x => x.isNew).map(liftRow), ...rows.filter(p => !isNew(p)).map(row), ...lifts.filter(x => !x.isNew).map(liftRow)];
  const recent = rows.filter(isNew).length + lifts.filter(x => x.isNew).length;
  return `<div class="card pr-card"><div class="card-head"><h3>Personal records</h3><span class="sub">${recent ? `${plural(recent, 'new PR')} in 14 days` : 'updates automatically'}</span></div>
    <div class="pr-list">${all.slice(0, 8).join('')}</div>
    ${all.length > 8 ? `<details class="group" style="margin:8px 0 0"><summary>${plural(all.length - 8, 'more record')}</summary><div class="group-body pr-list">${all.slice(8).join('')}</div></details>` : ''}
    <p class="faint tiny" style="margin:10px 0 0">Best result ever for each test, from every test, evaluation, team test and logged session. Change is from the first result. Small PRs can be within normal test-to-test variation.</p></div>`;
}
