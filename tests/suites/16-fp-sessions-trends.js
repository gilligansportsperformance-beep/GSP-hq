// Performance HQ end-to-end tests — v1.12: force plate tests in the library and the session log,
// automatic PRs (tests and lifts, RPE-10 singles → tested 1RM), reports measured from the first test,
// and suggestions built from trends across tests
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const submit = () => p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]');
  const close = () => p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]');
  const st = (fn, a) => p.evaluate(fn, a);
  const fits = async () => (await st(() => document.documentElement.scrollWidth)) <= 391;
  const toasts = () => p.$$eval('.toast', els => els.map(e => e.textContent).join(' | '));
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(700);

  console.log('== Library: force plate tests');
  const lib = await st(() => ({ fp: S.exercises.filter(e => e.fpTest).map(e => `${e.id}|${e.category}|${e.fpTest}`), again: ensureFpTests(), cat: EX_CATS[0] }));
  assert(lib.fp.length === 10 && lib.fp.every(x => x.startsWith('fpt-') && x.includes('|Force plate testing|')), `10 force plate tests in the library, with fixed ids (${lib.fp.length})`);
  assert(lib.again === 0 && lib.cat === 'Force plate testing', 'adding them again never makes duplicates; the category comes first');
  const del = await st(() => { removeRec('exercises', 'fpt-hop'); const n = ensureFpTests(); const back = !!getExercise('fpt-hop'); const n2 = addStarterLibrary(); return { n, back, n2, now: !!getExercise('fpt-hop') }; });
  assert(del.n === 0 && !del.back, 'a test the coach deleted is not added back on its own');
  assert(del.n2 >= 1 && del.now, '“Load starter library” brings it back on request');
  await p.goto(BASE + '#/library'); await p.waitForTimeout(300);
  await p.click('.chip[data-v="Force plate testing"]'); await p.waitForTimeout(250);
  const lv = await p.innerText('#view');
  assert(lv.includes('CMJ Test') && lv.includes('IMTP Test') && lv.includes('Drop Landing Test') && lv.includes('Single-Leg IMTP Test') && lv.includes('log it in the session'), 'library shows the tests with how they work');
  assert(await p.locator('#libResults .badge', { hasText: 'Test' }).count() === 10, 'each test has a Test badge');
  await p.locator('#libResults button.row', { hasText: 'CMJ Test' }).click(); await p.waitForTimeout(250);
  const em = await p.innerText('.modal');
  assert((await p.inputValue('.modal select[name=fpTest]')) === 'cmj' && em.includes('CMJ height, Peak propulsive force (each trial, averaged)') && em.includes('Time to takeoff'), 'the exercise shows which metrics it logs');
  await close(); await p.waitForTimeout(150);
  assert(await fits(), 'library fits the iPhone screen');

  const ids = await st(() => {
    const yr = n => addDays(today(), -Math.round(n * 365.25)), T = today();
    const a = upsert('athletes', { firstName: 'Liam', lastName: 'Carter', sex: 'M', dob: yr(16.3), sport: 'Soccer', archived: false });
    const t0 = upsert('tests', { athleteId: a.id, date: addDays(T, -90), bodyMassKg: 70, sides: {}, isoType: 'IMTP', m: { cmj: 16 * 2.54, cmjPF: 1550, imtpPF: 1450 } }).id;
    const t1 = upsert('tests', { athleteId: a.id, date: addDays(T, -40), bodyMassKg: 70, sides: {}, isoType: 'IMTP', m: { cmj: 17 * 2.54, cmjPF: 1600, imtpPF: 1500 } }).id;
    const sq = S.exercises.find(e => e.name === 'Back Squat').id;
    upsert('workouts', { athleteId: a.id, date: addDays(T, -14), title: 'Lower A', items: [{ id: 'old1', exerciseId: sq, sets: '3', reps: '5', intensity: 'load' }], log: { old1: [{ load: 120, reps: 5 }, { load: 125, reps: 5 }] }, completed: true });
    return { a: a.id, t0, t1, sq };
  });

  console.log('== Planning a test in a workout');
  await st(({ a }) => openWorkoutModal(null, { athleteId: a, date: today() }), ids);
  await p.waitForTimeout(250);
  await p.selectOption('.modal .item-editor [data-k=exerciseId]', 'fpt-cmj'); await p.waitForTimeout(200);
  const ie = await p.innerText('.modal .item-editor');
  assert(/Trials/i.test(ie) && !/Intensity/i.test(ie) && ie.includes('Force plate test · logs CMJ height'), 'a test asks for trials (not sets, reps and load) and says what it logs');
  await p.click('.modal [data-add-item]'); await p.waitForTimeout(150);
  await p.selectOption('.modal .item-editor >> nth=1 >> [data-k=exerciseId]', 'fpt-imtp'); await p.waitForTimeout(150);
  await p.click('.modal [data-add-item]'); await p.waitForTimeout(150);
  await p.selectOption('.modal .item-editor >> nth=2 >> [data-k=exerciseId]', ids.sq); await p.waitForTimeout(150);
  await p.fill('.modal input[name=title]', 'Test + Lower');
  await submit(); await p.waitForTimeout(400);
  const wo = await st(({ a }) => S.workouts.find(w => w.athleteId === a && w.date === today()), ids);
  assert(wo && wo.items.length === 3 && wo.items[0].intensity === 'bw' && wo.items[0].sets === '3' && wo.items[0].exerciseId === 'fpt-cmj', 'saved with the tests as workout items (3 trials)');
  ids.w = wo.id;
  await p.goto(BASE + `#/athlete/${ids.a}/program`); await p.waitForTimeout(400);
  assert((await p.innerText('.wo')).includes('Force plate test · 3 trials'), 'the workout card shows the tests');

  console.log('== Logging the tests in the session');
  await p.click('.wo [data-act=logSession]'); await p.waitForTimeout(500);
  const cmjB = p.locator('.fp-block').nth(0), imB = p.locator('.fp-block').nth(1);
  assert(await p.locator('.fp-block').count() === 2 && await cmjB.locator('input[data-k=cmj]').count() === 3 && await cmjB.locator('input[data-k=cmjPP]').count() === 1, 'each test has its trials and single metrics');
  assert((await cmjB.innerText()).includes('Last time') && (await p.inputValue('[data-fp-bm]')) === '154.3', 'shows last time, and today’s body mass is pre-filled');
  const fill = async (blk, k, vals) => { for (let i = 0; i < vals.length; i++) await blk.locator(`input[data-k=${k}][data-i="${i}"]`).fill(String(vals[i])); };
  await fill(cmjB, 'cmj', [19.2, 19.6, 19.4]); await fill(cmjB, 'cmjPF', [1640, 1660, 1650]);
  await cmjB.locator('input[data-k=cmjPP]').fill('3700'); await cmjB.locator('input[data-k=ttt]').fill('0.72');
  await fill(imB, 'imtpPF', [1790, 1810, 1800]);
  await p.waitForTimeout(150);
  const fb = await cmjB.locator('[data-fb$=":cmj"]').innerText();
  assert(fb.includes('Avg 19.4 in') && fb.includes('PR') && /14\.1% vs last/.test(fb), `live feedback: average, PR and change vs last (${fb.replace(/\s+/g, ' ')})`);
  const calc = await p.innerText('[data-fp-calc]');
  assert(calc.includes('mRSI') && calc.includes('0.68') && calc.includes('Dynamic strength index') && calc.includes('0.92'), `calculated values from all tests in the session (${calc})`);
  await imB.locator('input[data-k=imtpF100]').fill('8OO'); await p.waitForTimeout(80);
  await submit(); await p.waitForTimeout(250);
  assert((await p.innerText('.modal .form-error')).includes('IMTP Test: check Force at 100 ms'), 'a typo is caught before saving');
  await imB.locator('input[data-k=imtpF100]').fill('800');
  // lifts: a 5-rep PR and a single at RPE 10
  const sqB = p.locator('.log-item:not(.fp-block)').first();
  await sqB.locator('.log-row').nth(0).locator('input[data-k=load]').fill('286.6');
  await sqB.locator('.log-row').nth(0).locator('input[data-k=reps]').fill('5');
  await sqB.locator('[data-add-set]').click();
  await sqB.locator('.log-row').last().locator('input[data-k=load]').fill('330');
  await sqB.locator('.log-row').last().locator('input[data-k=reps]').fill('1');
  await sqB.locator('.log-row').last().locator('input[data-k=rpe]').fill('10');
  assert(await fits(), 'session log with tests fits the iPhone screen');
  await p.screenshot({ path: SP + '/v112-logger.png' });
  await submit(); await p.waitForTimeout(700);
  const ts = await toasts();
  assert(ts.includes('force plate results added to testing'), 'saving says the results went to testing');
  assert(ts.includes('🏆 New PRs for Liam: CMJ height 19.4 in (was 17.0 in)') && ts.includes('Back Squat 330 lb × 1 (heaviest ever, was 275.6 lb) and 286.6 lb × 5 (5-rep PR, was 275.6 lb)'), 'PRs are announced straight away, tests and lifts');
  assert(ts.includes('Tested 1RM saved: Back Squat 330 lb'), 'a single at RPE 10 saves as a tested 1RM');
  const saved = await st(({ a, w, t0, t1, sq }) => {
    const rec = getRec('tests', w + '~fp');
    return { rec, n: testsFor(a).length, t0: getRec('tests', t0)?.m, t1: getRec('tests', t1)?.m, max: S.maxes.filter(x => x.workoutId === w), lb: lbEntries('lift:' + sq).filter(e => e.aid === a).map(e => e.v) };
  }, ids);
  assert(saved.rec && saved.rec.workoutId === ids.w && saved.rec.isoType === 'IMTP' && near(saved.rec.m.cmj, 19.4 * 2.54) && saved.rec.m.cmjPF === 1650 && saved.rec.m.imtpPF === 1800 && saved.rec.trials.cmj.length === 3 && saved.rec.bodyMassKg === 70, 'one dated test record: averages, trials, body mass, linked to the workout');
  assert(saved.n === 3 && saved.t0.cmj === 16 * 2.54 && saved.t1.imtpPF === 1500, 'earlier tests are kept as they were, so history and trends stay');
  assert(saved.max.length === 1 && near(saved.max[0].kg, 149.69) && saved.lb.some(v => near(v, 149.69)), 'the tested 1RM is on the 1RM leaderboard');
  const dsi = await st(({ w }) => testMetrics(getRec('tests', w + '~fp')).dsi, ids);
  assert(near(dsi, 1650 / 1800, 0.001), 'DSI comes from the CMJ and IMTP logged in the same session');

  console.log('== Results update everywhere');
  await p.goto(BASE + `#/athlete/${ids.a}/program`); await p.waitForTimeout(400);
  const card = await p.innerText('.wo');
  assert(card.includes('Logged: CMJ height 19.4 in') && await p.locator('.wo .badge.pr').count() >= 3, 'workout card shows what was logged, with PR badges');
  await p.goto(BASE + `#/athlete/${ids.a}`); await p.waitForTimeout(400);
  const prc = await p.$eval('.pr-card', el => el.textContent.replace(/\s+/g, ' '));
  assert(/CMJ height ?New PR/.test(prc) && prc.includes('from 16.0 in') && prc.includes('19.4 in') && prc.includes('Back Squat 1RM'), 'Personal records card: new PRs first, with the change from the first result');
  assert((await p.innerText('.std-card')).includes('19.4 in'), 'the standards meters use the new result');
  await p.goto(BASE + `#/athlete/${ids.a}/testing`); await p.waitForTimeout(400);
  assert((await p.innerText('#view')).includes('Logged in session: Test + Lower'), 'the Testing tab lists it as a test from the session');

  console.log('== Re-opening and editing the session');
  await p.goto(BASE + `#/athlete/${ids.a}/program`); await p.waitForTimeout(300);
  await p.click('.wo [data-act=logSession]'); await p.waitForTimeout(500);
  assert((await p.inputValue('.fp-block >> nth=0 >> input[data-k=cmj][data-i="1"]')) === '19.6' && (await p.inputValue('.fp-block >> nth=0 >> input[data-k=cmjPP]')) === '3700', 'saved trials and values come back');
  await p.locator('.fp-block').nth(0).locator('input[data-k=cmj][data-i="2"]').fill('19.9');
  const sq2 = p.locator('.log-item:not(.fp-block)').first();
  await sq2.locator('.log-row').last().locator('input[data-k=rpe]').fill('9');
  await submit(); await p.waitForTimeout(600);
  const ed = await st(({ a, w }) => ({ recs: S.tests.filter(t => t.workoutId === w).length, cmj: getRec('tests', w + '~fp').m.cmj, max: S.maxes.filter(x => x.workoutId === w).length }), ids);
  assert(ed.recs === 1 && near(ed.cmj, (19.2 + 19.6 + 19.9) / 3 * 2.54), 'editing updates the same test record (no duplicates)');
  assert(ed.max === 0, 'changing the single to RPE 9 removes the tested 1RM it made');

  console.log('== Drafts, isometric squat next to IMTP, and clearing');
  await p.click('.wo [data-act=logSession]'); await p.waitForTimeout(500);
  await p.locator('.fp-block').nth(1).locator('input[data-k=imtpF200]').fill('1250'); await p.waitForTimeout(700);
  await close(); await p.waitForTimeout(200);
  await p.click('.wo [data-act=logSession]'); await p.waitForTimeout(500);
  assert(await p.locator('[data-draft-banner]').count() === 1 && (await p.inputValue('.fp-block >> nth=1 >> input[data-k=imtpF200]')) === '1250', 'unsaved test entries are kept on the device and restored');
  await p.selectOption('[data-add-ex]', 'fpt-isq'); await p.waitForTimeout(200);
  await p.locator('.fp-block').nth(2).locator('input[data-k=imtpPF][data-i="0"]').fill('2100');
  await submit(); await p.waitForTimeout(600);
  const two = await st(({ w }) => S.tests.filter(t => t.workoutId === w).map(t => `${t.id.split('~').pop()}:${t.isoType}:${t.m.imtpPF}`).sort(), ids);
  assert(two.join(',') === 'fp2:ISQ:2100,fp:IMTP:1800', `an isometric squat next to an IMTP saves as its own test (${two.join(', ')})`);
  const std = await st(({ a }) => ({ std: stdLatest(getAthlete(a), 'imtpPF').v, pr: [...prBests(a).keys()].filter(k => k.startsWith('imtpPF')) }), ids);
  assert(std.std === 1800 && std.pr.includes('imtpPF|IMTP') && std.pr.includes('imtpPF|ISQ'), 'IMTP standards and PRs never mix in the isometric squat');
  await p.click('.wo [data-act=logSession]'); await p.waitForTimeout(500);
  for (const i of [0, 1, 2]) await p.locator('.fp-block').nth(2).locator(`input[data-k=imtpPF][data-i="${i}"]`).fill('');
  await submit(); await p.waitForTimeout(500);
  assert((await st(({ w }) => S.tests.filter(t => t.workoutId === w).length, ids)) === 1, 'clearing a test removes its results');
  const stim = await st(({ w }) => { const wk = getRec('workouts', w); return itemStim(wk.items[0], wk.athleteId).key; }, ids);
  assert(stim === 'gen', 'tests are not counted as training stimulus');

  console.log('== Progress report: change from the first test');
  await p.goto(BASE + `#/reports?athlete=${ids.a}`); await p.waitForTimeout(500);
  const rt = p.locator('.report .r-sec', { hasText: 'Performance testing' });
  const row = await rt.locator('tr', { hasText: 'CMJ height' }).innerText();
  assert((await rt.locator('th').nth(1).innerText()).toLowerCase() === 'first' && row.includes('16.0 in') && /2[0-9]\.[0-9]%/.test(row), `the table starts from the first result (16.0 in), not the start of the period (${row.replace(/\s+/g, ' ')})`);
  assert((await rt.innerText()).includes('measured from each test’s first result'), 'and says so');
  await p.selectOption('select[data-change=repBaseline]', 'period'); await p.waitForTimeout(300);
  const row2 = await p.locator('.report .r-sec', { hasText: 'Performance testing' }).locator('tr', { hasText: 'CMJ height' }).innerText();
  assert(row2.includes('17.0 in') && !row2.includes('16.0 in'), 'or from the start of the period, if chosen');
  await p.selectOption('select[data-change=repPeriod]', 'all'); await p.waitForTimeout(300);
  const rng = await st(() => repRange(UI.rep));
  assert(rng.from === (await st(({ t0 }) => getRec('tests', t0).date, ids)), '“All time” starts at the athlete’s first data');
  await p.click('[data-act=repSave]'); await p.waitForTimeout(250);
  assert((await st(() => S.reports[S.reports.length - 1].baseline)) === 'period', 'saved reports keep the setting');
  assert(await fits(), 'report fits the iPhone screen');

  console.log('== Suggestions from trends');
  const tr = await st(() => {
    const yr = n => addDays(today(), -Math.round(n * 365.25)), T = today();
    const a = upsert('athletes', { firstName: 'Tara', lastName: 'Lee', sex: 'F', dob: yr(16.0), sport: 'Soccer', archived: false });
    [[-70, 15.0, 1700, 0.70], [-42, 15.2, 1710, 0.71], [-21, 15.1, 1690, 0.70], [-2, 13.9, 1705, 0.79]].forEach(([d, h, pf, ttt]) =>
      upsert('tests', { athleteId: a.id, date: addDays(T, d), bodyMassKg: 58, sides: {}, isoType: 'IMTP', m: { cmj: h * 2.54, imtpPF: pf, ttt } }));
    const b = upsert('athletes', { firstName: 'Ben', lastName: 'Up', sex: 'M', dob: yr(17.0), archived: false });
    [[-60, 18], [-30, 18.4], [-3, 19.8]].forEach(([d, h]) => upsert('tests', { athleteId: b.id, date: addDays(T, d), bodyMassKg: 75, sides: {}, m: { cmj: h * 2.54 } }));
    const t = k => metricTrend(a.id, k, k === 'imtpPF' ? 'IMTP' : null);
    const before = athPriorities(a).map(x => x.key);
    for (let w = 4; w >= 1; w--) for (let i = 0; i < 3; i++) upsert('workouts', { athleteId: a.id, date: addDays(T, -7 * w - i), title: 'S', items: [], completed: true, rpe: 5, durationMin: 100 });
    for (let i = 0; i < 4; i++) upsert('workouts', { athleteId: a.id, date: addDays(T, -i - 1), title: 'S', items: [], completed: true, rpe: 7.5, durationMin: 100 });
    const pr = athPriorities(a);
    return { cmj: t('cmj'), pf: t('imtpPF'), ttt: t('ttt'), before, pr: pr.map(x => ({ key: x.key, title: x.title, why: x.why, what: x.what, refs: x.refs })), up: athImproving(b), aid: a.id, bid: b.id,
      na: needsAttention().filter(i => i.html.includes('Tara')).map(i => i.html), ctx: athleteContext(a.id) };
  });
  assert(tr.cmj.dir === 'down' && tr.cmj.nRef === 3 && near(tr.cmj.recent, (13.9 - 15.1) / 15.1 * 100, 0.05), 'trend: latest vs the average of the 3 earlier tests, beyond the 4% typical error = declining');
  assert(tr.pf.dir === 'flat' && tr.pf.weeks >= 6 && tr.ttt.dir === 'down', 'within the typical error over 3 tests and 6+ weeks = plateau; slower take-off = worse');
  assert(tr.before[0] === 'drop', 'a slower take-off alone already counts as a sign of fatigue');
  const top = tr.pr[0];
  assert(top.key === 'drop' && top.title === 'Signs of fatigue: results trending down' && top.what.includes('training-load spike (acute:chronic 1.60)') && top.what.includes('slower take-off') && top.refs.includes('gabbett2016') && top.refs.includes('gathercole2015'), 'a drop that lines up with a load spike and a slower take-off is read as fatigue, with sources');
  const pw = tr.pr.find(x => x.key === 'power');
  assert(pw && pw.why.includes('declining, −7.9% vs the previous 3 tests') && pw.what.startsWith('Its latest drop lines up with signs of fatigue'), 'other suggestions say the trend and wait for a re-test before changing the plan');
  const pl = tr.pr.find(x => x.key === 'plateau');
  assert(pl && pl.why.includes('Peak force 1,705 N, no real change over 3 tests') && pl.refs.includes('haff2016'), 'a plateau suggests changing the stimulus');
  assert(tr.up.length === 1 && tr.up[0].startsWith('CMJ height (+') && tr.up[0].includes('vs the previous 2 tests'), `improving results are listed (${tr.up[0]})`);
  assert(tr.na.length === 1 && tr.na[0].includes('trending down: CMJ height −7.9% vs the previous 3 tests'), 'the dashboard flags athletes trending down');
  assert(tr.ctx.includes('Trends (latest result vs the average of up to 3 earlier results') && tr.ctx.includes('CMJ height: declining'), 'the Force Plate AI is given the trends');
  await p.goto(BASE + `#/athlete/${tr.aid}`); await p.waitForTimeout(400);
  const pcard = await p.innerText('.prio-card');
  assert(pcard.includes('Signs of fatigue') && /from results and trends/i.test(pcard) && pcard.includes('typical error'), 'the priorities card explains it is built from results and trends');
  await p.goto(BASE + `#/athlete/${tr.bid}`); await p.waitForTimeout(400);
  assert((await p.innerText('.prio-card')).includes('Improving: CMJ height'), 'profile shows what is improving');
  assert(await fits(), 'profile fits the iPhone screen');
  await p.screenshot({ path: SP + '/v112-trends.png', fullPage: false });

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
