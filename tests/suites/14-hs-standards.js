// Performance HQ end-to-end tests — high-school force-plate standards: grading rules, meters, percentiles, leaderboard peak power, Force Plate AI
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
  const submit = () => p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]');
  const st = (fn, a) => p.evaluate(fn, a);
  const fits = async () => (await st(() => document.documentElement.scrollWidth)) <= 391;
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(700);

  console.log('== Grading rules, checked against every band edge in the chart');
  const edges = await st(() => {
    const bad = [];
    HS_STD.forEach(s => ['M', 'F'].forEach(sx => {
      const b = s[sx], L = x => stdLevel(s, sx, x), d = 1e-3;
      [1, 2].forEach(i => { if (L(b[i][0]) !== i || L(b[i][1]) !== i) bad.push(`${s.key} ${sx} band ${i}`); });
      if (s.dir === 1) { if (L(b[3][0]) !== 3 || L(b[1][0] - d) !== 0 || L(b[0][1] - d) !== 0) bad.push(`${s.key} ${sx} ends`); }
      else if (L(b[3][1] - d) !== 3 || L(b[3][1]) !== 2 || L(b[0][0] + d) !== 0) bad.push(`${s.key} ${sx} ends`);
    }));
    return { bad, n: HS_STD.length };
  });
  assert(edges.n === 15 && !edges.bad.length, `all 15 metrics × boys/girls: every printed range lands in its own level (${edges.bad.join(', ') || 'no mismatches'})`);
  const spot = await st(() => [
    ['cmj', 'M', 23 * 2.54, 3], ['cmj', 'M', 22.9 * 2.54, 2], ['cmj', 'M', 18.5 * 2.54, 1], ['cmj', 'M', 14.5 * 2.54, 0], ['cmj', 'F', 18 * 2.54, 3], ['cmj', 'F', 11 * 2.54, 1],
    ['rsiMod', 'M', 0.46, 3], ['rsiMod', 'F', 0.36, 3], ['rsiMod', 'F', 0.244, 1],
    ['ttt', 'M', 0.499, 3], ['ttt', 'M', 0.50, 2], ['ttt', 'M', 0.87, 0], ['ttt', 'F', 0.55, 2], ['ttt', 'F', 0.549, 3],
    ['cmjRelPP', 'M', 66, 3], ['cmjRelPP', 'F', 55, 3], ['brakeRfd', 'M', 15000, 3], ['brakeRfd', 'F', 10500, 3], ['brakeRfd', 'M', 9500, 1],
    ['sj', 'M', 21 * 2.54, 3], ['sj', 'F', 15 * 2.54, 3], ['vj', 'M', 27 * 2.54, 3], ['vj', 'F', 21 * 2.54, 3],
    ['imtpPF', 'M', 3300, 3], ['imtpPF', 'F', 2300, 3], ['imtpPF', 'M', 1400, 0], ['imtpRel', 'M', 4.2 * 9.81, 3], ['imtpRel', 'F', 3.7 * 9.81, 3], ['imtpRel', 'M', 3.3 * 9.81, 2],
    ['imtpF100Rel', 'M', 1.7, 3], ['imtpF100Rel', 'F', 1.4, 3], ['imtpF200Rel', 'M', 2.5, 3], ['imtpF200Rel', 'F', 2.0, 3],
    ['imtpImp', 'M', 401, 3], ['imtpImp', 'M', 255, 1], ['imtpImp', 'F', 281, 3], ['imtpRfd', 'M', 23000, 3], ['imtpRfd', 'F', 15500, 3],
    ['dlPlfRel', 'M', 2.49, 3], ['dlPlfRel', 'M', 3.45, 1], ['dlPlfRel', 'F', 2.19, 3], ['dlTts', 'M', 0.59, 3], ['dlTts', 'F', 0.74, 3], ['dlTts', 'F', 1.346, 0],
  ].filter(([k, sx, v, want]) => stdLevel(STD_BY[k], sx, stdX(STD_BY[k], v)) !== want).map(x => x.join(' ')));
  assert(!spot.length, `chart numbers transcribed: Elite starts, gaps count as the lower level, lower-is-better metrics (${spot.join('; ') || 'all as expected'})`);
  const tg = await st(() => [1.04, 1.05, 1.15, 1.16].map(x => tgtLevel(STD_BY.eur, x)).join(','));
  assert(tg === '0,1,1,2', 'EUR target 1.05–1.15: below / in / in / above');
  const units = await st(() => {
    const r1 = stdLevel(STD_BY.cmj, 'M', stdX(STD_BY.cmj, U.lenIn(15)));
    S.settings.units = 'metric';
    const r2 = stdLevel(STD_BY.cmj, 'M', stdX(STD_BY.cmj, U.lenIn(38)));
    const txt = stdNum(STD_BY.cmj, 19);
    S.settings.units = 'imperial';
    return { r1, r2, txt };
  });
  assert(units.r1 === 1 && units.r2 === 1 && units.txt === '48', 'a 15.0 in jump (and 38 cm in metric) is Average; metric shows the chart’s cm (19 in → 48 cm)');

  console.log('== Relative values and cross-test numbers');
  const ids = await st(() => {
    const yr = n => addDays(today(), -Math.round(n * 365.25));
    const mk = (f, l, sex, age) => upsert('athletes', { firstName: f, lastName: l, sex, dob: yr(age), sport: 'Soccer', archived: false }).id;
    const boy = mk('Liam', 'Carter', 'M', 16.3), girl = mk('Nora', 'Diaz', 'F', 15.2), adult = mk('Sam', 'Old', 'M', 21.4), nosex = mk('Pat', 'Ray', '', 16.1), nobm = mk('Ben', 'Lee', 'M', 17.2);
    upsert('tests', { athleteId: boy, date: addDays(today(), -30), bodyMassKg: 70, sides: {}, isoType: 'IMTP', m: { cmj: 17 * 2.54, sj: 15 * 2.54 } });
    upsert('tests', { athleteId: boy, date: today(), bodyMassKg: 70, sides: {}, isoType: 'IMTP', m: { cmj: 19.5 * 2.54, sj: 17.2 * 2.54, vj: 22 * 2.54, ttt: 0.72, rsiMod: 0.69, cmjPP: 3700, brakeRfd: 9500, cmjPF: 1650, imtpPF: 2600, imtpF100: 1300, imtpF200: 1900, imtpImp: 270, imtpRfd: 14500, dlPlf: 2400, dlTts: 0.95 } });
    upsert('tests', { athleteId: girl, date: today(), bodyMassKg: 58, sides: {}, isoType: 'IMTP', m: { cmj: 14.5 * 2.54, ttt: 0.62, imtpPF: 1700 } });
    upsert('tests', { athleteId: adult, date: today(), bodyMassKg: 80, sides: {}, isoType: 'IMTP', m: { cmj: 24 * 2.54 } });
    upsert('tests', { athleteId: nosex, date: today(), bodyMassKg: 60, sides: {}, isoType: 'IMTP', m: { cmj: 16 * 2.54 } });
    upsert('tests', { athleteId: nobm, date: today(), sides: {}, isoType: 'IMTP', m: { cmj: 18 * 2.54, imtpF100: 1200 } });
    return { boy, girl, adult, nosex, nobm };
  });
  const tm = await st(id => { const t = testsFor(id).pop(), m = testMetrics(t); return { rel: stdX(STD_BY.imtpRel, m.imtpRel), f100: m.imtpF100Rel, f200: m.imtpF200Rel, land: m.dlPlfRel, arm: m.armSwing, bci: m.bci, eur: m.eur }; }, ids.boy);
  const near = (a, b, t = 0.005) => Math.abs(a - b) <= t;
  assert(near(tm.rel, 2.79) && near(tm.f100, (1300 - 686.7) / 686.7) && near(tm.f200, (1900 - 686.7) / 686.7), 'relative IMTP force = (force − body weight) ÷ body weight (2,600 N at 70 kg = 2.79 × BW)');
  assert(near(tm.land, 2400 / 686.7) && near(tm.arm, (22 - 19.5) / 19.5 * 100, 0.01) && near(tm.bci, 2400 / 1650) && near(tm.eur, 19.5 / 17.2), 'landing force ÷ body weight, arm swing gain, braking capacity index and EUR calculated');

  console.log('== Meters on the profile');
  await p.goto(BASE + `#/athlete/${ids.boy}`); await p.waitForTimeout(400);
  let card = await p.innerText('.std-card');
  const rows = await p.locator('.std-card .std-row').count();
  assert(rows === 17 && card.includes('boys · ages 14–18') && await p.locator('.std-card .std-meter').count() === 17, `Overview: a meter for each of the 17 graded results (${rows})`);
  assert(card.includes('19.5 in') && card.includes('Elite from 23 in') && card.includes('3.5 in to go') && card.includes('Good at 0.65 s or less'), 'each meter shows the result, level and what the next level takes');
  const lv = await p.$$eval('.std-card .std-row', rs => rs.map(r => r.querySelector('.std-name').textContent + '=' + r.querySelector('.std-lv').textContent));
  assert(['Jump height=Good', 'mRSI=Elite', 'Time to takeoff=Average', 'Peak propulsive power=Good', 'Relative peak force=Good', 'Force at 100 ms (relative)=Average', 'Peak landing force (relative)=Average', 'Eccentric utilisation ratio=In target', 'Arm swing gain=In target'].every(x => lv.includes(x)), 'levels match the chart for a 16-year-old boy');
  assert(await fits(), 'standards card fits the iPhone screen');
  await p.screenshot({ path: SP + '/v110-standards-card.png', fullPage: true });
  await p.goto(BASE + `#/athlete/${ids.boy}/testing`); await p.waitForTimeout(400);
  const cmjCard = await p.locator('.metric-card').filter({ has: p.locator('.mc-name', { hasText: /^CMJ height$/ }) }).innerText();
  assert(/HS standard · boys/i.test(cmjCard) && cmjCard.includes('Good'), 'Testing tab: the CMJ card has its own meter');
  assert(await p.locator('.metric-card .std-meter').count() >= 15 && await fits(), 'every graded metric card has a meter, and the tab fits the screen');
  await p.goto(BASE + `#/athlete/${ids.girl}`); await p.waitForTimeout(300);
  card = await p.innerText('.std-card');
  assert(card.includes('girls · ages 14–18') && card.includes('14.5 in') && /Jump height\s*14\.5 in\s*Good/.test(card) && /Time to takeoff\s*0\.620 s\s*Good/.test(card), 'girls are graded on the girls’ standards');
  await p.goto(BASE + `#/athlete/${ids.adult}`); await p.waitForTimeout(300);
  assert((await p.innerText('.std-card')).includes('reference only') && await p.locator('.std-card .std-lv.ref').count() === 1, 'outside 14–18: shown for reference only');
  await p.goto(BASE + `#/athlete/${ids.nosex}`); await p.waitForTimeout(300);
  assert((await p.innerText('.std-card')).includes('to Male or Female') && await p.locator('.std-card .std-meter').count() === 0, 'no sex on the profile: asks for it instead of guessing');
  await p.goto(BASE + `#/athlete/${ids.nobm}`); await p.waitForTimeout(300);
  assert((await p.innerText('.std-card')).includes('Add body mass to the test to grade: Force at 100 ms (relative)'), 'relative results without body mass: says what’s needed');

  console.log('== Evaluation form collects the standards metrics');
  await p.goto(BASE + `#/athlete/${ids.boy}/evaluation`); await p.waitForTimeout(300);
  assert((await p.locator('.card').filter({ has: p.locator('h3', { hasText: /^Percentiles$/ }) }).innerText()).includes('Good'), 'Evaluation tab: the level shows under each result in the percentile card');
  await p.click('.top-actions [data-act=newEval]'); await p.waitForTimeout(300);
  const ones = await p.$$eval('.modal [data-one]', els => els.map(e => e.dataset.one));
  assert(['cmjPP', 'imtpF200', 'imtpImp', 'imtpRfd', 'dlPlf', 'dlPlfRel', 'dlTts'].every(k => ones.includes(k)) && await p.locator('.modal [data-tr=vj]').count() === 3, 'peak power, F200, impulse, peak RFD, Abalakov trials and drop landing are in the form');
  await p.fill('.modal [data-tr=cmj][data-i="0"]', '18'); await p.fill('.modal [data-tr=vj][data-i="0"]', '21');
  await p.fill('.modal [data-one=cmjPP]', '3600'); await p.fill('.modal [data-one=imtpF200]', '1800'); await p.click('.modal summary:has-text("Drop landing")'); await p.fill('.modal [data-one=dlTts]', '0.8'); await p.fill('.modal [name=bm]', '154');
  await submit(); await p.waitForTimeout(400);
  const ev = await st(id => { const t = testsFor(id).filter(x => x.evaluation).pop(); return { m: t.m, tm: testMetrics(t) }; }, ids.boy);
  assert(ev.m.cmjPP === 3600 && ev.m.imtpF200 === 1800 && ev.m.dlTts === 0.8 && near(ev.m.vj, 21 * 2.54, 1e-9) && ev.tm.imtpF200Rel > 0 && ev.tm.cmjRelPP > 0 && ev.tm.armSwing > 0, 'saved, with relative power, relative F200 and arm swing gain calculated');

  console.log('== Percentiles show the standard');
  await p.goto(BASE + '#/percentiles?k=cmj'); await p.waitForTimeout(400);
  const pc = await p.innerText('#view');
  assert(await p.locator('.pct-row.has-std').count() >= 5 && /HS standard/i.test(pc), 'each athlete row has an HS standard column');
  const liam = await p.innerText('.pct-row:has-text("Liam Carter")');
  assert(liam.includes('18.0 in') && /Average/.test(liam) && liam.includes('boys 14–18') && await p.locator('.pct-row:has-text("Liam Carter") .std-meter').count() === 1, 'the level and a meter next to the GSP percentile');
  assert(pc.includes('High-school standards · Jump height') && (await p.innerText('.std-m')).includes('23+') && (await p.innerText('.std-m')).includes('18+'), 'the boys’ and girls’ numbers for the test are on the page');
  assert(await fits(), 'percentile page fits the iPhone screen');
  await p.screenshot({ path: SP + '/v110-percentiles.png', fullPage: true });
  await p.goto(BASE + '#/percentiles?k=ttt'); await p.waitForTimeout(300);
  assert((await p.$eval('select[data-change=pctKey]', s => s.value)) === 'ttt' && (await p.innerText('#view')).includes('High-school standards · Time to takeoff'), 'time to takeoff has percentiles and its standard (not ranked on the leaderboard)');

  console.log('== Leaderboard: peak power');
  await p.goto(BASE + '#/leaderboard'); await p.waitForTimeout(300);
  const chips = await p.$$eval('.chips.scroll .chip', cs => cs.map(c => c.textContent.trim()));
  assert(chips.includes('Relative peak power') && chips.includes('Peak power'), 'peak power (W/kg and W) are quick picks on the leaderboard');
  await p.click('.chips.scroll .chip:text-is("Relative peak power")'); await p.waitForTimeout(250);
  const lb = await p.$$eval('.lb-table tbody tr td:nth-child(2)', els => els.map(e => e.textContent.trim()));
  assert(lb.length >= 2 && lb.some(x => x.includes('Liam')), 'relative peak power ranking includes the new results');
  const opts = await p.$$eval('select[data-change=lbKey] option', os => os.map(o => o.value));
  assert(!opts.includes('ttt') && !opts.includes('dlTts') && !opts.includes('dlPlfRel'), 'landing and time-to-takeoff results aren’t ranked as records');

  console.log('== Force Plate AI');
  await p.goto(BASE + '#/fpai/standards'); await p.waitForTimeout(300);
  const fsv = await p.innerText('#view');
  assert(await p.locator('.std-m').count() === 15 && fsv.includes('Eccentric utilisation ratio') && fsv.includes('Arm swing gain') && fsv.includes('counts as the lower level'), 'Standards tab: all 15 metrics with boys and girls, the cross-test targets and how levels are given');
  assert(await fits(), 'standards tab fits the iPhone screen');
  await p.screenshot({ path: SP + '/v110-fpai-standards.png', fullPage: true });
  const ai = await st(id => ({ ctx: athleteContext(id), sys: aiSystemPrompt(), an: fpAnalyze(getAthlete(id)) }), ids.boy);
  assert(ai.sys.includes('boys Poor <14 in, Average 15–18 in, Good 19–22 in, Elite 23+ in') && ai.sys.includes('coach\'s standards'), 'the AI is given the full chart');
  assert(ai.ctx.includes('Countermovement jump Jump height 18.0 in: Average') && ai.an.sections[0].title === 'High-school standards', 'the AI sees the athlete’s levels; the analyzer lists them first');
  await p.goto(BASE + '#/fpai/guide'); await p.waitForTimeout(250);
  await p.click('summary:has-text("Force at 100 ms")'); await p.waitForTimeout(100);
  assert((await p.innerText('details[open]')).includes('Boys: Poor < 0.6 × BW · Average 0.7–1.1 × BW'), 'metric guide shows the standard');

  console.log('== Import');
  const g = await st(() => ['Time to Stabilization (s)', 'Force at 200ms (N)', 'Abalakov Jump Height (cm)', 'Drop Landing Peak Force (N)', 'Jump Height (cm)', 'Peak Landing Force (N)', 'Net Impulse 0-200ms'].map(guessColumn).join(','));
  assert(g === 'dlTts,imtpF200,vj,dlPlf,cmj,peakLandF,imtpImp', `new OVR columns are recognised, existing ones unchanged (${g})`);

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
