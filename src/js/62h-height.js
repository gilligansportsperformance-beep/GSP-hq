/* =========================================================
   Jump height in the session log (v1.32).
   • The countermovement jump logs a jump height for each set (inches, or cm in metric) instead
     of a load. So does any exercise set to "Jump height" in the library. Saved in the workout's
     log as { ht, reps, rpe } rows, with ht in cm like every length in the app.
   • Its prescription has no load: sets × reps only. The builder shows no intensity for it, and
     rows saved with a load before v1.32 don't show one.
   ========================================================= */
/* The countermovement jump by name (a loaded one keeps its load), unless the library says otherwise */
const HT_AUTO = /counter[\s-]?movement jump|\bcmjs?\b/i;
const HT_NOT = /weighted|loaded|trap ?bar|hex ?bar|barbell|dumbbell|\bdb\b|kettlebell|\bkb\b|vest/i;
function heightEx(ex) {
  if (!ex || fpTestOf(ex) || spTestOf(ex)) return false;
  if (ex.jumpHt === true) return true;
  if (ex.jumpHt === false || ex.timed === true || ex.timed === false) return false;
  return !ex.vbt && HT_AUTO.test(ex.name || '') && !HT_NOT.test(ex.name || '') && !timedEx(ex);
}
const htItem = it => !!it && heightEx(getExercise(it.exerciseId));
/* A prescription row for a jump-height exercise: sets × reps, no load, %1RM or reps-in-reserve */
const htRx = it => ({ ...it, intensity: 'bw', load: null, loads: null, pct: null, rir: null });
const HT_MAX_CM = 152.4;   // 60 in: anything higher is a typing slip
const htFmt = cm => fmtNum(U.lenOut(cm), 1, 0);
const htVals = rows => (rows || []).map(r => r?.ht).filter(x => Number.isFinite(x) && x > 0);
/* A typed height → { v: cm }, { bad }, or null when empty */
function htParse(raw) {
  const s = String(raw ?? '').trim();
  if (!s) return null;
  const x = num(s), cm = x == null ? null : U.lenIn(x);
  return cm == null || !(cm > 0) || cm > HT_MAX_CM ? { bad: true } : { v: cm };
}
/* "19.5 in × 5, 20 in × 5 · best 20 in" */
function htShort(rows) {
  const rs = (rows || []).filter(r => r && (Number.isFinite(r.ht) || r.reps != null));
  if (!rs.length) return '';
  const u = U.len(), hs = htVals(rs);
  const parts = rs.map(r => `${Number.isFinite(r.ht) ? `${htFmt(r.ht)} ${u}${r.reps != null ? ` × ${r.reps}` : ''}` : plural(r.reps, 'rep')}${r.rpe != null ? ` RPE ${fmtNum(r.rpe, 1, 0)}` : ''}`);
  return `${parts.join(', ')}${hs.length > 1 ? ` · best ${htFmt(Math.max(...hs))} ${u}` : ''}`;
}
/* The athlete's last logged heights of an exercise before this workout */
function htPrev(w, exId) {
  const prev = S.workouts.filter(o => o.athleteId === w.athleteId && o.id !== w.id && o.date <= w.date && o.log && (o.items || []).some(it => it.exerciseId === exId && htVals(o.log[it.id]).length))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || 0) - (b.createdAt || 0)).pop();
  if (!prev) return null;
  const hs = prev.items.filter(it => it.exerciseId === exId).flatMap(it => htVals(prev.log[it.id]));
  return { date: prev.date, hs, best: Math.max(...hs) };
}
function htLastText(w, exId) {
  const p = htPrev(w, exId);
  return p ? `<b>Last time</b> ${esc(fmtDate(p.date))}: ${esc(p.hs.map(htFmt).join(', '))} ${U.len()}${p.hs.length > 1 ? ` (best ${esc(htFmt(p.best))})` : ''}` : '';
}
/* Under the sets: the best and the average so far, and the change from last time's best */
function htSummary(w, it, rows) {
  const hs = htVals(rows), p = htPrev(w, it.exerciseId), u = U.len();
  if (!hs.length) return `<span class="faint">Type each set’s jump height in ${U.imp() ? 'inches' : 'cm'} (the best jump of the set if you measure every rep)${p ? ` · last time’s best ${esc(htFmt(p.best))} ${u}` : ''}.</span>`;
  const best = Math.max(...hs), diff = p ? U.lenOut(best) - U.lenOut(p.best) : null;
  const cls = diff == null || Math.abs(diff) < 0.05 ? 'flat' : diff > 0 ? 'good' : 'bad';
  const vs = diff == null ? '' : cls === 'flat' ? ' · <span class="delta flat">same as last time’s best</span>' : ` · <span class="delta ${cls}">${diff > 0 ? '▲' : '▼'} ${esc(fmtNum(Math.abs(diff), 1, 0))} ${u}</span> vs last time’s best`;
  return `Best <b>${esc(htFmt(best))} ${u}</b>${hs.length > 1 ? ` · avg ${esc(htFmt(mean(hs)))} ${u}` : ''}${vs}`;
}
function htError(w, log) {
  for (const it of w.items || []) {
    const ex = getExercise(it.exerciseId);
    if (!heightEx(ex)) continue;
    const i = (log[it.id] || []).findIndex(r => r?._htBad != null);
    if (i >= 0) return `${ex.name}: check set ${i + 1}’s jump height. Enter ${U.imp() ? 'inches, e.g. 18.5' : 'centimetres, e.g. 47'}.`;
  }
  return '';
}
