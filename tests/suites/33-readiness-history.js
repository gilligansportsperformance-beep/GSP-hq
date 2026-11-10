// Performance HQ end-to-end tests — v1.28: readiness checks go into the athlete's test history. Each check is
// saved as a test result (the mean of its trials), so it reaches Testing, results history, PRs (with a toast),
// the leaderboard and the athletic profile. Checks saved before v1.28 are copied at start-up.
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const near = (a, b, t = 1e-6) => a != null && Math.abs(a - b) <= t;
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
  const toasts = () => st(() => document.querySelector('.toast-host')?.innerText || '');
  await p.goto(BASE); await p.waitForSelector('.modal'); await submit(); await p.waitForTimeout(400);
  await st(() => addStarterLibrary());

  const A = await st(() => {
    const d = n => addDays(today(), -n);
    const a = upsert('athletes', { firstName: 'Rae', lastName: 'Cole', sex: 'F', dob: addDays(today(), -Math.round(16.4 * 365.25)), archived: false });
    [[30, 30], [20, 31], [10, 32]].forEach(([n, v]) => upsert('tests', { athleteId: a.id, date: d(n), sides: {}, m: { cmj: v } }));
    // a check saved by an older version: only in S.readiness
    const old = upsert('readiness', { athleteId: a.id, date: d(3), mode: 'cmj', isoType: null, trials: { cmj: [31.5, 32.5, 32.0] }, m: { cmj: 32.0 }, workoutId: null });
    return { aid: a.id, old: old.id };
  });
  await st(() => flush());

  console.log('== Checks saved before this version are copied into the history');
  assert(!(await st(id => !!getRec('tests', id + '~rd'), A.old)), 'before: the old check is only a readiness record');
  await p.reload(); await p.waitForTimeout(900);
  const bf = await st(id => { const t = getRec('tests', id + '~rd'); return t && { m: t.m, tr: t.trials, rid: t.readinessId, notes: t.notes, src: testSource(t) }; }, A.old);
  assert(bf && near(bf.m.cmj, 32.0) && bf.tr.cmj.length === 3 && bf.rid === A.old && bf.notes === 'Readiness check' && bf.src === 'Readiness check', 'after start-up it is a test result too: the mean of its trials, labelled “Readiness check”');
  const hist = await st(id => readyHistory(id, 'cmj', null, today()).map(x => `${x.src}:${fmtNum(x.vals.cmj, 1)}`), A.aid);
  assert(hist.join() === 'test:30.0,test:31.0,test:32.0,check:32.0', `the readiness baseline counts the check once, not its copy (${hist.join(', ')})`);
  const again = await st(() => readyTestsSync());
  assert(again === 0, 'starting again changes nothing (no re-uploads between devices)');

  console.log('== A new check goes into the history, and a PR shows');
  await p.goto(BASE + `#/athlete/${A.aid}/overview`); await p.waitForTimeout(400);
  await p.click('#view [data-act=readyCheck] >> nth=0'); await p.waitForTimeout(300);
  assert((await p.innerText(top)).includes('saved to their test history'), 'the check says it is saved to the test history');
  for (const [i, v] of [[0, 33.0], [1, 34.0], [2, 33.5]]) await p.fill(`${top} >> [data-rt=cmj][data-ri="${i}"]`, String(v / 2.54));
  await p.waitForTimeout(100);
  await submit(); await p.waitForTimeout(500);
  const tt = await toasts();
  assert(tt.includes('saved to Rae’s test history') && /New PR for Rae in the readiness check: CMJ height 13\.2 in \(was 12\.6 in\)/.test(tt), `a PR toast: average 33.5 cm (13.2 in) beats the 12.6 in best (${tt.replace(/\s+/g, ' ').slice(0, 160)})`);
  const nw = await st(aid => { const r = readyToday(aid), t = r && getRec('tests', r.id + '~rd'); return { rid: r?.id, m: t?.m, n: t?.trials?.cmj?.length, date: t?.date }; }, A.aid);
  assert(near(nw.m.cmj, 33.5, 1e-3) && nw.n === 3 && nw.date === await st(() => today()), 'saved as a test today with all three trials');

  console.log('== It shows wherever results do');
  const pr = (await p.innerText('#view')).replace(/\s+/g, ' ');
  assert(/Personal records/i.test(pr) && /CMJ height 13\.2 in/.test(pr), 'the Personal records card has the new best');
  await p.goto(BASE + `#/athlete/${A.aid}/testing`); await p.waitForTimeout(400);
  const card = (await p.innerText('.metric-card:has(.mc-name:text-is("CMJ height"))')).replace(/\s+/g, ' ');
  assert(card.includes('13.2') && card.includes('Best') && card.includes('5 tests'), `Testing: CMJ height 13.2 in, best, 5 results (3 tests + 2 checks): ${card.slice(0, 120)}`);
  await p.goto(BASE + `#/metric/${A.aid}/cmj`); await p.waitForTimeout(400);
  assert((await p.innerText('#view')).includes('Readiness check'), 'the results history names the source: “Readiness check”');
  assert(await st(aid => lbEntries('cmj').some(e => e.aid === aid && Math.abs(e.v - 33.5) < 1e-3), A.aid), 'the leaderboard counts it');
  await p.goto(BASE + `#/athlete/${A.aid}/overview`); await p.waitForTimeout(400);
  assert(/CMJ height [^·]+ · HS standard 13\.2 in/.test((await p.innerText('.qd-panel[data-q=power]')).replace(/\s+/g, ' ')), 'the athletic profile uses it');
  assert(await fits(), 'the Overview fits the iPhone screen');

  console.log('== Editing or clearing the check keeps its copy in step');
  const ed = await st(aid => {
    const st0 = readyStateFor(aid, today()); st0.trials = { cmj: [34.0, 35.0] };
    saveReady(st0);
    const t = getRec('tests', st0.id + '~rd');
    const v = t.m.cmj, n = t.trials.cmj.length;
    st0.trials = {}; saveReady(st0);
    return { v, n, gone: !getRec('tests', st0.id + '~rd') && !getRec('readiness', st0.id) };
  }, A.aid);
  assert(near(ed.v, 34.5) && ed.n === 2 && ed.gone, 'an edited check updates its result (34.5 cm from two trials); an emptied check removes both');

  console.log('== The coach stays in charge of the history');
  const kept = await st(id => {
    upsert('tests', { ...getRec('tests', id + '~rd'), bodyMassKg: 60, notes: 'Readiness check, felt great' });   // edited in Testing
    const r = getRec('readiness', id); readyTestSave(r);
    const t = getRec('tests', id + '~rd');
    return { bm: t.bodyMassKg, notes: t.notes, cmj: t.m.cmj };
  }, A.old);
  assert(kept.bm === 60 && kept.notes === 'Readiness check, felt great' && near(kept.cmj, 32.0), 'what the coach added to the result (body mass, notes) survives re-saving the check');
  await st(async id => { removeRec('tests', id + '~rd'); await flush(); }, A.old);
  await p.reload(); await p.waitForTimeout(900);
  assert(!(await st(id => !!getRec('tests', id + '~rd'), A.old)) && await st(id => !!getRec('readiness', id), A.old), 'a result deleted in Testing stays deleted (the check itself is kept for the fatigue meter)');
  const iso = await st(aid => {
    const r = upsert('readiness', { athleteId: aid, date: addDays(today(), -2), mode: 'iso', isoType: 'ISQ', trials: { imtpPF: [2500, 2600] }, m: { imtpPF: 2550 }, workoutId: null });
    const t = readyTestSave(r).test;
    return { iso: t.isoType, v: t.m.imtpPF, key: metricKeyFor('imtpPF', { iso: t.isoType }) };
  }, A.aid);
  assert(iso.iso === 'ISQ' && iso.v === 2550 && iso.key === 'ISQ:imtpPF', 'an isometric squat check is saved as an isometric squat (its own series, not an IMTP)');
  const other = await st(aid => {
    const t = S.tests.find(x => x.athleteId === aid && x.readinessId && x.isoType === 'ISQ');
    const tgt = impTarget(aid, t.date, 'OVR Force', 'ISQ');
    return { imp: tgt.rec?.id === t.id, grid: pgRowFrom(t, ['imtpPF']) };
  }, A.aid);
  assert(!other.imp && other.grid.ro && other.grid.note === 'From a readiness check', 'imports and the Past results table never write into a readiness result');

  console.log('== The session log’s readiness check counts too');
  const wid = await st(aid => upsert('workouts', { athleteId: aid, date: today(), title: 'Lower', items: [{ id: 'i1', exerciseId: S.exercises.find(e => e.name === 'Back Squat').id, sets: '3', reps: '5', intensity: 'load', load: 80 }], completed: false }).id, A.aid);
  await st(id => openSessionLogger(getRec('workouts', id)), wid); await p.waitForTimeout(500);
  for (const [i, v] of [[0, 36.0], [1, 36.5], [2, 37.0]]) await p.fill(`${top} >> [data-rt=cmj][data-ri="${i}"]`, String(v / 2.54));
  await p.waitForTimeout(100);
  await submit(); await p.waitForTimeout(600);
  const t2 = await toasts();
  assert(/New PR for Rae: .*CMJ height 14\.4 in/.test(t2.replace(/\s+/g, ' ')), 'saving the session shows the readiness PR with the session’s PRs');
  const lg = await st(aid => { const r = readyToday(aid); const t = getRec('tests', r.id + '~rd'); return { w: r.workoutId, tw: t.workoutId || null, src: testSource(t) }; }, A.aid);
  assert(lg.w === wid && lg.tw === null && lg.src === 'Readiness check', 'the check keeps its session link; its result is a readiness result, not a session-logged test');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
