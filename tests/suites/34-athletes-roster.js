// Performance HQ end-to-end tests — v1.29: the Athletes tab is an aligned roster (athlete, age, readiness, last test,
// next session) with quick filters, avatars are a soft tint instead of a solid bubble, and the athlete header shows
// the key facts in one row with tabs that fit an iPhone
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
  const fits = async (w = 391) => (await st(() => document.documentElement.scrollWidth)) <= w;
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]'); await p.waitForTimeout(400);
  const A = await st(() => {
    const d = n => addDays(today(), -n), T = today();
    const mk = (f, l, extra) => upsert('athletes', { firstName: f, lastName: l, sex: 'M', dob: '2009-05-05', sport: 'Football', position: 'WR', team: 'North HS', archived: false, ...extra });
    const ann = mk('Ann', 'Diaz', { sex: 'F', sport: 'Soccer', position: 'Winger' }), ben = mk('Ben', 'Cho'), cal = mk('Cal', 'Ivers'), old = mk('Dee', 'Old', { archived: true });
    // Ann: in today (a workout today), tested last week, a fresh fatigued check
    upsert('workouts', { athleteId: ann.id, date: T, title: 'Lower', items: [], completed: false });
    [[30, 40], [20, 40.5], [10, 41]].forEach(([n, v]) => upsert('tests', { athleteId: ann.id, date: d(n), sides: {}, m: { cmj: v } }));
    upsert('readiness', { athleteId: ann.id, date: d(1), mode: 'cmj', isoType: null, trials: { cmj: [33, 33.5] }, m: { cmj: 33.25 } });
    // Ben: tested 8 weeks ago (due); Cal: never tested (due)
    upsert('tests', { athleteId: ben.id, date: d(56), sides: {}, m: { sprint10yd: 1.8 } });
    upsert('tests', { athleteId: cal.id, date: d(400), sides: {}, m: { sprint10yd: 1.9 } });
    S.tests = S.tests.filter(t => t.athleteId !== cal.id);
    return { ann: ann.id, ben: ben.id, cal: cal.id };
  });

  console.log('== The roster: one aligned row per athlete');
  await p.goto(BASE + '#/athletes'); await p.waitForTimeout(400);
  const rows = await st(() => [...document.querySelectorAll('.roster-row')].map(r => ({ href: r.getAttribute('href'), txt: r.innerText.replace(/\s+/g, ' ') })));
  assert(rows.length === 3 && rows.map(r => r.txt.split(' ')[0]).join() === 'AD,BC,CI', `three active athletes, sorted by name (${rows.map(r => r.txt.slice(0, 12)).join(' | ')})`);
  assert(rows[0].href === `#/athlete/${A.ann}` && rows[0].txt.includes('Ann Diaz') && /\d+ yrs · Soccer · Winger · North HS/.test(rows[0].txt), 'each row opens the profile and shows age · sport · position · school');
  assert(rows[0].txt.includes('Fatigued') && rows[0].txt.includes('Next Today') && rows[1].txt.includes('Tested 8 weeks ago') && rows[2].txt.includes('Tested never'), 'readiness, last test and next session on every row');
  const seg = (await p.innerText('.roster-tools .seg')).replace(/\s+/g, ' ');
  assert(seg.includes('Active 3') && seg.includes('Archived 1') && seg.includes('All 4'), `the filter shows counts (${seg})`);
  assert(await st(() => getComputedStyle(document.querySelector('.roster-head')).display) === 'none' && await fits(), 'on the iPhone the rows stack neatly (no column header) and nothing runs off the screen');

  console.log('== Quick filters');
  const quick = (await p.innerText('.roster-quick')).replace(/\s+/g, ' ');
  assert(quick.includes('1 In today') && quick.includes('2 Due for testing') && quick.includes('1 Down or fatigued'), `counts: ${quick}`);
  await p.click('.rq.due'); await p.waitForTimeout(200);
  let names = await st(() => [...document.querySelectorAll('.roster-row .r-who b')].map(b => b.innerText).join());
  assert(names === 'Ben Cho,Cal Ivers' && (await p.getAttribute('.rq.due', 'aria-pressed')) === 'true', '“Due for testing” shows who hasn’t tested in 6 weeks');
  await p.click('.rq.due'); await p.waitForTimeout(200);
  assert(await p.locator('.roster-row').count() === 3, 'tapping it again shows everyone');
  await p.click('.rq.down'); await p.waitForTimeout(200);
  names = await st(() => [...document.querySelectorAll('.roster-row .r-who b')].map(b => b.innerText).join());
  assert(names === 'Ann Diaz', '“Down or fatigued” shows the athlete whose check was down');
  await p.click('.rq.down'); await p.selectOption('select[data-change=athSort]', 'ready'); await p.waitForTimeout(200);
  assert((await st(() => document.querySelector('.roster-row .r-who b').innerText)) === 'Ann Diaz', 'sort by readiness puts the fatigued athlete first');
  await p.screenshot({ path: SP + '/v129-roster-iphone.png' });

  console.log('== Calmer avatars');
  const av = await st(() => { const e = document.querySelector('.roster-row .avatar'), cs = getComputedStyle(e); return { style: e.getAttribute('style'), bg: cs.backgroundColor, fg: cs.color }; });
  assert(/^--ac:#[0-9a-fA-F]{6}$/.test(av.style) && av.bg !== av.fg && !/rgb\(255, 255, 255\)/.test(av.fg), `a soft tint with darker initials, not a solid bubble (${av.bg} / ${av.fg})`);

  console.log('== The athlete header');
  await p.goto(BASE + `#/athlete/${A.ann}/overview`); await p.waitForTimeout(400);
  const facts = await st(() => [...document.querySelectorAll('.ah-fact > span')].map(s => s.innerText.trim().toLowerCase()).join());
  assert(facts === 'age,height,mass,readiness' && (await p.innerText('.profile-head .fat-chip')).includes('Fatigued'), 'key facts in one row: age, height, mass, readiness');
  assert((await p.innerText('.profile-head .ah-sub')).replace(/\s+/g, ' ').includes('Soccer · Winger · North HS') && await p.locator('.profile-head [data-act=logSession]').count() === 1, 'sport · position · school under the name, and today’s session can be logged from the header');
  const tabs = await st(() => { const n = document.querySelector('.ath-tabs'); return { fit: n.scrollWidth <= n.clientWidth + 1, txt: [...n.querySelectorAll('a')].map(a => a.innerText.trim()).join(), lbl: [...n.querySelectorAll('a')].map(a => a.getAttribute('aria-label')).join() }; });
  assert(tabs.fit && tabs.txt === 'Overview,Eval,Tests,Program,VBT,Notes' && tabs.lbl.includes('Sessions & notes'), 'all six tabs fit the iPhone with short names (full names for screen readers)');
  assert(await fits(), 'the header fits the iPhone screen');
  await p.screenshot({ path: SP + '/v129-header-iphone.png' });

  console.log('== Small phones and the Mac');
  const se = await browser.newContext({ ...devices['iPhone SE'] }), q = await se.newPage();
  q.on('pageerror', e => errors.push(e.message));
  await q.goto(BASE); await q.waitForSelector('.modal'); await q.check('input[name=demo]'); await q.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]'); await q.waitForTimeout(900);
  await q.goto(BASE + '#/athletes'); await q.waitForTimeout(300);
  const seList = await q.evaluate(() => document.documentElement.scrollWidth);
  const aid = await q.evaluate(() => S.athletes[0].id);
  await q.goto(BASE + `#/athlete/${aid}/overview`); await q.waitForTimeout(300);
  const seHead = await q.evaluate(() => { const n = document.querySelector('.ath-tabs'); return [document.documentElement.scrollWidth, n.scrollWidth - n.clientWidth]; });
  assert(seList <= 320 && seHead[0] <= 320 && seHead[1] <= 1, 'the roster, header and all six tabs fit a 320 px iPhone SE');
  await se.close();
  const mac = await browser.newContext({ viewport: { width: 1280, height: 860 } }), m = await mac.newPage();
  m.on('pageerror', e => errors.push(e.message));
  await m.goto(BASE); await m.waitForSelector('.modal'); await m.check('input[name=demo]'); await m.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]'); await m.waitForTimeout(900);
  await m.goto(BASE + '#/athletes'); await m.waitForTimeout(300);
  const head = await m.evaluate(() => [...document.querySelectorAll('.roster-head span')].map(s => s.innerText.trim()).filter(Boolean).join('|'));
  const cols = await m.evaluate(() => { const r = [...document.querySelectorAll('.roster-row')]; const x = sel => r.map(row => Math.round(row.querySelector(sel).getBoundingClientRect().left)); return ['.r-age', '.r-ready', '.r-last', '.r-next'].every(s => new Set(x(s)).size === 1); });
  assert(/^Athlete\|Age\|Readiness\|Last test\|Next session$/i.test(head) && cols, `on the Mac a header row and columns that line up on every row (${head})`);
  await m.screenshot({ path: SP + '/v129-roster-mac.png' });
  await mac.close();

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
