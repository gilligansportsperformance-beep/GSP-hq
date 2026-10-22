/* =========================================================
   Athletes: list, profile, testing
   ========================================================= */
ROUTES.athletes = () => {
  const F = UI.athletes;
  const body = `
    <div class="toolbar">
      <div class="searchbox grow">${icon('search', 'sm')}<input type="search" placeholder="Search name, sport, team…" value="${esc(F.q)}" data-input="athSearch" aria-label="Search athletes"></div>
      <div class="seg inline">${[['active', 'Active'], ['archived', 'Archived'], ['all', 'All']].map(([v, l]) => `<button class="${F.filter === v ? 'on' : ''}" data-act="athFilter" data-v="${v}">${l}</button>`).join('')}</div>
      ${sel('sort', [['name', 'Sort: Name'], ['next', 'Sort: Next session'], ['tested', 'Sort: Last tested']], F.sort, 'data-change="athSort" style="width:auto" aria-label="Sort"')}
    </div>
    <div id="athResults">${athleteResults()}</div>`;
  return { title: 'Athletes', body, actions: `<button class="btn primary" data-act="newAthlete">${icon('plus', 'sm')}<span class="lbl">Add athlete</span></button>` };
};
function athleteResults() {
  const F = UI.athletes, T = today();
  const q = F.q.trim().toLowerCase();
  let list = S.athletes.filter(a => F.filter === 'all' || (F.filter === 'archived' ? a.archived : !a.archived));
  if (q) list = list.filter(a => [athleteName(a), a.sport, a.position, a.team].join(' ').toLowerCase().includes(q));
  const info = new Map(list.map(a => {
    const next = eventsFor(a.id).filter(e => e.date >= T && e.status !== 'cancelled').sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start))[0];
    const tests = testsFor(a.id);
    return [a.id, { next, last: tests[tests.length - 1] }];
  }));
  list.sort((a, b) => {
    if (F.sort === 'next') return ((info.get(a.id).next?.date || '9999') + (info.get(a.id).next?.start || '')).localeCompare((info.get(b.id).next?.date || '9999') + (info.get(b.id).next?.start || ''));
    if (F.sort === 'tested') return (info.get(b.id).last?.date || '').localeCompare(info.get(a.id).last?.date || '');
    return athleteName(a).localeCompare(athleteName(b));
  });
  if (!S.athletes.length) return `<div class="card">${emptyState_('users', 'No athletes yet', 'Add your first athlete to start tracking testing, programming and sessions.', `<button class="btn primary" data-act="newAthlete">${icon('plus', 'sm')}Add athlete</button>`)}</div>`;
  if (!list.length) return `<div class="card">${emptyState_('search', 'No matches', 'Try a different search or filter.')}</div>`;
  return `<div class="grid cards">${list.map(a => {
    const { next, last } = info.get(a.id);
    const age = ageFrom(a.dob);
    return `<a class="card ath-card" href="#/athlete/${a.id}">${avatar(a)}
      <div class="row-main"><div class="row-title">${esc(athleteName(a))}${a.archived ? ' <span class="badge">Archived</span>' : ''}</div>
      <div class="row-sub">${esc([a.sport, a.position, age != null ? age + ' yrs' : ''].filter(Boolean).join(' · ') || 'No sport set')}</div>
      <div class="meta"><span>${icon('calendar', 'sm')} ${next ? esc(relDay(next.date)) + (next.start ? ' ' + esc(fmtTime(next.start)) : '') : 'No upcoming'}</span><span>${icon('clipboard', 'sm')} ${last ? 'Tested ' + esc(ago(last.date)) : 'Not tested'}</span></div></div>
      ${icon('chevR', 'sm')}</a>`;
  }).join('')}</div>`;
}
A.athSearch = el => { UI.athletes.q = el.value; $('#athResults').innerHTML = athleteResults(); };
A.athFilter = el => { UI.athletes.filter = el.dataset.v; refresh(); };
A.athSort = el => { UI.athletes.sort = el.value; $('#athResults').innerHTML = athleteResults(); };
A.newAthlete = () => openAthleteModal(null);
A.editAthlete = el => openAthleteModal(getAthlete(el.dataset.id));

function openAthleteModal(a) {
  const isNew = !a;
  const x = a ? { ...a } : { firstName: '', lastName: '', sport: '', position: '', team: '', dob: '', sex: '', heightCm: null, massKg: null, email: '', phone: '', goals: '', injuries: '', archived: false, color: '' };
  const colorOpts = ATH_COLORS.map(c => `<label style="position:relative"><input type="radio" name="color" value="${c}" ${athColor(x) === c && (x.color || !isNew) ? 'checked' : ''} style="position:absolute;opacity:0"><span style="display:block;width:28px;height:28px;border-radius:50%;background:${c};cursor:pointer" class="color-sw"></span></label>`).join('');
  const body = `
    <div class="fields">
      ${field('First name', inp('firstName', x.firstName, 'autofocus autocapitalize="words" required'))}
      ${field('Last name', inp('lastName', x.lastName, 'autocapitalize="words"'))}
      ${field('Sport', inp('sport', x.sport, 'placeholder="e.g. Soccer" list="sportList"'))}
      ${field('Position / event', inp('position', x.position))}
      ${field('Team / school', inp('team', x.team), { cls: 'span2' })}
      ${field('Date of birth', inp('dob', x.dob, 'type="date"'))}
      ${field('Sex', sel('sex', [['', '—'], ['F', 'Female'], ['M', 'Male'], ['X', 'Other / prefer not to say']], x.sex))}
      ${field('Height', numInp('height', x.heightCm != null ? inVal(U.lenOut(x.heightCm), 1) : ''), { unit: U.len() })}
      ${field('Body mass', numInp('mass', x.massKg != null ? inVal(U.massOut(x.massKg), 1) : ''), { unit: U.mass() })}
      ${field('Email', inp('email', x.email, 'type="email" autocapitalize="off"'))}
      ${field('Phone', inp('phone', x.phone, 'type="tel"'))}
    </div>
    ${field('Goals', ta('goals', x.goals, 'rows="2" placeholder="e.g. Improve 10 m acceleration for upcoming season"'))}
    ${field('Injury history / considerations', ta('injuries', x.injuries, 'rows="2"'))}
    <div class="field"><span class="field-label">Colour</span><div class="chips color-picker">${colorOpts}</div></div>
    ${!isNew ? toggleRow('archived', x.archived, 'Archived', 'Hide from active lists and insights. History is kept.') : ''}
    <datalist id="sportList">${[...new Set(S.athletes.map(a => a.sport).filter(Boolean))].map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
  openModal({
    title: isNew ? 'New athlete' : 'Edit athlete', body, submit: isNew ? 'Add' : 'Save',
    onSubmit: v => {
      if (!v.firstName.trim()) return 'First name is required.';
      const h = num(v.height), m = num(v.mass);
      if (v.height && h == null) return 'Height must be a number.';
      if (v.mass && m == null) return 'Body mass must be a number.';
      const rec = {
        ...x, firstName: v.firstName.trim(), lastName: v.lastName.trim(), sport: v.sport.trim(), position: v.position.trim(), team: v.team.trim(),
        dob: v.dob, sex: v.sex, heightCm: h != null ? U.lenIn(h) : null, massKg: m != null ? U.massIn(m) : null,
        email: v.email.trim(), phone: v.phone.trim(), goals: v.goals.trim(), injuries: v.injuries.trim(), color: v.color || x.color || '', archived: !!v.archived,
      };
      const saved = upsert('athletes', rec);
      toast(isNew ? 'Athlete added' : 'Saved');
      if (isNew) go('#/athlete/' + saved.id); else refresh();
    },
    onDelete: isNew ? null : async () => {
      const n = S.tests.filter(t => t.athleteId === x.id).length + S.workouts.filter(w => w.athleteId === x.id).length + S.vbt.filter(l => l.athleteId === x.id).length;
      if (!(await confirmBox(`Delete ${athleteName(x)}?`, `This permanently removes their profile${n ? ` and ${plural(n, 'record')} (tests, workouts, VBT sets)` : ''}. Scheduled events stay on your calendar. Consider archiving instead.`))) return false;
      ['tests', 'workouts', 'vbt', 'maxes', 'notes'].forEach(c => S[c].filter(r => r.athleteId === x.id).forEach(r => removeRec(c, r.id)));
      S.events.filter(e => (e.athleteIds || []).includes(x.id)).forEach(e => upsert('events', { ...e, athleteIds: e.athleteIds.filter(id => id !== x.id), title: e.title || athleteName(x) }));
      removeRec('athletes', x.id);
      toast('Athlete deleted'); go('#/athletes');
    },
  });
}

/* ---------------- Athlete profile ---------------- */
const ATH_TABS = [['overview', 'Overview'], ['testing', 'Testing'], ['program', 'Program'], ['vbt', 'VBT'], ['history', 'Sessions & notes']];
ROUTES.athlete = r => {
  const a = getAthlete(r.parts[0]);
  if (!a) return { title: 'Athlete not found', back: '#/athletes', nav: 'athletes', body: `<div class="card">${emptyState_('users', 'Athlete not found', 'This athlete may have been deleted.', '<a class="btn" href="#/athletes">All athletes</a>')}</div>` };
  const tab = ATH_TABS.some(t => t[0] === r.parts[1]) ? r.parts[1] : 'overview';
  const age = ageFrom(a.dob);
  const head = `
    <div class="card">
      <div class="profile-head">
        ${avatar(a, 'lg')}
        <div class="info">
          <h2>${esc(athleteName(a))} ${a.archived ? '<span class="badge">Archived</span>' : ''}</h2>
          <div class="kv">
            ${a.sport ? `<span><b>${esc(a.sport)}</b>${a.position ? ' · ' + esc(a.position) : ''}</span>` : ''}
            ${a.team ? `<span>${esc(a.team)}</span>` : ''}
            ${age != null ? `<span>Age <b>${age}</b></span>` : ''}
            ${a.heightCm ? `<span>Height <b>${esc(fmtHeightCm(a.heightCm))}</b></span>` : ''}
            ${a.massKg ? `<span>Mass <b>${esc(fmtMass(a.massKg))}</b></span>` : ''}
          </div>
        </div>
        <div class="actions">
          <button class="btn sm" data-act="editAthlete" data-id="${a.id}">${icon('edit', 'sm')}Edit</button>
          <button class="btn sm" data-act="newEvent" data-athlete="${a.id}" data-date="${today()}">${icon('calendar', 'sm')}Schedule</button>
        </div>
      </div>
    </div>
    <nav class="tabs">${ATH_TABS.map(([k, l]) => `<a href="#/athlete/${a.id}/${k}" class="${k === tab ? 'active' : ''}">${l}</a>`).join('')}</nav>`;
  const views = { overview: athOverview, testing: athTesting, program: athProgram, vbt: athVbt, history: athHistory };
  const v = views[tab](a, r);
  return { title: athleteName(a), back: '#/athletes', nav: 'athletes', body: head + v.body, actions: v.actions || '', mount: v.mount };
};

const KEY_METRICS = ['sprint10', 'sprint40yd', 'fly10', 'cmj', 'broad', 'djRsi', 'rsiMod', 'imtpPF', 'cmjRelPP', 'dsi', 'eur', 'bm'];
function athOverview(a) {
  const T = today();
  const ins = athleteInsights(a);
  const tiles = KEY_METRICS.map(k => {
    const s = metricSeries(a.id, k);
    if (!s.length) return '';
    const t = trendOf(s, M[k]);
    return `<a class="tile" href="#/athlete/${a.id}/testing"><div class="t-name">${esc(M[k].label)}</div>
      <div class="t-val">${esc(fmtMetric(M[k], t.last.v, false))} <small>${esc(metricUnit(M[k]))}</small></div>
      <div class="t-foot">${t.dPrevPct != null ? deltaHtml(M[k], t.dPrevPct) : `<span class="faint tiny">${esc(fmtDate(t.last.date))}</span>`}${sparkline(s.slice(-8).map(p => p.v), t.cls === 'bad' ? 'var(--bad)' : t.cls === 'good' ? 'var(--good)' : 'var(--accent)')}</div></a>`;
  }).join('');
  const upcoming = eventsFor(a.id).filter(e => e.date >= T && e.status !== 'cancelled').sort((x, y) => (x.date + x.start).localeCompare(y.date + y.start)).slice(0, 5);
  const nextWo = S.workouts.filter(w => w.athleteId === a.id && w.date >= T).sort(byKey('date'))[0];
  const r = acwr(a.id);
  const loadBars = weeklyLoadBars(a.id);
  const body = `
    <div class="grid two">
      <div class="col">
        <div class="card"><div class="card-head"><h3>Key metrics</h3><button class="btn sm" data-act="newTest" data-athlete="${a.id}">${icon('plus', 'sm')}Add test</button></div>
          ${tiles ? `<div class="tiles">${tiles}</div><div class="faint tiny" style="margin-top:10px">Change vs previous test. Coloured only when larger than the typical error for that test; grey = within normal test-to-test noise.</div>` : `<div class="muted small">No testing yet. <button class="link" data-act="newTest" data-athlete="${a.id}">Record a baseline</button>.</div>`}
        </div>
        <div class="card"><div class="card-head"><h3>Insights & suggestions</h3><span class="sub">${plural(ins.length, 'item')}</span></div>
          ${ins.length ? ins.map(i => insightHtml(i)).join('') : `<div class="muted small">No flags right now. Insights are generated from testing, VBT sets and completed-session RPE.</div>`}
        </div>
      </div>
      <div class="col">
        <div class="card"><div class="card-head"><h3>Upcoming</h3><button class="btn sm" data-act="newEvent" data-athlete="${a.id}" data-date="${T}">${icon('plus', 'sm')}Add</button></div>
          ${upcoming.length ? `<div class="list">${upcoming.map(e => eventRow(e, { showDate: true })).join('')}</div>` : `<div class="muted small">Nothing scheduled.</div>`}
          ${nextWo ? `<hr class="sep"><a class="row" href="#/athlete/${a.id}/program?d=${nextWo.date}">${icon('dumbbell')}<span class="row-main"><span class="row-title">Next program: ${esc(nextWo.title || 'Workout')}</span><span class="row-sub">${esc(relDay(nextWo.date))} · ${plural((nextWo.items || []).length, 'exercise')}</span></span>${icon('chevR', 'sm')}</a>` : ''}
        </div>
        ${loadBars ? `<div class="card"><div class="card-head"><h3>Weekly training load</h3><span class="sub">session-RPE × min</span></div>${loadBars}
          ${r ? `<div class="small muted" style="margin-top:8px">Acute:chronic ratio <b style="color:var(--text)">${fmtNum(r.ratio, 2)}</b> · last 7 d ${fmtNum(r.acute, 0)} AU vs ${fmtNum(r.chronic, 0)} AU/wk</div>` : ''}</div>` : ''}
        ${(a.goals || a.injuries) ? `<div class="card"><div class="card-head"><h3>Profile notes</h3></div>
          ${a.goals ? `<div class="kicker">Goals</div><p style="white-space:pre-wrap">${esc(a.goals)}</p>` : ''}
          ${a.injuries ? `<div class="kicker">Injury history / considerations</div><p style="white-space:pre-wrap">${esc(a.injuries)}</p>` : ''}</div>` : ''}
        ${(a.email || a.phone) ? `<div class="card"><div class="card-head"><h3>Contact</h3></div>
          ${a.email ? `<div><a href="mailto:${esc(a.email)}">${esc(a.email)}</a></div>` : ''}${a.phone ? `<div><a href="tel:${esc(a.phone)}">${esc(a.phone)}</a></div>` : ''}</div>` : ''}
      </div>
    </div>`;
  return { body, actions: `<button class="btn primary" data-act="newTest" data-athlete="${a.id}">${icon('plus', 'sm')}<span class="lbl">Add test</span></button>` };
}
function weeklyLoadBars(aid) {
  const loads = sessionLoads(aid);
  if (!loads.length) return '';
  const w0 = startOfWeek(today());
  const bars = [...Array(8)].map((_, i) => {
    const ws = addDays(w0, -7 * (7 - i)), we = addDays(ws, 6);
    const v = loads.filter(l => l.date >= ws && l.date <= we).reduce((s, l) => s + l.load, 0);
    return { label: fmtDate(ws, { month: 'numeric', day: 'numeric' }), v, tip: `Week of ${fmtDate(ws)}: ${fmtNum(v, 0)} AU`, dim: i === 7 };
  });
  return chart({ type: 'bar', bars, h: 150 });
}

/* ---------------- Testing tab ---------------- */
function athTesting(a) {
  const tests = testsFor(a.id);
  const cat = UI.testCat[a.id] || 'all';
  if (!tests.length) return {
    body: `<div class="card">${emptyState_('clipboard', 'No test results yet', 'Record sprint, jump, RSI and force-plate results. Trends and suggestions build automatically as you add tests.', `<button class="btn primary" data-act="newTest" data-athlete="${a.id}">${icon('plus', 'sm')}Add test</button>`)}</div>`,
    actions: `<button class="btn primary" data-act="newTest" data-athlete="${a.id}">${icon('plus', 'sm')}<span class="lbl">Add test</span></button>`,
  };
  const cats = TEST_CATS.filter(c => METRICS.some(m => m.cat === c.key && metricSeries(a.id, m.key).length));
  const sections = cats.filter(c => cat === 'all' || c.key === cat).map(c => {
    const cards = METRICS.filter(m => m.cat === c.key).map(m => {
      const s = metricSeries(a.id, m.key);
      if (!s.length) return '';
      const t = trendOf(s, m);
      const pts = s.map(p => ({ x: p.date, y: metricDisp(m, p.v), tip: `${fmtDate(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}: ${fmtMetric(m, p.v)}` }));
      const ref = m.key === 'dsi' ? { refY: 0.8, refLabel: '0.80' } : m.key === 'eur' ? { refY: 1.0, refLabel: '1.00' } : m.key === 'asym' ? { refY: 10, refLabel: '10%' } : {};
      return `<div class="card metric-card">
        <div class="mc-top"><div class="row-main"><div class="mc-name">${esc(m.label)}${m.calc && m.cat === 'derived' ? ' <span class="badge">calc</span>' : ''}</div>
          <div class="mc-val">${esc(fmtMetric(m, t.last.v, false))}<small>${esc(metricUnit(m))}</small> ${t.isBest ? '<span class="badge good">Best</span>' : ''}</div></div>
          <div class="faint tiny nowrap">${esc(fmtDate(t.last.date))}</div></div>
        <div class="mc-meta">
          ${t.dPrevPct != null ? `<span>vs prev ${deltaHtml(m, t.dPrevPct)}</span>` : ''}
          ${t.n > 2 ? `<span>vs first ${deltaHtml(m, t.dBasePct)}</span>` : ''}
          ${m.dir ? `<span>Best ${esc(fmtMetric(m, t.best))}</span>` : ''}
          <span>${plural(t.n, 'test')}</span>
        </div>
        ${s.length > 1 ? chart({ type: 'line', points: pts, h: 140, color: c.color, ...ref }) : ''}
      </div>`;
    }).join('');
    return `<div class="section-title">${esc(c.label)}</div><div class="grid metrics">${cards}</div>`;
  }).join('');
  const table = `<div class="section-title">Test history</div><div class="card flush"><div class="table-wrap"><table class="t">
    <thead><tr><th>Date</th><th>Results</th><th class="n">Body mass</th><th></th></tr></thead>
    <tbody>${[...tests].reverse().map(t => {
      const keys = Object.keys(t.m || {}).filter(k => M[k]);
      return `<tr class="click" data-act="editTest" data-id="${t.id}"><td class="nowrap">${esc(fmtDateFull(t.date))}</td>
        <td>${keys.slice(0, 4).map(k => `<span class="nowrap">${esc(M[k].label)} <b>${esc(fmtMetric(M[k], t.m[k]))}</b></span>`).join(' · ')}${keys.length > 4 ? ` <span class="faint">+${keys.length - 4} more</span>` : ''}${t.notes ? `<div class="faint small">${esc(t.notes)}</div>` : ''}</td>
        <td class="n nowrap">${t.bodyMassKg ? esc(fmtMass(t.bodyMassKg)) : '–'}</td><td>${icon('chevR', 'sm')}</td></tr>`;
    }).join('')}</tbody></table></div></div>`;
  const filter = `<div class="chips scroll" style="margin-bottom:4px"><button class="chip ${cat === 'all' ? 'on' : ''}" data-act="testCat" data-a="${a.id}" data-v="all">All</button>${cats.map(c => `<button class="chip ${cat === c.key ? 'on' : ''}" data-act="testCat" data-a="${a.id}" data-v="${c.key}">${esc(c.label)}</button>`).join('')}</div>`;
  return {
    body: filter + sections + table + `<p class="faint tiny" style="margin-top:12px">Tap any chart point for its value. Changes are coloured only when they exceed the approximate typical error of the test (e.g. ~2% for 10 m sprint, ~4% for CMJ height) — see <a href="#/references">methods & references</a>.</p>`,
    actions: `<button class="btn primary" data-act="newTest" data-athlete="${a.id}">${icon('plus', 'sm')}<span class="lbl">Add test</span></button>`,
  };
}
A.testCat = el => { UI.testCat[el.dataset.a] = el.dataset.v; refresh(); };
A.newTest = el => openTestModal(el.dataset.athlete || null, null, { date: el.dataset.date });
A.editTest = el => { const t = getRec('tests', el.dataset.id); if (t) openTestModal(t.athleteId, t); };

function openTestModal(aid, test, def = {}) {
  const isNew = !test;
  const a = aid ? getAthlete(aid) : null;
  const lastBm = aid ? [...testsFor(aid)].reverse().find(t => t.bodyMassKg)?.bodyMassKg : null;
  const t = test ? { ...test, m: { ...(test.m || {}) } } : { athleteId: aid, date: def.date || today(), m: {}, bodyMassKg: a?.massKg ?? lastBm ?? null, notes: '', asymSide: '' };
  const groups = TEST_CATS.filter(c => !['derived', 'body'].includes(c.key)).map(c => {
    const defs = METRICS.filter(m => m.cat === c.key && !m.calc);
    const has = defs.filter(m => t.m[m.key] != null).length;
    return `<details class="group" ${isNew || has ? 'open' : ''}><summary>${esc(c.label)} ${has ? `<span class="count">${has} entered</span>` : ''}</summary><div class="group-body"><div class="fields">
      ${defs.map(m => field(esc(m.label), numInp('m_' + m.key, t.m[m.key] != null ? inVal(metricDisp(m, t.m[m.key]), m.kind === 'len' ? 1 : m.dec) : '', `placeholder="${esc(m.hint && m.hint.startsWith('e.g.') ? m.hint.slice(5) : '')}" data-input="testPreview"`), { unit: metricUnit(m) })).join('')}
      ${c.key === 'force' ? field('Asymmetry side', sel('asymSide', [['', '—'], ['Left', 'Left greater'], ['Right', 'Right greater']], t.asymSide)) : ''}
    </div></div></details>`;
  }).join('');
  const body = `
    ${!aid ? field('Athlete', sel('athleteId', athleteOptions(), '', 'required')) : ''}
    <div class="fields">
      ${field('Test date', inp('date', t.date, 'type="date" required'))}
      ${field('Body mass', numInp('bodyMass', t.bodyMassKg != null ? inVal(U.massOut(t.bodyMassKg), 1) : '', 'data-input="testPreview"'), { unit: U.mass(), hint: 'Used for relative force/power' })}
    </div>
    <div class="computed" id="testCalc">Enter results — calculated values (RSI, RSI-mod, DSI, EUR, max velocity, relative force/power) appear here.</div>
    <p class="faint small" style="margin:-4px 0 12px">Fill in only what you tested. Leave the rest blank.</p>
    ${groups}
    ${field('Notes', ta('notes', t.notes, 'rows="2" placeholder="Conditions, surface, timing system, device…"'))}`;
  const read = form => {
    const fdv = formData(form), m = {}, errs = [];
    METRICS.filter(d => !d.calc).forEach(d => {
      const raw = fdv['m_' + d.key];
      if (raw == null || raw.trim() === '') return;
      const v = num(raw);
      if (v == null || v < 0) { errs.push(`${d.label}: “${raw}” isn't a valid number.`); return; }
      if (d.unit === '%' && v > 100) { errs.push(`${d.label} must be 0–100%.`); return; }
      if (d.unit === 's' && (v <= 0 || v > 120)) { errs.push(`${d.label}: enter seconds (e.g. 1.85).`); return; }
      m[d.key] = d.kind === 'len' ? U.lenIn(v) : v;
    });
    const bm = num(fdv.bodyMass);
    return { fdv, m, errs, bm: bm != null && bm > 0 ? U.massIn(bm) : null };
  };
  openModal({
    title: isNew ? `New test${a ? ' — ' + athleteName(a, true) : ''}` : `Edit test — ${athleteName(a, true)}`, body, size: 'wide', submit: 'Save',
    onSubmit: (v, form) => {
      const { m, errs, bm } = read(form);
      const athleteId = aid || v.athleteId;
      if (!athleteId) return 'Please choose an athlete.';
      if (!isDS(v.date)) return 'Please choose a test date.';
      if (errs.length) return errs.join(' ');
      if (!Object.keys(m).length) return 'Enter at least one result.';
      upsert('tests', { ...t, athleteId, date: v.date, m, bodyMassKg: bm, notes: v.notes.trim(), asymSide: v.asymSide || '' });
      toast('Test saved');
      if (!aid) go(`#/athlete/${athleteId}/testing`); else refresh();
    },
    onDelete: isNew ? null : async () => {
      if (!(await confirmBox('Delete this test?', `All results from ${fmtDateFull(t.date)} will be removed.`))) return false;
      removeRec('tests', t.id); toast('Test deleted'); refresh();
    },
    onMount: m => {
      A.testPreview = () => {
        const { m: vals, bm } = read(m.form);
        const tm = testMetrics({ m: vals, bodyMassKg: bm });
        const out = [];
        if (vals.djRsi == null && tm.djRsi != null) out.push(`Drop jump RSI <b>${fmtNum(tm.djRsi, 2)}</b>`);
        if (vals.rsiMod == null && tm.rsiMod != null) out.push(`RSI-mod <b>${fmtNum(tm.rsiMod, 2)}</b>`);
        if (tm.dsi != null) out.push(`DSI <b>${fmtNum(tm.dsi, 2)}</b>`);
        if (tm.eur != null) out.push(`EUR <b>${fmtNum(tm.eur, 2)}</b>`);
        if (tm.vmax != null) out.push(`Max velocity <b>${fmtNum(tm.vmax, 2)} m/s</b>`);
        if (tm.cmjRelPP != null) out.push(`Rel. power <b>${fmtNum(tm.cmjRelPP, 1)} W/kg</b>`);
        if (tm.imtpRel != null) out.push(`Rel. IMTP <b>${fmtNum(tm.imtpRel, 1)} N/kg</b>`);
        $('#testCalc', m.wrap).innerHTML = out.length ? 'Calculated: ' + out.join(' · ') : 'Enter results — calculated values (RSI, RSI-mod, DSI, EUR, max velocity, relative force/power) appear here.';
      };
      A.testPreview();
    },
  });
}

/* ---------------- Sessions & notes tab ---------------- */
function athHistory(a) {
  const T = today();
  const evs = eventsFor(a.id).sort((x, y) => (y.date + y.start).localeCompare(x.date + x.start));
  const past = evs.filter(e => e.date < T || (e.date === T && e.status !== 'scheduled'));
  const fut = evs.filter(e => !past.includes(e)).reverse();
  const notes = S.notes.filter(n => n.athleteId === a.id).sort((x, y) => y.date.localeCompare(x.date) || y.createdAt - x.createdAt);
  const counts = { completed: past.filter(e => e.status === 'completed').length, noshow: past.filter(e => e.status === 'noshow').length, cancelled: past.filter(e => e.status === 'cancelled').length };
  const attended = counts.completed + counts.noshow ? Math.round(counts.completed / (counts.completed + counts.noshow) * 100) : null;
  return {
    body: `<div class="grid halves">
      <div class="col">
        <div class="card"><div class="card-head"><h3>Notes</h3><button class="btn sm" data-act="newNote" data-athlete="${a.id}">${icon('plus', 'sm')}Add note</button></div>
          ${notes.length ? `<div class="list">${notes.map(n => `<button class="row" data-act="editNote" data-id="${n.id}" style="align-items:flex-start"><span class="row-time" style="width:64px">${esc(fmtDate(n.date))}</span><span class="row-main" style="white-space:pre-wrap">${esc(n.text)}</span></button>`).join('')}</div>` : `<div class="muted small">Session observations, conversations with parents/coaches, injury updates…</div>`}
        </div>
      </div>
      <div class="col">
        <div class="stats" style="grid-template-columns:repeat(3,minmax(0,1fr));margin:0">
          <div class="stat"><div class="stat-label">Completed</div><div class="stat-value">${counts.completed}</div></div>
          <div class="stat"><div class="stat-label">Attendance</div><div class="stat-value">${attended != null ? attended + '%' : '–'}</div></div>
          <div class="stat"><div class="stat-label">Upcoming</div><div class="stat-value">${fut.length}</div></div>
        </div>
        <div class="card"><div class="card-head"><h3>Upcoming sessions</h3></div>${fut.length ? `<div class="list">${fut.slice(0, 10).map(e => eventRow(e, { showDate: true })).join('')}</div>` : '<div class="muted small">None scheduled.</div>'}</div>
        <div class="card"><div class="card-head"><h3>Past sessions</h3><span class="sub">${past.length}</span></div>${past.length ? `<div class="list">${past.slice(0, 30).map(e => eventRow(e, { showDate: true })).join('')}</div>` : '<div class="muted small">No past sessions.</div>'}</div>
      </div></div>`,
    actions: `<button class="btn primary" data-act="newNote" data-athlete="${a.id}">${icon('plus', 'sm')}<span class="lbl">Note</span></button>`,
  };
}
A.newNote = el => openNoteModal({ athleteId: el.dataset.athlete, date: today(), text: '' });
A.editNote = el => { const n = getRec('notes', el.dataset.id); if (n) openNoteModal(n); };
function openNoteModal(n) {
  const isNew = !n.id;
  openModal({
    title: isNew ? 'New note' : 'Edit note',
    body: field('Date', inp('date', n.date, 'type="date"')) + field('Note', ta('text', n.text, 'rows="6" autofocus')),
    onSubmit: v => {
      if (!v.text.trim()) return 'Write something first.';
      upsert('notes', { ...n, date: isDS(v.date) ? v.date : today(), text: v.text.trim() }); toast('Note saved'); refresh();
    },
    onDelete: isNew ? null : async () => { if (!(await confirmBox('Delete this note?'))) return false; removeRec('notes', n.id); refresh(); },
  });
}
