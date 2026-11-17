// Performance HQ end-to-end tests — v1.31: the Gym Floor shows each athlete's program for today (✓ as exercises are
// logged), and the session log has a progress bar, one header row per exercise and a ✓ per set; once you tick sets,
// only ticked or changed sets are saved. Group-session programs are tagged on the athlete's Program tab.
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
    const mk = f => upsert('athletes', { firstName: f, lastName: 'Floor', sex: 'M', dob: '2009-01-01', archived: false }).id;
    const kai = mk('Kai'), leo = mk('Leo');
    const ev = upsert('events', { type: 'session', group: true, title: 'Lift group', date: T, start: '23:00', duration: 45, athleteIds: [kai, leo], status: 'scheduled' });
    const items = [
      { id: 'a1', exerciseId: ex('Back Squat'), sets: '3', reps: '5', intensity: 'load', load: 100 },
      { id: 'a2', exerciseId: ex('Romanian Deadlift'), sets: '2', reps: '8', intensity: 'load', load: 70 },
      { id: 'a3', exerciseId: ex('Box Jump'), sets: '3', reps: '3', intensity: 'bw' },
    ];
    const wk = upsert('workouts', { athleteId: kai, date: T, eventId: ev.id, title: 'Lift group', completed: false, items });
    const wl = upsert('workouts', { athleteId: leo, date: T, eventId: ev.id, title: 'Lift group', completed: false, items, log: { a1: [{ load: 100, reps: 5 }, { load: 100, reps: 5 }, { load: 100, reps: 5 }] } });
    return { kai, leo, ev: ev.id, wk: wk.id, wl: wl.id };
  });

  console.log('== Gym Floor: each athlete’s program for today');
  await p.goto(BASE + '#/floor'); await p.waitForTimeout(500);
  const kaiCard = (await p.innerText(`[data-fa="${A.kai}"]`)).replace(/\s+/g, ' ');
  assert(/Back Squat 3 × 5 @ 220\.5 lb/.test(kaiCard) && kaiCard.includes('Romanian Deadlift') && kaiCard.includes('Box Jump 3 × 3') && kaiCard.includes('3 exercises'), 'the card lists the program with sets × reps and load');
  const leo = await st(id => { const c = document.querySelector(`[data-fa="${id}"]`); return { t: c.innerText.replace(/\s+/g, ' '), done: c.querySelectorAll('.fa-list li.done').length, log: c.querySelector('.fa-log').innerText.trim() }; }, A.leo);
  assert(leo.t.includes('1 of 3 logged') && leo.done === 1 && leo.log === 'Open the log', 'a logged exercise gets a ✓ and the card says how far along it is');
  assert(await p.locator(`#ev-${A.ev} [data-act=floorAtt][data-a="${A.kai}"][data-v=present]`).count() === 1 && await p.locator(`[data-fa="${A.kai}"] [data-act=floorTest]`).count() === 1 && await p.locator(`[data-fa="${A.kai}"] [data-act=floorNote]`).count() === 1, 'attendance, Test and Note are on every card');
  await p.click(`#ev-${A.ev} [data-act=floorAtt][data-a="${A.kai}"][data-v=present]`); await p.waitForTimeout(250);
  assert(await p.locator(`[data-fa="${A.kai}"].present`).count() === 1 && (await p.innerText(`#ev-${A.ev} .fs-meta`)).includes('1 here'), 'Here marks the card and the session counts it');
  assert(await fits(), 'the floor fits the iPhone');
  await p.screenshot({ path: SP + '/v131-floor-iphone.png', fullPage: true });

  console.log('== The session log: progress, one header row, ✓ per set');
  await p.click(`[data-fa="${A.kai}"] .fa-log`); await p.waitForTimeout(600);
  const lg = await st(() => ({ prog: document.querySelector('[data-log-top] .log-prog').innerText.replace(/\s+/g, ' '), jumps: document.querySelectorAll('[data-log-jump]').length, cols: document.querySelector('.log-item .log-cols').innerText.replace(/\s+/g, ' ').toLowerCase(), labels: getComputedStyle(document.querySelector('.log-row .lf > span')).width }));
  assert(lg.prog.includes('0 of 8 sets done') && lg.prog.includes('0 of 3 exercises complete') && lg.jumps === 3, `a progress bar with the sets and a jump button per exercise (${lg.prog})`);
  assert(/set .*lb .*reps .*rpe .*done/.test(lg.cols) && lg.labels === '1px', 'one header row per exercise instead of labels on every set');
  await p.click('.log-item:first-child .log-row >> nth=0 >> [data-done]');
  await p.click('.log-item:first-child .log-row >> nth=1 >> [data-done]');
  await p.fill('.log-item:first-child .log-row >> nth=2 >> [data-k=reps]', '4'); await p.waitForTimeout(150);
  const after = await st(() => ({ prog: document.querySelector('[data-log-top] .log-prog').innerText.replace(/\s+/g, ' '), rows: [...document.querySelectorAll('.log-item:first-child .log-row')].map(r => r.classList.contains('done')), item: document.querySelector('.log-item:first-child').classList.contains('is-done'), jump: document.querySelector('[data-log-jump]').className }));
  assert(after.rows.join() === 'true,true,true' && after.item && after.prog.includes('3 of 8 sets done') && after.prog.includes('1 of 3 exercises complete') && after.jump.includes('done'), 'ticking two sets and changing the third completes the exercise (✓ on its number and jump button)');
  await p.click('.log-item:nth-child(2) [data-all-done]'); await p.waitForTimeout(150);
  assert((await p.innerText('[data-log-top] .log-prog')).includes('5 of 8 sets done') && (await p.innerText('.log-item:nth-child(2) [data-all-done]')).includes('All sets done'), '“All done as planned” ticks a whole exercise');
  await p.click('.log-item:first-child .log-row >> nth=1 >> [data-done]'); await p.waitForTimeout(100);
  assert((await p.innerText('[data-log-top] .log-prog')).includes('4 of 8 sets done') && !(await st(() => document.querySelector('.log-item:first-child').classList.contains('is-done'))), 'tapping ✓ again un-ticks a set');
  await p.click('[data-log-jump] >> nth=2'); await p.waitForTimeout(500);
  const jumped = await st(() => { const b = [...document.querySelectorAll('.modal-wrap')].pop().querySelector('.modal-body'), r = document.querySelector('.log-item:nth-child(3)').getBoundingClientRect(), br = b.getBoundingClientRect(); return r.top >= br.top - 2 && r.top < br.top + br.height / 2; });
  assert(jumped, 'a jump button scrolls to its exercise');
  assert(await fits(), 'the log fits the iPhone');
  await p.screenshot({ path: SP + '/v131-log-iphone.png' });

  console.log('== Only ticked or changed sets are saved once you tick');
  await submit(); await p.waitForTimeout(700);
  const saved = await st(id => { const w = getRec('workouts', id); return { a1: (w.log.a1 || []).map(r => `${r.load}x${r.reps}`).join(), a2: (w.log.a2 || []).length, a3: (w.log.a3 || []).length }; }, A.wk);
  const toast1 = await st(() => document.querySelector('.toast-host')?.innerText || '');
  assert(saved.a1 === '100x5,100x4' && saved.a2 === 2 && saved.a3 === 0, `squat: the ticked set and the changed one; RDL: both (all done); box jumps (not ticked) left out (${JSON.stringify(saved)})`);
  assert(toast1.includes('4 sets not ticked left out'), 'the toast says what was left out');
  await st(id => openSessionLogger(getRec('workouts', id)), A.wk); await p.waitForTimeout(500);
  assert((await p.innerText('[data-log-top] .log-prog')).includes('4 of') && await p.locator('.log-item:first-child .log-row.done').count() === 2, 'reopening shows the saved sets as done');
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(200);

  console.log('== Without ticks, every filled set is saved (as before)');
  await st(id => openSessionLogger(getRec('workouts', id)), A.wl); await p.waitForTimeout(500);
  await st(() => { const d = [...document.querySelectorAll('.modal-wrap')].pop(); d.querySelectorAll('.log-row.done [data-done]').forEach(b => b.click()); });
  await p.waitForTimeout(150);
  await submit(); await p.waitForTimeout(700);
  const all = await st(id => { const w = getRec('workouts', id); return [(w.log.a1 || []).length, (w.log.a2 || []).length, (w.log.a3 || []).length]; }, A.wl);
  assert(all.join() === '3,2,3', `nothing ticked: all 8 planned sets saved, like before (${all.join()})`);

  console.log('== Group sessions show on the athlete’s Program tab');
  await p.goto(BASE + `#/athlete/${A.kai}/program`); await p.waitForTimeout(500);
  const tag = await st(() => { const a = document.querySelector('.wo-group'); return a && { href: a.getAttribute('href'), t: a.innerText.replace(/\s+/g, ' ') }; });
  assert(tag && tag.href === `#/groups/${A.ev}` && tag.t.includes('Group session · Lift group'), 'the workout is tagged “Group session · Lift group” and links back to the board');
  assert((await p.innerText('#view')).includes('Logged: 220.5 × 5, 220.5 × 4'), 'with what was logged from the group session');

  console.log('== iPad: cards side by side');
  const pad = await browser.newContext({ ...devices['iPad Mini'] }), q = await pad.newPage();
  q.on('pageerror', e => errors.push(e.message));
  await q.goto(BASE); await q.waitForSelector('.modal'); await q.check('input[name=demo]'); await q.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]'); await q.waitForTimeout(900);
  await q.evaluate(() => { const T = today(), ev = S.events.find(e => (e.athleteIds || []).length > 1); upsert('events', { ...ev, date: T }); ev.athleteIds.forEach(aid => upsert('workouts', { athleteId: aid, date: T, eventId: ev.id, title: 'Speed', completed: false, items: [{ id: 'x1', exerciseId: S.exercises.find(e => e.name === 'Back Squat').id, sets: '3', reps: '5', intensity: 'load', load: 100 }] })); });
  await q.goto(BASE + '#/floor'); await q.waitForTimeout(500);
  const side = await q.evaluate(() => { const c = [...document.querySelectorAll('.fa-card')].slice(0, 2).map(x => x.getBoundingClientRect()); return c.length === 2 && Math.round(c[0].top) === Math.round(c[1].top) && c[1].left > c[0].right; });
  assert(side && (await q.evaluate(() => document.documentElement.scrollWidth)) <= 768, 'two cards side by side on an iPad');
  await q.screenshot({ path: SP + '/v131-floor-ipad.png', fullPage: true });
  await pad.close();

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
