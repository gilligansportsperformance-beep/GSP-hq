// Performance HQ end-to-end tests — v1.24: the progress report and the initial evaluation report are clearly different:
// their own names and bands, the evaluation as the starting point, the progress report about change (levels then and now)
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
    const e1 = upsert('tests', { athleteId: a.id, date: d(80), sides: {}, evaluation: true, m: { sprint10: 2.05, cmj: 11 * 2.54, broad: 190 } });   // the initial evaluation: CMJ 11.0 in (Average)
    upsert('tests', { athleteId: a.id, date: d(40), sides: {}, m: { sprint10: 1.92, cmj: 13 * 2.54 } });
    upsert('tests', { athleteId: a.id, date: d(5), sides: {}, m: { sprint10: 1.88, cmj: 14.5 * 2.54, broad: 201 } });                          // CMJ 14.5 in (Good)
    const e2 = upsert('tests', { athleteId: a.id, date: d(2), sides: {}, evaluation: true, m: { sprint10: 1.87, cmj: 14.6 * 2.54 } });         // a re-evaluation
    return { aid: a.id, e1: e1.id, e2: e2.id, d80: d(80) };
  });

  console.log('== The initial evaluation report: the starting point');
  await p.goto(BASE + `#/evalreport/${A.e1}`); await p.waitForTimeout(400);
  const ev = await p.innerText('#evalRepView');
  assert(ev.includes('Initial Evaluation') && (await p.innerText('#evalRepView .r-kind.eval .r-kind-tag')).toLowerCase() === 'starting point', 'titled “Initial Evaluation”, with a “Starting point” band');
  assert(ev.includes('Progress reports compare every later test with these numbers') && !ev.includes('Since') && await p.locator('#evalRepView .r-cmp, #evalRepView .r-lvch').count() === 0, 'it grades the results of that day and compares with nothing');
  assert((await p.innerText('.topbar h1')).includes('Initial evaluation report') && await p.locator(`#view a.btn[href="#/reports?athlete=${A.aid}"]`).count() === 1, 'the page names it and links to the progress report');
  await p.locator('#evalRepView .report').screenshot({ path: SP + '/v124-eval.png' });
  await p.goto(BASE + `#/evalreport/${A.e2}`); await p.waitForTimeout(400);
  const ev2 = await p.innerText('#evalRepView');
  assert(ev2.includes('Re-evaluation') && !ev2.includes('Initial Evaluation') && ev2.includes(`The initial evaluation was on ${await st(d => fmtDateFull(d), A.d80)}`), 'a later evaluation is a “Re-evaluation” and names the initial one');
  const shared = await st(id => { let got = null; window.shareReport = (html, title, name) => { got = { title, name }; return Promise.resolve(); }; A.evalRepShare({ dataset: { id } }); return got; }, A.e1);
  assert(shared.title.startsWith('Initial evaluation') && /-Initial-evaluation-\d{4}-\d{2}-\d{2}\.html$/.test(shared.name), `the shared file is named for what it is (${shared.name})`);

  console.log('== The progress report: change since the evaluation and last month');
  await p.goto(BASE + `#/reports?athlete=${A.aid}`); await p.waitForTimeout(500);
  const band = await p.innerText('#reportPaper .r-kind.prog');
  assert(band.toLowerCase().startsWith('progress') && band.includes(`How Maya has improved since the initial evaluation (${await st(d => fmtDate(d), A.d80)}) and since last month`), `a green “Progress” band says what it compares with (${band.replace(/\s+/g, ' ')})`);
  const colors = await st(() => [...document.querySelectorAll('.r-kind-tag')].map(e => getComputedStyle(e).backgroundColor));
  assert(colors.length === 1 && colors[0] === 'rgb(18, 128, 78)', 'the progress tag is green; the evaluation’s is the brand colour');
  const kp = (await p.innerText('#reportPaper .r-kpis')).replace(/\s+/g, ' ');
  assert(kp.includes('Improved since the evaluation') && kp.includes('Improved since last month') && kp.includes('Personal best'), 'its highlights are about progress');
  const lv = await p.innerText('#reportPaper .r-sec:has(.r-lvch)');
  assert(lv.includes('Levels: then and now'.toUpperCase()) || lv.includes('Levels: then and now'), 'its standards section is “Levels: then and now”');
  const cmjRow = (await p.innerText('#reportPaper .r-lvch tr:has-text("Jump height")')).replace(/\s+/g, ' ');
  assert(cmjRow.includes('11.0 in') && cmjRow.includes('Average') && cmjRow.includes('14.6 in') && cmjRow.includes('Good') && cmjRow.includes('▲ Up 1 level'), `CMJ: Average at the evaluation → Good now, up 1 level (${cmjRow})`);
  assert((await p.innerText('#reportPaper .r-lvsum')).includes('Since the initial evaluation: 1 test up a level'), 'with a one-line summary');
  const hint = await p.innerText('.rep-kind');
  assert(hint.includes('A progress report shows the change over time') && await p.locator(`.rep-kind a[href="#/evalreport/${A.e1}"]`).count() === 1, 'the settings say what it is and link to the initial evaluation report');
  assert(await fits(), 'fits the iPhone screen');
  await p.locator('#reportPaper .report').screenshot({ path: SP + '/v124-progress.png' });

  console.log('== Wording follows the data');
  await st(id => upsert('tests', { athleteId: id, date: addDays(today(), -120), sides: {}, m: { sprint10: 2.2 } }), A.aid);   // a test before the evaluation
  await p.goto(BASE + '#/dashboard'); await p.waitForTimeout(150);
  await p.goto(BASE + `#/reports?athlete=${A.aid}`); await p.waitForTimeout(400);
  assert((await p.innerText('#reportPaper .r-kind.prog')).includes('since the first test and since last month'), 'when a test came before the evaluation, it says “since the first test”, like the table');
  await p.selectOption('select[data-change=repBaseline]', 'period'); await p.waitForTimeout(300);
  assert((await p.innerText('#reportPaper .r-kind.prog')).includes('since the start of this period'), 'and “since the start of this period” for that choice');

  console.log('== A narrow preview on a Mac adapts like a phone');
  const mac = await browser.newContext({ viewport: { width: 1180, height: 900 } });
  const q = await mac.newPage();
  q.on('pageerror', e => errors.push(e.message));
  await q.goto(BASE); await q.waitForSelector('.modal'); await q.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]'); await q.waitForTimeout(400);
  const aid2 = await q.evaluate(() => {
    const a = upsert('athletes', { firstName: 'Kai', lastName: 'Ward', sex: 'M', dob: '2009-04-04', archived: false });
    upsert('tests', { athleteId: a.id, date: addDays(today(), -60), sides: {}, evaluation: true, m: { sprint10: 1.95, cmj: 40 } });
    upsert('tests', { athleteId: a.id, date: addDays(today(), -3), sides: {}, m: { sprint10: 1.85, cmj: 44 } });
    return a.id;
  });
  await q.goto(BASE + `#/reports?athlete=${aid2}`); await q.waitForTimeout(500);
  const nar = await q.evaluate(() => ({ w: Math.round(document.querySelector('#reportPaper .report').getBoundingClientRect().width), head: getComputedStyle(document.querySelector('#reportPaper .r-cmp thead')).display, over: document.querySelector('.report-preview').scrollWidth - document.querySelector('.report-preview').clientWidth }));
  assert(nar.w <= 640 && nar.head === 'none' && nar.over <= 1, `the report in a ${nar.w} px preview stacks its table instead of running off the side`);
  await mac.close();

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
