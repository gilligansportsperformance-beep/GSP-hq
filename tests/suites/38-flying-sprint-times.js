// Performance HQ end-to-end tests — v1.33: a flying sprint the coach adds (e.g. "5yd build + 10yd fly") logs a time in
// seconds per rep whatever its category, with the speed over the fly; anything filed under Sprint testing is timed;
// chest flies keep load × reps. The library's Flying 10 yd Test (5 yd build) still saves its best to testing.
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
  await p.goto(BASE); await p.waitForSelector('.modal'); await submit(); await p.waitForTimeout(400);
  const n0 = await st(() => { addStarterLibrary(); return S.exercises.filter(e => timedEx(e)).length; });

  console.log('== Which exercises log a time');
  const kinds = await st(() => [
    ['5yd build + 10yd fly', 'Sprint testing'], ['5 yd build + 10 yd fly', 'Other'], ['5 Yard Build 10 Yard Fly', 'Conditioning'], ['Flying 10 yd (5 yd build)', 'Plyometric & jumps'], ['10m fly', 'Other'], ['Laser 40', 'Sprint testing'],
    ['Dumbbell Fly', 'Upper push'], ['Reverse Fly', 'Upper pull'], ['Cable Fly 30°', 'Upper push'], ['A-Skip', 'Sprint testing'], ['Bike Sprints', 'Conditioning'],
  ].map(([name, category]) => (timedEx({ name, category }) ? 'T' : '-')).join(''));
  assert(kinds === 'TTTTTT-----', `a flying sprint with a build-up or distance in any category, and anything under Sprint testing, logs times; chest flies, skips and bike sprints don’t (${kinds})`);
  assert(n0 === 23, `the starter library is unchanged (${n0} timed exercises)`);
  const dist = await st(() => ['5yd build + 10yd fly', '5 Yard Build 10 Yard Fly', 'Flying 10 yd (5 yd build)', '10m fly'].map(name => spDistance({ sets: '3', reps: '1' }, { name })?.label).join());
  assert(dist === '10 yd,10 yd,10 yd,10 m', `the timed distance is the fly, not the build-up (${dist})`);

  const A = await st(() => {
    const kai = upsert('athletes', { firstName: 'Kai', lastName: 'Fly', sex: 'M', dob: '2009-01-01', archived: false }).id;
    const fly = upsert('exercises', { name: '5yd build + 10yd fly', category: 'Sprint testing', equipment: 'Timing gates', cues: '', videoUrl: '', vbt: false, mvt: null, notes: '' }).id;
    const df = upsert('exercises', { name: 'Dumbbell Fly', category: 'Upper push', equipment: 'Dumbbells', cues: '', videoUrl: '', vbt: false, mvt: null, notes: '' }).id;
    upsert('workouts', { athleteId: kai, date: addDays(today(), -5), title: 'Speed', completed: true, items: [{ id: 'f0', exerciseId: fly, sets: '3', reps: '1', intensity: 'bw' }], log: { f0: [{ time: 1.14 }, { time: 1.12 }] } });
    return { kai, fly, df };
  });

  console.log('== The library and the builder');
  await p.goto(BASE + '#/library'); await p.waitForTimeout(400);
  assert((await p.innerText(`[data-act=editExercise][data-id="${A.fly}"]`)).includes('Timed'), 'the library marks it “Timed”');
  await p.click(`[data-act=editExercise][data-id="${A.fly}"]`); await p.waitForTimeout(300);
  assert((await st(() => document.querySelector('[name=timed]').selectedOptions[0].textContent)) === 'Automatic (times)', '“Log in sessions as” reads Automatic (times)');
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(200);
  await p.goto(BASE + `#/athlete/${A.kai}/program`); await p.waitForTimeout(400);
  await p.click('[data-act=newWorkout] >> nth=0'); await p.waitForTimeout(400);
  for (const id of [A.fly, A.df]) {
    await p.click(`${top} >> [data-add-item]`); await p.waitForSelector('[data-xp-q]');
    await p.fill('[data-xp-q]', id === A.fly ? '10yd fly' : 'Dumbbell Fly'); await p.click(`.xp-row[data-xp-id="${id}"] >> visible=true`); await p.click('[data-xp-add]'); await p.waitForTimeout(350);
  }
  const rows = await st(() => [...document.querySelectorAll('.modal-wrap:last-child .item-editor')].map(r => ({ t: r.innerText.replace(/\s+/g, ' '), iv: r.querySelector('[data-k=intensity]')?.value })));
  assert(rows[0].t.includes('Logged as a time per rep in the session log.') && !rows[0].t.includes('put the distance') && rows[0].iv === 'bw', 'the fly row is logged as a time per rep, with no load, and needs no distance in the reps');
  assert(!rows[1].t.includes('time per rep'), 'the dumbbell fly row is a normal lift');
  await submit(); await p.waitForTimeout(500);
  const wid = await st(aid => S.workouts.find(w => w.athleteId === aid && w.date === today()).id, A.kai);

  console.log('== The session log: seconds per rep');
  await st(id => openSessionLogger(getRec('workouts', id)), wid); await p.waitForTimeout(500);
  const blk = await st(() => { const b = document.querySelector('.log-item.tm-block'); return { cells: b.querySelectorAll('[data-tm]').length, ph: b.querySelector('[data-tm]').placeholder, load: b.querySelectorAll('[data-k=load]').length, head: b.querySelector('.log-head').innerText.replace(/\s+/g, ' '), lift: document.querySelectorAll('.log-item:not(.tm-block) [data-k=load]').length }; });
  assert(blk.cells === 3 && blk.ph === 's' && blk.load === 0 && blk.lift === 3, `three reps to time in seconds and no lb box (the dumbbell fly keeps its load): ${blk.cells} cells`);
  assert(blk.head.includes('Timed') && blk.head.includes('Last time') && blk.head.includes('1.14, 1.12 s (best 1.12)'), `last time’s times (${blk.head})`);
  await p.fill('.tm-block [data-tm][data-i="0"]', '1.12'); await p.fill('.tm-block [data-tm][data-i="1"]', '1.08'); await p.fill('.tm-block [data-tm][data-i="2"]', '1.15'); await p.waitForTimeout(150);
  const sum = (await p.innerText('.tm-block [data-tm-sum]')).replace(/\s+/g, ' ');
  assert(sum.includes('Best 1.08 s') && sum.includes('10 yd at 8.5 m/s (18.9 mph)') && sum.includes('▼ 0.04 s'), `the best, the speed over the 10 yd fly and the change from last time (${sum})`);
  await p.screenshot({ path: SP + '/v133-fly-log-iphone.png' });
  assert((await st(() => document.documentElement.scrollWidth)) <= 391, 'the log fits the iPhone');
  await submit(); await p.waitForTimeout(700);
  const saved = await st(id => { const w = getRec('workouts', id); return w.log[w.items[0].id].map(r => r.time).join(); }, wid);
  assert(saved === '1.12,1.08,1.15', `saved as seconds (${saved})`);
  await p.goto(BASE + `#/athlete/${A.kai}`); await p.goto(BASE + `#/athlete/${A.kai}/program`); await p.waitForTimeout(500);
  assert((await p.innerText('.wo-items')).includes('Logged: 1.12, 1.08, 1.15 s (best 1.08)'), 'the Program tab shows the times');

  console.log('== The library’s sprint test still saves to testing');
  const t = await st(aid => {
    const w = upsert('workouts', { athleteId: aid, date: today(), title: 'Test day', items: [{ id: 's1', exerciseId: 'spt-fly10yd', sets: '2', reps: '1', intensity: 'bw' }] });
    openSessionLogger(w); return w.id;
  }, A.kai);
  await p.waitForTimeout(500);
  const inputs = await st(() => document.querySelectorAll('[data-sp]').length);
  await p.fill('[data-sp] >> nth=0', '1.10'); await p.fill('[data-sp] >> nth=1', '1.06'); await p.waitForTimeout(100);
  await submit(); await p.waitForTimeout(700);
  const rec = await st(id => S.tests.find(x => x.workoutId === id)?.m?.fly10yd, t);
  assert(inputs === 2 && rec === 1.06, `Flying 10 yd Test (5 yd build): trials in seconds, the best saved to testing (${rec} s)`);

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
