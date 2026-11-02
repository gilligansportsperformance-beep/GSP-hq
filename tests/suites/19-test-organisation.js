// Performance HQ end-to-end tests — v1.15: tests organised in sections and sub-sections everywhere,
// and the two flying 10 yd sprints (5 yd build + 10 yd fly, 10 yd build + 10 yd fly)
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const near = (a, b, t = 1e-6) => Math.abs(a - b) <= t;
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const submit = () => p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]');
  const close = () => p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]');
  const st = (fn, a) => p.evaluate(fn, a);
  const fits = async () => (await st(() => document.documentElement.scrollWidth)) <= 391;
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(700);

  console.log('== One order for the tests');
  const org = await st(() => ({
    secs: metricSections(m => !m.calc).map(x => `${x.cat.key}: ${x.subs.map(g => g.sub || '-').join(' / ')}`),
    fly: ['fly10yd', 'fly10yd10', 'fly10'].map(k => `${M[k].label}|${M[k].sub}`),
    grp: groupMetrics().slice(0, 8),
  }));
  assert(org.secs[0] === 'sprint: Acceleration · yards / Acceleration · metres / Max velocity · flying / Change of direction', `sprints by acceleration (yards, metres), max velocity and change of direction (${org.secs[0]})`);
  assert(org.secs.includes('cmjfp: Strategy & timing / Braking / Propulsion & power / Landing / Left–right') && org.secs.includes('iso: IMTP / Single-leg IMTP / Calf push / Other'), 'OVR Force CMJ and isometric metrics in sub-sections');
  assert(org.fly.join(',') === '5 yd build + 10 yd fly|Max velocity · flying,10 yd build + 10 yd fly|Max velocity · flying,Flying 10 m|Max velocity · flying', 'both flying 10 yd tests, named by their build-up, next to the flying 10 m');
  assert(org.grp.join(',') === 'sprint10yd,sprint40yd,sprint10,sprint20,fly10yd,fly10yd10,fly10,proAgility', `quick-pick tests in the same order (${org.grp.join(', ')})`);

  console.log('== Add test form');
  const aid = await st(() => upsert('athletes', { firstName: 'Sprint', lastName: 'Kid', sex: 'M', dob: '2010-03-03', archived: false }).id);
  await p.goto(BASE + `#/athlete/${aid}/testing`); await p.waitForTimeout(300);
  await p.click('.top-actions [data-act=newTest]'); await p.waitForTimeout(300);
  const subs = await p.$$eval('.modal details.group', ds => ds.map(d => [...d.querySelectorAll('.mg-sub')].map(x => x.textContent).join('/')));
  assert(subs[0] === 'Acceleration · yards/Acceleration · metres/Max velocity · flying/Change of direction' && subs[1] === 'Vertical/Horizontal', 'each section is split into sub-sections');
  assert(await p.locator('.modal input[name=m_fly10yd10]').count() === 1 && (await p.innerText('.modal')).includes('10 yd build + 10 yd fly') && (await p.innerText('.modal')).includes('CMJ jump height is under Jumps'), 'the new test is in the form, and the OVR Force CMJ section points to jump height');
  assert(await fits(), 'the form fits the iPhone screen');
  await p.screenshot({ path: SP + '/v115-add-test.png' });
  await p.fill('.modal input[name=m_fly10yd]', '1.12'); await p.fill('.modal input[name=m_fly10yd10]', '1.05'); await p.fill('.modal input[name=m_sprint10yd]', '1.75');
  await submit(); await p.waitForTimeout(300);
  const t = await st(id => { const x = testsFor(id).pop(); return { m: x.m, vmax: testMetrics(x).vmax }; }, aid);
  assert(t.m.fly10yd === 1.12 && t.m.fly10yd10 === 1.05 && near(t.vmax, 9.144 / 1.05), 'both saved; max velocity comes from the faster flying segment (the 10 yd build)');

  console.log('== Testing tab');
  await st(id => upsert('tests', { athleteId: id, date: addDays(today(), -14), sides: {}, isoType: 'IMTP', m: { fly10yd: 1.15, fly10yd10: 1.08, sprint10: 1.80 } }), aid);
  await p.goto(BASE + `#/athlete/${aid}`); await p.waitForTimeout(200);
  await p.goto(BASE + `#/athlete/${aid}/testing`); await p.waitForTimeout(400);
  const kick = await p.$$eval('.mc-sub', els => els.map(e => e.textContent));
  assert(kick.join('|') === 'Acceleration · yards|Acceleration · metres|Max velocity · flying', `results grouped under sub-headings (${kick.join(', ')})`);
  const names = await p.$$eval('.metric-card .mc-name', els => els.map(e => e.textContent.trim()));
  assert(names.indexOf('5 yd build + 10 yd fly') >= 0 && names.indexOf('10 yd build + 10 yd fly') === names.indexOf('5 yd build + 10 yd fly') + 1, 'the two flying tests are separate cards, side by side');
  assert(await fits(), 'Testing tab fits the iPhone screen');
  const hist = await p.$$eval('tr[data-act=editTest]', trs => trs.map(r => r.cells[1].innerText));
  assert(hist[1].startsWith('10 m sprint') && hist[1].indexOf('5 yd build') < hist[1].indexOf('10 yd build') && hist[0].startsWith('10 yd sprint'), 'test history lists each test’s results in the same order (typed fly, fly, 10 m → 10 m first)');

  console.log('== Dashboard: recent tests');
  const jid = await st(() => {
    const a = upsert('athletes', { firstName: 'Jump', lastName: 'Kid', sex: 'F', dob: '2009-05-05', archived: false });
    upsert('tests', { athleteId: a.id, date: addDays(today(), -30), sides: {}, m: { cmj: 40 } });
    upsert('tests', { athleteId: a.id, date: addDays(today(), -20), sides: {}, device: 'OVR Jump', m: { cmj: 44 } });
    upsert('tests', { athleteId: a.id, date: addDays(today(), -10), sides: {}, m: { cmj: 41 } });
    upsert('tests', { athleteId: a.id, date: today(), sides: {}, device: 'OVR Jump', m: { cmj: 46.42 } });
    return a.id;
  });
  await p.goto(BASE + '#/dashboard'); await p.waitForTimeout(400);
  const rowSub = async id => (await p.$$eval(`a.row[href="#/athlete/${id}/testing"] .row-sub`, els => els.map(e => e.innerText)))[0] || '';
  const jr = await rowSub(jid), sr = await rowSub(aid);
  assert(jr.includes('CMJ height (OVR Jump)') && jr.includes('▲ 5.5%') && !jr.includes('13.2'), `an OVR Jump height is compared with the last OVR Jump test, not the force-plate one in between (${jr})`);
  assert(sr.includes('10 yd sprint') && sr.includes('5 yd build + 10 yd fly'), `yard sprints and flying times are shown (${sr})`);

  console.log('== Evaluation: speed section');
  await p.goto(BASE + `#/athlete/${aid}/evaluation`); await p.waitForTimeout(300);
  await p.click('[data-act=newEval] >> nth=0'); await p.waitForTimeout(400);
  const sp = await p.locator('.modal .eval-sec').nth(1).innerText();
  assert(sp.includes('5 yd build + 10 yd fly') && sp.includes('10 yd build + 10 yd fly') && sp.indexOf('5 yd build') < sp.indexOf('10 yd build + 10'), 'the evaluation has both flying tests, 5 yd build first');
  await p.fill('.modal input[data-tr=fly10yd10][data-i="0"]', '20'); await p.fill('.modal input[data-tr=fly10yd10][data-i="1"]', '1.02'); await p.waitForTimeout(100);
  assert((await p.innerText('.modal [data-avg="fly10yd10"]')).includes('Best 1.02 s'), 'MPH from the timer is converted (20 mph over 10 yd = 1.02 s), the fastest trial counts');
  await close(); await p.waitForTimeout(150);

  console.log('== Pickers');
  const tt = await st(() => { ttSetup({}); const more = [...document.querySelectorAll('.modal .tt-sub')].map(e => e.textContent); const chips = [...document.querySelectorAll('.modal [data-ttk]')].map(c => c.dataset.ttk); return { more, chips }; });
  assert(tt.chips.includes('fly10yd10') && tt.more.includes('Acceleration · metres') && tt.more.includes('Braking'), 'team testing: the new test is a quick pick; more tests sit under sub-headings');
  await close(); await p.waitForTimeout(150);
  await p.goto(BASE + '#/leaderboard'); await p.waitForTimeout(300);
  const og = await p.$$eval('select[data-change=lbKey] optgroup', gs => gs.map(g => g.label));
  assert(og[0] === 'Sprint & speed · Acceleration · yards' && og.includes('Sprint & speed · Max velocity · flying') && og.includes('OVR Force · Isometric (Force mode) · IMTP'), 'leaderboard picker grouped by sub-section');
  const flyOpts = await p.$$eval('select[data-change=lbKey] optgroup[label="Sprint & speed · Max velocity · flying"] option', os => os.map(o => o.textContent.replace(' (no data)', '')));
  assert(flyOpts.join('|') === '5 yd build + 10 yd fly|10 yd build + 10 yd fly|Flying 10 m', 'both flying tests ranked separately');
  await p.goto(BASE + `#/athlete/${aid}/testing`); await p.waitForTimeout(300);
  await p.click('.top-actions [data-act=pastResults]'); await p.waitForTimeout(300);
  const pg = await p.$$eval('select[data-pgadd] optgroup', gs => gs.map(g => g.label));
  assert(pg.includes('Sprint & speed · Change of direction') && pg.includes('OVR Force · CMJ (Jump mode) · Braking'), 'Past results “Add a test” grouped by sub-section');
  await p.selectOption('select[data-pgp]', '3'); await p.waitForTimeout(200);
  const heads = await p.$$eval('.pg-table th', ths => ths.map(t => t.childNodes[0].textContent.trim()));
  assert(heads.includes('5 yd build + 10 yd fly') && heads.includes('10 yd build + 10 yd fly'), 'the Sprints quick pick includes both flying tests');
  await close(); await p.waitForTimeout(150);

  console.log('== Importing flying sprints');
  const imp = await st(() => ({
    cols: ['10 yd build + 10 yd fly (s)', '5 yd build + 10 yd fly (s)', 'Flying 10 yd (s)', '10yd build 10yd fly'].map(guessColumn).join(','),
    rows: [['10', 'yd', '10 yd build + 10 yd fly'], ['10', 'yd', '5 yd build + 10 yd fly'], ['10', 'yd', 'Flying 10']].map(x => impSprintKey(...x)).join(','),
  }));
  assert(imp.cols === 'fly10yd10,fly10yd,fly10yd,fly10yd10', `column headers say which build-up (${imp.cols})`);
  assert(imp.rows === 'fly10yd10,fly10yd,fly10yd', 'distance + time rows too (a plain “Flying 10” stays the 5 yd build)');
  await p.goto(BASE + '#/athletes'); await p.waitForTimeout(200);
  await p.click('.top-actions [data-act=importCsv]'); await p.waitForTimeout(200);
  await p.fill('[data-paste]', 'Name,Date,10 yd build + 10 yd fly (s)\nSprint Kid,2026-09-01,1.07'); await p.click('[data-parse-paste]'); await p.waitForTimeout(250);
  const ig = await p.$$eval('select[data-map] >> nth=2', s => [...s[0].querySelectorAll('optgroup')].map(g => g.label));
  assert((await p.inputValue('select[data-map="2"]')) === 'fly10yd10' && ig.includes('Sprint & speed · Max velocity · flying'), 'the import’s column menu is grouped the same way');
  await close(); await p.waitForTimeout(150);

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
