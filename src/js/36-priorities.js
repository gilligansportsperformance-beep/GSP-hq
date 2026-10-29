/* =========================================================
   Training priorities: a short, ranked list of what to work on next, built from the athlete's latest
   results. Rules are conservative and each cites the research behind it. Provisional and
   low-reliability standards (and athletes outside 14–18) never trigger a priority.
   ========================================================= */
function athPriorities(a) {
  const out = [];
  // focus = the plain line used in progress reports for parents
  const add = (score, key, lvl, title, why, what, refs, focus = title) => out.push({ score, key, lvl, title, why: why.filter(Boolean).join(' · '), what, refs, focus });
  const L = key => { const r = stdLatest(a, key); return stdGraded(r) ? r : null; };
  const low = r => r && !r.target && r.lv <= 1;
  const says = r => `${stdName(r.s)} ${stdVal(r)} (${stdLvName(r)})`;
  // Readiness today comes first: it changes today's session
  const rd = readyToday(a.id);
  if (rd) {
    const e = readyEval(rd);
    if (e.status === 'bad' || e.status === 'low') add(e.status === 'bad' ? 100 : 40, 'ready', e.status === 'bad' ? 'alert' : 'warn', e.status === 'bad' ? 'Fatigued today: reduce the session' : 'Slightly down today: protect quality', [`Readiness check ${READY_STATUS[e.status].label.toLowerCase()} compared with their normal`], READY_STATUS[e.status].advice, ['claudino2017', 'gathercole2015']);
  }
  // Left–right differences on the latest results
  const asym = ASYM_KEYS.map(k => { const s = metricSeries(a.id, k); return s.length ? { k, v: s[s.length - 1].v } : null; }).filter(x => x && x.v >= 10).sort((x, y) => y.v - x.v)[0];
  if (asym) add(asym.v >= 15 ? 35 : 15, 'asym', asym.v >= 15 ? 'alert' : 'warn', 'Reduce the left–right difference', [`${M[asym.k].label} ${fmtNum(asym.v, 1)}%`], 'Confirm it on a repeat test first, as asymmetry changes between tests and tasks. Then add single-leg strength and jump work (split squats, single-leg RDLs, single-leg hops) and re-test.', ['bishop2018'], 'Even out the left–right difference with single-leg strength and jump work');
  // Landing
  const land = [L('dlPlfRel'), L('dlTts')].filter(low);
  if (land.length) add(land.some(r => r.lv === 0) ? 32 : 14, 'land', land.some(r => r.lv === 0) ? 'alert' : 'warn', 'Landing mechanics and deceleration', land.map(says), 'Teach and load landings 2–3 times a week for at least 6 weeks: stick landings, progressive drop landings starting below the test height, and jump–land–stick and deceleration drills, with the knees tracking over the toes.', ['hewett1996', 'myer2005'], 'Landing technique and control: stick landings, progressive drop landings and deceleration drills');
  // Strength, and how well it is expressed (DSI = CMJ peak force ÷ IMTP peak force, gross ÷ gross)
  const prof = athleteProfiles(a.id).pop();
  const strength = [L('imtpRel'), L('imtpPF')].filter(Boolean);
  const strLow = strength.filter(low), strOk = strength.length && !strLow.length;
  const dsiHigh = prof && prof.dsi > 0.8, dsiLow = prof && prof.dsi < 0.6;
  if (strLow.length || dsiHigh) {
    add((strLow.some(r => r.lv === 0) ? 30 : strLow.length ? 20 : 6) + (dsiHigh ? 12 : 0), 'strength', 'warn', 'Build maximal strength', [...strLow.map(says), dsiHigh ? `DSI ${fmtNum(prof.dsi, 2)}: already expresses most of their strength in the jump` : ''],
      'Main lifts 2–3 times a week (squat, hinge and pull variations), working toward 2–6 sets of up to 6 reps at 85% of 1RM or more, the NSCA strength range. For less experienced athletes keep technique first and progress gradually.', ['haff2016', 'suchomel2016', 'lloyd2014', ...(dsiHigh ? ['sheppard2011'] : [])], 'Build maximal strength in the main lifts (squat, hinge and pull)');
  }
  const f200 = L('imtpF200Rel');
  if (dsiLow || (low(f200) && strOk)) add(dsiLow ? 24 : 18, 'rate', 'warn', 'Express force faster', [dsiLow ? `DSI ${fmtNum(prof.dsi, 2)}: strong, but little of it shows in the jump` : '', low(f200) ? says(f200) : ''],
    'Pair heavy strength with ballistic work done with maximal intent: light-load jump squats or trap-bar jumps, Olympic-lift derivatives, medicine-ball throws and plyometrics.', ['sheppard2011', 'comfort2018', 'suchomel2018'], 'Produce force faster: jumps, throws and Olympic-lift variations done with full intent');
  // Jump output when strength is already there
  const power = [L('cmj'), L('cmjRelPP'), L('sj')].filter(low);
  if (power.length && strOk && !dsiLow) add(power.some(r => r.lv === 0) ? 20 : 12, 'power', 'warn', 'Turn strength into jump power', power.map(says), 'Strength is in place. Add jumping with maximal intent: loaded and unloaded jumps, plyometrics and Olympic-lift derivatives.', ['suchomel2018'], 'Turn strength into jump power: loaded and unloaded jumps and plyometrics');
  // Stretch-shortening use
  const eur = L('eur');
  if (eur && eur.lv === 0) add(16, 'ssc', 'warn', 'Develop elastic (stretch-shortening) ability', [says(eur)], 'Add fast stretch-shortening work 2–3 times a week: pogo hops and snap-downs, then countermovement and low drop jumps with quick, stiff rebounds. Start with few contacts and progress.', ['mcguigan2006', 'flanagan2008'], 'Springy, elastic jumping: pogo hops, snap-downs and quick rebound jumps');
  // Braking
  const brake = L('brakeRfd');
  if (low(brake)) add(brake.lv === 0 ? 14 : 8, 'brake', 'warn', 'Eccentric strength and braking', [says(brake)], 'Build braking: slow-lowering (eccentric-emphasis) squats, snap-downs and drop landings, alongside heavy strength work.', ['mcmahon2018', 'suchomel2018'], 'Braking strength: slow-lowering squats, snap-downs and drop landings');
  // Arm swing
  const arm = L('armSwing');
  if (arm && arm.lv === 0) add(8, 'arms', 'info', 'Use the arm swing', [says(arm)], 'Coach the arm drive in jumping: a full backswing timed with the dip, then drive the arms up hard through take-off. Practise with Abalakov jumps.', ['lees2004', 'harman1990'], 'A strong, well-timed arm swing when jumping');
  out.sort((x, y) => y.score - x.score);
  return out;
}
/* Good and Elite results worth telling the athlete about */
function athStrengths(a) {
  return HS_STD.map(s => stdLatest(a, s.key)).filter(r => stdGraded(r) && r.lv >= 2).sort((x, y) => y.lv - x.lv).map(r => `${stdName(r.s)} (${stdLvName(r)})`);
}
function athPrioCard(a) {
  if (!testsFor(a.id).length && !readyToday(a.id)) return '';
  const list = athPriorities(a), str = athStrengths(a);
  const item = (p, i) => `<div class="prio ${p.lvl}"><div class="prio-n">${i + 1}</div><div class="grow" style="min-width:0"><div class="prio-t">${esc(p.title)}</div>${p.why ? `<div class="prio-why">${esc(p.why)}</div>` : ''}<div class="prio-do"><b>Do:</b> ${esc(p.what)}</div>${refLinks(p.refs)}</div></div>`;
  return `<div class="card prio-card"><div class="card-head"><h3>Training priorities</h3><span class="sub">from the latest results</span></div>
    ${list.length ? list.slice(0, 3).map(item).join('') : `<div class="muted small">No clear weak spot on the graded results. Keep progressing the current plan and re-test at the next evaluation.</div>`}
    ${list.length > 3 ? `<details class="group" style="margin-top:8px"><summary>${plural(list.length - 3, 'more priority', 'more priorities')}</summary><div class="group-body">${list.slice(3).map((p, i) => item(p, i + 3)).join('')}</div></details>` : ''}
    ${str.length ? `<div class="prio-str">${icon('trophy', 'sm')} <span><b>Strengths:</b> ${esc(str.join(', '))}</span></div>` : ''}
    <p class="faint tiny" style="margin:10px 0 0">Suggestions from your standards, the DSI/EUR profile, asymmetry and readiness, each linked to the research behind it. Provisional and low-reliability results don’t drive them. Adjust for the athlete’s sport, injury history, maturity and training age.</p></div>`;
}

/* ---------- Dashboard: what needs the coach's attention ---------- */
function needsAttention() {
  const T = today(), act = activeAthletes(), items = [];
  const names = list => esc(list.slice(0, 5).map(a => athleteName(a, true)).join(', ')) + (list.length > 5 ? '…' : '');
  act.forEach(a => {
    const r = readyToday(a.id);
    if (r && readyEval(r).status === 'bad') items.push({ lvl: 'alert', ic: 'activity', html: `<b>${esc(athleteName(a, true))}</b> is fatigued today: reduce the session`, href: `#/athlete/${a.id}` });
  });
  if (!S.settings.imtpBasis && S.tests.some(t => t.m?.imtpPF != null)) items.push({ lvl: 'warn', ic: 'settings', html: 'Choose which IMTP force you type in (OVR <b>net</b> or <b>gross</b>). It decides DSI and the IMTP levels.', href: '#/settings' });
  act.map(a => ({ a, list: HS_STD.map(s => stdLatest(a, s.key)).filter(r => stdGraded(r) && r.lv === 0) })).filter(x => x.list.length).slice(0, 4)
    .forEach(x => items.push({ lvl: 'warn', ic: 'target', html: `<b>${esc(athleteName(x.a, true))}</b>: Poor on ${esc(x.list.slice(0, 3).map(r => stdName(r.s)).join(', '))}${x.list.length > 3 ? ` +${x.list.length - 3} more` : ''}`, href: `#/athlete/${x.a.id}` }));
  S.teamtests.filter(s => !s.done).sort(byKey('date')).slice(-2).forEach(s => items.push({ lvl: 'info', ic: 'clipboard', html: `Team test day in progress: <b>${esc(ttTitle(s))}</b> (${esc(fmtDate(s.date))})`, href: `#/teamtest/${s.id}` }));
  const never = act.filter(a => !testsFor(a.id).length), due = act.filter(a => { const t = testsFor(a.id).pop(); return t && daysBetween(t.date, T) > 42; });
  if (due.length) items.push({ lvl: 'info', ic: 'clock', html: `<b>${plural(due.length, 'athlete')}</b> not tested in 6+ weeks: ${names(due)}`, href: due.length === 1 ? `#/athlete/${due[0].id}/testing` : '#/athletes' });
  if (never.length) items.push({ lvl: 'info', ic: 'clipboard', html: `<b>${plural(never.length, 'athlete')}</b> with no tests yet: ${names(never)}`, href: never.length === 1 ? `#/athlete/${never[0].id}/testing` : '#/athletes' });
  const miss = act.filter(a => !(a.sex === 'M' || a.sex === 'F') || !a.dob);
  if (miss.length) items.push({ lvl: 'info', ic: 'users', html: `<b>${plural(miss.length, 'athlete')}</b> missing sex or birth date (needed for standards and percentiles): ${names(miss)}`, href: `#/athlete/${miss[0].id}` });
  return items;
}
function needsAttentionCard() {
  if (!S.athletes.length) return '';
  const items = needsAttention();
  return `<div class="card na-card"><div class="card-head"><h3>Needs attention</h3><span class="sub">${items.length ? plural(items.length, 'item') : 'all clear'}</span></div>
    ${items.length ? `<div class="list">${items.slice(0, 8).map(i => `<a class="row na ${i.lvl}" href="${i.href}">${icon(i.ic)}<span class="row-main na-text">${i.html}</span>${icon('chevR', 'sm')}</a>`).join('')}</div>` : '<div class="muted small">Nothing needs you right now.</div>'}</div>`;
}

/* ---------- Quick Find: athletes, teams, test days and pages from anywhere (⌘K / Ctrl+K or /) ---------- */
function quickFindResults(q) {
  const ql = q.trim().toLowerCase(), hit = (...xs) => !ql || xs.some(x => String(x || '').toLowerCase().includes(ql));
  const pages = [...NAV, ['settings', 'Settings', 'settings'], ['references', 'Methods & References', 'ref'], ['fpai/standards', 'High-school standards', 'list'], ['more', 'More', 'grid']];
  const out = [];
  sortedAthletes().filter(a => hit(athleteName(a), a.sport, a.team, a.position)).slice(0, 8).forEach(a => out.push({ href: `#/athlete/${a.id}`, html: `${avatar(a, 'sm')}<span class="row-main"><span class="row-title">${esc(athleteName(a))}${a.archived ? ' <span class="badge">Archived</span>' : ''}</span><span class="row-sub">${esc([a.sport, a.team].filter(Boolean).join(' · ') || 'Athlete')}</span></span>` }));
  if (ql) {
    S.teams.filter(t => hit(t.name, t.sport)).slice(0, 4).forEach(t => out.push({ href: `#/teams/${t.id}`, html: `${icon('users')}<span class="row-main"><span class="row-title">${esc(t.name)}</span><span class="row-sub">Team · ${plural(teamRoster(t).length, 'athlete')}</span></span>` }));
    S.teamtests.filter(s => hit(ttTitle(s))).sort((a, b) => b.date.localeCompare(a.date)).slice(0, 3).forEach(s => out.push({ href: `#/teamtest/${s.id}`, html: `${icon('clipboard')}<span class="row-main"><span class="row-title">${esc(ttTitle(s))}</span><span class="row-sub">Test day · ${esc(fmtDate(s.date))}</span></span>` }));
  }
  pages.filter(([k, l]) => ql && hit(l, k)).slice(0, 5).forEach(([k, l, ic]) => out.push({ href: `#/${k}`, html: `${icon(ic)}<span class="row-main"><span class="row-title">${esc(l)}</span><span class="row-sub">Page</span></span>` }));
  return out;
}
A.quickFind = () => {
  if (modalStack.some(m => m.wrap.querySelector('#qfInput'))) return;
  const m = openModal({
    title: 'Find', size: 'narrow',
    body: `<div class="searchbox">${icon('search', 'sm')}<input type="search" id="qfInput" placeholder="Athlete, team, test day or page" autocomplete="off" autofocus aria-label="Find"></div><div class="list qf-list" id="qfList"></div>`,
    onMount: mm => {
      const inp2 = $('#qfInput', mm.wrap), list = $('#qfList', mm.wrap);
      const draw = () => { const r = quickFindResults(inp2.value); list.innerHTML = r.map((x, i) => `<a class="row qf ${i ? '' : 'first'}" href="${x.href}">${x.html}</a>`).join('') || '<div class="muted small" style="padding:10px 4px">Nothing found.</div>'; };
      inp2.addEventListener('input', draw);
      inp2.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); const f = $('a.qf', list); if (f) { mm.close(); go(f.getAttribute('href')); } } });
      list.addEventListener('click', e => { if (e.target.closest('a.qf')) mm.close(); });
      draw();
      setTimeout(() => inp2.focus(), 30);
    },
  });
};
document.addEventListener('keydown', e => {
  const typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
  if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') || (e.key === '/' && !typing && !modalStack.length)) {
    if (document.body.classList.contains('locked')) return;
    e.preventDefault();
    A.quickFind();
  }
});
