// Performance HQ end-to-end tests — sync import floor leaderboard
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', URL = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const sleep = ms => new Promise(r => setTimeout(r, ms));
// ---- fake GitHub ----
const gh = { file: null, sha: null, puts: 0, private: true, conflictOnce: false };
async function ghRoute(route) {
  const req = route.request(), url = new globalThis.URL(req.url());
  const json = (status, body) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  if (!(req.headers()['authorization'] || '').startsWith('Bearer ghp_ok')) return json(401, { message: 'Bad credentials' });
  if (url.pathname === '/repos/coach/gsp-hq-data') return json(200, { private: gh.private, full_name: 'coach/gsp-hq-data' });
  if (url.pathname.startsWith('/repos/coach/gsp-hq-data/contents/')) {
    if (req.method() === 'GET') return gh.file ? json(200, { sha: gh.sha, content: Buffer.from(gh.file).toString('base64'), encoding: 'base64' }) : json(404, { message: 'Not Found' });
    if (req.method() === 'PUT') {
      const body = JSON.parse(req.postData());
      if (gh.conflictOnce) { gh.conflictOnce = false; return json(409, { message: 'sha does not match' }); }
      if ((gh.sha || undefined) !== body.sha) return json(409, { message: 'sha does not match' });
      gh.file = Buffer.from(body.content, 'base64').toString('utf8'); gh.sha = 'sha' + (++gh.puts); gh.lastMsg = body.message;
      return json(200, { content: { sha: gh.sha } });
    }
  }
  return json(404, { message: 'Not Found' });
}
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async (label, opts) => {
    const ctx = await browser.newContext({ ...opts, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`[${label}] ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|status of 40[149]/.test(m.text())) errors.push(`[${label}] console: ${m.text()}`); });
    await page.route('https://api.github.com/**', ghRoute);
    return page;
  };
  const mac = await mk('mac', { viewport: { width: 1440, height: 900 } });
  const ios = await mk('iphone', { ...devices['iPhone 13'] });
  const st = (p, fn, a) => p.evaluate(fn, a);
  const submit = p => p.click('.modal-wrap:last-child .modal-head button[type=submit]');

  console.log('== Sync');
  await mac.goto(URL); await mac.waitForSelector('.modal');
  await mac.fill('input[name=businessName]', 'Gilligan Sports Performance'); await mac.check('input[name=demo]'); await submit(mac); await mac.waitForTimeout(800);
  const setup = async (p, token = 'ghp_ok123', pass = 'correct horse battery') => {
    await p.goto(URL + '#/settings'); await p.waitForTimeout(200);
    await p.click('.card [data-act=syncSetup]');
    await p.fill('input[name=repo]', 'https://github.com/coach/gsp-hq-data'); await p.fill('input[name=token]', token);
    await p.fill('input[name=pass]', pass); await p.fill('input[name=pass2]', pass);
    await submit(p); await p.waitForTimeout(2500);
  };
  gh.private = false; await setup(mac);
  assert((await mac.innerText('.form-error')).includes('public'), 'refuses public repository');
  gh.private = true; await mac.click('.modal-head [data-close]');
  await setup(mac, 'ghp_bad');
  assert((await mac.innerText('.form-error')).includes('token'), 'bad token explained'); await mac.click('.modal-head [data-close]');
  await setup(mac);
  assert(gh.puts === 1 && gh.file, 'Mac uploaded encrypted data');
  await mac.waitForTimeout(500);
  const setupCode = await mac.inputValue('.setup-code');
  assert(/^GSPHQ1-[\w-]+\.[\w-]+\.[\w-]+$/.test(setupCode) && !setupCode.includes('ghp_ok') && !setupCode.includes('gsp-hq-data'), 'after setup, Mac shows an encrypted setup code for the other device');
  await mac.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]'); await mac.waitForTimeout(150);
  const env = JSON.parse(gh.file);
  assert(env.ct && env.iv && env.salt && !gh.file.includes('Maya') && !gh.file.includes('Thompson'), 'cloud file is encrypted (no names readable)');
  assert(await st(mac, () => !JSON.stringify(S).includes('ghp_ok')), 'token not stored in app data/backups');
  // iPhone joins
  await ios.goto(URL); await ios.waitForSelector('.modal'); await ios.click('.modal-head [data-close]');
  await setup(ios, 'ghp_ok123', 'wrong passphrase');
  assert((await ios.innerText('.form-error')).includes('Wrong sync passphrase'), 'wrong passphrase rejected'); await ios.click('.modal-head [data-close]');
  await setup(ios);
  assert(await st(ios, () => S.athletes.length) === 4, 'iPhone received all athletes');
  assert(await st(ios, () => S.settings.businessName) === 'Gilligan Sports Performance', 'shared settings synced');
  // iPhone edits → Mac
  await st(ios, () => { upsert('athletes', { firstName: 'Phone', lastName: 'Added', sport: 'Track' }); });
  await ios.waitForTimeout(7500);
  const putsAfterPhone = gh.puts;
  assert(gh.lastMsg.includes('iPhone'), 'iPhone auto-synced after edit');
  await mac.evaluate(() => A.syncNow()); await mac.waitForTimeout(2500);
  assert(await st(mac, () => S.athletes.some(a => a.firstName === 'Phone')), 'Mac received iPhone’s new athlete');
  // deletion on Mac → iPhone
  await st(mac, () => { const t = S.tests[0]; window.__del = t.id; removeRec('tests', t.id); });
  const delId = await st(mac, () => window.__del);
  await mac.waitForTimeout(7500);
  await ios.evaluate(() => A.syncNow()); await ios.waitForTimeout(2500);
  assert(await st(ios, id => !S.tests.some(t => t.id === id), delId), 'deletion synced to iPhone');
  // settings + local-only
  await st(mac, () => { S.settings.coachName = 'Coach Jensen'; S.settings.lockEnabled = true; S.settings.pinHash = 'x'; persist(); });
  await mac.waitForTimeout(7500);
  await ios.evaluate(() => A.syncNow()); await ios.waitForTimeout(2500);
  assert(await st(ios, () => S.settings.coachName === 'Coach Jensen' && S.settings.lockEnabled && S.settings.pinHash === 'x'), 'coach name and security code synced to the iPhone');
  await st(mac, () => { S.settings.lockEnabled = false; S.settings.pinHash = null; persist(); });
  await mac.waitForTimeout(7500);
  await ios.evaluate(() => A.syncNow()); await ios.waitForTimeout(2500);
  assert(await st(ios, () => !S.settings.lockEnabled), 'turning the code off syncs too');
  // conflict handling
  gh.conflictOnce = true;
  await st(ios, () => { upsert('notes', { athleteId: S.athletes[0].id, date: today(), text: 'conflict test' }); });
  await ios.evaluate(() => A.syncNow()); await ios.waitForTimeout(3000);
  assert(await st(ios, () => !Sync.meta.error), 'recovers from a write conflict');
  // no loop
  await mac.evaluate(() => A.syncNow()); await mac.waitForTimeout(2500);
  const p0 = gh.puts; await sleep(14000);
  assert(gh.puts === p0, `idle devices don’t keep uploading (${gh.puts - p0} extra uploads)`);
  // offline
  await ios.context().setOffline(true); await st(ios, () => upsert('notes', { athleteId: S.athletes[0].id, date: today(), text: 'offline note' }));
  await ios.waitForTimeout(7000);
  assert((await st(ios, () => Sync.meta.error || '')).includes('Offline'), 'offline edits wait');
  await ios.context().setOffline(false); await ios.evaluate(() => window.dispatchEvent(new Event('online'))); await ios.waitForTimeout(4000);
  await mac.evaluate(() => A.syncNow()); await mac.waitForTimeout(2500);
  assert(await st(mac, () => S.notes.some(n => n.text === 'offline note')), 'offline edit synced after reconnect');
  // A third device joins with the setup code (no GitHub details typed)
  const pad = await mk('ipad', { ...devices['iPhone 13'] });
  await pad.goto(URL); await pad.waitForSelector('.modal');
  await pad.click('.modal [data-join]'); await pad.waitForTimeout(200);
  await st(pad, () => { upsert('athletes', { firstName: 'Sample', lastName: 'Only', demo: true }); S.settings.businessName = ''; S.settingsAt = Date.now() + 1e7; });
  await pad.fill('textarea[name=code]', setupCode); await pad.fill('.modal input[name=pass]', 'not my passphrase');
  await submit(pad); await pad.waitForTimeout(2500);
  assert((await pad.innerText('.modal-wrap >> nth=-1 >> .form-error')).includes('Wrong sync passphrase'), 'setup code needs the right passphrase');
  await pad.fill('.modal input[name=pass]', 'correct horse battery'); await submit(pad); await pad.waitForTimeout(3500);
  const padState = await st(pad, () => ({ n: S.athletes.length, sample: S.athletes.some(a => a.firstName === 'Sample'), biz: S.settings.businessName, on: Sync.enabled(), err: Sync.meta.error }));
  const macN = await st(mac, () => S.athletes.length);
  assert(padState.on && !padState.err && padState.n === macN && !padState.sample, `joined with the setup code: ${padState.n} athletes, sample data left out`);
  assert(padState.biz === 'Gilligan Sports Performance', 'joining device takes the real settings (doesn’t overwrite them with blanks)');
  const askCode = await pad.locator('.modal-wrap').count();
  assert(askCode >= 1 && (await pad.innerText('.modal-wrap >> nth=-1')).includes('security code'), 'offers to set a security code after connecting');
  await pad.click('.modal-wrap >> nth=-1 >> [data-i="0"]'); await pad.waitForTimeout(300);
  for (let k = 0; k < 2; k++) { await pad.fill('.modal-wrap >> nth=-1 >> input[name=pin]', '2468'); await submit(pad); await pad.waitForTimeout(300); }
  const padLock = await st(pad, () => ({ on: S.settings.lockEnabled, len: S.settings.pinLen, auto: S.settings.autoLockMin }));
  assert(padLock.on && padLock.len === 4 && padLock.auto === 0, 'security code set (asked every time the app opens)');
  await pad.waitForTimeout(7500);
  await mac.evaluate(() => A.syncNow()); await mac.waitForTimeout(2500);
  assert(await st(mac, () => S.settings.lockEnabled && S.settings.pinLen === 4), 'security code set on one device applies on the Mac too');
  // forgot the code: reset with the sync passphrase
  await st(pad, () => showLock()); await pad.waitForTimeout(200);
  await pad.click('#lock [data-k=forgot]'); await pad.waitForTimeout(250);
  assert(await pad.isVisible('.modal-wrap >> nth=-1 >> input[name=pass]'), 'Forgot? asks for the sync passphrase (shown above the lock screen)');
  await pad.fill('.modal-wrap >> nth=-1 >> input[name=pass]', 'wrong'); await submit(pad); await pad.waitForTimeout(150);
  assert((await pad.innerText('.modal-wrap >> nth=-1 >> .form-error')).includes('isn’t your sync passphrase'), 'wrong passphrase can’t reset the code');
  await pad.fill('.modal-wrap >> nth=-1 >> input[name=pass]', 'correct horse battery'); await submit(pad); await pad.waitForTimeout(600);
  assert(await st(pad, () => !document.body.classList.contains('locked') && !S.settings.lockEnabled), 'right passphrase unlocks and clears the code, data kept');
  await st(pad, () => { modalStack.slice().forEach(m => m.close()); });
  await st(mac, () => { S.settings.lockEnabled = false; S.settings.pinHash = null; persist(); });
  await pad.context().close();
  await mac.goto(URL + '#/settings'); await mac.waitForTimeout(300);
  await mac.screenshot({ path: `${SP}/v3-mac-settings.png`, fullPage: true });

  console.log('== Backups');
  await mac.goto(URL + '#/dashboard'); await mac.waitForTimeout(200);
  assert((await mac.innerText('#view')).includes('Back up your data'), 'backup reminder shows when due');
  await mac.goto(URL + '#/settings'); await mac.selectOption('[data-change=setBackupFreq]', 'off'); await mac.goto(URL + '#/dashboard'); await mac.waitForTimeout(200);
  assert(!(await mac.innerText('#view')).includes('Back up your data'), 'reminder can be turned off');
  await mac.goto(URL + '#/settings'); await mac.selectOption('[data-change=setBackupFreq]', 'weekly');

  console.log('== Import');
  const csv = 'Athlete,Date,Test Type,Jump Height (in),mRSI,Time to Takeoff (ms),Peak Propulsive Force (N),Braking RFD (N/s),Body Weight (lbs)\n' +
    '"Thompson, Maya",10/20/2026,Countermovement Jump,15.0,0.50,700,1450,5600,126\n' +
    '"Thompson, Maya",10/20/2026,Countermovement Jump,15.6,0.52,690,1470,5700,126\n' +
    'Jordan Reyes,2026-10-21,CMJ,24.5,0.70,650,2500,8000,198\n' +
    'Jordan Reyes,2026-10-21,Squat Jump,22.0,,,2400,,198\n' +
    'Sam Newkid,10/21/2026,CMJ,18.0,0.45,800,1600,6000,150\n';
  require('fs').writeFileSync(SP + '/ovr.csv', csv);
  await mac.goto(URL + '#/athletes'); await mac.click('.top-actions [data-act=importCsv]'); await mac.waitForTimeout(200);
  await mac.setInputFiles('[data-file]', SP + '/ovr.csv'); await mac.waitForTimeout(300);
  const maps = await mac.$$eval('[data-map]', els => els.map(e => e.value));
  assert(JSON.stringify(maps) === JSON.stringify(['_name', '_date', '_type', 'cmj', 'rsiMod', 'ttt', 'cmjPF', 'brakeRfd', '_bm']), 'columns auto-mapped: ' + maps.join(','));
  const units = await mac.$$eval('[data-unit]', els => els.map(e => e.value));
  assert(units.join(',') === 'in,ms,lb', 'units detected (in, ms, lb): ' + units);
  await mac.selectOption('[data-fcol]', '2'); await mac.fill('[data-ftext]', 'c'); // matches "Countermovement" & "CMJ" only? 'c' also not in 'Squat Jump'
  await mac.fill('[data-ftext]', 'cm'); await mac.selectOption('[data-fcol]', '2');
  await mac.fill('[data-ftext]', 'c'); await mac.fill('[data-ftext]', 'CMJ');
  await submit(mac); await mac.waitForTimeout(200);
  assert((await mac.innerText('.form-error:not(.hidden)').catch(() => '')) === '', 'mapping accepted');
  const names = await mac.$$eval('[data-name]', els => els.map(e => [e.dataset.name, e.options[e.selectedIndex].text]));
  assert(names.length === 2 && names.some(n => n[0] === 'Jordan Reyes' && n[1] === 'Jordan Reyes') && names.some(n => n[0] === 'Sam Newkid' && n[1].includes('Create')), 'name filter + matching (CMJ rows only): ' + JSON.stringify(names));
  await mac.click('[data-back]'); await mac.fill('[data-ftext]', ''); await mac.selectOption('[data-fcol]', ''); await submit(mac); await mac.waitForTimeout(200);
  // all rows now: SJ row's "jump height" also maps to cmj — use filter excluding: test "Counter" + "CMJ" can't both; so filter on "J" excludes nothing. Instead skip Jordan SJ by filtering text 'm' (Countermovement, CMJ? no) -> use exact approach: keep all and accept
  await mac.click('[data-back]'); await mac.selectOption('[data-fcol]', '2'); await mac.fill('[data-ftext]', 'm'); await submit(mac); await mac.waitForTimeout(200);
  const names2 = await mac.$$eval('[data-name]', els => els.map(e => e.dataset.name));
  assert(names2.includes('Maya Thompson'), '"Last, First" names normalised');
  await submit(mac); await mac.waitForTimeout(200);
  assert((await mac.innerText('#impStep')).includes('Ready to import'), 'preview shown');
  await submit(mac); await mac.waitForTimeout(400);
  const imp = await st(mac, () => { const maya = S.athletes.find(a => a.firstName === 'Maya'); const t = S.tests.find(x => x.athleteId === maya.id && x.date === '2026-10-20'); const sam = S.athletes.find(a => a.firstName === 'Sam'); return { m: t?.m, bm: t?.bodyMassKg, sam: !!sam, samTest: sam && S.tests.some(x => x.athleteId === sam.id) }; });
  assert(Math.abs(imp.m.cmj - 39.62) < 0.01 && imp.m.ttt === 0.69 && imp.m.cmjPF === 1470 && imp.m.rsiMod === 0.52, 'best trial kept & units converted (15.6 in → 39.6 cm, 690 ms → 0.69 s)');
  assert(Math.abs(imp.bm - 57.15) < 0.05, 'body weight lb → kg');
  assert(imp.sam && imp.samTest, 'new athlete created with results');
  // re-open uses saved mapping
  await mac.click('.top-actions [data-act=importCsv]'); await mac.setInputFiles('[data-file]', SP + '/ovr.csv'); await mac.waitForTimeout(300);
  assert((await mac.$$eval('[data-map]', els => els.map(e => e.value))).join(',') === maps.join(','), 'mapping remembered');
  await mac.click('.modal-head [data-close]');

  console.log('== Gym floor');
  await st(ios, () => upsert('events', { type: 'session', date: today(), start: '23:00', duration: 45, athleteIds: [S.athletes[0].id], title: 'Late test', location: '', notes: '', status: 'scheduled' }));
  await ios.goto(URL + '#/floor'); await ios.waitForTimeout(400);
  await ios.screenshot({ path: `${SP}/v3-iphone-floor.png`, fullPage: true });
  const group = await st(ios, () => S.events.find(e => e.date === today() && e.athleteIds.length === 2).id);
  const [a1, a2] = await st(ios, id => getRec('events', id).athleteIds, group);
  await ios.click(`#ev-${group} [data-act=floorAtt][data-a="${a1}"][data-v=present]`); await ios.waitForTimeout(150);
  assert(await st(ios, id => getRec('events', id).status === 'scheduled', group), 'group stays open until everyone marked');
  await ios.click(`#ev-${group} [data-act=floorAtt][data-a="${a2}"][data-v=noshow]`); await ios.waitForTimeout(150);
  const ev = await st(ios, id => getRec('events', id), group);
  assert(ev.status === 'completed' && ev.attendance[a1] === 'present' && ev.attendance[a2] === 'noshow', 'per-athlete attendance recorded');
  assert(await st(ios, ([id, a]) => athleteStatus(getRec('events', id), a) === 'noshow', [group, a2]), 'no-show counts for that athlete only');
  // quick test → record
  await ios.click(`#ev-${group} [data-act=floorTest][data-a="${a1}"]`); await ios.waitForTimeout(200);
  await ios.click('#ftKeys [data-k=sprint10]'); await ios.fill('input[name=val]', '1.55'); await submit(ios); await ios.waitForTimeout(600);
  const toasts = await ios.$$eval('.toast', els => els.map(e => e.textContent).join(' | '));
  assert(toasts.includes('New GSP record') && toasts.includes('10 m sprint'), 'record toast: ' + toasts);
  await ios.click('[data-act=floorDone]'); await ios.waitForTimeout(200);
  assert(await st(ios, () => S.events.find(e => e.title === 'Late test').status === 'completed'), 'Finish completes the session');

  console.log('== Leaderboard');
  await ios.goto(URL + '#/leaderboard'); await ios.waitForTimeout(300);
  await ios.selectOption('[data-change=lbKey]', 'sprint10'); await ios.waitForTimeout(200);
  const vals = await ios.$$eval('.lb-table tbody tr td:nth-child(3) b', els => els.map(e => parseFloat(e.textContent)));
  assert(vals.length >= 4 && vals.every((v, i) => i === 0 || v >= vals[i - 1]) && vals[0] === 1.55, 'sprint ranks fastest first: ' + vals.join(','));
  assert((await ios.innerText('.lb-table')).includes('GSP record'), 'record holder badged');
  await ios.screenshot({ path: `${SP}/v3-iphone-leaderboard.png`, fullPage: true });
  await ios.selectOption('[data-change=lbKey]', 'cmj'); await ios.waitForTimeout(200);
  const cv = await ios.$$eval('.lb-table tbody tr td:nth-child(3) b', els => els.map(e => parseFloat(e.textContent)));
  assert(cv.every((v, i) => i === 0 || v <= cv[i - 1]), 'CMJ ranks highest first');
  await ios.selectOption('[data-k=sex]', 'F'); await ios.waitForTimeout(200);
  const fem = await ios.innerText('.lb-table');
  assert(!fem.includes('Jordan') && fem.includes('Maya'), 'sex filter works');
  await ios.selectOption('[data-k=sex]', 'all');
  await ios.goto(URL + '#/leaderboard/records'); await ios.waitForTimeout(300);
  const rec = (await ios.innerText('#view')).toUpperCase();
  assert(rec.includes('ALL-TIME RECORDS') && rec.includes('RECENTLY BROKEN'), 'records board + history');
  await ios.goto(URL + '#/dashboard'); await ios.waitForTimeout(300);
  assert((await ios.innerText('#view')).includes('new GSP record'), 'dashboard shows this week’s records');
  await mac.evaluate(() => A.syncNow()); await mac.waitForTimeout(500);
  await ios.evaluate(() => A.syncNow()); await ios.waitForTimeout(2500); await mac.evaluate(() => A.syncNow()); await mac.waitForTimeout(2500);
  await mac.goto(URL + '#/leaderboard/records'); await mac.waitForTimeout(400);
  assert((await mac.innerText('#view')).includes('1.55'), 'record set on iPhone appears on Mac after sync');
  await mac.screenshot({ path: `${SP}/v3-mac-records.png`, fullPage: true });
  await mac.goto(URL + '#/leaderboard'); await mac.waitForTimeout(300);
  await mac.screenshot({ path: `${SP}/v3-mac-leaderboard.png`, fullPage: true });
  await mac.goto(URL + '#/floor'); await mac.waitForTimeout(300);
  await mac.screenshot({ path: `${SP}/v3-mac-floor.png`, fullPage: true });
  for (const r of ['more', 'floor', 'leaderboard', 'leaderboard/records', 'dashboard', 'settings', 'athletes']) { await ios.goto(URL + '#/' + r); await ios.waitForTimeout(120); assert(!(await ios.innerText('#app')).includes('went wrong'), 'route OK ' + r); }
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
