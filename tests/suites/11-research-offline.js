// Performance HQ end-to-end tests — Research AI (search, read, cite, reference check, pause_turn), offline start-up, updates, save/sync status
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const sse = evs => evs.map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
const blockStart = (index, content_block) => ({ type: 'content_block_start', index, content_block });
const delta = (index, d) => ({ type: 'content_block_delta', index, delta: d });
const stop = index => ({ type: 'content_block_stop', index });
const PUB = 'https://pubmed.ncbi.nlm.nih.gov/111/', JOUR = 'https://journals.example.org/doi/10.1519/JSC.0000000000001234';
const searchResult = { type: 'web_search_tool_result', tool_use_id: 'srvtoolu_1', content: [{ type: 'web_search_result', url: PUB, title: 'Plyometrics in youth: a meta-analysis', encrypted_content: 'enc1', page_age: null }, { type: 'web_search_result', url: JOUR, title: 'Jump training trial', encrypted_content: 'enc2' }] };
const fetchResult = { type: 'web_fetch_tool_result', tool_use_id: 'srvtoolu_2', content: { type: 'web_fetch_result', url: PUB, content: { type: 'document', source: { type: 'text', media_type: 'text/plain', data: 'Abstract: plyometric training improved jumping…' }, title: 'Plyometrics in youth: a meta-analysis', citations: { enabled: true } }, retrieved_at: '2026-10-27T10:00:00Z' } };
const RESP1 = sse([
  { type: 'message_start', message: { id: 'm1', usage: { input_tokens: 10 } } },
  blockStart(0, { type: 'thinking', thinking: '', signature: '' }), delta(0, { type: 'thinking_delta', thinking: 'Looking for meta-analyses on youth plyometrics.' }), delta(0, { type: 'signature_delta', signature: 'sig123' }), stop(0),
  blockStart(1, { type: 'server_tool_use', id: 'srvtoolu_1', name: 'web_search' }), delta(1, { type: 'input_json_delta', partial_json: '{"query":"plyometric training youth' }), delta(1, { type: 'input_json_delta', partial_json: ' meta-analysis"}' }), stop(1),
  blockStart(2, searchResult), stop(2),
  blockStart(3, { type: 'server_tool_use', id: 'srvtoolu_2', name: 'web_fetch' }), delta(3, { type: 'input_json_delta', partial_json: JSON.stringify({ url: PUB }) }), stop(3),
  blockStart(4, fetchResult), stop(4),
  { type: 'message_delta', delta: { stop_reason: 'pause_turn' }, usage: { output_tokens: 50 } }, { type: 'message_stop' },
]);
const ANSWER_A = '**Bottom line:** Supervised plyometric training is safe and improves jumping and sprinting in youth';
const ANSWER_B = '.\n\n**References:**\n1. Smith (2020). Plyometrics in youth. JSCR. [link](https://pubmed.ncbi.nlm.nih.gov/111/)\n2. Jones (2019). Jump training trial. [link](https://doi.org/10.1519/JSC.0000000000001234)\n3. Made Up (2021). Not real. [link](https://fake.example.com/paper)\n4. Trap [x](javascript:alert(1))';
const RESP2 = sse([
  { type: 'message_start', message: { id: 'm2' } },
  blockStart(0, { type: 'text', text: '' }), delta(0, { type: 'text_delta', text: ANSWER_A }),
  delta(0, { type: 'citations_delta', citation: { type: 'web_search_result_location', url: PUB, title: 'Plyometrics in youth: a meta-analysis', encrypted_index: 'ei', cited_text: 'Plyometric training improved jump height. See https://evil.example/onclick=alert(1)//' } }), stop(0),
  blockStart(1, { type: 'text', text: '' }), delta(1, { type: 'text_delta', text: ANSWER_B }), stop(1),
  { type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { type: 'message_stop' },
]);

(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const watch = (p, label) => { p.on('pageerror', e => errors.push(`[${label}] ${e.message}`)); p.on('console', m => { if (m.type() === 'error' && !/Failed to load resource|ERR_|net::/.test(m.text())) errors.push(`[${label}] ${m.text()}`); }); };
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage(); watch(p, 'iphone');
  const st = (fn, a) => p.evaluate(fn, a);
  const submit = () => p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]');
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(700);

  console.log('== Research AI');
  await p.goto(BASE + '#/research'); await p.waitForTimeout(300);
  assert((await p.innerText('#view')).includes('Connect Claude') && await p.locator('#aiKeyForm').count() === 1, 'asks to connect Claude first (same key as Force Plate AI)');
  const reqs = []; let mode = 'normal';
  await p.route('https://api.anthropic.com/v1/messages', async route => {
    const body = JSON.parse(route.request().postData()); reqs.push(body);
    if (mode === 'slow') { await new Promise(r => setTimeout(r, 4000)); return route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: RESP2 }).catch(() => {}); }
    const isResume = body.messages.length === 2 && body.messages[1].role === 'assistant';
    const isFp = !body.tools;
    const text = isFp ? sse([{ type: 'message_start', message: { id: 'f' } }, blockStart(0, { type: 'text', text: '' }), delta(0, { type: 'text_delta', text: 'Force plate answer.' }), stop(0), { type: 'message_delta', delta: { stop_reason: 'end_turn' } }]) : isResume ? RESP2 : RESP1;
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: text });
  });
  await p.fill('#aiKeyForm input[name=key]', 'sk-ant-api03-' + 'x'.repeat(40)); await p.click('#aiKeyForm button'); await p.waitForTimeout(300);
  assert(await p.locator('#rsForm').count() === 1 && await p.locator('[data-act=rsSuggest]').count() === 4, 'question box and starter questions appear once connected');
  await p.fill('#rsForm textarea', 'Is plyometric training safe and effective for 10–13 year olds?');
  await p.click('#rsForm button[type=submit]'); await p.waitForTimeout(1500);
  const r1 = reqs[0], r2 = reqs[1];
  assert(r1.model === 'claude-opus-5-5' && r1.thinking.type === 'adaptive' && r1.output_config.effort === 'high' && r1.stream === true, 'uses Claude Opus 5.5 with adaptive thinking at high effort, streaming');
  assert(r1.tools.some(t => t.type === 'web_search_20260209') && r1.tools.some(t => t.type === 'web_fetch_20260209' && t.citations?.enabled), 'searches the web and reads pages (with citations)');
  assert(/Never invent studies/.test(r1.system) && /at least two independent sources/.test(r1.system) && /systematic reviews and meta-analyses/.test(r1.system), 'instructions: best evidence first, open sources, cross-check, never invent');
  assert(!JSON.stringify(r1).includes('Maya') && !JSON.stringify(r1).includes('Thompson'), 'no athlete names sent');
  assert(r2 && r2.messages.length === 2, 'paused research turn is resumed with a second request');
  const resumed = r2.messages[1].content;
  assert(resumed.length === 5 && resumed[0].type === 'thinking' && resumed[0].signature === 'sig123' && resumed[0].thinking.startsWith('Looking'), 'resume sends the thinking block back unchanged (with signature)');
  assert(resumed[1].type === 'server_tool_use' && resumed[1].input.query === 'plyometric training youth meta-analysis' && !('_json' in resumed[1]), 'search call rebuilt exactly from the stream');
  assert(JSON.stringify(resumed[2]) === JSON.stringify(searchResult) && JSON.stringify(resumed[4]) === JSON.stringify(fetchResult) && resumed[3].input.url === PUB, 'search results and fetched page passed back unchanged');
  const ans = await p.innerText('#rsLog .rs-msg.assistant');
  assert(ans.includes('Bottom line') && !ans.includes('Looking for meta-analyses'), 'shows the final answer only');
  assert(await p.locator('#rsLog .ref-ok').count() === 2 && await p.locator('#rsLog .ref-warn').count() === 1, 'reference check: PubMed and DOI links ✓ (found during research), invented link ⚠');
  assert((await p.innerText('#rsLog .rs-check')).includes('1 of 3 reference links weren’t found'), 'summary warns about the unverified reference');
  assert(await p.locator('#rsLog a[href^="javascript"]').count() === 0 && await p.locator('#rsLog [onclick]').count() === 0, 'unsafe links and injected attributes are never rendered');
  assert(await p.locator('#rsLog .rs-cite').count() === 1 && (await p.getAttribute('#rsLog .rs-cite', 'href')) === PUB, 'quoted passage links to its source (↗)');
  assert((await p.innerText('#rsLog details.rs-sources summary')).includes('1 search, 1 source read'), 'research trail: searches and sources read');
  const fits = await st(() => document.documentElement.scrollWidth <= 391);
  assert(fits, 'Research AI fits the iPhone screen');
  await p.click('#rsLog details.rs-sources summary'); await p.waitForTimeout(100);
  await p.screenshot({ path: SP + '/v17-research.png', fullPage: true });
  // follow-up carries the previous answer as context
  await p.fill('#rsForm textarea', 'And for 14–16 year olds?'); await p.click('#rsForm button[type=submit]'); await p.waitForTimeout(1500);
  const r3 = reqs[2];
  assert(r3.messages.length === 1 && r3.messages[0].content.startsWith('Earlier in this conversation') && r3.messages[0].content.includes('Supervised plyometric training') && r3.messages[0].content.endsWith('And for 14–16 year olds?'), 'follow-up question includes the earlier answer as context');
  // stop
  mode = 'slow';
  await p.fill('#rsForm textarea', 'Slow question'); await p.click('#rsForm button[type=submit]'); await p.waitForTimeout(500);
  assert(await p.locator('#rsLive .rs-status').count() === 1, 'live progress shown while researching');
  await p.click('[data-act=rsStop]'); await p.waitForTimeout(600);
  assert((await p.innerText('#rsLog')).includes('Stopped before finishing') && await p.locator('#rsForm button[type=submit]').count() === 1, 'Stop cancels the research');
  mode = 'normal';
  // saved on the device
  await p.reload(); await p.waitForTimeout(900);
  assert(await p.locator('#rsLog .rs-msg.user').count() === 3 && await p.locator('#rsLog .ref-warn').count() >= 1, 'answers are kept on the device after reopening');
  await p.context().setOffline(true); await p.evaluate(() => window.dispatchEvent(new Event('offline'))); await p.goto(BASE + '#/research'); await p.waitForTimeout(300);
  assert((await p.innerText('#view')).includes('Research AI needs the internet') && await p.locator('#rsLog .rs-msg').count() === 6, 'offline: saved answers still readable, asking is disabled');
  await p.context().setOffline(false);
  // Force Plate AI stays about force plates
  await p.goto(BASE + '#/fpai/ask'); await p.waitForTimeout(300);
  await p.fill('#chatForm textarea', 'What is a good warm-up?'); await p.click('#chatForm button[type=submit]'); await p.waitForTimeout(800);
  const fpReq = reqs.find(b => !b.tools);
  assert(fpReq && fpReq.system.includes('Your scope is force-plate testing') && fpReq.system.includes('Research AI'), 'Force Plate AI keeps to force plates and points general questions to Research AI');
  assert(await st(() => NAV.some(n => n[0] === 'research')), 'Research AI is in the menu');
  await p.unroute('https://api.anthropic.com/v1/messages');

  console.log('== Device memory, save status, Safari tab');
  await p.goto(BASE + '#/dashboard'); await p.waitForTimeout(300);
  assert((await p.innerText('#view')).includes('You’re in a Safari tab'), 'iPhone in a Safari tab is told to use the Home Screen app');
  const mac = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage(); watch(mac, 'mac');
  await mac.goto(BASE); await mac.waitForSelector('.modal'); await mac.click('.modal-head [data-close]'); await mac.waitForTimeout(300);
  assert(!(await mac.innerText('#view')).includes('Safari tab'), 'no Safari-tab warning on the Mac');
  // save/sync status pill and immediate upload when leaving the app
  const gh = { puts: 0, file: null, sha: null };
  await p.route('https://api.github.com/**', async route => {
    const req = route.request(), url = new URL(req.url());
    const json = (s, b) => route.fulfill({ status: s, headers: { 'content-type': 'application/json', 'access-control-allow-origin': '*' }, body: JSON.stringify(b) });
    if (url.pathname === '/repos/coach/data') return json(200, { private: true });
    if (req.method() === 'GET') return gh.file ? json(200, { sha: gh.sha, content: Buffer.from(gh.file).toString('base64') }) : json(404, {});
    const body = JSON.parse(req.postData()); gh.file = Buffer.from(body.content, 'base64').toString(); gh.sha = 's' + (++gh.puts); return json(200, { content: { sha: gh.sha } });
  });
  await st(async () => { Sync.cfg = { repo: 'coach/data', token: 't', pass: 'correct horse battery', path: 'f.json' }; await Sync.run(); });
  await p.waitForTimeout(500);
  assert((await p.innerText('#syncPill')).includes('Synced') && gh.puts === 1, 'phone shows “Synced” in the top bar');
  await st(() => { upsert('notes', { athleteId: S.athletes[0].id, date: today(), text: 'leave-app test' }); persist(); });
  await p.waitForTimeout(400);
  assert((await p.innerText('#syncPill')).includes('Saved'), 'after an edit: “Saved” (on the phone) until it syncs');
  await st(() => { Object.defineProperty(document, 'visibilityState', { get: () => 'hidden', configurable: true }); document.dispatchEvent(new Event('visibilitychange')); });
  await p.waitForTimeout(2500);
  assert(gh.puts === 2 && gh.file, 'leaving the app uploads straight away (no 6 s wait)');
  await st(() => { delete document.visibilityState; });
  await p.context().setOffline(true); await p.waitForTimeout(200);
  assert((await p.innerText('#syncPill')).includes('Offline · saved'), 'offline: “Offline · saved”');
  await p.context().setOffline(false); await p.waitForTimeout(200);
  await st(() => { Sync.cfg = null; syncIndicator(); });
  await p.unroute('https://api.github.com/**');

  console.log('== Opens instantly offline / on a weak signal, and offers updates');
  const DOCS = path.join(__dirname, '..', '..', 'docs');
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2' };
  const flags = { hang: false, swExtra: '' };
  const srv = http.createServer((req, res) => {
    if (flags.hang) return;   // a gym with one bar of signal: the request never answers
    let f = decodeURIComponent(new URL(req.url, 'http://x').pathname); if (f.endsWith('/')) f += 'index.html';
    f = path.join(DOCS, f);
    if (!f.startsWith(DOCS) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
    let body = fs.readFileSync(f);
    if (f.endsWith('sw.js') && flags.swExtra) body = Buffer.concat([body, Buffer.from('\n// ' + flags.swExtra + '\n')]);
    res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const U = `http://localhost:${srv.address().port}/`;
  const ctx2 = await browser.newContext({ ...devices['iPhone 13'] });
  const q = await ctx2.newPage(); watch(q, 'sw');
  await q.goto(U); await q.waitForSelector('.modal'); await q.click('.modal-head [data-close]');
  await q.evaluate(() => navigator.serviceWorker.ready); await q.reload(); await q.waitForFunction(() => !!navigator.serviceWorker.controller, null, { timeout: 8000 });
  await q.evaluate(() => { upsert('athletes', { firstName: 'Offline', lastName: 'Check' }); return flush(); });
  flags.hang = true;
  const t0 = Date.now();
  await q.reload({ waitUntil: 'domcontentloaded', timeout: 10000 }); await q.waitForSelector('#topbar h1', { timeout: 10000 });
  const ms = Date.now() - t0;
  assert(ms < 3000 && await q.evaluate(() => S.athletes.some(a => a.firstName === 'Offline')), `opens from the saved copy in ${ms} ms when the network hangs, with all data`);
  flags.hang = false; srv.closeAllConnections();   // drop the requests that were left hanging
  await ctx2.setOffline(true); await q.reload({ waitUntil: 'domcontentloaded' }); await q.waitForSelector('#topbar h1');
  assert(await q.evaluate(() => S.athletes.length) >= 1, 'opens fully offline');
  await ctx2.setOffline(false);
  flags.swExtra = 'new version';
  await q.reload({ waitUntil: 'domcontentloaded' });
  await q.waitForSelector('#updateBar', { timeout: 10000 });
  assert((await q.innerText('#updateBar')).includes('new version'), 'a newer version downloads in the background and offers “Update”');
  await Promise.all([q.waitForNavigation({ waitUntil: 'domcontentloaded' }), q.click('#updateBar button')]); await q.waitForSelector('#topbar h1'); await q.waitForTimeout(800);
  assert(await q.locator('#updateBar').count() === 0, 'Update reloads into the new version');
  srv.closeAllConnections?.(); srv.close();

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
