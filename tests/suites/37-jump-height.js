// Performance HQ end-to-end tests — v1.32: the countermovement jump logs a jump height for each set (inches, cm in
// metric) instead of a load. Its prescription is sets × reps with no load; the library can set any exercise to
// Jump height, or the CMJ back to sets & reps.
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
  await st(() => addStarterLibrary());
  const A = await st(() => {
    const T = today(), ex = n => S.exercises.find(e => e.name === n).id;
    const kai = upsert('athletes', { firstName: 'Kai', lastName: 'Jump', sex: 'M', dob: '2009-01-01', archived: false }).id;
    const wcmj = upsert('exercises', { name: 'Weighted CMJ', category: 'Plyometric & jumps', equipment: 'Dumbbells', cues: '', videoUrl: '', vbt: false, mvt: null, notes: '' }).id;
    // a CMJ programmed with a load and logged before v1.32 (heights in cm, and an old load)
    const old = upsert('workouts', { athleteId: kai, date: addDays(T, -4), title: 'Power', completed: true, items: [{ id: 'c0', exerciseId: ex('Countermovement Jump'), sets: '2', reps: '3-5', intensity: 'load', load: 20 }], log: { c0: [{ load: 20, reps: 5, ht: 48.26 }, { load: 20, reps: 5, ht: 49.53 }] } });
    const w = upsert('workouts', { athleteId: kai, date: T, title: 'Power', completed: false, items: [
      { id: 'c1', exerciseId: ex('Countermovement Jump'), sets: '3', reps: '3', intensity: 'load', load: 20, rir: 2 },
      { id: 's1', exerciseId: ex('Back Squat'), sets: '2', reps: '5', intensity: 'load', load: 100 }] });
    return { kai, w: w.id, old: old.id, cmj: ex('Countermovement Jump'), box: ex('Box Jump'), wcmj, fpcmj: (S.exercises.find(e => e.fpTest === 'cmj') || {}).id };
  });

  console.log('== Which exercises log a jump height');
  const kinds = await st(A => ({ cmj: heightEx(getExercise(A.cmj)), w: heightEx(getExercise(A.wcmj)), fp: heightEx(getExercise(A.fpcmj)), box: heightEx(getExercise(A.box)), alias: ['CMJ', 'Counter Movement Jump', 'Single-Leg Countermovement Jumps', 'CMJs (hands on hips)', 'Trap Bar CMJ', 'Squat Jump'].map(n => heightEx({ name: n, category: 'Plyometric & jumps' })).join() }), A);
  assert(kinds.cmj && !kinds.w && !kinds.fp && !kinds.box, 'the countermovement jump logs a height; a weighted CMJ, the force plate CMJ Test and box jumps do not');
  assert(kinds.alias === 'true,true,true,true,false,false', `names: CMJ, Counter Movement Jump, single-leg and plural forms count; a trap bar CMJ and a squat jump do not (${kinds.alias})`);
  await p.goto(BASE + '#/library'); await p.waitForTimeout(400);
  assert((await p.innerText(`[data-act=editExercise][data-id="${A.cmj}"]`)).includes('Jump height'), 'the library marks it “Jump height”');
  await p.click(`[data-act=editExercise][data-id="${A.cmj}"]`); await p.waitForTimeout(300);
  const opts = await st(() => [...document.querySelector('[name=timed]').options].map(o => (o.selected ? '*' : '') + o.textContent).join(' | '));
  assert(opts.startsWith('*Automatic (jump height)') && opts.includes('Jump height (in per set)'), `“Log in sessions as” reads Automatic (jump height), with Jump height as a choice (${opts})`);
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(200);

  console.log('== The program: sets × reps, no load');
  await p.goto(BASE + `#/athlete/${A.kai}/program`); await p.waitForTimeout(500);
  const card = (await p.innerText('.wo-items')).replace(/\s+/g, ' ');
  assert(/Countermovement Jump 3 × 3 Back Squat/.test(card) && !/Countermovement Jump 3 × 3 ·/.test(card) && card.includes('220.5 lb'), `a CMJ saved with a load shows no load or RIR (the squat keeps its load): ${card.slice(0, 90)}`);
  await p.click('[data-act=editWorkout]'); await p.waitForTimeout(400);
  const ed = await st(() => { const r = document.querySelector('.item-editor'); return { t: r.innerText.replace(/\s+/g, ' '), iv: !!r.querySelector('[data-k=intensity]'), load: !!r.querySelector('[data-k=load]') }; });
  assert(!ed.iv && !ed.load && ed.t.includes('Jump height: logged in inches for each set, no load'), 'the builder row has sets × reps and no intensity or load');
  await submit(); await p.waitForTimeout(500);
  const re = await st(id => getRec('workouts', id).items.map(i => `${i.intensity}:${i.load}:${i.rir}`).join(), A.w);
  assert(re === 'bw:null:null,load:100:null', `saving clears the old load and RIR from the CMJ only (${re})`);
  await p.click('[data-act=newWorkout] >> nth=0'); await p.waitForTimeout(400);
  await p.click(`${top} >> [data-add-item]`); await p.waitForSelector('[data-xp-q]');
  await p.fill('[data-xp-q]', 'Countermovement'); await p.click(`.xp-row[data-xp-id="${A.cmj}"] >> visible=true`); await p.click('[data-xp-add]'); await p.waitForTimeout(400);
  const add = await st(A => { const r = document.querySelector('.modal-wrap:last-child .item-editor'); return { t: r.innerText.replace(/\s+/g, ' '), sets: r.querySelector('[data-k=sets]').value, reps: r.querySelector('[data-k=reps]').value, ddp: !!r.querySelector('.ddp-note, [data-it=ddpUndo]'), plan: ddpPlan(A.kai, A.cmj, addDays(today(), 1), null) }; }, A);
  assert(add.sets === '3' && add.reps === '3' && add.t.includes('Prefilled from') && !add.t.includes('lb'), `a new CMJ takes the latest sets × reps and no load (${add.sets} × ${add.reps})`);
  assert(!add.ddp && add.plan === null, 'no double progression for a jump, even from a 3–5 rep range logged at the top');
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(250);
  if (await p.locator('.modal-wrap').count()) { await p.keyboard.press('Escape'); await p.waitForTimeout(250); }

  console.log('== The session log: a height column instead of load');
  await st(id => openSessionLogger(getRec('workouts', id)), A.w); await p.waitForTimeout(500);
  const blk = await st(() => { const b = document.querySelector('.log-item.ht-block'); return { cols: b.querySelector('.log-cols').innerText.replace(/\s+/g, ' ').toLowerCase(), load: b.querySelectorAll('[data-k=load]').length, ht: b.querySelectorAll('[data-k=ht]').length, head: b.querySelector('.log-head').innerText.replace(/\s+/g, ' '), squat: document.querySelectorAll('.log-item:not(.ht-block) [data-k=load]').length }; });
  assert(blk.cols.includes('height in') && !blk.cols.includes('lb') && blk.load === 0 && blk.ht === 3 && blk.squat === 2, `three sets with a height box and no load box (the squat keeps its load): ${blk.cols}`);
  assert(blk.head.includes('Prescribed 3 × 3') && blk.head.includes('Last time') && blk.head.includes('19, 19.5 in (best 19.5)'), `last time’s heights in inches (${blk.head})`);
  await p.fill('.ht-block .log-row >> nth=0 >> [data-k=ht]', '19.5');
  await p.fill('.ht-block .log-row >> nth=1 >> [data-k=ht]', '20');
  await p.waitForTimeout(150);
  const sum = await p.innerText('[data-ht-sum]');
  assert(sum.includes('Best 20 in') && sum.includes('avg 19.8 in') && sum.includes('▲ 0.5 in vs last time’s best'), `the best, the average and the change from last time (${sum})`);
  await p.fill('.ht-block .log-row >> nth=2 >> [data-k=ht]', '75'); await p.waitForTimeout(100);
  assert(await p.locator('.ht-block .log-row >> nth=2 >> [data-k=ht].bad').count() === 1, 'a height over 60 in turns red');
  await submit(); await p.waitForTimeout(300);
  assert((await p.innerText(`${top} >> .form-error`)).includes('check set 3’s jump height. Enter inches'), 'and Save asks for inches');
  await p.fill('.ht-block .log-row >> nth=2 >> [data-k=ht]', '19'); await p.waitForTimeout(100);
  assert((await p.innerText('[data-log-top] .log-prog')).includes('3 of 5 sets done') && await p.locator('.ht-block.is-done').count() === 1, 'a typed height ticks its set: the CMJ is complete in the progress bar');
  assert(await fits(), 'the log fits the iPhone');
  await p.screenshot({ path: SP + '/v132-log-iphone.png' });
  await submit(); await p.waitForTimeout(700);
  const saved = await st(id => getRec('workouts', id).log, A.w);
  const c1 = (saved.c1 || []).map(r => `${r.ht != null ? (r.ht / 2.54).toFixed(1) : '-'}x${r.reps}:${r.load}`).join();
  assert(c1 === '19.5x3:null,20.0x3:null,19.0x3:null' && saved.c1.every(r => !('vels' in r && r.vels)) && Math.abs(saved.c1[0].ht - 49.53) < 0.01, `heights saved in cm with no load (${c1})`);
  assert((saved.s1 || []).length === 2 && !(await st(() => document.querySelector('.toast-host')?.innerText || '')).includes('left out'), 'nothing ticked with ✓: every filled set is saved, as before (the squat’s 2 sets)');
  assert(await st(id => S.vbt.filter(l => l.workoutId === id).length, A.w) === 0, 'no VBT or load records come from a jump');
  await st(id => openSessionLogger(getRec('workouts', id)), A.w); await p.waitForTimeout(500);
  const back = await st(() => [...document.querySelectorAll('.ht-block .log-row')].map(r => `${r.querySelector('[data-k=ht]').value}${r.classList.contains('done') ? '✓' : ''}`).join());
  assert(back === '19.5✓,20✓,19✓', `reopening shows the heights, ticked (${back})`);
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(250);

  console.log('== Where the heights show');
  await p.goto(BASE + `#/athlete/${A.kai}`); await p.goto(BASE + `#/athlete/${A.kai}/program`); await p.waitForTimeout(500);
  const log1 = (await p.innerText('.wo-items')).replace(/\s+/g, ' ');
  assert(log1.includes('Logged: 19.5 in × 3, 20 in × 3, 19 in × 3 · best 20 in'), 'the Program tab: “Logged: 19.5 in × 3, 20 in × 3, 19 in × 3 · best 20 in”');
  await st(A => { const ev = upsert('events', { type: 'session', group: true, title: 'Jumps', date: today(), start: '23:00', duration: 45, athleteIds: [A.kai], status: 'scheduled' }); const w = getRec('workouts', A.w); upsert('workouts', { ...w, eventId: ev.id }); }, A);
  await p.goto(BASE + '#/floor'); await p.waitForTimeout(500);
  const floor = await st(id => { const c = document.querySelector(`[data-fa="${id}"]`); const li = [...c.querySelectorAll('.fa-list li')].find(x => x.innerText.includes('Countermovement')); return { t: li.innerText.replace(/\s+/g, ' '), done: li.classList.contains('done') }; }, A.kai);
  assert(floor.done && /Countermovement Jump\s*3 × 3$/.test(floor.t.trim()), `the Gym Floor card: “3 × 3”, no load, ✓ once logged (${floor.t})`);

  console.log('== Metric, and the library choice');
  await st(() => { S.settings.units = 'metric'; persist(); });
  await st(id => openSessionLogger(getRec('workouts', id)), A.w); await p.waitForTimeout(500);
  const m1 = await st(() => ({ cols: document.querySelector('.ht-block .log-cols').innerText.toLowerCase(), v: document.querySelector('.ht-block [data-k=ht]').value }));
  assert(m1.cols.includes('height cm') && m1.v === '49.5', `metric: centimetres (${m1.v} cm)`);
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(250);
  await st(() => { S.settings.units = 'imperial'; persist(); });
  await p.goto(BASE + '#/library'); await p.waitForTimeout(300);
  await p.click(`[data-act=editExercise][data-id="${A.box}"]`); await p.waitForTimeout(300);
  await p.selectOption('[name=timed]', 'ht'); await submit(); await p.waitForTimeout(300);
  await p.click(`[data-act=editExercise][data-id="${A.cmj}"]`); await p.waitForTimeout(300);
  await p.selectOption('[name=timed]', 'no'); await submit(); await p.waitForTimeout(300);
  const lib = await st(A => ({ box: heightEx(getExercise(A.box)), cmj: heightEx(getExercise(A.cmj)), boxT: timedEx(getExercise(A.box)) }), A);
  assert(lib.box && !lib.boxT && !lib.cmj, 'the library can set box jumps to Jump height, and the CMJ back to sets & reps');
  await st(A => openSessionLogger({ athleteId: A.kai, date: today(), title: 'Test', items: [{ id: 'b1', exerciseId: A.box, sets: '2', reps: '3', intensity: 'bw' }, { id: 'c2', exerciseId: A.cmj, sets: '1', reps: '3', intensity: 'bw' }], completed: false, _new: true }), A);
  await p.waitForTimeout(400);
  const sw = await st(() => [...document.querySelectorAll('#logItems .log-item')].map(b => (b.classList.contains('ht-block') ? 'height' : b.querySelector('[data-k=load]') ? 'load' : '?')).join());
  assert(sw === 'height,load', `the log follows the library (${sw})`);
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(200);

  console.log('== Stored data is checked');
  const clean = await st(() => { const r = cleanRecord('workouts', { id: 'w_x', athleteId: 'a1', date: '2026-01-01', items: [{ id: 'i1', exerciseId: 'e1' }], log: { i1: [{ ht: 50, reps: 3 }, { ht: 'x' }, { ht: -4 }, { ht: Infinity }] } }); const e = cleanRecord('exercises', { id: 'e_x', name: 'X', jumpHt: 'yes' }); return { hs: r.log.i1.map(x => x.ht ?? '-').join(), j: e.jumpHt }; });
  assert(clean.hs === '50,-,-,-' && clean.j === null, `only real heights are kept, and the library flag is true/false (${clean.hs})`);

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
