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

/* ---------- Making it visible: the builder strip, row tips, the session log and the Program tab card ---------- */
const DDP_STRENGTH = ['Squat', 'Hinge', 'Single-leg', 'Upper push', 'Upper pull', 'Accessory'];
/* True when the plan would give the row different loads than it has */
function ddpDiffers(it, plan) {
  const nx = ddpApply(it, plan), cur = it.loads?.length ? it.loads : [it.load], nw = nx.loads?.length ? nx.loads : [nx.load];
  const n = Math.max(cur.length, nw.length), at = (a, k) => a[Math.min(k, a.length - 1)];
  return [...Array(n)].some((_, k) => at(cur, k) == null || Math.abs(at(cur, k) - at(nw, k)) > 1e-6);
}
/* A line under a builder row that double progression isn't progressing, saying why ('' when there's nothing to say) */
function ddpRowTip(it, dctx) {
  if (!it.exerciseId || it._ddp || it.intensity !== 'load') return '';
  const ex = getExercise(it.exerciseId);
  if (!ex || fpTestOf(ex)) return '';
  const tip = (txt, cls = '') => `<div class="ie-ddp-tip ${cls}">${icon(cls === 'ok' ? 'check' : 'trend', 'sm')}<span>${txt}</span></div>`;
  if (!ddpRange(it.reps)) return DDP_STRENGTH.includes(ex.category) ? tip('Write the reps as a range (e.g. 6–10) to progress this set by set with double progression.') : '';
  if (!dctx?.aid) return '';
  const plan = ddpPlan(dctx.aid, it.exerciseId, dctx.date, dctx.wid);
  if (!plan) return tip(`Double progression starts once ${esc(ex.name)} has a logged session.`);
  return ddpDiffers(it, plan) ? tip(`Double progression can update these loads from ${esc(fmtDate(plan.from, { weekday: 'short', month: 'short', day: 'numeric' }))}: tap <b>Apply double progression</b>.`)
    : tip(`Double progression: these loads follow the session of ${esc(fmtDate(plan.from, { weekday: 'short', month: 'short', day: 'numeric' }))}.`, 'ok');
}
/* The strip above the builder's rows: what double progression is doing in this workout */
function ddpStripText(x, date) {
  const rows = (x.items || []).filter(it => it.exerciseId && !fpTestOf(getExercise(it.exerciseId)));
  const done = rows.filter(it => it._ddp).length, can = ddpCandidates(x, date).length, ranged = rows.filter(it => it.intensity === 'load' && ddpRange(it.reps)).length;
  if (done) return `${plural(done, 'exercise')} filled in set by set from the last logged session.`;
  if (can) return `${plural(can, 'exercise')} can be updated from the last logged session.`;
  if (ranged) return `On for ${plural(ranged, 'exercise')} with a rep range.`;
  return 'Prescribe by load with a rep range (e.g. 3 × 6–10 @ 135 lb) and each set progresses from the last logged session.';
}
/* The session log: the target, and "goes up next time" as soon as a set reaches the top of the range */
function ddpLogLine(it) {
  if (!ddpOk(it)) return '';
  const rg = ddpRange(it.reps);
  return `<div class="ddp-log">${icon('trend', 'sm')}<span><b>Double progression:</b> aim for ${rg.lo}–${rg.hi} reps. A set that reaches ${rg.hi} goes up next session.</span></div>`;
}
function ddpSetBadge(it, r) {
  const rg = ddpOk(it) ? ddpRange(it.reps) : null, reps = ddpRepsDone(r);
  if (!rg || r?.load == null || reps == null || reps < rg.hi) return '';
  return `▲ +${fmtMass(ddpNextLoad(r.load) - r.load, false)} ${U.mass()} next time`;
}
/* "How it works" */
A.ddpHelp = () => openModal({
  title: 'Double progression', size: 'narrow', submit: 'Got it', cancel: 'Close',
  body: `<p class="muted" style="margin-top:0">${esc(PHIL_DDP.text)}</p>
    <ol class="ddp-how">
      <li>Prescribe the exercise by <b>Load</b> with a <b>rep range</b>, e.g. <b>3 × 6–10 @ 225 lb</b>.</li>
      <li>Log the session: the reps each set actually did.</li>
      <li>Next time you add the exercise (or tap <b>Apply double progression</b> on a workout you planned ahead), each set is filled in: a set that reached the top of the range goes up about 2.5% (at least 5 lb), the others keep their load.</li>
      <li>In the session log, a set that reaches the top shows <b>▲ next time</b>. Each athlete’s <b>Program</b> tab shows where every set stands.</li>
    </ol>
    <div class="ddp-ex"><div><span>Last session</span><b>225 × 10 · 225 × 10 · 225 × 8</b></div><div><span>Next session</span><b>230 · 230 · 225 lb</b></div></div>
    <p class="faint small" style="margin:10px 0 0">Every suggestion can be changed or undone. Technique decides: if a set reached the top with poor form, keep its load.</p>`,
  onSubmit: () => {},
});
/* The athlete's Program tab: every exercise on double progression, with each set's last result and next load */
function ddpCardHtml(a) {
  const since = addDays(today(), -70), seen = new Map();
  S.workouts.filter(w => w.athleteId === a.id && w.date >= since).sort((x, y) => y.date.localeCompare(x.date))
    .forEach(w => (w.items || []).forEach(it => { if (ddpOk(it) && !seen.has(it.exerciseId) && getExercise(it.exerciseId)) seen.set(it.exerciseId, it); }));
  const head = `<div class="card-head"><h3>${icon('trend', 'sm')} Double progression</h3><button type="button" class="btn sm ghost" data-act="ddpHelp">How it works</button></div>`;
  if (!seen.size) return `<div class="card ddp-card">${head}<p class="muted small" style="margin:0">No exercises use it yet. Prescribe by load with a rep range (e.g. 3 × 6–10 @ 135 lb) and log the session: the next workout fills in each set, and this card shows where every set stands.</p></div>`;
  const rows = [...seen.entries()].map(([exId, it]) => {
    const ex = getExercise(exId), rg = ddpRange(it.reps), plan = ddpPlan(a.id, exId, addDays(today(), 1));
    const scheme = `${esc(it.sets || '–')} × ${rg.lo}–${rg.hi}`;
    if (!plan) return `<div class="ddp-row"><div class="ddp-nm"><b>${esc(ex.name)}</b><span>${scheme}</span></div><div class="ddp-st faint">Not logged yet: starts after the first logged session.</div></div>`;
    const did = plan.sets.map(s => (s.did ? `${fmtMass(s.did.load, false)} × ${s.did.reps}` : '—')).join(' · ');
    const next = plan.sets.map(s => `<span class="${s.st === 'up' ? 'up' : ''}">${s.st === 'up' ? '▲ ' : ''}${fmtMass(s.load, false)}</span>`).join(' · ');
    const up = plan.sets.filter(s => s.st === 'up').length;
    return `<div class="ddp-row"><div class="ddp-nm"><b>${esc(ex.name)}</b><span>${scheme}</span></div>
      <div class="ddp-st"><div><span class="faint">${esc(fmtDate(plan.from, { weekday: 'short', month: 'short', day: 'numeric' }))}:</span> ${esc(did)} ${esc(U.mass())}</div>
      <div class="ddp-next"><span class="faint">Next:</span> ${next} ${esc(U.mass())}${up ? ` <span class="badge good">${plural(up, 'set')} up</span>` : ` <span class="faint small">same loads, more reps</span>`}</div></div></div>`;
  }).join('');
  return `<div class="card ddp-card">${head}<div class="ddp-rows">${rows}</div><p class="faint tiny" style="margin:8px 0 0">From the last logged session of each exercise (last 10 weeks). A set that reached the top of its range goes up about 2.5% (at least 5 lb); the others keep their load.</p></div>`;
}
