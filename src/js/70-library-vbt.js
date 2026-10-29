/* =========================================================
   Exercise library & VBT
   ========================================================= */
const EX_CATS = ['Force plate testing', 'Squat', 'Hinge', 'Single-leg', 'Upper push', 'Upper pull', 'Olympic & derivatives', 'Plyometric & jumps', 'Speed & agility', 'Isometric', 'Core', 'Accessory', 'Mobility & prep', 'Conditioning', 'Other'];

ROUTES.library = () => {
  const L = UI.lib;
  const cats = EX_CATS.filter(c => S.exercises.some(e => e.category === c));
  const body = S.exercises.length ? `
    ${(() => { const n = newStarterCount(); return n ? `<div class="banner info">${icon('book')}<div class="grow"><b>${plural(n, 'new exercise')} available</b> in the expanded starter library (squat, hinge, plyometric, speed, isometric, accessory and more).</div><button class="btn sm primary" data-act="loadStarter">Add them</button><button class="btn sm ghost" data-act="dismissStarter">Dismiss</button></div>` : ''; })()}
    <div class="toolbar"><div class="searchbox grow">${icon('search', 'sm')}<input type="search" placeholder="Search exercises, equipment, cues…" value="${esc(L.q)}" data-input="libSearch" aria-label="Search exercises"></div></div>
    <div class="chips scroll" style="margin-bottom:14px">
      <button class="chip ${L.cat === 'all' ? 'on' : ''}" data-act="libCat" data-v="all">All (${S.exercises.length})</button>
      <button class="chip ${L.cat === 'vbt' ? 'on' : ''}" data-act="libCat" data-v="vbt">${icon('zap', 'sm')}VBT</button>
      ${cats.map(c => `<button class="chip ${L.cat === c ? 'on' : ''}" data-act="libCat" data-v="${esc(c)}">${esc(c)}</button>`).join('')}
    </div>
    <div id="libResults">${libraryResults()}</div>` :
    `<div class="card">${emptyState_('book', 'Your exercise library is empty', `Add the exercises you coach — with cues, equipment, video links and VBT settings. You can also start from a curated set of ${STARTER.length} common exercises and ${Object.keys(FP_TESTS).length} force plate tests, and edit them freely.`, `<div class="chips" style="justify-content:center"><button class="btn primary" data-act="newExercise">${icon('plus', 'sm')}Add exercise</button><button class="btn" data-act="loadStarter">Load starter library</button></div>`)}</div>`;
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
    return `<div class="section-title">${esc(c)} <span class="faint">· ${items.length}</span></div>${c === FP_CAT ? '<p class="small muted" style="margin:-4px 0 8px">Add a test to a workout and log it in the session: the results save to the athlete’s testing as a dated test, and PRs update automatically.</p>' : ''}<div class="card" style="padding:4px 14px">${items.map(e => {
      const used = S.workouts.reduce((n, w) => n + (w.items || []).filter(i => i.exerciseId === e.id).length, 0);
      return `<button class="row" data-act="editExercise" data-id="${e.id}"><span class="row-main"><span class="row-title">${esc(e.name)}</span><span class="row-sub">${esc([e.equipment, e.cues].filter(Boolean).join(' · ') || '—')}</span></span>
        ${fpTestOf(e) ? `<span class="badge info">${icon('activity', 'sm')}Test</span>` : ''}${e.vbt ? `<span class="badge info">${icon('zap', 'sm')}VBT${e.mvt ? ` · MVT ${fmtNum(e.mvt, 2)}` : ''}</span>` : ''}${used ? `<span class="faint tiny nowrap">${plural(used, 'use')}</span>` : ''}${icon('chevR', 'sm')}</button>`;
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
  const x = e ? { ...e } : { name: '', category: UI.lib.cat !== 'all' && UI.lib.cat !== 'vbt' ? UI.lib.cat : 'Squat', equipment: '', cues: '', videoUrl: '', vbt: UI.lib.cat === 'vbt', mvt: null, notes: '', fpTest: null };
  const fpLogs = k => (fpHas(k) ? `Logs ${esc(fpLogsText(FP_TESTS[k]))}. Log it in a session and the results save to the athlete’s testing.` : 'A training exercise. Choose a test to log force plate results in sessions.');
  const body = `
    ${field('Name', inp('name', x.name, 'autofocus required autocapitalize="words"'))}
    <div class="fields">
      ${field('Category', sel('category', EX_CATS, x.category))}
      ${field('Equipment', inp('equipment', x.equipment, 'placeholder="Barbell, rack"'))}
    </div>
    ${field('Force plate test', sel('fpTest', [['', 'No (training exercise)'], ...Object.entries(FP_TESTS).map(([k, t]) => [k, t.name])], x.fpTest || ''), { hint: `<span data-fp-logs>${fpLogs(x.fpTest)}</span>` })}
    ${field('Coaching cues', ta('cues', x.cues, 'rows="2" placeholder="e.g. Brace, push the floor away, drive hips through"'))}
    ${field('Video link', inp('videoUrl', x.videoUrl, 'type="url" placeholder="https://…" autocapitalize="off"'), { hint: 'Optional demo video (opens when online).' })}
    <div class="card" style="padding:4px 14px;margin-bottom:14px;box-shadow:none">
      ${toggleRow('vbt', x.vbt, 'Track with velocity (VBT)', 'Show this exercise in VBT logging and load–velocity profiles.')}
      <div class="settings-row" style="display:block">${field('Estimated 1RM', sel('e1rmLift', [['auto', 'Automatic (by name)'], ['none', 'Off'], ...Object.entries(E1RM_LIFTS).map(([k, v]) => [k, 'Calculate as ' + v.label.toLowerCase()])], x.e1rmLift || 'auto'), { hint: 'Estimated 1RMs are calculated for back squat, front squat, bench press and trap bar deadlift. Use this if you named one of them differently.' })}
      ${field('Velocity threshold (MVT)', numInp('mvt', x.mvt ?? ''), { unit: 'm/s', hint: 'Optional library default for the 1RM bar speed. Leave blank to use the research value; each athlete’s tested maxes calibrate their own.' })}</div>
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
      upsert('exercises', { ...x, name, category: v.category, equipment: v.equipment.trim(), cues: v.cues.trim(), videoUrl: v.videoUrl.trim(), vbt: !!v.vbt, mvt, e1rmLift: v.e1rmLift === 'auto' ? null : v.e1rmLift, notes: v.notes.trim(), fpTest: fpHas(v.fpTest) ? v.fpTest : null });
      toast(isNew ? 'Exercise added' : 'Saved'); refresh();
    },
    onMount: m => { $('[name=fpTest]', m.wrap).addEventListener('change', ev => { $('[data-fp-logs]', m.wrap).innerHTML = fpLogs(ev.target.value); }); },
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
        ${rirCard()}
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
      ${field('Velocity of the 1RM rep (optional)', numInp('v1rm', x.v1rm ?? ''), { unit: 'm/s', hint: 'Mean velocity from your VBT device on the successful max rep. This becomes the athlete’s own threshold and makes estimated 1RMs more accurate.' })}
      ${field('Notes', inp('notes', x.notes || '', 'placeholder="Optional"'))}`,
    onSubmit: v => {
      const kg = num(v.kg);
      if (!v.exerciseId) return 'Choose an exercise.';
      if (!(kg > 0)) return 'Enter the 1RM load.';
      if (!isDS(v.date)) return 'Choose a date.';
      const v1 = num(v.v1rm);
      if (v.v1rm.trim() && !(v1 > 0.05 && v1 < 0.7)) return 'The 1RM rep velocity should be between 0.05 and 0.70 m/s.';
      upsert('maxes', { ...x, exerciseId: v.exerciseId, kg: U.massIn(kg), date: v.date, v1rm: v1 || null, notes: v.notes.trim() });
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

  /* ---- Expanded library ---- */
  ['Pause Back Squat', 'Squat', 'Barbell, rack', '2 s pause in the hole, stay tight, drive up', 0.30],
  ['Tempo Back Squat (3-1-1)', 'Squat', 'Barbell, rack', '3 s down, 1 s pause, fast up', null],
  ['Pin Squat', 'Squat', 'Barbell, rack, pins', 'Start dead from the pins, brace before every rep', 0.30],
  ['Zercher Squat', 'Squat', 'Barbell', 'Bar in elbow crease, upright torso', null],
  ['Belt Squat', 'Squat', 'Belt squat machine', 'Sit down between the heels, knees track toes', null],
  ['Heel-Elevated Goblet Squat', 'Squat', 'Dumbbell, wedge', 'Knees forward, upright chest, full depth', null],
  ['Landmine Squat', 'Squat', 'Landmine, barbell', 'Hold bar at chest, sit between hips', null],
  ['Jump Squat (Barbell)', 'Squat', 'Barbell', 'Light load (~20–30% 1RM), jump for max height, land soft', null, true],
  ['Dumbbell Squat Jump', 'Squat', 'Dumbbells', 'Arms by sides, quick dip, jump high', null],
  ['Hex Bar Deadlift (High Handle)', 'Hinge', 'Trap bar', 'Push the floor away, hips and chest rise together', 0.20],
  ['Sumo Deadlift', 'Hinge', 'Barbell', 'Wide stance, knees out, chest tall', 0.15],
  ['Rack Pull', 'Hinge', 'Barbell, rack', 'Lats tight, drive hips through', null],
  ['Single-Leg Hip Thrust', 'Hinge', 'Bench', 'Ribs down, full hip extension, level hips', null],
  ['Glute Bridge', 'Hinge', 'Bodyweight / barbell', 'Posterior tilt, squeeze at the top', null],
  ['Good Morning', 'Hinge', 'Barbell', 'Soft knees, hips back, neutral spine', null],
  ['45° Back Extension', 'Hinge', 'Hyperextension bench', 'Hinge from hips, squeeze glutes at top', null],
  ['Reverse Hyper', 'Hinge', 'Reverse hyper machine', 'Swing legs up with glutes, control down', null],
  ['Glute-Ham Raise', 'Hinge', 'GHD', 'Knees on pad, hips extended, curl body up', null],
  ['Slider Hamstring Curl', 'Hinge', 'Sliders', 'Hips high, slow eccentric', null],
  ['Kettlebell Deadlift', 'Hinge', 'Kettlebell', 'Hips back, lats on, stand tall', null],
  ['Snatch-Grip RDL', 'Hinge', 'Barbell', 'Wide grip, bar close, hamstrings loaded', null],
  ['Bulgarian Split Squat Jump', 'Single-leg', 'Bench', 'Rear foot on bench, explode up, land soft', null],
  ['Split Squat', 'Single-leg', 'Dumbbells', 'Vertical torso, back knee to floor', null],
  ['Reverse Lunge', 'Single-leg', 'Dumbbells', 'Step back, front shin vertical, drive up', null],
  ['Front-Foot Elevated Split Squat', 'Single-leg', 'Dumbbells, plate', 'Deep range, front knee forward', null],
  ['Curtsy Lunge', 'Single-leg', 'Dumbbells', 'Cross behind, hips square', null],
  ['Lateral Step-Up', 'Single-leg', 'Box', 'Drive through top foot, control down', null],
  ['Skater Squat', 'Single-leg', 'Bodyweight', 'Back knee to pad, hips back', null],
  ['Pistol Squat (to Box)', 'Single-leg', 'Box', 'Arms forward, sit back to box, stand on one leg', null],
  ['Cossack Squat', 'Single-leg', 'Bodyweight / kettlebell', 'Sit into one hip, opposite leg straight', null],
  ['Single-Leg Box Squat', 'Single-leg', 'Box', 'Control down, tap, drive up', null],
  ['Single-Leg Glute Bridge', 'Single-leg', 'Bodyweight', 'Drive through heel, hips level', null],
  ['Dumbbell Bench Press', 'Upper push', 'Dumbbells, bench', 'Shoulder blades set, press up and in', null],
  ['Close-Grip Bench Press', 'Upper push', 'Barbell, bench', 'Elbows tucked, bar to lower chest', 0.17],
  ['Floor Press', 'Upper push', 'Barbell / dumbbells', 'Elbows touch floor, pause, press', null],
  ['Incline Bench Press', 'Upper push', 'Barbell, incline bench', 'Bar to upper chest, wrists stacked', null],
  ['Dumbbell Overhead Press', 'Upper push', 'Dumbbells', 'Ribs down, press overhead, biceps by ears', null],
  ['Half-Kneeling Landmine Press', 'Upper push', 'Landmine, barbell', 'Squeeze down-knee glute, press up and forward', null],
  ['Dips', 'Upper push', 'Dip bars', 'Shoulders down, elbows back, controlled depth', null],
  ['Plyometric Push-Up', 'Upper push', 'Bodyweight', 'Explode so hands leave floor, land soft', null],
  ['Med Ball Chest Pass', 'Upper push', 'Medicine ball, wall', 'Step and throw hard from chest', null],
  ['Bench Throw (Smith)', 'Upper push', 'Smith machine', 'Light load, throw and catch the bar', null, true],
  ['Single-Arm Dumbbell Press', 'Upper push', 'Dumbbell, bench', 'Resist rotation, press straight up', null],
  ['Push Jerk', 'Olympic & derivatives', 'Barbell', 'Dip, drive, punch under, lock out', null, true],
  ['Split Jerk', 'Olympic & derivatives', 'Barbell', 'Dip, drive, split feet, lock out', null, true],
  ['Chin-Up', 'Upper pull', 'Pull-up bar', 'Supinated grip, chest to bar', null],
  ['Weighted Pull-Up', 'Upper pull', 'Pull-up bar, belt', 'Full hang to chin over bar', null],
  ['Lat Pulldown', 'Upper pull', 'Cable machine', 'Chest up, pull elbows to ribs', null],
  ['Seated Cable Row', 'Upper pull', 'Cable machine', 'Tall posture, squeeze shoulder blades', null],
  ['Chest-Supported Row', 'Upper pull', 'Dumbbells, incline bench', 'Chest on pad, pull to hips', null],
  ['Pendlay Row', 'Upper pull', 'Barbell', 'Flat back, bar from floor to sternum', null],
  ['Single-Arm Cable Row', 'Upper pull', 'Cable', 'Reach, then row with rotation control', null],
  ['Band Pull-Apart', 'Upper pull', 'Band', 'Straight arms, squeeze shoulder blades', null],
  ['Rope Climb', 'Upper pull', 'Rope', 'Grip hard, use legs, control descent', null],
  ['Hang Clean', 'Olympic & derivatives', 'Barbell', 'From above knee, extend violently, catch in squat', null, true],
  ['Hang High Pull', 'Olympic & derivatives', 'Barbell', 'Extend, shrug, elbows high and out', null, true],
  ['Snatch Pull', 'Olympic & derivatives', 'Barbell', 'Wide grip, full extension', null, true],
  ['Mid-Thigh Clean Pull', 'Olympic & derivatives', 'Barbell, blocks', 'Start at mid-thigh, extend violently', null, true],
  ['Dumbbell Snatch', 'Olympic & derivatives', 'Dumbbell', 'Hinge, explode, punch overhead', null],
  ['Kettlebell Clean', 'Olympic & derivatives', 'Kettlebell', 'Hike, extend, tame the arc', null],
  ['Dumbbell Hang Clean', 'Olympic & derivatives', 'Dumbbells', 'Hinge, jump, catch at shoulders', null],
  ['Squat Jump', 'Plyometric & jumps', 'Bodyweight', 'Hold bottom 2 s, jump with no dip', null],
  ['Seated Box Jump', 'Plyometric & jumps', 'Box, bench', 'From seated, explode up onto box', null],
  ['Depth Drop (Landing)', 'Plyometric & jumps', 'Box', 'Step off, stick the landing quietly', null],
  ['Snap-Down', 'Plyometric & jumps', 'Bodyweight', 'Arms up, snap down into athletic stance fast', null],
  ['Tuck Jump', 'Plyometric & jumps', 'Bodyweight', 'Knees to chest, quick contacts', null],
  ['Lateral Hurdle Hops', 'Plyometric & jumps', 'Mini hurdles', 'Stiff ankles, hips square', null],
  ['Single-Leg Hop (Stick)', 'Plyometric & jumps', 'Bodyweight', 'Hop forward and stick 2 s', null],
  ['Single-Leg Lateral Bound', 'Plyometric & jumps', 'Bodyweight', 'Push off outside leg, stick the landing', null],
  ['Skater Bound', 'Plyometric & jumps', 'Bodyweight', 'Lateral bound, absorb, rebound', null],
  ['Triple Broad Jump', 'Plyometric & jumps', 'Bodyweight', 'Three continuous broad jumps', null],
  ['Continuous Broad Jump', 'Plyometric & jumps', 'Bodyweight', 'Rebound quickly between jumps', null],
  ['Line Hops', 'Plyometric & jumps', 'Line', 'Fast, small hops over a line', null],
  ['Ankle Hops', 'Plyometric & jumps', 'Bodyweight', 'Stiff knees, bounce off the ball of the foot', null],
  ['Repeated Vertical Jumps', 'Plyometric & jumps', 'Bodyweight', 'Max height, minimal ground time', null],
  ['Med Ball Overhead Throw (Backward)', 'Plyometric & jumps', 'Medicine ball', 'Hinge, extend explosively, throw back overhead', null],
  ['Med Ball Slam', 'Plyometric & jumps', 'Slam ball', 'Full extension, slam hard', null],
  ['Med Ball Shot Put Throw', 'Plyometric & jumps', 'Medicine ball', 'Hips lead, push from shoulder', null],
  ['Kneeling Med Ball Chest Pass', 'Plyometric & jumps', 'Medicine ball', 'Tall kneeling, explosive push', null],
  ['Weighted Jump (Vest)', 'Plyometric & jumps', 'Weight vest', 'Light load, max intent', null],
  ['Falling Start', 'Speed & agility', 'Cones', 'Lean until you must step, then drive', null],
  ['Half-Kneeling Start', 'Speed & agility', 'Cones', 'Drive front leg, low and long first steps', null],
  ['Push-Up Start Sprint', 'Speed & agility', 'Cones', 'From prone, react and accelerate', null],
  ['3-Point Start (10 yd)', 'Speed & agility', 'Cones / timing gates', 'Hips high, explosive first step', null],
  ['Build-Up Sprint', 'Speed & agility', 'Field', 'Gradually accelerate to ~90–95%', null],
  ['Wicket Runs', 'Speed & agility', 'Mini hurdles', 'Tall posture, front-side mechanics, rhythm', null],
  ['B-Skip', 'Speed & agility', 'Bodyweight', 'Knee up, extend, paw back under hips', null],
  ['A-March', 'Speed & agility', 'Bodyweight', 'Tall, dorsiflexed, opposite arm', null],
  ['Straight-Leg Bounds', 'Speed & agility', 'Bodyweight', 'Stiff legs, strike under hips', null],
  ['Dribbles', 'Speed & agility', 'Bodyweight', 'Ankle over ankle, quick cycle', null],
  ['Hill Sprint', 'Speed & agility', 'Hill', 'Drive knees, push the ground back', null],
  ['Sled March', 'Speed & agility', 'Sled', 'Big leg drive, forward lean, full extension', null],
  ['Banded Resisted Sprint', 'Speed & agility', 'Band, partner', 'Partner resists, keep posture', null],
  ['505 Change of Direction', 'Speed & agility', 'Cones / timing gates', 'Lower before the turn, push out', null],
  ['L-Drill (3-Cone)', 'Speed & agility', 'Cones', 'Tight turns, low hips', null],
  ['T-Drill', 'Speed & agility', 'Cones', 'Shuffle without crossing, face forward', null],
  ['Lateral Shuffle', 'Speed & agility', 'Cones', 'Low hips, push off outside leg', null],
  ['Crossover Run', 'Speed & agility', 'Cones', 'Hip turn, cross over, accelerate', null],
  ['Deceleration Drill', 'Speed & agility', 'Cones', 'Sprint 10 m, stop in 3 steps, low hips', null],
  ['Reactive Agility (Mirror)', 'Speed & agility', 'Partner', 'React to partner, stay low', null],
  ['Ladder: Two Feet In', 'Speed & agility', 'Agility ladder', 'Quick feet, light contacts', null],
  ['Ladder: Icky Shuffle', 'Speed & agility', 'Agility ladder', 'In-in-out rhythm', null],
  ['Isometric Mid-Thigh Pull', 'Isometric', 'Rack / force plate', 'Pull as hard and fast as possible for 3–5 s', null],
  ['Isometric Squat', 'Isometric', 'Rack, pins', 'Push into the pins as hard and fast as possible', null],
  ['Isometric Split Squat', 'Isometric', 'Rack / strap', 'Hold position, drive maximally', null],
  ['Isometric Calf Raise', 'Isometric', 'Rack / force plate', 'Push up into the bar through the forefoot', null],
  ['Long-Lever Isometric Hamstring Bridge', 'Isometric', 'Box', 'Heels on box, knees slightly bent, hold hips up', null],
  ['Wall Sit', 'Isometric', 'Wall', 'Thighs parallel, back flat', null],
  ['Overcoming Isometric Bench Press', 'Isometric', 'Rack, pins', 'Press into pins maximally', null],
  ['Isometric Pull-Up Hold', 'Isometric', 'Pull-up bar', 'Chin over bar, hold', null],
  ['Copenhagen Adductor Hold', 'Isometric', 'Bench', 'Top leg on bench, hips high, hold', null],
  ['Side Plank', 'Core', 'Bodyweight', 'Straight line, hips forward', null],
  ['Hollow Hold', 'Core', 'Bodyweight', 'Low back down, arms overhead', null],
  ['Bird Dog', 'Core', 'Bodyweight', 'Reach long, no rotation', null],
  ['Suitcase Carry', 'Core', 'Dumbbell / kettlebell', 'Stay tall, don’t lean', null],
  ['Farmer Carry', 'Core', 'Dumbbells / handles', 'Tall posture, quick steps', null],
  ['Half-Kneeling Cable Chop', 'Core', 'Cable', 'Rotate through ribs, hips stable', null],
  ['Half-Kneeling Cable Lift', 'Core', 'Cable', 'Low to high, stay tall', null],
  ['Hanging Knee Raise', 'Core', 'Pull-up bar', 'Posterior tilt, no swinging', null],
  ['Landmine Rotation', 'Core', 'Landmine, barbell', 'Pivot feet, rotate from hips', null],
  ['Stir the Pot', 'Core', 'Stability ball', 'Plank on ball, small circles', null],
  ['Body Saw', 'Core', 'Sliders', 'Plank, slide forward and back', null],
  ['Med Ball Russian Twist', 'Core', 'Medicine ball', 'Rotate from ribs, controlled', null],
  ['Nordic Reverse (Quad)', 'Accessory', 'Pad', 'Kneel, lean back with hips extended', null],
  ['Tibialis Raise', 'Accessory', 'Wall / tib bar', 'Lift toes toward shins, full range', null],
  ['Standing Calf Raise', 'Accessory', 'Machine / dumbbells', 'Full range, pause at top', null],
  ['Seated Calf Raise', 'Accessory', 'Machine', 'Knees bent, full range', null],
  ['Single-Leg Calf Raise', 'Accessory', 'Step', 'Full range, slow down', null],
  ['Leg Extension', 'Accessory', 'Machine', 'Squeeze at top, control down', null],
  ['Leg Curl', 'Accessory', 'Machine', 'Control the eccentric', null],
  ['Adductor Squeeze', 'Accessory', 'Ball / pad', 'Squeeze maximally, hold', null],
  ['Banded Lateral Walk', 'Accessory', 'Band', 'Stay low, push knees out', null],
  ['Hip Airplane', 'Accessory', 'Bodyweight', 'Rotate pelvis over standing leg', null],
  ['Dumbbell Curl', 'Accessory', 'Dumbbells', 'Elbows still, full range', null],
  ['Hammer Curl', 'Accessory', 'Dumbbells', 'Neutral grip, controlled', null],
  ['Triceps Pushdown', 'Accessory', 'Cable', 'Elbows pinned, lock out', null],
  ['Skull Crusher', 'Accessory', 'EZ bar', 'Elbows in, lower behind head', null],
  ['Dumbbell Lateral Raise', 'Accessory', 'Dumbbells', 'Lead with elbows, to shoulder height', null],
  ['External Rotation (Band)', 'Accessory', 'Band', 'Elbow at side, rotate out', null],
  ['Y-T-W Raise', 'Accessory', 'Dumbbells, incline bench', 'Thumbs up, squeeze shoulder blades', null],
  ['Neck Isometrics', 'Accessory', 'Bodyweight / band', 'Resist in 4 directions', null],
  ['Wrist Roller', 'Accessory', 'Wrist roller', 'Roll up and down under control', null],
  ['Plate Pinch', 'Accessory', 'Plates', 'Pinch smooth sides, hold', null],
  ['Foam Roll', 'Mobility & prep', 'Foam roller', 'Slow passes, breathe', null],
  ['Leg Swings', 'Mobility & prep', 'Wall', 'Front/back and side to side', null],
  ['Walking Knee Hug', 'Mobility & prep', 'Bodyweight', 'Pull knee to chest, rise on toes', null],
  ['Walking Quad Pull', 'Mobility & prep', 'Bodyweight', 'Heel to glute, reach opposite arm', null],
  ['Inchworm', 'Mobility & prep', 'Bodyweight', 'Walk hands out, keep legs straight', null],
  ['Spiderman Lunge + Reach', 'Mobility & prep', 'Bodyweight', 'Elbow to instep, rotate up', null],
  ['Hip Flexor Stretch (Half-Kneeling)', 'Mobility & prep', 'Bodyweight', 'Squeeze glute, tuck pelvis', null],
  ['Couch Stretch', 'Mobility & prep', 'Wall / bench', 'Shin on wall, squeeze glute', null],
  ['Thoracic Rotation (Open Book)', 'Mobility & prep', 'Bodyweight', 'Side-lying, rotate chest open', null],
  ['Shoulder CARs', 'Mobility & prep', 'Bodyweight', 'Slow controlled circles, no compensation', null],
  ['Hip CARs', 'Mobility & prep', 'Bodyweight', 'Slow controlled circles at the hip', null],
  ['Glute Activation Mini-Band Series', 'Mobility & prep', 'Mini band', 'Bridges, clams, lateral walks', null],
  ['Pogo Warm-Up', 'Mobility & prep', 'Bodyweight', 'Low-amplitude bounces to prep ankles', null],
  ['Sled Drag (Backward)', 'Conditioning', 'Sled', 'Small steps, quads burning, upright', null],
  ['Shuttle Run (5-10-5 repeats)', 'Conditioning', 'Cones', 'Hard turns, set rest', null],
  ['300 yd Shuttle', 'Conditioning', 'Cones', '6 × 50 yd, record time', null],
  ['Rowing Intervals', 'Conditioning', 'Rower', 'Legs-body-arms, consistent splits', null],
  ['Bike Sprints', 'Conditioning', 'Air bike', 'All-out 6–10 s, full recovery', null],
  ['Repeated Sprint Ability (6 × 30 m)', 'Conditioning', 'Field', 'Max effort, short fixed rest', null],
  ['Jump Rope', 'Conditioning', 'Jump rope', 'Light, quick contacts', null],
  ['Battle Ropes', 'Conditioning', 'Battle ropes', 'Waves from the hips, stay low', null],
  ['Prowler Push Intervals', 'Conditioning', 'Prowler', 'Low angle, drive hard', null],
  ['Bear Crawl', 'Conditioning', 'Bodyweight', 'Knees hovering, opposite hand/foot', null],
];
function newStarterCount() {
  const offered = new Set(S.settings.starterOffered || STARTER.slice(0, 60).map(x => x[0].toLowerCase()));
  return STARTER.filter(([n]) => !offered.has(n.toLowerCase()) && !S.exercises.some(e => e.name.toLowerCase() === n.toLowerCase())).length;
}
A.dismissStarter = () => { S.settings.starterOffered = STARTER.map(x => x[0].toLowerCase()); persist(); refresh(); };
function addStarterLibrary() {
  let n = 0;
  STARTER.forEach(([name, category, equipment, cues, mvt, ballistic]) => {
    if (S.exercises.some(e => e.name.toLowerCase() === name.toLowerCase())) return;
    upsert('exercises', { name, category, equipment, cues, videoUrl: '', vbt: mvt != null || !!ballistic, mvt: mvt ?? null, notes: '' });
    n++;
  });
  fpMissing().forEach(k => { delete S.deleted[FP_TESTS[k].id]; upsert('exercises', fpExerciseRec(k)); n++; });
  S.settings.starterOffered = STARTER.map(x => x[0].toLowerCase());
  persist();
  return n;
}
