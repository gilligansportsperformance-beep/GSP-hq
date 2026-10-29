/* =========================================================
   Training priorities: a short, ranked list of what to work on next, built from the athlete's results
   and how they are trending across tests. Rules are conservative and each cites the research behind it.
   Provisional and low-reliability standards (and athletes outside 14–18) never trigger a standards
   priority; trends apply at any age.
   ========================================================= */

/* ---------- Trends: how a result is moving across tests ----------
   The latest result is compared with the average of up to 3 earlier results from the 6 months before it
   (steadier than a single previous test), and a change counts only when it is larger than the test's
   typical error (Hopkins 2000). Three or more tests over 6+ weeks with no meaningful change = a plateau. */
const TREND_KEYS = ['cmj', 'sj', 'vj', 'rsiMod', 'cmjRelPP', 'cmjPP', 'imtpPF', 'imtpRel', 'djRsi', 'rsi105', 'broad', 'sprint10', 'sprint10yd', 'sprint20', 'sprint40yd', 'fly10', 'proAgility'];
function metricTrend(aid, k, iso = null) {
  const d = M[k];
  if (!d || !d.dir) return null;
  const ser = sameMethod(k, metricSeries(aid, k).filter(p => !iso || (p.iso || 'IMTP') === iso));
  if (!ser.length) return null;
  const last = ser[ser.length - 1], first = ser[0];
  const prev = ser.slice(0, -1).filter(p => daysBetween(p.date, last.date) <= 183).slice(-3);
  const ref = prev.length ? mean(prev.map(p => p.v)) : null;
  const pct = (x, y) => (y ? (x - y) / Math.abs(y) * 100 : null);
  const recent = ref != null ? pct(last.v, ref) : null, total = ser.length > 1 ? pct(last.v, first.v) : null;
  const gain = recent == null ? null : d.dir * recent;   // + = better, whichever way the test is scored
  const win = ser.slice(-3), weeks = Math.round(daysBetween(win[0].date, last.date) / 7);
  let dir = 'new';
  if (ref != null && d.te) dir = gain >= d.te ? 'up' : gain <= -d.te ? 'down' : ser.length >= 3 && weeks >= 6 ? 'flat' : 'steady';
  else if (ref != null) dir = 'steady';
  return { k, d, n: ser.length, first, last, ref, nRef: prev.length, recent, total, dir, weeks, te: d.te };
}
const trendIso = k => STD_BY[k]?.iso || (fpIsoKey(k) ? 'IMTP' : null);
function trendShort(t) {
  const timed = t.d.unit === 's', sg = x => `${x > 0 ? '+' : '−'}${fmtNum(Math.abs(x), 1)}%`;
  const vs = t.nRef > 1 ? `the previous ${t.nRef} tests` : 'the previous test';
  if (t.dir === 'up') return `${timed ? 'faster' : 'improving'}, ${sg(t.recent)} vs ${vs}`;
  if (t.dir === 'down') return `${timed ? 'slower' : 'declining'}, ${sg(t.recent)} vs ${vs}`;
  if (t.dir === 'flat') return `no real change over ${Math.min(t.n, 3)} tests (${t.weeks} weeks)`;
  if (t.dir === 'steady') return `similar to ${vs}`;
  return t.n > 1 ? 'first result in 6+ months' : 'first result';
}
/* One line per trending metric, for the AI and the report draft */
function athTrendLines(a) {
  return METRICS.filter(d => d.dir && d.te && !LB_EXCLUDE.has(d.key)).map(d => metricTrend(a.id, d.key, trendIso(d.key))).filter(t => t && t.n > 1 && t.dir !== 'new')
    .map(t => `${t.d.label}: ${trendShort(t)}; latest ${fmtMetric(t.d, t.last.v)} (${t.last.date}), first ${fmtMetric(t.d, t.first.v)} (${t.first.date}); typical error ${t.te}%`);
}

function athPriorities(a) {
  const out = [], T = today();
  // focus = the plain line used in progress reports for parents; keys = the results it is based on
  const add = (score, key, lvl, title, why, what, refs, focus = title, keys = []) => out.push({ score, key, lvl, title, why: why.filter(Boolean).join(' · '), what, refs, focus, keys });
  const L = key => { const r = stdLatest(a, key); return stdGraded(r) ? r : null; };
  const low = r => r && !r.target && r.lv <= 1;
  const TR = {}, tr = k => (k in TR ? TR[k] : (TR[k] = metricTrend(a.id, k, trendIso(k))));
  const trNote = k => { const t = tr(k); return t && t.dir !== 'new' ? trendShort(t) : ''; };
  const says = r => `${stdName(r.s)} ${stdVal(r)} (${stdLvName(r)})${trNote(r.s.key) ? `, ${trNote(r.s.key)}` : ''}`;
  const load = acwr(a.id), spike = !!(load && load.ratio >= 1.5);
  const rd = readyToday(a.id), rdS = rd ? readyEval(rd).status : null;
  // Recent drops, and whether they line up with fatigue (load spike, low readiness, slower take-off)
  const ttt = tr('ttt'), slower = !!(ttt && ttt.dir === 'down' && daysBetween(ttt.last.date, T) <= 42);
  const drops = TREND_KEYS.map(tr).filter(t => t && t.dir === 'down' && daysBetween(t.last.date, T) <= 42);
  const tired = drops.length > 0 && (spike || rdS === 'bad' || rdS === 'low' || slower);
  const fatigued = k => tired && drops.some(t => t.k === k);
  // the trend changes how urgent a weak result is, and what to do about it; a drop that lines up
  // with fatigue is read as fatigue first
  const trs = list => list.map(r => tr(r.s.key)).filter(Boolean);
  const adj = list => { const ts = trs(list); return ts.some(t => fatigued(t.k)) ? -4 : ts.some(t => t.dir === 'down') ? 8 : ts.length && ts.every(t => t.dir === 'up') ? -6 : ts.some(t => t.dir === 'flat') ? 4 : 0; };
  const lead = list => { const ts = trs(list); return ts.some(t => fatigued(t.k)) ? 'Its latest drop lines up with signs of fatigue, so re-test once recovered before changing the plan for it. ' : ts.some(t => t.dir === 'down') ? 'It is getting worse across tests, so it comes first. ' : ts.length && ts.every(t => t.dir === 'up') ? 'It is already improving across tests: keep this emphasis and keep progressing it. ' : ts.some(t => t.dir === 'flat') ? 'It has stopped improving, so change the stimulus (load, exercise choice or intent). ' : ''; };
  const ks = list => list.map(r => r.s.key);
  // Readiness today comes first: it changes today's session
  if (rdS === 'bad' || rdS === 'low') add(rdS === 'bad' ? 100 : 40, 'ready', rdS === 'bad' ? 'alert' : 'warn', rdS === 'bad' ? 'Fatigued today: reduce the session' : 'Slightly down today: protect quality', [`Readiness check ${READY_STATUS[rdS].label.toLowerCase()} compared with their normal`, spike ? `training load spike (acute:chronic ${fmtNum(load.ratio, 2)})` : ''], READY_STATUS[rdS].advice, ['claudino2017', 'gathercole2015', ...(spike ? ['gabbett2016'] : [])]);
  // Left–right differences: a difference on two tests in a row is more likely real
  const asym = ASYM_KEYS.map(k => { const s = metricSeries(a.id, k); return s.length ? { k, v: s[s.length - 1].v, prev: s.length > 1 ? s[s.length - 2].v : null } : null; }).filter(x => x && x.v >= 10).sort((x, y) => y.v - x.v)[0];
  if (asym) {
    const twice = asym.prev != null && asym.prev >= 10;
    add((asym.v >= 15 ? 35 : 15) + (twice ? 5 : 0), 'asym', asym.v >= 15 ? 'alert' : 'warn', 'Reduce the left–right difference', [`${M[asym.k].label} ${fmtNum(asym.v, 1)}%`, asym.prev != null ? `${twice ? 'also' : 'was'} ${fmtNum(asym.prev, 1)}% on the previous test` : 'first test with this measure'],
      `${twice ? 'It showed up on two tests in a row, so it is likely real. ' : 'Confirm it on a repeat test first, as asymmetry changes between tests and tasks. '}Then add single-leg strength and jump work (split squats, single-leg RDLs, single-leg hops) and re-test.`, ['bishop2018'], 'Even out the left–right difference with single-leg strength and jump work', [asym.k]);
  }
  // Landing
  const land = [L('dlPlfRel'), L('dlTts')].filter(low);
  if (land.length) add((land.some(r => r.lv === 0) ? 32 : 14) + adj(land), 'land', land.some(r => r.lv === 0) ? 'alert' : 'warn', 'Landing mechanics and deceleration', land.map(says), lead(land) + 'Teach and load landings 2–3 times a week for at least 6 weeks: stick landings, progressive drop landings starting below the test height, and jump–land–stick and deceleration drills, with the knees tracking over the toes.', ['hewett1996', 'myer2005'], 'Landing technique and control: stick landings, progressive drop landings and deceleration drills', ks(land));
  // Strength, and how well it is expressed (DSI = CMJ peak force ÷ IMTP peak force, gross ÷ gross)
  const prof = athleteProfiles(a.id).pop();
  const strength = [L('imtpRel'), L('imtpPF')].filter(Boolean);
  const strLow = strength.filter(low), strOk = strength.length && !strLow.length;
  const dsiHigh = prof && prof.dsi > 0.8, dsiLow = prof && prof.dsi < 0.6;
  if (strLow.length || dsiHigh) {
    add((strLow.some(r => r.lv === 0) ? 30 : strLow.length ? 20 : 6) + (dsiHigh ? 12 : 0) + adj(strLow), 'strength', 'warn', 'Build maximal strength', [...strLow.map(says), dsiHigh ? `DSI ${fmtNum(prof.dsi, 2)}: already expresses most of their strength in the jump` : ''],
      lead(strLow) + 'Main lifts 2–3 times a week (squat, hinge and pull variations), working toward 2–6 sets of up to 6 reps at 85% of 1RM or more, the NSCA strength range. For less experienced athletes keep technique first and progress gradually.', ['haff2016', 'suchomel2016', 'lloyd2014', ...(dsiHigh ? ['sheppard2011'] : [])], 'Build maximal strength in the main lifts (squat, hinge and pull)', [...ks(strLow), 'imtpPF', 'imtpRel']);
  }
  const f200 = L('imtpF200Rel');
  if (dsiLow || (low(f200) && strOk)) add((dsiLow ? 24 : 18) + (low(f200) ? adj([f200]) : 0), 'rate', 'warn', 'Express force faster', [dsiLow ? `DSI ${fmtNum(prof.dsi, 2)}: strong, but little of it shows in the jump` : '', low(f200) ? says(f200) : ''],
    (low(f200) ? lead([f200]) : '') + 'Pair heavy strength with ballistic work done with maximal intent: light-load jump squats or trap-bar jumps, Olympic-lift derivatives, medicine-ball throws and plyometrics.', ['sheppard2011', 'comfort2018', 'suchomel2018'], 'Produce force faster: jumps, throws and Olympic-lift variations done with full intent', low(f200) ? ['imtpF200Rel'] : []);
  // Jump output when strength is already there
  const power = [L('cmj'), L('cmjRelPP'), L('sj')].filter(low);
  if (power.length && strOk && !dsiLow) add((power.some(r => r.lv === 0) ? 20 : 12) + adj(power), 'power', 'warn', 'Turn strength into jump power', power.map(says), lead(power) + 'Strength is in place. Add jumping with maximal intent: loaded and unloaded jumps, plyometrics and Olympic-lift derivatives.', ['suchomel2018'], 'Turn strength into jump power: loaded and unloaded jumps and plyometrics', ks(power));
  // Stretch-shortening use
  const eur = L('eur');
  if (eur && eur.lv === 0) add(16, 'ssc', 'warn', 'Develop elastic (stretch-shortening) ability', [says(eur)], 'Add fast stretch-shortening work 2–3 times a week: pogo hops and snap-downs, then countermovement and low drop jumps with quick, stiff rebounds. Start with few contacts and progress.', ['mcguigan2006', 'flanagan2008'], 'Springy, elastic jumping: pogo hops, snap-downs and quick rebound jumps', ['eur']);
  // Braking
  const brake = L('brakeRfd');
  if (low(brake)) add((brake.lv === 0 ? 14 : 8) + adj([brake]), 'brake', 'warn', 'Eccentric strength and braking', [says(brake)], lead([brake]) + 'Build braking: slow-lowering (eccentric-emphasis) squats, snap-downs and drop landings, alongside heavy strength work.', ['mcmahon2018', 'suchomel2018'], 'Braking strength: slow-lowering squats, snap-downs and drop landings', ['brakeRfd']);
  // Arm swing
  const arm = L('armSwing');
  if (arm && arm.lv === 0) add(8, 'arms', 'info', 'Use the arm swing', [says(arm)], 'Coach the arm drive in jumping: a full backswing timed with the dip, then drive the arms up hard through take-off. Practise with Abalakov jumps.', ['lees2004', 'harman1990'], 'A strong, well-timed arm swing when jumping', ['armSwing']);
  // Trends across tests (any age). With signs of fatigue every drop belongs here; otherwise only the
  // drops a priority above doesn't already cover
  const used = new Set(out.flatMap(p => p.keys)), fresh = (t, days) => t && daysBetween(t.last.date, T) <= days && !used.has(t.k);
  const shown = tired ? drops : drops.filter(t => !used.has(t.k));
  if (shown.length) {
    const cause = [spike ? `a training-load spike (acute:chronic ${fmtNum(load.ratio, 2)})` : '', rdS === 'bad' || rdS === 'low' ? 'a low readiness check today' : '', slower ? 'a slower take-off in the jump' : ''].filter(Boolean).join(' and ');
    add((shown.length > 1 ? 30 : 22) + (tired ? 6 : 0), 'drop', shown.length > 1 || tired ? 'alert' : 'warn', tired ? 'Signs of fatigue: results trending down' : 'Results are trending down', [...shown.map(t => `${t.d.label} ${fmtMetric(t.d, t.last.v)}, ${trendShort(t)}`), slower ? `time to takeoff ${trendShort(ttt)}` : ''],
      tired ? `This lines up with ${cause}, which points to accumulated fatigue rather than lost ability. Cut volume for about a week (keep some intensity), check sleep, soreness and illness, then re-test.` : 'Rule out testing conditions first (warm-up, time of day, surface, technique). If a repeat test confirms it, look at fatigue, sleep, illness and recent changes to the program.',
      tired ? ['claudino2017', 'gathercole2015', ...(spike ? ['gabbett2016'] : [])] : ['hopkins2000', 'claudino2017'], 'Manage fatigue and re-test: some results dipped below their recent level', shown.map(t => t.k));
  }
  const dropped = new Set(drops.map(t => t.k));
  const flats = ['cmj', 'imtpPF', 'imtpRel', 'cmjRelPP', 'rsiMod', 'sprint10', 'sprint40yd', 'broad'].map(tr).filter(t => fresh(t, 60) && t.dir === 'flat' && !dropped.has(t.k));
  if (flats.length) add(8 + 2 * flats.length, 'plateau', 'info', 'Progress has levelled off', flats.map(t => `${t.d.label} ${fmtMetric(t.d, t.last.v)}, ${trendShort(t)}`),
    'Change the stimulus for the next block: progress load or volume, change exercise selection, or shift the emphasis (for example from strength toward power). Re-test after 4–6 weeks.', ['haff2016', 'hopkins2000'], 'A new training block to restart progress', flats.map(t => t.k));
  out.sort((x, y) => y.score - x.score);
  return out;
}
/* Good and Elite results worth telling the athlete about, grouped by level */
function athStrengths(a) {
  const rs = HS_STD.map(s => stdLatest(a, s.key)).filter(r => stdGraded(r) && r.lv >= 2);
  return [3, 2].map(lv => { const xs = rs.filter(r => r.lv === lv).map(r => stdName(r.s)); return xs.length ? `${STD_LV[lv][1]}: ${xs.join(', ')}` : ''; }).filter(Boolean);
}
/* Results improving beyond test noise (tested in the last 60 days) */
function athImproving(a) {
  return TREND_KEYS.map(k => metricTrend(a.id, k, trendIso(k))).filter(t => t && t.dir === 'up' && daysBetween(t.last.date, today()) <= 60).map(t => `${t.d.label} (${trendShort(t).replace(/^improving, /, '')})`);
}
function athPrioCard(a) {
  if (!testsFor(a.id).length && !readyToday(a.id)) return '';
  const list = athPriorities(a), str = athStrengths(a), up = athImproving(a);
  const item = (p, i) => `<div class="prio ${p.lvl}"><div class="prio-n">${i + 1}</div><div class="grow" style="min-width:0"><div class="prio-t">${esc(p.title)}</div>${p.why ? `<div class="prio-why">${esc(p.why)}</div>` : ''}<div class="prio-do"><b>Do:</b> ${esc(p.what)}</div>${refLinks(p.refs)}</div></div>`;
  return `<div class="card prio-card"><div class="card-head"><h3>Training priorities</h3><span class="sub">from results and trends</span></div>
    ${list.length ? list.slice(0, 3).map(item).join('') : `<div class="muted small">No clear weak spot or worrying trend in the results. Keep progressing the current plan and re-test at the next evaluation.</div>`}
    ${list.length > 3 ? `<details class="group" style="margin-top:8px"><summary>${plural(list.length - 3, 'more priority', 'more priorities')}</summary><div class="group-body">${list.slice(3).map((p, i) => item(p, i + 3)).join('')}</div></details>` : ''}
    ${up.length ? `<div class="prio-str up">${icon('trend', 'sm')} <span><b>Improving:</b> ${esc(up.join(', '))}</span></div>` : ''}
    ${str.length ? `<div class="prio-str">${icon('trophy', 'sm')} <span><b>Strengths</b> · ${esc(str.join(' · '))}</span></div>` : ''}
    <p class="faint tiny" style="margin:10px 0 0">Built from your standards and ${esc(a.firstName)}’s trends: each latest result is compared with the average of up to 3 earlier tests, and a change counts only when it is larger than that test’s typical error. Also uses the DSI/EUR profile, asymmetry, readiness and training load, each linked to the research behind it. Provisional and low-reliability results don’t drive them. Adjust for sport, injury history, maturity and training age.</p>${refLinks(['hopkins2000'])}</div>`;
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
  act.map(a => ({ a, list: TREND_KEYS.map(k => metricTrend(a.id, k, trendIso(k))).filter(t => t && t.dir === 'down' && daysBetween(t.last.date, T) <= 21) })).filter(x => x.list.length).slice(0, 4)
    .forEach(x => items.push({ lvl: 'warn', ic: 'trend', html: `<b>${esc(athleteName(x.a, true))}</b> trending down: ${esc(x.list.slice(0, 2).map(t => `${t.d.label} ${trendShort(t).replace(/^declining, /, '')}`).join('; '))}`, href: `#/athlete/${x.a.id}` }));
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
