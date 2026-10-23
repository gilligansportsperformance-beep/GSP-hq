// Performance HQ end-to-end tests — custom tests cloud backups
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const OUT = process.env.OUT_DIR || '.', BASE = process.env.BASE_URL || (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
// fake GitHub with version history
const gh = { versions: [] };
async function ghRoute(route) {
  const req = route.request(), url = new globalThis.URL(req.url());
  const json = (status, body) => route.fulfill({ status, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(body) });
  const cur = gh.versions[gh.versions.length - 1];
  if (url.pathname === '/repos/coach/data') return json(200, { private: true });
  if (url.pathname === '/repos/coach/data/commits') return json(200, [...gh.versions].reverse().map(v => ({ sha: v.sha, commit: { message: v.msg, committer: { date: v.date } } })));
  if (url.pathname.startsWith('/repos/coach/data/contents/')) {
    if (req.method() === 'GET') {
      const ref = url.searchParams.get('ref');
      const v = ref ? gh.versions.find(x => x.sha === ref) : cur;
      if (!v) return json(404, { message: 'Not Found' });
      if ((req.headers()['accept'] || '').includes('raw')) return route.fulfill({ status: 200, headers: { 'content-type': 'text/plain', 'access-control-allow-origin': '*' }, body: v.file });
      return json(200, { sha: v.sha, content: Buffer.from(v.file).toString('base64') });
    }
    const body = JSON.parse(req.postData());
    if ((cur?.sha) !== body.sha) return json(409, { message: 'sha does not match' });
    const sha = 'v' + (gh.versions.length + 1);
    gh.versions.push({ sha, file: Buffer.from(body.content, 'base64').toString('utf8'), msg: body.message, date: new Date(Date.now() - (10 - gh.versions.length) * 3600e3).toISOString() });
    return json(200, { content: { sha } });
  }
  return json(404, {});
}
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const mk = async (label, opts) => {
    const ctx = await browser.newContext(opts); const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`[${label}] ${e.message}`));
    p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(`[${label}] ${m.text()}`); });
    await p.route('https://api.github.com/**', ghRoute); return p;
  };
  const mac = await mk('mac', { viewport: { width: 1440, height: 900 } }), ios = await mk('iphone', { ...devices['iPhone 13'] });
  const submit = p => p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]');
  const setup = async p => {
    await p.goto(BASE + '#/settings'); await p.click('.card [data-act=syncSetup]');
    await p.fill('input[name=repo]', 'coach/data'); await p.fill('input[name=token]', 'ghp_x'); await p.fill('input[name=pass]', 'passphrase1'); await p.fill('input[name=pass2]', 'passphrase1');
    await submit(p); await p.waitForTimeout(2500);
  };
  console.log('== Custom tests');
  await mac.goto(BASE); await mac.waitForSelector('.modal'); await mac.check('input[name=demo]'); await submit(mac); await mac.waitForTimeout(700);
  await mac.goto(BASE + '#/settings'); await mac.click('[data-act=customTests]');
  await mac.click('[data-cnew]'); await mac.fill('.modal-wrap >> nth=-1 >> input[name=label]', 'Med ball chest throw');
  await mac.selectOption('.modal-wrap >> nth=-1 >> select[name=kind]', 'len'); await mac.selectOption('.modal-wrap >> nth=-1 >> select[name=cat]', 'jump');
  await submit(mac); await mac.waitForTimeout(200);
  await mac.click('[data-cnew]'); await mac.fill('.modal-wrap >> nth=-1 >> input[name=label]', 'Grip strength'); await mac.fill('.modal-wrap >> nth=-1 >> input[name=unit]', 'kg');
  await submit(mac); await mac.waitForTimeout(200);
  await mac.click('[data-cnew]'); await mac.fill('.modal-wrap >> nth=-1 >> input[name=label]', 'CMJ height'); await submit(mac); await mac.waitForTimeout(150);
  assert((await mac.innerText('.modal-wrap >> nth=-1 >> .form-error')).includes('already exists'), 'duplicate test names rejected');
  await mac.click('.modal-wrap >> nth=-1 >> [data-close]'); await mac.click('.modal-wrap >> nth=-1 >> [data-close]');
  const keys = await mac.evaluate(() => customKeys());
  assert(keys.length === 2 && await mac.evaluate(k => M[k[0]].kind === 'len' && M[k[0]].cat === 'jump' && M[k[1]].unit === 'kg', keys), 'custom tests registered (distance in Jumps; kg number)');
  // enter via test form
  const aid = await mac.evaluate(() => S.athletes.find(a => a.firstName === 'Maya').id);
  await mac.goto(BASE + `#/athlete/${aid}/testing`); await mac.click('.top-actions [data-act=newTest]');
  await mac.fill(`input[name=m_${keys[0]}]`, '240'); await mac.fill(`input[name=m_${keys[1]}]`, '31.5'); await submit(mac); await mac.waitForTimeout(300);
  const t = await mac.evaluate(k => S.tests.filter(x => x.m[k] != null).pop(), keys[0]);
  assert(Math.abs(t.m[keys[0]] - 609.6) < 0.01 && t.m[keys[1]] === 31.5, 'custom results saved (240 in → 609.6 cm)');
  assert((await mac.innerText('#view')).includes('Med ball chest throw'), 'custom test shown in Testing tab');
  // group testing + leaderboard + records + report + CSV
  const jid = await mac.evaluate(() => S.athletes.find(a => a.firstName === 'Jordan').id);
  await mac.evaluate(([k, id]) => { upsert('tests', { athleteId: id, date: addDays(today(), -1), m: { [k]: 701 }, sides: {} }); }, [keys[0], jid]);
  await mac.goto(BASE + '#/athletes'); await mac.click('.top-actions [data-act=groupTest]');
  assert((await mac.innerText('#gKeys')).includes('Grip strength'), 'custom tests offered in group testing');
  await mac.click('.modal-head [data-close]');
  await mac.goto(BASE + '#/leaderboard'); await mac.selectOption('[data-change=lbKey]', keys[0]); await mac.waitForTimeout(200);
  const lb = await mac.$$eval('.lb-table tbody tr td:nth-child(2)', els => els.map(e => e.textContent.trim()));
  assert(lb[0].includes('Jordan') && lb[1].includes('Maya'), 'custom test leaderboard ranks correctly');
  await mac.goto(BASE + '#/leaderboard/records'); await mac.waitForTimeout(200);
  assert((await mac.innerText('#view')).toUpperCase().includes('MED BALL CHEST THROW'), 'custom test has a GSP record');
  await mac.goto(BASE + `#/reports?athlete=${aid}`); await mac.waitForTimeout(300);
  assert((await mac.innerText('#reportPaper')).includes('Grip strength'), 'custom test in reports');
  // edit + delete
  await mac.goto(BASE + '#/settings'); await mac.click('[data-act=customTests]'); await mac.click(`[data-ced="${keys[1]}"]`);
  assert(await mac.locator('.modal-wrap >> nth=-1 >> select[name=kind][disabled]').count() === 1, 'result type locked once data exists');
  await mac.click('.modal-wrap >> nth=-1 >> [data-del]'); await mac.click('.dialog .btn.danger'); await mac.waitForTimeout(200);
  assert(await mac.evaluate(k => !M[k] && S.tests.some(t => t.m[k] === 31.5), keys[1]), 'deleting hides the test but keeps the data');
  await mac.click('.modal-wrap >> nth=-1 >> [data-close]');

  console.log('== Cloud backups');
  await setup(mac);
  assert(gh.versions.length === 1, 'first cloud version saved');
  await ios.goto(BASE); await ios.waitForSelector('.modal'); await ios.click('.modal-head [data-close]');
  await setup(ios);
  assert(await ios.evaluate(k => !!M[k] && S.tests.some(t => t.m[k] === 609.6), keys[0]), 'custom test + results synced to the other device');
  const before = await mac.evaluate(() => ({ a: S.athletes.length, t: S.tests.length }));
  // a mistake: delete an athlete and add junk, synced to both devices
  await mac.evaluate(id => { removeRec('athletes', id); upsert('athletes', { firstName: 'Mistake', lastName: 'Entry' }); }, aid);
  await mac.evaluate(() => A.syncNow()); await mac.waitForTimeout(2500);
  await ios.evaluate(() => A.syncNow()); await ios.waitForTimeout(2500);
  assert(await ios.evaluate(id => !getAthlete(id) && S.athletes.some(a => a.firstName === 'Mistake'), aid), 'mistake reached both devices');
  await ios.goto(BASE + '#/settings'); await ios.click('[data-act=cloudBackups]'); await ios.waitForTimeout(1500);
  const rowsN = await ios.locator('[data-cb-restore]').count();
  assert(rowsN >= 1 && (await ios.innerText('#cbList')).includes('Current'), `versions listed (${gh.versions.length} saved)`);
  await ios.screenshot({ path: OUT + '/cloud-backups.png' });
  await ios.click(`[data-cb-preview="v1"]`); await ios.waitForTimeout(1500);
  assert((await ios.innerText('.dialog')).includes(`${before.a} athletes`), 'preview shows version contents');
  await ios.click('.dialog [data-i="0"]');
  await ios.click(`[data-cb-restore="v1"]`); await ios.waitForTimeout(1500); await ios.click('.dialog .btn.danger'); await ios.waitForTimeout(3500);
  assert(await ios.evaluate(id => !!getAthlete(id) && !S.athletes.some(a => a.firstName === 'Mistake'), aid), 'restore brings back the deleted athlete and removes the mistake');
  await mac.evaluate(() => A.syncNow()); await mac.waitForTimeout(2500);
  assert(await mac.evaluate(id => !!getAthlete(id) && !S.athletes.some(a => a.firstName === 'Mistake'), aid), 'restore propagates to the other device');
  assert(await mac.evaluate(() => S.athletes.length) === before.a, 'athlete count back to the restored version');
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
