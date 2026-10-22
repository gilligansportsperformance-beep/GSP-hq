/* =========================================================
   Programming: athlete program calendar & workout builder
   ========================================================= */
const INTENSITY = [['load', 'Load'], ['pct', '% 1RM'], ['zone', 'Velocity zone'], ['vel', 'Target velocity'], ['rpe', 'RPE'], ['bw', 'Bodyweight / none']];

function athProgram(a, r) {
  const P = (UI.prog[a.id] ||= { cursor: today(), sel: today() });
  if (r.q.d && isDS(r.q.d) && P._deep !== r.q.d) { P.sel = r.q.d; P.cursor = r.q.d; P._deep = r.q.d; }
  const wos = S.workouts.filter(w => w.athleteId === a.id);
  const evs = eventsFor(a.id);
  const d = parseDS(P.cursor);
  const grid = monthGrid(P.cursor, P.sel, ds => {
    const dw = wos.filter(w => w.date === ds);
    const de = evs.filter(e => e.date === ds && e.status !== 'cancelled');
    const chips = dw.map(w => `<span class="ev-chip ${w.completed ? 'done' : ''}" style="--c:${w.completed ? 'var(--good)' : 'var(--accent)'}">${w.completed ? '✓ ' : ''}${esc(w.title || 'Workout')}</span>`).join('');
    const evc = de.map(e => `<span class="ev-chip" style="--c:${typeColor(e.type)};opacity:.7">${e.start ? esc(fmtTime(e.start)) + ' ' : ''}${esc(typeLabel(e.type))}</span>`).join('');
    const dots = `<span class="dots">${dw.map(w => `<span class="dot" style="--c:${w.completed ? 'var(--good)' : 'var(--accent)'}"></span>`).join('')}${de.map(e => `<span class="dot wodot" style="border-color:${typeColor(e.type)}"></span>`).join('')}</span>`;
    return chips + evc + dots;
  }, 'progSelect');
  const dayWos = wos.filter(w => w.date === P.sel);
  const dayEvs = evs.filter(e => e.date === P.sel);
  const done = wos.filter(w => w.completed).length;
  const body = `
    <div class="cal-bar">
      <button class="btn icon" data-act="progNav" data-a="${a.id}" data-d="-1" aria-label="Previous month">${icon('chevL')}</button>
      <button class="btn icon" data-act="progNav" data-a="${a.id}" data-d="1" aria-label="Next month">${icon('chevR')}</button>
      <h3>${esc(d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' }))}</h3>
      <button class="btn sm" data-act="progToday" data-a="${a.id}">Today</button>
      <span class="grow"></span>
      <span class="faint small">${plural(wos.length, 'workout')} · ${done} completed</span>
    </div>
    ${grid}
    <div class="agenda-day">
      <div class="split" style="margin-bottom:8px;flex-wrap:wrap"><h4 class="${P.sel === today() ? 'is-today' : ''}" style="margin:0">${esc(fmtDateLong(P.sel))}</h4>
        <div class="chips"><button class="btn sm" data-act="copyWeek" data-a="${a.id}" data-date="${P.sel}">${icon('copy', 'sm')}Copy week</button><button class="btn sm primary" data-act="newWorkout" data-a="${a.id}" data-date="${P.sel}">${icon('plus', 'sm')}Workout</button></div></div>
      ${dayEvs.length ? `<div class="card" style="padding:4px 12px;margin-bottom:12px">${dayEvs.map(e => eventRow(e)).join('')}</div>` : ''}
      ${dayWos.length ? dayWos.map(w => workoutCard(w)).join('') : `<div class="card">${emptyState_('dumbbell', 'No workout programmed', 'Build a session from your exercise library with sets, reps, loads, %1RM or velocity targets.', `<button class="btn primary" data-act="newWorkout" data-a="${a.id}" data-date="${P.sel}">${icon('plus', 'sm')}Add workout</button>`)}</div>`}
    </div>`;
  return { body, actions: `<button class="btn primary" data-act="newWorkout" data-a="${a.id}" data-date="${P.sel}">${icon('plus', 'sm')}<span class="lbl">Workout</span></button>` };
}
A.progSelect = el => {
  const aid = parseHash().parts[0];
  const P = UI.prog[aid];
  if (!P) return;
  const ds = el.dataset.date;
  P.sel = ds;
  if (monthStart(ds) !== monthStart(P.cursor)) P.cursor = ds;
  refresh();
  if (window.innerWidth < 700) $('.agenda-day')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
};
A.progNav = el => { const P = UI.prog[el.dataset.a]; P.cursor = addMonths(monthStart(P.cursor), +el.dataset.d); refresh(); };
A.progToday = el => { const P = UI.prog[el.dataset.a]; P.cursor = P.sel = today(); refresh(); };

function intensityText(it, aid) {
  const orm = it.exerciseId ? bestOneRM(aid, it.exerciseId) : null;
  switch (it.intensity) {
    case 'load': return it.load != null ? `<b>${esc(fmtMass(it.load))}</b>` : '';
    case 'pct': {
      if (it.pct == null) return '';
      const kg = orm ? orm.kg * it.pct / 100 : null;
      return `<b>${fmtNum(it.pct, 1, 0)}% 1RM</b>${kg ? ` ≈ <b>${esc(fmtMass(roundLoad(kg)))}</b> <span class="faint">(${orm.source === 'tested' ? 'tested' : 'est.'} 1RM ${esc(fmtMass(orm.kg))})</span>` : ' <span class="faint">(no 1RM on file)</span>'}`;
    }
    case 'zone': {
      const z = ZONES.find(z => z.key === it.zone);
      if (!z) return '';
      return `<b>${esc(z.name)}</b> ${fmtNum(z.min, 2)}–${fmtNum(z.max, 2)} m/s${loadRangeForVel(aid, it.exerciseId, z.min, z.max)}`;
    }
    case 'vel': {
      if (it.vMin == null && it.vMax == null) return '';
      const lo = it.vMin ?? it.vMax, hi = it.vMax ?? it.vMin;
      return `<b>${fmtNum(lo, 2)}${hi !== lo ? '–' + fmtNum(hi, 2) : ''} m/s</b>${loadRangeForVel(aid, it.exerciseId, lo, hi)}`;
    }
    case 'rpe': return it.rpe != null ? `<b>RPE ${fmtNum(it.rpe, 1, 0)}</b>` : '';
    default: return '';
  }
}
function roundLoad(kg) { return U.imp() ? U.massIn(Math.round(U.massOut(kg) / 5) * 5) : Math.round(kg / 2.5) * 2.5; }
function loadRangeForVel(aid, exId, vLo, vHi) {
  if (!exId) return '';
  const p = lvProfile(aid, exId, { from: addDays(today(), -84) });
  if (!p.reg || p.reg.b >= 0 || p.loadsN < 3) return '';
  const l1 = (vHi - p.reg.a) / p.reg.b, l2 = (vLo - p.reg.a) / p.reg.b;
  if (!(l1 > 0 && l2 > 0)) return '';
  return ` <span class="faint">≈ ${esc(fmtMass(roundLoad(Math.min(l1, l2)), false))}–${esc(fmtMass(roundLoad(Math.max(l1, l2))))} from profile</span>`;
}
function workoutCard(w) {
  const items = w.items || [];
  const logs = S.vbt.filter(l => l.athleteId === w.athleteId && l.date === w.date);
  return `<div class="wo">
    <div class="wo-head">
      <h4>${esc(w.title || 'Workout')}${w.phase ? ` <span class="badge info">${esc(w.phase)}</span>` : ''}</h4>
      ${w.completed ? `<span class="badge good">${icon('check', 'sm')}Completed${w.rpe != null ? ` · sRPE ${fmtNum(w.rpe, 1, 0)}` : ''}${w.durationMin ? ` · ${w.durationMin} min` : ''}</span>` : `<span class="badge">Planned</span>`}
    </div>
    ${w.notes ? `<div class="small muted" style="margin-top:6px;white-space:pre-wrap">${esc(w.notes)}</div>` : ''}
    <div class="wo-items">${items.map(it => {
      const ex = getExercise(it.exerciseId);
      const its = intensityText(it, w.athleteId);
      const exLogs = logs.filter(l => l.exerciseId === it.exerciseId);
      return `<div class="wo-item"><div class="row-main" style="white-space:normal">
        <div class="nm">${esc(ex?.name || it.name || 'Exercise')}</div>
        <div class="rx">${[it.sets || it.reps ? `<b>${esc(it.sets || '–')} × ${esc(it.reps || '–')}</b>` : '', its, it.vlCutoff ? `stop at <b>${fmtNum(it.vlCutoff, 0)}% VL</b>` : '', it.rest ? `rest ${esc(it.rest)}` : ''].filter(Boolean).join(' · ')}</div>
        ${it.notes ? `<div class="small faint">${esc(it.notes)}</div>` : ''}
        ${loggedSummary(w, it, exLogs)}
      </div>${ex?.vbt ? `<button class="btn sm ghost" data-act="logFromWorkout" data-w="${w.id}" data-ex="${it.exerciseId}" data-load="${it.intensity === 'load' && it.load ? it.load : ''}" title="Log a VBT set">${icon('gauge', 'sm')}<span>Log</span></button>` : ''}</div>`;
    }).join('') || '<div class="muted small">No exercises yet.</div>'}</div>
    <div class="wo-actions">
      <button class="btn sm primary" data-act="logSession" data-id="${w.id}">${icon('clipboard', 'sm')}${w.log && Object.keys(w.log).length ? 'Edit session log' : 'Log session'}</button>
      ${w.completed ? `<button class="btn sm" data-act="completeWorkout" data-id="${w.id}">${icon('edit', 'sm')}Session RPE</button>` : `<button class="btn sm" data-act="completeWorkout" data-id="${w.id}">${icon('check', 'sm')}Complete</button>`}
      <button class="btn sm" data-act="editWorkout" data-id="${w.id}">${icon('edit', 'sm')}Edit</button>
      <button class="btn sm" data-act="dupWorkout" data-id="${w.id}">${icon('copy', 'sm')}Duplicate</button>
    </div>
  </div>`;
}
A.newWorkout = el => openWorkoutModal(null, { athleteId: el.dataset.a, date: el.dataset.date });
A.editWorkout = el => { const w = getRec('workouts', el.dataset.id); if (w) openWorkoutModal(w); };
A.logFromWorkout = el => { const w = getRec('workouts', el.dataset.w); if (w) openVbtModal(null, { athleteId: w.athleteId, exerciseId: el.dataset.ex, date: w.date, load: num(el.dataset.load), workoutId: w.id }); };

function exerciseOptions(selected, { vbtFirst = false, allowNew = true } = {}) {
  const groups = EX_CATS.map(c => ({ group: c, options: S.exercises.filter(e => e.category === c).sort((x, y) => x.name.localeCompare(y.name)).map(e => [e.id, e.name + (e.vbt ? ' ⚡' : '')]) })).filter(g => g.options.length);
  const other = S.exercises.filter(e => !EX_CATS.includes(e.category)).map(e => [e.id, e.name]);
  if (other.length) groups.push({ group: 'Other', options: other });
  let opts = [['', 'Choose exercise…']];
  if (vbtFirst) {
    const v = S.exercises.filter(e => e.vbt).sort((x, y) => x.name.localeCompare(y.name)).map(e => [e.id, e.name]);
    if (v.length) opts.push({ group: 'VBT-tracked', options: v });
  }
  opts = opts.concat(groups);
  if (allowNew) opts.push(['__new', '+ New exercise…']);
  return sel('exerciseId', opts, selected);
}

function openWorkoutModal(w, def = {}) {
  const isNew = !w;
  const x = w ? JSON.parse(JSON.stringify(w)) : { athleteId: def.athleteId, date: def.date || today(), title: '', phase: '', notes: '', items: [], completed: false };
  if (!x.items.length) x.items.push(blankItem());
  const a = getAthlete(x.athleteId);
  const phases = [...new Set(S.workouts.filter(o => o.athleteId === x.athleteId).map(o => o.phase).filter(Boolean))];
  const body = `
    <div class="fields">
      ${field('Title', inp('title', x.title, 'placeholder="e.g. Lower A — Strength" list="woTitles"'))}
      ${field('Date', inp('date', x.date, 'type="date" required'))}
      ${field('Block / phase', inp('phase', x.phase, 'placeholder="e.g. GPP wk 2" list="woPhases"'), { cls: 'full' })}
    </div>
    <div class="field"><span class="field-label">Exercises</span><div id="itemsHost"></div>
      <button type="button" class="btn block" data-add-item>${icon('plus', 'sm')}Add exercise</button></div>
    ${field('Workout notes', ta('notes', x.notes, 'rows="2" placeholder="Warm-up, focus, coaching points…"'))}
    ${isNew ? field('Repeat', sel('repeat', [['1', 'Just this day'], ['2', 'Weekly for 2 weeks'], ['3', 'Weekly for 3 weeks'], ['4', 'Weekly for 4 weeks'], ['6', 'Weekly for 6 weeks'], ['8', 'Weekly for 8 weeks']], '1'), { hint: 'Creates a copy of this workout on the same weekday for following weeks.' }) : ''}
    <datalist id="woTitles">${[...new Set(S.workouts.map(o => o.title).filter(Boolean))].slice(0, 40).map(t => `<option value="${esc(t)}">`).join('')}</datalist>
    <datalist id="woPhases">${phases.map(t => `<option value="${esc(t)}">`).join('')}</datalist>`;
  openModal({
    title: `${isNew ? 'New' : 'Edit'} workout — ${athleteName(a, true)}`, body, size: 'wide',
    onSubmit: v => {
      if (!isDS(v.date)) return 'Please choose a date.';
      const items = x.items.filter(it => it.exerciseId);
      if (!items.length) return 'Add at least one exercise.';
      for (const it of items) {
        if (it.intensity === 'pct' && it.pct != null && (it.pct <= 0 || it.pct > 120)) return '%1RM should be between 1 and 120.';
        if (it.intensity === 'vel' && ((it.vMin != null && (it.vMin <= 0 || it.vMin > 4)) || (it.vMax != null && (it.vMax <= 0 || it.vMax > 4)))) return 'Velocity targets should be in m/s (e.g. 0.75).';
        if (it.vlCutoff != null && (it.vlCutoff <= 0 || it.vlCutoff > 80)) return 'Velocity-loss cut-off should be 1–80%.';
      }
      const rec = { ...x, title: v.title.trim(), date: v.date, phase: v.phase.trim(), notes: v.notes.trim(), items };
      if (isNew) {
        const n = +v.repeat || 1;
        for (let i = 0; i < n; i++) upsert('workouts', { ...JSON.parse(JSON.stringify(rec)), id: uid(), date: addDays(v.date, 7 * i), completed: false });
        toast(n > 1 ? `${n} workouts added` : 'Workout added');
      } else { upsert('workouts', rec); toast('Workout saved'); }
      const P = (UI.prog[x.athleteId] ||= {}); P.sel = v.date; P.cursor = v.date;
      if (parseHash().name === 'athlete') refresh(); else go(`#/athlete/${x.athleteId}/program`);
    },
    onDelete: isNew ? null : async () => {
      if (!(await confirmBox('Delete this workout?', 'Logged VBT sets are kept.'))) return false;
      removeRec('workouts', x.id); toast('Workout deleted'); refresh();
    },
    onMount: m => {
      const host = $('#itemsHost', m.wrap);
      const draw = () => { host.innerHTML = x.items.map((it, i) => itemEditor(it, i, x.items.length, x.athleteId)).join(''); };
      draw();
      $('[data-add-item]', m.wrap).addEventListener('click', () => {
        const prev = x.items[x.items.length - 1];
        x.items.push(blankItem(prev ? { sets: prev.sets, reps: prev.reps, intensity: prev.intensity === 'bw' ? 'load' : prev.intensity } : {}));
        draw();
        host.lastElementChild?.querySelector('select')?.focus();
      });
      host.addEventListener('click', e => {
        const b = e.target.closest('[data-it]');
        if (!b) return;
        const i = +b.dataset.i, op = b.dataset.it;
        if (op === 'rm') { x.items.splice(i, 1); if (!x.items.length) x.items.push(blankItem()); }
        if (op === 'up' && i > 0) [x.items[i - 1], x.items[i]] = [x.items[i], x.items[i - 1]];
        if (op === 'down' && i < x.items.length - 1) [x.items[i + 1], x.items[i]] = [x.items[i], x.items[i + 1]];
        draw();
      });
      const onField = async e => {
        const el = e.target;
        const box = el.closest('[data-item]');
        if (!box || !el.dataset.k) return;
        const i = +box.dataset.item, k = el.dataset.k, it = x.items[i];
        if (k === 'exerciseId' && el.value === '__new') {
          const ex = await quickExercise();
          if (ex) it.exerciseId = ex.id; else el.value = it.exerciseId || '';
          draw(); return;
        }
        if (['pct', 'vMin', 'vMax', 'vlCutoff', 'rpe'].includes(k)) it[k] = num(el.value);
        else if (k === 'load') { const v = num(el.value); it.load = v != null ? U.massIn(v) : null; }
        else it[k] = el.value;
        if (k === 'exerciseId') {
          const ex = getExercise(el.value);
          if (ex?.vbt && it.intensity === 'load' && it.load == null) it.intensity = 'zone';
          draw();
        }
        if (k === 'intensity') draw();
        if (e.type === 'change' && ['pct', 'vMin', 'vMax', 'load'].includes(k)) {
          const hint = $(`[data-hint="${i}"]`, host);
          if (hint) hint.innerHTML = intensityText(it, x.athleteId);
        }
      };
      host.addEventListener('change', onField);
      host.addEventListener('input', e => { if (e.target.tagName === 'INPUT') onField(e); });
    },
  });
}
function blankItem(o = {}) { return { id: uid(), exerciseId: '', sets: o.sets || '3', reps: o.reps || '5', intensity: o.intensity || 'load', load: null, pct: null, zone: 'acc', vMin: null, vMax: null, rpe: null, vlCutoff: null, rest: '', notes: '' }; }
function itemEditor(it, i, n, aid) {
  const ex = getExercise(it.exerciseId);
  const ivField = {
    load: field('Load', `<input type="text" inputmode="decimal" data-k="load" value="${it.load != null ? esc(inVal(U.massOut(it.load), 1)) : ''}">`, { unit: U.mass() }),
    pct: field('% 1RM', `<input type="text" inputmode="decimal" data-k="pct" value="${esc(it.pct ?? '')}">`, { unit: '%' }),
    zone: field('Zone', `<select data-k="zone">${ZONES.map(z => `<option value="${z.key}" ${z.key === it.zone ? 'selected' : ''}>${esc(z.name)} (${z.min}–${z.max})</option>`).join('')}</select>`),
    vel: `<div class="fields" style="gap:0 8px">${field('Min', `<input type="text" inputmode="decimal" data-k="vMin" value="${esc(it.vMin ?? '')}">`, { unit: 'm/s' })}${field('Max', `<input type="text" inputmode="decimal" data-k="vMax" value="${esc(it.vMax ?? '')}">`, { unit: 'm/s' })}</div>`,
    rpe: field('RPE', `<input type="text" inputmode="decimal" data-k="rpe" value="${esc(it.rpe ?? '')}">`, { unit: '1–10' }),
    bw: '<div></div>',
  }[it.intensity] || '';
  return `<div class="item-editor" data-item="${i}">
    <div class="ie-head"><span class="ie-n">${i + 1}</span>
      ${exerciseOptions(it.exerciseId).replace('name="exerciseId"', 'data-k="exerciseId" aria-label="Exercise"')}
      <button type="button" class="btn icon sm ghost" data-it="up" data-i="${i}" ${i === 0 ? 'disabled' : ''} aria-label="Move up">${icon('chevU', 'sm')}</button>
      <button type="button" class="btn icon sm ghost" data-it="down" data-i="${i}" ${i === n - 1 ? 'disabled' : ''} aria-label="Move down">${icon('chevD', 'sm')}</button>
      <button type="button" class="btn icon sm ghost" data-it="rm" data-i="${i}" aria-label="Remove" style="color:var(--bad)">${icon('x', 'sm')}</button>
    </div>
    <div class="fields four">
      ${field('Sets', `<input type="text" inputmode="numeric" data-k="sets" value="${esc(it.sets)}">`)}
      ${field('Reps', `<input type="text" data-k="reps" value="${esc(it.reps)}" placeholder="5 or 3-5">`)}
      ${field('Intensity', `<select data-k="intensity">${INTENSITY.map(([v, l]) => `<option value="${v}" ${v === it.intensity ? 'selected' : ''}>${l}</option>`).join('')}</select>`)}
      <div>${ivField}</div>
    </div>
    <div class="hint" data-hint="${i}" style="margin:-8px 0 12px">${it.exerciseId ? intensityText(it, aid) : ''}</div>
    <div class="fields three collapse">
      ${field('Velocity-loss stop', `<input type="text" inputmode="decimal" data-k="vlCutoff" value="${esc(it.vlCutoff ?? '')}" placeholder="${ex?.vbt ? 'e.g. 20' : '—'}">`, { unit: '%' })}
      ${field('Rest', `<input type="text" data-k="rest" value="${esc(it.rest)}" placeholder="2–3 min">`)}
      ${field('Notes', `<input type="text" data-k="notes" value="${esc(it.notes)}" placeholder="Tempo, cues…">`)}
    </div>
  </div>`;
}
async function quickExercise() {
  return new Promise(resolve => {
    let created = null;
    const m = openModal({
      title: 'New exercise', center: true, size: 'narrow',
      body: field('Name', inp('name', '', 'autofocus required')) + field('Category', sel('category', EX_CATS, 'Squat')) + `<label class="check"><input type="checkbox" name="vbt"> Track with VBT</label>`,
      submit: 'Add',
      onSubmit: v => {
        if (!v.name.trim()) return 'Name is required.';
        created = upsert('exercises', { name: v.name.trim(), category: v.category, vbt: !!v.vbt, mvt: null, equipment: '', cues: '', videoUrl: '', notes: '' });
        toast('Exercise added to library');
      },
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.wrap)) { obs.disconnect(); resolve(created); } });
    obs.observe(document.body, { childList: true });
  });
}
A.completeWorkout = el => {
  const w = getRec('workouts', el.dataset.id);
  if (!w) return;
  openModal({
    title: 'Complete workout', size: 'narrow',
    body: `<p class="muted small">Session-RPE: ask the athlete ~10–30 min after the session “How hard was your session?” on the CR-10 scale. Load = RPE × minutes (Foster et al. 2001).</p>
      <div class="fields">${field('Session RPE', sel('rpe', [['', '—'], ...[...Array(11)].map((_, i) => [String(i), `${i} — ${['Rest', 'Very, very easy', 'Easy', 'Moderate', 'Somewhat hard', 'Hard', 'Hard+', 'Very hard', 'Very hard+', 'Very hard++', 'Maximal'][i]}`])], w.rpe ?? ''))}
      ${field('Duration', numInp('dur', w.durationMin ?? S.settings.defaultDuration ?? 60, 'inputmode="numeric"'), { unit: 'min' })}</div>
      ${field('Session notes', ta('completedNotes', w.completedNotes, 'rows="3" placeholder="How it went, modifications…"'))}
      ${w.completed ? `<label class="check"><input type="checkbox" name="undo"> Mark as not completed</label>` : ''}`,
    submit: 'Save',
    onSubmit: v => {
      if (v.undo) { upsert('workouts', { ...w, completed: false }); toast('Marked as planned'); return refresh(); }
      const dur = num(v.dur);
      if (v.dur && (dur == null || dur <= 0 || dur > 600)) return 'Duration should be 1–600 minutes.';
      upsert('workouts', { ...w, completed: true, rpe: v.rpe === '' ? null : +v.rpe, durationMin: dur ? Math.round(dur) : null, completedNotes: v.completedNotes.trim() });
      S.events.filter(e => e.date === w.date && (e.athleteIds || []).includes(w.athleteId) && e.status === 'scheduled' && e.type === 'session')
        .forEach(e => upsert('events', { ...e, status: 'completed' }));
      toast('Workout completed'); refresh();
    },
  });
};
A.dupWorkout = el => {
  const w = getRec('workouts', el.dataset.id);
  if (!w) return;
  openModal({
    title: 'Duplicate workout', size: 'narrow', submit: 'Duplicate',
    body: `${field('Athlete', sel('athleteId', athleteOptions(), w.athleteId))}${field('First date', inp('date', addDays(w.date, 7), 'type="date"'))}
      ${field('Copies', sel('n', [['1', '1 copy'], ['2', 'Weekly × 2'], ['3', 'Weekly × 3'], ['4', 'Weekly × 4'], ['6', 'Weekly × 6'], ['8', 'Weekly × 8']], '1'))}`,
    onSubmit: v => {
      if (!isDS(v.date)) return 'Choose a date.';
      if (!v.athleteId) return 'Choose an athlete.';
      for (let i = 0; i < +v.n; i++) upsert('workouts', { ...JSON.parse(JSON.stringify(w)), id: uid(), createdAt: null, athleteId: v.athleteId, date: addDays(v.date, 7 * i), completed: false, rpe: null, durationMin: null, completedNotes: '' });
      toast(`${plural(+v.n, 'copy', 'copies')} created`);
      const P = (UI.prog[v.athleteId] ||= {}); P.sel = P.cursor = v.date;
      go(`#/athlete/${v.athleteId}/program`);
    },
  });
};
A.copyWeek = el => {
  const aid = el.dataset.a, w0 = startOfWeek(el.dataset.date), w6 = addDays(w0, 6);
  const src = S.workouts.filter(w => w.athleteId === aid && w.date >= w0 && w.date <= w6);
  if (!src.length) return toast('No workouts in this week to copy');
  openModal({
    title: 'Copy week', size: 'narrow', submit: 'Copy',
    body: `<p class="muted">Copy ${plural(src.length, 'workout')} from the week of ${esc(fmtDate(w0))} into following weeks (same weekdays).</p>
      ${field('Copy to', sel('n', [['1', 'Next week'], ['2', 'Next 2 weeks'], ['3', 'Next 3 weeks'], ['4', 'Next 4 weeks']], '1'))}
      ${field('Athlete', sel('athleteId', athleteOptions(), aid))}`,
    onSubmit: v => {
      if (!v.athleteId) return 'Choose an athlete.';
      let c = 0;
      for (let k = 1; k <= +v.n; k++) src.forEach(w => { upsert('workouts', { ...JSON.parse(JSON.stringify(w)), id: uid(), createdAt: null, athleteId: v.athleteId, date: addDays(w.date, 7 * k), completed: false, rpe: null, durationMin: null, completedNotes: '' }); c++; });
      toast(`${plural(c, 'workout')} created`);
      if (v.athleteId !== aid) go(`#/athlete/${v.athleteId}/program`); else refresh();
    },
  });
};

/* ---------------- Athlete VBT tab ---------------- */
function athVbt(a) {
  const logs = S.vbt.filter(l => l.athleteId === a.id).sort((x, y) => y.date.localeCompare(x.date) || (x.createdAt || 0) - (y.createdAt || 0));
  const exIds = [...new Set(logs.map(l => l.exerciseId))].filter(id => getExercise(id));
  const st = (UI.athVbt[a.id] ||= { exerciseId: '', window: '42', show: 8 });
  if (!exIds.includes(st.exerciseId)) st.exerciseId = exIds[0] || '';
  const maxes = S.maxes.filter(m => m.athleteId === a.id).sort((x, y) => y.date.localeCompare(x.date));
  const oneRMs = [...new Set([...exIds, ...maxes.map(m => m.exerciseId)])].map(id => ({ ex: getExercise(id), orm: bestOneRM(a.id, id) })).filter(o => o.ex && o.orm);
  const dates = [...new Set(logs.map(l => l.date))];
  const actions = `<button class="btn primary" data-act="logSessionFor" data-athlete="${a.id}">${icon('clipboard', 'sm')}<span class="lbl">Log session</span></button>`;
  if (!logs.length && !maxes.length) return { actions, body: `<div class="card">${emptyState_('gauge', 'No VBT data yet', 'Use <b>Log session</b> during training: enter load, reps and each rep’s bar velocity for every exercise. Everything saves here — session history, load–velocity profile, estimated 1RM and readiness flags.', `<div class="chips" style="justify-content:center"><button class="btn primary" data-act="logSessionFor" data-athlete="${a.id}">${icon('clipboard', 'sm')}Log session</button><button class="btn" data-act="newVbt" data-athlete="${a.id}">Log single set</button><button class="btn" data-act="newMax" data-athlete="${a.id}">Add tested 1RM</button></div>`)}</div>` };
  const sessions = dates.slice(0, st.show).map(d => {
    const dl = logs.filter(l => l.date === d);
    const wo = S.workouts.find(w => w.athleteId === a.id && w.date === d && dl.some(l => l.workoutId === w.id)) || S.workouts.find(w => w.athleteId === a.id && w.date === d);
    const exs = [...new Set(dl.map(l => l.exerciseId))];
    return `<div class="vbt-session"><div class="split"><div><b>${esc(fmtDateLong(d))}</b>${wo ? ` <span class="faint small">· ${esc(wo.title || 'Workout')}</span>` : ''}</div>${wo ? `<button class="btn sm ghost" data-act="logSession" data-id="${wo.id}">${icon('edit', 'sm')}Edit</button>` : ''}</div>
      ${exs.map(id => {
        const sets = dl.filter(l => l.exerciseId === id);
        const best = Math.max(...sets.map(l => l.vBest));
        return `<div class="vbt-ex"><div class="vbt-ex-name">${esc(getExercise(id)?.name || 'Exercise')} <span class="faint small">· best ${fmtNum(best, 2)} m/s</span></div><div class="chips">${sets.map(l => { const z = zoneOf(l.vBest); return `<button class="set-chip" data-act="editVbt" data-id="${l.id}" style="--z:${z?.color || 'var(--text-3)'}">${esc(fmtMass(l.load, false))}${l.n ? ` × ${l.n}` : ''} <b>${fmtNum(l.vBest, 2)}</b>${l.vl != null && l.n > 1 ? ` <span class="${l.vl > 40 ? 'vl-bad' : l.vl > 25 ? 'vl-warn' : 'vl-ok'}">${fmtNum(l.vl, 0)}%</span>` : ''}</button>`; }).join('')}</div></div>`;
      }).join('')}</div>`;
  }).join('');
  const ex = getExercise(st.exerciseId);
  const trend = st.exerciseId ? vbtTrendChart(a.id, st.exerciseId) : '';
  const lastDate = dates[0];
  const body = `
    <div class="stats" style="margin-bottom:16px">
      <div class="stat"><div class="stat-label">Sessions logged</div><div class="stat-value">${dates.length}</div><div class="stat-sub">last ${lastDate ? esc(ago(lastDate)) : '—'}</div></div>
      <div class="stat"><div class="stat-label">Sets logged</div><div class="stat-value">${logs.length}</div><div class="stat-sub">${logs.filter(l => daysBetween(l.date, today()) <= 28).length} in last 4 weeks</div></div>
      <div class="stat"><div class="stat-label">Lifts tracked</div><div class="stat-value">${exIds.length}</div><div class="stat-sub">${exIds.filter(id => getExercise(id)?.mvt).length} with 1RM estimate</div></div>
      <div class="stat"><div class="stat-label">Top bar speed (4 wk)</div><div class="stat-value">${(() => { const r = logs.filter(l => daysBetween(l.date, today()) <= 28); return r.length ? fmtNum(Math.max(...r.map(l => l.vBest)), 2) : '–'; })()}</div><div class="stat-sub">m/s</div></div>
    </div>
    <div class="grid two">
      <div class="col">
        <div class="card"><div class="card-head"><h3>Session history</h3><span class="sub">${plural(dates.length, 'session')}</span></div>
          ${sessions}
          ${dates.length > st.show ? `<button class="btn sm block" data-act="vbtMore" data-a="${a.id}" style="margin-top:10px">Show older sessions</button>` : ''}
          <p class="faint tiny" style="margin:10px 0 0">Each chip is one set: load × reps, fastest rep (m/s), velocity loss. Colour = velocity zone. Tap a set to edit it.</p>
        </div>
      </div>
      <div class="col">
        ${st.exerciseId ? lvProfileCard(a.id, st.exerciseId, st.window, 'athVbtEx', 'athVbtWin', exIds) : ''}
        ${trend ? `<div class="card"><div class="card-head"><h3>${ex?.mvt ? 'Estimated 1RM over time' : 'Best bar speed per session'}</h3><span class="sub">${esc(ex?.name || '')}</span></div>${trend}</div>` : ''}
        <div class="card"><div class="card-head"><h3>1RM summary</h3><button class="btn sm" data-act="newMax" data-athlete="${a.id}">${icon('plus', 'sm')}Tested 1RM</button></div>
          ${oneRMs.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Exercise</th><th class="n">1RM</th><th>Source</th></tr></thead><tbody>
            ${oneRMs.map(o => `<tr><td>${esc(o.ex.name)}</td><td class="n"><b>${esc(fmtMass(o.orm.kg))}</b></td><td class="small muted">${o.orm.source === 'tested' ? 'Tested' : 'Estimated (L–V)'} · ${esc(fmtDate(o.orm.date))}</td></tr>`).join('')}</tbody></table></div>` : '<div class="muted small">Add a tested max, or log sets at 3+ different loads on an exercise with a minimum velocity threshold.</div>'}
          ${maxes.length ? `<div class="kicker" style="margin-top:14px">Tested maxes</div><div class="list">${maxes.map(m => `<button class="row" data-act="editMax" data-id="${m.id}"><span class="row-main"><span class="row-title">${esc(getExercise(m.exerciseId)?.name || 'Exercise')}</span><span class="row-sub">${esc(fmtDateFull(m.date))}</span></span><b>${esc(fmtMass(m.kg))}</b></button>`).join('')}</div>` : ''}
        </div>
      </div>
    </div>`;
  return { body, actions: actions + `<button class="btn" data-act="newVbt" data-athlete="${a.id}">${icon('plus', 'sm')}<span class="lbl">Single set</span></button>` };
}
A.vbtMore = el => { UI.athVbt[el.dataset.a].show += 10; refresh(); };
function vbtTrendChart(aid, exId) {
  const ex = getExercise(exId);
  const logs = S.vbt.filter(l => l.athleteId === aid && l.exerciseId === exId && l.vBest > 0);
  const dates = [...new Set(logs.map(l => l.date))].sort();
  if (dates.length < 2) return '';
  if (ex?.mvt) {
    const pts = dates.map(d => { const p = lvProfile(aid, exId, { from: addDays(d, -42), to: d }); return p.e1rm ? { x: d, y: U.massOut(p.e1rm), tip: `${fmtDate(d)} · e1RM ${fmtMass(p.e1rm)} (6-wk profile)` } : null; }).filter(Boolean);
    if (pts.length >= 2) return chart({ type: 'line', points: pts, h: 160 }) + `<p class="faint tiny" style="margin:6px 0 0">Each point uses the 6 weeks of sets up to that session. Estimates can over-predict — use for trends.</p>`;
  }
  const pts = dates.map(d => { const v = Math.max(...logs.filter(l => l.date === d).map(l => l.vBest)); return { x: d, y: v, tip: `${fmtDate(d)} · fastest ${fmtNum(v, 2)} m/s` }; });
  return chart({ type: 'line', points: pts, h: 160 });
}

/* ---------------- Session logger ---------------- */
function loggedSummary(w, it, exLogs) {
  const rows = w.log?.[it.id] || [];
  const vb = exLogs.filter(l => l.workoutId !== w.id || !String(l.id).startsWith(w.id + '~'));
  const parts = rows.filter(r => r.load != null || r.reps != null || r.vBest != null).map(r => `${r.load != null ? esc(fmtMass(r.load, false)) : 'BW'}${r.reps != null ? ` × ${r.reps}` : ''}${r.vBest != null ? ` @${fmtNum(r.vBest, 2)}` : ''}${r.rpe != null ? ` RPE ${r.rpe}` : ''}`);
  vb.forEach(l => parts.push(`${esc(fmtMass(l.load, false))}@${fmtNum(l.vBest, 2)}${l.vl != null && l.n > 1 ? ` (${fmtNum(l.vl, 0)}%VL)` : ''}`));
  return parts.length ? `<div class="small" style="margin-top:4px;color:var(--accent)">${icon('check', 'sm')} Logged: ${parts.join(', ')}</div>` : '';
}
function defaultLoad(it, aid) {
  if (it.intensity === 'load') return it.load ?? null;
  if (it.intensity === 'pct' && it.pct) { const o = bestOneRM(aid, it.exerciseId); return o ? roundLoad(o.kg * it.pct / 100) : null; }
  if ((it.intensity === 'zone' || it.intensity === 'vel') && it.exerciseId) {
    const z = ZONES.find(z => z.key === it.zone);
    const lo = it.intensity === 'zone' ? z?.min : (it.vMin ?? it.vMax), hi = it.intensity === 'zone' ? z?.max : (it.vMax ?? it.vMin);
    const p = lvProfile(aid, it.exerciseId, { from: addDays(today(), -84) });
    if (lo != null && hi != null && p.reg && p.reg.b < 0 && p.loadsN >= 3) { const kg = ((lo + hi) / 2 - p.reg.a) / p.reg.b; return kg > 0 ? roundLoad(kg) : null; }
  }
  return null;
}
A.logSession = el => { const w = getRec('workouts', el.dataset.id); if (w) openSessionLogger(w); };
A.logSessionFor = el => {
  const aid = el.dataset.athlete;
  const w = S.workouts.find(x => x.athleteId === aid && x.date === today());
  openSessionLogger(w || { athleteId: aid, date: today(), title: 'Logged session', phase: '', notes: '', items: [], completed: false, _new: true });
};
function openSessionLogger(src) {
  const w = JSON.parse(JSON.stringify(src));
  const a = getAthlete(w.athleteId);
  const log = w.log ? JSON.parse(JSON.stringify(w.log)) : {};
  const mode = { ...(w.logMode || {}) };
  const modeOf = it => mode[it.id] || S.settings.vbtEntry || 'avg';
  const prevVbt = S.vbt.filter(l => l.workoutId === w.id && String(l.id).startsWith(w.id + '~'));
  (w.items || []).forEach(it => {
    if (log[it.id]?.length) return;
    const ex = getExercise(it.exerciseId);
    const n = Math.max(1, Math.min(12, parseInt(it.sets, 10) || 3));
    const reps = parseInt(it.reps, 10) || null;
    const load = ex?.vbt || it.intensity !== 'bw' ? defaultLoad(it, w.athleteId) : null;
    log[it.id] = [...Array(n)].map(() => ({ load, reps, vels: '', avg: null, rpe: null }));
  });
  prevVbt.forEach(l => {
    const [, itemId, idx] = String(l.id).split('~');
    const row = log[itemId]?.[+idx];
    if (!row || row.vels || row.avg != null) return;
    if (l.entry === 'avg') { row.avg = l.vMean ?? l.vBest; mode[itemId] ||= 'avg'; }
    else { row.vels = l.reps?.length ? l.reps.join(', ') : String(l.vBest); mode[itemId] ||= 'reps'; }
  });
  const rowHtml = (it, r, i) => {
    const ex = getExercise(it.exerciseId);
    const avgMode = modeOf(it) === 'avg';
    const reps = parseVels(r.vels), st = reps.length ? velStats(reps) : null;
    const za = avgMode && r.avg > 0 ? zoneOf(r.avg) : null;
    const calc = avgMode ? (r.avg > 0 ? `Avg <b>${fmtNum(r.avg, 2)} m/s</b>${za ? ' · ' + esc(za.name) : ''}` : '')
      : st ? `Best <b>${fmtNum(st.best, 2)}</b>${reps.length > 1 ? ` · mean <b>${fmtNum(st.mean, 2)}</b> · VL <b class="${st.vl > 40 ? 'vl-bad' : st.vl > 25 ? 'vl-warn' : 'vl-ok'}">${fmtNum(st.vl, 1)}%</b>` : ''}${it.vlCutoff && st.vl >= it.vlCutoff ? ' · <b class="vl-warn">cut-off reached</b>' : ''}${zoneOf(st.best) ? ' · ' + esc(zoneOf(st.best).name) : ''}` : '';
    return `<div class="log-row ${avgMode && ex?.vbt ? 'avg-row' : ''}" data-item="${it.id}" data-i="${i}">
      <span class="log-n">${i + 1}</span>
      <label class="lf"><span>Load ${U.mass()}</span><input type="text" inputmode="decimal" data-k="load" value="${r.load != null ? esc(inVal(U.massOut(r.load), 1)) : ''}" placeholder="—"></label>
      <label class="lf sm"><span>Reps</span><input type="text" inputmode="numeric" data-k="reps" value="${r.reps ?? ''}"></label>
      ${ex?.vbt ? (avgMode ? `<label class="lf avg"><span>Avg m/s</span><input type="text" inputmode="decimal" data-k="avg" value="${r.avg ?? ''}" placeholder="0.78"></label>` : `<label class="lf grow"><span>Rep velocities m/s</span><input type="text" inputmode="decimal" data-k="vels" value="${esc(r.vels || '')}" placeholder="0.82, 0.80, 0.76"></label>`) : ''}
      <label class="lf sm"><span>RPE</span><input type="text" inputmode="decimal" data-k="rpe" value="${r.rpe ?? ''}"></label>
      <button type="button" class="btn icon sm ghost" data-rm-set aria-label="Remove set" style="color:var(--bad)">${icon('x', 'sm')}</button>
      ${ex?.vbt ? `<div class="log-calc" data-calc>${calc}</div>` : ''}
    </div>`;
  };
  const itemHtml = it => {
    const ex = getExercise(it.exerciseId);
    return `<div class="log-item" data-block="${it.id}"><div class="log-head"><div class="split" style="align-items:flex-start;flex-wrap:wrap"><div><b>${esc(ex?.name || 'Exercise')}</b>${ex?.vbt ? ` <span class="badge info">${icon('zap', 'sm')}VBT</span>` : ''}</div>${ex?.vbt ? `<div class="seg inline vmode">${[['avg', 'Set average'], ['reps', 'Each rep']].map(([v, l]) => `<button type="button" class="${modeOf(it) === v ? 'on' : ''}" data-vmode="${v}" data-item="${it.id}">${l}</button>`).join('')}</div>` : ''}</div><div class="small muted">${[it.sets || it.reps ? `${esc(it.sets || '–')} × ${esc(it.reps || '–')}` : '', intensityText(it, w.athleteId).replace(/<[^>]+>/g, ''), it.vlCutoff ? `stop at ${fmtNum(it.vlCutoff, 0)}% VL` : ''].filter(Boolean).join(' · ')}</div></div>
      <div data-rows>${(log[it.id] || []).map((r, i) => rowHtml(it, r, i)).join('')}</div>
      <button type="button" class="btn sm" data-add-set="${it.id}">${icon('plus', 'sm')}Add set</button></div>`;
  };
  const body = `
    <div id="logItems">${(w.items || []).map(itemHtml).join('')}</div>
    <div class="log-add"><div class="field" style="margin:0;flex:1">${exerciseOptions('', { vbtFirst: true, allowNew: false }).replace('name="exerciseId"', 'data-add-ex aria-label="Add exercise"')}</div></div>
    <hr class="sep">
    <div class="fields three collapse">
      ${field('Session RPE', sel('rpe', [['', '—'], ...[...Array(11)].map((_, i) => [String(i), String(i)])], w.rpe ?? ''))}
      ${field('Duration', numInp('dur', w.durationMin ?? '', 'inputmode="numeric" placeholder="min"'), { unit: 'min' })}
      <label class="check" style="align-self:end;margin-bottom:14px"><input type="checkbox" name="complete" checked> Mark completed</label>
    </div>
    ${field('Session notes', ta('completedNotes', w.completedNotes || '', 'rows="2" placeholder="How it went, modifications…"'))}
    <p class="faint small">Velocity sets save to ${esc(a.firstName)}’s VBT history and load–velocity profile. Other sets are saved with the workout.</p>`;
  openModal({
    title: `Log session — ${athleteName(a, true)} · ${fmtDate(w.date)}`, size: 'wide', submit: 'Save',
    body,
    onSubmit: v => {
      const items = (w.items || []).filter(it => it.exerciseId);
      if (!items.length) return 'Add at least one exercise.';
      const dur = num(v.dur);
      if (v.dur && (dur == null || dur <= 0 || dur > 600)) return 'Duration should be 1–600 minutes.';
      for (const it of items) for (const r of log[it.id] || []) {
        if (modeOf(it) === 'avg') { if (r.avg != null && (r.avg <= 0 || r.avg > 4)) return `${getExercise(it.exerciseId)?.name}: average velocity should be in m/s, e.g. 0.78`; continue; }
        if (r.vels && !parseVels(r.vels).length) return `${getExercise(it.exerciseId)?.name}: velocities should be numbers in m/s, e.g. 0.82, 0.79`;
        if (parseVels(r.vels).some(x => x > 4)) return 'Velocities look too high — enter metres per second (e.g. 0.75).';
      }
      const cleanLog = {};
      items.forEach(it => {
        const avgMode = modeOf(it) === 'avg';
        cleanLog[it.id] = (log[it.id] || []).filter(r => r.load != null || r.reps != null || (avgMode ? r.avg != null : r.vels) || r.rpe != null).map(r => {
          if (avgMode) return { load: r.load, reps: r.reps, vels: '', avg: r.avg ?? null, rpe: r.rpe, vBest: r.avg ?? null };
          const reps = parseVels(r.vels), stv = reps.length ? velStats(reps) : null;
          return { load: r.load, reps: r.reps, vels: r.vels || '', avg: null, rpe: r.rpe, vBest: stv?.best ?? null };
        });
      });
      const logMode = Object.fromEntries(items.filter(it => getExercise(it.exerciseId)?.vbt).map(it => [it.id, modeOf(it)]));
      const rec = { ...w, items, log: cleanLog, logMode, rpe: v.rpe === '' ? (w.rpe ?? null) : +v.rpe, durationMin: dur ? Math.round(dur) : (w.durationMin ?? null), completedNotes: v.completedNotes.trim(), completed: !!v.complete };
      delete rec._new;
      const saved = upsert('workouts', rec);
      const keep = new Set();
      items.forEach(it => (cleanLog[it.id] || []).forEach((r, i) => {
        if (r.load == null) return;
        const id = `${saved.id}~${it.id}~${i}`;
        const old = getRec('vbt', id);
        const base = { ...(old || {}), id, athleteId: saved.athleteId, exerciseId: it.exerciseId, date: saved.date, load: r.load, peak: old?.peak ?? null, notes: old?.notes || '', workoutId: saved.id };
        if (r.avg > 0) {
          keep.add(id);
          upsert('vbt', { ...base, reps: [], n: r.reps ?? null, vBest: r.avg, vMean: r.avg, vl: null, entry: 'avg' });
          return;
        }
        const reps = parseVels(r.vels);
        if (!reps.length) return;
        const stv = velStats(reps);
        keep.add(id);
        upsert('vbt', { ...base, reps, n: reps.length > 1 ? stv.n : (r.reps ?? 1), vBest: stv.best, vMean: stv.mean, vl: reps.length > 1 ? stv.vl : null, entry: 'reps' });
      }));
      S.vbt.filter(l => l.workoutId === saved.id && String(l.id).startsWith(saved.id + '~') && !keep.has(l.id)).forEach(l => removeRec('vbt', l.id));
      if (rec.completed) S.events.filter(e => e.date === saved.date && (e.athleteIds || []).includes(saved.athleteId) && e.status === 'scheduled' && e.type === 'session').forEach(e => upsert('events', { ...e, status: 'completed' }));
      toast(`Session saved${keep.size ? ` · ${plural(keep.size, 'VBT set')}` : ''}`);
      refresh();
    },
    onMount: m => {
      const host = $('#logItems', m.wrap);
      const redrawItem = id => { const it = w.items.find(x => x.id === id); const blk = $(`[data-block="${id}"]`, host); if (it && blk) blk.outerHTML = itemHtml(it); };
      host.addEventListener('input', e => {
        const row = e.target.closest('.log-row'); const k = e.target.dataset.k;
        if (!row || !k) return;
        const r = log[row.dataset.item][+row.dataset.i];
        if (k === 'load') { const x = num(e.target.value); r.load = x != null ? U.massIn(x) : null; }
        else if (k === 'reps') r.reps = num(e.target.value) != null ? Math.round(num(e.target.value)) : null;
        else if (k === 'rpe') r.rpe = num(e.target.value);
        else if (k === 'avg') {
          r.avg = num(e.target.value);
          const it = w.items.find(x => x.id === row.dataset.item);
          const calc = $('[data-calc]', row);
          if (calc) { const tmp = document.createElement('div'); tmp.innerHTML = rowHtml(it, r, +row.dataset.i); calc.innerHTML = $('[data-calc]', tmp).innerHTML; }
        }
        else if (k === 'vels') {
          r.vels = e.target.value;
          const reps = parseVels(r.vels);
          if (reps.length > 1 && (r.reps == null || r.reps < reps.length)) { r.reps = reps.length; const ri = $('[data-k="reps"]', row); if (ri) ri.value = r.reps; }
          const it = w.items.find(x => x.id === row.dataset.item);
          const calc = $('[data-calc]', row);
          if (calc) { const tmp = document.createElement('div'); tmp.innerHTML = rowHtml(it, r, +row.dataset.i); calc.innerHTML = $('[data-calc]', tmp).innerHTML; }
        }
      });
      host.addEventListener('click', e => {
        const vm = e.target.closest('[data-vmode]');
        if (vm) { mode[vm.dataset.item] = vm.dataset.vmode; S.settings.vbtEntry = vm.dataset.vmode; persist(); redrawItem(vm.dataset.item); return; }
        const add = e.target.closest('[data-add-set]');
        if (add) { const id = add.dataset.addSet; const rows = (log[id] ||= []); const last = rows[rows.length - 1]; rows.push({ load: last?.load ?? null, reps: last?.reps ?? null, vels: '', avg: null, rpe: null }); redrawItem(id); return; }
        const rm = e.target.closest('[data-rm-set]');
        if (rm) { const row = rm.closest('.log-row'); log[row.dataset.item].splice(+row.dataset.i, 1); redrawItem(row.dataset.item); }
      });
      $('[data-add-ex]', m.wrap).addEventListener('change', e => {
        const exId = e.target.value;
        if (!exId) return;
        const it = { ...blankItem({ intensity: 'load' }), exerciseId: exId, sets: '1', reps: '' };
        w.items.push(it);
        log[it.id] = [{ load: null, reps: null, vels: '', avg: null, rpe: null }];
        host.insertAdjacentHTML('beforeend', itemHtml(it));
        e.target.value = '';
        $(`[data-block="${it.id}"] input`, host)?.focus();
      });
    },
  });
}

A.athVbtEx = el => { const aid = parseHash().parts[0]; UI.athVbt[aid].exerciseId = el.value; refresh(); };
A.athVbtWin = el => { const aid = parseHash().parts[0]; UI.athVbt[aid].window = el.value; refresh(); };

function lvProfileCard(aid, exId, win, exAct, winAct, exIds) {
  const ex = getExercise(exId);
  const from = win === 'all' ? null : addDays(today(), -(+win));
  const p = lvProfile(aid, exId, { from });
  const all = lvProfile(aid, exId);
  const pts = all.points.map(q => ({ x: U.massOut(q.x), y: q.y, old: from && q.date < from, tip: `${fmtDate(q.date)} · ${fmtMass(q.x)} @ ${fmtNum(q.y, 2)} m/s`, color: from && q.date < from ? 'var(--text-3)' : 'var(--accent)' }));
  const reg = p.reg;
  const conv = U.imp() ? 2.2046226218 : 1;
  const spec = { type: 'scatter', points: pts, h: 260, xLabel: `Load (${U.mass()})`, yLabel: 'Fastest-rep velocity (m/s)' };
  if (reg && reg.b < 0) {
    const maxX = p.e1rm || Math.max(...p.points.map(q => q.x));
    spec.line = { a: reg.a, b: reg.b / conv, from: 0, to: U.massOut(maxX) };
  }
  if (p.mvt) { spec.hline = p.mvt; spec.hlineLabel = `MVT ${fmtNum(p.mvt, 2)} m/s`; }
  if (p.e1rm) spec.marker = { x: U.massOut(p.e1rm), y: p.mvt, label: `e1RM ${fmtMass(p.e1rm)}`, tip: `Estimated 1RM ${fmtMass(p.e1rm)}` };
  const pctRows = p.e1rm && reg ? [95, 90, 85, 80, 75, 70, 65, 60, 50, 40, 30].map(pc => {
    const kg = p.e1rm * pc / 100, v = reg.a + reg.b * kg, z = zoneOf(v);
    return `<tr><td>${pc}%</td><td class="n">${esc(fmtMass(roundLoad(kg)))}</td><td class="n">${fmtNum(v, 2)}</td><td><span class="zone-sw" style="background:${z?.color || 'var(--text-3)'}"></span>${esc(z?.name || '')}</td></tr>`;
  }).join('') : '';
  const quality = reg ? (reg.r2 >= 0.9 ? ['good', 'Strong fit'] : reg.r2 >= 0.75 ? ['warn', 'Moderate fit'] : ['bad', 'Weak fit']) : null;
  return `<div class="card">
    <div class="card-head" style="flex-wrap:wrap"><h3>Load–velocity profile</h3>
      ${exIds && exIds.length ? sel('ex', exIds.map(id => [id, getExercise(id).name]), exId, `data-change="${exAct}" style="width:auto;min-height:34px;padding-top:5px;padding-bottom:5px" aria-label="Exercise"`) : ''}
      ${sel('win', [['28', 'Last 4 weeks'], ['42', 'Last 6 weeks'], ['84', 'Last 12 weeks'], ['all', 'All time']], win, `data-change="${winAct}" style="width:auto;min-height:34px;padding-top:5px;padding-bottom:5px" aria-label="Window"`)}
    </div>
    ${all.points.length ? chart(spec) : '<div class="muted small">No sets logged for this exercise.</div>'}
    <div class="kv" style="margin-top:10px">
      <span>Sets <b>${p.points.length}</b></span><span>Distinct loads <b>${p.loadsN}</b></span>
      ${reg ? `<span>R² <b>${fmtNum(reg.r2, 2)}</b> <span class="badge ${quality[0]}">${quality[1]}</span></span><span>Slope <b>${fmtNum(reg.b * 10, 3)}</b> m/s per 10 kg</span>` : ''}
      ${p.e1rm ? `<span>Estimated 1RM <b>${esc(fmtMass(p.e1rm))}</b></span>` : ''}
    </div>
    ${!p.mvt && ex ? `<div class="banner info" style="margin:12px 0 0">${icon('info')}<div class="grow small">Set a minimum velocity threshold (MVT) for <b>${esc(ex.name)}</b> in the Exercise Library to estimate 1RM. Ballistic lifts (jumps, cleans) don't use an MVT.</div></div>` : ''}
    ${p.mvt && !p.e1rm ? `<div class="faint small" style="margin-top:8px">Need sets at 3+ distinct loads (ideally spanning ~40–90% 1RM) in this window to estimate 1RM.</div>` : ''}
    ${pctRows ? `<details class="group" style="margin-top:14px"><summary>Load & velocity targets by %1RM</summary><div class="group-body table-wrap"><table class="t"><thead><tr><th>%1RM</th><th class="n">Load</th><th class="n">Velocity</th><th>Zone</th></tr></thead><tbody>${pctRows}</tbody></table>
      <p class="faint tiny" style="margin-top:8px">From this athlete's own profile. Estimated 1RMs can over-predict (Banyard et al. 2017) — treat as guidance.</p></div></details>` : ''}
  </div>`;
}
