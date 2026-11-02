// Performance HQ end-to-end tests — v1.17: compare with an earlier session while programming
// (side by side on a Mac, above the exercises on an iPhone, and a line under each exercise)
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const run = async (label, opts) => {
    const ctx = await browser.newContext(opts);
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`${label}: ${e.message}`));
    p.on('console', m => { if (m.type() === 'error') errors.push(`${label}: ${m.text()}`); });
    const top = '.modal-wrap >> nth=-1';
    const st = (fn, a) => p.evaluate(fn, a);
    await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await p.click('.modal-head button[type=submit]'); await p.waitForTimeout(800);
    // Ava's last session before tomorrow, logged as done (sets with load × reps, RPE and bar speed)
    const D = await st(() => {
      const ava = activeAthletes().find(a => a.firstName === 'Ava'), date = addDays(today(), 1);
      const [last, before] = woEarlier(ava.id, date);
      const log = {};
      last.items.forEach((it, k) => { if (!fpTestOf(getExercise(it.exerciseId))) log[it.id] = [0, 1].map(j => ({ load: U.massIn(135 + 10 * k + 10 * j), reps: 5, vels: '', avg: null, rpe: 7 + j, vBest: null })); });
      upsert('workouts', { ...last, log, completed: true, rpe: 7, durationMin: 65 });
      const names = last.items.filter(i => getExercise(i.exerciseId)).map(i => getExercise(i.exerciseId).name);
      return { ava: ava.id, date, last: last.id, lastDate: last.date, title: last.title, before: before?.id, beforeDate: before?.date, names, first: last.items[0], n: names.length };
    });
    await p.goto(BASE + `#/athlete/${D.ava}/program`); await p.waitForTimeout(250);
    await st(d => openWorkoutModal(null, { athleteId: d.ava, date: d.date }), D); await p.waitForTimeout(350);
    return { p, ctx, top, st, D };
  };

  console.log('== iPhone: the last session above the exercises');
  let { p, ctx, top, st, D } = await run('iphone', { ...devices['iPhone 13'] });
  const sel = await p.$eval('[data-woc-sel]', s => ({ v: s.value, t: s.selectedOptions[0].textContent, n: s.options.length }));
  assert(sel.v === D.last && sel.t.includes(D.title) && sel.t.endsWith('✓'), `compares with the last session by default (${sel.t})`);
  const card = await p.innerText('.woc');
  assert(card.includes('Completed · session RPE 7 · 65 min') && D.names.every(n => card.includes(n)), 'shows how it went and every exercise');
  assert((await p.$$eval('.woc .woc-did', els => els.map(e => e.textContent)))[0].startsWith('Did 135×5 RPE 7, 145×5 RPE 8 lb'), 'and what was actually done, set by set');
  const y = await st(() => [document.querySelector('#woCmp').getBoundingClientRect().top, document.querySelector('#itemsHost').getBoundingClientRect().top]);
  assert(y[0] < y[1] && (await st(() => document.documentElement.scrollWidth)) <= 391, 'on the iPhone it sits above the exercises and fits the screen');
  await p.screenshot({ path: SP + '/v117-compare-iphone.png' });

  console.log('== Building from it');
  await p.click('.woc [data-woc-add] >> nth=0'); await p.waitForTimeout(250);
  const r0 = await p.innerText('#itemsHost .item-editor >> nth=0');
  const label = await st(d => woDayLabel(d.lastDate, d.date), D);
  assert(r0.includes(D.names[0]) && r0.includes('Prefilled from') && r0.includes(`${label}: `), `an exercise added from the card copies that prescription and shows what was done ${label}`);
  assert(await p.locator('.woc-item >> nth=0 >> [data-woc-add]').count() === 0 && await p.locator('.woc-item >> nth=0 >> .woc-in').count() === 1, 'the card marks it as already in this session');
  assert((await p.inputValue('#itemsHost .item-editor >> nth=0 >> input[data-k=sets]')) === String(D.first.sets), 'with the same sets');
  if (D.n > 2) {
    await p.click('.woc [data-woc-all]'); await p.waitForTimeout(300);
    assert(await p.locator('#itemsHost .item-editor').count() === D.n && await p.locator('.woc [data-woc-add]').count() === 0, `“Add the other ${D.n - 1}” copies the rest`);
  }
  const lines = await p.$$eval('#itemsHost .ie-cmp', els => els.length);
  assert(lines === await p.locator('#itemsHost .item-editor').count(), 'every exercise shows its line from the earlier session');

  console.log('== Another session, or none');
  if (D.before) {
    await p.selectOption('[data-woc-sel]', D.before); await p.waitForTimeout(250);
    const lbl = await st(d => woDayLabel(d.beforeDate, d.date), D);
    assert((await p.$$eval('#itemsHost .ie-cmp b', els => [...new Set(els.map(e => e.textContent))])).every(t => t === `${lbl}:`) || await p.locator('#itemsHost .ie-cmp').count() === 0, `pick any earlier session (${lbl}); the lines follow it`);
    await p.fill(`${top} >> input[name=date]`, D.date); await p.dispatchEvent(`${top} >> input[name=date]`, 'change'); await p.waitForTimeout(200);
    assert((await p.inputValue('[data-woc-sel]')) === D.before, 'a session you picked stays picked');
  }
  await p.fill(`${top} >> input[name=date]`, '2020-01-06'); await p.dispatchEvent(`${top} >> input[name=date]`, 'change'); await p.waitForTimeout(200);
  assert(await st(() => !document.querySelector('#woCmp').innerHTML && !document.querySelector('.wo-layout').classList.contains('has-cmp')), 'no earlier session → no card');
  await p.fill(`${top} >> input[name=date]`, D.date); await p.dispatchEvent(`${top} >> input[name=date]`, 'change'); await p.waitForTimeout(200);
  assert((await p.inputValue('[data-woc-sel]')) === D.last, 'moving the date back finds the last session again');

  console.log('== Hide it');
  await p.click('[data-woc-toggle]'); await p.waitForTimeout(100);
  assert(await p.locator('.woc.hide').count() === 1 && await st(() => S.settings.woCmpHide === true), 'the card folds to one line, and stays folded next time');
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(150);
  await st(d => openWorkoutModal(getRec('workouts', d.last)), D); await p.waitForTimeout(300);
  const eSel = await p.inputValue('[data-woc-sel]').catch(() => '');
  assert(await p.locator('.woc.hide').count() === 1 && eSel && eSel !== D.last, 'editing a session compares it with the one before it (never itself)');
  await p.click('[data-woc-toggle]'); await p.waitForTimeout(100);
  assert(await st(() => S.settings.woCmpHide === false), 'and unfolds again');
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(150);
  assert(await st(() => !SHARED_SETTINGS.includes('woCmpHide')), 'folding is a per-device choice (not synced)');
  await ctx.close();

  console.log('== Mac: side by side');
  ({ p, ctx, top, st, D } = await run('mac', { viewport: { width: 1280, height: 800 } }));
  const box = await st(() => { const r = s => document.querySelector(s).getBoundingClientRect(); return { modal: r('.modal-wrap:last-child .modal').width, items: r('#itemsHost'), cmp: r('#woCmp') }; });
  assert(box.modal > 1000 && box.cmp.left > box.items.right && Math.abs(box.cmp.top - box.items.top) < 260, `the earlier session sits beside the new one (modal ${Math.round(box.modal)} px)`);
  await p.click('.woc [data-woc-add] >> nth=0'); await p.waitForTimeout(250);
  await p.screenshot({ path: SP + '/v117-compare-mac.png' });
  assert((await st(() => document.documentElement.scrollWidth)) <= 1280 && (await p.locator('#itemsHost .ie-cmp').count()) === 1, 'fits the Mac window; the added exercise shows its line from the earlier session');
  await ctx.close();

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
