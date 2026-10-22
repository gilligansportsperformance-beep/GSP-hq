/* =========================================================
   Exercise library & VBT
   ========================================================= */
const EX_CATS = ['Squat', 'Hinge', 'Single-leg', 'Upper push', 'Upper pull', 'Olympic & derivatives', 'Plyometric & jumps', 'Speed & agility', 'Core', 'Mobility & prep', 'Conditioning', 'Other'];

ROUTES.library = () => {
  const L = UI.lib;
  const cats = EX_CATS.filter(c => S.exercises.some(e => e.category === c));
  const body = S.exercises.length ? `
    <div class="toolbar"><div class="searchbox grow">${icon('search', 'sm')}<input type="search" placeholder="Search exercises, equipment, cues…" value="${esc(L.q)}" data-input="libSearch" aria-label="Search exercises"></div></div>
    <div class="chips scroll" style="margin-bottom:14px">
      <button class="chip ${L.cat === 'all' ? 'on' : ''}" data-act="libCat" data-v="all">All (${S.exercises.length})</button>
      <button class="chip ${L.cat === 'vbt' ? 'on' : ''}" data-act="libCat" data-v="vbt">${icon('zap', 'sm')}VBT</button>
      ${cats.map(c => `<button class="chip ${L.cat === c ? 'on' : ''}" data-act="libCat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <div id="libResults">${libraryResults()}</div>` :
    `<div class="card">${emptyState_('book', 'Your exercise library is empty', 'Add the exercises you coach — with cues, equipment, video links and VBT settings. You can also start from a curated set of 60 common exercises and edit them freely.', `<div class="chips" style="justify-content:center"><button class="btn primary" data-act="newExercise">${icon('plus', 'sm')}Add exercise</button><button class="btn" data-act="loadStarter">Load starter library</button></div>`)}</div>`;
  return { title: 'Exercise Library', body, actions: `<button class="btn primary" data-act="newExercise">${icon('plus', 'sm')}<span class="lbl">Add exercise</span></button>` };
};
function libraryResults() {
  const L = UI.lib, q = L.q.trim().toLowerCase();
  let list = S.exercises.filter(e => L.cat === 'all' || (L.cat === 'vbt' ? e.vbt : e.category === L.cat));
  if (q) list = list.filter(e => [e.name, e.category, e.equipment, e.cues, e.notes].join(' ').toLowerCase().includes(q));
  if (!list.length) return `<div class="card">${emptyState_('search', 'No exercises found', 'Try another search or category.')}</div>`;
  const groups = [...EX_CATS, ...new Set(list.map(e => e.category).filter(c => !EX_CATS.includes(c)))];
  return groups.map(c => {
    const items = list.filter(e => e.category === c).sort((a, b) => a.name.localeCompare(b.name));
    if (!items.length) return '';
    return `<div class="section-title">${esc(c)} <span class="faint">· ${items.length}</span></div><div class="card" style="padding:4px 14px">${items.map(e => {
      const used = S.workouts.reduce((n, w) => n + (w.items || []).filter(i => i.exerciseId === e.id).length, 0);
      return `<button class="row" data-act="editExercise" data-id="${e.id}"><span class="row-main"><span class="row-title">${esc(e.name)}</span><span class="row-sub">${esc([e.equipment, e.cues].filter(Boolean).join(' · ') || '—')}</span></span>
        ${e.vbt ? `<span class="badge info">${icon('zap', 'sm')}VBT${e.mvt ? ` · MVT ${fmtNum(e.mvt, 2)}` : ''}</span>` : ''}${used ? `<span class="faint tiny nowrap">${plural(used, 'use')}</span>` : ''}${icon('chevR', 'sm')}</button>`;
    }).join('')}</div>`;
  }).join('');
}
A.libSearch = el => { UI.lib.q = el.value; $('#libResults').innerHTML = libraryResults(); };
A.libCat = el => { UI.lib.cat = el.dataset.v; refresh(); };
A.newExercise = () => openExerciseModal(null);
A.editExercise = el => openExerciseModal(getExercise(el.dataset.id));
A.loadStarter = () => { const n = addStarterLibrary(); toast(`${plural(n, 'exercise')} added`); refresh(); };

function openExerciseModal(e) {
  const isNew = !e;
  const x = e ? { ...e } : { name: '', category: UI.lib.cat !== 'all' && UI.lib.cat !== 'vbt' ? UI.lib.cat : 'Squat', equipment: '', cues: '', videoUrl: '', vbt: UI.lib.cat === 'vbt', mvt: null, notes: '' };
  const body = `
    ${field('Name', inp('name', x.name, 'autofocus required autocapitalize="words"'))}
    <div class="fields">
      ${field('Category', sel('category', EX_CATS, x.category))}
      ${field('Equipment', inp('equipment', x.equipment, 'placeholder="Barbell, rack"'))}
    </div>
    ${field('Coaching cues', ta('cues', x.cues, 'rows="2" placeholder="e.g. Brace, push the floor away, drive hips through"'))}
    ${field('Video link', inp('videoUrl', x.videoUrl, 'type="url" placeholder="https://…" autocapitalize="off"'), { hint: 'Optional demo video (opens when online).' })}
    <div class="card" style="padding:4px 14px;margin-bottom:14px;box-shadow:none">
      ${toggleRow('vbt', x.vbt, 'Track with velocity (VBT)', 'Show this exercise in VBT logging and load–velocity profiles.')}
      <div class="settings-row" style="display:block">${field('Minimum velocity threshold (MVT)', numInp('mvt', x.mvt ?? ''), { unit: 'm/s', hint: 'Mean velocity of a true 1RM — used to estimate 1RM. Typical: back squat ≈0.30, bench ≈0.17, deadlift ≈0.15. Leave blank for ballistic lifts.', cls: '' })}</div>
    </div>
    ${field('Notes', ta('notes', x.notes, 'rows="2" placeholder="Progressions, regressions, contraindications…"'))}
    ${x.videoUrl && /^https?:\/\//i.test(x.videoUrl) ? `<a class="btn sm" href="${esc(x.videoUrl)}" target="_blank" rel="noopener">Open video</a>` : ''}`;
  openModal({
    title: isNew ? 'New exercise' : 'Edit exercise', body,
    onSubmit: v => {
      const name = v.name.trim();
      if (!name) return 'Name is required.';
      if (S.exercises.some(o => o.id !== x.id && o.name.toLowerCase() === name.toLowerCase())) return `“${name}” is already in your library.`;
      const mvt = num(v.mvt);
      if (v.mvt.trim() && (mvt == null || mvt <= 0 || mvt > 1.5)) return 'MVT should be a velocity in m/s between 0 and 1.5 (e.g. 0.30).';
      if (v.videoUrl.trim() && !/^https?:\/\//i.test(v.videoUrl.trim())) return 'Video link should start with http:// or https://';
      upsert('exercises', { ...x, name, category: v.category, equipment: v.equipment.trim(), cues: v.cues.trim(), videoUrl: v.videoUrl.trim(), vbt: !!v.vbt, mvt, notes: v.notes.trim() });
      toast(isNew ? 'Exercise added' : 'Saved'); refresh();
    },
    onDelete: isNew ? null : async () => {
      const used = S.workouts.filter(w => (w.items || []).some(i => i.exerciseId === x.id)).length;
      const logs = S.vbt.filter(l => l.exerciseId === x.id).length;
      if (!(await confirmBox(`Delete “${x.name}”?`, used || logs ? `It's used in ${plural(used, 'workout')} and ${plural(logs, 'VBT set')}. Those will show as “Exercise” without a name. Consider renaming instead.` : 'This cannot be undone.'))) return false;
      removeRec('exercises', x.id); toast('Exercise deleted'); refresh();
    },
  });
}

/* ---------------- VBT page ---------------- */
ROUTES.vbt = () => {
  const V = UI.vbt;
  const athletesWithLogs = sortedAthletes().filter(a => S.vbt.some(l => l.athleteId === a.id));
  if (!athletesWithLogs.some(a => a.id === V.athleteId)) V.athleteId = athletesWithLogs[0]?.id || '';
  const exIds = V.athleteId ? [...new Set(S.vbt.filter(l => l.athleteId === V.athleteId).map(l => l.exerciseId))].filter(id => getExercise(id)) : [];
  if (!exIds.includes(V.exerciseId)) V.exerciseId = exIds[0] || '';
  const recent = [...S.vbt].sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt).slice(0, 25);
  const zoneBar = `<div class="zone-bar">${ZONES.map(z => `<span style="flex:${z.max - z.min};background:${z.color}"></span>`).join('')}</div>`;
  const body = `
    <div class="grid two">
      <div class="col">
        ${athletesWithLogs.length ? `<div class="card" style="padding-bottom:6px"><div class="toolbar" style="margin:0">${sel('a', athletesWithLogs.map(a => [a.id, athleteName(a)]), V.athleteId, 'data-change="vbtAthlete" style="width:auto;flex:1" aria-label="Athlete"')}</div></div>
          ${V.exerciseId ? lvProfileCard(V.athleteId, V.exerciseId, V.window, 'vbtEx', 'vbtWin', exIds) : ''}` :
          `<div class="card">${emptyState_('gauge', 'No velocity data yet', 'Log sets with the load and the mean velocity of each rep from your device (e.g. GymAware, Vitruve, Enode, Metric, RepOne). Profiles, 1RM estimates and readiness flags build automatically.', `<button class="btn primary" data-act="newVbt">${icon('plus', 'sm')}Log first set</button>`)}</div>`}
        <div class="card"><div class="card-head"><h3>Recent sets</h3><span class="sub">All athletes</span></div>${recent.length ? vbtLogTable(recent, true) : '<div class="muted small">Nothing logged yet.</div>'}</div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-head"><h3>Velocity-loss calculator</h3></div>
          ${field('Rep velocities (m/s)', `<input type="text" inputmode="decimal" placeholder="0.82, 0.80, 0.77, 0.71" data-input="vlCalc" id="vlIn">`, { hint: 'Separate with commas or spaces.' })}
          ${field('Velocity-loss stop', `<input type="text" inputmode="decimal" value="20" data-input="vlCalc" id="vlCut">`, { unit: '%' })}
          <div class="computed" id="vlOut" style="margin:0">Enter rep velocities to see velocity loss and where to stop the set.</div>
        </div>
        <div class="card">
          <div class="card-head"><h3>Velocity zones</h3><span class="sub">Mean concentric velocity</span></div>
          ${zoneBar}
          <div class="table-wrap"><table class="t"><thead><tr><th>Zone</th><th class="n">m/s</th><th>≈ %1RM</th></tr></thead><tbody>
          ${ZONES.map(z => `<tr><td><span class="zone-sw" style="background:${z.color}"></span><b>${esc(z.name)}</b><div class="faint small">${esc(z.use)}</div></td><td class="n nowrap">${fmtNum(z.min, 2)}–${fmtNum(z.max, 2)}</td><td class="nowrap small">${esc(z.pct)}</td></tr>`).join('')}
          </tbody></table></div>
          <p class="faint tiny" style="margin-top:8px">Zones are general guides (Mann et al. 2015), mostly derived from squat and bench press. The athlete's own load–velocity profile is more precise.</p>
        </div>
        <div class="card">
          <div class="card-head"><h3>Velocity-loss targets</h3></div>
          <div class="table-wrap"><table class="t"><tbody>
            <tr><td><b>≈ 10–15%</b></td><td class="small">Speed, power, in-season, low fatigue</td></tr>
            <tr><td><b>≈ 20–25%</b></td><td class="small">Maximal strength with limited fatigue — strength gains similar to 40% with better jump gains</td></tr>
            <tr><td><b>≈ 30–40%+</b></td><td class="small">Hypertrophy emphasis; more fatigue and slower recovery</td></tr>
          </tbody></table></div>
          ${refLinks(['pareja2017', 'sanchez2011', 'weakley2021'])}
        </div>
      </div>
    </div>`;
  return { title: 'Velocity-Based Training', body, actions: `<button class="btn primary" data-act="newVbt">${icon('plus', 'sm')}<span class="lbl">Log set</span></button>` };
};
A.vbtAthlete = el => { UI.vbt.athleteId = el.value; UI.vbt.exerciseId = ''; refresh(); };
A.vbtEx = el => { UI.vbt.exerciseId = el.value; refresh(); };
A.vbtWin = el => { UI.vbt.window = el.value; refresh(); };
A.vlCalc = () => {
  const reps = parseVels($('#vlIn').value);
  const cut = num($('#vlCut').value);
  const out = $('#vlOut');
  if (!reps.length) { out.innerHTML = 'Enter rep velocities to see velocity loss and where to stop the set.'; return; }
  const st = velStats(reps);
  let stopAt = null;
  if (cut > 0) { const best = []; for (let i = 0; i < reps.length; i++) { best.push(reps[i]); const b = Math.max(...best); if ((b - reps[i]) / b * 100 >= cut) { stopAt = i + 1; break; } } }
  const z = zoneOf(st.best);
  out.innerHTML = `Reps <b>${st.n}</b> · fastest <b>${fmtNum(st.best, 2)}</b> · mean <b>${fmtNum(st.mean, 2)}</b> · last <b>${fmtNum(st.last, 2)}</b> m/s<br>
    Velocity loss <b style="color:${st.vl > 40 ? 'var(--bad)' : st.vl > 25 ? 'var(--warn)' : 'var(--good)'}">${fmtNum(st.vl, 1)}%</b>${z ? ` · fastest rep in <b>${esc(z.name)}</b>` : ''}<br>
    ${cut > 0 ? (stopAt ? `Cut-off of ${fmtNum(cut, 0)}% reached on <b>rep ${stopAt}</b> — stop the set there.` : `Cut-off of ${fmtNum(cut, 0)}% not reached (velocity at stop threshold: <b>${fmtNum(st.best * (1 - cut / 100), 2)} m/s</b>).`) : ''}`;
};

function vbtLogTable(logs, showAthlete) {
  if (!logs.length) return '<div class="muted small">No sets.</div>';
  return `<div class="table-wrap"><table class="t"><thead><tr><th>Date</th>${showAthlete ? '<th>Athlete</th>' : ''}<th>Exercise</th><th class="n">Load</th><th class="n">Reps</th><th class="n">Best</th><th class="n">VL</th></tr></thead><tbody>
    ${logs.map(l => {
      const z = zoneOf(l.vBest);
      return `<tr class="click" data-act="editVbt" data-id="${l.id}"><td class="nowrap">${esc(fmtDate(l.date))}</td>${showAthlete ? `<td class="nowrap">${esc(athleteName(getAthlete(l.athleteId), true))}</td>` : ''}<td>${esc(getExercise(l.exerciseId)?.name || 'Exercise')}</td>
      <td class="n nowrap">${esc(fmtMass(l.load))}</td><td class="n">${l.n || '–'}</td><td class="n nowrap"><span class="zone-sw" style="background:${z?.color || 'transparent'}"></span>${fmtNum(l.vBest, 2)}</td>
      <td class="n" style="color:${l.vl > 40 ? 'var(--bad)' : l.vl > 25 ? 'var(--warn)' : 'inherit'}">${l.vl != null && l.n > 1 ? fmtNum(l.vl, 0) + '%' : '–'}</td></tr>`;
    }).join('')}</tbody></table></div>`;
}

A.newVbt = el => openVbtModal(null, { athleteId: el.dataset.athlete || UI.vbt.athleteId || '' });
A.editVbt = el => { const l = getRec('vbt', el.dataset.id); if (l) openVbtModal(l); };
function openVbtModal(log, def = {}) {
  const isNew = !log;
  const x = log ? { ...log } : { athleteId: def.athleteId || '', exerciseId: def.exerciseId || (UI.vbt.exerciseId || ''), date: def.date || today(), load: def.load ?? null, reps: [], vBest: null, peak: null, notes: '', workoutId: def.workoutId || null };
  if (!S.exercises.some(e => e.vbt) && !S.exercises.length) { toast('Add an exercise to your library first'); return go('#/library'); }
  const body = `
    <div class="fields">
      ${field('Athlete', sel('athleteId', athleteOptions(!isNew), x.athleteId))}
      ${field('Exercise', exerciseOptions(x.exerciseId, { vbtFirst: true, allowNew: false }))}
      ${field('Date', inp('date', x.date, 'type="date"'))}
      ${field('Load', numInp('load', x.load != null ? inVal(U.massOut(x.load), 1) : '', 'autofocus'), { unit: U.mass() })}
    </div>
    ${field('Rep velocities (mean, m/s)', inp('reps', (x.reps || []).join(', '), 'inputmode="decimal" placeholder="0.82, 0.80, 0.77, 0.71" data-input="vbtPreview"'), { hint: 'Enter each rep in order. Or leave blank and enter a single velocity below.' })}
    <div class="fields">
      ${field('Single velocity', numInp('vSingle', x.reps?.length ? '' : (x.vBest ?? ''), 'data-input="vbtPreview"'), { unit: 'm/s', hint: 'Best/mean rep if not entering each rep' })}
      ${field('Peak velocity', numInp('peak', x.peak ?? ''), { unit: 'm/s', hint: 'Optional' })}
    </div>
    <div class="computed" id="vbtCalc">—</div>
    ${field('Notes', inp('notes', x.notes, 'placeholder="Optional"'))}`;
  const read = v => {
    const reps = parseVels(v.reps);
    const single = num(v.vSingle);
    const st = reps.length ? velStats(reps) : single > 0 ? { n: null, best: single, mean: single, vl: null } : null;
    return { reps, st };
  };
  const save = (v, keepOpen, m) => {
    if (!v.athleteId) return 'Choose an athlete.';
    if (!v.exerciseId) return 'Choose an exercise.';
    if (!isDS(v.date)) return 'Choose a date.';
    const load = num(v.load);
    if (load == null || load < 0) return 'Enter the load (use 0 for bodyweight-only).';
    const { reps, st } = read(v);
    if (v.reps.trim() && !reps.length) return 'Rep velocities should be numbers in m/s, e.g. 0.82, 0.79';
    if (!st) return 'Enter rep velocities or a single velocity.';
    if (st.best > 4) return 'Velocities look too high — enter metres per second (e.g. 0.75).';
    const peak = num(v.peak);
    upsert('vbt', { ...x, id: keepOpen ? undefined : x.id, createdAt: keepOpen ? null : x.createdAt, athleteId: v.athleteId, exerciseId: v.exerciseId, date: v.date, load: U.massIn(load), reps, n: st.n ?? (reps.length || null), vBest: st.best, vMean: st.mean, vl: st.vl, peak: peak > 0 ? peak : null, notes: v.notes.trim() });
    UI.vbt.athleteId = v.athleteId; UI.vbt.exerciseId = v.exerciseId;
    if (keepOpen) {
      toast('Set saved — log the next one');
      m.form.reps.value = ''; m.form.vSingle.value = ''; m.form.peak.value = ''; m.form.notes.value = '';
      m.form.load.focus(); m.form.load.select();
      A.vbtPreview(); refresh();
      return false;
    }
    toast(isNew ? 'Set logged' : 'Saved'); refresh();
  };
  openModal({
    title: isNew ? 'Log VBT set' : 'Edit VBT set', body,
    footer: isNew ? `<button type="button" class="btn" data-next>Save & log next set</button>` : '',
    onSubmit: (v, f, m) => save(v, false, m),
    onDelete: isNew ? null : async () => { if (!(await confirmBox('Delete this set?'))) return false; removeRec('vbt', x.id); toast('Set deleted'); refresh(); },
    onMount: m => {
      A.vbtPreview = () => {
        const { st } = read(formData(m.form));
        const box = $('#vbtCalc', m.wrap);
        if (!box) return;
        if (!st) { box.innerHTML = 'Velocity loss, fastest rep and zone appear here.'; return; }
        const z = zoneOf(st.best);
        box.innerHTML = `${st.n ? `Reps <b>${st.n}</b> · ` : ''}Fastest <b>${fmtNum(st.best, 2)} m/s</b>${st.n ? ` · mean <b>${fmtNum(st.mean, 2)}</b> · velocity loss <b style="color:${st.vl > 40 ? 'var(--bad)' : st.vl > 25 ? 'var(--warn)' : 'var(--good)'}">${fmtNum(st.vl, 1)}%</b>` : ''}${z ? ` · <span class="zone-sw" style="background:${z.color};display:inline-block;width:9px;height:9px;border-radius:3px"></span> ${esc(z.name)}` : ''}`;
      };
      A.vbtPreview();
      $('[data-next]', m.wrap)?.addEventListener('click', () => {
        const r = save(formData(m.form), true, m);
        if (typeof r === 'string') m.error(r); else m.error('');
      });
    },
  });
}

/* ---------------- Tested maxes ---------------- */
A.newMax = el => openMaxModal({ athleteId: el.dataset.athlete, exerciseId: '', date: today(), kg: null });
A.editMax = el => { const m = getRec('maxes', el.dataset.id); if (m) openMaxModal(m); };
function openMaxModal(x) {
  const isNew = !x.id;
  openModal({
    title: isNew ? 'Tested 1RM' : 'Edit tested 1RM', size: 'narrow',
    body: `${field('Exercise', exerciseOptions(x.exerciseId, { vbtFirst: true, allowNew: false }))}
      <div class="fields">${field('1RM', numInp('kg', x.kg != null ? inVal(U.massOut(x.kg), 1) : '', 'autofocus'), { unit: U.mass() })}${field('Date', inp('date', x.date, 'type="date"'))}</div>
      ${field('Notes', inp('notes', x.notes || '', 'placeholder="Optional"'))}`,
    onSubmit: v => {
      const kg = num(v.kg);
      if (!v.exerciseId) return 'Choose an exercise.';
      if (!(kg > 0)) return 'Enter the 1RM load.';
      if (!isDS(v.date)) return 'Choose a date.';
      upsert('maxes', { ...x, exerciseId: v.exerciseId, kg: U.massIn(kg), date: v.date, notes: v.notes.trim() });
      toast('1RM saved'); refresh();
    },
    onDelete: isNew ? null : async () => { if (!(await confirmBox('Delete this 1RM?'))) return false; removeRec('maxes', x.id); refresh(); },
  });
}

/* ---------------- Starter library ---------------- */
const STARTER = [
  ['Back Squat', 'Squat', 'Barbell, rack', 'Brace, sit between the hips, drive the floor away', 0.30],
  ['Front Squat', 'Squat', 'Barbell, rack', 'Elbows high, upright torso, knees forward', 0.30],
  ['Safety Bar Squat', 'Squat', 'Safety squat bar', 'Hands on handles, chest tall, push up through the bar', 0.30],
  ['Box Squat', 'Squat', 'Barbell, box', 'Sit back to the box, stay tight, explode up', 0.30],
  ['Goblet Squat', 'Squat', 'Dumbbell / kettlebell', 'Elbows inside knees, tall chest', null],
  ['Conventional Deadlift', 'Hinge', 'Barbell', 'Lats on, push the floor away, bar close', 0.15],
  ['Trap Bar Deadlift', 'Hinge', 'Trap bar', 'Hips and shoulders rise together, push through mid-foot', 0.20],
  ['Romanian Deadlift', 'Hinge', 'Barbell / dumbbells', 'Soft knees, hips back, neutral spine', null],
  ['Barbell Hip Thrust', 'Hinge', 'Barbell, bench', 'Chin tucked, ribs down, full hip extension', 0.25],
  ['Nordic Hamstring Curl', 'Hinge', 'Partner / Nordic bench', 'Hips extended, lower as slowly as possible', null],
  ['Kettlebell Swing', 'Hinge', 'Kettlebell', 'Hike the bell, snap the hips', null],
  ['Rear-Foot Elevated Split Squat', 'Single-leg', 'Dumbbells, bench', 'Front shin vertical-ish, drive through front foot', null],
  ['Walking Lunge', 'Single-leg', 'Dumbbells', 'Long stride, control the knee', null],
  ['Step-Up', 'Single-leg', 'Box, dumbbells', 'Drive through the top leg, no push-off', null],
  ['Single-Leg RDL', 'Single-leg', 'Dumbbell / kettlebell', 'Square hips, long line from head to heel', null],
  ['Lateral Lunge', 'Single-leg', 'Dumbbell', 'Sit into the hip, foot flat', null],
  ['Bench Press', 'Upper push', 'Barbell, bench', 'Shoulder blades set, feet planted, bar to lower chest', 0.17],
  ['Incline Dumbbell Press', 'Upper push', 'Dumbbells, bench', 'Elbows ~45°, control the bottom', null],
  ['Overhead Press', 'Upper push', 'Barbell', 'Squeeze glutes, head through at the top', 0.19],
  ['Push Press', 'Upper push', 'Barbell', 'Short dip, violent drive, press to lockout', null],
  ['Landmine Press', 'Upper push', 'Landmine, barbell', 'Ribs down, press up and forward', null],
  ['Push-Up', 'Upper push', 'Bodyweight', 'Plank position, chest to floor', null],
  ['Pull-Up', 'Upper pull', 'Pull-up bar', 'Full hang, chest to bar', null],
  ['Prone Bench Pull', 'Upper pull', 'Barbell, high bench', 'Pull bar to bench, pause briefly', 0.50],
  ['Dumbbell Row', 'Upper pull', 'Dumbbell, bench', 'Pull elbow to hip, no torso rotation', null],
  ['Inverted Row', 'Upper pull', 'Bar / rings', 'Rigid body, chest to bar', null],
  ['Face Pull', 'Upper pull', 'Cable / band', 'Pull to forehead, rotate out', null],
  ['Hang Power Clean', 'Olympic & derivatives', 'Barbell', 'Bar close, extend violently, fast elbows', null, true],
  ['Power Clean', 'Olympic & derivatives', 'Barbell', 'Patient off the floor, explode at mid-thigh', null, true],
  ['Clean Pull', 'Olympic & derivatives', 'Barbell', 'Full extension, shrug, bar close', null, true],
  ['Hang Power Snatch', 'Olympic & derivatives', 'Barbell', 'Wide grip, vertical bar path, punch overhead', null, true],
  ['Jump Shrug', 'Olympic & derivatives', 'Barbell', 'Countermovement to mid-thigh, jump and shrug', null, true],
  ['Countermovement Jump', 'Plyometric & jumps', 'Bodyweight', 'Fast dip, full extension, stick the landing', null],
  ['Trap Bar Jump', 'Plyometric & jumps', 'Trap bar', 'Load ~20–40% 1RM, jump for max height', null, true],
  ['Box Jump', 'Plyometric & jumps', 'Box', 'Jump high, land soft and quiet', null],
  ['Drop Jump', 'Plyometric & jumps', 'Box', 'Step off, minimal ground contact, bounce up', null],
  ['Hurdle Hops', 'Plyometric & jumps', 'Mini hurdles', 'Stiff ankles, quick contacts', null],
  ['Broad Jump', 'Plyometric & jumps', 'Bodyweight', 'Big arm swing, project forward, stick it', null],
  ['Pogo Jumps', 'Plyometric & jumps', 'Bodyweight', 'Stiff ankles, bounce off the floor', null],
  ['Single-Leg Bound', 'Plyometric & jumps', 'Bodyweight', 'Cycle the leg, cover distance', null],
  ['Med Ball Scoop Toss', 'Plyometric & jumps', 'Medicine ball', 'Load the hips, throw up and back', null],
  ['Med Ball Rotational Throw', 'Plyometric & jumps', 'Medicine ball, wall', 'Hips lead, throw through the wall', null],
  ['Acceleration Sprint (10–20 m)', 'Speed & agility', 'Cones / timing gates', 'Push, forward lean, long powerful steps', null],
  ['Flying Sprint (10–30 m)', 'Speed & agility', 'Cones / timing gates', 'Build-in 20–30 m, tall, relaxed, front-side mechanics', null],
  ['Resisted Sled Sprint', 'Speed & agility', 'Sled', 'Load that keeps posture; drive the ground back', null],
  ['Heavy Sled Push', 'Speed & agility', 'Sled', 'Low body angle, full extension each step', null],
  ['A-Skip', 'Speed & agility', 'Bodyweight', 'Tall, knee up, strike under hips', null],
  ['Wall Drill', 'Speed & agility', 'Wall', 'Straight line ankle to head, piston the legs', null],
  ['Pro Agility (5-10-5)', 'Speed & agility', 'Cones', 'Low hips into cuts, push off outside leg', null],
  ['Dead Bug', 'Core', 'Bodyweight', 'Low back flat, exhale fully', null],
  ['Pallof Press', 'Core', 'Cable / band', 'Resist rotation, hips square', null],
  ['Plank', 'Core', 'Bodyweight', 'Squeeze glutes, ribs down', null],
  ['Copenhagen Plank', 'Core', 'Bench', 'Hips high, straight line', null],
  ['Ab Wheel Rollout', 'Core', 'Ab wheel', 'Posterior tilt, don\'t let hips sag', null],
  ['World\'s Greatest Stretch', 'Mobility & prep', 'Bodyweight', 'Lunge, elbow to instep, rotate', null],
  ['90/90 Hip Switch', 'Mobility & prep', 'Bodyweight', 'Tall spine, control rotation', null],
  ['Ankle Rocks', 'Mobility & prep', 'Bodyweight', 'Knee over toes, heel down', null],
  ['Tempo Runs', 'Conditioning', 'Field', '~70% speed strides, walk back recovery', null],
  ['Air Bike Intervals', 'Conditioning', 'Air bike', 'Hard efforts with full or fixed recovery', null],
  ['Bulgarian Bag Spin', 'Conditioning', 'Bulgarian bag', 'Rotate around the head, brace', null],
];
function addStarterLibrary() {
  let n = 0;
  STARTER.forEach(([name, category, equipment, cues, mvt, ballistic]) => {
    if (S.exercises.some(e => e.name.toLowerCase() === name.toLowerCase())) return;
    upsert('exercises', { name, category, equipment, cues, videoUrl: '', vbt: mvt != null || !!ballistic, mvt: mvt ?? null, notes: '' });
    n++;
  });
  return n;
}
