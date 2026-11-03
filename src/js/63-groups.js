/* =========================================================
   Group sessions: one calendar session (type 'session', group: true) with several athletes,
   and a board with each athlete's own program side by side. Every program is an ordinary
   workout on that athlete's profile (eventId = the session), saved as you type.
   ========================================================= */
const isGroupEv = e => !!e && e.type === 'session' && (e.group === true || (e.athleteIds || []).length >= 2);
const groupTitle = e => e.title || 'Group session';
const woHasLog = w => !!(w?.log && Object.values(w.log).some(r => Array.isArray(r) && r.length));
/* An athlete's program for a group session: the one linked to it, else their workout that day that isn't linked to a session */
function groupWorkout(e, aid) {
  return S.workouts.find(w => w.athleteId === aid && w.eventId === e.id)
    || S.workouts.find(w => w.athleteId === aid && w.date === e.date && !w.eventId) || null;
}
const groupProgrammed = e => eventAthletes(e).filter(a => (groupWorkout(e, a.id)?.items || []).length).length;

/* ---------------- Group sessions list ---------------- */
ROUTES.groups = (r = {}) => {
  if (r.parts?.[0]) return groupBoard(r.parts[0]);
  const T = today(), evs = S.events.filter(e => isGroupEv(e) && e.status !== 'cancelled');
  const when = e => e.date + (e.start || '');
  const sections = [
    ['Today', evs.filter(e => e.date === T).sort((a, b) => when(a).localeCompare(when(b)))],
    ['Coming up', evs.filter(e => e.date > T).sort((a, b) => when(a).localeCompare(when(b))).slice(0, 30)],
    ['Earlier', evs.filter(e => e.date < T && e.date >= addDays(T, -28)).sort((a, b) => when(b).localeCompare(when(a))).slice(0, 12)],
  ].filter(([, list]) => list.length);
  const row = e => {
    const ath = eventAthletes(e), n = groupProgrammed(e);
    const sub = [`${fmtDow(e.date)}${e.start ? ' ' + fmtTime(e.start) : ''}`, e.location, plural(ath.length, 'athlete'), ath.length ? `${n} of ${ath.length} programmed` : ''].filter(Boolean).join(' · ');
    return `<a class="row" href="#/groups/${e.id}"><div class="gs-date"><b>${esc(fmtDate(e.date, { day: 'numeric' }))}</b><span>${esc(fmtDate(e.date, { month: 'short' }))}</span></div>
      <span class="row-main"><span class="row-title">${esc(groupTitle(e))}</span><span class="row-sub">${esc(sub)}</span></span>
      <span class="gs-avs">${ath.slice(0, 4).map(a => avatar(a, 'sm')).join('')}</span>${icon('chevR', 'sm')}</a>`;
  };
  const actions = `<button class="btn primary" data-act="newGroup">${icon('plus', 'sm')}<span class="lbl">Group session</span></button>`;
  const body = sections.length ? sections.map(([t, list]) => `<div class="section-title">${t}</div><div class="card flush"><div class="list">${list.map(row).join('')}</div></div>`).join('')
    : `<div class="card">${emptyState_('dumbbell', 'No group sessions yet', 'Create one, pick the athletes in it, then build each athlete’s own program side by side. Every program saves to that athlete’s profile as you type, and the session goes on your calendar.', `<button class="btn primary" data-act="newGroup">${icon('plus', 'sm')}New group session</button>`)}</div>`;
  return { title: 'Group Sessions', nav: 'groups', body, actions };
};
A.newGroup = el => openGroupModal(null, { date: el?.dataset?.date });
A.groupEdit = el => { const e = getRec('events', el.dataset.id); if (e) openGroupModal(e); };
A.groupAthletes = el => { const e = getRec('events', el.dataset.id); if (e) openGroupAthletes(e); };

/* Team buttons that tick a team's athletes in an athlete picker */
function teamChipsHtml() {
  const teams = [...S.teams].filter(t => (t.athleteIds || []).some(id => getAthlete(id) && !getAthlete(id).archived)).sort((a, b) => a.name.localeCompare(b.name));
  return teams.length ? `<div class="chips" style="margin-bottom:8px">${teams.map(t => `<button type="button" class="chip" data-gteam="${t.id}">${icon('plus', 'sm')}${esc(t.name)}</button>`).join('')}</div>` : '';
}
function wireTeamChips(m) {
  m.wrap.addEventListener('click', ev => {
    const b = ev.target.closest('[data-gteam]');
    if (!b) return;
    const t = getRec('teams', b.dataset.gteam);
    (t?.athleteIds || []).forEach(id => { const c = $(`input[name="athleteIds[]"][value="${CSS.escape(id)}"]`, m.wrap); if (c) c.checked = true; });
    toast(`${t.name} added`);
  });
}
function openGroupModal(ev, def = {}) {
  const isNew = !ev;
  const e = ev ? { ...ev } : { type: 'session', group: true, date: def.date || today(), start: S.settings.defaultStart || '09:00', duration: S.settings.defaultDuration || 60, athleteIds: def.athleteIds || [], title: '', location: '', notes: '', status: 'scheduled' };
  const body = `
    ${field('Name', inp('title', e.title, 'placeholder="e.g. Speed group, Varsity lift" autocapitalize="words"'))}
    <div class="fields three collapse">
      ${field('Date', inp('date', e.date, 'type="date" required'))}
      ${field('Start', inp('start', e.start, 'type="time"'))}
      ${field('Minutes', numInp('duration', e.duration, 'inputmode="numeric"'))}
    </div>
    ${field('Location', inp('location', e.location, 'placeholder="e.g. Main facility, Turf"'))}
    <div class="field"><span class="field-label">Athletes in the group</span>${teamChipsHtml()}${athletePicker('athleteIds', e.athleteIds || [])}</div>
    ${field('Notes', ta('notes', e.notes, 'rows="2" placeholder="Focus, equipment, reminders…"'))}
    ${isNew ? field('Repeat', sel('repeat', [['1', 'Does not repeat'], ['2', 'Weekly for 2 weeks'], ['4', 'Weekly for 4 weeks'], ['6', 'Weekly for 6 weeks'], ['8', 'Weekly for 8 weeks'], ['12', 'Weekly for 12 weeks']], '1'), { hint: 'Each week is its own group session, with its own programs.' }) : ''}`;
  openModal({
    title: isNew ? 'New group session' : 'Group session details', body, submit: isNew ? 'Create' : 'Save',
    onMount: wireTeamChips,
    onSubmit: v => {
      if (!isDS(v.date)) return 'Please choose a date.';
      const ids = v.athleteIds || [];
      if (!ids.length) return 'Choose the athletes in this group.';
      const duration = Math.round(num(v.duration) ?? 60);
      if (!(duration > 0 && duration <= 24 * 60)) return 'Minutes should be between 1 and 1440.';
      const rec = { ...e, type: 'session', group: true, title: v.title.trim(), date: v.date, start: v.start || '', duration, location: v.location.trim(), notes: v.notes.trim(), athleteIds: ids };
      if (isNew) {
        const n = +v.repeat || 1, seriesId = n > 1 ? uid() : null;
        let first = null;
        for (let i = 0; i < n; i++) { const r = upsert('events', { ...rec, id: uid(), date: addDays(v.date, 7 * i), seriesId }); first ||= r; }
        toast(n > 1 ? `${n} group sessions added to the calendar` : 'Group session added to the calendar');
        go(`#/groups/${first.id}`);
      } else {
        // the programs move with the session
        if (rec.date !== ev.date) S.workouts.filter(w => w.eventId === ev.id && w.date === ev.date).forEach(w => upsert('workouts', { ...w, date: rec.date }));
        upsert('events', rec); toast('Saved'); refresh();
      }
    },
    onDelete: isNew ? null : async () => {
      const progs = S.workouts.filter(w => w.eventId === ev.id);
      if (!(await confirmBox('Delete this group session?', `It comes off your calendar.${progs.length ? ` The ${plural(progs.length, 'athlete program')} stay on their profiles.` : ''}`))) return false;
      removeRec('events', ev.id); toast('Group session deleted'); go('#/groups');
    },
  });
}
function openGroupAthletes(e) {
  openModal({
    title: 'Athletes in this group', size: 'narrow', submit: 'Save',
    body: `${teamChipsHtml()}${athletePicker('athleteIds', e.athleteIds || [])}<p class="hint">Programs already made stay on each athlete’s profile if you take them out of the group.</p>`,
    onMount: wireTeamChips,
    onSubmit: v => {
      const ids = v.athleteIds || [];
      if (!ids.length) return 'Keep at least one athlete (or delete the group session in Details).';
      upsert('events', { ...e, group: true, athleteIds: ids }); toast('Group updated'); refresh();
    },
  });
}

/* ---------------- The board: everyone's program, side by side ---------------- */
function groupBoard(id) {
  const e = getRec('events', id);
  if (!e) return { title: 'Group session', back: '#/groups', nav: 'groups', body: `<div class="card"><p class="muted">This group session isn’t on the calendar any more.</p><a class="btn" href="#/groups">All group sessions</a></div>` };
  const ath = eventAthletes(e);
  const head = `<div class="card gb-head">
      <div class="gb-when">${esc(fmtDateLong(e.date))}${e.start ? ` · ${esc(fmtTime(e.start))}` : ''}${e.location ? ` · ${esc(e.location)}` : ''}</div>
      <div class="small muted">${plural(ath.length, 'athlete')} · <span data-gb-count>${groupProgrammed(e)}</span> programmed · each program saves to the athlete’s profile as you type</div>
      ${e.notes ? `<div class="small" style="margin-top:4px">${esc(e.notes)}</div>` : ''}
      <div class="gb-actions">
        <button class="btn sm primary" data-gb-addall>${icon('plus', 'sm')}Add exercises to everyone</button>
        <button class="btn sm" data-act="groupAthletes" data-id="${e.id}">${icon('users', 'sm')}Athletes</button>
        <button class="btn sm" data-act="groupEdit" data-id="${e.id}">${icon('edit', 'sm')}Details</button>
      </div>
      ${ath.length > 2 ? `<div class="chips scroll gb-jump">${ath.map(a => `<button type="button" class="chip" data-gb-jump="${a.id}">${esc(athleteName(a, true))}</button>`).join('')}</div>` : ''}
    </div>`;
  const body = head + (ath.length ? `<div class="gb-cols" data-gb-cols>${ath.map(a => groupColHtml(e, a)).join('')}</div>`
    : `<div class="card"><p class="muted">No athletes in this group yet.</p><button class="btn primary" data-act="groupAthletes" data-id="${e.id}">${icon('users', 'sm')}Choose athletes</button></div>`);
  return { title: groupTitle(e), back: '#/groups', nav: 'groups', body, mount: () => mountGroupBoard(e) };
}
function groupColHtml(e, a) {
  const w = groupWorkout(e, a.id), last = woEarlier(a.id, e.date, w?.id)[0], nm = esc(athleteName(a, true));
  const n = (w?.items || []).filter(it => getExercise(it.exerciseId)).length;
  return `<section class="card gb-col" data-gb-aid="${a.id}" aria-label="${esc(athleteName(a))}">
    <div class="gb-colhead">${avatar(a, 'sm')}<div class="gb-who"><a class="gb-name" href="#/athlete/${a.id}/program">${esc(athleteName(a))}</a><span class="gb-state" data-gb-state>${n ? `${plural(n, 'exercise')} · on ${esc(a.firstName)}’s profile` : 'No program yet'}</span></div>
      <span class="gb-tools">
        <button type="button" class="btn icon sm ghost" data-gb-copy title="Copy to others" aria-label="Copy ${nm}’s program to others">${icon('copy', 'sm')}</button>
        <button type="button" class="btn icon sm ghost" data-gb-log title="Log the session" aria-label="Log ${nm}’s session">${icon('clipboard', 'sm')}</button>
        <button type="button" class="btn icon sm ghost" data-gb-rm title="Take out of this group" aria-label="Take ${nm} out of this group" style="color:var(--bad)">${icon('x', 'sm')}</button>
      </span></div>
    ${last ? `<div class="gb-last">${icon('clock', 'sm')}<span>Last session ${esc(fmtDate(last.date, { weekday: 'short', month: 'short', day: 'numeric' }))}${last.title ? ` · ${esc(last.title)}` : ''}${last.completed ? ' ✓' : ''}</span></div>` : ''}
    ${woHasLog(w) ? `<div class="gb-logged">${icon('check', 'sm')}<span>Session logged</span></div>` : ''}
    <div class="form-error hidden" data-gb-err role="alert"></div>
    <div class="ie-host gb-host" data-gb-host></div>
    <button type="button" class="btn block" data-gb-add>${icon('plus', 'sm')}Add exercises</button>
  </section>`;
}
function mountGroupBoard(e) {
  const cols = new Map();
  const countEl = $('[data-gb-count]');
  const recount = () => { if (countEl) countEl.textContent = String([...cols.values()].filter(c => c.x.items.length).length); };
  $$('[data-gb-aid]').forEach(col => {
    const aid = col.dataset.gbAid, a = getAthlete(aid), w = groupWorkout(e, aid);
    const x = w ? JSON.parse(JSON.stringify(w)) : { athleteId: aid, date: e.date, title: e.title || 'Group session', phase: '', notes: '', items: [], completed: false };
    x.items = (x.items || []).filter(it => getExercise(it.exerciseId));
    const last = woEarlier(aid, e.date, x.id)[0];
    const state = $('[data-gb-state]', col), err = $('[data-gb-err]', col);
    let timer = null, dirty = false;
    // saves this athlete's program to their profile (only the rows: anything logged or set elsewhere is kept)
    const save = () => {
      clearTimeout(timer); timer = null;
      if (!dirty) return;
      dirty = false;
      const items = cleanItems(x.items), bad = itemsProblem(items);
      err.textContent = bad; err.classList.toggle('hidden', !bad);
      if (bad) { state.textContent = 'Not saved yet: check the values'; dirty = true; return; }
      const cur = x.id ? getRec('workouts', x.id) : null;
      if (!items.length) {
        if (cur && !woHasLog(cur)) { removeRec('workouts', cur.id); delete x.id; }
        else if (cur) upsert('workouts', { ...cur, items: [] });
        state.textContent = 'No program yet'; recount(); return;
      }
      const rec = upsert('workouts', { ...(cur || x), items, eventId: e.id, athleteId: aid, date: cur?.date || e.date });
      x.id = rec.id;
      state.textContent = `${plural(items.length, 'exercise')} · saved to ${a.firstName}’s profile`;
      recount();
    };
    const ed = mountItemsEditor($('[data-gb-host]', col), x, {
      ctx: () => ({ aid, date: e.date, wid: x.id || null }), cmp: () => cmpCtx(last, e.date),
      addBtn: $('[data-gb-add]', col), pickerTitle: `Add for ${a.firstName}`,
      onChange: kind => { dirty = true; state.textContent = 'Saving…'; clearTimeout(timer); timer = setTimeout(save, kind === 'rows' ? 60 : 600); },
    });
    cols.set(aid, { a, x, ed, save, col });
  });
  // anything typed but not saved yet is saved before the page changes or the app is hidden
  UI.leave = () => cols.forEach(c => c.save());
  const view = $('#view');
  $('[data-gb-addall]', view)?.addEventListener('click', async () => {
    if (!cols.size) return;
    const ids = await openExercisePicker({ aid: null, date: e.date, title: 'Add to everyone' });
    if (!ids.length) return;
    cols.forEach(c => c.ed.addIds(ids, false));
    toast(`Added to ${plural(cols.size, 'athlete')}, each from their own last prescription`);
  });
  $$('[data-gb-jump]', view).forEach(b => b.addEventListener('click', () => cols.get(b.dataset.gbJump)?.col.scrollIntoView({ behavior: 'smooth', inline: 'start', block: 'nearest' })));
  $('[data-gb-cols]', view)?.addEventListener('click', async ev => {
    const col = ev.target.closest('[data-gb-aid]'), c = col && cols.get(col.dataset.gbAid);
    if (!c) return;
    if (ev.target.closest('[data-gb-copy]')) return groupCopy(e, c, cols);
    if (ev.target.closest('[data-gb-log]')) {
      c.save();
      const w = c.x.id && getRec('workouts', c.x.id);
      if (!w) return toast(`Add ${c.a.firstName}’s exercises first`);
      return openSessionLogger(w);
    }
    if (ev.target.closest('[data-gb-rm]')) {
      c.save();
      const w = c.x.id && getRec('workouts', c.x.id);
      const v = await choose(`Take ${athleteName(c.a)} out of this group?`, w ? `Their program for the day stays on their profile unless you delete it${woHasLog(w) ? ' (it has a logged session, so it is kept)' : ''}.` : '',
        [{ label: 'Take out, keep the program', value: 'keep', style: 'primary' }, ...(w && !woHasLog(w) ? [{ label: 'Take out and delete it', value: 'del', style: 'danger' }] : []), { label: 'Cancel', value: null }]);
      if (!v) return;
      const cur = getRec('events', e.id);
      if (cur) upsert('events', { ...cur, athleteIds: (cur.athleteIds || []).filter(id => id !== c.a.id) });
      if (v === 'del' && w) removeRec('workouts', w.id);
      toast(`${c.a.firstName} taken out of the group`); refresh();
    }
  });
}
/* Copy one athlete's program to others in the group */
function groupCopy(e, src, cols) {
  src.save();
  if (!src.x.items.length) return toast(`${src.a.firstName} has no exercises to copy yet`);
  const others = [...cols.values()].filter(c => c !== src);
  if (!others.length) return toast('Add more athletes to the group first');
  openModal({
    title: `Copy ${src.a.firstName}’s program`, size: 'narrow', submit: 'Copy',
    body: `<p class="muted small">${plural(src.x.items.length, 'exercise')} to:</p>
      <div class="picker"><div class="picker-list">${others.map(c => `<label><input type="checkbox" name="to[]" value="${c.a.id}" checked><span>${esc(athleteName(c.a))}${c.x.items.length ? ` <span class="faint">· has ${plural(c.x.items.length, 'exercise')}</span>` : ''}</span></label>`).join('')}</div></div>
      ${others.some(c => c.x.items.length) ? field('Athletes who already have exercises', segmented('mode', [['add', 'Add after theirs'], ['replace', 'Replace theirs']], 'add')) : ''}
      <label class="check"><input type="checkbox" name="own" checked> Use each athlete’s own last prescription of an exercise when they have one</label>`,
    onSubmit: v => {
      const to = v.to || [];
      if (!to.length) return 'Choose who to copy it to.';
      to.forEach(aid => {
        const c = cols.get(aid);
        if (!c) return;
        const mine = lastRxMap(aid, e.date, c.x.id);
        const rows = src.x.items.map(it => {
          const own = v.own && !fpTestOf(getExercise(it.exerciseId)) && mine.get(it.exerciseId);
          return own ? itemFromRx(own.it, own.date) : itemFromRx(it, athleteName(src.a, true));
        });
        if (v.mode === 'replace') c.x.items.length = 0;
        c.ed.addItems(rows, false);
      });
      toast(`Copied to ${plural(to.length, 'athlete')}`);
    },
  });
}
