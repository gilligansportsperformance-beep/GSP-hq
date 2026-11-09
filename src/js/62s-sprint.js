/* =========================================================
   Sprint times in the session log.
   • Timed exercises (sprints, starts, timed agility drills): a time per rep instead of load × reps,
     with the best, the average, the change from last time and, when the prescription gives the
     distance, the speed. Saved in the workout's log as { time } rows.
   • Sprint tests (fixed exercises, like the force plate tests): trials for each distance and split.
     The best of each saves to the athlete's testing as an ordinary dated test (id <workout>~sp~<row>),
     so the Testing tab, PRs, leaderboards, percentiles and reports update. Timed tests keep the best
     trial, as in the evaluation and team testing.
   ========================================================= */
const SP_CAT = 'Sprint testing';
/* keys: splits first, the full distance last (splits are optional) */
const SPRINT_TESTS = {
  s10yd: { id: 'spt-10yd', name: '10 yd Sprint Test', keys: ['sprint10yd'], n: 3, cues: 'Same start every time (3-point or 2-point), timed from first movement or gates. 2–3 trials with full recovery.' },
  s40yd: { id: 'spt-40yd', name: '40 yd Dash Test', keys: ['sprint10yd', 'sprint20yd', 'sprint40yd'], n: 2, cues: 'The 10 and 20 yd splits are optional. 2–3 min recovery between trials.' },
  s10m: { id: 'spt-10m', name: '10 m Sprint Test', keys: ['sprint5', 'sprint10'], n: 3, cues: 'The 5 m split is optional. Same start every time. 2–3 trials with full recovery.' },
  s20m: { id: 'spt-20m', name: '20 m Sprint Test', keys: ['sprint10', 'sprint20'], n: 3, cues: 'The 10 m split is optional. 2–3 trials with full recovery.' },
  s30m: { id: 'spt-30m', name: '30 m Sprint Test', keys: ['sprint10', 'sprint20', 'sprint30'], n: 2, cues: 'The 10 and 20 m splits are optional. 2–3 min recovery between trials.' },
  fly10: { id: 'spt-fly10', name: 'Flying 10 m Test', keys: ['fly10'], n: 3, cues: 'Build up over 20–30 m, then time 10 m at top speed.' },
  fly10yd: { id: 'spt-fly10yd', name: 'Flying 10 yd Test (5 yd build)', keys: ['fly10yd'], n: 3, cues: '5 yd build-up, then time the next 10 yd.' },
  pro: { id: 'spt-pro', name: 'Pro Agility Test (5-10-5)', keys: ['proAgility'], n: 2, cues: 'Start straddling the middle line: 5 yd one way, 10 yd back, 5 yd through the middle. Alternate the first direction.' },
  c505: { id: 'spt-505', name: '505 Test', keys: ['cod505'], n: 3, cues: 'Sprint 10 m to build speed, then time 5 m in, the 180° turn and 5 m out. Test both turning feet.' },
};
const spHas = k => Object.prototype.hasOwnProperty.call(SPRINT_TESTS, k);
const spTestOf = ex => (ex && spHas(ex.spTest) ? SPRINT_TESTS[ex.spTest] : null);
const spTrialsN = (it, t) => { const n = parseInt(it.sets, 10); return n >= 1 && n <= 6 ? n : t.n; };
/* "40 yd dash, with 10 yd and 20 yd splits (optional)" */
function spLogsText(t) {
  const main = M[t.keys[t.keys.length - 1]].label, splits = t.keys.slice(0, -1).map(k => M[k].label.replace(/ (sprint|dash)$/, ''));
  return `${main}${splits.length ? `, with ${splits.join(' and ')} splits (optional)` : ''}`;
}
/* Logged as a time per rep: sprint tests, exercises set to times in the library, and sprints, starts and timed agility drills by name */
const SP_TIMED = /sprint|start\b|dash|\bfly|flying|5-10-5|\b505\b|3-cone|l-drill|t-drill|shuttle|pro agility/i;
const SP_NOT = /mirror|ladder|march|skip|wall drill|dribble|bound|shuffle|decel/i;
function timedEx(ex) {
  if (!ex || fpTestOf(ex)) return false;
  if (spTestOf(ex)) return true;
  if (ex.timed === true || ex.timed === false) return ex.timed;
  return ex.category === 'Speed & agility' && SP_TIMED.test(ex.name || '') && !SP_NOT.test(ex.name || '');
}
/* Efforts to time for a row: sets × reps when reps is a number ("6 × 1 × 15 m" → 6), never more than 20 */
const tmEfforts = it => Math.max(1, Math.min(20, (parseInt(it.sets, 10) || 1) * (parseInt(it.reps, 10) || 1)));
/* The distance of a timed row: from the prescription ("1 × 15 m", "20 yd fly"), else a single distance in the name ("(10 yd)").
   { m: metres, label: as written, e.g. "15 m" } or null */
function spDistance(it, ex) {
  const out = (d, u) => (d > 0 && d <= 400 ? { m: /^y/i.test(u) ? d * 0.9144 : d, label: `${fmtNum(d, d % 1 ? 1 : 0)} ${/^y/i.test(u) ? 'yd' : 'm'}` } : null);
  const re = /(\d+(?:\.\d+)?)\s*(m|yd|yds|yards?|metres?|meters?)\b/i;
  for (const s of [it?.reps, it?.notes]) { const m = String(s || '').match(re); if (m) return out(+m[1], m[2]); }
  const n = String(ex?.name || '').match(/\((\d+(?:\.\d+)?)\s*(m|yd)\)/i);
  return n ? out(+n[1], n[2]) : null;
}
const fmtSec = v => `${fmtNum(v, 2)} s`;
const spSpeed = (dm, t) => (dm && t > 0 ? `${fmtNum(dm / t, 1)} m/s (${fmtNum(dm / t * 2.2369363, 1)} mph)` : '');
/* A typed time → seconds, { bad }, or null when empty */
function spParse(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const x = num(s);
  return x == null || !(x > 0) || x > 300 ? { bad: true } : { v: x };
}

/* ---------- Library: the sprint tests are added once, with fixed ids (as the force plate tests) ---------- */
function spExerciseRec(k) {
  const t = SPRINT_TESTS[k];
  return { id: t.id, name: t.name, category: SP_CAT, equipment: 'Timing gates or stopwatch', cues: t.cues, videoUrl: '', vbt: false, mvt: null, notes: '', spTest: k };
}
function spMissing() {
  return Object.keys(SPRINT_TESTS).filter(k => { const t = SPRINT_TESTS[k]; return !getExercise(t.id) && !S.exercises.some(e => e.spTest === k || e.name.toLowerCase() === t.name.toLowerCase()); });
}
function ensureSprintTests() {
  if (!S.exercises.length) return 0;   // an empty library gets them with the starter set
  const add = spMissing().filter(k => !S.deleted[SPRINT_TESTS[k].id]);
  add.forEach(k => S.exercises.push({ ...spExerciseRec(k), createdAt: FP_ADDED_AT, updatedAt: FP_ADDED_AT }));
  if (add.length) persist();
  return add.length;
}

/* ---------- Timed exercises: earlier times, the session log block and summaries ---------- */
const tmTimes = rows => (rows || []).map(r => r?.time).filter(x => Number.isFinite(x) && x > 0);
/* The athlete's last logged times of an exercise before this workout */
function tmPrev(w, exId) {
  const prev = S.workouts.filter(o => o.athleteId === w.athleteId && o.id !== w.id && o.date <= w.date && o.log && (o.items || []).some(it => it.exerciseId === exId && tmTimes(o.log[it.id]).length))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0)).pop();
  if (!prev) return null;
  const times = prev.items.filter(it => it.exerciseId === exId).flatMap(it => tmTimes(prev.log[it.id]));
  return { date: prev.date, times, best: Math.min(...times) };
}
/* "2.31, 2.28, 2.25 s (best 2.25)" */
const tmShort = times => (times.length ? `${times.map(t => fmtNum(t, 2)).join(', ')} s${times.length > 1 ? ` (best ${fmtNum(Math.min(...times), 2)})` : ''}` : '');
function tmLastText(w, exId) {
  const p = tmPrev(w, exId);
  return p ? `<b>Last time</b> ${esc(fmtDate(p.date))}: ${esc(tmShort(p.times))}` : '';
}
function tmSummary(w, it, rows) {
  const times = tmTimes(rows), ex = getExercise(it.exerciseId), d = spDistance(it, ex), p = tmPrev(w, it.exerciseId);
  if (!times.length) return `<span class="faint">Type each rep’s time in seconds${p ? ` · last time’s best ${esc(fmtSec(p.best))}` : ''}.</span>`;
  const best = Math.min(...times), avg = mean(times), diff = p ? best - p.best : null;
  const cls = diff == null || Math.abs(diff) < 0.005 ? 'flat' : diff < 0 ? 'good' : 'bad';
  return `Best <b>${esc(fmtSec(best))}</b>${times.length > 1 ? ` · avg ${esc(fmtSec(avg))}` : ''}${d ? ` · ${esc(d.label)} at ${esc(spSpeed(d.m, best))}` : ''}${diff != null ? ` · <span class="delta ${cls}">${diff < 0 ? '▼' : diff > 0 ? '▲' : ''} ${esc(fmtNum(Math.abs(diff), 2))} s</span> vs last time’s best` : ''}`;
}
const tmCell = (it, r, i) => `<label class="tm-cell"><span>Rep ${i + 1}</span><input type="text" inputmode="decimal" data-tm="${esc(it.id)}" data-i="${i}" value="${r?._bad != null ? esc(r._bad) : r?.time != null ? esc(Number(r.time).toFixed(2)) : ''}" class="${r?._bad != null ? 'bad' : ''}" placeholder="s" aria-label="Rep ${i + 1} time in seconds"></label>`;
function tmBlockHtml(it, rows, w, rx) {
  const ex = getExercise(it.exerciseId), last = tmLastText(w, it.exerciseId);
  return `<div class="log-item tm-block" data-block="${esc(it.id)}"><div class="log-head"><div><b>${esc(ex?.name || 'Exercise')}</b> <span class="badge info">${icon('clock', 'sm')}Timed</span></div>
      ${rx ? `<div class="small muted"><b>Prescribed</b> ${rx}</div>` : ''}${last ? `<div class="small faint log-last">${last}</div>` : ''}</div>
    <div class="tm-grid">${(rows || []).map((r, i) => tmCell(it, r, i)).join('')}</div>
    <div class="tm-sum small" data-tm-sum="${esc(it.id)}">${tmSummary(w, it, rows)}</div>
    <button type="button" class="btn sm" data-tm-add="${esc(it.id)}">${icon('plus', 'sm')}Add rep</button></div>`;
}
/* Typing a time */
function tmInput(el, log, w, root) {
  const id = el.dataset.tm, rows = (log[id] ||= []), i = +el.dataset.i, r = (rows[i] ||= { time: null }), p = spParse(el.value);
  if (p?.bad) { r._bad = el.value; r.time = null; } else { delete r._bad; r.time = p?.v ?? null; }
  el.classList.toggle('bad', !!p?.bad);
  const it = (w.items || []).find(x => x.id === id), sum = $(`[data-tm-sum="${id}"]`, root);
  if (it && sum) sum.innerHTML = tmSummary(w, it, rows);
}
function tmError(w, log) {
  for (const it of w.items || []) {
    const ex = getExercise(it.exerciseId);
    if (!timedEx(ex) || spTestOf(ex)) continue;
    const i = (log[it.id] || []).findIndex(r => r?._bad != null);
    if (i >= 0) return `${ex.name}: check rep ${i + 1}’s time. Enter seconds, e.g. 2.31.`;
  }
  return '';
}

/* ---------- Sprint tests: the session log block, saving and summaries ---------- */
const spRecId = (wid, itemId) => `${wid}~sp~${itemId}`;
const spBlank = () => ({ trials: {}, bad: {} });
/* Logger state for a workout: what was saved for it, or blank */
function spStateFor(w) {
  const st = { sp: {} };
  if (w.id) (w.items || []).forEach(it => {
    const t = spTestOf(getExercise(it.exerciseId)), rec = t && getRec('tests', spRecId(w.id, it.id));
    if (!rec) return;
    const e = (st.sp[it.id] = spBlank());
    t.keys.forEach(k => {
      const v = rec.m?.[k], tr = rec.trials?.[k];
      if (v == null) return;
      e.trials[k] = tr?.length && Math.abs(Math.min(...tr) - v) < 1e-9 ? [...tr] : [v];
    });
  });
  return st;
}
/* Best so far, a PR badge and the change from last time, as you type */
function spFb(w, k, vals) {
  const d = M[k], h = fpPrior(w.athleteId, w.date, w.id, k, null), v = vals.length ? Math.min(...vals) : null;
  if (v == null) return h ? `<span class="faint">${h.best != null && prable(k) ? `PR ${esc(fmtMetric(d, h.best))} · ` : ''}last ${esc(fmtMetric(d, h.last.v))}</span>` : '<span class="faint">First result</span>';
  const pct = h?.last.v ? (v - h.last.v) / Math.abs(h.last.v) * 100 : null;
  const pr = prable(k) && h?.best != null && prBetter(k, v, h.best);
  return `<b>${vals.length > 1 ? 'Best ' : ''}${esc(fmtMetric(d, v))}</b>${pr ? ' <span class="badge pr">PR</span>' : ''}${pct != null ? ' ' + deltaHtml(d, pct, 'vs last') : ''}`;
}
const spShort = k => M[k].label.replace(/ (sprint|dash|test)$/i, '').replace(/^Flying /, 'Fly ');
function spLastText(w, t) {
  const prev = testsFor(w.athleteId).filter(x => (!w.id || x.workoutId !== w.id) && x.date <= w.date && t.keys.some(k => x.m?.[k] != null)).pop();
  if (!prev) return '';
  return `<b>Last time</b> ${esc(fmtDate(prev.date))}: ${t.keys.filter(k => prev.m?.[k] != null).map(k => `${esc(spShort(k))} ${esc(fmtMetric(M[k], prev.m[k]))}`).join(' · ')}`;
}
function spBlockHtml(it, st, w) {
  const ex = getExercise(it.exerciseId), t = spTestOf(ex), e = (st.sp[it.id] ||= spBlank()), n = spTrialsN(it, t), last = spLastText(w, t);
  const cell = (k, i) => { const slot = `${k}:${i}`, v = e.trials[k]?.[i]; return `<input type="text" inputmode="decimal" data-sp="${esc(it.id)}" data-k="${k}" data-i="${i}" class="${e.bad[slot] != null ? 'bad' : ''}" value="${e.bad[slot] != null ? esc(e.bad[slot]) : v != null ? esc(Number(v).toFixed(2)) : ''}" placeholder="s" aria-label="${esc(M[k].label)} trial ${i + 1}">`; };
  return `<div class="log-item sp-block" data-block="${esc(it.id)}"><div class="log-head"><div><b>${esc(ex?.name || 'Sprint test')}</b> <span class="badge info">${icon('clock', 'sm')}Sprint test</span></div>
      <div class="small muted"><b>Logs</b> ${esc(spLogsText(t))}. The best time saves to the athlete’s testing.</div>${last ? `<div class="small faint log-last">${last}</div>` : ''}</div>
    <div class="sp-grid" style="--k:${t.keys.length}">
      <span></span>${t.keys.map(k => `<span class="sp-h">${esc(spShort(k))}${t.keys.length > 1 && k !== t.keys[t.keys.length - 1] ? ' <i>split</i>' : ''}</span>`).join('')}
      ${[...Array(n).keys()].map(i => `<span class="sp-n">Trial ${i + 1}</span>${t.keys.map(k => cell(k, i)).join('')}`).join('')}
      <span class="sp-n">Best</span>${t.keys.map(k => `<span class="sp-fb" data-sp-fb="${esc(it.id)}:${k}">${spFb(w, k, (e.trials[k] || []).filter(x => x != null))}</span>`).join('')}
    </div></div>`;
}
function spInput(el, st, w, root) {
  const e = (st.sp[el.dataset.sp] ||= spBlank()), k = el.dataset.k, i = +el.dataset.i, p = spParse(el.value), slot = `${k}:${i}`;
  if (p?.bad) e.bad[slot] = el.value; else delete e.bad[slot];
  el.classList.toggle('bad', !!p?.bad);
  (e.trials[k] ||= [])[i] = p?.v ?? null;
  const fb = $(`[data-sp-fb="${el.dataset.sp}:${k}"]`, root);
  if (fb) fb.innerHTML = spFb(w, k, e.trials[k].filter(x => x != null));
}
function spError(w, st) {
  for (const it of w.items || []) {
    const t = spTestOf(getExercise(it.exerciseId)), e = st.sp[it.id];
    if (!t || !e) continue;
    const bad = Object.keys(e.bad || {})[0];
    if (bad) { const [k, i] = bad.split(':'); return `${getExercise(it.exerciseId)?.name}: check the ${M[k].label} time in trial ${+i + 1}. Enter seconds, e.g. 1.85.`; }
  }
  return '';
}
/* One test record per sprint test row, linked to the workout; the best of each distance */
function spSave(w, st) {
  const before = prBests(w.athleteId, { except: t => t.workoutId === w.id, upto: w.date });
  const keep = new Set(), saved = [];
  (w.items || []).forEach(it => {
    const t = spTestOf(getExercise(it.exerciseId)), e = st.sp[it.id];
    if (!t || !e) return;
    const m = {}, trials = {};
    t.keys.forEach(k => { const vals = (e.trials[k] || []).filter(x => Number.isFinite(x) && x > 0); if (vals.length) { trials[k] = vals; m[k] = Math.min(...vals); } });
    if (!Object.keys(m).length) return;
    const id = spRecId(w.id, it.id), old = getRec('tests', id);
    keep.add(id);
    saved.push(upsert('tests', { ...(old || {}), id, athleteId: w.athleteId, date: w.date, m, trials, sides: old?.sides || {}, workoutId: w.id, notes: old?.notes || `Logged in session${w.title ? `: ${w.title}` : ''}` }));
  });
  S.tests.filter(t => t.workoutId === w.id && String(t.id).startsWith(`${w.id}~sp~`) && !keep.has(t.id)).forEach(t => removeRec('tests', t.id));
  return { tests: saved, prs: newPrs(saved, before) };
}
function spLoggedSummary(w, it) {
  const t = spTestOf(getExercise(it.exerciseId)), rec = t && getRec('tests', spRecId(w.id, it.id));
  if (!rec) return '';
  const before = prBests(w.athleteId, { except: x => x.workoutId === w.id, upto: w.date });
  const parts = t.keys.filter(k => rec.m?.[k] != null).map(k => { const b = before.get(k); return `${esc(spShort(k))} <b>${esc(fmtMetric(M[k], rec.m[k]))}</b>${b && prable(k) && prBetter(k, rec.m[k], b.v) ? ' <span class="badge pr">PR</span>' : ''}`; });
  return parts.length ? `<div class="small" style="margin-top:4px;color:var(--accent)">${icon('check', 'sm')} Logged: ${parts.join(' · ')} · <a href="#/athlete/${esc(w.athleteId)}/testing">testing</a></div>` : '';
}
function spLoggedText(w, it) {
  const t = spTestOf(getExercise(it.exerciseId)), rec = t && getRec('tests', spRecId(w.id, it.id));
  return rec ? t.keys.filter(k => rec.m?.[k] != null).map(k => `${spShort(k)} ${fmtMetric(M[k], rec.m[k])}`).join(' · ') : '';
}
