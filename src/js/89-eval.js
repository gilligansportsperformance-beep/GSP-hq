/* =========================================================
   Estimated 1RM engine (back squat, front squat, bench press, trap bar deadlift)
   and the athlete Evaluation tab (force-plate profile quadrant)
   ========================================================= */
Object.assign(REFS, {
  lesuer1997: { cite: 'LeSuer DA, McCormick JH, Mayhew JL, Wasserstein RL, Arnold MD. The accuracy of prediction equations for estimating 1-RM performance in the bench press, squat, and deadlift. J Strength Cond Res. 1997;11(4):211–213.', what: 'Rep-based 1RM equations (e.g. Brzycki, Epley) are most accurate when sets are taken close to failure with ≤10 reps.' },
  brzycki1993: { cite: 'Brzycki M. Strength testing—predicting a one-rep max from reps-to-fatigue. J Phys Educ Recreat Dance. 1993;64(1):88–90.', what: 'Brzycki equation: 1RM = load × 36 ÷ (37 − reps).' },
  zourdos2016: { cite: 'Zourdos MC, Klemp A, Dolan C, et al. Novel resistance training–specific rating of perceived exertion scale measuring repetitions in reserve. J Strength Cond Res. 2016;30(1):267–275.', what: 'RPE as repetitions in reserve (RPE 10 = 0 RIR, 9 = 1 RIR…); ratings are most accurate close to failure.' },
  helms2016: { cite: 'Helms ER, Cronin J, Storey A, Zourdos MC. Application of the repetitions in reserve-based rating of perceived exertion scale for resistance training. Strength Cond J. 2016;38(4):42–49.', what: 'Using RIR-based RPE to estimate and autoregulate intensity relative to 1RM.' },
});

/* ---------- Lifts that get an estimated 1RM ---------- */
const E1RM_LIFTS = {
  squat: { label: 'Back squat', names: ['back squat'], mvt: 0.30, mvtNote: 'Group value ≈0.30 m/s (individual values vary ~0.2–0.4).' },
  fsquat: { label: 'Front squat', names: ['front squat'], mvt: 0.30, mvtNote: 'No direct published value; front and back squat share a similar load–velocity slope, so ≈0.30 m/s is used. Calibrate with a tested max.' },
  bench: { label: 'Bench press', names: ['bench press'], mvt: 0.17, mvtNote: 'Group value ≈0.15–0.20 m/s.' },
  tbdl: { label: 'Trap bar deadlift', names: ['trap bar deadlift'], mvt: 0.20, mvtNote: 'No reliable published group value — ≈0.20 m/s is a placeholder. Calibrate with a tested max or rely on the reps × RPE method.' },
};
function e1rmLiftOf(ex) {
  if (!ex) return null;
  if (ex.e1rmLift === 'none') return null;
  if (ex.e1rmLift && E1RM_LIFTS[ex.e1rmLift]) return ex.e1rmLift;
  const n = (ex.name || '').trim().toLowerCase();
  return Object.keys(E1RM_LIFTS).find(k => E1RM_LIFTS[k].names.includes(n)) || null;
}
function liftExercise(lift, aid) {
  const exs = S.exercises.filter(e => e1rmLiftOf(e) === lift);
  if (exs.length <= 1 || !aid) return exs[0] || null;
  return exs.sort((x, y) => S.vbt.filter(l => l.athleteId === aid && l.exerciseId === y.id).length - S.vbt.filter(l => l.athleteId === aid && l.exerciseId === x.id).length)[0];
}

/* ---------- Minimum velocity threshold: athlete-specific when possible ---------- */
function mvtFor(aid, exId) {
  const ex = getExercise(exId), lift = e1rmLiftOf(ex);
  if (!lift) return { mvt: null, source: null };
  const a = getAthlete(aid);
  const own = a?.mvt?.[exId];
  if (own > 0) return { mvt: own, source: 'athlete', note: 'Set manually for this athlete' };
  const maxes = S.maxes.filter(m => m.athleteId === aid && m.exerciseId === exId).sort(byKey('date'));
  const measured = [...maxes].reverse().find(m => m.v1rm > 0);
  if (measured) return { mvt: measured.v1rm, source: 'measured', note: `Velocity of the tested 1RM rep (${fmtDate(measured.date)})` };
  for (const m of [...maxes].reverse()) {
    const logs = S.vbt.filter(l => l.athleteId === aid && l.exerciseId === exId && l.load > 0 && l.vBest > 0 && velocityQualified(l) && Math.abs(daysBetween(l.date, m.date)) <= 42);
    const pts = logs.map(l => ({ x: l.load, y: l.vBest }));
    if (new Set(pts.map(p => round(p.x, 1))).size < 3) continue;
    const reg = linreg(pts);
    if (!reg || reg.b >= 0 || reg.r2 < 0.9) continue;
    const v = reg.a + reg.b * m.kg;
    if (v >= 0.08 && v <= 0.55) return { mvt: v, source: 'calibrated', note: `Calibrated from the tested ${fmtMass(m.kg)} max on ${fmtDate(m.date)}` };
  }
  if (ex.mvt > 0) return { mvt: ex.mvt, source: 'library', note: 'From the exercise library' };
  return { mvt: E1RM_LIFTS[lift].mvt, source: 'default', note: E1RM_LIFTS[lift].mvtNote };
}
/* Set averages over 3+ reps under-state the fastest rep, which biases the estimate low — exclude them */
function velocityQualified(l) { return l.entry !== 'avg' || (l.n || 1) <= 2; }

/* ---------- Method 1: load–velocity profile ---------- */
function velocityE1rm(aid, exId, logs) {
  const ex = getExercise(exId), lift = e1rmLiftOf(ex);
  if (!lift) return { lift: null, mvt: null };
  const m = mvtFor(aid, exId);
  const q = logs.filter(velocityQualified);
  const pts = q.map(l => ({ x: l.load, y: l.vBest }));
  const loadsN = new Set(pts.map(p => round(p.x, 1))).size;
  const out = { lift, mvt: m.mvt, mvtSource: m.source, mvtNote: m.note, n: pts.length, loadsN, excluded: logs.length - q.length, e1rm: null, quality: null };
  if (loadsN < 3) return out;
  const reg = linreg(pts);
  if (!reg || reg.b >= 0) return out;
  const e = (m.mvt - reg.a) / reg.b;
  const maxLoad = Math.max(...pts.map(p => p.x)), minLoad = Math.min(...pts.map(p => p.x));
  if (!(Number.isFinite(e) && e > maxLoad * 0.95 && e < maxLoad * 2)) return out;
  const vHeavy = Math.min(...pts.map(p => p.y));
  const nearHeavy = vHeavy - m.mvt <= 0.35;
  const spread = (maxLoad - minLoad) / e;
  const conf = loadsN >= 4 && reg.r2 >= 0.95 && nearHeavy && spread >= 0.3 ? 'high' : reg.r2 >= 0.9 && loadsN >= 3 && spread >= 0.2 ? 'moderate' : 'low';
  const issues = [];
  if (loadsN < 4) issues.push('add a 4th load');
  if (reg.r2 < 0.95) issues.push(`fit R² ${fmtNum(reg.r2, 2)} (aim ≥0.95)`);
  if (!nearHeavy) issues.push('no heavy set yet (bar speed ≤ ~0.6 m/s squat / ~0.5 m/s bench)');
  if (spread < 0.3) issues.push('loads too close together (spread them ~40–90% 1RM)');
  if (m.source === 'default') issues.push('using a group velocity threshold — log a tested max to calibrate');
  Object.assign(out, { e1rm: e, reg, quality: { conf, r2: reg.r2, nearHeavy, spread, issues } });
  return out;
}

/* ---------- Method 2: reps × RPE (repetitions in reserve) ---------- */
function repsToPct(total) { return total <= 1 ? 1 : 1 / mean([1 + total / 30, 36 / (37 - total)]); }
function rirE1rm(aid, exId, since) {
  const cands = [];
  S.workouts.filter(w => w.athleteId === aid && w.log && w.date >= since).forEach(w => {
    (w.items || []).filter(it => it.exerciseId === exId).forEach(it => (w.log[it.id] || []).forEach(r => {
      if (!(r.load > 0) || !(r.reps >= 1) || r.rpe == null || r.rpe < 7 || r.rpe > 10) return;
      const total = r.reps + (10 - r.rpe);
      if (total > 10) return;
      cands.push({ kg: r.load / repsToPct(total), load: r.load, reps: r.reps, rpe: r.rpe, total, date: w.date });
    }));
  });
  if (!cands.length) return null;
  cands.sort((a, b) => a.total - b.total || b.kg - a.kg);
  const best = cands[0];
  const conf = best.total <= 5 && best.rpe >= 8 ? 'high' : 'moderate';
  return { ...best, conf, n: cands.length };
}

/* ---------- Combined estimate ---------- */
function e1rmFor(aid, exId) {
  const ex = getExercise(exId);
  const lift = e1rmLiftOf(ex);
  const tested = S.maxes.filter(m => m.athleteId === aid && m.exerciseId === exId).sort(byKey('date')).pop() || null;
  if (!lift) return tested ? { kg: tested.kg, source: 'tested', conf: 'tested', date: tested.date, tested } : null;
  const since = addDays(today(), -42);
  const prof = lvProfile(aid, exId, { from: since });
  const lastLog = prof.logs.map(l => l.date).sort().pop() || null;
  const vel = prof.e1rm ? { kg: prof.e1rm, conf: prof.quality.conf, date: lastLog } : null;
  const rir = rirE1rm(aid, exId, since);
  const usable = [vel, rir].filter(p => p && p.conf !== 'low');
  const w = p => (p.conf === 'high' ? 2 : 1);
  const testedAge = tested ? daysBetween(tested.date, today()) : null;
  let kg = null, source = null, conf = null, date = null;
  if (tested && testedAge <= 28) { kg = tested.kg; source = 'tested'; conf = 'tested'; date = tested.date; }
  else if (usable.length) {
    kg = usable.reduce((s, p) => s + p.kg * w(p), 0) / usable.reduce((s, p) => s + w(p), 0);
    source = usable.length > 1 ? 'combined' : usable[0] === vel ? 'velocity' : 'reps';
    conf = usable.some(p => p.conf === 'high') ? 'high' : 'moderate';
    date = [vel?.date, rir?.date].filter(Boolean).sort().pop();
  } else if (tested) { kg = tested.kg; source = 'tested'; conf = 'tested'; date = tested.date; }
  else if (vel || rir) { const p = vel || rir; kg = p.kg; source = p === vel ? 'velocity' : 'reps'; conf = 'low'; date = p.date; }
  if (kg == null) return null;
  const disagree = vel && rir ? Math.abs(vel.kg - rir.kg) / mean([vel.kg, rir.kg]) * 100 : null;
  return { kg, source, conf, date, lift, vel, rir, tested, testedAge, prof, disagree };
}
const CONF_LABEL = { high: ['good', 'High confidence'], moderate: ['info', 'Moderate confidence'], low: ['warn', 'Low confidence'], tested: ['good', 'Tested'] };
const SOURCE_LABEL = { tested: 'Tested 1RM', velocity: 'Load–velocity profile', reps: 'Reps × RPE', combined: 'Velocity + reps × RPE' };

function e1rmCard(aid) {
  const rows = Object.keys(E1RM_LIFTS).map(lift => {
    const ex = liftExercise(lift, aid);
    if (!ex) return `<div class="e1-row"><div class="e1-lift">${esc(E1RM_LIFTS[lift].label)}</div><div class="muted small">Not in your exercise library.</div></div>`;
    const r = e1rmFor(aid, ex.id);
    const m = mvtFor(aid, ex.id);
    const [cc, cl] = r ? CONF_LABEL[r.conf] : ['', ''];
    return `<div class="e1-row">
      <div class="split" style="align-items:flex-start;gap:10px"><div><div class="e1-lift">${esc(E1RM_LIFTS[lift].label)}</div>
        <div class="e1-val">${r ? esc(fmtMass(roundLoad(r.kg))) : '<span class="faint">—</span>'}</div>
        ${r ? `<div class="chips" style="gap:6px;margin-top:2px"><span class="badge ${cc}">${cl}</span><span class="faint tiny">${esc(SOURCE_LABEL[r.source])}${r.date ? ' · ' + esc(fmtDate(r.date)) : ''}</span></div>` : '<div class="faint small">Log sets with velocity or RPE, or a tested max.</div>'}</div>
        <div class="chips" style="justify-content:flex-end"><button class="btn sm" data-act="e1Profile" data-a="${aid}" data-ex="${ex.id}">${icon('gauge', 'sm')}Profile test</button></div></div>
      ${r ? `<details class="e1-detail"><summary>How this was calculated</summary><div class="small prose">
        ${r.tested ? `<p><b>Tested:</b> ${esc(fmtMass(r.tested.kg))} on ${esc(fmtDate(r.tested.date))} (${r.testedAge} days ago)${r.source === 'tested' && r.testedAge <= 28 ? ' — used directly because it’s recent.' : '.'}</p>` : ''}
        ${r.vel ? `<p><b>Velocity method:</b> ${esc(fmtMass(r.vel.kg))} · ${esc(CONF_LABEL[r.vel.conf][1].toLowerCase())} · ${r.prof.loadsN} loads, R² ${fmtNum(r.prof.quality.r2, 2)} (last 6 weeks)${r.prof.excluded ? ` · ${r.prof.excluded} set-average set(s) of 3+ reps excluded` : ''}.${r.prof.quality.issues.length ? ` To improve: ${esc(r.prof.quality.issues.join('; '))}.` : ''}</p>` : `<p><b>Velocity method:</b> needs sets at 3+ different loads (fastest rep, or set average of 1–2 reps) in the last 6 weeks.</p>`}
        <p><b>Velocity threshold used:</b> ${fmtNum(m.mvt, 2)} m/s — ${esc(m.note)}. <button class="link" data-act="e1Mvt" data-a="${aid}" data-ex="${ex.id}">Set athlete’s own</button></p>
        ${r.rir ? `<p><b>Reps × RPE method:</b> ${esc(fmtMass(r.rir.kg))} from ${esc(fmtMass(r.rir.load))} × ${r.rir.reps} @ RPE ${fmtNum(r.rir.rpe, 1, 0)} on ${esc(fmtDate(r.rir.date))} (${r.rir.reps + (10 - r.rir.rpe)} reps to failure) · ${esc(CONF_LABEL[r.rir.conf][1].toLowerCase())}.</p>` : '<p><b>Reps × RPE method:</b> needs a logged set with load, reps and RPE ≥7 (≤10 reps to failure) in the last 6 weeks.</p>'}
        ${r.disagree != null && r.disagree > 8 ? `<p style="color:var(--warn)"><b>The two methods differ by ${fmtNum(r.disagree, 0)}%.</b> Check the velocity threshold, device placement, or RPE ratings — or confirm with a tested max.</p>` : r.disagree != null ? `<p style="color:var(--good)"><b>Methods agree within ${fmtNum(r.disagree, 0)}%.</b></p>` : ''}
        ${refLinks(['jidovtseff2011', 'banyard2017', 'lesuer1997', 'zourdos2016', 'helms2016'])}
      </div></details>` : ''}
    </div>`;
  }).join('');
  return `<div class="card"><div class="card-head"><h3>Estimated 1RM</h3><button class="btn sm" data-act="newMax" data-athlete="${aid}">${icon('plus', 'sm')}Tested max</button></div>${rows}
    <p class="faint tiny" style="margin:10px 0 0">Calculated only from your data: load–velocity profiles and reps × RPE from the last 6 weeks, plus tested maxes. A tested max from the last 4 weeks is used as-is.</p></div>`;
}
A.e1Mvt = el => {
  const a = getAthlete(el.dataset.a), ex = getExercise(el.dataset.ex);
  const cur = a.mvt?.[ex.id] ?? '';
  const auto = (() => { const s = { ...a.mvt }; delete s[ex.id]; const tmp = { ...a, mvt: s }; const i = S.athletes.indexOf(a); S.athletes[i] = tmp; const r = mvtFor(a.id, ex.id); S.athletes[i] = a; return r; })();
  openModal({
    title: `${ex.name} velocity threshold`, size: 'narrow', center: true,
    body: `<p class="muted small">The mean velocity of ${esc(a.firstName)}’s true 1RM rep on this lift, measured with your VBT device. Leave blank to use: <b>${fmtNum(auto.mvt, 2)} m/s</b> (${esc(auto.note)}).</p>${field('Athlete MVT', numInp('mvt', cur, 'autofocus'), { unit: 'm/s' })}`,
    onSubmit: v => {
      const x = num(v.mvt);
      if (v.mvt.trim() && !(x > 0.05 && x < 0.7)) return 'Enter a velocity between 0.05 and 0.70 m/s.';
      const mvt = { ...(a.mvt || {}) };
      if (x) mvt[ex.id] = x; else delete mvt[ex.id];
      upsert('athletes', { ...a, mvt }); toast('Saved'); refresh();
    },
  });
};
A.e1Profile = el => {
  const a = getAthlete(el.dataset.a), ex = getExercise(el.dataset.ex);
  const rows = [0, 1, 2, 3, 4, 5];
  openModal({
    title: `1RM profile test — ${ex.name}`, size: 'wide', submit: 'Save',
    body: `<p class="muted small">Warm up, then do 1–2 reps with maximal intent at 4–6 increasing loads (≈40% → 85–90% 1RM). Enter the load and the <b>fastest rep’s mean velocity</b> for each. Rest 2–3 min between heavier loads.</p>
      ${field('Date', inp('date', today(), 'type="date"'))}
      <div class="table-wrap"><table class="t prof-entry"><thead><tr><th>#</th><th>Load (${U.mass()})</th><th>Fastest rep m/s</th></tr></thead><tbody>
      ${rows.map(i => `<tr><td>${i + 1}</td><td><input type="text" inputmode="decimal" data-pl="${i}"></td><td><input type="text" inputmode="decimal" data-pv="${i}"></td></tr>`).join('')}</tbody></table></div>
      <div class="computed" id="profOut" style="margin-top:12px">Enter at least 3 loads.</div>`,
    onSubmit: (v, form, m) => {
      const pts = read(m);
      if (pts.length < 3) return 'Enter at least 3 different loads with velocities.';
      if (pts.some(p => p.v > 2.5)) return 'Velocities should be in m/s (e.g. 0.65).';
      if (!isDS(v.date)) return 'Choose a date.';
      pts.forEach(p => upsert('vbt', { athleteId: a.id, exerciseId: ex.id, date: v.date, load: p.kg, reps: [p.v], n: 1, vBest: p.v, vMean: p.v, vl: null, peak: null, notes: '1RM profile test', entry: 'profile' }));
      toast('Profile saved'); refresh();
    },
    onMount: m => {
      const upd = () => {
        const pts = read(m);
        const out = $('#profOut', m.wrap);
        if (pts.length < 3) { out.textContent = 'Enter at least 3 loads.'; return; }
        const fake = pts.map((p, i) => ({ id: 'p' + i, load: p.kg, vBest: p.v, entry: 'profile', n: 1, date: today() }));
        const r = velocityE1rm(a.id, ex.id, fake);
        out.innerHTML = r.e1rm ? `Estimated 1RM <b>${esc(fmtMass(roundLoad(r.e1rm)))}</b> · R² <b>${fmtNum(r.quality.r2, 3)}</b> · <span class="badge ${CONF_LABEL[r.quality.conf][0]}">${CONF_LABEL[r.quality.conf][1]}</span><br><span class="faint">Threshold ${fmtNum(r.mvt, 2)} m/s (${esc(r.mvtNote)})${r.quality.issues.length ? ' · ' + esc(r.quality.issues.join('; ')) : ''}</span>` : 'Velocities must fall as load rises, with loads spread out — check the numbers.';
      };
      m.wrap.addEventListener('input', upd);
    },
  });
  function read(m) { return rows.map(i => ({ kg: num($(`[data-pl="${i}"]`, m.wrap).value), v: num($(`[data-pv="${i}"]`, m.wrap).value) })).filter(p => p.kg > 0 && p.v > 0).map(p => ({ kg: U.massIn(p.kg), v: p.v })); }
};

/* =========================================================
   Force-plate profile: Elastic / Strength / Eccentric / Concentric
   Axes use two published, device-independent ratios:
   - DSI = CMJ peak propulsive force ÷ IMTP peak force (Sheppard 2011): >0.80 elastic/ballistic-dominant, <0.60 strength-dominant
   - EUR = CMJ height ÷ SJ height (McGuigan 2006): >1.20 eccentric/SSC-dominant, <1.00 concentric-dominant
   ========================================================= */
const PROFILES = {
  elastic: { label: 'Elastic', color: '#2f9e8f', what: 'Expresses most of their available strength quickly (high DSI). Speed and stiffness are strengths; the force ceiling is the limiter.', train: 'Raise the ceiling: maximal strength (≈80–90% 1RM, 2–5 reps), heavy isometrics, eccentric strength. Keep plyometric and sprint exposure.', refs: ['sheppard2011', 'comfort2018', 'suchomel2016'] },
  strength: { label: 'Strength', color: '#C8A96E', what: 'Has a large strength reserve but can’t express it quickly (low DSI). Force is there; rate and elasticity are the limiters.', train: 'Express it faster: loaded jumps (≈20–40% 1RM), Olympic-lift derivatives, ballistic throws, plyometrics and reactive (low-contact-time) work. Maintain heavy strength.', refs: ['sheppard2011', 'comfort2018'] },
  eccentric: { label: 'Eccentric', color: '#8b4ef3', what: 'Gains a lot from the countermovement (high EUR) — the eccentric/stretch-shortening contribution is strong relative to pure concentric force.', train: 'Build concentric power from a dead start: squat jumps with no dip, pause and pin squats, concentric-only jumps and pulls, starts from static positions.', refs: ['mcguigan2006', 'mcmahon2018'] },
  concentric: { label: 'Concentric', color: '#2f5bff', what: 'Jumps nearly as high without a countermovement (low EUR) — little benefit from the eccentric/stretch-shortening action.', train: 'Develop eccentric and SSC qualities: snap-downs and drop landings, accentuated-eccentric jumps, fast eccentric squats, countermovement and depth jumps.', refs: ['mcguigan2006', 'flanagan2008', 'mcmahon2018'] },
  balanced: { label: 'Balanced', color: '#7a8496', what: 'DSI and EUR are both in the typical range — no single quality is clearly limiting.', train: 'Concurrent approach: heavy strength plus ballistic and plyometric work; re-evaluate every block.', refs: ['sheppard2011', 'mcguigan2006'] },
};
function profileFromTest(t, allTests) {
  const m = testMetrics(t);
  let cmj = m.cmj, sj = m.sj, cmjPF = m.cmjPF, imtp = m.imtpPF, isoOk = !t.isoType || t.isoType === 'IMTP' || t.isoType === 'ISQ', isoDate = t.date;
  if ((imtp == null || !isoOk) && allTests) {
    const near = allTests.filter(x => x.m?.imtpPF > 0 && (!x.isoType || x.isoType === 'IMTP' || x.isoType === 'ISQ') && Math.abs(daysBetween(x.date, t.date)) <= 7).sort((a, b) => Math.abs(daysBetween(a.date, t.date)) - Math.abs(daysBetween(b.date, t.date)))[0];
    if (near) { imtp = near.m.imtpPF; isoOk = true; isoDate = near.date; }
  }
  if (!(cmj > 0 && sj > 0 && cmjPF > 0 && imtp > 0 && isoOk)) return null;
  const dsi = cmjPF / imtp, eur = cmj / sj;
  const y = Math.max(-2.5, Math.min(2.5, (dsi - 0.70) / 0.10));   // + elastic, − strength
  const x = Math.max(-2.5, Math.min(2.5, (1.10 - eur) / 0.10));   // + concentric, − eccentric
  const axisY = y >= 0 ? 'elastic' : 'strength', axisX = x >= 0 ? 'concentric' : 'eccentric';
  let primary, secondary = null;
  if (Math.max(Math.abs(x), Math.abs(y)) < 0.5) primary = 'balanced';
  else if (Math.abs(y) >= Math.abs(x)) { primary = axisY; if (Math.abs(x) >= 0.5) secondary = axisX; }
  else { primary = axisX; if (Math.abs(y) >= 0.5) secondary = axisY; }
  const strength = v => (Math.abs(v) >= 1 ? 'clear' : Math.abs(v) >= 0.5 ? 'leaning' : 'typical');
  return { date: t.date, isoDate, testId: t.id, dsi, eur, x, y, primary, secondary, yLevel: strength(y), xLevel: strength(x), cmj, sj, cmjPF, imtp, trials: t.trials || null };
}
function athleteProfiles(aid) {
  const tests = testsFor(aid);
  return tests.map(t => profileFromTest(t, tests)).filter(Boolean);
}
function quadrantSvg(points, size = 320) {
  const c = size / 2, u = (size / 2 - 18) / 2.5;
  const P = p => [c + p.x * u, c - p.y * u];
  const tri = (pts, col) => `<polygon points="${pts.map(q => q.join(',')).join(' ')}" fill="${col}" fill-opacity=".10"/>`;
  const e = size - 0, s0 = 0;
  let svg = `<svg viewBox="0 0 ${size} ${size}" class="quad" role="img" aria-label="Athlete profile quadrant">`;
  svg += tri([[s0, s0], [e, s0], [c, c]], PROFILES.elastic.color) + tri([[s0, e], [e, e], [c, c]], PROFILES.strength.color) + tri([[s0, s0], [s0, e], [c, c]], PROFILES.eccentric.color) + tri([[e, s0], [e, e], [c, c]], PROFILES.concentric.color);
  svg += `<line x1="0" y1="0" x2="${size}" y2="${size}" class="q-diag"/><line x1="${size}" y1="0" x2="0" y2="${size}" class="q-diag"/>`;
  svg += `<line x1="${c}" y1="8" x2="${c}" y2="${size - 8}" class="q-axis"/><line x1="8" y1="${c}" x2="${size - 8}" y2="${c}" class="q-axis"/>`;
  svg += `<rect x="${c - u}" y="${c - u}" width="${2 * u}" height="${2 * u}" class="q-thr"/>`;
  svg += `<circle cx="${c}" cy="${c}" r="${0.5 * u}" class="q-bal"/>`;
  const lab = (x, y, t, col, anchor = 'middle') => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="q-lab" style="fill:${col}">${t}</text>`;
  svg += lab(c, 26, 'ELASTIC', PROFILES.elastic.color) + lab(c, size - 14, 'STRENGTH', PROFILES.strength.color) + lab(14, c - 8, 'ECCENTRIC', PROFILES.eccentric.color, 'start') + lab(size - 14, c - 8, 'CONCENTRIC', PROFILES.concentric.color, 'end');
  svg += `<text x="${c + u + 4}" y="${c - u - 4}" class="q-tick">DSI 0.80 · EUR 1.00</text>`;
  if (points.length > 1) svg += `<polyline points="${points.map(p => P(p).join(',')).join(' ')}" class="q-trail"/>`;
  points.forEach((p, i) => {
    const [x, y] = P(p), last = i === points.length - 1;
    svg += `<circle cx="${x}" cy="${y}" r="${last ? 9 : 5}" class="${last ? 'q-dot' : 'q-old'}"/>`;
    svg += `<circle cx="${x}" cy="${y}" r="14" class="hit" data-tip="${esc(`${fmtDate(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}: DSI ${fmtNum(p.dsi, 2)} · EUR ${fmtNum(p.eur, 2)} · ${PROFILES[p.primary].label}`)}"/>`;
  });
  return svg + '</svg>';
}

/* ---------- Evaluation tab ---------- */
function athEvaluation(a) {
  const profiles = athleteProfiles(a.id);
  const last = profiles[profiles.length - 1];
  const tests = testsFor(a.id);
  const latestAny = tests[tests.length - 1];
  const lm = latestAny ? testMetrics(latestAny) : {};
  const need = [['cmj', 'CMJ jump height'], ['cmjPF', 'CMJ peak propulsive force'], ['sj', 'Squat jump height'], ['imtpPF', 'IMTP peak force']];
  const missing = need.filter(([k]) => !tests.slice(-3).some(t => testMetrics(t)[k] != null));
  const P = last ? PROFILES[last.primary] : null;
  const quality = last?.trials ? trialQuality(last.trials) : [];
  const supp = last ? (() => { const t = tests.find(x => x.id === last.testId), m = testMetrics(t); return [['djRsi', 'Drop jump RSI'], ['rsiMod', 'mRSI'], ['ttt', 'Time to takeoff'], ['brakeRfd', 'Braking RFD'], ['relBrakeF', 'Rel. braking force'], ['relPropF', 'Rel. propulsive force'], ['imtpRel', 'Rel. IMTP force'], ['brakeAsym', 'Braking asymmetry'], ['propAsym', 'Propulsive asymmetry']].filter(([k]) => m[k] != null).map(([k, l]) => `<div class="tile"><div class="t-name">${l}</div><div class="t-val">${esc(fmtMetric(M[k], m[k], false))} <small>${esc(metricUnit(M[k]) || '')}</small></div></div>`).join(''); })() : '';
  const body = `
    <div class="grid two">
      <div class="col">
        ${screenCard(a)}
        ${speedCard(a)}
        <div class="card"><div class="card-head"><h3>Athlete profile</h3>${last ? `<span class="sub">${esc(fmtDateFull(last.date))}</span>` : ''}</div>
          ${last ? `<div class="quad-wrap">${quadrantSvg(profiles.slice(-6))}</div>
            <div class="prof-result" style="--pc:${P.color}"><div class="prof-name">${esc(P.label)}${last.secondary ? ` <span>with ${esc(PROFILES[last.secondary].label.toLowerCase())} tendency</span>` : ''}</div>
              <div class="prof-nums"><span>DSI <b>${fmtNum(last.dsi, 2)}</b> <em>${esc(last.yLevel === 'typical' ? 'typical (0.60–0.80)' : `${last.yLevel} ${last.y > 0 ? 'elastic' : 'strength'}`)}</em></span><span>EUR <b>${fmtNum(last.eur, 2)}</b> <em>${esc(last.xLevel === 'typical' ? 'typical (1.00–1.20)' : `${last.xLevel} ${last.x > 0 ? 'concentric' : 'eccentric'}`)}</em></span></div>
              <p class="muted small" style="margin:8px 0 0">${esc(P.what)}</p>
              <div class="in-action" style="margin-top:10px"><b>Training priority:</b> ${esc(P.train)}${last.secondary ? `<br><b>Also:</b> ${esc(PROFILES[last.secondary].train)}` : ''}</div>
              ${refLinks(P.refs)}</div>
            ${quality.length ? `<div class="banner warn" style="margin:12px 0 0">${icon('alert')}<div class="grow small">${quality.map(esc).join('<br>')}</div></div>` : ''}
            ${last.isoDate !== last.date ? `<p class="faint small" style="margin:8px 0 0">IMTP from ${esc(fmtDate(last.isoDate))} paired with jumps from ${esc(fmtDate(last.date))} (within 7 days).</p>` : ''}` :
          emptyState_('target', 'No profile yet', `The profile needs four results from the same evaluation (IMTP may be within 7 days): ${need.map(n => n[1]).join(', ')}.${missing.length ? ` Missing recently: <b>${missing.map(n => esc(n[1])).join(', ')}</b>.` : ''}`, `<button class="btn primary" data-act="newEval" data-a="${a.id}">${icon('plus', 'sm')}New evaluation</button>`)}
        </div>
        ${supp ? `<div class="card"><div class="card-head"><h3>Supporting force-plate data</h3><span class="sub">same evaluation</span></div><div class="tiles">${supp}</div></div>` : ''}
        ${singleLegCard(a)}
        <div class="card prose small"><b>How the profile works.</b> Two published, device-independent ratios place the athlete:
          <ul><li><b>Elastic ↔ Strength</b> — Dynamic Strength Index = CMJ peak propulsive force ÷ IMTP peak force. Above 0.80 the athlete already expresses most of their strength ballistically (elastic); below 0.60 they have strength they can’t yet express quickly (strength).</li>
          <li><b>Eccentric ↔ Concentric</b> — Eccentric Utilisation Ratio = CMJ height ÷ squat-jump height. Above ~1.20 the countermovement adds a lot (eccentric); below 1.00 it adds little (concentric). Typical range 1.0–1.2.</li></ul>
          The dot sits in the region of whichever quality deviates most from typical; inside the centre circle is <b>Balanced</b>. The dashed square marks the published thresholds. Ratios come from the same session, so device and body-mass differences cancel out. Previous evaluations show as a trail.
          ${refLinks(['sheppard2011', 'comfort2018', 'mcguigan2006'])}</div>
      </div>
      <div class="col">
        <div class="card"><div class="card-head"><h3>Evaluation history</h3><button class="btn sm primary" data-act="newEval" data-a="${a.id}">${icon('plus', 'sm')}New evaluation</button></div>
          ${evalHistory(a, profiles)}
        </div>
        ${athPctCard(a)}
        ${e1rmCard(a.id)}
      </div>
    </div>`;
  return { body, actions: `<button class="btn primary" data-act="newEval" data-a="${a.id}">${icon('plus', 'sm')}<span class="lbl">New evaluation</span></button>` };
}
function trialQuality(tr) {
  const out = [];
  const cv = arr => { const v = arr.filter(x => x > 0); return v.length >= 2 ? sd(v) / mean(v) * 100 : null; };
  [['cmj', 'CMJ height', 5], ['sj', 'Squat jump height', 5], ['cmjPF', 'CMJ peak propulsive force', 5]].forEach(([k, l, lim]) => { const c = tr[k] && cv(tr[k]); if (c != null && c > lim) out.push(`${l}: trials vary ${fmtNum(c, 1)}% (aim ≤${lim}%) — consider extra trials.`); });
  if (tr.imtpPF) { const v = tr.imtpPF.filter(x => x > 0); if (v.length >= 2 && Math.max(...v) - Math.min(...v) > 250) out.push(`IMTP: trials differ by ${fmtNum(Math.max(...v) - Math.min(...v), 0)} N (>250 N) — perform another trial (Comfort et al. 2019).`); }
  return out;
}

/* ---------- Evaluation entry form (the data points the profile needs) ---------- */
/* ---------- Evaluation entry ----------
   Force plate: the most informative metrics are shown by default; the rest can be added
   (and stay in the form until removed). Single-leg isometrics left/right, movement screen 1–5 + notes. */
const EVAL_CORE = { cmj: ['rsiMod', 'ttt', 'brakeRfd', 'cmDepth', 'brakeAsym', 'propAsym'], iso: ['imtpF100'], dj: ['djRsi', 'djGct'] };
const EVAL_MORE = { cmj: ['takeoffVel', 'brakeTime', 'peakBrakeF', 'brakeImp', 'propTime', 'propImp', 'cmjPP', 'cmjRelPP', 'peakLandF', 'landAsym'], iso: ['imtpRfd', 'imtpImp', 'imtpAvgF', 'imtpTtpf', 'imtpAsym'], dj: ['djHeight', 'dropBox'] };
const EVAL_TRIALS = ['sprint10yd', 'fly10yd', 'proAgility', 'cmj', 'cmjPF', 'sj', 'imtpPF', 'slImtpL', 'slImtpR', 'calfIsoL', 'calfIsoR'];
const EVAL_SPEED = { sprint10yd: { n: 2, label: '0–10 yd', mph: 9.144 }, fly10yd: { n: 2, label: '5 yd build + 10 yd fly', mph: 9.144 }, proAgility: { n: 2, label: 'Pro agility (5-10-5)' } };
/* Timed tests keep the fastest trial; force-plate trials are averaged */
const evalBest = k => M[k].dir === -1 && EVAL_SPEED[k];
const MPH = 0.44704;
/* The 10-yard tests accept the split in seconds or the speed in MPH from the timer (anything ≥ 6 is read as MPH) */
const evalSecs = (k, x) => (EVAL_SPEED[k]?.mph && x >= 6 ? round(EVAL_SPEED[k].mph / (x * MPH), 3) : x);
const SCREEN = [
  { key: 'ohs', label: 'Overhead squat', hint: 'Arms overhead, squat as deep as possible. Heels, knee tracking, torso, arms, hips level.' },
  { key: 'latLunge', label: 'Lateral lunge', hint: 'Each side. Depth, knee over toe, foot flat, trail leg straight, chest up.' },
  { key: 'fwdLunge', label: 'Forward lunge with PVC', hint: 'PVC on head, upper back and sacrum. Each leg. Pipe contact, knee tracking, balance.' },
  { key: 'cars', label: 'FRC CARs series', hint: 'Controlled articular rotations. Range, control, compensations, pain.' },
];
function evalExtras(sec) { return (S.settings.evalExtra || []).filter(k => EVAL_MORE[sec].includes(k)); }
A.newEval = el => {
  const a = getAthlete(el.dataset.a);
  const ed = el.dataset.id ? getRec('tests', el.dataset.id) : null;
  const lastBm = ed?.bodyMassKg ?? [...testsFor(a.id)].reverse().find(t => t.bodyMassKg)?.bodyMassKg ?? a.massKg;
  const disp = (k, x) => inVal(metricDisp(M[k], x), M[k].kind === 'len' ? 1 : M[k].unit === 's' ? 3 : Math.max(M[k].dec, 2));
  const trialVals = k => (ed?.trials?.[k]?.length ? ed.trials[k] : ed?.m?.[k] != null ? [ed.m[k]] : []);
  const trialRow = (k, label) => { const n = EVAL_SPEED[k]?.n || 3; return `<div class="eval-trials${n === 2 ? ' two' : ''}"><div class="et-label">${esc(label)} <span class="faint">${esc(EVAL_SPEED[k]?.mph ? 's or mph' : metricUnit(M[k]) || '')}</span></div>${[...Array(n).keys()].map(i => { const v = trialVals(k)[i]; return `<input type="text" inputmode="decimal" data-tr="${k}" data-i="${i}" placeholder="Trial ${i + 1}" aria-label="${esc(label)} trial ${i + 1}" value="${v != null ? esc(disp(k, v)) : ''}">`; }).join('')}<div class="et-avg" data-avg="${k}">—</div></div>`; };
  const single = (k, removable) => {
    const d = M[k], v = ed?.m?.[k];
    const sideSel = d.side ? `<select data-side="${k}" aria-label="Greater side" style="width:auto;min-height:40px">${[['', 'Side'], ['Left', 'Left'], ['Right', 'Right']].map(([x, l]) => `<option value="${x}" ${ed?.sides?.[k] === x ? 'selected' : ''}>${l}</option>`).join('')}</select>` : '';
    return `<div class="field ev-one" data-one-wrap="${k}"><span class="field-label"><span>${esc(d.label)}</span>${metricUnit(d) ? `<span class="u">${esc(metricUnit(d))}</span>` : ''}${removable ? `<button type="button" class="link ev-x" data-ev-rm="${k}" aria-label="Remove ${esc(d.label)}">×</button>` : ''}</span><div style="display:flex;gap:6px"><input type="text" inputmode="decimal" data-one="${k}" value="${v != null ? esc(disp(k, v)) : ''}">${sideSel}</div></div>`;
  };
  const extraKeys = sec => [...new Set([...evalExtras(sec), ...(ed ? EVAL_MORE[sec].filter(k => ed.m?.[k] != null) : [])])];
  const adder = sec => { const left = EVAL_MORE[sec].filter(k => !extraKeys(sec).includes(k)); return left.length ? `<select data-ev-add="${sec}" class="ev-add" aria-label="Add a metric"><option value="">+ Add metric…</option>${left.map(k => `<option value="${k}">${esc(M[k].label)}</option>`).join('')}</select>` : ''; };
  const secMetrics = sec => `<div class="fields" data-ev-sec="${sec}">${EVAL_CORE[sec].map(k => single(k, false)).join('')}${extraKeys(sec).map(k => single(k, true)).join('')}</div>${adder(sec)}`;
  const sc = ed?.screen || {};
  const screenHtml = SCREEN.map(x => `<div class="ms-item"><div class="ms-head"><div><b>${esc(x.label)}</b><div class="faint tiny">${esc(x.hint)}</div></div>
      <div class="ms-score" role="radiogroup" aria-label="${esc(x.label)} score">${[1, 2, 3, 4, 5].map(n => `<button type="button" class="${sc[x.key]?.score === n ? 'on' : ''}" data-ms="${x.key}" data-v="${n}" role="radio" aria-checked="${sc[x.key]?.score === n}">${n}</button>`).join('')}</div></div>
      <textarea data-msn="${x.key}" rows="2" placeholder="Notes: compensations, side differences, cues">${esc(sc[x.key]?.notes || '')}</textarea></div>`).join('');
  openModal({
    title: `${ed ? 'Edit' : 'New'} evaluation — ${athleteName(a, true)}`, size: 'wide', submit: 'Save',
    body: `
      <div class="fields">${field('Date', inp('date', ed?.date || today(), 'type="date"'))}${field('Body mass (same day)', numInp('bm', lastBm != null ? inVal(U.massOut(lastBm), 1) : ''), { unit: U.mass(), hint: 'Weigh on the plate before jumping' })}</div>
      <div class="eval-sec"><h4>1 · Movement screen</h4><p class="hint">Score each movement 1–5 (1 = poor, 5 = excellent) and add notes.</p>
        <div class="ms-list">${screenHtml}</div><div class="ms-total" id="msTotal"></div></div>
      <div class="eval-sec"><h4>2 · Speed & agility</h4><p class="hint">2 trials each, full recovery between. The fastest trial counts. For the 10-yard tests type the split in seconds or the MPH your timer shows.</p>
        ${Object.entries(EVAL_SPEED).map(([k, x]) => trialRow(k, x.label)).join('')}</div>
      <div class="eval-sec"><h4>3 · Countermovement jump <span class="badge info">profile</span></h4><p class="hint">OVR Force · Jump mode · hands on hips · 3 trials, ~30–60 s rest. Enter each trial.</p>
        ${trialRow('cmj', 'Jump height')}${trialRow('cmjPF', 'Peak propulsive force')}
        <div class="kicker" style="margin:8px 0 6px">Key force-plate metrics <span class="faint">(best or average of the same trials)</span></div>${secMetrics('cmj')}</div>
      <div class="eval-sec"><h4>4 · Squat jump <span class="badge info">profile</span></h4><p class="hint">Hold the bottom (≈90° knee) for 2–3 s, no dip before the push. Discard any trial with a countermovement.</p>
        ${trialRow('sj', 'Jump height')}</div>
      <div class="eval-sec"><h4>5 · Isometric mid-thigh pull <span class="badge info">profile</span></h4><p class="hint">OVR Force · Force mode · bar at mid-thigh, knee ≈125–145°, hip ≈140–150° · pre-tension, then pull hard and fast for 3–5 s · 2–3 trials, 1–2 min rest.</p>
        ${trialRow('imtpPF', 'Peak force')}${secMetrics('iso')}</div>
      <div class="eval-sec"><h4>6 · Single-leg IMTP</h4><p class="hint">Same bar height and set-up, one foot on the plate, other leg free. 2–3 trials each leg.</p>
        ${trialRow('slImtpL', 'Left leg peak force')}${trialRow('slImtpR', 'Right leg peak force')}<div class="ev-lr" data-lr="slImtp"></div></div>
      <div class="eval-sec"><h4>7 · Isometric calf push (single leg)</h4><p class="hint">Push up into a fixed bar or strap through the ball of the foot, same knee angle every time. 2–3 trials each leg.</p>
        ${trialRow('calfIsoL', 'Left leg peak force')}${trialRow('calfIsoR', 'Right leg peak force')}<div class="ev-lr" data-lr="calfIso"></div></div>
      <details class="group" ${ed && (ed.m?.djRsi != null || ed.m?.djGct != null) ? 'open' : ''}><summary>8 · Drop jump (optional)</summary><div class="group-body">${secMetrics('dj')}</div></details>
      <div class="computed" id="evalOut">Enter CMJ, squat jump and IMTP trials to see the profile.</div>
      <p class="faint tiny" style="margin:8px 0 0">Metrics you add with “+ Add metric” stay in this form for future evaluations until you remove them (×).</p>`,
    onSubmit: (v, form, m) => {
      const R = read(m);
      if (!isDS(v.date)) return 'Choose a date.';
      if (R.bad.length) return 'Check these values: ' + R.bad.join(', ');
      if (!Object.keys(R.avg).length && !Object.keys(R.one).length && !Object.keys(R.screen).length) return 'Enter at least one result or movement score.';
      const bm = num(v.bm);
      const mm = {};
      Object.entries({ ...R.one, ...R.avg }).forEach(([k, x]) => { mm[k] = M[k].kind === 'len' ? U.lenIn(x) : x; });
      const trials = {};
      Object.entries(R.trials).forEach(([k, arr]) => { if (arr.length) trials[k] = arr.map(x => (M[k].kind === 'len' ? U.lenIn(x) : x)); });
      const ex = ed || S.tests.find(t => t.athleteId === a.id && t.date === v.date);
      const sides = { ...(ex?.sides || {}), ...R.sides };
      const base = ex ? { ...ex } : { athleteId: a.id, sides: {}, notes: 'Evaluation' };
      // when editing, the form is the source of truth for every field it shows
      const shown = new Set([...EVAL_TRIALS, ...Object.values(EVAL_CORE).flat(), ...$$('[data-one]', m.wrap).map(i => i.dataset.one)]);
      const keepM = ed ? Object.fromEntries(Object.entries(ex.m || {}).filter(([k]) => !shown.has(k))) : (ex?.m || {});
      const keepT = ed ? Object.fromEntries(Object.entries(ex.trials || {}).filter(([k]) => !shown.has(k))) : (ex?.trials || {});
      const rec = { ...base, date: v.date, m: { ...keepM, ...mm }, trials: { ...keepT, ...trials }, sides, isoType: 'IMTP', evaluation: true,
        screen: Object.keys(R.screen).length ? R.screen : (ed ? undefined : ex?.screen), bodyMassKg: bm > 0 ? U.massIn(bm) : (ex?.bodyMassKg ?? null) };
      if (!rec.screen) delete rec.screen;
      upsert('tests', rec);
      const miss = ['cmj', 'cmjPF', 'sj', 'imtpPF'].filter(k => rec.m[k] == null);
      toast(miss.length && miss.length < 4 ? `Saved. Still needed for the profile: ${miss.map(k => M[k].label).join(', ')}` : 'Evaluation saved');
      refresh();
    },
    onDelete: ed ? async () => { if (!(await confirmBox('Delete this evaluation?', 'All its results and movement scores are removed.'))) return false; removeRec('tests', ed.id); toast('Evaluation deleted'); refresh(); } : null,
    onMount: m => {
      const upd = () => {
        const R = read(m);
        Object.keys(R.avg).concat(EVAL_TRIALS).forEach(k => {
          const el = $(`[data-avg="${k}"]`, m.wrap); if (!el) return;
          const v = R.avg[k];
          el.textContent = !v ? '—' : evalBest(k) ? `Best ${fmtNum(v, 2)} s${EVAL_SPEED[k].mph ? ` · ${fmtNum(EVAL_SPEED[k].mph / v / MPH, 1)} mph` : ''}` : 'Avg ' + fmtNum(v, M[k].kind === 'len' ? 1 : 0);
        });
        const bmKg = U.massIn(num($('[name=bm]', m.wrap).value) || 0) || null;
        [['slImtp', 'N/kg', x => x / bmKg], ['calfIso', '× BW', x => x / (bmKg * 9.81)]].forEach(([p, unit, rel]) => {
          const L = R.avg[p + 'L'], Rr = R.avg[p + 'R'], box = $(`[data-lr="${p}"]`, m.wrap);
          if (!box) return;
          if (!(L > 0 && Rr > 0)) { box.innerHTML = ''; return; }
          const asym = (Math.max(L, Rr) - Math.min(L, Rr)) / Math.max(L, Rr) * 100;
          box.innerHTML = `Asymmetry <b class="${asym >= 15 ? 'vl-bad' : asym >= 10 ? 'vl-warn' : 'vl-ok'}">${fmtNum(asym, 1)}%</b> (${L > Rr ? 'left' : 'right'} stronger)${bmKg ? ` · relative <b>${fmtNum(rel((L + Rr) / 2), unit === 'N/kg' ? 1 : 2)} ${unit}</b>` : ''}`;
        });
        const scored = Object.values(R.screen).filter(x => x.score), tot = scored.reduce((s2, x) => s2 + x.score, 0), nS = scored.length;
        $('#msTotal', m.wrap).innerHTML = nS ? `Movement score <b>${tot}</b> / ${nS * 5}${nS < 4 ? ` <span class="faint">(${nS} of 4 scored)</span>` : ''}` : '';
        const out = $('#evalOut', m.wrap);
        if (!(R.avg.cmj && R.avg.cmjPF && R.avg.sj && R.avg.imtpPF)) { out.textContent = 'Enter CMJ, squat jump and IMTP trials to see the profile.'; return; }
        const p = profileFromTest({ m: { cmj: U.lenIn(R.avg.cmj), sj: U.lenIn(R.avg.sj), cmjPF: R.avg.cmjPF, imtpPF: R.avg.imtpPF }, isoType: 'IMTP', date: today() });
        const tq = trialQuality({ cmj: R.trials.cmj, sj: R.trials.sj, cmjPF: R.trials.cmjPF, imtpPF: R.trials.imtpPF });
        out.innerHTML = `Profile: <b style="color:${PROFILES[p.primary].color}">${PROFILES[p.primary].label}</b>${p.secondary ? ` with ${PROFILES[p.secondary].label.toLowerCase()} tendency` : ''} · DSI <b>${fmtNum(p.dsi, 2)}</b> · EUR <b>${fmtNum(p.eur, 2)}</b>${tq.length ? `<br><span style="color:var(--warn)">${tq.map(esc).join('<br>')}</span>` : ''}`;
      };
      m.wrap.addEventListener('input', upd);
      m.wrap.addEventListener('click', e => {
        const b = e.target.closest('[data-ms]');
        if (b) { const on = b.classList.contains('on'); $$(`[data-ms="${b.dataset.ms}"]`, m.wrap).forEach(x => { x.classList.remove('on'); x.setAttribute('aria-checked', 'false'); }); if (!on) { b.classList.add('on'); b.setAttribute('aria-checked', 'true'); } upd(); return; }
        const rm = e.target.closest('[data-ev-rm]');
        if (rm) {
          const k = rm.dataset.evRm;
          S.settings.evalExtra = (S.settings.evalExtra || []).filter(x => x !== k); persist();
          const w = $(`[data-one-wrap="${k}"]`, m.wrap); const sec = w?.closest('[data-ev-sec]')?.dataset.evSec;
          w?.remove();
          const selEl = sec && $(`[data-ev-add="${sec}"]`, m.wrap);
          if (selEl && !selEl.querySelector(`option[value="${k}"]`)) selEl.insertAdjacentHTML('beforeend', `<option value="${k}">${esc(M[k].label)}</option>`);
          upd();
        }
      });
      m.wrap.addEventListener('change', e => {
        const ad = e.target.closest('[data-ev-add]');
        if (!ad || !ad.value) return;
        const k = ad.value, sec = ad.dataset.evAdd;
        S.settings.evalExtra = [...new Set([...(S.settings.evalExtra || []), k])]; persist();
        $(`[data-ev-sec="${sec}"]`, m.wrap).insertAdjacentHTML('beforeend', single(k, true));
        ad.querySelector(`option[value="${k}"]`)?.remove(); ad.value = '';
        if (ad.options.length <= 1) ad.remove();
        $(`[data-one="${k}"]`, m.wrap)?.focus();
      });
      upd();
    },
  });
  function read(m) {
    const trials = {}, avg = {}, one = {}, bad = [], sides = {}, screen = {};
    EVAL_TRIALS.forEach(k => {
      trials[k] = $$(`[data-tr="${k}"]`, m.wrap).map(i => i.value.trim()).filter(Boolean).map(s2 => { const x = evalSecs(k, num(s2)); if (!(x > 0) || (EVAL_SPEED[k] && x > 15)) bad.push(`${M[k].label} “${s2}”`); return x; }).filter(x => x > 0);
      if (trials[k].length) avg[k] = evalBest(k) ? Math.min(...trials[k]) : mean(trials[k]);
    });
    $$('[data-one]', m.wrap).forEach(i => {
      const k = i.dataset.one, s2 = i.value.trim();
      if (!s2) return;
      const x = num(s2);
      if (x == null || x < 0 || (M[k].unit === '%' && x > 100)) bad.push(`${M[k].label} “${s2}”`); else one[k] = x;
    });
    $$('[data-side]', m.wrap).forEach(sl => { if (sl.value && one[sl.dataset.side] != null) sides[sl.dataset.side] = sl.value; });
    SCREEN.forEach(x => {
      const on = $(`[data-ms="${x.key}"].on`, m.wrap), notes = $(`[data-msn="${x.key}"]`, m.wrap).value.trim();
      if (on || notes) screen[x.key] = { score: on ? +on.dataset.v : null, notes: notes.slice(0, 2000) };
    });
    Object.keys(screen).forEach(k => { if (screen[k].score == null && !screen[k].notes) delete screen[k]; });
    Object.values(screen).forEach(x => { if (x.score == null) delete x.score; });
    return { trials, avg, one, bad, sides, screen };
  }
};
function evalHistory(a, profiles) {
  const evs = testsFor(a.id).filter(t => t.evaluation || profiles.some(p => p.testId === t.id) || t.screen).reverse();
  if (!evs.length) return '<div class="muted small">Evaluations appear here. Tap one to edit it.</div>';
  return `<div class="list">${evs.map(t => {
    const p = profiles.find(x => x.testId === t.id), tm = testMetrics(t);
    const ms = screenTotal(t);
    const bits = [p ? `DSI ${fmtNum(p.dsi, 2)} · EUR ${fmtNum(p.eur, 2)}` : '', tm.slImtpAsym != null ? `SL IMTP asym ${fmtNum(tm.slImtpAsym, 0)}%` : '', ms ? `movement ${ms.total}/${ms.max}` : ''].filter(Boolean).join(' · ');
    return `<button class="row" data-act="newEval" data-a="${a.id}" data-id="${t.id}">${p ? `<span class="prof-sw" style="background:${PROFILES[p.primary].color}"></span>` : `<span class="prof-sw" style="background:var(--surface-3)"></span>`}<span class="row-main"><span class="row-title">${p ? esc(PROFILES[p.primary].label) + (p.secondary ? ` · ${esc(PROFILES[p.secondary].label.toLowerCase())}` : '') : 'Evaluation'}</span><span class="row-sub">${esc(fmtDateFull(t.date))}${bits ? ' · ' + esc(bits) : ''}</span></span>${icon('chevR', 'sm')}</button>`;
  }).join('')}</div>`;
}
function screenTotal(t) {
  const sc = Object.values(t?.screen || {}).filter(x => x.score >= 1);
  return sc.length ? { total: sc.reduce((s, x) => s + x.score, 0), max: sc.length * 5, n: sc.length } : null;
}
const asymCls = v => (v >= 15 ? 'bad' : v >= 10 ? 'warn' : 'good');
function singleLegCard(a) {
  const rows = [['slImtp', 'Single-leg IMTP', 'N/kg', 1], ['calfIso', 'Isometric calf push', '× BW', 2]].map(([p, label, unit, dec]) => {
    const t = [...testsFor(a.id)].reverse().find(x => x.m?.[p + 'L'] > 0 && x.m?.[p + 'R'] > 0);
    if (!t) return '';
    const m = testMetrics(t), asym = m[p + 'Asym'], rel = m[p + 'Rel'];
    const prev = testsFor(a.id).filter(x => x.date < t.date && x.m?.[p + 'L'] > 0 && x.m?.[p + 'R'] > 0).pop();
    const pa = prev ? testMetrics(prev)[p + 'Asym'] : null;
    return `<div class="sl-row"><div class="split"><b>${esc(label)}</b><span class="faint small">${esc(fmtDate(t.date))}</span></div>
      <div class="sl-bars">${['L', 'R'].map(sd => { const v = m[p + sd], mx = Math.max(m[p + 'L'], m[p + 'R']); return `<div class="sl-bar"><span class="sl-side">${sd === 'L' ? 'Left' : 'Right'}</span><span class="sl-track"><span style="width:${v / mx * 100}%"></span></span><b>${fmtNum(v, 0)} N</b></div>`; }).join('')}</div>
      <div class="small" style="margin-top:4px"><span class="badge ${asymCls(asym)}">Asymmetry ${fmtNum(asym, 1)}%</span> ${m[p + 'L'] > m[p + 'R'] ? 'Left' : 'Right'} stronger${rel != null ? ` · <b>${fmtNum(rel, dec)} ${unit}</b>` : ''}${pa != null ? ` <span class="faint">· was ${fmtNum(pa, 1)}%</span>` : ''}</div></div>`;
  }).filter(Boolean);
  if (!rows.length) return '';
  return `<div class="card"><div class="card-head"><h3>Single-leg strength</h3><span class="sub">latest</span></div>${rows.join('')}
    <p class="faint tiny" style="margin:8px 0 0">Asymmetry = (stronger − weaker) ÷ stronger. Above ~10–15% is worth watching, but retest before acting: asymmetry varies between sessions and tests.</p>${refLinks(['bishop2018'])}</div>`;
}
function screenCard(a) {
  const evs = testsFor(a.id).filter(t => screenTotal(t));
  if (!evs.length) return '';
  const t = evs[evs.length - 1], prev = evs[evs.length - 2], tot = screenTotal(t);
  const scoreCls = n => (n >= 4 ? 'good' : n === 3 ? 'warn' : 'bad');
  return `<div class="card"><div class="card-head"><h3>Movement screen</h3><span class="sub">${esc(fmtDate(t.date))}</span></div>
    <div class="ms-sum"><span class="pct-val">${tot.total}<small>/ ${tot.max}</small></span>${prev && screenTotal(prev) ? `<span class="faint small">previous ${screenTotal(prev).total}/${screenTotal(prev).max} (${esc(fmtDate(prev.date))})</span>` : ''}</div>
    <div class="list">${SCREEN.map(x => { const r = t.screen[x.key]; if (!r) return ''; const pr = prev?.screen?.[x.key]?.score; return `<div class="row" style="align-items:flex-start"><span class="row-main" style="white-space:normal"><span class="row-title">${esc(x.label)}${pr && r.score && pr !== r.score ? ` <span class="faint small">(was ${pr})</span>` : ''}</span>${r.notes ? `<span class="row-sub" style="white-space:pre-wrap;overflow:visible">${esc(r.notes)}</span>` : ''}</span>${r.score ? `<span class="badge ${scoreCls(r.score)}">${r.score} / 5</span>` : '<span class="faint small">notes only</span>'}</div>`; }).join('')}</div>
    <button class="btn sm" style="margin-top:8px" data-act="newEval" data-a="${a.id}" data-id="${t.id}">${icon('edit', 'sm')}Edit scores & notes</button></div>`;
}
function speedCard(a) {
  const rows = Object.entries(EVAL_SPEED).map(([k, x]) => {
    const ser = metricSeries(a.id, k);
    if (!ser.length) return '';
    const t = trendOf(ser, M[k]), v = t.last.v;
    return `<div class="tile"><div class="t-name">${esc(x.label)}</div><div class="t-val">${fmtNum(v, 2)} <small>s</small></div>
      <div class="t-foot">${t.dPrevPct != null ? deltaHtml(M[k], t.dPrevPct) : `<span class="faint tiny">${esc(fmtDate(t.last.date))}</span>`}${x.mph ? `<span class="faint tiny">${fmtNum(x.mph / v / MPH, 1)} mph</span>` : ''}</div></div>`;
  }).filter(Boolean);
  if (!rows.length) return '';
  return `<div class="card"><div class="card-head"><h3>Speed & agility</h3><span class="sub">latest · fastest trial</span></div><div class="tiles">${rows.join('')}</div>
    <p class="faint tiny" style="margin:8px 0 0">Change vs the previous test, coloured only when bigger than normal timing noise. MPH is the average speed over the 10 yards.</p></div>`;
}
function athleteProfileSummary(aid) {
  const p = athleteProfiles(aid).pop();
  return p ? { ...p, label: PROFILES[p.primary].label + (p.secondary ? ` (${PROFILES[p.secondary].label.toLowerCase()} tendency)` : '') } : null;
}
