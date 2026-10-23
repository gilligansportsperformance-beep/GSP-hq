// Performance HQ end-to-end tests — 1rm and evaluation
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  for (const [label, opts] of [['mac', { viewport: { width: 1440, height: 900 } }], ['iphone', { ...devices['iPhone 13'] }]]) {
    console.log('== ' + label);
    const ctx = await browser.newContext(opts);
    const p = await ctx.newPage();
    p.on('pageerror', e => errors.push(`[${label}] ${e.message}`));
    p.on('console', m => { if (m.type() === 'error') errors.push(`[${label}] ${m.text()}`); });
    const st = (fn, a) => p.evaluate(fn, a);
    const submit = () => p.click('.modal-wrap:last-child .modal-head button[type=submit]');
    await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(700);

    // ---- 1RM accuracy (synthetic athlete, true 1RM = 150 kg, MVT 0.30, v0 = 1.60) ----
    const r = await st(() => {
      const a = upsert('athletes', { firstName: 'Calc', lastName: 'Check', sex: 'M' });
      const ex = S.exercises.find(e => e.name === 'Back Squat');
      const add = (kg, v, extra = {}) => upsert('vbt', { athleteId: a.id, exerciseId: ex.id, date: addDays(today(), -3), load: kg, reps: [v], n: 1, vBest: v, vMean: v, vl: null, entry: 'profile', ...extra });
      const vAt = kg => 1.6 + (0.30 - 1.6) / 150 * kg;
      [60, 90, 112.5, 135].forEach(kg => add(kg, vAt(kg)));
      const exact = e1rmFor(a.id, ex.id);
      // set-average 5-rep sets must be excluded from the velocity estimate
      add(100, vAt(100) - 0.1, { entry: 'avg', n: 5, reps: [] });
      const afterAvg = e1rmFor(a.id, ex.id);
      // reps × RPE: 140 kg × 3 @ RPE 9 (4 reps to failure)
      upsert('workouts', { athleteId: a.id, date: addDays(today(), -2), title: 'x', items: [{ id: 'it1', exerciseId: ex.id, sets: '1', reps: '3' }], log: { it1: [{ load: 140, reps: 3, rpe: 9 }] }, completed: true });
      const both = e1rmFor(a.id, ex.id);
      const rdl = S.exercises.find(e => e.name === 'Romanian Deadlift');
      upsert('exercises', { ...rdl, vbt: true, mvt: 0.3 });
      [60, 80, 100].forEach((kg, i) => upsert('vbt', { athleteId: a.id, exerciseId: rdl.id, date: today(), load: kg, reps: [1 - i * 0.2], n: 1, vBest: 1 - i * 0.2, vMean: 1 - i * 0.2, entry: 'profile' }));
      const rdlE = e1rmFor(a.id, rdl.id);
      return { exact, afterAvg, both, rdlE, aid: a.id, exId: ex.id };
    });
    assert(Math.abs(r.exact.kg - 150) < 0.01 && r.exact.conf === 'high' && r.exact.source === 'velocity', `perfect profile → exact 1RM (${r.exact.kg.toFixed(2)} kg, ${r.exact.conf})`);
    assert(Math.abs(r.afterAvg.kg - 150) < 0.01 && r.afterAvg.prof.excluded === 1, 'set-average sets of 5 reps excluded (no downward bias)');
    const expRir = 140 / (1 / ((1 + 4 / 30 + 36 / 33) / 2));
    assert(Math.abs(r.both.rir.kg - expRir) < 0.01 && r.both.rir.conf === 'high', `reps × RPE = mean(Epley, Brzycki): ${r.both.rir.kg.toFixed(1)} kg`);
    const expComb = (150 * 2 + expRir * 2) / 4;
    assert(r.both.source === 'combined' && Math.abs(r.both.kg - expComb) < 0.01 && r.both.disagree > 3, `combined estimate ${r.both.kg.toFixed(1)} kg, methods differ ${r.both.disagree.toFixed(1)}%`);
    assert(r.rdlE === null, 'no estimated 1RM for other lifts (Romanian deadlift)');
    // calibration from a tested max: tested 160 kg → implied MVT from profile
    const cal = await st(({ aid, exId }) => { upsert('maxes', { athleteId: aid, exerciseId: exId, kg: 145, date: addDays(today(), -40) }); const m = mvtFor(aid, exId); return m; }, r);
    const expMvt = 1.6 + (0.30 - 1.6) / 150 * 145;
    assert(cal.source === 'calibrated' && Math.abs(cal.mvt - expMvt) < 0.005, `MVT calibrated from tested max (${cal.mvt.toFixed(3)} m/s)`);
    const meas = await st(({ aid, exId }) => { upsert('maxes', { athleteId: aid, exerciseId: exId, kg: 150, v1rm: 0.28, date: addDays(today(), -50) }); return mvtFor(aid, exId); }, r);
    assert(meas.source === 'measured' && meas.mvt === 0.28, 'measured 1RM-rep velocity becomes athlete’s threshold');
    const recentTest = await st(({ aid, exId }) => { upsert('maxes', { athleteId: aid, exerciseId: exId, kg: 152.5, date: addDays(today(), -5) }); return e1rmFor(aid, exId); }, r);
    assert(recentTest.source === 'tested' && recentTest.kg === 152.5, 'recent tested max (≤4 weeks) used directly');
    assert(await st(({ aid, exId }) => bestOneRM(aid, exId).kg === 152.5, r), '%1RM prescriptions use the same 1RM');

    // ---- Profile quadrant maths ----
    const q = await st(() => [
      profileFromTest({ m: { cmj: 40, sj: 38, cmjPF: 1700, imtpPF: 2000 }, date: today() }),
      profileFromTest({ m: { cmj: 50, sj: 40, cmjPF: 1650, imtpPF: 3000 }, date: today() }),
      profileFromTest({ m: { cmj: 40, sj: 41, cmjPF: 2100, imtpPF: 3000 }, date: today() }),
      profileFromTest({ m: { cmj: 44, sj: 40, cmjPF: 2100, imtpPF: 3000 }, date: today() }),
      profileFromTest({ m: { cmj: 44, sj: 40, cmjPF: 2100 }, date: today() }),
    ]);
    assert(q[0].primary === 'elastic' && Math.abs(q[0].dsi - 0.85) < 1e-9 && !q[0].secondary, 'DSI 0.85 / EUR 1.05 → Elastic');
    assert(q[1].primary === 'strength' && q[1].secondary === 'eccentric', 'DSI 0.55 / EUR 1.25 → Strength with eccentric tendency');
    assert(q[2].primary === 'concentric', 'DSI 0.70 / EUR 0.98 → Concentric');
    assert(q[3].primary === 'balanced', 'DSI 0.70 / EUR 1.10 → Balanced');
    assert(q[4] === null, 'no profile without IMTP');

    // ---- UI: evaluation tab for demo athletes ----
    const ids = await st(() => S.athletes.filter(a => a.demo).map(a => a.id));
    for (const id of ids) {
      await p.goto(BASE + `#/athlete/${id}/evaluation`); await p.waitForTimeout(250);
      const t = await p.innerText('#view');
      assert(!t.includes('went wrong') && t.includes('Athlete profile') && t.includes('Estimated 1RM'), 'evaluation tab renders ' + id.slice(-4));
    }
    await p.goto(BASE + `#/athlete/${ids[1]}/evaluation`); await p.waitForTimeout(300);
    await p.screenshot({ path: `${SP}/v5-${label}-evaluation.png`, fullPage: true });
    // new evaluation via form
    await p.click('.top-actions [data-act=newEval]'); await p.waitForTimeout(200);
    const fill = async (k, vals) => { for (let i = 0; i < vals.length; i++) await p.fill(`[data-tr="${k}"][data-i="${i}"]`, String(vals[i])); };
    await fill('cmj', [20.1, 20.5, 19.9]); await fill('cmjPF', [2400, 2450, 2420]); await fill('sj', [18.2, 18.6, 18.0]); await fill('imtpPF', [3500, 3900, 3550]);
    await p.click('.modal details.group summary'); await p.fill('[data-one=rsiMod]', '0.62');
    const out = await p.innerText('#evalOut');
    assert(out.includes('Profile') && out.includes('IMTP: trials differ'), 'live profile + IMTP >250 N warning: ' + out.replace(/\n/g, ' '));
    if (label === 'iphone') await p.screenshot({ path: `${SP}/v5-iphone-evalform.png`, fullPage: false });
    await submit(); await p.waitForTimeout(400);
    const saved = await st(id => S.tests.filter(t => t.athleteId === id && t.date === today()).pop(), ids[1]);
    assert(saved.evaluation && saved.trials.imtpPF.length === 3 && Math.abs(saved.m.imtpPF - 3650) < 0.01 && Math.abs(saved.m.cmj - 20.1666 * 2.54) < 0.01, 'evaluation saved: trial means (inches → cm)');
    const prof = await st(id => athleteProfileSummary(id), ids[1]);
    assert(prof && Math.abs(prof.dsi - 2423.33 / 3650) < 0.001, `profile uses this evaluation (DSI ${prof.dsi.toFixed(3)}, ${prof.label})`);
    assert((await p.innerText('#view')).toLowerCase().includes('trials differ'), 'trial-quality warning shown on tab');
    // VBT tab + profile test modal
    await p.goto(BASE + `#/athlete/${ids[1]}/vbt`); await p.waitForTimeout(300);
    assert((await p.innerText('#view')).includes('Estimated 1RM'), 'VBT tab shows estimated 1RM card');
    await p.click('[data-act=e1Profile]'); await p.waitForTimeout(200);
    const lbs = [135, 185, 225, 255]; const vel = [1.05, 0.86, 0.68, 0.55];
    for (let i = 0; i < 4; i++) { await p.fill(`[data-pl="${i}"]`, String(lbs[i])); await p.fill(`[data-pv="${i}"]`, String(vel[i])); }
    assert((await p.innerText('#profOut')).includes('Estimated 1RM'), 'profile test shows live estimate');
    await submit(); await p.waitForTimeout(300);
    assert(await st(() => S.vbt.filter(l => l.entry === 'profile' && l.notes === '1RM profile test').length) >= 4, 'profile test saved');
    // report profile line
    await p.goto(BASE + `#/reports?athlete=${ids[1]}`); await p.waitForTimeout(400);
    assert((await p.innerText('#reportPaper')).includes('Athlete profile:'), 'report includes the profile');
    for (const rt of ['dashboard', 'vbt', 'leaderboard', 'athletes']) { await p.goto(BASE + '#/' + rt); await p.waitForTimeout(120); assert(!(await p.innerText('#app')).includes('went wrong'), 'route OK ' + rt); }
    await ctx.close();
  }
  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
