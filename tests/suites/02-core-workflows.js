// Performance HQ end-to-end tests — core workflows
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', URL = (process.env.BASE_URL || 'http://localhost:8080/');
const fs = require('fs');
const assert = (c, m) => { if (!c) { throw new Error('ASSERT: ' + m); } console.log('  ✓ ' + m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'], acceptDownloads: true });
  const page = await ctx.newPage();
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
  const submit = () => page.click('.modal-wrap:last-child .modal-head button[type=submit]');
  const st = fn => page.evaluate(fn);
  await page.goto(URL);
  await page.waitForSelector('.modal');
  await page.uncheck('input[name=starter]');
  await submit();
  await page.waitForTimeout(300);
  assert(await st(() => S.exercises.length) === 0, 'onboarding without starter library leaves library empty');

  // Athlete
  await page.goto(URL + '#/athletes');
  await page.click('[data-act=newAthlete]');
  await submit();
  assert(await page.isVisible('.form-error:not(.hidden)'), 'validation: first name required');
  await page.fill('input[name=firstName]', 'Sam');
  await page.fill('input[name=lastName]', 'Lee');
  await page.fill('input[name=sport]', 'Lacrosse');
  await page.fill('input[name=height]', '70');
  await page.fill('input[name=mass]', '180');
  await submit();
  await page.waitForTimeout(300);
  const aid = await st(() => S.athletes[0].id);
  assert(page.url().includes('#/athlete/' + aid), 'navigates to new athlete profile');
  assert(Math.abs(await st(() => S.athletes[0].massKg) - 81.65) < 0.05, 'mass stored as kg (180 lb → 81.6 kg)');

  // Exercise via library
  await page.goto(URL + '#/library');
  await page.click('[data-act=loadStarter]');
  await page.waitForTimeout(200);
  const nEx = await st(() => S.exercises.length);
  assert(nEx >= 55, `starter library loaded (${nEx})`);
  await page.click('.top-actions [data-act=newExercise]');
  await page.fill('input[name=name]', 'Back Squat');
  await submit();
  assert(await page.isVisible('.form-error:not(.hidden)'), 'duplicate exercise name rejected');
  await page.fill('input[name=name]', 'Custom Sled Squat');
  await page.check('input[name=vbt]');
  await page.fill('input[name=mvt]', '0.3');
  await submit(); await page.waitForTimeout(200);
  assert(await st(() => S.exercises.some(e => e.name === 'Custom Sled Squat' && e.vbt && e.mvt === 0.3)), 'custom exercise saved with VBT + MVT');
  await page.fill('[data-input=libSearch]', 'custom sled');
  assert((await page.textContent('#libResults')).includes('Custom Sled Squat'), 'library search works');

  // Event with weekly repeat
  await page.goto(URL + '#/calendar');
  await page.click('.top-actions [data-act=newEvent]');
  await page.click('.picker-list label');
  await page.fill('input[name=start]', '16:00');
  await page.selectOption('select[name=repeat]', '4');
  await submit(); await page.waitForTimeout(200);
  assert(await st(() => S.events.length) === 4, 'weekly repeat creates 4 events');
  assert(await st(() => new Set(S.events.map(e => e.seriesId)).size) === 1, 'events share a series');
  await page.click('.agenda-day [data-act=openEvent]');
  await page.fill('input[name=location]', 'Turf 2');
  await page.check('input[name=applySeries]');
  await submit(); await page.waitForTimeout(200);
  assert(await st(() => S.events.every(e => e.location === 'Turf 2')), 'apply-to-series updates later events');
  for (const m of ['week', 'list', 'month']) await page.click(`[data-act=calMode][data-v=${m}]`);
  await page.click('[data-act=calNav][data-d="1"]'); await page.click('[data-act=calNav][data-d="-1"]');

  // Test entry with auto-calcs
  await page.goto(URL + `#/athlete/${aid}/testing`);
  await page.click('.top-actions [data-act=newTest]');
  await submit();
  assert((await page.textContent('.form-error')).includes('at least one'), 'empty test rejected');
  await page.fill('input[name=m_sprint10]', '1.85');
  await page.fill('input[name=m_cmj]', '20');  // inches
  await page.fill('input[name=m_sj]', '18');
  await page.fill('input[name=m_djHeight]', '15');
  await page.fill('input[name=m_djGct]', '0.200');
  await page.fill('input[name=m_cmjPF]', '2,100');
  await page.fill('input[name=m_imtpPF]', '3000');
  const calc = await page.textContent('#testCalc');
  assert(calc.includes('DSI 0.70') && calc.includes('EUR 1.11') && calc.includes('Drop jump RSI 1.91'), 'live calc: DSI, EUR, RSI → ' + calc);
  await page.fill('input[name=m_sprint20]', 'abc');
  await submit();
  assert((await page.textContent('.form-error')).includes('valid number'), 'invalid number rejected');
  await page.fill('input[name=m_sprint20]', '');
  await submit(); await page.waitForTimeout(200);
  const t = await st(() => S.tests[0]);
  assert(Math.abs(t.m.cmj - 50.8) < 0.01 && t.m.cmjPF === 2100, 'test stored metric (20 in → 50.8 cm; "2,100" → 2100)');
  // second test (older date) to get trend
  await st(() => { upsert('tests', { athleteId: S.athletes[0].id, date: addDays(today(), -30), m: { sprint10: 1.92, cmj: 46 }, bodyMassKg: 81 }); refresh(); });
  await page.waitForTimeout(200);
  assert(await page.locator('.metric-card .chart svg').count() >= 2, 'trend charts drawn');
  const ins = await st(() => athleteInsights(S.athletes[0]).map(i => i.title));
  assert(ins.some(x => x.includes('CMJ up')), 'insight: CMJ up flagged → ' + ins.join(' | '));
  assert(ins.some(x => x.includes('DSI')), 'insight: DSI present');

  // Workout with %1RM + repeat
  await page.goto(URL + `#/athlete/${aid}/program`);
  await page.click('.top-actions [data-act=newWorkout]');
  await page.fill('input[name=title]', 'Lower A');
  const bs = await st(() => S.exercises.find(e => e.name === 'Back Squat').id);
  await page.selectOption('.item-editor select[data-k=exerciseId]', bs);
  await page.waitForTimeout(100);
  await page.selectOption('.item-editor select[data-k=intensity]', 'pct');
  await page.fill('.item-editor input[data-k=pct]', '80');
  await page.fill('.item-editor input[data-k=vlCutoff]', '20');
  await page.click('[data-add-item]');
  await page.selectOption('.item-editor:nth-child(2) select[data-k=exerciseId]', await st(() => S.exercises.find(e => e.name === 'Box Jump').id));
  await page.click('.item-editor:nth-child(2) [data-it=up]');
  await page.selectOption('select[name=repeat]', '3');
  await submit(); await page.waitForTimeout(200);
  const wos = await st(() => S.workouts);
  assert(wos.length === 3 && wos[0].items.length === 2 && wos[0].items[0].exerciseId !== bs, 'workout repeat ×3, items reordered');
  assert((await page.textContent('.wo')).includes('no 1RM on file'), '%1RM shows no-1RM note');

  // Tested max then pct resolves
  await page.goto(URL + `#/athlete/${aid}/vbt`);
  await page.click('.empty [data-act=newMax]');
  await page.selectOption('select[name=exerciseId]', bs);
  await page.fill('input[name=kg]', '300');
  await submit(); await page.waitForTimeout(200);
  await page.goto(URL + `#/athlete/${aid}/program`);
  assert((await page.textContent('.wo')).includes('240 lb'), '80% of 300 lb 1RM = 240 lb');

  // Complete workout with sRPE
  await page.click('.wo [data-act=completeWorkout]');
  await page.selectOption('select[name=rpe]', '7');
  await page.fill('input[name=dur]', '75');
  await submit(); await page.waitForTimeout(200);
  assert(await st(() => S.workouts.find(w => w.completed)?.rpe === 7), 'workout completed with sRPE 7');

  // Duplicate & copy week
  await page.click('.wo [data-act=dupWorkout]');
  await submit(); await page.waitForTimeout(200);
  assert(await st(() => S.workouts.length) === 4, 'duplicate creates copy');

  // VBT log with save & next
  await page.goto(URL + '#/vbt');
  await page.click('.top-actions [data-act=newVbt]');
  await page.selectOption('select[name=athleteId]', aid);
  await page.selectOption('select[name=exerciseId]', bs);
  for (const [load, reps] of [['135', '1.05, 1.02, 0.98'], ['185', '0.82, 0.80, 0.74'], ['225', '0.62, 0.58, 0.50']]) {
    await page.fill('input[name=load]', load);
    await page.fill('input[name=reps]', reps);
    await page.click('[data-next]'); await page.waitForTimeout(150);
  }
  await page.fill('input[name=load]', '255');
  await page.fill('input[name=vSingle]', '0.45');
  await submit(); await page.waitForTimeout(200);
  const logs = await st(() => S.vbt);
  assert(logs.length === 4, 'four sets logged (3 via save-next)');
  assert(Math.abs(logs[2].vl - 19.35) < 0.1, 'velocity loss computed (0.62→0.50 = 19.4%)');
  const e1 = await st(() => lvProfile(S.athletes[0].id, S.exercises.find(e => e.name === 'Back Squat').id).e1rm);
  assert(e1 > 115 && e1 < 160, 'e1RM estimated ' + e1.toFixed(1) + ' kg');
  assert(await page.locator('.chart svg circle').count() > 3, 'L–V chart drawn');
  await page.fill('#vlIn', '0.80 0.78 0.72 0.63 0.6');
  assert((await page.textContent('#vlOut')).includes('rep 4'), 'VL calculator stop rep');

  // Persistence across reload
  await page.reload(); await page.waitForTimeout(500);
  const counts = await st(() => [S.athletes.length, S.events.length, S.tests.length, S.workouts.length, S.vbt.length, S.maxes.length]);
  assert(JSON.stringify(counts) === '[1,4,2,4,4,1]', 'data persists after reload ' + counts);

  // Offline reload (service worker)
  await page.waitForTimeout(500);
  const swOn = await st(() => navigator.serviceWorker.ready.then(() => !!navigator.serviceWorker.controller));
  await ctx.setOffline(true);
  await page.reload(); await page.waitForTimeout(800);
  assert(await page.isVisible('#topbar h1'), 'app loads offline (sw controller: ' + swOn + ')');
  assert(await st(() => S.athletes.length) === 1, 'data available offline');
  await ctx.setOffline(false);

  // Export backup
  await page.goto(URL + '#/settings');
  const [dl] = await Promise.all([page.waitForEvent('download'), page.click('.card [data-act=exportBackup]')]);
  const bpath = SP + '/backup.json'; await dl.saveAs(bpath);
  const bk = JSON.parse(fs.readFileSync(bpath, 'utf8'));
  assert(bk.app === 'performance-hq' && bk.data.athletes.length === 1, 'backup file valid');
  const [csv] = await Promise.all([page.waitForEvent('download'), page.click('[data-act=exportCsv]')]);
  await csv.saveAs(SP + '/tests.csv');
  assert(fs.readFileSync(SP + '/tests.csv', 'utf8').includes('Sam Lee'), 'CSV export contains athlete');

  // PIN lock
  await page.click('[data-act=setPin]');
  await page.fill('input[name=pin]', '2468'); await submit(); await page.waitForTimeout(150);
  await page.fill('input[name=pin]', '2468'); await submit(); await page.waitForTimeout(400);
  assert(await st(() => S.settings.lockEnabled && S.settings.pinHash.length === 64), 'PIN set (SHA-256 hash stored, not PIN)');
  await page.reload(); await page.waitForTimeout(500);
  assert(await page.isVisible('#lock') && !(await page.isVisible('#view')), 'locked on launch, content hidden');
  for (const k of '1111') await page.click(`#lock [data-k="${k}"]`);
  await page.waitForTimeout(300);
  assert(await page.isVisible('#lock'), 'wrong PIN stays locked');
  for (const k of '2468') await page.click(`#lock [data-k="${k}"]`);
  await page.waitForTimeout(300);
  assert(!(await page.isVisible('#lock')), 'correct PIN unlocks');

  // Second device: import + merge
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', e => errors.push('p2 pageerror: ' + e.message));
  await p2.goto(URL); await p2.waitForSelector('.modal');
  await p2.click('.modal-head [data-close]');
  await p2.evaluate(() => { upsert('athletes', { firstName: 'Mac', lastName: 'Only' }); });
  await p2.goto(URL + '#/settings');
  await p2.setInputFiles('#importFile', bpath);
  await p2.waitForSelector('.dialog');
  await p2.click('.dialog [data-i="0"]'); await p2.waitForTimeout(500);
  const merged = await p2.evaluate(() => [S.athletes.length, S.tests.length, S.vbt.length]);
  assert(JSON.stringify(merged) === '[2,2,4]', 'merge import keeps both devices’ data ' + merged);
  // delete propagation: delete on device 2, export, merge into device 1
  await p2.evaluate(() => { removeRec('tests', S.tests[0].id); });
  const exp2 = await p2.evaluate(() => JSON.stringify({ app: 'performance-hq', data: S }));
  fs.writeFileSync(SP + '/backup2.json', exp2);
  await page.goto(URL + '#/settings');
  await page.setInputFiles('#importFile', SP + '/backup2.json');
  await page.waitForSelector('.dialog'); await page.click('.dialog [data-i="0"]'); await page.waitForTimeout(500);
  const m1 = await st(() => [S.athletes.length, S.tests.length]);
  assert(JSON.stringify(m1) === '[2,1]', 'deletions + new records sync back ' + m1);

  // Deletes
  await page.goto(URL + `#/athlete/${aid}`);
  await page.click('[data-act=editAthlete]');
  await page.click('.modal [data-del]');
  await page.click('.dialog .btn.danger');
  await page.waitForTimeout(300);
  const after = await st(() => [S.athletes.length, S.tests.length, S.workouts.length, S.vbt.length, S.events.length, S.events.every(e => e.athleteIds.length === 0)]);
  assert(JSON.stringify(after) === '[1,0,0,0,4,true]', 'athlete delete cascades, events kept ' + after);
  let bad = [];
  for (const r of ['dashboard', 'calendar', 'athletes', 'library', 'vbt', 'insights', 'settings']) { await page.goto(URL + '#/' + r); await page.waitForTimeout(150); const tx = await page.innerText('#app'); if (tx.includes('went wrong')) bad.push(r + ': ' + tx.slice(tx.indexOf('went wrong') - 40, tx.indexOf('went wrong') + 160)); }
  assert(!bad.length, 'all views OK after deletes ' + bad.join(' || '));
  await page.goto(URL + '#/athlete/doesnotexist');
  assert((await page.textContent('#view')).includes('not found'), 'missing athlete handled');
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
