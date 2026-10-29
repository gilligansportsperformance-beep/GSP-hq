// Performance HQ end-to-end tests — v1.11: IMTP net/gross force, evidence flags, training priorities,
// needs attention, quick fixes on the profile, level changes, report standards section and Quick Find
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const near = (a, b, t = 0.002) => Math.abs(a - b) <= t;
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
  const hash = () => st(() => location.hash);
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(700);

  const ids = await st(() => {
    const yr = n => addDays(today(), -Math.round(n * 365.25)), T = today();
    const mk = o => upsert('athletes', { archived: false, ...o }).id;
    const boy = mk({ firstName: 'Liam', lastName: 'Carter', sex: 'M', dob: yr(16.3), sport: 'Soccer' });
    const girl = mk({ firstName: 'Nora', lastName: 'Diaz', sex: 'F', dob: yr(15.2), sport: 'Soccer' });
    const kid = mk({ firstName: 'New', lastName: 'Kid', sex: '' });
    const gap = mk({ firstName: 'Gap', lastName: 'Test', sex: 'M', dob: yr(15.5) });
    const tA = upsert('tests', { athleteId: boy, date: addDays(T, -30), bodyMassKg: 70, sides: {}, isoType: 'IMTP', m: { cmj: 17 * 2.54, sj: 15 * 2.54, cmjPF: 1650, imtpPF: 1500 } }).id;
    const tB = upsert('tests', { athleteId: boy, date: T, bodyMassKg: 70, sides: {}, isoType: 'IMTP', m: { cmj: 19.5 * 2.54, sj: 18.9 * 2.54, vj: 22 * 2.54, ttt: 0.95, rsiMod: 0.69, cmjPP: 3700, brakeRfd: 4500, cmjPF: 1650, imtpPF: 1800, imtpF100: 800, imtpF200: 1100, imtpImp: 270, imtpRfd: 14500, dlPlf: 3300, dlTts: 0.95, propAsym: 16 } }).id;
    upsert('tests', { athleteId: girl, date: T, sides: {}, isoType: 'IMTP', m: { cmj: 14.5 * 2.54, imtpPF: 1100 } });
    upsert('tests', { athleteId: gap, date: T, sides: {}, m: { cmjPF: 1400 } });
    // readiness: five normal checks, then clearly down today
    [40, 41, 39, 40, 40].forEach((h, i) => upsert('readiness', { athleteId: boy, date: addDays(T, -15 + i * 3), mode: 'cmj', trials: { cmj: [h] }, m: { cmj: h } }));
    upsert('readiness', { athleteId: boy, date: T, mode: 'cmj', trials: { cmj: [36, 36.4] }, m: { cmj: 36.2 } });
    const team = upsert('teams', { name: 'Varsity Soccer', sex: 'M', athleteIds: [boy, gap] }).id;
    const day = upsert('teamtests', { teamId: team, teamName: 'Varsity Soccer', name: 'Varsity preseason', date: T, keys: ['cmj'], n: 3, score: 'avg', athleteIds: [boy, gap], absentIds: [], done: false }).id;
    delete S.settings.imtpBasis; persist();
    return { boy, girl, kid, gap, tA, tB, team, day };
  });

  console.log('== IMTP force: net or gross');
  const mx = await st(({ boy, tB }) => {
    const t = getRec('tests', tB), a = getAthlete(boy), out = {};
    const read = () => { const m = testMetrics(t); return { basis: imtpBasis(), dsi: m.dsi, rel: stdX(STD_BY.imtpRel, m.imtpRel), f100: m.imtpF100Rel, pf: stdEval(a, 'imtpPF', 1800, t.date, 70), lb: lbEntries('dsi').find(e => e.aid === boy && e.date === t.date)?.v }; };
    out.unset = read();
    S.settings.imtpBasis = 'net'; out.net = read();
    out.noBm = { pf: stdEval(a, 'imtpPF', 1800, t.date, null), gross: imtpGrossOf({ m: { imtpPF: 1800 } }) };
    S.settings.imtpBasis = 'gross'; out.gross = read();
    delete S.settings.imtpBasis;
    const bad = { imtpBasis: 'total' }; cleanSettings(bad);
    out.clean = 'imtpBasis' in bad;
    out.shared = SHARED_SETTINGS.includes('imtpBasis');
    return out;
  }, ids);
  assert(mx.unset.basis === 'gross' && near(mx.unset.dsi, 1650 / 1800) && near(mx.unset.rel, 1.62, 0.006) && mx.unset.pf.lv === 1, 'not chosen yet: forces read as gross (DSI 1650 ÷ 1800 = 0.92; 1,800 N is Average)');
  assert(near(mx.net.dsi, 1650 / (1800 + 70 * 9.81)) && near(mx.net.rel, 2.62, 0.006) && near(mx.net.f100, 800 / (70 * 9.81)), 'net: DSI uses gross ÷ gross (0.66), relative force = net ÷ body weight (2.62 × BW)');
  assert(mx.net.pf.x === 2487 && mx.net.pf.lv === 2, 'net: IMTP peak force is graded as total force (1,800 + 687 = 2,487 N → Good)');
  assert(mx.noBm.pf.need === 'bm' && mx.noBm.gross === null, 'net force without body mass: no grade and no DSI (needs body weight)');
  assert(near(mx.unset.lb, 0.9167, 0.001) && near(mx.net.lb, 0.6635, 0.001) && near(mx.gross.lb, 0.9167, 0.001), 'leaderboard and percentile values follow the setting straight away');
  assert(!mx.clean && mx.shared, 'invalid values are dropped on load; the setting syncs between devices');

  console.log('== Needs attention (dashboard)');
  await p.goto(BASE + '#/dashboard'); await p.waitForTimeout(400);
  let na = await p.innerText('.na-card');
  assert(/Liam C\. is fatigued today/.test(na), 'fatigued athletes today come first');
  assert(na.includes('Choose which IMTP force you type in'), 'asks which IMTP force you type while it isn’t chosen');
  assert(/Liam C\.: Poor on Peak landing force \(relative\), CMJ braking RFD, IMTP force at 100 ms \(relative\) \+1 more/.test(na), 'Poor results listed per athlete, with names that say which test');
  assert(na.includes('Team test day in progress: Varsity preseason'), 'open team test days are listed');
  assert(/with no tests yet: .*New K\./.test(na) && /missing sex or birth date .*New K\./.test(na), 'athletes with no tests or no sex/birth date are listed');
  assert(await fits(), 'dashboard fits the iPhone screen');
  await p.locator('.na-card a.row', { hasText: 'is fatigued today' }).click(); await p.waitForTimeout(300);
  assert((await hash()) === `#/athlete/${ids.boy}`, 'tapping an item opens it');

  console.log('== Profile: training priorities');
  const pr = await st(id => athPriorities(getAthlete(id)).map(x => `${x.key}:${x.score}`), ids.boy);
  assert(pr.join(',') === 'ready:100,asym:35,land:32,strength:26,ssc:16,brake:14', `ranked by importance; IMTP is Average but improving (+20%), so strength ranks lower (${pr.join(', ')})`);
  const card = await p.innerText('.prio-card');
  const titles = await p.$$eval('.prio-card > .prio .prio-t', els => els.map(e => e.textContent));
  assert(titles.join('|') === 'Fatigued today: reduce the session|Reduce the left–right difference|Landing mechanics and deceleration', 'top three shown on the Overview');
  assert(card.includes('3 more priorities') && card.includes('Propulsive asymmetry 16.0%') && card.includes('Peak landing force (relative) 4.81 × BW (Poor)'), 'each says why (the result and its level), the rest are one tap away');
  assert(await p.locator('.prio-card .in-refs a[href="#/references?r=bishop2018"]').count() === 1 && await p.locator('.prio-card .in-refs a[href="#/references?r=hewett1996"]').count() === 1, 'each priority links the research behind it');
  assert(!/time to takeoff|mRSI/i.test(card.split('Strengths')[0]), 'provisional standards never create a priority (time to takeoff 0.95 s is “Poor”)');
  assert(/Strengths\s*·\s*Good: CMJ jump height, CMJ peak propulsive power, SJ jump height/.test(card) && !/Elite:[^·]*mRSI/.test(card), 'strengths use unique names, grouped by level; provisional mRSI isn’t claimed as a strength');
  assert(await fits(), 'profile fits the iPhone screen');
  await p.screenshot({ path: SP + '/v111-priorities.png', fullPage: false });

  console.log('== Profile: evidence tags, level summary and the IMTP question');
  const tags = await p.$$eval('.std-card .std-row', rs => rs.map(r => r.querySelector('.std-name')?.textContent.replace(/\s+/g, ' ').trim()));
  assert(tags.includes('mRSI Provisional') && tags.includes('Time to takeoff Provisional') && tags.includes('Peak RFD Low reliability') && tags.includes('Net impulse (0–200 ms) Low reliability'), 'mRSI and time to takeoff are tagged Provisional; IMTP RFD and impulse Low reliability');
  assert(await p.locator('.std-card .std-row.soft').count() === 4 && (await p.innerText('.std-card')).includes('no high-school norm table was found'), 'tagged rows are dimmed and explain why, with sources');
  assert(await p.locator('.std-card .std-basis [data-act=setImtpBasis]').count() === 2, 'the standards card asks which IMTP force you type');
  await p.click('.std-card .std-basis [data-act=setImtpBasis][data-v=net]'); await p.waitForTimeout(300);
  assert((await st(() => S.settings.imtpBasis)) === 'net' && await p.locator('.std-basis').count() === 0, 'one tap answers it, and the question goes away');
  const sum = await p.$$eval('.std-card .std-sum .std-lv', els => els.map(e => e.textContent));
  assert(sum.join(',') === '5 Good,4 Average,2 Poor', `level summary counts only graded results (${sum.join(', ')})`);
  const ups = await p.innerText('.std-card .std-ups');
  assert(ups.includes('CMJ jump height') && ups.includes('SJ jump height') && ups.includes('IMTP peak force (total)') && ups.includes('IMTP relative peak force'), 'lists what went up a level since the last test');
  const cmjRow = await p.locator('.std-card .std-row').filter({ has: p.locator('.std-name', { hasText: /^\s*Jump height\s*$/ }) }).first().innerText();
  assert(cmjRow.includes('▲ up from Average'), 'each meter says when it moved up a level');
  const pfRow = await p.locator('.std-card .std-row').filter({ has: p.locator('.std-name', { hasText: 'Peak force (total)' }) }).innerText();
  assert(pfRow.includes('2,487 N') && pfRow.includes('Good'), 'IMTP peak force meter shows total force (net + body weight)');
  na = await st(() => needsAttention().map(i => i.html).join(' | '));
  assert(!na.includes('Choose which IMTP force'), 'dashboard stops asking once answered');
  const pr2 = await st(id => athPriorities(getAthlete(id)).map(x => `${x.key}:${x.score}`), ids.boy);
  assert(pr2.join(',') === 'ready:100,asym:35,land:32,rate:18,ssc:16,brake:14', `read as net force, IMTP strength is Good, so “build strength” gives way to “express force faster” (${pr2.join(', ')})`);

  console.log('== Profile: quick fixes');
  await p.goto(BASE + `#/athlete/${ids.kid}`); await p.waitForTimeout(300);
  assert((await p.innerText('.gap-chips')).includes('Add sex & birth date'), 'missing details show as a one-tap chip');
  await p.click('.gap-chips [data-act=ttAthInfo]'); await p.waitForTimeout(250);
  await p.click('.modal label:has(input[name=sex][value=M])'); await p.fill('.modal input[name=dob]', '05/05/2010'); await submit(); await p.waitForTimeout(300);
  const kid = await st(id => getAthlete(id), ids.kid);
  assert(kid.sex === 'M' && kid.dob === '2010-05-05' && await p.locator('.gap-chips').count() === 0, 'saved from the chip; the chip goes away');
  await p.goto(BASE + `#/athlete/${ids.gap}`); await p.waitForTimeout(300);
  assert((await p.innerText('.gap-chips')).includes('Body mass on the latest test'), 'a force-plate test without body mass shows a chip');
  await p.click('.gap-chips [data-act=editTest]'); await p.waitForTimeout(300);
  assert((await p.innerText('.modal h2')).startsWith('Edit test'), 'the chip opens that test to add it');
  await p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]'); await p.waitForTimeout(150);
  const inl = await st(({ boy }) => {
    const a = getAthlete(boy);
    return { pct: stdPctCell('imtpPF', { a, v: 1800, date: today(), bm: null }), inline: stdInlineHtml(a, 'imtpPF', { v: 1800, date: today() }) };
  }, ids);
  assert(inl.pct.includes('Add body mass') && inl.inline.includes('add body mass to this test'), 'net force without body mass explains what’s needed (percentiles, Testing tab)');

  console.log('== Settings');
  await p.goto(BASE + '#/settings'); await p.waitForTimeout(300);
  const fp = p.locator('.card', { hasText: 'Force plate (OVR Force)' });
  assert(await fp.locator('[data-v=net].on[aria-checked=true]').count() === 1 && !(await fp.innerText()).includes('Not chosen yet'), 'Settings → Force plate shows the choice');
  await fp.locator('[data-v=gross]').click(); await p.waitForTimeout(250);
  assert((await st(() => S.settings.imtpBasis)) === 'gross', 'and changes it');
  assert((await fp.innerText()).includes('OVR metrics guide') && (await fp.innerText()).includes('OVR DSI guide'), 'with the OVR documentation as sources (distinct labels)');

  console.log('== Evaluation form');
  await st(() => { delete S.settings.imtpBasis; });
  await p.goto(BASE + `#/athlete/${ids.boy}/evaluation`); await p.waitForTimeout(300);
  await p.click('[data-act=newEval] >> nth=0'); await p.waitForTimeout(350);
  assert(await p.locator('.modal .std-basis').count() === 1, 'the IMTP section asks which force you type while it isn’t chosen');
  await p.click('.modal .std-basis [data-v=net]'); await p.waitForTimeout(200);
  assert(await p.locator('.modal').count() === 1 && await p.locator('.modal .std-basis').count() === 0 && (await p.innerText('.modal')).includes('Enter OVR’s Net Peak Force'), 'answering keeps the form open and shows what to type');
  const fill = async (k, vals) => { for (let i = 0; i < vals.length; i++) await p.fill(`.modal input[data-tr=${k}][data-i="${i}"]`, String(vals[i])); };
  await fill('cmj', [19, 19.4]); await fill('sj', [17, 17.2]); await fill('cmjPF', [1640, 1660]); await fill('imtpPF', [1790, 1810]);
  await p.fill('.modal input[name=bm]', ''); await p.waitForTimeout(150);
  assert((await p.innerText('#evalOut')).includes('Add today’s body mass'), 'net forces without body mass: asks for it before showing DSI');
  await p.fill('.modal input[name=bm]', '154.3'); await p.waitForTimeout(150);
  const evo = await p.innerText('#evalOut');
  assert(/DSI 0\.66/.test(evo), `DSI from total force (${evo.split('\n')[0]})`);
  await p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]'); await p.waitForTimeout(150);

  console.log('== Progress report');
  await p.goto(BASE + `#/reports?athlete=${ids.boy}`); await p.waitForTimeout(500);
  const sec = await p.locator('.report .r-sec', { hasText: 'Where they stand' }).innerText();
  assert(sec.includes('Peak force (total)') && sec.includes('2,487 N') && sec.includes('Jump height') && sec.includes('Good'), 'the report has a high-school standards section');
  assert(!/mRSI|Time to takeoff|Peak RFD|Net impulse/.test(sec), 'provisional and low-reliability standards are left out of reports for parents');
  assert(await p.locator('.report .r-std .r-pill.lv-good').count() >= 3 && /for boys aged 14–18/.test(sec), 'levels as coloured labels, with what they are');
  const nxt = await p.locator('.report .r-sec', { hasText: 'Focus for the next period' }).innerText();
  assert(nxt.includes('Even out the left–right difference') && nxt.includes('Landing technique and control') && !nxt.includes('Fatigued'), 'focus for the next period comes from the training priorities (not today’s readiness)');
  assert(await fits(), 'report fits the iPhone screen');
  await p.screenshot({ path: SP + '/v111-report.png', fullPage: true });
  await p.click('[data-act=repSection][data-k=standards]'); await p.waitForTimeout(250);
  assert(await p.locator('.report .r-sec', { hasText: 'Where they stand' }).count() === 0, 'the section can be switched off');
  const ai = await st(id => stdReportRows(getAthlete(id)).map(r => r.s.key).join(','), ids.boy);
  assert(ai.includes('imtpPF') && !ai.includes('rsiMod') && !ai.includes('imtpRfd'), 'the AI draft sees the same graded results');

  console.log('== Quick Find');
  await p.goto(BASE + '#/dashboard'); await p.waitForTimeout(300);
  await p.click('.top-find'); await p.waitForTimeout(200);
  await p.fill('#qfInput', 'carter'); await p.waitForTimeout(100);
  assert((await p.innerText('#qfList a.qf >> nth=0')).includes('Liam Carter'), 'finds athletes by name');
  await p.press('#qfInput', 'Enter'); await p.waitForTimeout(300);
  assert((await hash()) === `#/athlete/${ids.boy}` && await p.locator('#qfInput').count() === 0, 'Enter opens the first result');
  await p.keyboard.press('Control+k'); await p.waitForTimeout(200);
  assert(await p.locator('#qfInput').count() === 1, '⌘K / Ctrl+K opens Find from anywhere');
  await p.fill('#qfInput', 'varsity'); await p.waitForTimeout(100);
  const hrefs = await p.$$eval('#qfList a.qf', as => as.map(a => a.getAttribute('href')));
  assert(hrefs.includes(`#/teams/${ids.team}`) && hrefs.includes(`#/teamtest/${ids.day}`), 'finds teams and test days');
  await p.fill('#qfInput', 'settings'); await p.waitForTimeout(100);
  assert((await p.$$eval('#qfList a.qf', as => as.map(a => a.getAttribute('href')))).includes('#/settings'), 'finds pages');
  await p.fill('#qfInput', 'zzqx'); await p.waitForTimeout(100);
  assert((await p.innerText('#qfList')).includes('Nothing found'), 'says when nothing matches');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.goto(BASE + '#/athletes'); await p.waitForTimeout(300);
  await p.click('body', { position: { x: 5, y: 300 } }); await p.keyboard.press('/'); await p.waitForTimeout(200);
  assert(await p.locator('#qfInput').count() === 1, '“/” opens Find when you aren’t typing');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await p.click('input[data-input=athSearch]'); await p.keyboard.type('a/b'); await p.waitForTimeout(200);
  assert(await p.locator('#qfInput').count() === 0 && (await p.inputValue('input[data-input=athSearch]')) === 'a/b', 'typing “/” in a search box doesn’t open it');
  assert(await fits(), 'top bar with the Find button fits the iPhone screen');

  console.log('== Names and references');
  const nm = await st(() => ({ a: stdName(STD_BY.cmj), b: stdName(STD_BY.sj), c: stdName(STD_BY.dlTts), d: stdName(STD_BY.imtpRel), r1: refShort('ovrMetrics'), r2: refShort('sole2018rsi'), txt: stdPromptText() }));
  assert(nm.a === 'CMJ jump height' && nm.b === 'SJ jump height' && nm.c === 'Time to stabilisation' && nm.d === 'IMTP relative peak force', 'unique names for lists');
  assert(nm.r1 === 'OVR metrics guide' && nm.r2 === 'Sole et al. 2018', 'reference labels');
  assert(nm.txt.includes('Peak force (total) (total force including body weight; net + body weight)') && nm.txt.includes('[PROVISIONAL'), 'the AI is told how peak force is graded and which bands are provisional');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
