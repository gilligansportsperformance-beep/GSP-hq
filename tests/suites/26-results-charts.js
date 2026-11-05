// Performance HQ end-to-end tests — v1.21: every data point for one athlete and one test (#/metric/<id>/<key>),
// opened from the Testing tab, Overview tiles and leaderboard rows; clearer charts (up = better, typical-error band)
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
    const a = upsert('athletes', { firstName: 'Jo', lastName: 'Lane', sex: 'F', dob: '2009-04-04', archived: false });
    const d = n => addDays(today(), -n);
    upsert('tests', { athleteId: a.id, date: d(70), sides: {}, bodyMassKg: 60, m: { cmj: 40, sprint10: 1.90 } });                                         // typed in Testing
    upsert('tests', { athleteId: a.id, date: d(56), sides: {}, evaluation: true, bodyMassKg: 60.5, trials: { cmj: [41, 42, 43] }, m: { cmj: 42, sprint10: 1.86 } });   // an evaluation
    upsert('tests', { athleteId: a.id, date: d(42), sides: {}, teamTestId: 'tt9', m: { cmj: 44, sprint10: 1.84 } });                                        // a team test day
    upsert('tests', { id: `imp~${a.id}~${d(28)}~jump`, athleteId: a.id, date: d(28), sides: {}, m: { cmj: 41.5 } });                                         // imported
    upsert('tests', { athleteId: a.id, date: d(14), sides: {}, notes: 'Added in past results', m: { cmj: 43, sprint10: 1.88 } });                            // past results table
    upsert('tests', { athleteId: a.id, date: d(7), sides: {}, workoutId: 'w1', m: { cmj: 45 } });                                                           // logged in a session
    upsert('tests', { athleteId: a.id, date: d(3), sides: {}, device: 'OVR Jump', m: { cmj: 50 } });                                                        // OVR Jump: kept apart
    return { aid: a.id };
  });

  console.log('== From the Testing tab');
  await p.goto(BASE + `#/athlete/${A.aid}/testing`); await p.waitForTimeout(400);
  const card = p.locator('.metric-card', { has: p.locator('.mc-name', { hasText: /^CMJ height$/ }) });
  assert((await card.locator('.mc-all').innerText()).includes('All 6 results'), 'each test card offers all its results');
  const svgTxt = await card.locator('.chart svg').innerHTML();
  assert(svgTxt.includes('class="band"') && svgTxt.includes('first test ± 4%') && /class="pt-l last"[^>]*>17\.7 in</.test(svgTxt) && !svgTxt.includes('Best '), 'the chart shows the normal-variation band and the latest value (here also the best, so no second label)');
  await card.locator('.mc-all').click(); await p.waitForTimeout(400);
  assert(p.url().endsWith(`#/metric/${A.aid}/cmj`), 'tapping it opens the results page');

  console.log('== Every data point');
  const tiles = await p.$$eval('.mt-tiles .tile', ts => ts.map(t => t.innerText.replace(/\s+/g, ' ')));
  assert(tiles[0].startsWith('Latest 17.7') && tiles[1].startsWith('Best 17.7') && tiles[2].startsWith('First 15.7') && tiles[3].includes('6 results'), `latest, best, first, change since first (${tiles.join(' | ')})`);
  const rows = await p.$$eval('.mt-table tbody tr', trs => trs.map(r => r.innerText.replace(/\s+/g, ' ')));
  assert(rows.length === 6, 'one row per result (the OVR Jump result is kept apart)');
  const src = rows.map(r => (r.match(/(Testing|Evaluation|Team test day|Imported|Past results|Session log)/) || [])[1]);
  assert(src.join(',') === 'Session log,Past results,Imported,Team test day,Evaluation,Testing', `newest first, each says where it came from (${src.join(', ')})`);
  assert(rows[4].includes('16.1 · 16.5 · 16.9') && rows[4].includes('133.4 lb'), 'trials and body mass shown');
  assert(rows[0].includes('Best') && rows[5].includes('First'), 'the best is marked, the first says so');
  const ft = await st(id => metricPointsFor(id, 'ft:cmj').ser.map(x => x.v), A.aid);
  assert(ft.join() === '50', 'OVR Jump results have their own page (ft:cmj)');
  assert(await fits(), 'the page fits the iPhone screen');
  await p.screenshot({ path: SP + '/v121-results.png', fullPage: true });

  console.log('== Correcting a result from its row');
  await p.click('.mt-table tbody tr >> nth=1'); await p.waitForTimeout(300);
  await p.fill(`${top} >> input[name=m_cmj]`, '17.5'); await submit(); await p.waitForTimeout(400);
  assert(p.url().endsWith(`#/metric/${A.aid}/cmj`) && (await p.innerText('.mt-table tbody tr >> nth=1')).includes('17.5 in'), 'tapping a row opens that test; the page updates after saving');

  console.log('== Lower is better: up still means better');
  await p.goto(BASE + `#/metric/${A.aid}/sprint10`); await p.waitForTimeout(400);
  const sp = await st(() => { const svg = document.querySelector('.mt-chart svg'); const pts = [...svg.querySelectorAll('circle[stroke-width="2"]')].map(c => +c.getAttribute('cy')); return { label: svg.querySelector('text.ax-u').textContent, pts, dates: [...svg.querySelectorAll('text')].filter(t => +t.getAttribute('y') > 200 && !t.classList.contains('pt-l')).length }; });
  // results 1.90, 1.86, 1.84, 1.88: the fastest (1.84) is drawn highest
  assert(sp.label === 's · ↑ faster' && sp.pts[2] < sp.pts[1] && sp.pts[1] < sp.pts[3] && sp.pts[3] < sp.pts[0], `the scale is flipped for times (“${sp.label}”): the fastest point is highest`);
  assert(sp.dates >= 2 && (await p.innerHTML('.mt-chart svg')).includes('Best 1.84 s'), 'dates along the bottom; the best (not the latest) is labelled');
  assert(await st(() => niceTicks(1.7000000000000002, 1.9, 5)[0] === 1.7), 'tick maths keeps the first gridline (no gap at the top)');

  console.log('== From the Overview and the leaderboard');
  await p.goto(BASE + `#/athlete/${A.aid}/overview`); await p.waitForTimeout(400);
  // the CMJ tile follows the latest CMJ, which here is the OVR Jump one
  assert(await p.locator(`a.tile[href="#/metric/${A.aid}/ft%3Acmj"]`).count() === 1 && await p.locator(`a.tile[href="#/metric/${A.aid}/sprint10"]`).count() === 1, 'Overview tiles open the results page (OVR Jump results on their own page)');
  await p.click(`a.tile[href="#/metric/${A.aid}/ft%3Acmj"]`); await p.waitForTimeout(400);
  assert((await p.innerText('.topbar h1')).includes('CMJ height (OVR Jump)') && (await p.$$eval('.mt-table tbody tr', r => r.length)) === 1, 'the OVR Jump page lists only OVR Jump results');
  await st(() => { UI.lb = { ...(UI.lb || {}), key: 'cmj', period: 'all', sex: 'all', age: 'all', sport: 'all', archived: true }; });
  await p.goto(BASE + '#/leaderboard'); await p.waitForTimeout(400);
  await p.click(`tr[data-act=lbOpen][data-a="${A.aid}"]`); await p.waitForTimeout(400);
  assert(p.url().endsWith(`#/metric/${A.aid}/cmj`), 'a leaderboard row opens that athlete’s results for the test being ranked');
  await p.goto(BASE + `#/metric/${A.aid}/nope`); await p.waitForTimeout(300);
  assert((await p.innerText('#view')).includes('isn’t available'), 'an unknown test says so');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
