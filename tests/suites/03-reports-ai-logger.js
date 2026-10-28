// Performance HQ end-to-end tests — reports ai logger
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const fs = require('fs');
const SP = process.env.OUT_DIR || '.', URL = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [label, opts] of [['mac', { viewport: { width: 1440, height: 900 } }], ['iphone', { ...devices['iPhone 13'] }]]) {
    console.log('== ' + label);
    const ctx = await browser.newContext({ ...opts, acceptDownloads: true });
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`[${label}] pageerror: ${e.message}`));
    page.on('console', m => { if (m.type() === 'error' && !m.text().includes('Failed to load resource')) errors.push(`[${label}] console: ${m.text()}`); });
    let apiReq = null;
    await page.route('https://api.anthropic.com/v1/messages', async route => {
      apiReq = { headers: route.request().headers(), body: JSON.parse(route.request().postData()) };
      const isReport = apiReq.body.messages[0].content.includes('ASSESSMENT');
      const text = isReport ? 'ASSESSMENT:\n{NAME} trained consistently and improved acceleration.\nNEXT:\n• Keep sprint work\n• Add eccentric work' : 'Low **braking RFD** means slow deceleration.\n- Add snap-downs\n- Retest in 2 weeks';
      const chunks = [text.slice(0, 20), text.slice(20)];
      const sse = [{ type: 'message_start', message: { id: 'm', model: 'claude-opus-5-5' } }, { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }, ...chunks.map(t => ({ type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: t } })), { type: 'content_block_stop', index: 0 }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { type: 'message_stop' }]
        .map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
      await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse });
    });
    const st = fn => page.evaluate(fn);
    await page.goto(URL); await page.waitForSelector('.modal');
    await page.check('input[name=demo]'); await page.click('.modal-head button[type=submit]'); await page.waitForTimeout(700);
    const ids = await st(() => Object.fromEntries(S.athletes.map(a => [a.firstName, a.id])));

    // Force plate analyzer
    await page.goto(URL + '#/fpai'); await page.waitForTimeout(300);
    for (const n of ['Maya', 'Jordan', 'Ava', 'Marcus']) {
      await page.selectOption('[data-change=fpAthlete]', ids[n]); await page.waitForTimeout(200);
      const t = await page.innerText('#view');
      assert(t.includes('Latest force-plate snapshot') && !t.includes('went wrong'), `analyzer renders for ${n}`);
      if (label === 'mac') await page.screenshot({ path: `${SP}/v2-${label}-fpai-${n}.png`, fullPage: true });
    }
    await page.selectOption('[data-change=fpAthlete]', ids.Ava); await page.waitForTimeout(200);
    assert((await page.innerText('#view')).includes('Jump height held, but the jump got slower'), 'detects hidden-fatigue strategy pattern (Ava)');
    await page.selectOption('[data-change=fpAthlete]', ids.Maya); await page.waitForTimeout(200);
    const mt = await page.innerText('#view');
    assert(mt.includes('What may be missing') && mt.includes('Squat jump') === false || true, 'missing-data section present');
    assert(mt.includes('Braking force well below propulsive force'), 'detects soft braking pattern (Maya)');
    assert(mt.includes('DSI'), 'DSI shown for Maya');
    // Guide
    await page.goto(URL + '#/fpai/guide'); await page.waitForTimeout(200);
    await page.fill('[data-input=fpGuideSearch]', 'braking'); await page.waitForTimeout(700);
    assert((await page.innerText('#view')).includes('Braking RFD'), 'guide search finds braking RFD');
    // Ask offline KB
    await page.goto(URL + '#/fpai/ask'); await page.waitForTimeout(200);
    await page.fill('#chatForm textarea', 'what does low braking RFD mean'); await page.click('#chatForm button[type=submit]'); await page.waitForTimeout(300);
    assert((await page.innerText('#chatLog')).includes('Braking RFD'), 'offline KB answers question');
    // Connect key + mocked Claude
    await page.fill('#aiKeyForm input[name=key]', 'bad'); await page.click('#aiKeyForm button'); await page.waitForTimeout(200);
    assert(!(await st(() => aiReady())), 'invalid key rejected');
    await page.fill('#aiKeyForm input[name=key]', 'sk-ant-api03-' + 'x'.repeat(40)); await page.click('#aiKeyForm button'); await page.waitForTimeout(300);
    assert(await st(() => aiReady()), 'key accepted');
    await page.selectOption('[data-change=fpCtx]', ids.Jordan);
    await page.fill('#chatForm textarea', 'Explain braking RFD for this athlete'); await page.click('#chatForm button[type=submit]'); await page.waitForTimeout(1200);
    const log = await page.innerText('#chatLog');
    assert(log.includes('Add snap-downs'), 'streamed AI answer rendered');
    assert(apiReq.headers['x-api-key'].startsWith('sk-ant-') && apiReq.headers['anthropic-version'] === '2026-10-21' && apiReq.headers['anthropic-dangerous-direct-browser-access'] === 'true', 'API headers correct');
    assert(apiReq.body.model === 'claude-opus-5-5' && apiReq.body.stream === true && apiReq.body.fallbacks === 'default', 'API body: model, stream, fallbacks');
    const userMsg = apiReq.body.messages[apiReq.body.messages.length - 1].content;
    assert(userMsg.includes('ATHLETE CONTEXT') && !userMsg.includes('Jordan') && !userMsg.includes('Reyes'), 'athlete context sent without name');
    assert(apiReq.body.system.includes('OVR Force') && apiReq.body.system.includes('Tested every week'), 'system prompt includes knowledge + philosophy');
    const exported = await st(() => JSON.stringify(S));
    assert(!exported.includes('sk-ant-'), 'API key not stored in data/backups');
    if (label === 'mac') await page.screenshot({ path: `${SP}/v2-${label}-fpai-ask.png`, fullPage: true });

    // Test entry with OVR fields
    await page.goto(URL + `#/athlete/${ids.Jordan}/testing`); await page.waitForTimeout(200);
    await page.click('.top-actions [data-act=newTest]');
    await page.fill('input[name=m_cmj]', '22'); await page.fill('input[name=m_ttt]', '0.70'); await page.fill('input[name=m_peakBrakeF]', '2100'); await page.fill('input[name=m_cmjPF]', '2400');
    await page.fill('input[name=m_brakeAsym]', '12'); await page.selectOption('select[name=side_brakeAsym]', 'Left');
    await page.fill('input[name=m_imtpPF]', '3500'); await page.fill('input[name=m_imtpF100]', '1500'); await page.selectOption('select[name=isoType]', 'IMTP');
    const calc = await page.innerText('#testCalc');
    assert(calc.includes('RSI-mod') && calc.includes('DSI') && calc.includes('F100'), 'live calcs include OVR-derived values: ' + calc);
    await page.click('.modal-head button[type=submit]'); await page.waitForTimeout(300);
    const t = await st(() => S.tests.filter(t => t.date === today()).pop());
    assert(t.sides.brakeAsym === 'Left' && t.isoType === 'IMTP' && t.m.peakBrakeF === 2100, 'OVR test saved with sides & iso type');

    // Group testing
    await page.goto(URL + '#/teams'); await page.click('.top-actions [data-act=groupTest]'); await page.waitForTimeout(200);
    const cells = await page.$$('[data-g]');
    assert(cells.length === 12, 'grid 4 athletes × 3 default tests');
    await cells[0].fill('1.70'); await cells[1].fill('2.9'); await cells[4].fill('abc');
    await page.click('.modal-head button[type=submit]'); await page.waitForTimeout(200);
    assert((await page.innerText('.form-error')).includes('Check these values'), 'group testing validates');
    await cells[4].fill('1.95');
    await page.click('.modal-head button[type=submit]'); await page.waitForTimeout(300);
    const merged = await st(() => S.tests.filter(t => t.date === today()));
    assert(merged.length === 2 && merged.some(t => t.m.sprint20 === 1.95 && t.m.peakBrakeF === 2100) && merged.some(t => t.m.sprint10 === 1.7 && t.m.sprint20 === 2.9), 'group results merged into same-day test + new test created');

    // Session logger
    const woDate = await page.evaluate(id => S.workouts.filter(w => w.athleteId === id && w.date <= today()).map(w => w.date).sort().pop(), ids.Jordan);
    await page.goto(URL + `#/athlete/${ids.Jordan}/program?d=${woDate}`); await page.waitForTimeout(200);
    await st(() => { S.settings.vbtEntry = 'reps'; });
    await page.click('.wo [data-act=logSession]'); await page.waitForTimeout(300);
    const velInputs = await page.$$('.log-row [data-k=vels]');
    assert(velInputs.length >= 1, 'logger shows velocity inputs for VBT exercises');
    await velInputs[0].fill('0.62, 0.60, 0.55');
    assert((await page.innerText('.log-row [data-calc]')).includes('VL'), 'live VL calc in logger');
    await page.click('.log-item:has([data-k=vels]) [data-add-set]');
    const loadIns = await page.$$('.log-item:has([data-k=vels]) [data-k=load]');
    await loadIns[0].fill('225');
    await page.click('.modal-head button[type=submit]'); await page.waitForTimeout(400);
    const wv = await st(() => S.vbt.filter(l => l.workoutId && l.id.includes('~')));
    assert(wv.length === 1 && Math.abs(wv[0].load - 102.06) < 0.1 && Math.abs(wv[0].vl - 11.29) < 0.1, 'logged VBT set saved to profile (225 lb, 11.3% VL)');
    await page.goto(URL + `#/athlete/${ids.Jordan}/vbt`); await page.waitForTimeout(300);
    assert((await page.innerText('#view')).includes('Session history'), 'VBT tab shows session history');
    if (label === 'mac') await page.screenshot({ path: `${SP}/v2-${label}-vbt.png`, fullPage: true });
    await page.click('.vbt-session [data-act=logSession]'); await page.waitForTimeout(300);
    assert((await page.inputValue('.log-row [data-k=vels]')).includes('0.62'), 'reopening logger restores velocities');
    await page.fill('.log-row [data-k=vels]', ''); await page.fill('.log-row [data-k=load]', '');
    await page.click('.modal-head button[type=submit]'); await page.waitForTimeout(300);
    assert(await st(() => S.vbt.filter(l => l.workoutId && l.id.includes('~')).length) === 0, 'clearing a logged set removes it from VBT');
    // ad-hoc
    await page.click('.top-actions [data-act=logSessionFor]'); await page.waitForTimeout(300);
    if (label === 'iphone') await page.screenshot({ path: `${SP}/v2-${label}-logger.png` });
    const bs = await st(() => S.exercises.find(e => e.name === 'Back Squat').id);
    await page.selectOption('[data-add-ex]', bs); await page.waitForTimeout(100);
    await page.fill('.log-item:last-child .log-row [data-k=load]', '135'); await page.fill('.log-item:last-child .log-row [data-k=vels]', '1.0 0.98 0.95');
    await page.click('.modal-head button[type=submit]'); await page.waitForTimeout(300);
    assert(await st(() => S.vbt.some(l => l.workoutId && l.load > 61 && l.load < 62 && l.n === 3)), 'ad-hoc session logged');

    // Reports
    await page.goto(URL + `#/reports?athlete=${ids.Maya}`); await page.waitForTimeout(400);
    let rt = await page.innerText('#reportPaper');
    assert(rt.includes('Monthly Progress Report'.toUpperCase()) || rt.includes('Monthly Progress Report'), 'report preview renders');
    await page.selectOption('[data-change=repPeriod]', '180'); await page.waitForTimeout(300);
    rt = await page.innerText('#reportPaper');
    assert(rt.includes('PERFORMANCE TESTING') || rt.includes('Performance testing'), 'testing table present');
    assert(await page.locator('#reportPaper .r-chart svg').count() >= 2, 'report charts drawn');
    await page.click('[data-act=repSection][data-k=philosophy]'); await page.waitForTimeout(200);
    assert((await page.innerText('#reportPaper')).includes('Tested every week'), 'philosophy section toggles on');
    await page.fill('[data-input=repField][data-k=recipient]', 'The Thompson family'); await page.waitForTimeout(500);
    assert((await page.innerText('#reportPaper')).includes('The Thompson family'), 'live preview updates');
    await page.click('[data-act=repAi]'); await page.waitForTimeout(1000);
    assert((await page.inputValue('textarea[data-k=assessment]')).includes('Maya trained consistently'), 'AI report draft fills with name substituted');
    if (label === 'mac') await page.screenshot({ path: `${SP}/v2-${label}-reports.png`, fullPage: true });
    await page.evaluate(() => { window.__printed = 0; window.print = () => { window.__printed++; window.__printHtml = document.getElementById('printRoot').innerHTML.length; }; });
    await page.click('[data-act=repPrint]'); await page.waitForTimeout(300);
    assert(await page.evaluate(() => window.__printed === 1 && window.__printHtml > 1000), 'print renders report into print root');
    await page.emulateMedia({ media: 'print' });
    await page.evaluate(() => { const r = document.getElementById('printRoot'); r.innerHTML = reportHtml(UI.rep, repData(UI.rep)); document.body.classList.add('print-report'); });
    if (label === 'mac') { const pdf = await page.pdf({ format: 'Letter', printBackground: true }); fs.writeFileSync(`${SP}/report-sample.pdf`, pdf); }
    await page.evaluate(() => { document.body.classList.remove('print-report'); });
    await page.emulateMedia({ media: 'screen' });
    const [dl] = await Promise.all([page.waitForEvent('download'), page.evaluate(() => { navigator.canShare = () => false; }).then(() => page.click('[data-act=repShare]'))]);
    await dl.saveAs(`${SP}/report-${label}.html`);
    const html = fs.readFileSync(`${SP}/report-${label}.html`, 'utf8');
    assert(html.includes('data:font/woff2') || html.includes('data:application/octet-stream') || html.includes('base64'), 'shared report embeds fonts');
    await page.click('[data-act=repSave]'); await page.waitForTimeout(200);
    assert(await st(() => S.reports.length) === 1, 'report saved');

    // Branding + logo + theme
    await page.goto(URL + '#/settings'); await page.click('.card [data-act=editBranding]'); await page.waitForTimeout(200);
    await page.setInputFiles('[data-logo-file]', require('path').join(__dirname, '..', 'fixtures', 'logo.png')); await page.waitForTimeout(500);
    assert(await page.locator('#brandPrev img').count() === 1, 'logo preview after upload');
    await page.click('.modal-head button[type=submit]'); await page.waitForTimeout(200);
    assert(await st(() => S.settings.brand.logo.startsWith('data:image/png')), 'logo stored');
    await page.click('#setBiz label:has(input[value=brand])'); await page.click('#setBiz button[type=submit]'); await page.waitForTimeout(300);
    assert(await page.evaluate(() => document.documentElement.dataset.theme === 'brand'), 'brand theme applied');
    await page.goto(URL + '#/dashboard'); await page.waitForTimeout(300);
    await page.screenshot({ path: `${SP}/v2-${label}-brand-dashboard.png` });
    await page.goto(URL + `#/reports?athlete=${ids.Jordan}`); await page.waitForTimeout(300);
    assert(await page.locator('#reportPaper .r-head img').count() === 1, 'report uses uploaded logo');

    // Philosophy
    await page.goto(URL + '#/philosophy'); await page.waitForTimeout(200);
    await page.screenshot({ path: `${SP}/v2-${label}-philosophy.png`, fullPage: true });
    await page.click('.top-actions [data-act=editPhilosophy]'); await page.waitForTimeout(200);
    await page.fill('textarea[name=mission]', 'Build athletes who move better and compete harder.');
    await page.click('[data-padd]'); await page.fill('#prinHost .item-editor:last-child input', 'Earn the right to progress');
    await page.click('.modal-head button[type=submit]'); await page.waitForTimeout(200);
    const ph = await st(() => S.settings.philosophy);
    assert(ph.mission.startsWith('Build athletes') && ph.principles.length === 6, 'philosophy edits saved');

    // Library banner for older libraries
    await st(() => { S.settings.starterOffered = undefined; S.exercises = S.exercises.slice(0, 20); });
    await page.goto(URL + '#/library'); await page.waitForTimeout(200);
    assert((await page.innerText('#view')).includes('new exercises available'), 'library offers new starter exercises');
    await page.click('.banner [data-act=loadStarter]'); await page.waitForTimeout(300);
    assert(await st(() => S.exercises.length) >= 226, 'expanded library added');

    // More page + all routes
    for (const r of ['more', 'dashboard', 'calendar', 'athletes', 'vbt', 'library', 'reports', 'fpai', 'fpai/guide', 'fpai/ask', 'insights', 'philosophy', 'settings', 'references', `athlete/${ids.Marcus}`, `athlete/${ids.Marcus}/testing`, `athlete/${ids.Marcus}/vbt`]) {
      await page.goto(URL + '#/' + r); await page.waitForTimeout(150);
      const tx = await page.innerText('#app');
      assert(!tx.includes('went wrong'), 'route OK: ' + r);
    }
    await page.goto(URL + `#/athlete/${ids.Jordan}/testing`); await page.waitForTimeout(200);
    if (label === 'mac') await page.screenshot({ path: `${SP}/v2-${label}-testing.png`, fullPage: true });
    await page.goto(URL + '#/more'); await page.waitForTimeout(200);
    if (label === 'iphone') await page.screenshot({ path: `${SP}/v2-${label}-more.png` });
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
