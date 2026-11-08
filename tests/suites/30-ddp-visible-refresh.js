// Performance HQ end-to-end tests — v1.25: double progression is visible everywhere (builder strip and "How it works",
// row tips, set targets in the session log, a card on the Program tab) and the professional visual refresh
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
    const lb = x => U.massIn(x), ex = n => S.exercises.find(e => e.name === n).id;
    const a = upsert('athletes', { firstName: 'Dee', lastName: 'Pro', sex: 'M', dob: '2008-01-01', archived: false });
    upsert('workouts', { athleteId: a.id, date: addDays(today(), -3), title: 'Lower', completed: true, items: [
      { id: 'i1', exerciseId: ex('Back Squat'), sets: '3', reps: '6-10', intensity: 'load', load: lb(225) },
      { id: 'i2', exerciseId: ex('Romanian Deadlift'), sets: '3', reps: '8-12', intensity: 'load', load: lb(185) }],
      log: { i1: [{ load: lb(225), reps: 10 }, { load: lb(225), reps: 10 }, { load: lb(225), reps: 8 }], i2: [{ load: lb(185), reps: 9 }, { load: lb(185), reps: 9 }, { load: lb(185), reps: 8 }] } });
    const w = upsert('workouts', { athleteId: a.id, date: today(), title: 'Lower', items: [
      { id: 'j1', exerciseId: ex('Back Squat'), sets: '3', reps: '6-10', intensity: 'load', load: lb(225) },
      { id: 'j2', exerciseId: ex('Bench Press'), sets: '3', reps: '5', intensity: 'load', load: lb(155) },
      { id: 'j3', exerciseId: ex('Pull-Up'), sets: '3', reps: '6-10', intensity: 'load', load: lb(25) }] });
    const b = upsert('athletes', { firstName: 'New', lastName: 'One', sex: 'F', dob: '2009-01-01', archived: false });
    return { aid: a.id, wid: w.id, bid: b.id };
  });

  console.log('== The Program tab shows where every set stands');
  await p.goto(BASE + `#/athlete/${A.aid}/program`); await p.waitForTimeout(400);
  const card = await p.innerText('.ddp-card');
  assert(card.includes('Double progression') && card.includes('Back Squat') && card.includes('3 × 6–10'), 'a Double progression card heads the Program tab');
  assert(/225 × 10 · 225 × 10 · 225 × 8 lb/.test(card) && /Next: ▲ 230 · ▲ 230 · 225 lb/.test(card) && card.includes('2 sets up'), `squat: last session set by set, next loads with the sets that go up (${card.split('\n').filter(l => /Next|×/.test(l)).join(' / ')})`);
  assert(/Romanian Deadlift[\s\S]*Next: 185 · 185 · 185 lb[\s\S]*same loads, more reps/.test(card) && /Pull-Up[\s\S]*Not logged yet/.test(card), 'RDL keeps its loads (no set reached 12); the pull-up starts after its first logged session');
  await p.goto(BASE + `#/athlete/${A.bid}/program`); await p.waitForTimeout(300);
  assert((await p.innerText('.ddp-card')).includes('No exercises use it yet. Prescribe by load with a rep range'), 'an athlete without it is told how to start');
  await p.click('.ddp-card [data-act=ddpHelp]'); await p.waitForTimeout(250);
  const how = await p.innerText('.modal-wrap >> nth=-1');
  assert(how.includes('Double progression') && how.includes('3 × 6–10 @ 225 lb') && how.includes('230 · 230 · 225 lb') && how.includes('Each set progresses on its own'), '“How it works” explains it with your philosophy and an example');
  await p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]'); await p.waitForTimeout(150);

  console.log('== The builder says what it is doing, row by row');
  await st(id => openWorkoutModal(getRec('workouts', id)), A.wid); await p.waitForTimeout(500);
  assert((await p.innerText('.modal .ddp-strip')).includes('1 exercise can be updated from the last logged session') && await p.locator('.modal [data-ddp-all]').isVisible(), 'the strip says one exercise can be updated, next to the Apply button');
  const tips = await p.$$eval('.modal .ie-ddp-tip', els => els.map(e => e.textContent.trim()));
  assert(tips[0].includes('can update these loads') && tips[1].includes('Write the reps as a range (e.g. 6–10)') && tips[2].includes('starts once Pull-Up has a logged session'), 'each row says why it isn’t progressing yet');
  await p.click('.modal [data-ddp-all]'); await p.waitForTimeout(200);
  assert((await p.inputValue('.modal #itemsHost [data-k=load] >> nth=0')) === '230, 230, 225' && (await p.innerText('.modal .ddp-strip')).includes('1 exercise filled in set by set'), 'Apply fills the squat in, and the strip follows');
  await p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]'); await p.waitForTimeout(400);
  await st(id => openWorkoutModal(getRec('workouts', id)), A.wid); await p.waitForTimeout(400);
  assert((await p.innerText('.modal .ie-ddp-tip.ok')).includes('these loads follow the session of'), 'reopened later, the row confirms it follows the last session');
  await p.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(m => m.remove()));

  console.log('== The session log shows the target and what goes up');
  await st(id => openSessionLogger(getRec('workouts', id)), A.wid); await p.waitForTimeout(500);
  const sq = '.log-item[data-block="j1"]';
  assert((await p.innerText(`${sq} .ddp-log`)).includes('aim for 6–10 reps. A set that reaches 10 goes up next session'), 'the squat shows its double progression target');
  assert(await p.locator('.log-item[data-block="j2"] .ddp-log').count() === 0, 'a fixed rep target (3 × 5) has none');
  const row0 = `${sq} .log-row[data-i="0"]`;
  assert(await p.locator(`${row0} [data-ddp-up]`).isHidden(), 'no badge before the set reaches the top');
  await p.fill(`${row0} [data-k=reps]`, '10'); await p.waitForTimeout(80);
  assert((await p.innerText(`${row0} [data-ddp-up]`)) === '▲ +5 lb next time', 'typing 10 reps shows “▲ +5 lb next time” on that set');
  await p.fill(`${row0} [data-k=reps]`, '9'); await p.waitForTimeout(80);
  assert(await p.locator(`${row0} [data-ddp-up]`).isHidden(), 'and hides it again at 9');
  assert(await fits(), 'the session log fits the iPhone screen');
  await p.evaluate(() => document.querySelectorAll('.modal-wrap').forEach(m => m.remove()));

  console.log('== The professional refresh');
  await p.goto(BASE + '#/dashboard'); await p.waitForTimeout(300);
  const look = await st(() => { const cs = el => getComputedStyle(document.querySelector(el)); return { bg: getComputedStyle(document.body).backgroundColor, title: cs('.topbar h1').fontFamily, transform: cs('.topbar h1').textTransform, hero: cs('.hero .date').fontFamily }; });
  assert(look.bg === 'rgb(243, 245, 248)', `a crisp neutral background, no beige (${look.bg})`);
  assert(/DM Sans/.test(look.title) && !/Bebas/.test(look.title.split(',')[0]) && /Bebas/.test(look.hero), 'page titles in clean DM Sans; the bold display type kept for the dashboard date');
  const tab = await st(() => getComputedStyle(document.querySelector('.tabbar .tab.active'), '::before').backgroundColor);
  assert(tab !== 'rgba(0, 0, 0, 0)' && tab !== 'transparent', 'the open tab is marked in blue');
  assert(await fits(), 'the dashboard fits the iPhone screen');

  console.log('== Navy and blue for reports too (black and gold no longer the default)');
  const mig = await st(async () => {
    S.settings.brand = { ...brand(), primary: '#101010', accent: '#C8A96E' };
    S.settings.philAdds = { ddp: true };
    await flush();
    const at = S.settingsAt;
    brandColourUpdate(); await flush();
    const after = { p: brand().primary, a: brand().accent, flag: S.settings.philAdds.navy, sameAt: S.settingsAt === at };
    S.settings.brand = { ...brand(), primary: '#101010', accent: '#c8a96e' };       // the coach picks black and gold again later
    brandColourUpdate();
    return { ...after, kept: brand().primary === '#101010', clean: (o => (cleanSettings(o), o.philAdds))({ philAdds: { ddp: true, navy: true, junk: 1 } }) };
  });
  assert(mig.p === '#0f2347' && mig.a === '#3b82f6' && mig.flag === true && mig.sameAt, 'reports still on the old black-and-gold defaults move to navy and blue, once, without marking the settings as newer');
  assert(mig.kept && JSON.stringify(mig.clean) === '{"ddp":true,"navy":true}', 'a colour chosen later is never changed back; the flag loads safely');
  await st(() => A.editBranding());
  await p.waitForTimeout(250);
  await p.click('.modal [data-brand-set="#0b3b24,#4cbb17"]'); await p.waitForTimeout(100);
  assert((await p.inputValue('.modal input[name=primary]')) === '#0b3b24' && (await p.inputValue('.modal input[name=accent]')) === '#4cbb17', 'Branding has one-tap colour sets (Kelly green shown here)');
  await p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]'); await p.waitForTimeout(150);
  assert(await st(() => REPORT_CSS.includes('.r-pill.pb{background:#C8A96E') && REPORT_CSS.includes('.r-pill.lv-elite{background:#C8A96E')), 'personal bests and the Elite level stay gold on reports, whatever the brand colours');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
