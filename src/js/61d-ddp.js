/* =========================================================
   Dynamic double progression in the workout builder (the coach's philosophy).
   Every exercise has a rep range (e.g. 6–10). Each set progresses on its own: a set that reached
   the top of the range last session gets the next load (and starts again at the bottom of the range);
   a set that didn't keeps its load until it earns the increase.
   Applies to rows prescribed by load (lb/kg) with a rep range, from the reps logged in the athlete's
   last logged session of that exercise. Suggestions only: the coach can change or undo any of them.
   ========================================================= */
/* "6-10", "6–10", "6 to 10" → { lo: 6, hi: 10 }; a single number isn't a range */
function ddpRange(reps) {
  const m = String(reps ?? '').trim().match(/^(\d{1,3})\s*(?:-|–|—|to)\s*(\d{1,3})$/i);
  if (!m) return null;
  const lo = +m[1], hi = +m[2];
  return lo >= 1 && hi > lo && hi <= 50 ? { lo, hi } : null;
}
/* The next load for a set that earned it: about 2.5% more, at least one step (5 lb / 2.5 kg), on the coach's plate steps */
function ddpNextLoad(kg) {
  const step = U.imp() ? 5 : 2.5, d = U.massOut(kg);
  const next = Math.max(Math.round(d * 1.025 / step) * step, d + step);
  return U.massIn(+next.toFixed(2));
}
/* Reps done in a logged set (typed, or counted from the velocities entered rep by rep) */
function ddpRepsDone(r) {
  if (!r) return null;
  if (Number.isFinite(r.reps)) return r.reps;
  const n = r.vels ? parseVels(r.vels).length : 0;
  return n || null;
}
const ddpOk = it => !!(it && it.intensity === 'load' && ddpRange(it.reps) && !fpTestOf(getExercise(it.exerciseId)));
/* The plan from one logged session's row: each set's new load and why. null when it doesn't apply. */
function ddpFromLog(w, it) {
  if (!w?.log || !ddpOk(it)) return null;
  const rg = ddpRange(it.reps), rows = w.log[it.id] || [];
  const n = Math.max(1, Math.min(12, parseInt(it.sets, 10) || rows.length || 1));
  const planned = i => (it.loads?.length ? it.loads[Math.min(i, it.loads.length - 1)] : it.load) ?? null;
  const sets = [];
  for (let i = 0; i < n; i++) {
    const r = rows[i], reps = ddpRepsDone(r), load = r?.load ?? null;
    if (load != null && reps != null) sets.push(reps >= rg.hi ? { did: { load, reps }, load: ddpNextLoad(load), st: 'up' } : { did: { load, reps }, load, st: 'hold' });
    else sets.push({ did: null, load: planned(i), st: 'none' });
  }
  if (!sets.some(s => s.st !== 'none')) return null;
  // a set with nothing logged and no planned load takes the load of the set before it (or after it)
  sets.forEach((s, i) => { if (s.load == null) s.load = sets.slice(0, i).reverse().find(q => q.load != null)?.load ?? sets.slice(i + 1).find(q => q.load != null)?.load ?? null; });
  if (sets.some(s => s.load == null)) return null;
  return { from: w.date, wid: w.id, it, rg, sets };
}
/* The athlete's last logged session of an exercise before a date (not counting the workout being edited) */
function ddpPlan(aid, exId, date, exceptId) {
  if (!aid || !exId) return null;
  const ws = S.workouts.filter(w => w.athleteId === aid && w.id !== exceptId && w.date < date && w.log)
    .sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt || 0) - (a.updatedAt || 0));
  for (const w of ws) {
    const it = (w.items || []).find(i => i.exerciseId === exId && (w.log[i.id] || []).some(r => r.load != null && ddpRepsDone(r) != null));
    if (it) return ddpFromLog(w, it);       // the most recent logged session decides (an older one never does)
  }
  return null;
}
/* Same scheme: the same number of sets and the same rep range */
function ddpSameScheme(a, b) {
  const ra = ddpRange(a?.reps), rb = ddpRange(b?.reps);
  return !!(ra && rb && ra.lo === rb.lo && ra.hi === rb.hi && (parseInt(a.sets, 10) || 0) === (parseInt(b.sets, 10) || 0) && a.intensity === b.intensity);
}
/* A row with the plan's loads (one per set; a single load when they're all the same) */
function ddpApply(row, plan) {
  const n = Math.max(1, Math.min(12, parseInt(row.sets, 10) || plan.sets.length));
  const loads = [...Array(n)].map((_, i) => plan.sets[Math.min(i, plan.sets.length - 1)].load);
  const same = loads.every(v => Math.abs(v - loads[0]) < 1e-6);
  const { _from, ...rest } = row;
  return { ...rest, intensity: 'load', sets: String(n), load: loads[0], loads: same ? null : loads, _ddp: { from: plan.from, wid: plan.wid, hi: plan.rg.hi, sets: plan.sets.slice(0, n), prev: { load: row.load ?? null, loads: row.loads ? [...row.loads] : null, from: _from ?? null } } };
}
/* "Sets 1, 2 reached 10 → +10 lb · Set 3 did 8 of 10 → same load" */
function ddpSummary(d) {
  const nums = idx => idx.map(i => i + 1), list = a => (a.length > 2 ? `${a.slice(0, -1).join(', ')} and ${a[a.length - 1]}` : a.join(' and '));
  const up = d.sets.map((s, i) => (s.st === 'up' ? i : -1)).filter(i => i >= 0), hold = d.sets.map((s, i) => (s.st === 'hold' ? i : -1)).filter(i => i >= 0);
  const all = d.sets.length, parts = [];
  if (up.length) {
    const inc = [...new Set(up.map(i => fmtMass(d.sets[i].load - d.sets[i].did.load, false)))];
    parts.push(`${up.length === all ? (all > 1 ? `All ${all} sets` : 'The set') : `${up.length > 1 ? 'Sets' : 'Set'} ${list(nums(up))}`} reached ${d.hi} → +${inc.join('/')} ${U.mass()}`);
  }
  if (hold.length) {
    // "Sets 2 and 3 did 8 of 10", or each set's reps when they differ: "Set 2 did 9 and set 3 did 8 of 10"
    const reps = [...new Set(hold.map(i => d.sets[i].did.reps))];
    const did = reps.length === 1 ? `${hold.length > 1 ? 'Sets' : 'Set'} ${list(nums(hold))} did ${reps[0]} of ${d.hi}` : `S${list(hold.map(i => `set ${i + 1} did ${d.sets[i].did.reps}`)).slice(1)} of ${d.hi}`;
    parts.push(`${hold.length === all ? (all > 1 ? `No set reached ${d.hi}` : `${d.sets[0].did.reps} of ${d.hi} reps`) : did} → same load${hold.length === all ? ', more reps' : ''}`);
  }
  return parts.join(' · ');
}
function ddpNoteHtml(it, i) {
  const d = it._ddp;
  if (!d) return '';
  return `<div class="ie-ddp">${icon('trend', 'sm')}<span><b>Double progression</b> from ${esc(fmtDate(d.from, { weekday: 'short', month: 'short', day: 'numeric' }))}: ${esc(ddpSummary(d))}</span><button type="button" class="ie-ddp-undo" data-it="ddpUndo" data-i="${i}" aria-label="Undo the double progression for this exercise">Undo</button></div>`;
}
/* Back to the loads the row had before (last time's prescription) */
function ddpUndo(it) {
  const p = it._ddp?.prev;
  if (!p) return it;
  const { _ddp, ...rest } = it;
  return { ...rest, load: p.load, loads: p.loads, ...(p.from ? { _from: p.from } : {}) };
}
/* Rows in a workout that the last logged session can progress (for the "Apply double progression" button) */
function ddpCandidates(x, date) {
  return (x.items || []).map((it, i) => {
    if (!ddpOk(it) || it._ddp) return null;
    const plan = ddpPlan(x.athleteId, it.exerciseId, date, x.id);
    if (!plan) return null;
    // only rows the plan would change
    const nx = ddpApply(it, plan), cur = it.loads?.length ? it.loads : [it.load], nw = nx.loads?.length ? nx.loads : [nx.load];
    const n = Math.max(cur.length, nw.length), at = (a, k) => a[Math.min(k, a.length - 1)];
    return [...Array(n)].some((_, k) => at(cur, k) == null || Math.abs(at(cur, k) - at(nw, k)) > 1e-6) ? { i, plan } : null;
  }).filter(Boolean);
}
