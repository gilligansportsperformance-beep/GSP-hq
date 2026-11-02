// Performance HQ end-to-end tests — v1.14: entering an athlete's past results in one table
// (many test days at once, paste from a spreadsheet, corrections) and "Save & add another date"
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
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
  const cell = (r, c) => `.pg-table input[data-r="${r}"][data-c="${c}"]`;
  const paste = (sel, text) => st(({ sel, text }) => { const el = document.querySelector(sel); el.focus(); const dt = new DataTransfer(); dt.setData('text/plain', text); el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true, cancelable: true })); }, { sel, text });
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(700);

  const ids = await st(() => {
    const a = upsert('athletes', { firstName: 'Liam', lastName: 'Carter', sex: 'M', dob: '2010-05-05', archived: false });
    const sprint = upsert('tests', { athleteId: a.id, date: '2026-08-10', sides: {}, isoType: 'IMTP', m: { sprint10yd: 1.8 } }).id;
    const t1 = upsert('tests', { athleteId: a.id, date: '2026-09-01', bodyMassKg: 70, sides: {}, isoType: 'IMTP', m: { cmj: 17 * 2.54, imtpPF: 1500 } }).id;
    upsert('tests', { id: 'wkL~fp', athleteId: a.id, date: '2026-09-15', sides: {}, isoType: 'IMTP', m: { cmj: 18 * 2.54 }, workoutId: 'wkL', notes: 'Logged in session' });
    return { a: a.id, sprint, t1 };
  });

  console.log('== Opening the table');
  await p.goto(BASE + `#/athlete/${ids.a}/testing`); await p.waitForTimeout(400);
  await p.click('.top-actions [data-act=pastResults]'); await p.waitForTimeout(400);
  assert((await p.innerText('.modal h2')) === 'Past results — Liam C.', 'Testing tab → Past results opens one table for the athlete');
  const heads = await p.$$eval('.pg-table th', ths => ths.map(t => t.childNodes[0].textContent.trim()));
  assert(heads.join('|') === 'Date|CMJ height|10 yd sprint|Peak force|Body mass', `columns start from the tests this athlete does most (${heads.join(', ')})`);
  assert(await p.locator('.pg-table tbody tr').count() === 6 && (await p.inputValue(cell(1, 0))) === '09/01/2026' && (await p.inputValue(cell(1, 1))) === '17' && (await p.inputValue(cell(1, 3))) === '1500' && (await p.inputValue(cell(1, 4))) === '154.3', 'saved days are shown with their values, plus empty rows');
  assert(await p.locator(`${cell(2, 1)}[disabled]`).count() === 1 && (await p.innerText('.pg-table tbody tr:nth-child(3)')).includes('From a session log'), 'a test logged in a session is shown but not editable here');
  assert(await fits(), 'the table fits the iPhone screen (it scrolls inside)');
  await p.screenshot({ path: SP + '/v114-past-results.png' });

  console.log('== Typing, Enter and paste');
  await p.locator(cell(3, 0)).pressSequentially('10012026');
  assert((await p.inputValue(cell(3, 0))) === '10/01/2026', 'dates format as you type on the number pad (10012026 → 10/01/2026)');
  await p.fill(cell(3, 1), '18.5'); await p.fill(cell(3, 3), '1600'); await p.fill(cell(3, 4), '155');
  await p.focus(cell(3, 1)); await p.keyboard.press('Enter');
  assert((await st(() => `${document.activeElement.dataset.r}:${document.activeElement.dataset.c}`)) === '4:1', 'Enter moves down to the same test on the next row');
  await paste(cell(4, 0), '10/08/2026\t18.9\t\t1650\n10/15/2026\t19.1\t1.70\t1680\n2026-10-22\t19.4\t\t1700\n');
  await p.waitForTimeout(150);
  assert((await p.inputValue(cell(4, 0))) === '10/08/2026' && (await p.inputValue(cell(5, 2))) === '1.70' && (await p.inputValue(cell(6, 0))) === '10/22/2026' && (await p.inputValue(cell(6, 3))) === '1700', 'a block pasted from a spreadsheet fills the rows (and adds rows)');
  await p.fill(cell(1, 1), '17.3'); await p.fill(cell(1, 3), '');

  console.log('== Checks before saving');
  const blank = await st(() => [...document.querySelectorAll('.pg-table tbody tr')].findIndex((tr, i) => i > 6 && !tr.querySelector('input[data-c="0"]').value));
  await p.fill(cell(blank, 0), '13/45/2026'); await p.fill(cell(blank, 1), '20');
  await submit(); await p.waitForTimeout(200);
  assert((await p.innerText('.modal .form-error')).includes('isn’t a past date'), 'a wrong date is caught');
  await p.fill(cell(blank, 0), '10/01/2026'); await submit(); await p.waitForTimeout(200);
  assert((await p.innerText('.modal .form-error')).includes('is in the table twice'), 'the same new day twice is caught');
  await p.fill(cell(blank, 0), '09/01/2026'); await submit(); await p.waitForTimeout(200);
  assert((await p.innerText('.modal .form-error')).includes('already has a row above'), 'a new row for a day that’s already a row is caught');
  await p.fill(cell(blank, 0), '10/29/2026'); await p.fill(cell(blank, 1), '19.0'); await p.fill(cell(blank, 2), 'fast');
  await submit(); await p.waitForTimeout(200);
  assert((await p.innerText('.modal .form-error')).includes('“fast” isn’t a valid number'), 'a value that isn’t a number is caught');
  await p.fill(cell(blank, 2), '');
  // a test for that day that isn't in the table (a broad jump) — the new row joins it
  const hidden = await st(({ a }) => upsert('tests', { athleteId: a, date: '2026-10-29', sides: {}, isoType: 'IMTP', m: { broad: 80 * 2.54 } }).id, ids);

  console.log('== Saving');
  await submit(); await p.waitForTimeout(250);
  assert((await p.innerText('.dlg-actions')).includes('Remove') && (await p.innerText('.modal.dialog')).includes('Remove 1 saved result'), 'clearing a saved value asks before removing it');
  await p.click('.dlg-actions button[data-i="0"]'); await p.waitForTimeout(400);
  const toastTxt = await p.$$eval('.toast', els => els.map(e => e.textContent).join(' | '));
  assert(/Saved 1[0-9] results on 6 test days/.test(toastTxt), `one save for every day (${toastTxt})`);
  const R = await st(({ a, t1, sprint, hidden }) => {
    const by = d => S.tests.filter(t => t.athleteId === a && t.date === d);
    return { d1001: by('2026-10-01'), d1015: by('2026-10-15'), d1022: by('2026-10-22'), t1: getRec('tests', t1), sess: getRec('tests', 'wkL~fp'), sprint: getRec('tests', sprint), hidden: getRec('tests', hidden), n: testsFor(a).length };
  }, { ...ids, hidden });
  const t1001 = R.d1001[0];
  assert(R.d1001.length === 1 && near(t1001.m.cmj, 18.5 * 2.54) && t1001.m.imtpPF === 1600 && near(t1001.bodyMassKg, 155 / 2.2046226218) && t1001.notes === 'Added in past results', 'a new day becomes a test with its results and body mass');
  assert(R.d1015.length === 1 && near(R.d1015[0].m.cmj, 19.1 * 2.54) && R.d1015[0].m.sprint10yd === 1.7 && R.d1015[0].m.imtpPF === 1680 && R.d1022.length === 1, 'pasted days saved');
  assert(near(R.t1.m.cmj, 17.3 * 2.54) && R.t1.m.imtpPF == null && R.t1.bodyMassKg === 70, 'a saved day corrected, the cleared value removed, the rest kept');
  assert(R.sess.m.cmj === 18 * 2.54 && R.sprint.m.sprint10yd === 1.8, 'the session-logged test and untouched days are unchanged');
  assert(near(R.hidden.m.cmj, 19 * 2.54) && R.hidden.m.broad === 80 * 2.54 && R.n === 8, 'a new row joins a test already saved for that day');

  console.log('== OVR Jump rows, quick picks and columns');
  await p.click('.top-actions [data-act=pastResults]'); await p.waitForTimeout(400);
  await p.selectOption('select[data-pgdev]', 'OVR Jump');
  const r0 = await p.locator('.pg-table tbody tr').count() - 3;
  await p.fill(cell(r0, 0), '10/30/2026'); await p.fill(cell(r0, 1), '21');
  await p.selectOption('select[data-pgp]', '3'); await p.waitForTimeout(200);
  const heads2 = await p.$$eval('.pg-table th', ths => ths.map(t => t.childNodes[0].textContent.trim()));
  assert(heads2.includes('20 yd sprint') && heads2.includes('40 yd dash') && heads2.includes('CMJ height'), 'a quick pick sets the columns but keeps one you’ve typed in');
  const cmjCol = heads2.indexOf('CMJ height');
  await p.click(`.pg-table th:nth-child(${cmjCol + 1}) [data-rmk]`); await p.waitForTimeout(200);
  assert((await p.innerText('.modal.dialog')).includes('1 value typed in this column will not be saved'), 'removing a column you typed in asks first');
  await p.click('.dlg-actions button[data-i="1"]'); await p.waitForTimeout(150);
  await submit(); await p.waitForTimeout(400);
  const jt = await st(({ a }) => S.tests.find(t => t.athleteId === a && t.date === '2026-10-30'), ids);
  assert(jt && jt.device === 'OVR Jump' && jt.m.cmj === 21 * 2.54, '“Measured with OVR Jump” tags the new rows, so their heights stay apart');
  assert((await st(() => S.settings.pastKeys)).includes('sprint40yd'), 'the columns are remembered');

  console.log('== Add test: save & add another date');
  await p.click('.top-actions [data-act=newTest]'); await p.waitForTimeout(300);
  assert(await p.locator('.modal [data-again]').count() === 1 && await p.locator('.modal [data-topast]').count() === 1, 'the single-test form offers “Save & add another date” and a link to the table');
  await p.fill('.modal input[name=date]', '2026-10-31'); await p.fill('.modal input[name=m_cmj]', '19.2');
  await p.selectOption('.modal select[name=device]', 'OVR Force');
  await p.click('.modal [data-again]'); await p.waitForTimeout(400);
  const next = await st(({ a }) => ({ saved: S.tests.find(t => t.athleteId === a && t.date === '2026-10-31'), open: document.querySelectorAll('.modal').length, title: document.querySelector('.modal h2')?.textContent, date: document.querySelector('.modal input[name=date]')?.value, dev: document.querySelector('.modal select[name=device]')?.value }), ids);
  assert(next.saved && near(next.saved.m.cmj, 19.2 * 2.54) && next.saved.device === 'OVR Force', 'the test is saved');
  assert(next.open === 1 && next.title === 'New test — Liam C.' && next.date === '2026-10-31' && next.dev === 'OVR Force', 'and a fresh form opens for the next date (same device)');
  await p.click('.modal [data-topast]'); await p.waitForTimeout(400);
  assert((await p.innerText('.modal h2')) === 'Past results — Liam C.' && await p.locator('.modal').count() === 1, 'the link swaps to the Past results table');
  await p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]'); await p.waitForTimeout(150);

  console.log('== Validation');
  const cl = await st(() => { const s = { pastKeys: ['cmj', 'bad key"><', 5] }; cleanSettings(s); return s.pastKeys; });
  assert(JSON.stringify(cl) === '["cmj"]', 'remembered columns are checked when the data loads');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
