// Performance HQ end-to-end tests — program session logging
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
  const submit = () => p.click('.modal-wrap:last-child .modal-head button[type=submit]');
  const st = fn => p.evaluate(fn);
  await p.goto(BASE); await p.waitForSelector('.modal'); await submit(); await p.waitForTimeout(400); // starter library on
  // athlete
  await p.goto(BASE + '#/athletes'); await p.click('.top-actions [data-act=newAthlete]');
  await p.fill('input[name=firstName]', 'Test'); await p.fill('input[name=lastName]', 'Athlete'); await submit(); await p.waitForTimeout(300);
  const aid = await st(() => S.athletes[0].id);
  // manual program: Program tab → + Workout
  await p.goto(BASE + `#/athlete/${aid}/program`); await p.waitForTimeout(200);
  await p.click('.top-actions [data-act=newWorkout]'); await p.waitForTimeout(200);
  await p.fill('input[name=title]', 'Lower A');
  const ids = await st(() => ({ bs: S.exercises.find(e => e.name === 'Back Squat').id, rdl: S.exercises.find(e => e.name === 'Romanian Deadlift').id }));
  await p.selectOption('.item-editor select[data-k=exerciseId]', ids.bs); await p.waitForTimeout(100);
  await p.selectOption('.item-editor select[data-k=intensity]', 'load');
  await p.fill('.item-editor input[data-k=sets]', '3'); await p.fill('.item-editor input[data-k=reps]', '5');
  await p.fill('.item-editor input[data-k=load]', '185');
  await p.click('[data-add-item]'); await p.selectOption('.item-editor:nth-child(2) select[data-k=exerciseId]', ids.rdl);
  await submit(); await p.waitForTimeout(300);
  assert(await st(() => S.workouts.length === 1 && S.workouts[0].items.length === 2), 'program entered manually (2 exercises)');
  await p.screenshot({ path: SP + '/v4-program.png', fullPage: true });
  // in-session view
  await p.click('.wo [data-act=logSession]'); await p.waitForTimeout(300);
  const rows = await p.$$('.log-item:first-child .log-row');
  assert(rows.length === 3, 'session view pre-fills 3 sets from the program');
  assert((await p.inputValue('.log-item:first-child .log-row [data-k=load]')) === '185', 'planned load pre-filled');
  assert(await p.locator('.log-item:first-child [data-k=avg]').count() === 3, 'set-average velocity entry is the default');
  const avgs = await p.$$('.log-item:first-child [data-k=avg]');
  await avgs[0].fill('0.74'); await avgs[1].fill('0.71'); await avgs[2].fill('0.66');
  const loads = await p.$$('.log-item:first-child [data-k=load]'); await loads[2].fill('195');
  assert((await p.innerText('.log-item:first-child .log-row [data-calc]')).includes('Avg 0.74'), 'live zone feedback');
  await p.fill('.log-item:nth-child(2) .log-row [data-k=load]', '135'); await p.fill('.log-item:nth-child(2) .log-row [data-k=reps]', '8');
  await p.screenshot({ path: SP + '/v4-session.png' });
  await submit(); await p.waitForTimeout(400);
  const v = await st(() => S.vbt.map(l => ({ load: Math.round(l.load * 2.2046 * 10) / 10, n: l.n, vBest: l.vBest, vMean: l.vMean, entry: l.entry })));
  assert(v.length === 3 && v.every(x => x.n === 5 && x.entry === 'avg') && v[2].load === 195 && v[0].vMean === 0.74, 'three VBT sets saved with load, reps & average velocity');
  assert(await st(() => S.workouts[0].log && Object.values(S.workouts[0].log)[1][0].reps === 8 && S.workouts[0].completed), 'non-VBT sets saved, workout completed');
  assert((await p.innerText('.wo')).includes('Logged'), 'workout card shows what was logged');
  // reopen + switch mode
  await p.click('.wo [data-act=logSession]'); await p.waitForTimeout(300);
  assert((await p.inputValue('.log-item:first-child [data-k=avg]')) === '0.74', 'reopen restores averages');
  await p.click('.log-item:first-child [data-vmode=reps]'); await p.waitForTimeout(100);
  assert(await p.locator('.log-item:first-child [data-k=vels]').count() === 3, 'can switch to per-rep entry');
  await p.click('.log-item:first-child [data-vmode=avg]'); await p.click('.modal-head [data-close]');
  // VBT tab
  await p.goto(BASE + `#/athlete/${aid}/vbt`); await p.waitForTimeout(300);
  const t = await p.innerText('#view');
  assert(t.includes('Session history') && t.includes('185 × 5') && t.includes('0.74'), 'athlete VBT section shows the session');
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
