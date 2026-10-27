/* =========================================================
   Reps in reserve (RIR) ↔ bar velocity
   A rep's mean velocity shows roughly how many reps are left in the set. The velocities are
   similar whatever the load, but specific to each lift (Morán-Navarro et al. 2019).
   Back squat default = the coach's GSP reference chart. Other lifts are entered by the coach.
   Each athlete is personalised from their own logged sets (last-rep velocity + RPE).
   ========================================================= */
Object.assign(REFS, {
  moran2019: { cite: 'Morán-Navarro R, Martínez-Cava A, Sánchez-Medina L, Mora-Rodríguez R, González-Badillo JJ, Pallarés JG. Movement velocity as a measure of level of effort during resistance exercise. J Strength Cond Res. 2019;33(6):1496–1504.', what: 'Sets to failure at 65%, 75% and 85% 1RM: the velocity at which a given number of reps remained (RIR) was very similar whatever the load and training level (CV 4.4–8%), but differed between exercises.' },
  rodriguezrosell2020: { cite: 'Rodríguez-Rosell D, Yáñez-García JM, Sánchez-Medina L, Mora-Custodio R, González-Badillo JJ. Relationship between velocity loss and repetitions in reserve in the bench press and back squat exercises. J Strength Cond Res. 2020;34(9):2537–2547.', what: 'Velocity loss within a set closely tracks the reps left in reserve in the back squat and bench press.' },
  peerj2025: { cite: 'PeerJ. 2025 study (article 19797, published 15 August 2025) on lifting velocity and repetitions in reserve in the bench press and squat. https://peerj.com/articles/19797', what: 'The velocity–RIR relationship depends on the exercise and varies a lot between individuals, so individual adjustment is recommended.' },
});

const RIR_MAX = 5;
const RIR_LIFTS = ['squat', 'fsquat', 'bench', 'tbdl'];
/* Back squat: coach's GSP reference chart. rir[q] = [low, high] m/s of a rep with q reps left;
   pct = max-intent mean velocity of the first rep at each %1RM. */
const RIR_DEFAULT_TABLES = {
  squat: {
    rir: [[0.35, 0.40], [0.41, 0.46], [0.48, 0.52], [0.52, 0.59], [0.59, 0.65], [0.65, 0.68]],
    pct: [[35, 0.97], [40, 0.95], [45, 0.93], [50, 0.90], [55, 0.86], [60, 0.81], [65, 0.75], [70, 0.72], [75, 0.69], [80, 0.63], [85, 0.56], [90, 0.50], [95, 0.44], [100, 0.35]],
    source: 'GSP reference chart (back squat)',
  },
};
function rirTable(lift) {
  const own = S.settings.rirTables?.[lift];
  if (own?.rir?.length === RIR_MAX + 1) return { rir: own.rir, pct: own.pct?.length >= 2 ? own.pct : null, source: own.source || 'Coach-entered chart', custom: true };
  const d = RIR_DEFAULT_TABLES[lift];
  return d ? { ...d, custom: false } : null;
}

/* ---------- Chart maths ---------- */
const bandMid = b => (b[0] + b[1]) / 2;
function bandAt(bands, q) {
  q = clamp(q, 0, RIR_MAX);
  const i = Math.min(Math.floor(q), RIR_MAX - 1), f = q - i;
  return [bands[i][0] + (bands[i + 1][0] - bands[i][0]) * f, bands[i][1] + (bands[i + 1][1] - bands[i][1]) * f];
}
function rirVel(bands, q) { return bandMid(bandAt(bands, q)); }
/* Reps left after a rep at velocity v (continuous; 5 means "5 or more") */
function rirFromVel(bands, v) {
  const mids = bands.map(bandMid);
  if (v <= mids[0]) return 0;
  if (v >= mids[RIR_MAX]) return RIR_MAX;
  for (let i = 0; i < RIR_MAX; i++) if (v <= mids[i + 1]) return i + (v - mids[i]) / (mids[i + 1] - mids[i]);
  return RIR_MAX;
}
/* First-rep velocity at a %1RM from the chart (null outside it) */
function velAtPct(pct, pc) {
  if (!pct || pct.length < 2 || !(pc > 0)) return null;
  const s = [...pct].sort((a, b) => a[0] - b[0]);
  if (pc < s[0][0] - 2.5 || pc > 102) return null;
  if (pc <= s[0][0]) return s[0][1];
  if (pc >= s[s.length - 1][0]) return s[s.length - 1][1];
  for (let i = 0; i < s.length - 1; i++) if (pc <= s[i + 1][0]) return s[i][1] + (s[i + 1][1] - s[i][1]) * (pc - s[i][0]) / (s[i + 1][0] - s[i][0]);
  return null;
}
function clamp(x, lo, hi) { return Math.max(lo, Math.min(hi, x)); }

/* ---------- Athlete model: chart shifted by the athlete's own logged sets ---------- */
/* Each logged set with every rep's velocity and an RPE of 5–10 gives one point: last-rep velocity at RIR = 10 − RPE */
function rirPairs(aid, exId, days = 180) {
  const since = addDays(today(), -days), out = [];
  S.workouts.filter(w => w.athleteId === aid && w.log && w.date >= since).forEach(w => (w.items || []).filter(it => it.exerciseId === exId).forEach(it => (w.log[it.id] || []).forEach(r => {
    if (r.rpe == null || r.rpe < 10 - RIR_MAX || r.rpe > 10) return;
    const v = parseVels(r.vels);
    if (!v.length || (r.reps != null && v.length < r.reps)) return;
    out.push({ v: v[v.length - 1], rir: 10 - r.rpe, date: w.date, load: r.load });
  })));
  return out.sort(byKey('date')).slice(-20);
}
function rirModel(aid, exId) {
  const lift = e1rmLiftOf(getExercise(exId));
  const tab = lift ? rirTable(lift) : null;
  if (!tab) return null;
  const pairs = aid ? rirPairs(aid, exId) : [];
  const res = pairs.map(p => p.v - rirVel(tab.rir, p.rir));
  const off = res.length >= 3 ? mean(res) : null;
  const personal = off != null && Math.abs(off) <= 0.2;
  const shift = personal ? off : 0;
  return {
    lift, bands: tab.rir.map(b => [b[0] + shift, b[1] + shift]), chart: tab.rir, pct: tab.pct, source: tab.source, custom: tab.custom,
    personal, shift, n: pairs.length, spread: res.length >= 3 ? sd(res) : null, odd: off != null && !personal,
  };
}
/* Rep-1 velocity at a load: athlete's own load–velocity profile first, else the %1RM chart */
function firstRep(aid, exId, { kg = null, pc = null } = {}, model = null) {
  if (aid && kg > 0) {
    const logs = lvProfile(aid, exId, { from: addDays(today(), -84) }).logs.filter(velocityQualified);
    const pts = logs.map(l => ({ x: l.load, y: l.vBest }));
    if (new Set(pts.map(q => round(q.x, 1))).size >= 3) {
      const reg = linreg(pts);
      if (reg && reg.b < 0 && reg.r2 >= 0.8) { const v = reg.a + reg.b * kg; if (v > 0.05 && v < 2.5) return { v, source: 'profile' }; }
    }
  }
  if (!model?.pct) return null;
  if (pc == null && aid && kg > 0) { const orm = bestOneRM(aid, exId); if (orm?.kg > 0) pc = kg / orm.kg * 100; }
  const v = pc != null ? velAtPct(model.pct, pc) : null;
  return v != null ? { v, source: 'chart', pc } : null;
}

/* ---------- Planning a set: n reps leaving `rir` in reserve ----------
   Reps within 5 of the end follow the chart (velocity → reps left); earlier reps are
   interpolated from rep 1 (from the load) to the 5-RIR band. No rep is faster than rep 1. */
function repTargets(bands, n, rir, v1) {
  const out = [], v5 = rirVel(bands, RIR_MAX), k5 = n - RIR_MAX + rir;
  for (let k = 1; k <= n; k++) {
    const q = n - k + rir;
    let v = null;
    if (q <= RIR_MAX) { v = rirVel(bands, q); if (v1 != null && v1 < v) v = v1; }
    else if (v1 != null) v = v1 > v5 ? v1 + (v5 - v1) * (k - 1) / (k5 - 1) : v1;
    out.push({ k, q, v, band: q <= RIR_MAX ? bandAt(bands, q) : null });
  }
  return out;
}
function setPlan(model, n, rir, fr) {
  const out = { n, rir, fr, model, reps: null, avg: null, stop: null, notes: [] };
  if (!model || !(n >= 1) || rir == null) return out;
  const v1 = fr?.v ?? null;
  out.stop = bandAt(model.bands, rir);
  out.reps = repTargets(model.bands, n, rir, v1);
  out.avg = out.reps.every(r => r.v != null) ? mean(out.reps.map(r => r.v)) : null;
  if (v1 != null) {
    const q1 = n - 1 + rir;
    if (v1 <= out.stop[1]) out.notes.push(['bad', `Rep 1 at this load should read ≈${fmtNum(v1, 2)} m/s, already at the ${fmtNum(rir, 1, 0)}-RIR stop speed. The load is likely too heavy for ${n} reps.`]);
    else if (q1 <= RIR_MAX && v1 > bandAt(model.bands, q1)[1] + 0.03) out.notes.push(['info', `Load looks light for ${n} reps at ${fmtNum(rir, 1, 0)} RIR: rep 1 should be ≈${fmtNum(v1, 2)} m/s, faster than the ${fmtNum(q1, 1, 0)}-RIR band. Add load if rep 1 reads above ${fmtNum(bandAt(model.bands, q1)[1], 2)}.`]);
  }
  return out;
}
/* Target RIR for a programmed exercise: RIR intensity, RPE intensity (RIR = 10 − RPE) or an RIR stop */
function itemRir(it) {
  if (!it || it.intensity === 'bw') return null;
  if (it.intensity === 'rpe') return it.rpe >= 10 - RIR_MAX && it.rpe <= 10 ? 10 - it.rpe : null;
  return Number.isFinite(it.rir) && it.rir >= 0 && it.rir <= RIR_MAX ? it.rir : null;
}
function planReps(it) {
  const s = String(it.reps ?? ''), m = s.match(/(\d+)\s*(?:-|–|to)\s*(\d+)/);
  const n = m ? +m[2] : parseInt(s, 10);
  return n >= 1 && n <= 30 ? n : null;
}
/* Starting load for n reps at a target RIR: estimated 1RM × %1RM for (n + RIR) reps to failure (Epley/Brzycki mean) */
function rirLoad(aid, exId, n, rir) {
  if (!aid || !exId || !(n >= 1) || rir == null || n + rir > 15) return null;
  const orm = bestOneRM(aid, exId);
  return orm?.kg > 0 ? roundLoad(orm.kg * repsToPct(n + rir)) : null;
}
function rirPlan(aid, it, kg) {
  const rir = itemRir(it), n = planReps(it);
  if (rir == null || !n || !it.exerciseId) return null;
  const model = rirModel(aid, it.exerciseId);
  if (kg === undefined) kg = defaultLoad(it, aid);
  const pc = it.intensity === 'pct' && it.pct ? it.pct : null;
  return { ...setPlan(model, n, rir, model ? firstRep(aid, it.exerciseId, { kg, pc }, model) : null), kg };
}

/* ---------- Reading a logged set ---------- */
/* Each-rep entry: reps left after the last rep. Set-average entry: the RIR whose expected
   set average (from rep 1 at this load) matches the logged average. */
function rirOfSet(model, { vels = [], avg = null, reps = null, kg = null, aid = null, exId = null } = {}) {
  if (!model) return null;
  if (vels.length) {
    if (reps != null && vels.length < reps) return null;   // not every rep entered: the last value isn't the last rep
    const v = vels[vels.length - 1];
    return { rir: rirFromVel(model.bands, v), plus: v >= rirVel(model.bands, RIR_MAX), from: 'last', v };
  }
  if (!(avg > 0) || !(reps >= 1)) return null;
  const fr = firstRep(aid, exId, { kg }, model);
  if (!fr) return null;
  const avgAt = r => mean(repTargets(model.bands, reps, r, fr.v).map(x => x.v));
  if (avg < avgAt(0) - 0.02) return { rir: 0, from: 'avg', below: true };
  for (let r = 0; r <= 8; r += 0.25) if (avgAt(r) >= avg) return { rir: Math.min(r, RIR_MAX), plus: r >= RIR_MAX, from: 'avg' };
  return { rir: RIR_MAX, plus: true, from: 'avg' };
}
function rirSetFeedback(it, row, aid) {
  const model = it?.exerciseId ? rirModel(aid, it.exerciseId) : null;
  if (!model) return '';
  const vels = parseVels(row.vels);
  const est = rirOfSet(model, { vels, avg: row.avg, reps: row.reps, kg: row.load, aid, exId: it.exerciseId });
  if (!est) return '';
  const target = itemRir(it);
  const txt = est.below ? 'slower than the 0-RIR band' : `≈${est.plus ? '5+' : fmtNum(Math.round(est.rir), 0)} RIR`;
  let cls = '', note = '';
  if (target != null && !est.below) {
    const d = est.rir - target;
    if (est.plus && target >= RIR_MAX) cls = 'vl-ok';
    else if (Math.abs(d) <= 0.75) { cls = 'vl-ok'; note = 'on target'; }
    else if (d < 0) { cls = 'vl-warn'; note = 'closer to failure than planned'; }
    else { cls = 'vl-ok'; note = 'easier than planned, consider adding load'; }
  } else if (est.below) cls = 'vl-bad';
  let stopNote = '';
  if (target != null && vels.length > 1) {
    const stopHi = bandAt(model.bands, target)[1];
    const hit = vels.findIndex(v => v <= stopHi);
    if (hit >= 0 && hit < vels.length - 1) stopNote = ` · <b class="vl-warn">stop speed reached at rep ${hit + 1}</b>`;
  }
  return ` · <b class="${cls}">${txt}</b>${note ? ` <span class="faint">(${note})</span>` : ''}${est.from === 'avg' ? ' <span class="faint">est.</span>' : ''}${stopNote}`;
}

/* ---------- Display ---------- */
function rirBasis(model) {
  if (!model) return '';
  if (model.personal) return `${esc(model.source)}, personalised (${model.shift >= 0 ? '+' : '−'}${fmtNum(Math.abs(model.shift), 2)} m/s from ${model.n} logged sets)`;
  return `${esc(model.source)}${model.n ? ` · ${model.n}/3 logged sets to personalise` : ''}`;
}
function rirPlanHtml(plan, { compact = false } = {}) {
  if (!plan?.reps) return '';
  const unknown = plan.reps.some(r => r.v == null);
  const chips = plan.reps.map(r => {
    const last = r.k === plan.n;
    const val = r.v != null ? fmtNum(r.v, 2) : `>${fmtNum(plan.model.bands[RIR_MAX][1], 2)}`;
    return `<span class="rir-rep${last ? ' stop' : ''}" title="${r.q <= RIR_MAX ? `${fmtNum(r.q, 1, 0)} reps left after this rep · chart ${fmtNum(r.band[0], 2)}–${fmtNum(r.band[1], 2)} m/s` : `${fmtNum(r.q, 1, 0)} reps left`}"><i>R${r.k}</i>${val}</span>`;
  }).join('');
  return `<div class="rir-plan">
    <div class="rir-reps">${chips}</div>
    <div class="rir-sum">Stop when a rep reads <b>≤ ${fmtNum(plan.stop[1], 2)} m/s</b> (${fmtNum(plan.rir, 1, 0)} RIR band ${fmtNum(plan.stop[0], 2)}–${fmtNum(plan.stop[1], 2)})${plan.avg != null ? ` · set average ≈ <b>${fmtNum(plan.avg, 2)} m/s</b>` : unknown ? ' · <span class="faint">add a load or 1RM to estimate rep 1 and the set average</span>' : ''}</div>
    ${compact ? '' : `<div class="faint tiny">${rirBasis(plan.model)}${plan.fr ? ` · rep 1 from ${plan.fr.source === 'profile' ? 'athlete’s load–velocity profile' : `chart at ${fmtNum(plan.fr.pc, 0)}% 1RM`}` : ''}</div>`}
    ${plan.notes.map(([c, t]) => `<div class="rir-note ${c}">${esc(t)}</div>`).join('')}
  </div>`;
}

/* ---------- VBT page card: chart, planner, editor ---------- */
function rirCard() {
  const V = UI.vbt;
  V.rirLift ||= 'squat';
  const lift = V.rirLift, tab = rirTable(lift), ex = liftExercise(lift, V.rirAth || null);
  const aths = sortedAthletes().filter(a => !a.archived);
  const head = `<div class="card-head" style="flex-wrap:wrap"><h3>RIR ↔ bar speed</h3>
    ${sel('rirLift', RIR_LIFTS.map(k => [k, E1RM_LIFTS[k].label]), lift, 'data-change="rirLift" style="width:auto;min-height:34px;padding-top:5px;padding-bottom:5px" aria-label="Lift"')}</div>`;
  if (!tab) return `<div class="card">${head}<p class="muted small">No RIR chart for ${esc(E1RM_LIFTS[lift].label.toLowerCase())} yet. Velocities at each RIR are lift-specific, so this needs its own values (from your device’s guide or research).</p>
    <button class="btn sm primary" data-act="editRirTable" data-lift="${lift}">${icon('plus', 'sm')}Enter chart</button>${refLinks(['moran2019', 'peerj2025'])}</div>`;
  const model = V.rirAth && ex ? rirModel(V.rirAth, ex.id) : null;
  const rows = tab.rir.map((b, q) => `<tr><td><b>${q} RIR</b>${q === 0 ? ' <span class="faint small">(failure)</span>' : ''}</td><td class="n">${fmtNum(b[0], 2)}–${fmtNum(b[1], 2)}</td>${model?.personal ? `<td class="n"><b>${fmtNum(model.bands[q][0], 2)}–${fmtNum(model.bands[q][1], 2)}</b></td>` : ''}</tr>`).join('');
  return `<div class="card">${head}
    <p class="muted small" style="margin-top:0">The speed of a rep tells you how many reps are left. Stop the set when a rep drops into the band for your target RIR.</p>
    <div class="table-wrap"><table class="t"><thead><tr><th>Reps left</th><th class="n">Rep speed m/s</th>${model?.personal ? `<th class="n">${esc(getAthlete(V.rirAth).firstName)}</th>` : ''}</tr></thead><tbody>${rows}</tbody></table></div>
    ${tab.pct ? `<details class="group" style="margin-top:10px"><summary>First-rep speed by %1RM</summary><div class="group-body table-wrap"><table class="t"><thead><tr><th>%1RM</th><th class="n">m/s</th></tr></thead><tbody>${[...tab.pct].sort((a, b) => a[0] - b[0]).map(([p, v]) => `<tr><td>${p === 100 ? '1RM' : p + '%'}</td><td class="n">${fmtNum(v, 2)}</td></tr>`).join('')}</tbody></table></div></details>` : ''}
    <div class="kicker" style="margin-top:14px">Plan a set</div>
    <div class="fields three collapse rir-calc">
      ${field('Athlete', sel('rirAth', [['', 'Chart only'], ...aths.map(a => [a.id, athleteName(a)])], V.rirAth || '', 'data-change="rirAth"'))}
      ${field('Reps', `<input type="text" inputmode="numeric" id="rirN" value="${esc(V.rirN ?? 5)}" data-input="rirCalc">`)}
      ${field('Target', `<select id="rirQ" data-change="rirCalc">${[0, 1, 2, 3, 4, 5].map(q => `<option value="${q}" ${q === (V.rirQ ?? 2) ? 'selected' : ''}>${q} RIR</option>`).join('')}</select>`)}
      ${field('% 1RM', `<input type="text" inputmode="decimal" id="rirPc" value="${esc(V.rirPc ?? '')}" placeholder="optional" data-input="rirCalc">`, { unit: '%' })}
    </div>
    <div class="computed" id="rirOut" style="margin:0">${rirCalcHtml()}</div>
    <p class="faint tiny" style="margin:10px 0 0">Source: ${esc(tab.source)}${tab.custom ? ' (edited)' : ''}. Research finds these speeds are similar at any load but differ between lifts and between athletes. Log each rep’s speed plus RPE and the chart personalises itself after 3 sets.</p>
    <div class="chips" style="margin-top:10px"><button class="btn sm" data-act="editRirTable" data-lift="${lift}">${icon('edit', 'sm')}Edit chart</button></div>
    ${refLinks(['moran2019', 'rodriguezrosell2020', 'peerj2025'])}
  </div>`;
}
function rirCalcHtml() {
  const V = UI.vbt, lift = V.rirLift || 'squat', tab = rirTable(lift);
  if (!tab) return '';
  const n = Math.round(num(V.rirN ?? 5) || 0), q = +(V.rirQ ?? 2), pc = num(V.rirPc ?? '');
  if (!(n >= 1 && n <= 20)) return 'Enter 1–20 reps.';
  const ex = liftExercise(lift, V.rirAth || null);
  const aid = V.rirAth && ex ? V.rirAth : null;
  const model = aid ? rirModel(aid, ex.id) : { lift, bands: tab.rir, chart: tab.rir, pct: tab.pct, source: tab.source, custom: tab.custom, personal: false, shift: 0, n: 0 };
  const orm = aid ? bestOneRM(aid, ex.id) : null;
  const kg = aid ? (pc ? (orm ? roundLoad(orm.kg * pc / 100) : null) : rirLoad(aid, ex.id, n, q)) : null;
  const fr = firstRep(aid, ex?.id, { kg, pc: pc || (kg && orm ? kg / orm.kg * 100 : null) }, model);
  const plan = setPlan(model, n, q, fr);
  return `${kg ? `<div style="margin-bottom:6px">Load <b>${esc(fmtMass(kg))}</b> <span class="faint">(${pc ? `${fmtNum(pc, 0)}%` : `${n}+${q} reps to failure ≈ ${fmtNum(repsToPct(n + q) * 100, 0)}%`} of ${orm?.source === 'tested' ? 'tested' : 'est.'} 1RM ${esc(fmtMass(orm.kg))})</span></div>` : aid && !orm ? '<div class="faint small" style="margin-bottom:6px">No 1RM on file for this athlete, so rep 1 and the set average can’t be estimated yet.</div>' : ''}${rirPlanHtml(plan)}`;
}
A.rirLift = el => { UI.vbt.rirLift = el.value; refresh(); };
A.rirAth = el => { UI.vbt.rirAth = el.value; refresh(); };
A.rirCalc = () => {
  const V = UI.vbt;
  V.rirN = $('#rirN')?.value; V.rirQ = +($('#rirQ')?.value ?? 2); V.rirPc = $('#rirPc')?.value;
  const out = $('#rirOut'); if (out) out.innerHTML = rirCalcHtml();
};
A.editRirTable = el => {
  const lift = el.dataset.lift, cur = rirTable(lift), def = RIR_DEFAULT_TABLES[lift], sq = rirTable('squat');
  const pcts = [35, 40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95, 100];
  const pv = p => cur?.pct?.find(x => x[0] === p)?.[1] ?? '';
  openModal({
    title: `${E1RM_LIFTS[lift].label} RIR chart`, size: 'wide', submit: 'Save',
    body: `<p class="muted small" style="margin-top:0">Rep mean velocity (m/s) when that many reps are left in the set. Bands must get faster as RIR goes up. Use values from research or your device for <b>this lift</b>; each lift is different.</p>
      ${lift !== 'squat' && sq ? `<button type="button" class="btn sm" data-copy-sq>${icon('copy', 'sm')}Start from the back squat chart</button>` : ''}
      <div class="table-wrap" style="margin-top:10px"><table class="t prof-entry"><thead><tr><th>RIR</th><th>Low m/s</th><th>High m/s</th></tr></thead><tbody>
      ${[0, 1, 2, 3, 4, 5].map(q => `<tr><td><b>${q}</b></td><td><input type="text" inputmode="decimal" name="lo${q}" value="${cur ? cur.rir[q][0] : ''}"></td><td><input type="text" inputmode="decimal" name="hi${q}" value="${cur ? cur.rir[q][1] : ''}"></td></tr>`).join('')}</tbody></table></div>
      <details class="group" style="margin-top:12px"><summary>First-rep speed by %1RM (optional)</summary><div class="group-body"><p class="faint small">Used to estimate rep 1 when the athlete has no load–velocity profile yet. Leave blank if unknown.</p>
        <div class="table-wrap"><table class="t prof-entry"><thead><tr><th>%1RM</th><th>m/s</th></tr></thead><tbody>${pcts.map(p => `<tr><td>${p === 100 ? '1RM' : p + '%'}</td><td><input type="text" inputmode="decimal" name="p${p}" value="${pv(p)}"></td></tr>`).join('')}</tbody></table></div></div></details>
      ${field('Source', inp('source', cur?.source || '', 'placeholder="e.g. device guide, study, or your own testing" required'), { hint: 'Where these numbers come from, so you can trust them later.' })}`,
    onSubmit: v => {
      const rir = [];
      for (let q = 0; q <= RIR_MAX; q++) {
        const lo = num(v['lo' + q]), hi = num(v['hi' + q]);
        if (lo == null || hi == null) return `Enter both velocities for ${q} RIR.`;
        if (!(lo >= 0.05 && hi <= 2 && lo <= hi)) return `${q} RIR: velocities should be in m/s (0.05–2.00) with low ≤ high.`;
        rir.push([lo, hi]);
      }
      for (let q = 1; q <= RIR_MAX; q++) if (!(bandMid(rir[q]) > bandMid(rir[q - 1]))) return `The ${q}-RIR band must be faster than the ${q - 1}-RIR band.`;
      const pct = pcts.map(p => [p, num(v['p' + p])]).filter(x => x[1] != null);
      if (pct.some(x => !(x[1] >= 0.05 && x[1] <= 2.5))) return 'First-rep velocities should be in m/s (e.g. 0.75).';
      for (let i = 1; i < pct.length; i++) if (!(pct[i][1] < pct[i - 1][1])) return 'First-rep velocity must drop as %1RM goes up.';
      if (pct.length === 1) return 'Enter at least two %1RM velocities, or leave them all blank.';
      if (!v.source.trim()) return 'Add the source of these numbers.';
      S.settings.rirTables = { ...(S.settings.rirTables || {}), [lift]: { rir, pct: pct.length ? pct : null, source: v.source.trim().slice(0, 200) } };
      persist(); toast('RIR chart saved'); refresh();
    },
    onDelete: cur?.custom ? async () => {
      if (!(await confirmBox(def ? 'Reset to the GSP chart?' : 'Remove this chart?', def ? 'Your edits to this chart are removed.' : 'RIR targets will no longer show for this lift.'))) return false;
      const t = { ...(S.settings.rirTables || {}) }; delete t[lift]; S.settings.rirTables = t;
      persist(); toast(def ? 'Reset to GSP chart' : 'Chart removed'); refresh();
    } : null,
    deleteLabel: def ? 'Reset' : 'Remove',
    onMount: m => {
      $('[data-copy-sq]', m.wrap)?.addEventListener('click', () => {
        sq.rir.forEach((b, q) => { m.form['lo' + q].value = b[0]; m.form['hi' + q].value = b[1]; });
        (sq.pct || []).forEach(([p, x]) => { if (m.form['p' + p]) m.form['p' + p].value = x; });
        if (!m.form.source.value) m.form.source.value = `Back squat chart (${sq.source}); not yet checked for this lift`;
      });
    },
  });
};

/* ---------- Athlete VBT tab card ---------- */
function athRirCard(aid) {
  const rows = RIR_LIFTS.map(lift => {
    const ex = liftExercise(lift, aid);
    if (!ex || !rirTable(lift)) return '';
    const m = rirModel(aid, ex.id);
    return `<tr><td><b>${esc(E1RM_LIFTS[lift].label)}</b><div class="faint tiny">${m.personal ? `Personal: ${m.shift >= 0 ? '+' : '−'}${fmtNum(Math.abs(m.shift), 2)} m/s vs chart (${m.n} sets)` : m.odd ? 'Logged sets differ a lot from the chart. Check RPE and device.' : `Chart · ${m.n}/3 sets to personalise`}</div></td>
      ${[1, 2, 3].map(q => `<td class="n">${fmtNum(m.bands[q][1], 2)}</td>`).join('')}</tr>`;
  }).filter(Boolean);
  if (!rows.length) return '';
  return `<div class="card"><div class="card-head"><h3>RIR stop speeds</h3><span class="sub">stop when a rep is ≤</span></div>
    <div class="table-wrap"><table class="t"><thead><tr><th>Lift</th><th class="n">1 RIR</th><th class="n">2 RIR</th><th class="n">3 RIR</th></tr></thead><tbody>${rows.join('')}</tbody></table></div>
    <p class="faint tiny" style="margin:8px 0 0">m/s. Personalised from sets logged with each rep’s speed and an RPE (RIR = 10 − RPE). <a href="#/vbt">Charts & planner</a></p></div>`;
}
