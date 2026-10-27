// Performance HQ end-to-end tests — evaluation: key force-plate metrics + add-more, single-leg IMTP & calf isometrics, movement screen, age bands
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const near = (a, b, t = 0.05) => Math.abs(a - b) <= t;
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const submit = () => p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]');
  const st = (fn, a) => p.evaluate(fn, a);
  const fits = async () => (await st(() => document.documentElement.scrollWidth)) <= 391;
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(700);
  const aid = await st(() => S.athletes.find(a => a.firstName === 'Maya').id);

  console.log('== Evaluation form');
  await p.goto(BASE + `#/athlete/${aid}/evaluation`); await p.waitForTimeout(300);
  await p.click('.top-actions [data-act=newEval]'); await p.waitForTimeout(300);
  const ones = await p.$$eval('.modal [data-one]', els => els.map(e => e.dataset.one));
  assert(['rsiMod', 'ttt', 'brakeRfd', 'cmDepth', 'brakeAsym', 'propAsym', 'imtpF100', 'djRsi', 'djGct'].every(k => ones.includes(k)) && !ones.includes('takeoffVel') && !ones.includes('peakLandF'), 'key force-plate metrics shown; the rest are under “+ Add metric”');
  assert(await p.locator('.modal [data-tr=slImtpL]').count() === 3 && await p.locator('.modal [data-tr=calfIsoR]').count() === 3, 'single-leg IMTP and calf push: 3 trials per leg');
  assert(await p.locator('.modal .ms-item').count() === 4 && (await p.innerText('.modal .ms-list')).includes('FRC CARs series'), 'movement screen: overhead squat, lateral lunge, forward lunge with PVC, FRC CARs');
  await p.selectOption('.modal [data-ev-add=cmj]', 'propImp'); await p.waitForTimeout(100);
  assert(await p.locator('.modal [data-one=propImp]').count() === 1 && await st(() => S.settings.evalExtra.includes('propImp')), 'added metric appears and is remembered');
  const fill = async (k, vals) => { for (let i = 0; i < vals.length; i++) await p.fill(`.modal [data-tr=${k}][data-i="${i}"]`, String(vals[i])); };
  await fill('cmj', [15, 15.5, 16]); await fill('cmjPF', [1400, 1420]); await fill('sj', [14, 14.5]); await fill('imtpPF', [2300, 2350]);
  await fill('slImtpL', [1300, 1320]); await fill('slImtpR', [1150, 1170]); await fill('calfIsoL', [1500]); await fill('calfIsoR', [1480]);
  await p.fill('.modal [data-one=rsiMod]', '0.45'); await p.fill('.modal [data-one=propImp]', '250'); await p.fill('.modal [data-one=brakeAsym]', '8'); await p.selectOption('.modal [data-side=brakeAsym]', 'Right');
  await p.click('.modal [data-ms=ohs][data-v="4"]'); await p.fill('.modal [data-msn=ohs]', 'Heels rise at depth');
  await p.click('.modal [data-ms=latLunge][data-v="3"]'); await p.click('.modal [data-ms=fwdLunge][data-v="5"]'); await p.fill('.modal [data-msn=cars]', 'Limited hip IR on left');
  await p.waitForTimeout(150);
  const lr = await p.innerText('.modal [data-lr=slImtp]');
  assert(lr.includes('11.5%') && lr.includes('left stronger') && lr.includes('N/kg'), `live single-leg asymmetry: “${lr}”`);
  assert((await p.innerText('.modal #msTotal')).includes('12') && (await p.innerText('.modal #msTotal')).includes('3 of 4 scored'), 'movement score totals the scored items');
  assert((await p.innerText('.modal #evalOut')).includes('Profile'), 'profile still calculated live');
  assert(await fits(), 'evaluation form fits the iPhone screen');
  await p.screenshot({ path: SP + '/v18-eval-form.png', fullPage: true });
  await submit(); await p.waitForTimeout(400);
  const t = await st(id => { const t = testsFor(id).pop(); return { id: t.id, m: t.m, tm: testMetrics(t), trials: t.trials, screen: t.screen, sides: t.sides }; }, aid);
  assert(t.m.slImtpL === 1310 && t.m.slImtpR === 1160 && t.trials.slImtpL.length === 2 && near(t.tm.slImtpAsym, 11.45) && near(t.tm.calfIsoAsym, 1.33), 'saved: single-leg means, every trial, asymmetry calculated');
  assert(t.tm.slImtpRel > 0 && t.tm.calfIsoRel > 0, 'relative strength calculated from body mass');
  assert(t.screen.ohs.score === 4 && t.screen.ohs.notes === 'Heels rise at depth' && t.screen.fwdLunge.score === 5 && t.screen.cars.notes === 'Limited hip IR on left' && t.screen.cars.score === undefined, 'movement scores and notes saved');
  assert(t.m.propImp === 250 && t.m.rsiMod === 0.45 && t.sides.brakeAsym === 'Right', 'key and added metrics saved, with asymmetry side');

  console.log('== Evaluation tab');
  const ev = await p.innerText('#view');
  assert(ev.includes('Single-leg strength') && ev.includes('Asymmetry 11.5%') && ev.includes('Left stronger') && ev.includes('Isometric calf push'), 'single-leg strength card with left/right and asymmetry');
  assert(ev.includes('Movement screen') && ev.includes('12/ 15') && ev.includes('Heels rise at depth') && ev.includes('4 / 5'), 'movement screen card with scores and notes');
  assert(await st(id => athleteInsights(getAthlete(id)).some(i => /Single-leg IMTP asymmetry 11\.\d% \(Left greater\)/.test(i.title)), aid), 'asymmetry over 10% is flagged in insights, naming the stronger leg');
  assert(await fits(), 'evaluation tab fits the iPhone screen');
  await p.screenshot({ path: SP + '/v18-eval-tab.png', fullPage: true });

  console.log('== Remembered metrics and editing');
  await p.click('.top-actions [data-act=newEval]'); await p.waitForTimeout(300);
  assert(await p.locator('.modal [data-one=propImp]').count() === 1, 'added metric is in the next evaluation by default');
  await p.click('.modal [data-ev-rm=propImp]'); await p.waitForTimeout(100);
  assert(await p.locator('.modal [data-one=propImp]').count() === 0 && await st(() => !S.settings.evalExtra.includes('propImp')), '× removes it from the form');
  await p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]'); await p.waitForTimeout(150);
  await p.click(`#view .list [data-act=newEval][data-id="${t.id}"]`); await p.waitForTimeout(300);
  assert((await p.inputValue('.modal [data-tr=cmj][data-i="0"]')) === '15' && await p.locator('.modal [data-ms=ohs][data-v="4"].on').count() === 1 && (await p.inputValue('.modal [data-msn=ohs]')) === 'Heels rise at depth', 'tapping an evaluation reopens it filled in');
  assert(await p.locator('.modal [data-one=propImp]').count() === 1, 'an evaluation that used an extra metric shows it when edited');
  await p.click('.modal [data-ms=ohs][data-v="5"]'); await submit(); await p.waitForTimeout(400);
  const after = await st(({ aid, id }) => ({ n: testsFor(aid).filter(x => x.id === id).length, total: testsFor(aid).length, s: getRec('tests', id).screen.ohs }), { aid, id: t.id });
  assert(after.n === 1 && after.s.score === 5 && after.s.notes === 'Heels rise at depth', 'editing updates the same evaluation');

  console.log('== Age bands');
  const bands = await st(() => [11, 12, 13, 14, 15, 18, 19, 28, 29, 30].map(ageGroupOf));
  assert(JSON.stringify(bands) === JSON.stringify(['u12', '12', '12', '14', '14', '18', '18', '28', '28', '30']), 'age bands 12–13, 14–15 … 28–29 (plus 11 & under, 30+)');
  await p.goto(BASE + '#/leaderboard'); await p.waitForTimeout(250);
  const opts = await p.$$eval('select[name=age] option', os => os.map(o => o.textContent));
  assert(opts.includes('12–13') && opts.includes('28–29') && opts.includes('30+'), 'leaderboard and percentiles use the same bands');

  console.log('== Validation');
  const cl = await st(() => normalizeState({ tests: [{ id: 't1', athleteId: 'a', date: '2026-01-01', m: {}, screen: { ohs: { score: 9, notes: 123 }, cars: { score: 3, notes: 'ok' }, evil: { score: 1 } } }], settings: { evalExtra: ['propImp', 'bad key!'] } }));
  assert(JSON.stringify(cl.tests[0].screen) === JSON.stringify({ ohs: { notes: '123' }, cars: { score: 3, notes: 'ok' } }) && JSON.stringify(cl.settings.evalExtra) === '["propImp"]', 'movement screen and remembered metrics validated on load/import');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
