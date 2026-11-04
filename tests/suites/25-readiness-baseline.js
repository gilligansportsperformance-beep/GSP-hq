// Performance HQ end-to-end tests — v1.20 readiness: the baseline counts results entered in Testing,
// evaluations and team tests; the check unlocks after 3 earlier results; every workout then starts with it
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const top = '.modal-wrap >> nth=-1';
  const submit = () => p.click(`${top} >> .modal-head button[type=submit]`);
  const close = () => p.click(`${top} >> .modal-head [data-close]`);
  const st = (fn, a) => p.evaluate(fn, a);
  await p.goto(BASE); await p.waitForSelector('.modal'); await submit(); await p.waitForTimeout(400);
  const A = await st(() => {
    const a = upsert('athletes', { firstName: 'Lee', lastName: 'Park', sex: 'M', dob: '2009-02-02', archived: false });
    upsert('tests', { athleteId: a.id, date: addDays(today(), -20), sides: {}, m: { cmj: 40, rsiMod: 0.40 } });          // typed in Testing
    const w = upsert('workouts', { athleteId: a.id, date: today(), title: 'Lower', items: [{ id: 'i1', exerciseId: S.exercises.find(e => e.name === 'Back Squat').id, sets: '3', reps: '5', intensity: 'load', load: 80 }], completed: false });
    return { aid: a.id, wid: w.id };
  });

  console.log('== Locked until 3 earlier results');
  await p.goto(BASE + `#/athlete/${A.aid}/overview`); await p.waitForTimeout(300);
  let ov = await p.innerText('#view');
  assert(ov.includes('Readiness') && ov.includes('1 of 3') && ov.includes('unlocks') && await p.locator('#view [data-act=readyCheck]').count() === 0, 'a CMJ typed in Testing counts: “1 of 3”, and the check is locked');
  await st(id => openSessionLogger(getRec('workouts', id)), A.wid); await p.waitForTimeout(400);
  assert(await p.locator('.modal .ready-sec').count() === 0 && (await p.innerText('.modal .ready-lock')).includes('1 of 3'), 'the session log says it unlocks at 3 (no check yet)');
  await close(); await p.waitForTimeout(150);
  assert(!(await st(id => workoutCard(getRec('workouts', id)), A.wid)).includes('Readiness check'), 'and the workout has no readiness check yet');

  console.log('== Results from anywhere build the baseline');
  await st(id => {
    upsert('tests', { athleteId: id, date: addDays(today(), -14), sides: {}, evaluation: true, trials: { cmj: [39, 40, 41] }, m: { cmj: 40 } });   // an evaluation
    upsert('tests', { athleteId: id, date: addDays(today(), -7), sides: {}, teamTestId: 'tt1', m: { cmj: 41, rsiMod: 0.42 } });                // a team test day
    upsert('tests', { athleteId: id, date: addDays(today(), -5), sides: {}, device: 'OVR Jump', m: { cmj: 50 } });                             // flight time: not comparable
    upsert('tests', { athleteId: id, date: addDays(today(), -4), sides: {}, isoType: 'ISQ', m: { imtpPF: 2600 } });                             // an isometric squat
  }, A.aid);
  const av = await st(id => { const v = readyAvail(id); return { ok: v.ok, n: v.n, opts: v.opts.map(o => `${o.mode}:${o.isoType || ''}:${o.n}`) }; }, A.aid);
  assert(av.ok && av.n === 3 && av.opts.join() === 'cmj::3', `3 force-plate CMJs (Testing, evaluation, team test) unlock it; OVR Jump and the isometric squat don’t count toward the CMJ (${av.opts.join(', ')})`);
  const hist = await st(id => readyHistory(id, 'cmj', null, today()).map(x => x.vals.cmj), A.aid);
  assert(hist.join() === '40,40,41', 'baseline points: one per day, OVR Jump heights left out');
  await p.goto(BASE + '#/athletes'); await p.waitForTimeout(150);
  await p.goto(BASE + `#/athlete/${A.aid}/overview`); await p.waitForTimeout(300);
  ov = await p.innerText('#view');
  assert(await p.locator('#view [data-act=readyCheck]').count() >= 1 && ov.includes('Unlocked: CMJ'), 'the Overview now offers the check');
  assert((await st(id => workoutCard(getRec('workouts', id)), A.wid)).includes('Readiness check'), 'every workout now starts with a readiness check');

  console.log('== In the session log, with instant feedback');
  await st(id => openSessionLogger(getRec('workouts', id)), A.wid); await p.waitForTimeout(400);
  assert(await p.locator('.modal details.ready-sec[open]').count() === 1 && (await p.getAttribute('.modal [data-rmode].on', 'data-rmode')) === 'cmj', 'the session log opens with the CMJ check first');
  await p.fill('.modal [data-rt=cmj][data-ri="0"]', String(35 / 2.54)); await p.waitForTimeout(80);
  let out = await p.innerText('.modal [data-ready-out]');
  assert(out.includes('Fatigued') && out.includes('(3 earlier results)'), `feedback after the first trial: “${out.split('\n')[0]}”`);
  await p.fill('.modal [data-rt=cmj][data-ri="1"]', String(40 / 2.54)); await p.fill('.modal [data-rt=cmj][data-ri="2"]', String(40.5 / 2.54)); await p.waitForTimeout(80);
  out = await p.innerText('.modal [data-ready-out]');
  const e = await st(id => readyEval({ id: 'x', athleteId: id, date: today(), mode: 'cmj', trials: { cmj: [35, 40, 40.5] } }), A.aid);
  assert(near(e.rows[0].base, 40.333, 0.01) && near(e.rows[0].pct, (38.5 - 40.3333) / 40.3333 * 100, 0.05) && e.rows[0].noise === 4 && e.status === 'low' && out.includes('Slightly down'), `same method as before: mean of the 3 trials (38.5 cm) vs the mean of the earlier results (40.3 cm) = −4.5%, past one 4% typical error → ${out.split('\n')[0]}`);
  const rsi = await st(id => readyEval({ id: 'x', athleteId: id, date: today(), mode: 'cmj', trials: { rsiMod: [0.3] } }).rows[0], A.aid);
  assert(rsi.n === 2 && rsi.status === 'base', 'mRSI from Testing counts too (2 earlier, so still building its own baseline)');
  await submit(); await p.waitForTimeout(400);
  const card = await st(id => workoutCard(getRec('workouts', id)), A.wid);
  assert(await st(id => S.readiness.filter(r => r.athleteId === id && r.date === today()).length === 1, A.aid) && card.includes('Readiness check') && card.includes('Slightly down'), 'saved with the session; the workout shows today’s result');

  console.log('== A readiness check wins over a test on the same day');
  await st(id => upsert('readiness', { athleteId: id, date: addDays(today(), -7), mode: 'cmj', trials: { cmj: [38] }, m: { cmj: 38 } }), A.aid);
  assert((await st(id => readyHistory(id, 'cmj', null, today()).map(x => `${x.src}:${x.vals.cmj}`), A.aid)).join() === 'test:40,test:40,check:38', 'one value per day; the check is used on a day that has both');

  console.log('== Gym Floor and group sessions');
  const other = await st(() => upsert('athletes', { firstName: 'New', lastName: 'Kid', sex: 'F', dob: '2010-01-01', archived: false }).id);
  await st(({ a, b }) => upsert('events', { type: 'session', group: true, date: today(), start: '23:30', duration: 60, athleteIds: [a, b], title: 'Late group', location: '', notes: '', status: 'scheduled' }), { a: A.aid, b: other });
  await p.goto(BASE + '#/floor'); await p.waitForTimeout(400);
  assert(await p.locator(`#view [data-act=readyCheck][data-a="${A.aid}"]`).count() >= 1 && await p.locator(`#view [data-act=readyCheck][data-a="${other}"]`).count() === 0, 'Gym Floor offers the check only to athletes who have unlocked it');
  const gid = await st(() => S.events.find(e => e.title === 'Late group').id);
  await p.goto(BASE + `#/groups/${gid}`); await p.waitForTimeout(400);
  assert((await p.innerText(`.gb-col[data-gb-aid="${A.aid}"]`)).includes('Readiness check') && !(await p.innerText(`.gb-col[data-gb-aid="${other}"]`)).includes('Readiness check'), 'group session columns show it for unlocked athletes');

  console.log('== Philosophy: dynamic double progression');
  await p.goto(BASE + '#/philosophy'); await p.waitForTimeout(300);
  assert((await p.innerText('#view')).includes('Dynamic double progression') && (await p.innerText('#view')).includes('Each set progresses on its own'), 'it is in the philosophy');
  const ph = await st(() => {
    // a coach who had already saved their own philosophy gets it added once
    S.settings.philosophy = { mission: 'M', principles: [{ title: 'Mine', text: 'x' }], process: '', standards: '' }; S.settings.philAdds = {};
    philosophyAdditions();
    const added = S.settings.philosophy.principles.map(x => x.title).join('|');
    S.settings.philosophy = { ...S.settings.philosophy, principles: S.settings.philosophy.principles.filter(x => x.title === 'Mine') };   // they delete it
    philosophyAdditions();
    return { added, after: S.settings.philosophy.principles.map(x => x.title).join('|'), shared: SHARED_SETTINGS.includes('philAdds') };
  });
  assert(ph.added === 'Mine|Dynamic double progression' && ph.after === 'Mine' && ph.shared, 'added once to a saved philosophy, after the coach’s own principles; never brought back once deleted');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
