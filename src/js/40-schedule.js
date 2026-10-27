/* =========================================================
   Dashboard, Calendar and scheduling
   ========================================================= */
const EVENT_TYPES = [['session', 'Session'], ['evaluation', 'Evaluation'], ['consult', 'Consult'], ['other', 'Other']];
const EVENT_STATUS = [['scheduled', 'Scheduled'], ['completed', 'Completed'], ['cancelled', 'Cancelled'], ['noshow', 'No-show']];
const typeLabel = t => (EVENT_TYPES.find(x => x[0] === t) || ['', 'Other'])[1];
const statusLabel = t => (EVENT_STATUS.find(x => x[0] === t) || ['', 'Scheduled'])[1];
const typeColor = t => `var(--c-${['session', 'evaluation', 'consult'].includes(t) ? t : 'other'})`;

function eventTitle(e) {
  if (e.title) return e.title;
  const names = (e.athleteIds || []).map(id => getAthlete(id)).filter(Boolean);
  if (names.length === 1) return athleteName(names[0]);
  if (names.length > 1) return `${athleteName(names[0], true)} + ${names.length - 1} more`;
  return typeLabel(e.type);
}
function eventAthletes(e) { return (e.athleteIds || []).map(getAthlete).filter(Boolean); }
function statusBadge(e) {
  if (e.status === 'completed') return `<span class="badge good">${icon('check', 'sm')}Done</span>`;
  if (e.status === 'cancelled') return `<span class="badge">Cancelled</span>`;
  if (e.status === 'noshow') return `<span class="badge bad">No-show</span>`;
  return '';
}
function eventRow(e, { showDate = false } = {}) {
  const ath = eventAthletes(e);
  const sub = [e.title && ath.length ? ath.map(a => athleteName(a, true)).join(', ') : '', e.location].filter(Boolean).join(' · ');
  return `<button class="row" data-act="openEvent" data-id="${e.id}">
    <span class="bar-left" style="background:${typeColor(e.type)}"></span>
    <span class="row-time">${showDate ? `<span style="display:block">${esc(fmtDate(e.date, { month: 'short', day: 'numeric' }))}</span>` : ''}${e.start ? esc(fmtTime(e.start)) : 'All day'}${e.start && !showDate ? `<span class="end">${esc(fmtTime(addMin(e.start, e.duration)))}</span>` : ''}</span>
    <span class="row-main"><span class="row-title" style="${e.status === 'cancelled' ? 'text-decoration:line-through;opacity:.6' : ''}">${esc(eventTitle(e))}</span>
      <span class="row-sub">${esc(sub || typeLabel(e.type))}</span></span>
    <span style="display:flex;gap:6px;align-items:center">${statusBadge(e)}<span class="badge t-${e.type}">${esc(typeLabel(e.type))}</span></span>
  </button>`;
}

/* ---------------- Dashboard ---------------- */
ROUTES.dashboard = () => {
  const T = today();
  const todays = eventsOn(T);
  const wk0 = startOfWeek(T), wk1 = addDays(wk0, 6);
  const weekEvents = S.events.filter(e => e.date >= wk0 && e.date <= wk1 && e.status !== 'cancelled');
  const evals = S.events.filter(e => e.type === 'evaluation' && e.date >= T && e.date <= addDays(T, 14) && e.status !== 'cancelled').sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  const progToday = S.workouts.filter(w => w.date === T);
  const insights = allInsights();
  const top = insights.filter(i => i.level !== 'info').slice(0, 5);
  const shownInsights = top.length ? top : insights.slice(0, 4);
  const recentTests = [...S.tests].sort((a, b) => b.date.localeCompare(a.date) || (b.updatedAt - a.updatedAt)).slice(0, 5);
  const hr = new Date().getHours();
  const greet = hr < 12 ? 'Good morning' : hr < 17 ? 'Good afternoon' : 'Good evening';
  const hasData = S.athletes.length > 0;
  const isBackupDue = backupDue();
  const remaining = todays.filter(e => e.status === 'scheduled').length;

  const body = `
    ${storageBanner()}
    ${safariTabBanner()}
    ${!Sync.enabled() && S.athletes.some(a => !a.demo) ? `<div class="banner info">${icon('smartphone')}<div class="grow"><b>Your data is only on this device.</b> Turn on sync to see it on your ${deviceName() === 'iPhone' ? 'Mac' : 'iPhone'} too.</div><div class="chips"><button class="btn sm primary" data-act="syncSetup">Set up</button><button class="btn sm" data-act="syncJoin">I have a code</button></div></div>` : ''}
    ${isBackupDue ? `<div class="banner warn">${icon('download')}<div class="grow"><b>Back up your data.</b> ${S.settings.lastBackup ? `Last backup ${ago(S.settings.lastBackup.slice(0, 10))}.` : 'You haven’t made a backup yet.'} ${Sync.enabled() ? 'Sync is on, but a dated backup file protects against mistakes too.' : 'Your data lives only on this device.'}</div><button class="btn sm" data-act="exportBackup">Back up now</button></div>` : ''}
    ${Sync.enabled() && Sync.meta.error ? `<div class="banner bad">${icon('alert')}<div class="grow"><b>Sync issue:</b> ${esc(Sync.meta.error)}</div><a class="btn sm" href="#/settings">Fix</a></div>` : ''}
    ${(() => { const d = tokenDaysLeft(); return d != null && d <= 14 ? `<div class="banner warn">${icon('lock')}<div class="grow"><b>Sync token ${d < 0 ? 'has expired' : `expires in ${plural(d, 'day')}`}.</b> Create a new GitHub token and paste it in Sync settings.</div><button class="btn sm" data-act="syncSetup">Update</button></div>` : ''; })()}
    ${recentRecordsBanner()}
    <div class="hero">
      <div><h2>${greet}${S.settings.coachName ? ', ' + esc(S.settings.coachName) : ''}</h2><div class="date">${esc(fmtDateLong(T))}</div></div>
      ${hasData ? `<div class="chips"><a class="btn sm primary" href="#/floor">${icon('zap', 'sm')}Gym floor</a><button class="btn sm" data-act="groupTest">${icon('clipboard', 'sm')}Group testing</button><a class="btn sm" href="#/reports">${icon('file', 'sm')}Reports</a><a class="btn sm" href="#/fpai">${icon('activity', 'sm')}Force Plate AI</a><a class="btn sm" href="#/research">${icon('search', 'sm')}Research AI</a></div>` : ''}
    </div>
    <div class="stats">
      <a class="stat" href="#/calendar"><div class="stat-label">${icon('clock', 'sm')}Today</div><div class="stat-value">${todays.filter(e => e.status !== 'cancelled').length}</div><div class="stat-sub">${remaining} remaining</div></a>
      <a class="stat" href="#/calendar"><div class="stat-label">${icon('calendar', 'sm')}This week</div><div class="stat-value">${weekEvents.length}</div><div class="stat-sub">${weekEvents.filter(e => e.status === 'completed').length} completed</div></a>
      <a class="stat" href="#/athletes"><div class="stat-label">${icon('users', 'sm')}Active athletes</div><div class="stat-value">${activeAthletes().length}</div><div class="stat-sub">${S.athletes.length - activeAthletes().length} archived</div></a>
      <a class="stat" href="#/insights"><div class="stat-label">${icon('bulb', 'sm')}Flags</div><div class="stat-value">${insights.filter(i => i.level === 'alert' || i.level === 'warn').length}</div><div class="stat-sub">${insights.length} insights total</div></a>
    </div>
    ${!hasData ? `<div class="card">${emptyState_('users', 'Welcome to ' + APP_NAME, 'Start by adding your athletes, then schedule sessions and record testing. Or load sample data to explore every feature first.', `<div class="chips" style="justify-content:center"><button class="btn primary" data-act="syncJoin">${icon('smartphone', 'sm')}Connect my other device</button><button class="btn" data-act="newAthlete">${icon('plus', 'sm')}Add athlete</button><button class="btn" data-act="loadDemo">Load sample data</button></div>`)}</div>` : ''}
    <div class="grid two" style="${hasData ? '' : 'margin-top:16px'}">
      <div class="col">
        <div class="card">
          <div class="card-head"><h3>Today’s schedule</h3><button class="btn sm" data-act="newEvent" data-date="${T}">${icon('plus', 'sm')}Add</button></div>
          ${todays.length ? `<div class="list">${todays.map(e => eventRow(e)).join('')}</div>` : emptyState_('calendar', 'Nothing scheduled today', 'Add sessions and evaluations from here or the Calendar.')}
          ${todays.some(e => e.status === 'scheduled') ? `<div style="margin-top:10px"><button class="btn sm ghost" data-act="completeToday">${icon('check', 'sm')}Mark all past sessions done</button></div>` : ''}
        </div>
        ${progToday.length ? `<div class="card"><div class="card-head"><h3>Programmed today</h3><span class="sub">${plural(progToday.length, 'workout')}</span></div>
          <div class="list">${progToday.map(w => { const a = getAthlete(w.athleteId); return `<div class="row">${avatar(a, 'sm')}<a class="row-main" href="#/athlete/${w.athleteId}/program?d=${w.date}"><span class="row-title">${esc(athleteName(a))}</span><span class="row-sub">${esc(w.title || 'Workout')} · ${plural((w.items || []).length, 'exercise')}${hasDraft(w) ? ' · <b style="color:var(--warn)">log in progress</b>' : ''}</span></a>${w.completed ? `<span class="badge good">${icon('check', 'sm')}Done</span>` : ''}<button class="btn sm primary" data-act="logSession" data-id="${w.id}">${icon('clipboard', 'sm')}${w.log && Object.keys(w.log).length ? 'Edit log' : 'Log'}</button></div>`; }).join('')}</div></div>` : ''}
        <div class="card">
          <div class="card-head"><h3>Upcoming evaluations</h3><span class="sub">Next 14 days</span></div>
          ${evals.length ? `<div class="list">${evals.map(e => eventRow(e, { showDate: true })).join('')}</div>` : `<div class="muted small">No evaluations booked in the next two weeks.</div>`}
        </div>
      </div>
      <div class="col">
        <div class="card">
          <div class="card-head"><h3>Insights & suggestions</h3><a class="btn sm ghost" href="#/insights">See all</a></div>
          ${shownInsights.length ? shownInsights.map(i => insightHtml(i, true)).join('') : `<div class="muted small">Insights appear once you record testing, VBT sets or completed sessions. Each suggestion is rule-based and linked to the research behind it.</div>`}
        </div>
        <div class="card">
          <div class="card-head"><h3>Recent testing</h3></div>
          ${recentTests.length ? `<div class="list">${recentTests.map(t => recentTestRow(t)).join('')}</div>` : `<div class="muted small">No tests recorded yet.</div>`}
        </div>
      </div>
    </div>`;
  return {
    title: 'Dashboard', body,
    actions: `<button class="btn primary" data-act="newEvent" data-date="${T}">${icon('plus', 'sm')}<span class="lbl">Schedule</span></button>`,
  };
};
function recentTestRow(t) {
  const a = getAthlete(t.athleteId);
  const m = testMetrics(t);
  const keys = ['cmj', 'sprint10', 'sprint40yd', 'djRsi', 'imtpPF', 'broad', 'fly10'].filter(k => m[k] != null).slice(0, 2);
  const prevTests = testsFor(t.athleteId).filter(x => x.date < t.date);
  const parts = keys.map(k => {
    const prev = [...prevTests].reverse().map(x => testMetrics(x)[k]).find(v => v != null);
    const pct = prev != null ? (m[k] - prev) / prev * 100 : null;
    return `${esc(M[k].label)} <b>${esc(fmtMetric(M[k], m[k]))}</b> ${deltaHtml(M[k], pct)}`;
  });
  return `<a class="row" href="#/athlete/${t.athleteId}/testing">${avatar(a, 'sm')}<span class="row-main"><span class="row-title">${esc(athleteName(a))}</span><span class="row-sub">${parts.join(' · ') || plural(Object.keys(t.m || {}).length, 'metric')}</span></span><span class="faint small nowrap">${esc(fmtDate(t.date))}</span></a>`;
}
function storageBanner() {
  if (Store.mode === 'none') return `<div class="banner bad">${icon('alert')}<div class="grow"><b>Storage is unavailable</b> in this browser mode (e.g. Private Browsing). Changes will be lost when you close the app.</div></div>`;
  return '';
}
A.completeToday = async () => {
  const now = new Date(); const T = today();
  const nowT = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const past = eventsOn(T).filter(e => e.status === 'scheduled' && (!e.start || addMin(e.start, e.duration) <= nowT));
  if (!past.length) return toast('No finished sessions to mark yet');
  past.forEach(e => upsert('events', { ...e, status: 'completed' }));
  toast(`${plural(past.length, 'session')} marked done`); refresh();
};

/* ---------------- Calendar ---------------- */
ROUTES.calendar = () => {
  const C = UI.cal;
  C.cursor ||= today(); C.sel ||= today();
  const T = today();
  const filt = e => C.filter === 'all' || e.type === C.filter;
  let title, body;
  const head = (label) => `
    <div class="cal-bar">
      <button class="btn icon" data-act="calNav" data-d="-1" aria-label="Previous">${icon('chevL')}</button>
      <button class="btn icon" data-act="calNav" data-d="1" aria-label="Next">${icon('chevR')}</button>
      <h3>${esc(label)}</h3>
      <button class="btn sm" data-act="calToday">Today</button>
      <span class="grow"></span>
      <div class="seg inline">${[['month', 'Month'], ['week', 'Week'], ['list', 'List']].map(([v, l]) => `<button class="${C.mode === v ? 'on' : ''}" data-act="calMode" data-v="${v}">${l}</button>`).join('')}</div>
    </div>
    <div class="toolbar">
      <div class="chips scroll">${[['all', 'All'], ['session', 'Sessions'], ['evaluation', 'Evaluations'], ['consult', 'Consults'], ['other', 'Other']].map(([v, l]) => `<button class="chip ${C.filter === v ? 'on' : ''}" data-act="calFilter" data-v="${v}">${v !== 'all' ? `<span class="dot" style="--c:${typeColor(v)};display:inline-block"></span>` : ''}${l}</button>`).join('')}
      <button class="chip ${C.programs ? 'on' : ''}" data-act="calPrograms">${icon('dumbbell', 'sm')}Programs</button></div>
    </div>`;
  if (C.mode === 'month') {
    const d = parseDS(C.cursor);
    title = d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
    const grid = monthGrid(C.cursor, C.sel, ds => {
      const evs = eventsOn(ds).filter(filt);
      const wos = C.programs ? S.workouts.filter(w => w.date === ds) : [];
      const chips = evs.slice(0, 3).map(e => `<span class="ev-chip ${e.status === 'completed' ? 'done' : ''} ${e.status === 'cancelled' ? 'cancelled' : ''}" style="--c:${typeColor(e.type)}" data-act="openEvent" data-id="${e.id}">${e.start ? esc(fmtTime(e.start).replace(':00', '').replace(' ', '').toLowerCase()) + ' ' : ''}${esc(eventTitle(e))}</span>`).join('');
      const more = evs.length > 3 ? `<span class="ev-more">+${evs.length - 3} more</span>` : '';
      const wo = wos.length ? `<span class="ev-more">${icon('dumbbell', 'sm')} ${wos.length}</span>` : '';
      const dots = `<span class="dots">${evs.slice(0, 4).map(e => `<span class="dot" style="--c:${typeColor(e.type)}"></span>`).join('')}${wos.length ? '<span class="dot wodot"></span>' : ''}</span>`;
      return chips + more + wo + dots;
    }, 'calSelect');
    body = head(title) + grid + dayAgenda(C.sel, filt, C.programs);
  } else if (C.mode === 'week') {
    const w0 = startOfWeek(C.cursor);
    const w6 = addDays(w0, 6);
    title = `${fmtDate(w0)} – ${fmtDate(w6, { month: parseDS(w0).getMonth() === parseDS(w6).getMonth() ? undefined : 'short', day: 'numeric', year: 'numeric' })}`;
    const cols = [...Array(7)].map((_, i) => {
      const ds = addDays(w0, i);
      const evs = eventsOn(ds).filter(filt);
      const wos = C.programs ? S.workouts.filter(w => w.date === ds) : [];
      return `<div class="week-col ${ds === T ? 'today' : ''}">
        <div class="wh" data-act="newEvent" data-date="${ds}" title="Add to this day"><b>${parseDS(ds).getDate()}</b><span>${esc(fmtDow(ds))}</span><span class="grow" style="flex:1"></span>${icon('plus', 'sm')}</div>
        ${evs.map(e => `<div class="wk-ev ${e.status === 'completed' ? 'done' : ''} ${e.status === 'cancelled' ? 'cancelled' : ''}" style="--c:${typeColor(e.type)}" data-act="openEvent" data-id="${e.id}"><b>${e.start ? esc(fmtTime(e.start)) : 'All day'}</b>${esc(eventTitle(e))}</div>`).join('')}
        ${wos.map(w => `<a class="wk-ev" style="--c:var(--text-3)" href="#/athlete/${w.athleteId}/program?d=${w.date}"><b>${icon('dumbbell', 'sm')} Program${w.completed ? ' ✓' : ''}</b>${esc(athleteName(getAthlete(w.athleteId), true))} · ${esc(w.title || 'Workout')}</a>`).join('')}
        ${!evs.length && !wos.length ? '<div class="faint tiny" style="padding:4px">—</div>' : ''}
      </div>`;
    }).join('');
    body = head(title) + `<div class="week-grid">${cols}</div>`;
  } else {
    title = 'Upcoming';
    const from = C.cursor < T ? C.cursor : T;
    const days = [...Array(60)].map((_, i) => addDays(from, i));
    const blocks = days.map(ds => {
      const evs = eventsOn(ds).filter(filt);
      if (!evs.length) return '';
      return `<div class="agenda-day"><h4 class="${ds === T ? 'is-today' : ''}">${esc(relDay(ds))} <span class="faint small">${esc(fmtDate(ds, { month: 'short', day: 'numeric' }))}</span></h4><div class="card" style="padding:4px 12px">${evs.map(e => eventRow(e)).join('')}</div></div>`;
    }).join('');
    body = head(`Next 60 days from ${fmtDate(from)}`) + (blocks || `<div class="card">${emptyState_('calendar', 'Nothing scheduled', 'No events in the next 60 days for this filter.')}</div>`);
  }
  return {
    title: 'Calendar', body,
    actions: `<button class="btn primary" data-act="newEvent" data-date="${C.mode === 'month' ? C.sel : C.cursor}">${icon('plus', 'sm')}<span class="lbl">New event</span></button>`,
  };
};
function dayAgenda(ds, filt, programs) {
  const evs = eventsOn(ds).filter(filt);
  const wos = programs ? S.workouts.filter(w => w.date === ds) : [];
  return `<div class="agenda-day">
    <div class="split" style="margin-bottom:8px"><h4 class="${ds === today() ? 'is-today' : ''}" style="margin:0">${esc(fmtDateLong(ds))}</h4><button class="btn sm" data-act="newEvent" data-date="${ds}">${icon('plus', 'sm')}Add</button></div>
    <div class="card" style="padding:4px 12px">
      ${evs.length ? evs.map(e => eventRow(e)).join('') : `<div class="muted small" style="padding:12px 4px">No events.</div>`}
      ${wos.length ? `<div class="kicker" style="padding:12px 4px 2px">Programmed workouts</div>${wos.map(w => { const a = getAthlete(w.athleteId); return `<a class="row" href="#/athlete/${w.athleteId}/program?d=${w.date}">${avatar(a, 'sm')}<span class="row-main"><span class="row-title">${esc(athleteName(a))}</span><span class="row-sub">${esc(w.title || 'Workout')} · ${plural((w.items || []).length, 'exercise')}</span></span>${w.completed ? `<span class="badge good">Done</span>` : ''}</a>`; }).join('')}` : ''}
    </div></div>`;
}
function monthGrid(cursor, selected, cell, act) {
  const first = monthStart(cursor);
  const month = parseDS(first).getMonth();
  const start = startOfWeek(first);
  const T = today();
  const ws = S.settings.weekStart || 0;
  const heads = [...Array(7)].map((_, i) => new Date(2023, 0, 1 + ((i + ws) % 7)).toLocaleDateString(undefined, { weekday: 'short' }));
  let cells = '';
  let i = 0;
  while (true) {
    const ds = addDays(start, i);
    if (i % 7 === 0 && i > 0 && parseDS(ds).getMonth() !== month) break;
    const d = parseDS(ds);
    cells += `<div class="mcell ${d.getMonth() !== month ? 'out' : ''} ${ds === T ? 'today' : ''} ${ds === selected ? 'sel' : ''}" role="button" tabindex="0" data-act="${act}" data-date="${ds}" aria-label="${esc(fmtDateLong(ds))}"><span class="mnum">${d.getDate()}</span>${cell(ds)}</div>`;
    i++;
    if (i > 42) break;
  }
  return `<div class="mgrid"><div class="mhead">${heads.map(h => `<div>${esc(h)}</div>`).join('')}</div><div class="mbody">${cells}</div></div>`;
}
A.calNav = el => {
  const C = UI.cal, d = +el.dataset.d;
  if (C.mode === 'month') { C.cursor = addMonths(monthStart(C.cursor), d); C.sel = parseDS(C.sel).getMonth() === parseDS(C.cursor).getMonth() ? C.sel : C.cursor; if (monthStart(today()) === monthStart(C.cursor)) C.sel = today(); }
  else if (C.mode === 'week') C.cursor = addDays(C.cursor, 7 * d);
  else C.cursor = addDays(C.cursor < today() ? today() : C.cursor, 30 * d);
  refresh();
};
A.calToday = () => { UI.cal.cursor = today(); UI.cal.sel = today(); refresh(); };
A.calMode = el => { UI.cal.mode = el.dataset.v; if (el.dataset.v !== 'month') UI.cal.cursor = UI.cal.sel || today(); refresh(); };
A.calFilter = el => { UI.cal.filter = el.dataset.v; refresh(); };
A.calPrograms = () => { UI.cal.programs = !UI.cal.programs; refresh(); };
A.calSelect = el => {
  const ds = el.dataset.date;
  if (UI.cal.sel === ds && window.matchMedia('(pointer:fine)').matches) return A.newEvent(el);
  UI.cal.sel = ds;
  if (monthStart(ds) !== monthStart(UI.cal.cursor)) UI.cal.cursor = ds;
  refresh();
  if (window.innerWidth < 700) $('.agenda-day')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
};
A.newEvent = el => openEventModal(null, { date: el.dataset.date || today(), athleteIds: el.dataset.athlete ? [el.dataset.athlete] : [], type: el.dataset.type });
A.openEvent = el => { const e = getRec('events', el.dataset.id); if (e) openEventModal(e); };

/* ---------------- Event modal ---------------- */
function openEventModal(ev, def = {}) {
  const isNew = !ev;
  const e = ev ? { ...ev } : {
    type: def.type || 'session', date: def.date || today(), start: S.settings.defaultStart || '09:00',
    duration: S.settings.defaultDuration || 60, athleteIds: def.athleteIds || [], title: '', location: '', notes: '', status: 'scheduled',
  };
  const series = e.seriesId ? S.events.filter(x => x.seriesId === e.seriesId) : [];
  const body = `
    ${segmented('type', EVENT_TYPES, e.type)}
    <div style="height:14px"></div>
    <div class="field"><span class="field-label">Athletes</span>${athletePicker('athleteIds', e.athleteIds || [])}</div>
    ${field('Title', inp('title', e.title, 'placeholder="Optional — defaults to athlete name"'))}
    <div class="fields three collapse">
      ${field('Date', inp('date', e.date, 'type="date" required'))}
      ${field('Start', inp('start', e.start, 'type="time"'))}
      ${field('Minutes', numInp('duration', e.duration, 'inputmode="numeric"'))}
    </div>
    ${field('Location', inp('location', e.location, 'placeholder="e.g. Main facility, Turf"'))}
    ${!isNew ? field('Status', segmented('status', EVENT_STATUS, e.status || 'scheduled')) : ''}
    ${field('Notes', ta('notes', e.notes, 'rows="3" placeholder="Focus, equipment, reminders…"'))}
    ${isNew ? field('Repeat', sel('repeat', [['1', 'Does not repeat'], ['2', 'Weekly for 2 weeks'], ['4', 'Weekly for 4 weeks'], ['6', 'Weekly for 6 weeks'], ['8', 'Weekly for 8 weeks'], ['12', 'Weekly for 12 weeks'], ['16', 'Weekly for 16 weeks']], '1')) : ''}
    ${!isNew && series.length > 1 ? `<label class="check"><input type="checkbox" name="applySeries"> Apply time, athletes, type & details to all later events in this series (${series.filter(x => x.date > e.date).length})</label>` : ''}
    ${!isNew ? eventLinks(e) : ''}`;
  openModal({
    title: isNew ? 'New event' : 'Edit event', body, submit: isNew ? 'Add' : 'Save',
    onSubmit: v => {
      if (!isDS(v.date)) return 'Please choose a date.';
      const duration = Math.round(num(v.duration) ?? 60);
      if (duration <= 0 || duration > 24 * 60) return 'Duration should be between 1 and 1440 minutes.';
      const rec = { ...e, type: v.type || 'session', athleteIds: v.athleteIds || [], title: v.title.trim(), date: v.date, start: v.start || '', duration, location: v.location.trim(), notes: v.notes.trim(), status: v.status || e.status || 'scheduled' };
      if (isNew) {
        const n = +v.repeat || 1;
        const seriesId = n > 1 ? uid() : null;
        for (let i = 0; i < n; i++) upsert('events', { ...rec, id: uid(), date: addDays(v.date, 7 * i), seriesId });
        toast(n > 1 ? `${n} events added` : 'Event added');
      } else {
        upsert('events', rec);
        if (v.applySeries) {
          series.filter(x => x.date > ev.date && x.id !== rec.id).forEach(x => upsert('events', { ...x, type: rec.type, athleteIds: rec.athleteIds, title: rec.title, start: rec.start, duration: rec.duration, location: rec.location, notes: rec.notes }));
        }
        toast('Event saved');
      }
      refresh();
    },
    onDelete: isNew ? null : async () => {
      let mode = 'one';
      const later = series.filter(x => x.date > e.date);
      if (later.length) {
        mode = await choose('Delete recurring event', `This event repeats weekly. Delete only this one, or this and ${plural(later.length, 'later event')}?`, [{ label: 'Delete this event', value: 'one', style: 'danger' }, { label: 'This and later events', value: 'future', style: 'danger-ghost' }, { label: 'Cancel', value: null }]);
        if (!mode) return false;
      } else if (!(await confirmBox('Delete this event?'))) return false;
      removeRec('events', e.id);
      if (mode === 'future') later.forEach(x => removeRec('events', x.id));
      toast('Deleted'); refresh();
    },
    onMount: m => {
      $$('[data-quick]', m.wrap).forEach(b => b.addEventListener('click', () => m.close()));
    },
  });
}
function eventLinks(e) {
  const ath = eventAthletes(e);
  if (!ath.length) return '';
  const btns = ath.map(a => {
    const parts = [`<a class="btn sm" data-quick href="#/athlete/${a.id}">${esc(athleteName(a, true))}</a>`];
    if (e.type === 'evaluation') parts.push(`<button type="button" class="btn sm primary" data-quick data-act="newTest" data-athlete="${a.id}" data-date="${e.date}">${icon('clipboard', 'sm')}Record results</button>`);
    if (S.workouts.some(w => w.athleteId === a.id && w.date === e.date)) parts.push(`<a class="btn sm" data-quick href="#/athlete/${a.id}/program?d=${e.date}">${icon('dumbbell', 'sm')}Program</a>`);
    return `<div class="chips" style="margin-bottom:8px">${parts.join('')}</div>`;
  }).join('');
  return `<div class="field"><span class="field-label">Quick links</span>${btns}</div>`;
}
