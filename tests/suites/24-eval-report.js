// Performance HQ end-to-end tests — v1.19: the evaluation report (high-school standards by sex and age,
// numbers and levels only, no AI) and the trimmed evaluation (no asymmetry, calf push or 10 yd build fly)
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
  const A = await st(() => {
    const dob = addDays(today(), -Math.round(16.4 * 365.25));
    const sam = upsert('athletes', { firstName: 'Sam', lastName: 'Rivera', sex: 'M', dob, sport: 'Football', archived: false });
    const kid = upsert('athletes', { firstName: 'Kai', lastName: 'Young', sex: 'M', dob: addDays(today(), -Math.round(12.5 * 365.25)), archived: false });
    const nos = upsert('athletes', { firstName: 'Noor', lastName: 'Ali', sex: '', dob, archived: false });
    S.settings.imtpBasis = 'gross';
    return { sam: sam.id, kid: kid.id, nos: nos.id };
  });

  console.log('== Enter the evaluation → the report');
  await p.goto(BASE + `#/athlete/${A.sam}/evaluation`); await p.waitForTimeout(300);
  await p.click('.top-actions [data-act=newEval]'); await p.waitForTimeout(300);
  const fill = async (k, vals) => { for (let i = 0; i < vals.length; i++) await p.fill(`.modal [data-tr=${k}][data-i="${i}"]`, String(vals[i])); };
  await p.fill(`${top} >> input[name=bm]`, '165');
  await fill('sprint10yd', ['1.70', '1.66']); await fill('fly10yd', ['1.05', '1.02']); await fill('proAgility', ['4.62', '4.70']);
  await fill('cmj', ['20', '20.4', '19.6']); await fill('cmjPF', ['2100', '2150', '2120']); await fill('sj', ['17.2', '17.4', '17.0']); await fill('imtpPF', ['2700', '2750', '2720']);
  await p.fill('.modal [data-one=rsiMod]', '0.40'); await p.fill('.modal [data-one=ttt]', '0.80'); await p.fill('.modal [data-one=brakeRfd]', '11000');
  await p.click('.modal [data-ms=ohs][data-v="4"]'); await p.fill('.modal [data-msn=ohs]', 'Knees cave slightly');
  await submit(); await p.waitForTimeout(600);
  assert(/#\/evalreport\//.test(p.url()), 'saving the evaluation opens its report');
  const tid = p.url().split('/').pop();
  let rep = await p.innerText('#evalRepView');
  assert(rep.includes('Evaluation Report') && rep.includes('Sam Rivera') && rep.includes('Age 16') && rep.includes('Male') && rep.includes('Football'), 'header: name, sport, age at the evaluation, sex');
  assert(rep.includes('Age 16 at the evaluation: graded against') && rep.includes('high-school standards for boys aged 14–18'), 'says which standards and age it uses');
  const rowOf = async label => p.$$eval('#evalRepView tr', (trs, l) => (trs.find(tr => tr.cells[0]?.childNodes[0]?.textContent.trim() === l) || {}).innerText || '', label);
  const cmj = await rowOf('CMJ height');
  assert(cmj.includes('20.0 in') && cmj.includes('Good') && cmj.includes('Average 15–18 in · Good 19–22 in · Elite 23+ in'), `CMJ graded for boys, with the bands (“${cmj.replace(/\s+/g, ' ')}”)`);
  const ttt = await rowOf('Time to takeoff');
  assert(/Average/.test(ttt) && ttt.includes('lower is better') && (await p.innerHTML('#evalRepView')).includes('Provisional standard'), 'lower-is-better and provisional standards are marked');
  const sprint = await rowOf('10 yd sprint');
  assert(sprint.includes('1.66 s') && sprint.includes('No standard'), 'results without a standard still show, fastest trial');
  const imtp = await rowOf('Peak force');
  assert(imtp.includes('2,723 N') && imtp.includes('Good'), 'IMTP peak force graded (gross)');
  const counts = await p.$$eval('#evalRepView .r-kpi', ks => ks.map(k => k.innerText.replace(/\s+/g, ' ')));
  const graded = await st(id => { const t = getRec('tests', id); const D = evalReportData(getAthlete(t.athleteId), t); return D.graded.filter(x => !x.r.target).length; }, tid);
  assert(counts.length === 4 && counts.reduce((s, c) => s + parseInt(c, 10), 0) === graded && counts[0].endsWith('Elite') && counts[3].endsWith('Poor'), `level counts (${counts.join(', ')})`);
  assert(rep.includes('Knees cave slightly') && rep.includes('4 / 5'), 'the movement screen with your own notes');
  assert(!/Write with AI|Training priority|Focus for the next|Assessment|tendency/i.test(rep) && await p.locator('[data-act=repAi]').count() === 0, 'no AI text and no conclusions');
  assert(!/asymmetry|calf|10 yd build \+ 10 yd fly/i.test(rep), 'no asymmetry, calf push or 10 yd build + 10 yd fly');
  assert(await fits(), 'the report fits the iPhone screen');
  await p.screenshot({ path: SP + '/v119-eval-report.png', fullPage: true });

  console.log('== Coach’s notes, print, edit');
  assert(!rep.includes('Coach’s notes'), 'no notes section until you write one');
  await p.fill('[data-input=evalRepNotes]', 'Strong first evaluation. Retest in 8 weeks.'); await p.waitForTimeout(700);
  assert((await st(id => getRec('tests', id).reportNotes, tid)) === 'Strong first evaluation. Retest in 8 weeks.' && (await p.innerText('#evalRepView')).includes('Retest in 8 weeks'), 'your notes are saved and printed on the report');
  await st(() => { window.print = () => { window.__printed = document.querySelector('#printRoot')?.innerText || ''; }; });
  await p.click('[data-act=evalRepPrint]'); await p.waitForTimeout(300);
  assert((await st(() => window.__printed || '')).includes('Evaluation Report'), 'Print / PDF prints just the report');
  await p.click('#view [data-act=newEval]'); await p.waitForTimeout(300);
  await p.fill('.modal [data-tr=cmj][data-i="0"]', '23'); await p.fill('.modal [data-tr=cmj][data-i="1"]', '23'); await p.fill('.modal [data-tr=cmj][data-i="2"]', '23.3');
  await submit(); await p.waitForTimeout(500);
  assert(p.url().endsWith(`#/evalreport/${tid}`) && (await rowOf('CMJ height')).includes('Elite'), 'editing from the report updates it in place');
  await p.goto(BASE + `#/athlete/${A.sam}/evaluation`); await p.waitForTimeout(300);
  await p.click(`#view a[href="#/evalreport/${tid}"]`); await p.waitForTimeout(400);
  assert(p.url().endsWith(`#/evalreport/${tid}`), 'the Report button in the evaluation history opens it again');

  console.log('== Old evaluations, other ages, no sex');
  const old = await st(id => upsert('tests', { athleteId: id, date: addDays(today(), -40), evaluation: true, isoType: 'IMTP', sides: {}, bodyMassKg: 75, m: { cmj: 45, brakeAsym: 12, propAsym: 8, calfIsoL: 1500, calfIsoR: 1400, fly10yd10: 1.0, imtpAsym: 5 } }).id, A.sam);
  await p.goto(BASE + `#/evalreport/${old}`); await p.waitForTimeout(400);
  rep = await p.innerText('#evalRepView');
  assert(rep.includes('CMJ height') && !/asymmetry|calf|10 yd build/i.test(rep), 'an older evaluation’s asymmetry, calf push and 10 yd build results stay saved but are not on the report');
  assert(await st(id => getRec('tests', id).m.calfIsoL === 1500, old), 'and they are still saved');
  const kidT = await st(id => upsert('tests', { athleteId: id, date: today(), evaluation: true, isoType: 'IMTP', sides: {}, m: { cmj: 40 } }).id, A.kid);
  await p.goto(BASE + `#/evalreport/${kidT}`); await p.waitForTimeout(400);
  rep = await p.innerText('#evalRepView');
  assert(rep.includes('Age 12 at the evaluation') && rep.includes('reference only') && await p.locator('#evalRepView .r-pill.ref').count() >= 1, 'outside ages 14–18 the levels are a reference only');
  const nosT = await st(id => upsert('tests', { athleteId: id, date: today(), evaluation: true, isoType: 'IMTP', sides: {}, m: { cmj: 40 } }).id, A.nos);
  await p.goto(BASE + `#/evalreport/${nosT}`); await p.waitForTimeout(400);
  assert((await p.innerText('#evalRepView')).includes('Sex isn’t on the profile') && (await rowOf('CMJ height')).includes('Needs sex on the profile') && (await p.innerText('#view .banner')).includes('sex'), 'without sex on the profile the report says so instead of guessing');
  assert(await st(() => normalizeState({ tests: [{ id: 't1', date: '2026-01-01', m: {}, reportNotes: 'x'.repeat(5000) }] }).tests[0].reportNotes.length === 4000), 'notes are checked on load');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
