// Performance HQ end-to-end tests — v1.26: sprint times in the session log. Timed exercises (sprints, starts,
// timed agility) log a time per rep; sprint tests log trials and save the best time to the athlete's testing
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const top = '.modal-wrap >> nth=-1';
  const submit = () => p.click(`${top} >> .modal-head button[type=submit]`);
  const st = (fn, a) => p.evaluate(fn, a);
  const fits = async () => (await st(() => document.documentElement.scrollWidth)) <= 391;
  await p.goto(BASE); await p.waitForSelector('.modal'); await submit(); await p.waitForTimeout(400);
  // the starter library (with its sprint exercises) for a fresh install
  await st(() => addStarterLibrary());

  console.log('== The library knows what is timed');
  const lib = await st(() => {
    const n = name => S.exercises.find(e => e.name === name);
    return {
      tests: Object.values(SPRINT_TESTS).every(t => getExercise(t.id)?.category === 'Sprint testing'),
      timed: ['Acceleration Sprint (10–20 m)', 'Flying Sprint (10–30 m)', 'Pro Agility (5-10-5)', 'Hill Sprint', '3-Point Start (10 yd)', 'L-Drill (3-Cone)'].map(x => timedEx(n(x))),
      not: ['A-Skip', 'Wall Drill', 'Heavy Sled Push', 'Reactive Agility (Mirror)', 'Ladder: Icky Shuffle', 'Back Squat'].map(x => timedEx(n(x))),
    };
  });
  assert(lib.tests, 'sprint tests are in the library under “Sprint testing”');
  assert(lib.timed.every(Boolean) && !lib.not.some(Boolean), 'sprints, starts and timed agility drills log times; drills like A-skips, ladders and sled pushes keep sets & reps');

  const A = await st(() => {
    const a = upsert('athletes', { firstName: 'Kai', lastName: 'Ward', sex: 'M', dob: '2009-03-03', archived: false });
    const ex = n => S.exercises.find(e => e.name === n).id;
    upsert('tests', { athleteId: a.id, date: addDays(today(), -30), sides: {}, m: { sprint40yd: 5.20, sprint10yd: 1.75 } });
    // last week's acceleration sprints, logged
    upsert('workouts', { athleteId: a.id, date: addDays(today(), -7), title: 'Speed', completed: true, items: [{ id: 'p1', exerciseId: ex('Acceleration Sprint (10–20 m)'), sets: '4', reps: '1 × 15 m', intensity: 'bw' }], log: { p1: [{ time: 2.40 }, { time: 2.36 }, { time: 2.38 }, { time: 2.35 }] } });
    const w = upsert('workouts', { athleteId: a.id, date: today(), title: 'Speed day', items: [
      { id: 'w1', exerciseId: ex('Acceleration Sprint (10–20 m)'), sets: '6', reps: '1 × 15 m', intensity: 'bw' },
      { id: 'w2', exerciseId: 'spt-40yd', sets: '2', reps: '', intensity: 'bw' },
      { id: 'w3', exerciseId: ex('Back Squat'), sets: '3', reps: '5', intensity: 'load', load: U.massIn(185) }] });
    return { aid: a.id, wid: w.id, acc: ex('Acceleration Sprint (10–20 m)') };
  });

  console.log('== The builder');
  await st(() => openWorkoutModal(null, { athleteId: S.athletes[S.athletes.length - 1].id, date: addDays(today(), 3) })); await p.waitForTimeout(350);
  await p.click('[data-add-item]'); await p.waitForSelector('[data-xp-q]');
  for (const [name, id] of [['Hill Sprint', await st(() => S.exercises.find(e => e.name === 'Hill Sprint').id)], ['40 yd Dash Test', 'spt-40yd']]) {
    await p.fill('[data-xp-q]', name); await p.waitForTimeout(60);
    await p.click(`.xp-row[data-xp-id="${id}"] >> visible=true`);
  }
  await p.click('[data-xp-add]'); await p.waitForTimeout(350);
  const rows = await p.$$eval('#itemsHost .item-editor', els => els.map(e => e.innerText.replace(/\s+/g, ' ')));
  assert(rows[0].includes('Logged as a time per rep in the session log') && await p.inputValue('#itemsHost .item-editor >> nth=0 >> [data-k=sets]') === '4', `a sprint drill starts as 4 × 1 and says it logs times (${rows[0].slice(0, 60)}…)`);
  assert(rows[1].includes('Sprint test · logs the 40 yd dash, with 10 yd and 20 yd splits (optional)') && rows[1].includes('best time saves to the athlete’s testing'), 'a sprint test row says what it logs and that it saves to testing');
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(200);
  const dlg = p.locator('.dlg-actions button', { hasText: /Discard|Leave|Close without/i });
  if (await dlg.count()) { await dlg.first().click(); await p.waitForTimeout(200); }

  console.log('== The session log');
  await st(id => openSessionLogger(getRec('workouts', id)), A.wid); await p.waitForTimeout(500);
  const acc = '.log-item[data-block="w1"]';
  assert(await p.locator(`${acc} [data-tm]`).count() === 6 && (await p.innerText(acc)).includes('Last time') && (await p.innerText(acc)).includes('2.40, 2.36, 2.38, 2.35 s (best 2.35)'), 'the acceleration sprints get 6 time boxes and last time’s times');
  for (const [i, t] of [[0, '2.33'], [1, '2.30'], [2, '2.31']]) await p.fill(`${acc} [data-tm][data-i="${i}"]`, t);
  await p.waitForTimeout(80);
  const sum = await p.innerText(`${acc} [data-tm-sum]`);
  assert(sum.includes('Best 2.30 s') && sum.includes('avg 2.31 s') && sum.includes('15 m at 6.5 m/s (14.6 mph)') && sum.includes('▼ 0.05 s vs last time’s best'), `best, average, speed over the distance and the change from last time (${sum})`);
  await p.fill(`${acc} [data-tm][data-i="3"]`, '2,3x'); await p.waitForTimeout(60);
  assert(await p.locator(`${acc} [data-tm][data-i="3"].bad`).count() === 1, 'a typo is flagged');
  await submit(); await p.waitForTimeout(300);
  assert((await p.innerText(`${top} >> .form-error`)).includes('Acceleration Sprint (10–20 m): check rep 4’s time'), 'and saving says which time to fix');
  await p.fill(`${acc} [data-tm][data-i="3"]`, ''); await p.waitForTimeout(60);
  await p.click(`${acc} [data-tm-add]`); await p.waitForTimeout(150);
  assert(await p.locator(`${acc} [data-tm]`).count() === 7, 'Add rep adds a box');
  const sp = '.log-item[data-block="w2"]';
  assert((await p.innerText(sp)).includes('Sprint test') && await p.locator(`${sp} [data-sp]`).count() === 6 && (await p.innerText(sp)).includes('40 yd 5.20 s'), 'the 40 yd test: 2 trials × (10 yd, 20 yd splits, 40 yd), and last time');
  const T = (k, i) => `${sp} [data-sp][data-k="${k}"][data-i="${i}"]`;
  await p.fill(T('sprint10yd', 0), '1.72'); await p.fill(T('sprint20yd', 0), '2.98'); await p.fill(T('sprint40yd', 0), '5.18');
  await p.fill(T('sprint10yd', 1), '1.70'); await p.fill(T('sprint40yd', 1), '5.11'); await p.waitForTimeout(80);
  const fb40 = await p.innerText(`${sp} [data-sp-fb$=":sprint40yd"]`);
  assert(fb40.includes('Best 5.11 s') && fb40.includes('PR'), `the best 40 yd time, marked as a PR as you type (${fb40.replace(/\s+/g, ' ')})`);
  assert(await p.locator('.log-item[data-block="w3"] [data-k=load]').count() === 3, 'a lift in the same session keeps load × reps');
  assert(await fits(), 'the session log fits the iPhone screen');
  await p.locator(acc).screenshot({ path: SP + '/v126-timed.png' });
  await p.locator(sp).screenshot({ path: SP + '/v126-sprint-test.png' });
  await submit(); await p.waitForTimeout(500);

  console.log('== Saved: times in the session, best times in testing');
  const S1 = await st(({ wid, aid }) => {
    const w = getRec('workouts', wid), t = getRec('tests', `${wid}~sp~w2`);
    return { times: (w.log.w1 || []).map(r => r.time), test: t && { m: t.m, trials: t.trials, src: testSource(t) }, lb: lbEntries('sprint40yd').filter(e => e.aid === aid).map(e => e.v).join() };
  }, A);
  assert(S1.times.join() === '2.33,2.3,2.31', 'the session keeps the three typed times (empty boxes dropped)');
  assert(S1.test && S1.test.m.sprint40yd === 5.11 && S1.test.m.sprint10yd === 1.70 && S1.test.m.sprint20yd === 2.98 && S1.test.trials.sprint40yd.join() === '5.18,5.11' && S1.test.src === 'Session log', 'the 40 yd test saved its best time and splits to testing, with the trials, as a session-log result');
  assert(S1.lb.includes('5.11'), 'so it reaches the leaderboard');
  const toasts = await p.$$eval('.toast', ts => ts.map(t => t.textContent).join(' | '));
  assert(toasts.includes('sprint times added to testing') && /New PR[\s\S]*40 yd/.test(toasts), `the save says so, with the PR (${toasts.slice(0, 120)}…)`);
  await p.goto(BASE + `#/athlete/${A.aid}/program`); await p.waitForTimeout(400);
  const card = await p.innerText('.wo');
  assert(card.includes('Logged: 2.33, 2.30, 2.31 s (best 2.30)') && card.includes('Sprint test · 2 trials') && /40 yd 5\.11 s PR/.test(card.replace(/\s+/g, ' ')), 'the workout card shows the times and the test result');
  await p.goto(BASE + `#/athlete/${A.aid}/testing`); await p.waitForTimeout(300);
  assert((await p.innerText('#view')).includes('5.11'), 'the Testing tab has the new 40 yd time');

  console.log('== Reopening, clearing and keeping force plate tests apart');
  await st(id => openSessionLogger(getRec('workouts', id)), A.wid); await p.waitForTimeout(400);
  assert((await p.inputValue('.log-item[data-block="w2"] [data-sp][data-k="sprint40yd"][data-i="1"]')) === '5.11' && (await p.inputValue('.log-item[data-block="w1"] [data-tm][data-i="1"]')) === '2.30', 'reopening shows what was saved');
  for (const [k, i] of [['sprint10yd', 0], ['sprint20yd', 0], ['sprint40yd', 0], ['sprint10yd', 1], ['sprint40yd', 1]]) await p.fill(`.log-item[data-block="w2"] [data-sp][data-k="${k}"][data-i="${i}"]`, '');
  await submit(); await p.waitForTimeout(400);
  assert(!(await st(id => !!getRec('tests', `${id}~sp~w2`), A.wid)), 'clearing the test removes its result from testing');
  const both = await st(() => {
    const a = S.athletes[S.athletes.length - 1], w = upsert('workouts', { athleteId: a.id, date: today(), title: 'Mixed', items: [{ id: 'm1', exerciseId: 'fpt-cmj', sets: '3', reps: '', intensity: 'bw' }, { id: 'm2', exerciseId: 'spt-10yd', sets: '3', reps: '', intensity: 'bw' }] });
    const fps = { fp: { m1: { trials: { cmj: [40, 41, 42] }, one: {}, sides: {}, bad: {} } }, bm: 70 }, sps = { sp: { m2: { trials: { sprint10yd: [1.71, 1.69] }, bad: {} } } };
    fpSave(w, fps); spSave(w, sps); fpSave(w, fps);   // saving force plate tests again must not remove the sprint result
    return S.tests.filter(t => t.workoutId === w.id).map(t => t.id.split('~').slice(1).join('~')).sort().join();
  });
  assert(both === 'fp,sp~m2', `force plate and sprint results of one session are kept side by side (${both})`);

  console.log('== The exercise form and safe loading');
  await p.goto(BASE + '#/library'); await p.waitForTimeout(300);
  await st(id => A.editExercise({ dataset: { id } }), A.acc); await p.waitForTimeout(300);
  assert((await p.$eval(`${top} >> select[name=timed]`, s => s.selectedOptions[0].textContent)).includes('Automatic (times)'), 'each exercise says how it is logged, and can be changed');
  await p.selectOption(`${top} >> select[name=timed]`, 'no'); await submit(); await p.waitForTimeout(300);
  assert(await st(id => getExercise(id).timed === false && !timedEx(getExercise(id)), A.acc), 'switched to sets & reps, it logs load × reps again');
  const clean = await st(() => cleanRecord('workouts', { id: 'wx', athleteId: 'a', date: today(), items: [], createdAt: 1, updatedAt: 1, log: { r1: [{ time: 2.5, reps: '<img src=x onerror=alert(1)>', vels: '0.8, 0.7<script>' }, 'junk'] } }).log.r1);
  assert(clean.length === 1 && clean[0].time === 2.5 && clean[0].reps === null && clean[0].vels === '0.8, 0.7', 'session log rows load with numbers only (anything else in a backup or sync file is dropped)');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
