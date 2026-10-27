// Performance HQ end-to-end tests — RIR ↔ velocity, per-set loads, session drafts, percentiles, 10-yard import
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
const near = (a, b, tol = 0.005) => Math.abs(a - b) <= tol;
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const ctx = await browser.newContext({ ...devices['iPhone 13'] });
  const p = await ctx.newPage();
  p.on('pageerror', e => errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
  const submit = () => p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]');
  const st = (fn, a) => p.evaluate(fn, a);
  const noOverflow = async () => {
    const r = await st(() => ({ w: document.documentElement.scrollWidth, wide: [...document.querySelectorAll('body *')].filter(e => e.getBoundingClientRect().right > 391).slice(0, 5).map(e => e.tagName + '.' + e.className + ' ' + Math.round(e.getBoundingClientRect().right) + ' ' + (e.textContent || '').trim().slice(0, 30)) }));
    if (r.w > 391) console.log('    overflow', r.w, JSON.stringify(r.wide));
    return r.w <= 391;
  };
  await p.goto(BASE); await p.waitForSelector('.modal'); await submit(); await p.waitForTimeout(400); // starter library

  console.log('== RIR maths (GSP back squat chart)');
  const m = await st(() => {
    const t = rirTable('squat');
    const chart = { bands: t.rir, pct: t.pct, shift: 0, personal: false, n: 0, source: t.source };
    const p52 = setPlan(chart, 5, 2, null);
    const p31 = setPlan(chart, 3, 1, null);
    const p42 = setPlan(chart, 4, 2, { v: velAtPct(t.pct, 85), source: 'chart', pc: 85 });
    const heavy = setPlan(chart, 3, 2, { v: velAtPct(t.pct, 90), source: 'chart', pc: 90 });
    return {
      src: t.source, custom: t.custom, rir: t.rir,
      f050: rirFromVel(t.rir, 0.50), f0555: rirFromVel(t.rir, 0.555), f035: rirFromVel(t.rir, 0.35), f070: rirFromVel(t.rir, 0.70),
      p52: { reps: p52.reps.map(r => r.v), stop: p52.stop, avg: p52.avg }, p31: { reps: p31.reps.map(r => r.v), avg: p31.avg },
      p42: { reps: p42.reps.map(r => r.v), avg: p42.avg }, heavy: heavy.notes.map(n => n[0]),
      v85: velAtPct(t.pct, 85), v875: velAtPct(t.pct, 87.5), v100: velAtPct(t.pct, 100), v30: velAtPct(t.pct, 30),
      rpe8: itemRir({ intensity: 'rpe', rpe: 8 }), rpe4: itemRir({ intensity: 'rpe', rpe: 4 }), bw: itemRir({ intensity: 'bw', rir: 2 }), stopLoad: itemRir({ intensity: 'load', rir: 1 }),
      reps35: planReps({ reps: '3-5' }), reps5: planReps({ reps: '5' }), repsBad: planReps({ reps: 'AMRAP' }),
    };
  });
  assert(m.src.includes('GSP') && !m.custom && JSON.stringify(m.rir) === JSON.stringify([[0.35, 0.40], [0.41, 0.46], [0.48, 0.52], [0.52, 0.59], [0.59, 0.65], [0.65, 0.68]]), 'default back squat RIR bands = coach’s chart');
  assert(near(m.f050, 2) && near(m.f0555, 3) && m.f035 === 0 && m.f070 === 5, 'rep speed → reps left: 0.50→2, 0.555→3, 0.35→0, 0.70→5+');
  assert(m.p52.stop[0] === 0.48 && m.p52.stop[1] === 0.52, '2 RIR → stop when a rep reads ≤ 0.52 m/s');
  assert(m.p52.reps[0] === null && near(m.p52.reps[1], 0.665) && near(m.p52.reps[2], 0.62) && near(m.p52.reps[3], 0.555) && near(m.p52.reps[4], 0.50) && m.p52.avg === null, '5 reps @ 2 RIR, chart only: reps 2–5 = 0.665 / 0.62 / 0.555 / 0.50, no average without rep 1');
  assert(near(m.p31.reps[0], 0.555) && near(m.p31.reps[1], 0.50) && near(m.p31.reps[2], 0.435) && near(m.p31.avg, (0.555 + 0.5 + 0.435) / 3), `3 reps @ 1 RIR: 0.555 / 0.50 / 0.435, set average ${m.p31.avg.toFixed(3)}`);
  assert(near(m.v85, 0.56) && near(m.v875, 0.53) && near(m.v100, 0.35) && m.v30 === null, '%1RM chart: 85% → 0.56, 87.5% → 0.53, 1RM → 0.35, outside chart → none');
  assert(near(m.p42.reps[0], 0.56) && near(m.p42.reps[1], 0.56) && near(m.p42.reps[2], 0.555) && near(m.p42.reps[3], 0.50) && near(m.p42.avg, 0.54375), '4 @ 2 RIR at 85%: no rep faster than rep 1 (0.56), average 0.544');
  assert(m.heavy.includes('bad'), '3 @ 2 RIR at 90% (rep 1 ≈ 0.50) flagged as too heavy');
  assert(m.rpe8 === 2 && m.rpe4 === null && m.bw === null && m.stopLoad === 1, 'RPE 8 = 2 RIR; RIR stop on a load prescription');
  assert(m.reps35 === 5 && m.reps5 === 5 && m.repsBad === null, 'rep ranges plan to the top of the range');

  console.log('== Athlete-specific RIR');
  const ids = await st(() => ({ bs: S.exercises.find(e => e.name === 'Back Squat').id, fs: S.exercises.find(e => e.name === 'Front Squat')?.id, rdl: S.exercises.find(e => e.name === 'Romanian Deadlift').id }));
  const pers = await st(({ bs }) => {
    const a = upsert('athletes', { firstName: 'Rir', lastName: 'Lifter', sex: 'M', dob: '2010-03-01' });
    upsert('maxes', { athleteId: a.id, exerciseId: bs, kg: 100, date: addDays(today(), -3) });
    // last-rep speeds 0.04 m/s slower than the chart at the reported RIR
    const sets = [[8, 0.46], [9, 0.395], [8, 0.46], [7, 0.515]].map(([rpe, last]) => ({ load: 80, reps: 3, vels: `0.60, 0.53, ${last}`, avg: null, rpe }));
    upsert('workouts', { athleteId: a.id, date: addDays(today(), -4), title: 'Squat', items: [{ id: 'sq1', exerciseId: bs, sets: '4', reps: '3', intensity: 'load', load: 80 }], log: { sq1: sets }, logMode: { sq1: 'reps' }, completed: true });
    const mod = rirModel(a.id, bs);
    const load = rirLoad(a.id, bs, 5, 2);
    const est = rirOfSet(rirModel(null, bs) || { bands: rirTable('squat').rir, pct: rirTable('squat').pct }, { vels: [0.62, 0.58, 0.51] });
    // set-average reading: build the expected average at 2 RIR, then read it back
    const chart = { bands: rirTable('squat').rir, pct: rirTable('squat').pct, shift: 0 };
    const fr = firstRep(a.id, bs, { kg: 85 }, chart);
    const avg2 = mean(repTargets(chart.bands, 5, 2, fr.v).map(r => r.v));
    const back = rirOfSet(chart, { avg: avg2, reps: 5, kg: 85, aid: a.id, exId: bs });
    return { aid: a.id, shift: mod.shift, personal: mod.personal, n: mod.n, b2: mod.bands[2], load, expLoad: roundLoad(100 * repsToPct(7)), est: est.rir, fr, back: back.rir, rdl: rirModel(a.id, S.exercises.find(e => e.name === 'Romanian Deadlift').id) };
  }, ids);
  assert(pers.personal && pers.n === 4 && near(pers.shift, -0.04, 0.002), `athlete personalised from 4 logged sets (shift ${pers.shift.toFixed(3)} m/s)`);
  assert(near(pers.b2[0], 0.44) && near(pers.b2[1], 0.48), 'personal 2-RIR band shifted to 0.44–0.48');
  assert(pers.load === pers.expLoad && pers.load > 0, `5 @ 2 RIR starting load from 1RM (${pers.load.toFixed(1)} kg)`);
  assert(near(pers.est, 2.18, 0.01), 'each-rep log: last rep 0.51 m/s → ≈2 RIR (2.2)');
  assert(pers.fr.source === 'chart' && near(pers.fr.pc, 85, 1e-9) && near(pers.fr.v, 0.56), 'rep 1 from %1RM chart when no load–velocity profile (85 kg of 100 kg → 0.56 m/s)');
  assert(near(pers.back, 2, 0.26), 'set-average log read back as ≈2 RIR');
  assert(pers.rdl === null, 'no RIR targets for lifts without a chart');

  console.log('== Workout builder: RIR intensity + per-set loads');
  await p.goto(BASE + `#/athlete/${pers.aid}/program`); await p.waitForTimeout(250);
  await p.click('.top-actions [data-act=newWorkout]'); await p.waitForTimeout(200);
  await p.fill('input[name=title]', 'RIR day');
  await p.selectOption('.item-editor select[data-k=exerciseId]', ids.bs); await p.waitForTimeout(100);
  await p.selectOption('.item-editor select[data-k=intensity]', 'rir'); await p.waitForTimeout(150);
  await p.fill('.item-editor input[data-k=reps]', '5'); await p.dispatchEvent('.item-editor input[data-k=reps]', 'change'); await p.waitForTimeout(100);
  let hint = await p.innerText('[data-hint="0"]');
  assert(hint.includes('2 RIR') && hint.includes('≤ 0.48') && hint.includes('R5'), 'RIR intensity shows load, stop speed and rep-by-rep targets (personalised)');
  await p.selectOption('.item-editor select[data-k=rir]', '1'); await p.waitForTimeout(100);
  hint = await p.innerText('[data-hint="0"]');
  assert(hint.includes('1 RIR') && hint.includes('≤ 0.42'), 'changing to 1 RIR updates the stop speed');
  await p.click('[data-add-item]'); await p.waitForTimeout(100);
  await p.selectOption('.item-editor:nth-child(2) select[data-k=exerciseId]', ids.rdl); await p.waitForTimeout(100);
  await p.selectOption('.item-editor:nth-child(2) select[data-k=intensity]', 'load'); await p.waitForTimeout(100);
  await p.fill('.item-editor:nth-child(2) input[data-k=load]', '185, 205, 225, 245'); await p.dispatchEvent('.item-editor:nth-child(2) input[data-k=load]', 'change'); await p.waitForTimeout(100);
  assert((await p.inputValue('.item-editor:nth-child(2) input[data-k=sets]')) === '4', 'four per-set loads → 4 sets');
  assert(await p.locator('.item-editor:nth-child(2) select[data-k=rir]').count() === 1, 'load prescriptions offer an optional RIR stop');
  await submit(); await p.waitForTimeout(350);
  const wo = await st(() => S.workouts.find(w => w.title === 'RIR day'));
  assert(wo.items[0].intensity === 'rir' && wo.items[0].rir === 1 && wo.items[1].loads.length === 4 && Math.round(wo.items[1].loads[3] * 2.2046226218) === 245, 'saved: RIR target and per-set loads');
  const card = await p.innerText('.wo');
  assert(card.includes('1 RIR') && card.includes('185 / 205 / 225 / 245 lb') && card.includes('Stop when a rep reads'), 'workout card shows RIR, rep targets and per-set loads');

  console.log('== Session logger: per-set weights, follow, RIR feedback, drafts');
  await p.click('.wo [data-act=logSession]'); await p.waitForTimeout(350);
  const rdlLoads = await p.$$eval('.log-item:nth-child(2) [data-k=load]', els => els.map(e => e.value));
  assert(JSON.stringify(rdlLoads) === JSON.stringify(['185', '205', '225', '245']), 'logger pre-fills each set with its prescribed load');
  const sqLoad0 = await p.inputValue('.log-item:first-child .log-row [data-k=load]');
  assert(+sqLoad0 > 0, `RIR exercise pre-filled with suggested load (${sqLoad0} lb)`);
  assert((await p.innerText('.log-item:first-child .log-head')).includes('Prescribed') && (await p.innerText('.log-item:first-child .log-head')).includes('Last time'), 'exercise head shows prescription and last time');
  const sqLoads = await p.$$('.log-item:first-child [data-k=load]');
  await sqLoads[0].fill('200'); await p.waitForTimeout(80);
  let vals = await p.$$eval('.log-item:first-child [data-k=load]', els => els.map(e => e.value));
  assert(vals.every(v => v === '200'), 'changing set 1 weight fills the sets below');
  await sqLoads[1].fill('210'); await p.waitForTimeout(80);
  vals = await p.$$eval('.log-item:first-child [data-k=load]', els => els.map(e => e.value));
  assert(vals[0] === '200' && vals.slice(1).every(v => v === '210'), 'weight can change set to set (earlier sets kept)');
  await sqLoads[0].fill('195'); await p.waitForTimeout(80);
  vals = await p.$$eval('.log-item:first-child [data-k=load]', els => els.map(e => e.value));
  assert(vals[0] === '195' && vals[1] === '210', 'sets already edited are not overwritten');
  await p.click('.log-item:first-child [data-vmode=reps]'); await p.waitForTimeout(100);
  await p.fill('.log-item:first-child .log-row [data-k=vels]', '0.62, 0.55, 0.41, 0.40, 0.38'); await p.waitForTimeout(100);
  const calc = await p.innerText('.log-item:first-child .log-row [data-calc]');
  assert(calc.includes('≈1 RIR') && calc.includes('stop speed reached at rep 3'), `live RIR feedback: “${calc.replace(/\s+/g, ' ').slice(0, 90)}”`);
  await p.waitForTimeout(600);
  await p.click('.modal-wrap >> nth=-1 >> .modal-head [data-close]'); await p.waitForTimeout(200);
  assert(await st(() => Object.keys(LOG_DRAFTS).length === 1), 'closing keeps unsaved entries as a draft');
  await p.click('.wo [data-act=logSession]'); await p.waitForTimeout(350);
  assert(await p.locator('[data-draft-banner]').count() === 1 && (await p.inputValue('.log-item:first-child .log-row [data-k=vels]')).startsWith('0.62'), 'reopening restores the draft with a notice');
  vals = await p.$$eval('.log-item:first-child [data-k=load]', els => els.map(e => e.value));
  assert(vals[0] === '195' && vals[1] === '210', 'restored per-set weights');
  assert(await noOverflow(), 'logger fits the iPhone screen');
  await p.screenshot({ path: SP + '/v15-logger.png' });
  await submit(); await p.waitForTimeout(400);
  assert(await st(() => Object.keys(LOG_DRAFTS).length === 0), 'saving clears the draft');
  const saved = await st(() => { const w = S.workouts.find(x => x.title === 'RIR day'); return Object.values(w.log)[0].map(r => Math.round(r.load * 2.2046226218)); });
  assert(saved[0] === 195 && saved[1] === 210 && saved[2] === 210 && saved.length === 3, 'saved log has the weight used for every set');
  await p.reload(); await p.waitForTimeout(600);
  await p.goto(BASE + '#/dashboard'); await p.waitForTimeout(300);
  await st(({ aid }) => { upsert('workouts', { athleteId: aid, date: today(), title: 'Today lift', items: [{ id: 'tq', exerciseId: S.exercises.find(e => e.name === 'Back Squat').id, sets: '3', reps: '5', intensity: 'load', load: 100 }], completed: false }); refresh(); }, pers);
  await p.waitForTimeout(300);
  assert(await p.locator('#view [data-act=logSession]').count() >= 1, 'dashboard “Programmed today” has a one-tap Log button');
  await p.goto(BASE + `#/athlete/${pers.aid}/overview`); await p.waitForTimeout(250);
  assert((await p.innerText('.profile-head')).includes('Log today’s session'), 'athlete header shows Log today’s session');

  console.log('== VBT page: RIR card, planner, chart editor');
  await p.goto(BASE + '#/vbt'); await p.waitForTimeout(300);
  let vt = await p.innerText('#view');
  assert(vt.includes('RIR ↔ bar speed') && vt.includes('0.48–0.52'), 'VBT page shows the RIR chart');
  await p.fill('#rirN', '3'); await p.selectOption('#rirQ', '1'); await p.fill('#rirPc', '85'); await p.dispatchEvent('#rirPc', 'input'); await p.waitForTimeout(100);
  const out = await p.innerText('#rirOut');
  assert(out.includes('≤ 0.46') && out.includes('0.50') && out.includes('set average ≈ 0.50'), 'planner: 3 @ 1 RIR at 85% → stop ≤0.46, average ≈0.50');
  assert(await noOverflow(), 'VBT page fits the iPhone screen');
  await p.screenshot({ path: SP + '/v15-vbt-rir.png', fullPage: true });
  await p.selectOption('select[name=rirLift]', 'fsquat'); await p.waitForTimeout(200);
  await p.click('#view [data-act=editRirTable]'); await p.waitForTimeout(200);
  await p.fill('input[name=hi2]', '0.40'); await submit(); await p.waitForTimeout(150);
  assert((await p.innerText('.modal-wrap >> nth=-1 >> .form-error')).length > 0, 'chart editor rejects bands that don’t get faster');
  await p.click('[data-copy-sq]'); await submit(); await p.waitForTimeout(300);
  const fs = await st(() => rirTable('fsquat'));
  assert(fs.custom && fs.rir[2][1] === 0.52 && /Back squat chart/.test(fs.source), 'front squat chart entered (copied from back squat, source recorded)');

  console.log('== Percentiles');
  const pc = await st(() => {
    const mk = (i, sex, sport, dob, cmj, date) => { const a = upsert('athletes', { firstName: 'P' + i, lastName: sex + sport, sex, sport, dob }); upsert('tests', { athleteId: a.id, date, m: { cmj } }); return a.id; };
    const ids = [];
    for (let i = 0; i < 12; i++) ids.push(mk(i, 'F', i < 6 ? 'Soccer' : 'Lacrosse', '2010-01-15', 30 + i, '2025-09-01'));
    mk(20, 'M', 'Soccer', '2010-01-15', 60, '2025-09-01');      // other sex
    mk(21, 'F', 'Soccer', '2013-01-15', 10, '2025-09-01');      // other age group
    const me = ids[5];                                           // 35 cm
    const auto = pctFor('cmj', me);
    const sa = pctFor('cmj', me, { level: 'sa' });
    const exp = (5 + 0.5) / 12 * 100;
    return { auto: auto.g, sa: sa.g, exp, me, few: pctFor('cmj', ids[6], { level: 'sas' }).g };
  });
  assert(pc.sa.p != null && near(pc.sa.p, pc.exp, 1e-9) && pc.sa.n === 12, `GSP percentile among 12 females 15–16: ${pc.sa.p.toFixed(1)} (exact rank)`);
  assert(pc.auto.lv === 'sas' && pc.auto.n === 6, 'best match narrows to same sport when 5+ share it');
  assert(pc.few.p != null || pc.few.n >= 5, 'sport group with 6 athletes is usable');
  const lowN = await st(() => { const a = upsert('athletes', { firstName: 'Solo', lastName: 'Boy', sex: 'M', dob: '2007-02-01' }); upsert('tests', { athleteId: a.id, date: '2025-09-01', m: { cmj: 50 } }); return pctFor('cmj', a.id).g; });
  assert(lowN.p == null && lowN.few, 'groups under 5 are not given a percentile');
  await p.goto(BASE + `#/percentiles?k=cmj&a=${pc.me}`); await p.waitForTimeout(400);
  let pt = await p.innerText('#view');
  assert(pt.includes('Published norm') && pt.includes('pct') && /vs 6 Female/.test(pt), 'percentiles page lists athletes with their peer group');
  assert(await noOverflow(), 'percentiles page fits the iPhone screen');
  await p.click('#view [data-act=editNorm]'); await p.waitForTimeout(200);
  await p.selectOption('.modal select[name=metric]', 'cmj'); await p.selectOption('.modal select[name=sex]', 'F');
  await p.fill('input[name=ageMin]', '15'); await p.fill('input[name=ageMax]', '16');
  for (const [k, v] of [['p5', '10'], ['p10', '11'], ['p25', '12.5'], ['p50', '14'], ['p75', '15.5'], ['p90', '17'], ['p95', '18']]) await p.fill(`input[name=${k}]`, v);
  await submit(); await p.waitForTimeout(150);
  assert((await p.innerText('.modal-wrap >> nth=-1 >> .form-error')).includes('source'), 'norm table requires a source');
  await p.fill('textarea[name=source]', 'Test Author, 2024. Synthetic table for automated tests.'); await submit(); await p.waitForTimeout(350);
  const np = await st(({ me }) => pctFor('cmj', me).np, pc);
  const expN = 25 + 25 * (35 - 12.5 * 2.54) / (14 * 2.54 - 12.5 * 2.54);
  assert(np && near(np.p, expN, 1e-6), `published-norm percentile by interpolation: ${np.p.toFixed(1)}`);
  const ext = await st(() => { const t = S.settings.normTables[0]; return [normPct(t, 60, 1), normPct(t, 5, 1), normPct({ points: [[5, 2.2], [50, 2.0], [95, 1.8]] }, 1.9, -1)]; });
  assert(ext[0].above && ext[0].p === 95 && ext[1].below && ext[1].p === 5 && near(ext[2].p, 72.5, 1e-9), 'beyond the table shows >P95 / <P5; timed tests interpolate the right way');
  pt = await p.innerText('#view');
  assert(pt.includes('Female · ages 15–16') && pt.includes('46th'), 'page shows the norm percentile and table' + (pt.includes('Female · ages 15–16') ? '' : ' :: ' + JSON.stringify(pt.slice(pt.indexOf('PUBLISHED'), pt.indexOf('PUBLISHED') + 300))));
  await p.screenshot({ path: SP + '/v15-percentiles.png', fullPage: true });
  assert(await noOverflow(), 'percentiles page with norms fits the iPhone screen');
  await p.click('#view [data-act=pasteNorms]'); await p.waitForTimeout(200);
  assert(await noOverflow(), 'paste-norms form fits the iPhone screen');
  await p.selectOption('select[name=metric]', 'sprint10');
  await p.fill('textarea[name=rows]', 'sex,age from,age to,P5,P10,P25,P50,P75,P90,P95\nF, 15, 15, 2.30, 2.25, 2.15, 2.05, 1.97, 1.90, 1.86\nBoys, 15, 15, 2.10, 2.05, 1.97, 1.88, 1.80, 1.75, 1.71\nM, 16, 16, 1.70, 1.75, 1.80, 1.88, 1.95, 2.00, 2.10');
  await p.waitForTimeout(150);
  const prev = await p.innerText('#normPrev');
  assert(prev.includes('2 tables') && prev.includes('1 line skipped') && prev.includes('Line 4'), 'paste preview: 2 valid tables, header skipped, reversed timed row caught');
  await p.fill('textarea[name=rows]', 'F, 15, 15, 2.30, 2.25, 2.15, 2.05, 1.97, 1.90, 1.86\nBoys, 15, 15, 2.10, 2.05, 1.97, 1.88, 1.80, 1.75, 1.71');
  await p.fill('textarea[name=source]', 'Synthetic sprint norms for tests');
  await submit(); await p.waitForTimeout(300);
  assert(await st(() => S.settings.normTables.filter(t => t.metric === 'sprint10').length === 2), 'pasted tables saved');
  await p.goto(BASE + `#/athlete/${pc.me}/evaluation`); await p.waitForTimeout(300);
  const ev = await p.innerText('#view');
  assert(ev.includes('Percentiles') && ev.includes('CMJ height') && ev.includes('46th'), 'Evaluation tab shows the athlete’s percentiles');

  console.log('== 10-yard sprint tests + CSV import (trials kept)');
  await p.goto(BASE + '#/athletes'); await p.waitForTimeout(200);
  await st(() => upsert('athletes', { firstName: 'Sprinty', lastName: 'Mcfast', sex: 'M' }));
  await p.click('.top-actions [data-act=importCsv], #view [data-act=importCsv]'); await p.waitForTimeout(200);
  const csv = ['Athlete,Date,0-10 yd sprint (s),Flying 10 yd (s),5-10-5 pro agility (s),Broad jump (in),Vertical jump (in),Depth jump height (in),Drop jump RSI',
    'Sprinty,2026-07-21,,1.470,,,,,', 'Sprinty,2026-07-21,,1.460,,,,,', 'Sprinty,2026-07-21,,,,77,,,', 'Sprinty,2026-07-21,1.62,,,,,,',
    'Sprinty,2026-07-24,,,4.866,,,,', 'Sprinty,2026-07-24,,,4.914,,,,', 'Sprinty,2026-07-24,,,,,20.2,,', 'Sprinty,2026-07-24,,,,,18.2,,',
    'Sprinty,2026-08-11,,,,,,18.2,', 'Sprinty,2026-08-11,,,,,,,1.02', 'Sprinty,2026-08-11,,,,,,,0.86'].join('\n');
  await p.fill('[data-paste]', csv); await p.click('[data-parse-paste]'); await p.waitForTimeout(200);
  const mapped = await p.$$eval('select[data-map]', els => els.map(e => e.value));
  assert(JSON.stringify(mapped) === JSON.stringify(['_name', '_date', 'sprint10yd', 'fly10yd', 'proAgility', 'broad', 'vj', 'djHeight', 'djRsi']), 'columns auto-matched (10 yd sprint, flying 10 yd, 5-10-5, broad, vertical, depth jump, RSI)');
  const units = await p.$$eval('select[data-unit]', els => els.map(e => e.value));
  assert(units.filter(u => u === 'in').length === 3, 'inches detected for jump columns');
  await submit(); await p.waitForTimeout(200);
  assert((await p.inputValue('select[data-name="Sprinty"]')) !== '_new', 'single first name matched to the existing athlete');
  await submit(); await p.waitForTimeout(200); await submit(); await p.waitForTimeout(400);
  const imp = await st(() => {
    const a = S.athletes.find(x => x.firstName === 'Sprinty');
    return testsFor(a.id).map(t => ({ date: t.date, m: t.m, tr: t.trials, d: testMetrics(t) }));
  });
  const t21 = imp.find(t => t.date === '2026-07-21'), t24 = imp.find(t => t.date === '2026-07-24'), t11 = imp.find(t => t.date === '2026-08-11');
  assert(imp.length === 3 && t21.m.fly10yd === 1.46 && near(t21.m.broad, 77 * 2.54, 1e-9) && t21.m.sprint10yd === 1.62, 'best trial per day saved (fly 1.46 s, broad 77 in, 10 yd 1.62 s)');
  assert(JSON.stringify(t21.tr.fly10yd) === JSON.stringify([1.47, 1.46]) && t24.tr.vj.length === 2, 'every trial kept with the test');
  assert(near(t21.d.vmax, 9.144 / 1.46, 1e-9), `max velocity from flying 10 yd: ${t21.d.vmax.toFixed(2)} m/s`);
  assert(t24.m.proAgility === 4.866 && near(t24.m.vj, 20.2 * 2.54, 1e-9) && t11.m.djRsi === 1.02 && near(t11.m.djHeight, 18.2 * 2.54, 1e-9), '5-10-5, vertical, depth jump and RSI imported');
  await p.goto(BASE + '#/leaderboard'); await p.waitForTimeout(250);
  assert(await st(() => lbMetricDefs().some(d => d.key === 'fly10yd') && lbEntries('fly10yd').length >= 1), 'flying 10 yd appears on the leaderboard');

  console.log('== Validation of new data');
  const cl = await st(() => {
    const s = normalizeState({
      settings: {
        rirTables: { squat: { rir: [[0.3, 0.4], [0.4, 0.5], [0.5, 0.6], [0.6, 0.7], [0.7, 0.8], [0.8, 0.9]], pct: [[50, 'x'], [60, 0.8]], source: '<b>src</b>' }, evil: { rir: [] }, bench: { rir: [[1, 2]] } },
        normTables: [{ id: 'bad id"><', metric: 'cmj', points: [[5, 1], [95, 2]] }, { id: 'ok1', metric: 'cmj"><img', points: [[5, 1], [95, 2]] }, { id: 'ok2', metric: 'cmj', sex: 'X', points: [[5, 1], [95, 2], [150, 3]], source: 's' }],
      },
      workouts: [{ id: 'w1', date: '2026-01-01', items: [{ id: 'i1', exerciseId: 'e', intensity: 'rir', rir: 9, loads: [100, 'x', -5, 120] }, { id: 'i2', intensity: 'evil' }] }],
    });
    return { rt: s.settings.rirTables, nt: s.settings.normTables, it: s.workouts[0].items };
  });
  assert(Object.keys(cl.rt).join() === 'squat' && cl.rt.squat.pct.length === 1, 'RIR charts: unknown lifts and bad numbers dropped');
  assert(cl.nt.length === 1 && cl.nt[0].id === 'ok2' && cl.nt[0].sex === 'all' && cl.nt[0].points.length === 2, 'norm tables: bad ids/metrics and out-of-range points dropped');
  assert(cl.it[0].intensity === 'rir' && cl.it[0].rir === null && JSON.stringify(cl.it[0].loads) === '[100,120]' && cl.it[1].intensity === 'load', 'workout items: RIR range and per-set loads validated');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
