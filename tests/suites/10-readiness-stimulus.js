// Performance HQ end-to-end tests — readiness check, training-stimulus analysis, offline use of new features
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const near = (a, b, tol = 1e-6) => Math.abs(a - b) <= tol;
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
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(700);

  console.log('== Readiness maths');
  const r = await st(() => {
    const a = upsert('athletes', { firstName: 'Ready', lastName: 'Check', sex: 'F', dob: '2009-05-05' });
    const T = today();
    [40, 41, 39, 40, 40].forEach((h, i) => upsert('readiness', { athleteId: a.id, date: addDays(T, -15 + i * 3), mode: 'cmj', trials: { cmj: [h] }, m: { cmj: h } }));
    const ev = h => readyEval({ id: 'x', athleteId: a.id, date: T, mode: 'cmj', trials: { cmj: [h] } });
    const two = readyEval({ id: 'y', athleteId: a.id, date: addDays(T, -11), mode: 'cmj', trials: { cmj: [40] } });
    upsert('readiness', { athleteId: a.id, date: addDays(T, -10), mode: 'iso', isoType: 'IMTP', trials: { imtpPF: [2000] } });
    const iso = readyEval({ id: 'z', athleteId: a.id, date: T, mode: 'iso', isoType: 'ISQ', trials: { imtpPF: [1500] } });
    const avgTrials = readyValue({ trials: { cmj: [38, 40, 42] } }, 'cmj');
    return { aid: a.id, bad: ev(38), low: ev(39), ok: ev(39.6), up: ev(41.5), two, iso, avgTrials };
  });
  const row = r.bad.rows[0];
  assert(row.n === 5 && near(row.base, 40) && near(row.pct, -5) && near(row.noise, 2), 'baseline = mean of 5 earlier checks; noise = max(own CV 1.8%, half the 4% typical error)');
  assert(r.bad.status === 'bad' && r.low.status === 'low' && r.ok.status === 'ok' && r.up.status === 'up', '−5% → fatigued, −2.5% → slightly down, −1% → ready, +3.8% → above normal');
  assert(r.two.status === 'base', 'fewer than 3 earlier checks → building baseline');
  assert(r.iso.status === 'base', 'isometric baselines kept separate by test type');
  assert(r.avgTrials === 40, 'trials are averaged (more sensitive to fatigue than the best trial)');

  console.log('== Readiness in the gym');
  await p.goto(BASE + '#/floor'); await p.waitForTimeout(300);
  assert(await p.locator('#view [data-act=readyCheck]').count() >= 1, 'Gym Floor has a readiness button for each athlete');
  // the floor lists whoever is booked today (order depends on the time), so pick an athlete who uses the CMJ check
  const cmjAid = await st(() => [...document.querySelectorAll('#view [data-act=readyCheck]')].map(b => b.dataset.a).find(id => (S.readiness.filter(r => r.athleteId === id).sort(byKey('date')).pop()?.mode || 'cmj') === 'cmj'));
  await p.click(`#view [data-act=readyCheck][data-a="${cmjAid}"] >> nth=0`); await p.waitForTimeout(250);
  const mode = await p.getAttribute('.modal [data-rmode].on', 'data-rmode');
  assert(mode === 'cmj', 'defaults to the athlete’s usual test (CMJ)');
  const name0 = await st(() => document.querySelector('.modal h2').textContent);
  await p.fill('.modal [data-rt=cmj][data-ri="0"]', '11'); await p.fill('.modal [data-rt=cmj][data-ri="1"]', '11.5'); await p.waitForTimeout(80);
  const res = await p.innerText('.modal [data-ready-out]');
  assert(/vs normal \(\d checks\)/.test(res) && /(Fatigued|Slightly down)/.test(res), `sharp drop flagged live: “${res.split('\n')[0]}”`);
  await submit(); await p.waitForTimeout(300);
  assert((await p.innerText('#view')).match(/Fatigued|Down/), 'Gym Floor shows today’s readiness next to the athlete');
  // isometric in the session logger
  const aid2 = await st(() => S.athletes.find(a => a.firstName === 'Jordan').id);
  await st(({ aid }) => { upsert('workouts', { athleteId: aid, date: today(), title: 'Lower', items: [{ id: 'q1', exerciseId: S.exercises.find(e => e.name === 'Back Squat').id, sets: '3', reps: '5', intensity: 'pct', pct: 80 }], completed: false }); refresh(); }, { aid: aid2 });
  await p.goto(BASE + `#/athlete/${aid2}/overview`); await p.waitForTimeout(300);
  await p.click('.profile-head [data-act=logSession]'); await p.waitForTimeout(350);
  assert(await p.locator('.modal details.ready-sec[open]').count() === 1, 'session log opens with the readiness check ready to fill');
  assert((await p.getAttribute('.modal [data-rmode].on', 'data-rmode')) === 'iso', 'remembers that this athlete uses an isometric');
  await p.fill('.modal [data-rt=imtpPF][data-ri="0"]', '3380'); await p.fill('.modal [data-rt=imtpPF][data-ri="1"]', '3420'); await p.waitForTimeout(80);
  assert((await p.innerText('.modal [data-ready-chip]')).length > 0 && (await p.innerText('.modal [data-ready-out]')).includes('Ready'), 'isometric 3400 N vs ~3400 N normal → Ready');
  assert(await fits(), 'logger with readiness fits the phone');
  await p.screenshot({ path: SP + '/v15-readiness-logger.png' });
  await submit(); await p.waitForTimeout(400);
  const saved = await st(({ aid }) => S.readiness.filter(x => x.athleteId === aid && x.date === today()), { aid: aid2 });
  assert(saved.length === 1 && saved[0].mode === 'iso' && saved[0].trials.imtpPF.length === 2 && saved[0].workoutId, 'readiness saved with the session');
  await p.click('.profile-head [data-act=logSession]'); await p.waitForTimeout(300);
  assert(await p.locator('.modal details.ready-sec[open]').count() === 0 && (await p.innerText('.modal .ready-sec summary')).includes('Ready'), 'reopening shows the result collapsed');
  await p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]'); await p.waitForTimeout(200);
  await p.goto(BASE + `#/athlete/${aid2}/overview`); await p.waitForTimeout(300);
  const ov = await p.innerText('#view');
  assert(ov.includes('Readiness') && ov.includes('Isometric'), 'athlete overview shows the readiness card');
  const marcus = await st(() => S.athletes.find(a => a.firstName === 'Marcus').id);
  await p.goto(BASE + `#/athlete/${marcus}/overview`); await p.waitForTimeout(300);
  assert(/Fatigued|Slightly down/.test(await p.innerText('#view')), 'sample data: exam-week drop shows on Marcus’s readiness');

  console.log('== Training stimulus');
  const s = await st(() => {
    const a = upsert('athletes', { firstName: 'Stim', lastName: 'Test', sex: 'M', dob: '2008-01-01' });
    const ex = n => S.exercises.find(e => e.name === n).id;
    upsert('maxes', { athleteId: a.id, exerciseId: ex('Back Squat'), kg: 100, date: addDays(today(), -2) });
    const items = [
      { id: 'a', exerciseId: ex('Back Squat'), sets: '4', reps: '3', intensity: 'pct', pct: 87 },
      { id: 'b', exerciseId: ex('Romanian Deadlift'), sets: '3', reps: '10', intensity: 'rir', rir: 2 },
      { id: 'c', exerciseId: ex('Box Jump'), sets: '3', reps: '5', intensity: 'bw' },
      { id: 'd', exerciseId: ex('Hang Power Clean'), sets: '4', reps: '3', intensity: 'load', load: 60 },
      { id: 'e', exerciseId: ex('Back Squat'), sets: '3', reps: '3', intensity: 'pct', pct: 70 },
      { id: 'f', exerciseId: ex('Back Squat'), sets: '2', reps: '15', intensity: 'pct', pct: 50 },
      { id: 'g', exerciseId: ex('Back Squat'), sets: '3', reps: '5', intensity: 'load', load: 75 },
    ];
    upsert('workouts', { athleteId: a.id, date: addDays(today(), -3), title: 'Mixed', items, completed: true });
    const k = items.map(it => itemStim(it, a.id).key);
    upsert('workouts', { athleteId: a.id, date: addDays(today(), -40), title: 'Old', items: [{ id: 'h', exerciseId: ex('Romanian Deadlift'), sets: '10', reps: '10', intensity: 'rir', rir: 2 }], completed: true });
    const w = athStim(a.id);
    return { aid: a.id, k, share: w.cur.share, work: w.cur.work, prevWork: w.prev.work, points: stimPoints(w), rep: repsAtPct(100 * repsToPct(8)) };
  });
  assert(JSON.stringify(s.k) === JSON.stringify(['str', 'hyp', 'spd', 'pow', 'pow', 'end', 'str']), 'classified: 87%×3 strength · 10 @ 2 RIR hypertrophy · box jump speed · clean power · 70%×3 far from failure power · 50%×15 endurance · 75%×5 strength');
  assert(s.work === 22 && near(s.share.str, 7 / 22 * 100) && near(s.share.pow, 7 / 22 * 100), 'shares by working sets (strength 7/22, power 7/22)');
  assert(near(s.rep, 8, 1e-3), 'reps-at-%1RM inverse is exact');
  assert(s.prevWork === 10 && s.points.some(t => t.includes('less hypertrophy')), 'trend vs the previous 4 weeks (less hypertrophy)');
  await p.goto(BASE + `#/athlete/${s.aid}/overview`); await p.waitForTimeout(300);
  let tv = await p.innerText('#view');
  assert(tv.includes('Training stimulus') && tv.includes('Main focus') && tv.includes('Strength') && tv.includes('working sets/week'), 'overview shows a short stimulus summary');
  assert(await p.locator('#view [data-act=stimAi]').count() === 0, 'AI button hidden until Claude is connected');
  const demoIds = await st(() => S.athletes.filter(a => a.demo).map(a => a.id));
  for (const id of demoIds) { await p.goto(BASE + `#/athlete/${id}/overview`); await p.waitForTimeout(200); const t = await p.innerText('#view'); assert(t.includes('Training stimulus') && !t.includes('went wrong') && await fits(), 'sample athlete overview: stimulus + readiness, fits phone · ' + id.slice(-4)); }
  await p.screenshot({ path: SP + '/v15-overview.png', fullPage: true });
  // AI summary with a mocked Claude reply
  let req = null;
  await p.route('https://api.anthropic.com/v1/messages', async route => {
    req = JSON.parse(route.request().postData());
    const text = 'This block mainly builds **strength** and power, with less hypertrophy than before.';
    const sse = [{ type: 'message_start', message: { id: 'm' } }, { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text } }, { type: 'message_delta', delta: { stop_reason: 'end_turn' } }, { type: 'message_stop' }].map(e => `event: ${e.type}\ndata: ${JSON.stringify(e)}\n\n`).join('');
    await route.fulfill({ status: 200, headers: { 'content-type': 'text/event-stream', 'access-control-allow-origin': '*' }, body: sse });
  });
  await st(async () => { await Store.set('aiKey', 'sk-ant-api03-' + 'x'.repeat(40)); await loadAiKey(); refresh(); });
  await p.goto(BASE + `#/athlete/${s.aid}/overview`); await p.waitForTimeout(250);
  await p.click('#view [data-act=stimAi]'); await p.waitForTimeout(600);
  tv = await p.innerText('#view .stim-ai');
  assert(tv.includes('mainly builds strength'), 'AI summary appears in the card');
  assert(req && !JSON.stringify(req).includes('Stim Test') && req.messages[0].content.includes('Programmed sets'), 'AI gets the program numbers, not the athlete’s name');
  await p.unroute('https://api.anthropic.com/v1/messages');

  console.log('== Offline');
  await p.goto(BASE); await p.waitForTimeout(800);
  await p.reload(); await p.waitForTimeout(800);
  await ctx.setOffline(true);
  for (const route of ['#/percentiles', '#/vbt', `#/athlete/${aid2}/evaluation`, `#/athlete/${aid2}/overview`]) {
    await p.goto(BASE + route); await p.waitForTimeout(300);
    const t = await p.innerText('#view');
    assert(t.length > 50 && !t.includes('went wrong'), 'works offline: ' + route.split('/').slice(0, 3).join('/'));
  }
  await p.reload(); await p.waitForTimeout(800);
  assert((await p.innerText('#view')).includes('Readiness'), 'app reloads offline with all data');
  await p.click('.profile-head [data-act=logSession]'); await p.waitForTimeout(300);
  await p.fill('.modal .log-item:first-child [data-k=load] >> nth=0', '300'); await submit(); await p.waitForTimeout(400);
  assert(await st(({ aid }) => Math.round(Object.values(S.workouts.find(w => w.athleteId === aid && w.date === today()).log)[0][0].load * 2.2046226218) === 300, { aid: aid2 }), 'session logging works offline');
  await ctx.setOffline(false);

  console.log('== Validation');
  const cl = await st(() => normalizeState({ readiness: [{ id: 'r1', athleteId: 'a1', date: '2026-01-01', mode: 'evil', isoType: 'X', trials: { cmj: [40, 'x'], hack: [1] }, m: { cmj: 40, imtpPF: 'x' } }, { id: 'bad id"', mode: 'cmj' }] }).readiness);
  assert(cl.length === 1 && cl[0].mode === 'cmj' && cl[0].isoType === null && JSON.stringify(cl[0].trials) === '{"cmj":[40]}' && JSON.stringify(cl[0].m) === '{"cmj":40}', 'readiness records validated on load/import');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
