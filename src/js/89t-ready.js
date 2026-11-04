/* =========================================================
   Readiness check (neuromuscular fatigue), each visit
   A CMJ on the force plate or an overcoming isometric, compared with the athlete's own
   recent baseline. Stored in S.readiness (separate from test results, so daily checks
   don't change testing trends, records or percentiles).
   ========================================================= */
const READY_MODES = {
  cmj: { label: 'CMJ', long: 'Countermovement jump (force plate)', metrics: ['cmj', 'rsiMod'] },
  iso: { label: 'Isometric', long: 'Overcoming isometric', metrics: ['imtpPF'] },
};
const READY_ISO = [['IMTP', 'Mid-thigh pull'], ['ISQ', 'Isometric squat'], ['OTHER', 'Other isometric']];
const READY_STATUS = {
  up: { cls: 'good', label: 'Ready (above normal)', short: 'Up', advice: 'Above normal. Train as planned; a good day for quality heavy or fast work.' },
  ok: { cls: 'good', label: 'Ready', short: 'Ready', advice: 'Within normal range. Train as planned.' },
  low: { cls: 'warn', label: 'Slightly down', short: 'Down', advice: 'A little below normal. Train, but protect quality: add 1 RIR or use a velocity-loss stop, and consider one fewer set on the main lifts.' },
  bad: { cls: 'bad', label: 'Fatigued', short: 'Fatigued', advice: 'Clearly below normal. Reduce today: lower the load (add 2+ RIR) or cut volume by about a third to a half, skip max efforts, and re-check next visit. Ask about sleep, soreness and illness.' },
  base: { cls: '', label: 'Building baseline', short: 'Baseline', advice: 'Needs 3 earlier results of this test (checks or Testing results, last 90 days) to judge readiness.' },
};
const readyMetricLabel = k => ({ cmj: 'Jump height', rsiMod: 'mRSI', imtpPF: 'Peak force' }[k] || M[k]?.label || k);

function readyValue(rec, k) { const t = (rec.trials?.[k] || []).filter(Number.isFinite); return t.length ? mean(t) : Number.isFinite(rec.m?.[k]) ? rec.m[k] : null; }
/* The athlete's earlier results of the same test, one per day, last 90 days: readiness checks AND results
   entered anywhere else (Testing tab, evaluations, team testing, imports, force plate tests logged in sessions).
   CMJ: force-plate heights only (OVR Jump flight-time heights aren't comparable). Isometric: the same type.
   When a day has both, the readiness check is used. Each point is { date, vals: {metric: value}, src }. */
function readyHistory(aid, mode, isoType, before, excludeId) {
  const from = addDays(before, -90), iso = isoType || 'IMTP', keys = READY_MODES[mode]?.metrics || [];
  const days = new Map();
  const add = (date, rec, src) => {
    const vals = {};
    keys.forEach(k => { const v = readyValue(rec, k); if (v != null) vals[k] = v; });
    if (!Object.keys(vals).length) return;
    const cur = days.get(date);
    if (cur && cur.src === 'check' && src === 'test') return;
    days.set(date, cur && cur.src === src ? { ...cur, vals: { ...cur.vals, ...vals } } : { date, vals, src });
  };
  S.tests.filter(t => t.athleteId === aid && t.date < before && t.date >= from
    && (mode === 'cmj' ? jumpMethod(t.device) === 'fp' : (t.isoType || 'IMTP') === iso)).forEach(t => add(t.date, t, 'test'));
  S.readiness.filter(r => r.athleteId === aid && r.id !== excludeId && r.mode === mode && (mode !== 'iso' || (r.isoType || 'IMTP') === iso)
    && r.date < before && r.date >= from).forEach(r => add(r.date, r, 'check'));
  return [...days.values()].sort(byKey('date'));
}
/* The check is available once there are 3 earlier results of a test (CMJ, or one isometric type) in the last 90 days */
const READY_NEED = 3;
function readyAvail(aid, date = today()) {
  const n = (mode, iso) => readyHistory(aid, mode, iso, date).filter(p => p.vals[READY_MODES[mode].metrics[0]] != null).length;
  const opts = [{ mode: 'cmj', n: n('cmj') }, ...READY_ISO.map(([iso]) => ({ mode: 'iso', isoType: iso, n: n('iso', iso) }))];
  const ok = opts.filter(o => o.n >= READY_NEED);
  const best = opts.reduce((b, o) => (o.n > b.n ? o : b), opts[0]);
  return { ok: ok.length > 0, opts: ok, best, n: best.n };
}
const readyModeName = o => (o.mode === 'iso' ? READY_ISO.find(x => x[0] === (o.isoType || 'IMTP'))[1] : 'CMJ');
function readyLockedText(a, av) {
  return `The readiness check unlocks once ${esc(a.firstName)} has ${READY_NEED} force-plate CMJ or isometric results from the last 90 days (Testing, evaluations, team tests or earlier checks). ${av.n ? `${av.n} of ${READY_NEED} so far` : 'None yet'}${av.n ? ` (${esc(readyModeName(av.best))})` : ''}.`;
}
/* Change vs the mean of up to 8 previous results of the same test (last 90 days; see readyHistory). "Noise" = the test's typical error,
   or the athlete's own check-to-check variation once there are 5+ checks (never below half the typical error).
   Status: within −1 noise = ready; −1 to −2 = slightly down; beyond −2 = fatigued. Mean of trials is used
   because it tracks fatigue better than the best trial (Claudino et al. 2017). */
function readyEval(rec) {
  const hist = readyHistory(rec.athleteId, rec.mode, rec.isoType, rec.date, rec.id).slice(-8);
  const rows = (READY_MODES[rec.mode]?.metrics || []).map(k => {
    const v = readyValue(rec, k);
    if (v == null) return null;
    const base = hist.map(p => p.vals[k]).filter(x => x != null);
    const lit = M[k]?.te || 5;
    if (base.length < 3) return { k, v, n: base.length, status: 'base' };
    const bm = mean(base), cv = base.length >= 5 ? sd(base) / bm * 100 : null;
    const noise = cv != null ? Math.max(cv, lit * 0.5) : lit;
    const pct = (v - bm) / bm * 100 * (M[k]?.dir === -1 ? -1 : 1);
    const z = pct / noise;
    return { k, v, n: base.length, base: bm, pct, noise, status: z < -2 ? 'bad' : z < -1 ? 'low' : z > 1 ? 'up' : 'ok' };
  }).filter(Boolean);
  const order = ['bad', 'low', 'ok', 'up'];
  const judged = rows.filter(r => r.status !== 'base');
  const status = judged.length ? judged.map(r => r.status).sort((a, b) => order.indexOf(a) - order.indexOf(b))[0] : rows.length ? 'base' : null;
  return { rows, status, need: Math.max(0, 3 - Math.max(0, ...rows.map(r => r.n))) };
}
function readyToday(aid, date = today()) { return S.readiness.filter(r => r.athleteId === aid && r.date === date).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0))[0] || null; }
function readyChip(aid, date = today()) {
  const r = readyToday(aid, date);
  if (!r) return '';
  const e = readyEval(r), s = READY_STATUS[e.status] || READY_STATUS.base;
  return `<span class="badge ${s.cls}">${icon('activity', 'sm')}${esc(s.short)}</span>`;
}
function readyResultHtml(rec) {
  const e = readyEval(rec);
  if (!e.status) return '<span class="faint">Enter at least one trial.</span>';
  const s = READY_STATUS[e.status];
  return `<div class="ready-res ${s.cls}"><b>${esc(s.label)}</b>${e.rows.map(r => `<span>${esc(readyMetricLabel(r.k))} ${esc(fmtMetric(M[r.k], r.v))}${r.pct != null ? ` · <b>${Math.abs(r.pct) < 0.05 ? '' : r.pct > 0 ? '+' : '−'}${fmtNum(Math.abs(r.pct), 1)}%</b> vs normal (${r.n} earlier results)` : ` · ${r.n} of 3 earlier results for a baseline`}</span>`).join('')}
    <span class="small">${esc(s.advice)}</span></div>`;
}

/* ---------- Entry form (used in the session logger and on its own) ---------- */
function readyFormHtml(st) {
  const mode = READY_MODES[st.mode] ? st.mode : 'cmj';
  const keys = READY_MODES[mode].metrics;
  const cell = (k, i) => { const v = st.trials?.[k]?.[i]; return `<input type="text" inputmode="decimal" data-rt="${k}" data-ri="${i}" value="${v != null ? esc(inVal(metricDisp(M[k], v), M[k].kind === 'len' ? 1 : M[k].dec)) : ''}" aria-label="${esc(readyMetricLabel(k))} trial ${i + 1}">`; };
  return `<div class="ready-form">
    <div class="split" style="flex-wrap:wrap;gap:8px"><div class="seg inline">${Object.entries(READY_MODES).map(([k, m]) => `<button type="button" class="${k === mode ? 'on' : ''}" data-rmode="${k}">${m.label}</button>`).join('')}</div>
      ${mode === 'iso' ? `<select data-riso aria-label="Isometric type" style="width:auto;min-height:34px;padding-top:4px;padding-bottom:4px">${READY_ISO.map(([v, l]) => `<option value="${v}" ${v === (st.isoType || 'IMTP') ? 'selected' : ''}>${l}</option>`).join('')}</select>` : ''}</div>
    <table class="t ready-grid"><thead><tr><th></th><th>Trial 1</th><th>Trial 2</th><th>Trial 3</th></tr></thead><tbody>
      ${keys.map(k => `<tr><td><b>${esc(readyMetricLabel(k))}</b> <span class="faint tiny">${esc(metricUnit(M[k]) || '')}${k === 'rsiMod' ? ' optional' : ''}</span></td>${[0, 1, 2].map(i => `<td>${cell(k, i)}</td>`).join('')}</tr>`).join('')}
    </tbody></table>
    <div data-ready-out>${readyResultHtml(readyRecFrom(st))}</div>
  </div>`;
}
function readyRecFrom(st) {
  const trials = {};
  READY_MODES[st.mode].metrics.forEach(k => { const t = (st.trials?.[k] || []).filter(Number.isFinite); if (t.length) trials[k] = t; });
  return { id: st.id || '__new', athleteId: st.athleteId, date: st.date, mode: st.mode, isoType: st.mode === 'iso' ? (st.isoType || 'IMTP') : undefined, trials, m: Object.fromEntries(Object.entries(trials).map(([k, t]) => [k, mean(t)])) };
}
/* Wire a readiness form inside `root`; `st` is mutated, onChange runs after every edit */
function bindReadyForm(root, st, onChange = () => {}) {
  const host = () => $('[data-ready-host]', root);
  root.addEventListener('click', e => {
    const b = e.target.closest('[data-rmode]');
    if (!b || !host()?.contains(b)) return;
    st.mode = b.dataset.rmode; host().innerHTML = readyFormHtml(st); onChange();
  });
  root.addEventListener('change', e => { if (e.target.matches('[data-riso]')) { st.isoType = e.target.value; $('[data-ready-out]', root).innerHTML = readyResultHtml(readyRecFrom(st)); onChange(); } });
  root.addEventListener('input', e => {
    const el = e.target;
    if (!el.dataset.rt) return;
    const k = el.dataset.rt, i = +el.dataset.ri, x = num(el.value);
    const arr = (st.trials[k] ||= [null, null, null]);
    arr[i] = x == null ? null : metricIn(M[k], x);
    $('[data-ready-out]', root).innerHTML = readyResultHtml(readyRecFrom(st));
    onChange();
  });
}
function readyStateFor(aid, date, workoutId) {
  const ex = readyToday(aid, date);
  if (ex) return { id: ex.id, athleteId: aid, date, mode: ex.mode, isoType: ex.isoType, trials: JSON.parse(JSON.stringify(ex.trials || {})), workoutId: ex.workoutId || workoutId || null };
  const last = S.readiness.filter(r => r.athleteId === aid).sort(byKey('date')).pop();
  const av = readyAvail(aid, date);
  // the test they used last time if it has a baseline, else the one with the most earlier results
  const pick = av.opts.find(o => o.mode === last?.mode && (o.mode !== 'iso' || o.isoType === (last?.isoType || 'IMTP'))) || [...av.opts].sort((x, y) => y.n - x.n)[0] || { mode: last?.mode || 'cmj', isoType: last?.isoType || 'IMTP' };
  return { id: null, athleteId: aid, date, mode: pick.mode, isoType: pick.isoType || last?.isoType || 'IMTP', trials: {}, workoutId: workoutId || null };
}
/* Save (or delete when emptied). Returns the record or null. */
function readyError(st) {
  for (const [k, t] of Object.entries(readyRecFrom(st).trials)) {
    const lim = { cmj: [3, 150], rsiMod: [0.05, 2], imtpPF: [100, 12000] }[k];
    if (t.some(x => x < lim[0] || x > lim[1])) return `Readiness: ${readyMetricLabel(k)} looks wrong (check the units).`;
  }
  return '';
}
function saveReady(st) {
  const err = readyError(st);
  if (err) return { error: err };
  const rec = readyRecFrom(st);
  if (!Object.keys(rec.trials).length) { if (st.id) removeRec('readiness', st.id); return null; }
  const saved = upsert('readiness', { ...(st.id ? getRec('readiness', st.id) : {}), id: st.id || undefined, athleteId: st.athleteId, date: st.date, mode: rec.mode, isoType: rec.isoType || null, trials: rec.trials, m: rec.m, workoutId: st.workoutId || null });
  st.id = saved.id;
  return saved;
}
A.readyCheck = el => {
  const a = getAthlete(el.dataset.a);
  if (!a) return;
  const av = readyAvail(a.id);
  if (!av.ok && !readyToday(a.id)) return toast(`${a.firstName}: ${av.n} of ${READY_NEED} results so far. The readiness check unlocks at ${READY_NEED}.`);
  const wo = S.workouts.find(w => w.athleteId === a.id && w.date === today());
  const st = readyStateFor(a.id, today(), wo?.id);
  openModal({
    title: `Readiness — ${athleteName(a, true)}`, size: 'narrow', submit: 'Save',
    body: `<p class="muted small" style="margin-top:0">Same warm-up, same test every visit. 2–3 trials; the average is compared with ${esc(a.firstName)}’s normal.</p><div data-ready-host>${readyFormHtml(st)}</div>${refLinks(['claudino2017', 'gathercole2015', 'comfort2019'])}`,
    onSubmit: () => {
      const r = saveReady(st);
      if (r?.error) return r.error;
      toast(r ? `Readiness: ${READY_STATUS[readyEval(r).status].label}` : 'Nothing saved'); refresh();
    },
    onMount: m => bindReadyForm(m.wrap, st),
  });
};

/* ---------- Athlete Overview card ---------- */
function athReadyCard(a) {
  const recs = S.readiness.filter(r => r.athleteId === a.id).sort(byKey('date'));
  const av = readyAvail(a.id);
  const head = `<div class="card-head"><h3>Readiness</h3>${av.ok ? `<button class="btn sm" data-act="readyCheck" data-a="${a.id}">${icon('activity', 'sm')}Check now</button>` : `<span class="sub">${av.n} of ${READY_NEED}</span>`}</div>`;
  if (!recs.length) return `<div class="card">${head}<p class="muted small" style="margin:0">${av.ok ? `Unlocked: ${esc(av.opts.map(readyModeName).join(', '))}. Each workout now starts with a readiness check (in the session log, or from Gym Floor), compared with ${esc(a.firstName)}’s normal from their earlier results.` : readyLockedText(a, av)}</p></div>`;
  const last = recs[recs.length - 1], e = readyEval(last), s = READY_STATUS[e.status];
  const pts = recs.slice(-14).map(r => { const ev = readyEval(r); const row = ev.rows.find(x => x.pct != null); return row ? { x: r.date, y: row.pct, tip: `${fmtDate(r.date)} · ${READY_MODES[r.mode].label} ${row.pct >= 0 ? '+' : ''}${fmtNum(row.pct, 1)}% vs normal` } : null; }).filter(Boolean);
  return `<div class="card">${head}
    <div class="split" style="align-items:flex-start;gap:10px"><div><span class="badge ${s.cls}">${esc(s.label)}</span> <span class="faint small">${esc(fmtDate(last.date))} · ${esc(READY_MODES[last.mode].label)}${last.mode === 'iso' ? ' · ' + esc(READY_ISO.find(x => x[0] === (last.isoType || 'IMTP'))[1]) : ''}</span></div></div>
    <div style="margin-top:8px">${readyResultHtml(last)}</div>
    ${pts.length >= 2 ? `<div style="margin-top:8px">${chart({ type: 'line', points: pts, h: 120 })}</div>` : ''}
    <p class="faint tiny" style="margin:8px 0 0">${plural(recs.length, 'check')}. Compared with the average of up to 8 earlier results of the same test from the last 90 days: readiness checks and Testing results (force-plate CMJ, or the same isometric).</p></div>`;
}

/* "Readiness check first" on a workout once the athlete is unlocked; today's result when it's done */
function woReadyLine(w) {
  const r = readyToday(w.athleteId, w.date);
  const av = r ? null : readyAvail(w.athleteId, w.date);
  if (!r && !av.ok) return '';
  const e = r ? readyEval(r) : null, s = e ? READY_STATUS[e.status] || READY_STATUS.base : null;
  const st = r ? { mode: r.mode, isoType: r.isoType } : readyStateFor(w.athleteId, w.date, w.id);
  return `<div class="wo-ready">${icon('activity', 'sm')}<span><b>Readiness check</b> · ${esc(readyModeName(st))} · 3 trials${s ? ` <span class="badge ${s.cls}">${esc(s.label)}</span>` : ' <span class="faint">in the session log, first</span>'}</span></div>`;
}
