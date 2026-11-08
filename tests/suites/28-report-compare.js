// Performance HQ end-to-end tests — v1.23 progress reports: each test's first result (the initial evaluation)
// and last month's best, both compared with this month's best
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
  const st = (fn, a) => p.evaluate(fn, a);
  const fits = async () => (await st(() => document.documentElement.scrollWidth)) <= 391;
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]'); await p.waitForTimeout(400);
  const A = await st(() => {
    const a = upsert('athletes', { firstName: 'Maya', lastName: 'Lee', sex: 'F', dob: '2009-04-04', archived: false });
    const d = n => addDays(today(), -n);
    upsert('tests', { athleteId: a.id, date: d(80), sides: {}, evaluation: true, m: { sprint10: 2.05, cmj: 30.5, broad: 190 } });   // the initial evaluation
    upsert('tests', { athleteId: a.id, date: d(50), sides: {}, m: { sprint10: 1.95, cmj: 32 } });                                  // last month
    upsert('tests', { athleteId: a.id, date: d(40), sides: {}, m: { sprint10: 1.92, cmj: 33 } });                                  // last month (its best)
    upsert('tests', { athleteId: a.id, date: d(20), sides: {}, m: { sprint10: 1.88, cmj: 34.5 } });                                // this month (sprint best)
    upsert('tests', { athleteId: a.id, date: d(5), sides: {}, m: { sprint10: 1.90, cmj: 35.5, broad: 201 } });                     // this month (latest)
    return { aid: a.id, d40: d(40), d20: d(20), d80: d(80) };
  });
  const table = () => p.locator('.report .r-sec', { hasText: 'Performance testing' });
  const heads = async () => (await table().locator('th').allInnerTexts()).map(x => x.trim().toLowerCase());
  const row = async name => (await table().locator('tr', { hasText: name }).innerText()).replace(/\s+/g, ' ');

  console.log('== New reports: initial evaluation and last month, vs this month’s best');
  await p.goto(BASE + `#/reports?athlete=${A.aid}`); await p.waitForTimeout(500);
  assert((await p.inputValue('select[data-change=repBaseline]')) === 'both', 'a new report compares with both');
  assert((await heads()).join('|') === 'test|initial evaluation|last month|this month|since evaluation|vs last month', `columns: ${(await heads()).join(', ')}`);
  const sprint = await row('10 m sprint');
  assert(sprint.includes('2.05 s') && sprint.includes('1.92 s') && sprint.includes('1.88 s') && sprint.includes('▼ 8.3%') && sprint.includes('▼ 2.1%') && sprint.includes('Personal best'), `10 m sprint: evaluation 2.05 s, last month’s best 1.92 s, this month’s best 1.88 s (not the latest 1.90 s); 8.3% and 2.1% faster (${sprint})`);
  assert(await table().locator('tr', { hasText: '10 m sprint' }).locator('td >> nth=4 >> .r-good').count() === 1 && await table().locator('tr', { hasText: '10 m sprint' }).locator('td >> nth=5 >> .r-good').count() === 1, 'both improvements are coloured as real (bigger than the sprint’s typical error)');
  const cmj = await row('CMJ height');
  assert(cmj.includes('12.0 in') && cmj.includes('13.0 in') && cmj.includes('14.0 in') && cmj.includes('▲ 16.4%') && cmj.includes('▲ 7.6%'), `CMJ: 12.0 → 13.0 → 14.0 in (${cmj})`);
  const broad = await row('Broad jump');
  assert(broad.includes('—') && broad.includes('no test') && broad.includes('▲ 5.8%'), 'a test not done last month says “no test” and still shows the change since the evaluation');
  const note = await table().locator('.r-note').innerText();
  assert(note.includes('Last month = the best result in the 30 days before this report') && note.includes('this month = the best result in this report’s period'), 'the note explains both columns');
  const asm = await p.inputValue('textarea[data-k=assessment]');
  assert(asm.includes('Compared with Maya\'s best results last month: CMJ height 13.0 in → 14.0 in (+7.6%); 10 m sprint 1.92 s → 1.88 s (−2.1%)') && asm.includes('Maya\'s CMJ height improved from 12.0 in to 14.0 in (+16.4%)'), 'the drafted assessment mentions both (and keeps “CMJ” in capitals)');
  const kp = (await p.innerText('.report .r-kpis')).replace(/\s+/g, ' ');
  assert(kp.includes('3/3 Improved since the evaluation') && kp.includes('2/2 Improved since last month'), `the highlights count the tests improved since the evaluation and since last month (${kp})`);
  assert(await fits(), 'the report page fits the iPhone screen');
  await p.locator('.report .r-sec', { hasText: 'Performance testing' }).screenshot({ path: SP + '/v123-report.png' });

  console.log('== Other periods and choices');
  await p.selectOption('select[data-change=repPeriod]', '7'); await p.waitForTimeout(300);
  assert((await heads()).slice(2, 4).join('|') === 'last week|this week', 'a weekly report says last week / this week');
  await p.selectOption('select[data-change=repPeriod]', '90'); await p.waitForTimeout(300);
  assert((await heads()).slice(2, 4).join('|') === '3 months before|last 3 months', 'a 3-month report compares with the 3 months before');
  await p.selectOption('select[data-change=repPeriod]', 'all'); await p.waitForTimeout(300);
  assert((await heads()).join('|') === 'test|initial evaluation|latest|change|best|', 'an all-time report has no “before”, so it compares with the first test');
  await p.selectOption('select[data-change=repPeriod]', '30'); await p.waitForTimeout(300);
  await p.selectOption('select[data-change=repBaseline]', 'first'); await p.waitForTimeout(300);
  assert((await heads()).join('|') === 'test|initial evaluation|latest|change|best|' && (await row('10 m sprint')).includes('1.90 s'), 'first test only: the latest result (1.90 s) vs the evaluation');
  await p.selectOption('select[data-change=repBaseline]', 'period'); await p.waitForTimeout(300);
  assert((await heads())[1] === 'start' && (await row('10 m sprint')).includes('1.92 s'), 'or the last result before this period');
  await p.selectOption('select[data-change=repBaseline]', 'both'); await p.waitForTimeout(300);

  console.log('== When the first result isn’t the evaluation');
  await st(id => upsert('tests', { athleteId: id, date: addDays(today(), -95), sides: {}, m: { sprint10: 2.10 } }), A.aid);
  await p.goto(BASE + '#/dashboard'); await p.waitForTimeout(150);
  await p.goto(BASE + `#/reports?athlete=${A.aid}`); await p.waitForTimeout(400);
  const h2 = await heads();
  assert(h2[1] === 'first test' && h2[4] === 'since first test' && (await row('CMJ height')).includes('· evaluation') && !(await row('10 m sprint')).includes('· evaluation'), 'the column says “First test” and marks the rows whose first result was the evaluation');

  console.log('== Saved, reopened, printed and checked on load');
  await p.click('[data-act=repSave]'); await p.waitForTimeout(250);
  const saved = await st(() => S.reports[S.reports.length - 1]);
  assert(saved.baseline === 'both', 'a saved report keeps the choice');
  await st(id => upsert('reports', { athleteId: id, title: 'Old report', period: 'custom', from: addDays(today(), -30), to: today(), sections: { testing: true }, metrics: [], assessment: 'x', next: 'y' }), A.aid);
  await p.goto(BASE + '#/dashboard'); await p.waitForTimeout(150);
  await p.goto(BASE + '#/reports'); await p.waitForTimeout(300);
  await p.click('button.link:has-text("Old report")'); await p.waitForTimeout(300);
  assert((await heads()).includes('latest') && !(await heads()).includes('vs last month'), 'a report saved before this version opens exactly as it was (first test only)');
  const clean = await st(() => ['both', 'first', 'period', 'evil'].map(b => cleanRecord('reports', { id: 'r1', athleteId: 'a', baseline: b, createdAt: 1, updatedAt: 1 }).baseline));
  assert(clean.join() === 'both,first,period,first', 'only known choices load from a backup or sync');
  const html = await st(id => { UI.rep = { ...repDefaults(id) }; return reportHtml(UI.rep, repData(UI.rep)); }, A.aid);
  assert(html.includes('vs last month') && html.includes('r-cmp'), 'the printed and shared report has the same table');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
