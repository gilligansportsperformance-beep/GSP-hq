// Performance HQ end-to-end tests — v1.27: the athletic profile on the athlete Overview. Every logged test in four
// qualities (Speed, Power, Strength, Reactive & landing) and a Strength × Speed & power quadrant that updates with new
// results. References: the coach's HS standards, else a published percentile table (built-in broad jump: Ortega 2023)
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const near = (a, b, d = 0.05) => a != null && Math.abs(a - b) <= d;
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

  console.log('== The built-in broad jump norms are the published table');
  const nb = await st(() => {
    const t = id => NORMS_BUILTIN.find(x => x.id === id);
    return { n: NORMS_BUILTIN.length, all: NORMS_BUILTIN.every(x => x.metric === 'broad' && x.builtin && x.points.length === 13 && /Br J Sports Med\. 2023;57\(5\):299–310/.test(x.source)),
      b16: t('fitback-slj-M-16').points, g14: t('fitback-slj-F-14').points, g18: t('fitback-slj-F-18').points, b6: t('fitback-slj-M-6').points };
  });
  assert(nb.n === 26 && nb.all, 'girls and boys, ages 6–18: 26 tables of P1–P99, each citing Ortega et al., Br J Sports Med 2023');
  // spot checks against Table 3 of the article
  assert(JSON.stringify(nb.b16.find(x => x[0] === 50)) === '[50,203.4]' && JSON.stringify(nb.g14.find(x => x[0] === 90)) === '[90,191.6]' && JSON.stringify(nb.g18[0]) === '[1,91.1]' && JSON.stringify(nb.b6[12]) === '[99,151.2]', 'values match the article (boys 16 P50 203.4 cm, girls 14 P90 191.6, girls 18 P1 91.1, boys 6 P99 151.2)');

  const A = await st(() => {
    const d = n => addDays(today(), -n);
    const a = upsert('athletes', { firstName: 'Kai', lastName: 'Ward', sex: 'M', dob: addDays(today(), -Math.round(16.5 * 365.25)), massKg: 70, archived: false });
    upsert('tests', { athleteId: a.id, date: d(400), sides: {}, m: { sprint10yd: 1.80 } });                                   // over a year old
    upsert('tests', { athleteId: a.id, date: d(120), sides: {}, isoType: 'IMTP', m: { imtpPF: 3300 } });                      // IMTP 3,300 N gross: Elite (boys)
    upsert('tests', { athleteId: a.id, date: d(60), sides: {}, m: { cmj: 17.0 * 2.54, broad: 203.4 } });                      // CMJ 17.0 in: Average; broad = P50
    upsert('tests', { athleteId: a.id, date: d(10), sides: {}, m: { cmj: 19.0 * 2.54 } });                                    // CMJ 19.0 in: Good
    upsert('tests', { athleteId: a.id, date: d(5), sides: {}, m: { sprint40yd: 5.20 } });
    upsert('tests', { athleteId: a.id, date: d(3), sides: {}, device: 'OVR Jump', m: { cmj: 50 } });                          // flight time: its own row, not graded
    upsert('tests', { athleteId: a.id, date: d(2), sides: {}, isoType: 'ISQ', m: { imtpPF: 4000 } });                         // isometric squat: not an IMTP
    const ex = upsert('exercises', { name: 'Back Squat', category: 'Lower body' });
    upsert('maxes', { athleteId: a.id, exerciseId: ex.id, kg: 140, date: d(20), notes: '' });
    return { aid: a.id };
  });

  console.log('== The quadrant: where Kai stands now');
  await p.goto(BASE + `#/athlete/${A.aid}/overview`); await p.waitForTimeout(500);
  const q = await st(aid => { const r = athQuadrant(getAthlete(aid)); return { x: r.now.x, y: r.now.y, q: r.now.q, n: r.now.n, pts: r.pts.length }; }, A.aid);
  // IMTP Elite at its number: (3 + 0.06) × 25 = 76.5; CMJ 19.0 in Good at its number: 51.5; broad jump at P50 → 37.5
  assert(near(q.x, 76.5) && near(q.q.power, (51.5 + 37.5) / 2) && near(q.y, 44.5) && q.q.speed == null, `strength ${q.x?.toFixed(1)} (Elite), speed & power ${q.y?.toFixed(1)} (Average): standards and the published table on one scale`);
  assert((await p.innerText('.qd-name-now')) === 'Strong, needs speed', 'named “Strong, needs speed”');
  const dot = await st(() => { const c = document.querySelector('.qd-dot'); return [+c.getAttribute('cx'), +c.getAttribute('cy')]; });
  assert(near(dot[0], 40 + 0.765 * 286, 0.2) && near(dot[1], 12 + 0.555 * 286, 0.2), 'the dot sits at those numbers on the chart');
  assert(q.pts === 2 && await p.locator('.qd-old').count() === 1 && (await p.textContent('.qd-now')) === 'NOW', 'a faint trail shows where Kai stood after the earlier test day');
  const reads = (await p.innerText('.qd-reads')).replace(/\s+/g, ' ');
  assert(/Strength Elite 1 test/i.test(reads) && /Speed & power Average 2 tests/i.test(reads), `readouts say the level and how many tests (${reads})`);

  console.log('== The grid lists every test, each with its reference');
  const panel = async k => (await p.innerText(`.qd-panel[data-q=${k}]`)).replace(/\s+/g, ' ');
  const sp = await panel('speed'), pw = await panel('power'), sg = await panel('strength');
  assert(sp.includes('not scored') && sp.includes('40 yd dash') && sp.includes('10 yd sprint') && sp.includes('over a year old') && sp.includes('not counted'), 'Speed lists the sprints, unscored without a published table, and the old 10 yd as “not counted”');
  assert(/CMJ height [^·]+ · HS standard 19\.0 in Good/.test(pw) && /Broad jump [^·]+ · vs boys 16, European youth \(general population\) [\d.]+ in 50th/.test(pw), `Power: CMJ graded on the standards, broad jump placed in the published table (${pw.slice(0, 240)})`);
  const ft = await st(() => [...document.querySelectorAll('.qd-panel[data-q=power] .qd-row')].filter(r => r.querySelector('.qd-name').firstChild.textContent === 'CMJ height (OVR Jump)').map(r => r.querySelector('.qd-ref').innerText.trim()));
  assert(ft.length === 1 && ft[0] === '—', 'OVR Jump (flight time) heights get their own row and no grade');
  assert(/IMTP peak force .* HS standard 3,300 N Elite/.test(sg) && sg.includes('Isometric squat peak force') && /Back Squat 1RM .*2\.00 × BW/.test(sg), 'Strength: IMTP graded; the isometric squat and the tested 1RM (× body weight) listed');
  const trend = await st(() => document.querySelector('.qd-panel[data-q=power] .qd-row .qd-tr')?.className);
  assert(trend === 'qd-tr up', 'CMJ up from 17.0 to 19.0 in shows ▲');
  assert(await p.locator('.qd-panel').count() === 4 && await fits(), 'four panels (Speed, Power, Strength, Reactive & landing) that fit the iPhone screen');
  await p.locator('.qd-card').screenshot({ path: SP + '/v127-profile.png' });

  console.log('== A published sprint table loaded by the coach scores Speed');
  await st(() => {
    S.settings.normTables = [...(S.settings.normTables || []), { id: 'test-40', metric: 'sprint40yd', sex: 'M', ageMin: 14, ageMax: 18, sport: '', level: 'Test table', source: 'Test source for the suite', points: [[5, 5.9], [10, 5.7], [25, 5.45], [50, 5.2], [75, 5.0], [90, 4.85], [95, 4.75]], at: Date.now() }];
    persist(); refresh();
  });
  await p.waitForTimeout(400);
  const q2 = await st(aid => { const r = athQuadrant(getAthlete(aid)); return { y: r.now.y, sp: r.now.q.speed, pts: r.pts.length }; }, A.aid);
  assert(near(q2.sp, 37.5) && near(q2.y, (37.5 + 44.5) / 2) && q2.pts === 3, `the 40 yd at that table's P50 counts: speed & power ${q2.y?.toFixed(1)} = the mean of Speed and Power`);
  assert((await panel('speed')).includes('Average') && /40 yd dash .*vs boys, Test table .*50th/.test(await panel('speed')), 'the Speed panel is scored and the row names the table');

  console.log('== New results move the dot');
  await st(aid => { upsert('tests', { athleteId: aid, date: today(), sides: {}, isoType: 'IMTP', m: { imtpPF: 2000 } }); refresh(); }, A.aid);
  await p.waitForTimeout(400);
  const q3 = await st(aid => athQuadrant(getAthlete(aid)).now.x, A.aid);
  assert(near(q3, (1 + 500 / 800) * 25) && (await p.innerText('.qd-name-now')) === 'Build both', `today's IMTP (2,000 N, Average) replaces the older one: strength ${q3?.toFixed(1)}, now “Build both”`);

  console.log('== When the chart can’t place an athlete, it says why');
  const B = await st(() => {
    const d = n => addDays(today(), -n);
    const nosex = upsert('athletes', { firstName: '<img src=x onerror="window.__qx=1">', lastName: 'Lee', sex: '', dob: '2010-02-02', archived: false });
    upsert('tests', { athleteId: nosex.id, date: d(5), sides: {}, isoType: 'IMTP', m: { imtpPF: 2500, cmj: 45 } });
    const adult = upsert('athletes', { firstName: 'Ana', lastName: 'Ruiz', sex: 'F', dob: addDays(today(), -Math.round(22.4 * 365.25)), archived: false });
    upsert('tests', { athleteId: adult.id, date: d(5), sides: {}, isoType: 'IMTP', m: { imtpPF: 2500, cmj: 45, broad: 200 } });
    return { nosex: nosex.id, adult: adult.id };
  });
  await p.goto(BASE + `#/athlete/${B.nosex}/overview`); await p.waitForTimeout(400);
  const ns = await st(() => ({ wait: !!document.querySelector('.qd-wrap.empty .qd-wait'), why: document.querySelector('.qd-why')?.innerText || '', img: document.querySelectorAll('.qd-card img').length, pw: window.__qx }));
  assert(ns.wait && ns.why.includes('sex to Male or Female') && ns.why.includes('<img') && !ns.img && !ns.pw, 'no sex set: “Not placed yet” and how to fix it (the name is shown as text)');
  await p.goto(BASE + `#/athlete/${B.adult}/overview`); await p.waitForTimeout(400);
  const ad = await st(() => ({ wait: !!document.querySelector('.qd-wait'), why: document.querySelector('.qd-why')?.innerText || '', pw: document.querySelector('.qd-panel[data-q=power]').innerText }));
  assert(ad.wait && ad.why.includes('ages 14–18 and Ana is 22') && ad.pw.includes('reference only') && !/\d+(st|nd|rd|th)\b/.test(ad.pw), 'age 22: the standards are reference only and the youth table (6–18) doesn’t apply');

  console.log('== The Percentiles page shows the built-in table, read-only');
  await p.goto(BASE + '#/percentiles?k=broad'); await p.waitForTimeout(400);
  const row = p.locator('[data-act=viewNorms]');
  assert(await row.count() === 1 && (await row.innerText()).includes('Girls and boys · ages 6–18') && (await row.innerText()).includes('26 tables'), 'one row for the 26 built-in tables, not 26 rows');
  await row.click(); await p.waitForTimeout(300);
  const mv = await st(() => { const m = [...document.querySelectorAll('.modal-wrap')].pop(); return { rows: m.querySelectorAll('.norm-view tbody tr').length, txt: m.innerText, want: fmtNum(pctOut('broad', 203.4), 1) }; });
  assert(mv.rows === 26 && mv.txt.includes('1,345,159') && mv.txt.includes(mv.want) && mv.txt.includes('doi:10.1136/bjsports-2022-106176'), 'the table opens with its source, sample and values (in the coach’s units)');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await st(() => A.editNorm({ dataset: { id: 'fitback-slj-M-16' } })); await p.waitForTimeout(200);
  assert((await p.innerText('.toast-host')).includes('built in'), 'built-in tables can’t be edited');
  assert(await fits(), 'the Percentiles page still fits');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
