// Performance HQ end-to-end tests — v1.13: importing past OVR Force, OVR Jump and OVR Sprint data
// (several files at once, rows sent to the right test, trials scored like the app, no duplicates, undo),
// and OVR Jump (flight time) results kept apart from force-plate results
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const near = (a, b, t = 0.01) => Math.abs(a - b) <= t;
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
  const step = () => p.innerText('#impStep');
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(700);

  const FORCE = SP + '/OVR_Force_export.csv', JUMP = SP + '/Liam_Carter_OVR_Jump.csv', SPRINT = SP + '/OVR_Sprint_export.csv';
  fs.writeFileSync(FORCE, ['Athlete,Date,Test Type,Side,Jump Height (in),RSI-mod,Peak Force (N),Peak Power (W),Body Weight (lbs),Force at 100ms (N)',
    '"Carter, Liam",09/12/2026,CMJ,,17.0,0.42,1600,3500,154,', '"Carter, Liam",09/12/2026,CMJ,,17.4,0.44,1620,3550,154,',
    '"Carter, Liam",09/12/2026,Squat Jump,,15.0,,1500,3300,154,', '"Carter, Liam",09/12/2026,IMTP,,,,1500,,154,700', '"Carter, Liam",09/12/2026,IMTP,,,,1540,,154,720',
    '"Carter, Liam",09/12/2026,Single Leg IMTP,L,,,900,,154,', '"Carter, Liam",09/12/2026,Single Leg IMTP,R,,,1000,,154,', '"Carter, Liam",09/12/2026,Single Leg IMTP,,,,950,,154,',
    'Nora Diaz,2026-09-12,CMJ,,14.0,0.38,1200,2400,128,', 'Nora Diaz,2026-09-12,Isometric Squat,,,,1900,,128,',
    'Sam Session,2026-09-13,CMJ,,15.5,0.40,1300,2600,140,', 'New Person,09/13/2026,Countermovement Jump,,16.0,0.40,1400,3000,150,'].join('\n'));
  fs.writeFileSync(JUMP, ['Date,Mode,Jump Height (in),Flight Time (ms),Contact Time (ms),RSI',
    '2026-08-01,Vertical,20.0,,,', '2026-08-01,Vertical,20.4,,,', '2026-08-01,RSI,,,210,2.10', '2026-09-01,Vertical,,640,,'].join('\n'));
  fs.writeFileSync(SPRINT, ['Name,Date,Test,Distance,Time (s),Speed (mph)',
    'Liam Carter,2026-09-20,40 yd dash,10,1.75,', 'Liam Carter,2026-09-20,40 yd dash,20,2.95,', 'Liam Carter,2026-09-20,40 yd dash,40,5.10,',
    'Liam Carter,2026-09-20,Flying 10,10,1.05,19.5', 'Liam Carter,2026-09-20,Pro agility,,4.60,', 'Liam Carter,2026-09-20,60 yd,60,7.20,'].join('\n'));
  const ids = await st(() => {
    const yr = n => addDays(today(), -Math.round(n * 365.25));
    const mk = o => upsert('athletes', { archived: false, ...o }).id;
    const liam = mk({ firstName: 'Liam', lastName: 'Carter', sex: 'M', dob: yr(16.3) }), nora = mk({ firstName: 'Nora', lastName: 'Diaz', sex: 'F', dob: yr(15.2) }), sam = mk({ firstName: 'Sam', lastName: 'Session', sex: 'M', dob: yr(16) });
    const manual = upsert('tests', { athleteId: nora, date: '2026-09-12', sides: {}, isoType: 'IMTP', m: { sprint10: 1.9 }, notes: 'typed in' }).id;
    upsert('tests', { id: 'wkS~fp', athleteId: sam, date: '2026-09-13', sides: {}, isoType: 'IMTP', m: { cmj: 15.0 * 2.54 }, workoutId: 'wkS', notes: 'Logged in session' });
    return { liam, nora, sam, manual };
  });

  console.log('== Recognising OVR columns and tests');
  const g = await st(() => ({
    cols: ['Flight Time (ms)', 'Distance', 'Time (s)', 'Side', '20 yd', 'Flying 10 m', '5 m', 'Speed (mph)', 'Mode', 'Contact Time (ms)', 'RSI'].map(guessColumn).join(','),
    kinds: ['Vertical', 'Squat Jump', 'Depth Jump', '10/5 Hops', 'Drop Landing', 'IMTP', 'Isometric Squat', 'Single Leg IMTP', 'Calf Iso', '40 yd dash', 'CMJ', 'Countermovement Jump', 'Pogo'].map(impKindOf).join(','),
    dates: ['13/09/2026', '09/13/2026', '2026-09-13 15:30', 'Sep 13, 2026'].map(parseDateAny).join(','),
    sp: [['10', 'yd', '40 yd dash'], ['40', 'yd', '40 yd dash'], ['20', 'yd', ''], ['10', 'm', 'Flying 10'], ['', 'yd', 'Pro agility'], ['60', 'yd', '60 yd'], ['30', 'm', '']].map(x => impSprintKey(...x)).join(','),
    names: ['Carter, Liam', 'liam carter', 'L Carter', 'Liam C', 'Nora'].map(n => impMatch(impName(n))?.firstName || '-').join(','),
  }));
  assert(g.cols === '_flight,_dist,_time,_side,sprint20yd,fly10,sprint5,,_type,djGct,djRsi', `OVR Jump and OVR Sprint headers recognised (${g.cols})`);
  assert(g.kinds === 'abk,sj,dj,hop,land,imtp,isq,slimtp,calf,sprint,cmj,cmj,hop', `test types recognised (${g.kinds})`);
  assert(g.dates === '2026-09-13,2026-09-13,2026-09-13,2026-09-13', 'dates read as month/day, or day/month when it can only be that');
  assert(g.sp === 'sprint10yd,sprint40yd,sprint20yd,fly10,proAgility,,sprint30', `sprint distance + time rows map to the right test (${g.sp})`);
  assert(g.names === 'Liam,Liam,Liam,Liam,Nora', 'names matched: “Last, First”, case, initials, first name only');

  console.log('== Several files at once');
  await p.goto(BASE + '#/athletes'); await p.waitForTimeout(250);
  await p.click('.top-actions [data-act=importCsv]'); await p.waitForTimeout(200);
  assert((await step()).includes('several files at once'), 'the import takes several files');
  await p.setInputFiles('.modal [data-file]', [FORCE, JUMP]); await p.waitForTimeout(400);
  const devs = await p.$$eval('[data-fdev]', els => els.map(e => e.value));
  assert(devs.join('|') === 'OVR Force|OVR Jump', `each file’s device is recognised (${devs.join(', ')})`);
  assert((await p.inputValue('[data-fath="1"]')) === ids.liam && await p.locator('[data-fath="0"]').count() === 0, 'a file without a name column is matched to the athlete in its file name');
  const maps = await p.$$eval('[data-map]', els => els.map(e => e.value));
  assert(maps.join(',') === '_name,_date,_type,_side,cmj,rsiMod,cmjPF,cmjPP,_bm,imtpF100,_type,_flight,djGct,djRsi', `columns from both files matched (${maps.join(',')})`);
  assert((await p.inputValue('[data-agg]')) === 'auto', 'trials scored as in the app by default (force plate averaged, sprints best)');
  assert(await fits(), 'columns step fits the iPhone screen');
  await p.screenshot({ path: SP + '/v113-import-columns.png', fullPage: true });
  await submit(); await p.waitForTimeout(300);
  const s3 = await step();
  assert(s3.includes('Vertical') && s3.includes('Single Leg IMTP') && s3.includes('Isometric Squat'), 'step 3 lists the test types found');
  assert((await p.inputValue('select[data-kind="Vertical"]')) === 'abk', '“Vertical” is read as the arm-swing jump unless changed');
  await p.selectOption('select[data-kind="Vertical"]', 'cmj');
  const nm = await p.$$eval('[data-name]', els => els.map(e => `${e.dataset.name}=${e.options[e.selectedIndex].text}`));
  assert(nm.includes('Liam Carter=Liam Carter') && nm.includes('New Person=+ Create new athlete') && nm.includes('Sam Session=Sam Session'), 'names matched to athletes, new ones created');
  await submit(); await p.waitForTimeout(300);
  const pv = await step();
  assert(/Ready to import 7 test days for 4 athletes \(1 new\)/.test(pv), `preview counts (${pv.split('\n')[0]})`);
  assert(pv.includes('OVR Force · 5') && pv.includes('OVR Jump · 2') && pv.includes('1 single-leg row without a left/right side'), 'preview shows the devices and what will be skipped');
  assert(await fits(), 'preview fits the iPhone screen');
  await submit(); await p.waitForTimeout(500);
  assert((await p.innerText('.modal h2')) === 'Import complete' && (await p.innerText('.modal')).includes('1 new'), 'a summary of what changed');

  console.log('== Results');
  const R = await st(({ liam, nora, sam, manual }) => {
    const L = getRec('tests', `imp~${liam}~2026-09-12~force`), tm = L ? testMetrics(L) : {};
    const J1 = getRec('tests', `imp~${liam}~2026-08-01~jump`), J2 = getRec('tests', `imp~${liam}~2026-09-01~jump`);
    const N = getRec('tests', manual), NQ = getRec('tests', `imp~${nora}~2026-09-12~force~isq`), SS = getRec('tests', `imp~${sam}~2026-09-13~force`), sess = getRec('tests', 'wkS~fp');
    const np = S.athletes.find(a => a.firstName === 'New' && a.lastName === 'Person');
    return { L, tm, J1, J2, N, NQ, SS, sess, np: !!np, npT: np ? testsFor(np.id).length : 0 };
  }, ids);
  const L = R.L;
  assert(L && L.device === 'OVR Force' && near(L.m.cmj, 17.2 * 2.54) && near(L.m.sj, 15 * 2.54) && L.m.cmjPF === 1610 && near(L.m.rsiMod, 0.43, 1e-9) && L.m.cmjPP === 3525, 'CMJ trials averaged; the squat-jump row gave only its height');
  assert(L.m.imtpPF === 1520 && L.m.imtpF100 === 710 && L.m.slImtpL === 900 && L.m.slImtpR === 1000 && L.trials.cmj.length === 2, 'IMTP rows → IMTP, single-leg rows → left/right; trials kept');
  assert(near(L.bodyMassKg, 154 / 2.2046226218) && near(R.tm.eur, 17.2 / 15, 1e-6) && near(R.tm.dsi, 1610 / 1520, 1e-6) && near(R.tm.slImtpAsym, 10, 1e-9), 'body weight lb → kg; EUR, DSI and single-leg asymmetry work from the import');
  assert(R.J1 && R.J1.device === 'OVR Jump' && near(R.J1.m.cmj, 20.2 * 2.54) && R.J1.m.djGct === 0.21 && R.J1.m.djRsi === 2.1, 'OVR Jump file: CMJ heights averaged, RSI and contact time');
  assert(R.J2 && near(R.J2.m.cmj, 9.81 * 0.64 * 0.64 / 8 * 100, 0.001), `a flight time gives the height (640 ms → ${(R.J2.m.cmj / 2.54).toFixed(2)} in)`);
  assert(R.N.m.cmj === 14 * 2.54 && R.N.m.sprint10 === 1.9 && R.NQ && R.NQ.isoType === 'ISQ' && R.NQ.m.imtpPF === 1900, 'results add to a hand-entered test that day; the isometric squat gets its own test');
  assert(R.sess.m.cmj === 15 * 2.54 && Object.keys(R.sess.m).length === 1 && R.SS && R.SS.m.cmj == null && R.SS.m.cmjPF === 1300, 'a test logged in a session keeps its numbers; the import adds only what it lacked');
  assert(R.np && R.npT === 1, 'the new athlete is created with their results');

  console.log('== New athletes’ details');
  await p.click('.modal [data-imp-details]'); await p.waitForTimeout(250);
  await p.selectOption('.modal [data-isex]', 'M'); await p.fill('.modal [data-idob]', '05/05/2010');
  await submit(); await p.waitForTimeout(300);
  const np = await st(() => S.athletes.find(a => a.firstName === 'New' && a.lastName === 'Person'));
  assert(np.sex === 'M' && np.dob === '2010-05-05', 'sex and birth date for new athletes on one screen');

  console.log('== OVR Jump heights stay apart from force-plate heights');
  const sep = await st(({ liam }) => {
    const a = getAthlete(liam), tr = metricTrend(liam, 'cmj'), stdv = stdLatest(a, 'cmj');
    return { trN: tr.n, trDir: tr.dir, std: stdv?.x, lb: lbEntries('cmj').filter(e => e.aid === liam).length, lbft: lbEntries('ft:cmj').filter(e => e.aid === liam).length,
      def: lbMetricDefs().find(d => d.key === 'ft:cmj')?.label, slots: [...prBests(liam).keys()].filter(k => /^cmj(\|ft)?$/.test(k)).sort().join(','), kinds: S.settings.importKinds, pr: prLabel([...prBests(liam).values()].find(x => x.slot === 'cmj|ft')) };
  }, ids);
  assert(sep.trN === 1 && sep.trDir === 'new', 'the trend compares force-plate CMJs only (no false “decline” from 20 in on OVR Jump to 17 in on the plate)');
  assert(sep.std === 17.2, 'the force-plate standards grade the force-plate height, not the OVR Jump one');
  assert(sep.lb === 1 && sep.lbft === 2 && sep.def === 'CMJ height (OVR Jump)', 'the leaderboard ranks OVR Jump heights separately');
  assert(sep.slots === 'cmj,cmj|ft' && sep.pr === 'CMJ height (OVR Jump)', 'PRs are kept per method');
  assert(sep.kinds.Vertical === 'cmj' && sep.kinds.IMTP === 'imtp', 'your test-type choices are remembered for the next import');
  await p.goto(BASE + `#/athlete/${ids.liam}/testing`); await p.waitForTimeout(400);
  const tv = await p.innerText('#view');
  assert(tv.includes('CMJ height (OVR Jump)') && tv.includes('OVR Jump') && tv.includes('OVR Force'), 'Testing tab: a separate OVR Jump card, and each test shows its device');
  assert(await p.locator('.top-actions [data-act=importCsv][data-a]').count() === 1, 'the Testing tab has its own Import button');
  await p.goto(BASE + `#/reports?athlete=${ids.liam}`); await p.waitForTimeout(400);
  await p.selectOption('select[data-change=repPeriod]', 'all'); await p.waitForTimeout(300);
  const rep = await p.locator('.report .r-sec', { hasText: 'Performance testing' }).innerText();
  assert(rep.includes('CMJ height (OVR Jump)') && /CMJ height\s+17\.2 in/.test(rep), 'the report shows OVR Jump and force-plate heights as separate rows');

  console.log('== Importing again changes nothing');
  const n0 = await st(() => S.tests.length);
  await p.goto(BASE + '#/athletes'); await p.waitForTimeout(250);
  await p.click('.top-actions [data-act=importCsv]'); await p.waitForTimeout(200);
  await p.setInputFiles('.modal [data-file]', [FORCE, FORCE]); await p.waitForTimeout(400);
  await submit(); await p.waitForTimeout(250); await submit(); await p.waitForTimeout(300);
  const again = await step();
  assert(/already imported \(no change\)/.test(again) && again.includes('duplicate row'), `the same rows again: no change, duplicates counted once (${again.split('\n')[0]})`);
  await submit(); await p.waitForTimeout(400);
  assert((await st(() => S.tests.length)) === n0, 'no new tests made');
  await submit(); await p.waitForTimeout(200);

  console.log('== OVR Sprint, and undo');
  await p.click('.top-actions [data-act=importCsv]'); await p.waitForTimeout(200);
  await p.setInputFiles('.modal [data-file]', SPRINT); await p.waitForTimeout(400);
  assert((await p.inputValue('[data-fdev="0"]')) === 'OVR Sprint', 'sprint file recognised');
  await submit(); await p.waitForTimeout(250); await submit(); await p.waitForTimeout(300);
  assert((await step()).includes('1 sprint row with a distance the app doesn’t track'), 'a 60 yd sprint is flagged, not guessed');
  await submit(); await p.waitForTimeout(400);
  const spr = await st(({ liam }) => { const t = getRec('tests', `imp~${liam}~2026-09-20~sprint`); return t ? { m: t.m, dev: t.device, vmax: testMetrics(t).vmax } : null; }, ids);
  assert(spr && spr.dev === 'OVR Sprint' && spr.m.sprint10yd === 1.75 && spr.m.sprint20yd === 2.95 && spr.m.sprint40yd === 5.1 && spr.m.fly10yd === 1.05 && spr.m.proAgility === 4.6, 'splits and finish of the 40, the flying 10 and the pro agility saved');
  assert(near(spr.vmax, 9.144 / 1.05, 1e-6), 'max velocity from the flying 10 yd');
  await p.click('.modal [data-imp-undo]'); await p.waitForTimeout(150);
  await p.click('.dlg-actions button[data-i="0"]'); await p.waitForTimeout(300);
  assert((await st(({ liam }) => getRec('tests', `imp~${liam}~2026-09-20~sprint`), ids)) === null, 'Undo removes what the import added');

  console.log('== Device on hand-entered and team tests');
  await p.goto(BASE + `#/athlete/${ids.liam}/testing`); await p.waitForTimeout(300);
  await p.click('.top-actions [data-act=newTest]'); await p.waitForTimeout(250);
  assert(await p.locator('.modal select[name=device]').count() === 1, 'a test typed in can say which device it was measured with');
  await p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]'); await p.waitForTimeout(150);
  const tt = await st(({ liam }) => {
    const s = upsert('teamtests', { teamId: '', name: 'Jump day', date: today(), keys: ['cmj'], n: { cmj: 2 }, score: { cmj: 'avg' }, athleteIds: [liam], absentIds: [], done: false, device: 'OVR Jump' });
    const rec = ttSave(s, liam, { cmj: [50, 51] }, null);
    return { dev: rec.device, ft: lbEntries('ft:cmj').filter(e => e.aid === liam).length, clean: cleanRecord('teamtests', { id: 'x', device: 'Bad' }).device };
  }, ids);
  assert(tt.dev === 'OVR Jump' && tt.ft === 3 && tt.clean === '', 'a team test day on OVR Jump tags its results as OVR Jump');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
