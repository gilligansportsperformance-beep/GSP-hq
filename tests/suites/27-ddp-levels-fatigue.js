// Performance HQ end-to-end tests — v1.22: dynamic double progression in the workout builder,
// high-school level lines on the results chart, and the fatigue meter on the athlete profile
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
  const top = '.modal-wrap >> nth=-1';
  const submit = () => p.click(`${top} >> .modal-head button[type=submit]`);
  const close = () => p.click(`${top} >> .modal-head [data-close]`);
  const st = (fn, a) => p.evaluate(fn, a);
  const fits = async () => (await st(() => document.documentElement.scrollWidth)) <= 391;
  const pick = async names => {
    await p.click('[data-add-item]'); await p.waitForSelector('[data-xp-q]');
    for (const n of names) {
      const id = await st(x => S.exercises.find(e => e.name === x).id, n);
      await p.fill('[data-xp-q]', n); await p.waitForTimeout(60);
      await p.click(`.xp-row[data-xp-id="${id}"] >> visible=true`);
    }
    await p.click('[data-xp-add]'); await p.waitForTimeout(350);
  };
  await p.goto(BASE); await p.waitForSelector('.modal'); await submit(); await p.waitForTimeout(400);
  const A = await st(() => {
    const lb = x => U.massIn(x), d = n => addDays(today(), -n), ex = n => S.exercises.find(e => e.name === n).id;
    const a = upsert('athletes', { firstName: 'Dee', lastName: 'Pro', sex: 'M', dob: '2008-01-01', archived: false });
    const bs = ex('Back Squat'), bp = ex('Bench Press'), rdl = ex('Romanian Deadlift'), pu = ex('Pull-Up');
    // the last logged session: squat 3 × 6–10 @ 225 → 10, 10, 8; bench 3 × 8–12 → 12, 12, 12 (reps counted from velocities on set 3);
    // RDL 3 × 5 (no range); pull-up 3 × 6–10 → 7, 7, 6
    upsert('workouts', { athleteId: a.id, date: d(3), title: 'Full body', completed: true, items: [
      { id: 'i1', exerciseId: bs, sets: '3', reps: '6-10', intensity: 'load', load: lb(225) },
      { id: 'i2', exerciseId: bp, sets: '3', reps: '8–12', intensity: 'load', load: lb(155) },
      { id: 'i3', exerciseId: rdl, sets: '3', reps: '5', intensity: 'load', load: lb(185) },
      { id: 'i4', exerciseId: pu, sets: '3', reps: '6 to 10', intensity: 'load', load: lb(25) }],
      log: { i1: [{ load: lb(225), reps: 10 }, { load: lb(225), reps: 10 }, { load: lb(225), reps: 8 }],
        i2: [{ load: lb(155), reps: 12 }, { load: lb(155), reps: 12 }, { load: lb(155), reps: null, vels: '0.6, 0.6, 0.58, 0.55, 0.55, 0.5, 0.5, 0.48, 0.45, 0.42, 0.4, 0.38' }],
        i3: [{ load: lb(185), reps: 5 }, { load: lb(185), reps: 5 }, { load: lb(185), reps: 5 }],
        i4: [{ load: lb(25), reps: 7 }, { load: lb(25), reps: 7 }, { load: lb(25), reps: 6 }] } });
    return { aid: a.id, bs, bp, rdl, pu };
  });

  console.log('== Double progression in the workout builder');
  await st(a => openWorkoutModal(null, { athleteId: a.aid, date: today() }), A); await p.waitForTimeout(400);
  await pick(['Back Squat']);
  const row = '#itemsHost .item-editor >> nth=0';
  assert(await p.inputValue(`${row} >> [data-k=load]`) === '230, 230, 225', 'sets 1 and 2 reached the top of 6–10, so they go up a step (225 → 230 lb); set 3 keeps 225');
  const note = await p.innerText(`${row} >> .ie-ddp`);
  assert(note.includes('Double progression') && note.includes('Sets 1 and 2 reached 10 → +5 lb') && note.includes('Set 3 did 8 of 10 → same load'), `the row says why (“${note.replace(/\s+/g, ' ')}”)`);
  assert(await p.locator('[data-ddp-all]').isHidden(), 'nothing left to apply, so “Apply double progression” is hidden');
  await p.screenshot({ path: SP + '/v122-ddp.png' });
  await p.click(`${row} >> [data-it=ddpUndo]`); await p.waitForTimeout(150);
  assert(await p.inputValue(`${row} >> [data-k=load]`) === '225' && await p.locator(`${row} >> .ie-ddp`).count() === 0 && (await p.innerText(`${row} >> .ie-from`)).includes('Prefilled from'), 'Undo goes back to last time’s 225 lb');
  assert(await p.locator('[data-ddp-all]').isVisible(), 'and “Apply double progression” offers it again');
  await p.click('[data-ddp-all]'); await p.waitForTimeout(150);
  assert(await p.inputValue(`${row} >> [data-k=load]`) === '230, 230, 225' && (await p.innerText('.toast >> nth=-1')).includes('1 exercise updated, 2 sets up'), 'Apply puts the progression back (“1 exercise updated, 2 sets up”)');
  await pick(['Bench Press', 'Romanian Deadlift', 'Pull-Up']);
  const loads = await p.$$eval('#itemsHost [data-k=load]', els => els.map(e => e.value));
  assert(loads[1] === '160', `every bench set reached 12 (the third counted from its 12 velocities): 155 → 160 lb (${loads[1]})`);
  assert((await p.innerText('#itemsHost .item-editor >> nth=1')).includes('All 3 sets reached 12'), 'all sets up says so');
  assert(loads[2] === '185' && await p.locator('#itemsHost .item-editor >> nth=2 >> .ie-ddp').count() === 0, 'a fixed rep target (3 × 5) is copied, not progressed');
  assert(loads[3] === '25' && (await p.innerText('#itemsHost .item-editor >> nth=3')).includes('No set reached 10 → same load, more reps'), 'no set at the top: same load, aim for more reps');
  assert(await fits(), 'the builder fits the iPhone screen');
  await submit(); await p.waitForTimeout(400);
  const saved = await st(a => { const w = S.workouts.find(w => w.athleteId === a.aid && w.date === today()); return { loads: w.items.map(i => (i.loads || [i.load]).map(x => Math.round(U.massOut(x)))), keys: w.items.some(i => Object.keys(i).some(k => k.startsWith('_'))), id: w.id }; }, A);
  assert(saved.loads[0].join() === '230,230,225' && saved.loads[1].join() === '160' && !saved.keys, 'saved with a load per set, and no helper fields stored');
  await st(id => openSessionLogger(getRec('workouts', id)), saved.id); await p.waitForTimeout(400);
  const first = await st(() => [...document.querySelectorAll('.modal .log-item')][0].querySelectorAll('[data-k=load]').length ? [...[...document.querySelectorAll('.modal .log-item')][0].querySelectorAll('[data-k=load]')].map(i => i.value) : []);
  assert(first.join() === '230,230,225', `the session log starts each set at its own load (${first.join(', ')})`);
  await close(); await p.waitForTimeout(200);

  console.log('== When it doesn’t apply');
  const edge = await st(a => {
    const lb = x => U.massIn(x);
    // a newer plan with a different scheme (the coach started a new block) wins over the older logged session
    upsert('workouts', { athleteId: a.aid, date: addDays(today(), 3), title: 'New block', items: [{ id: 'n1', exerciseId: a.bs, sets: '5', reps: '3-5', intensity: 'load', load: lb(255) }] });
    const later = newItemFor(a.bs, { aid: a.aid, date: addDays(today(), 7) });
    const steps = [ddpNextLoad(lb(225)), ddpNextLoad(lb(315)), ddpNextLoad(lb(52.5)), ddpNextLoad(lb(100))].map(x => +U.massOut(x).toFixed(1));
    S.settings.units = 'metric';
    const kg = [ddpNextLoad(100), ddpNextLoad(60)];
    S.settings.units = 'imperial';
    return { laterReps: later.reps, laterDdp: !!later._ddp, laterLoad: Math.round(U.massOut(later.load)), steps, kg, ranges: ['6-10', '6–10', '8 to 12', '5', '10-6', 'AMRAP'].map(r => JSON.stringify(ddpRange(r))) };
  }, A);
  assert(edge.laterReps === '3-5' && !edge.laterDdp && edge.laterLoad === 255, 'after the coach changes the scheme (5 × 3–5), new rows copy that plan instead of progressing the old one');
  assert(edge.steps.join() === '230,325,57.5,105' && edge.kg.join() === '102.5,62.5', `load steps: about 2.5%, at least 5 lb / 2.5 kg (${edge.steps.join(', ')} lb · ${edge.kg.join(', ')} kg)`);
  assert(edge.ranges.join('|') === '{"lo":6,"hi":10}|{"lo":6,"hi":10}|{"lo":8,"hi":12}|null|null|null', 'rep ranges are read as 6-10, 6–10 and 8 to 12; a single number or text is not a range');

  console.log('== From the compare card');
  await st(a => { S.workouts.filter(w => w.athleteId === a.aid && w.date > addDays(today(), -1)).forEach(w => removeRec('workouts', w.id)); }, A);
  await st(a => openWorkoutModal(null, { athleteId: a.aid, date: today() }), A); await p.waitForTimeout(400);
  await p.click('[data-woc-all]'); await p.waitForTimeout(300);
  const fromCmp = await p.$$eval('#itemsHost [data-k=load]', els => els.map(e => e.value));
  assert(fromCmp.join(' | ') === '230, 230, 225 | 160 | 185 | 25' && await p.locator('#itemsHost .ie-ddp').count() === 3, `adding from the earlier session progresses it the same way (${fromCmp.join(' | ')})`);
  await close(); await p.waitForTimeout(200);
  const choice = p.locator('.dlg-actions button', { hasText: /Discard|Leave|Close without/i });
  if (await choice.count()) { await choice.first().click(); await p.waitForTimeout(200); }

  console.log('== High-school levels on the results chart');
  const L = await st(() => {
    const a = upsert('athletes', { firstName: 'Jo', lastName: 'Lane', sex: 'F', dob: '2009-04-04', archived: false });
    const d = n => addDays(today(), -n);
    [[70, 30], [56, 31.5], [42, 33], [28, 32.5], [14, 34.5], [3, 35]].forEach(([n, v]) => upsert('tests', { athleteId: a.id, date: d(n), sides: {}, m: { cmj: v } }));
    upsert('tests', { athleteId: a.id, date: d(1), sides: {}, device: 'OVR Jump', m: { cmj: 40 } });
    upsert('tests', { athleteId: a.id, date: d(30), sides: {}, m: { dlTts: 1.10 } }); upsert('tests', { athleteId: a.id, date: d(2), sides: {}, m: { dlTts: 0.95 } });
    const b = upsert('athletes', { firstName: 'No', lastName: 'Sex', dob: '2009-04-04', archived: false });
    upsert('tests', { athleteId: b.id, date: d(5), sides: {}, m: { cmj: 35 } }); upsert('tests', { athleteId: b.id, date: d(2), sides: {}, m: { cmj: 36 } });
    return { aid: a.id, bid: b.id };
  });
  await p.goto(BASE + `#/metric/${L.aid}/cmj`); await p.waitForTimeout(400);
  let svg = await p.innerHTML('.mt-chart svg');
  assert(svg.includes('lvl-l lv-good') && svg.includes('>Good 14 in<') && svg.includes('>Average 11 in<') && !svg.includes('Elite 18'), 'her current level (Average, from 11 in) and the next (Good, from 14 in) are drawn; Elite is out of range');
  const cap = await p.innerText('.mt-head p.faint');
  assert(cap.includes('GSP high-school levels for girls (ages 14–18)') && cap.includes('Jo is Average; Good from 14 in · 0.2 in to go'), `the caption says what the lines are and how far to the next level (“${cap.split('.')[0]}…”)`);
  await p.screenshot({ path: SP + '/v122-levels.png', fullPage: true });
  await p.goto(BASE + `#/metric/${L.aid}/ft%3Acmj`); await p.waitForTimeout(300);
  assert(!(await p.innerHTML('.mt-chart svg')).includes('lvl-l'), 'no levels for OVR Jump heights (the standards are force-plate)');
  await p.goto(BASE + `#/metric/${L.aid}/dlTts`); await p.waitForTimeout(300);
  svg = await p.innerHTML('.mt-chart svg');
  assert(svg.includes('>Elite under 0.75 s<') && svg.includes('>Good 1.04 s<'), 'lower is better: “Elite under 0.75 s” above “Good 1.04 s” on the flipped scale');
  await p.goto(BASE + `#/metric/${L.bid}/cmj`); await p.waitForTimeout(300);
  assert(!(await p.innerHTML('.mt-chart svg')).includes('lvl-l'), 'no levels until the athlete’s sex is set');
  await st(() => { S.settings.units = 'metric'; });
  await p.goto(BASE + `#/metric/${L.aid}/cmj`); await p.waitForTimeout(300);
  assert((await p.innerHTML('.mt-chart svg')).includes('>Good 36 cm<'), 'in metric units the lines follow (Good from 36 cm)');
  await st(() => { S.settings.units = 'imperial'; });

  console.log('== Fatigue meter');
  const F = await st(() => {
    const a = upsert('athletes', { firstName: 'Lee', lastName: 'Park', sex: 'M', dob: '2009-02-02', archived: false });
    const d = n => addDays(today(), -n);
    upsert('tests', { athleteId: a.id, date: d(40), sides: {}, m: { cmj: 40 } });
    return { aid: a.id };
  });
  await p.goto(BASE + `#/athlete/${F.aid}/overview`); await p.waitForTimeout(300);
  let fc = await p.innerText('.fat-card');
  assert(fc.includes('Fatigue meter') && fc.includes('Readiness check · 1 of 3') && await p.locator('.fat-chip').count() === 0, 'before any check: the meter says it unlocks at 3 results, and the header has no chip');
  await st(id => {
    const d = n => addDays(today(), -n);
    [[33, 41], [26, 40.5]].forEach(([n, v]) => upsert('tests', { athleteId: id, date: d(n), sides: {}, m: { cmj: v } }));
    [[20, [41, 40, 41.5]], [16, [40, 40.5, 41]], [12, [39.5, 40, 40]], [9, [41, 42, 41]], [5, [39, 39.5, 38.5]], [2, [37, 37.5, 37]]].forEach(([n, t]) => upsert('readiness', { athleteId: id, date: d(n), mode: 'cmj', trials: { cmj: t }, m: { cmj: t.reduce((x, y) => x + y) / t.length } }));
  }, F.aid);
  await p.goto(BASE + '#/athletes'); await p.waitForTimeout(150);
  await p.goto(BASE + `#/athlete/${F.aid}/overview`); await p.waitForTimeout(300);
  fc = await p.innerText('.fat-card');
  const pos = await st(() => parseFloat(document.querySelector('.fat-meter i').style.left));
  assert(fc.includes('Fatigued') && fc.includes('2 days ago · CMJ') && pos > 75 && (await p.innerText('.fat-names .on')) === 'Fatigued', `the latest check (−7.9% vs normal) puts the marker in the Fatigued zone (${pos}%)`);
  assert(fc.includes('+2.0%') && fc.includes('−2.0%') && fc.includes('−4.0%') && fc.includes('−7.9%') && fc.includes('normal 15.9 in'), 'the zone edges show this athlete’s normal variation (±2%, fatigued past −4%) and the reading itself');
  assert(fc.includes('Last 14 days: 1 above normal · 1 ready · 1 slightly down · 1 fatigued') && (await p.innerHTML('.fat-trend svg')).includes('normal ± 2.0%'), 'recent checks are counted and charted against the normal range');
  const firstCard = await st(() => document.querySelector('#view .grid.two .col .card').classList.contains('fat-card'));
  assert(firstCard, 'with checks to show, the meter is the first card on the Overview');
  const chip = await p.innerText('.profile-head .fat-chip');
  assert(chip.includes('Fatigued') && chip.includes('2 days ago') && (await p.getAttribute('.profile-head .fat-chip', 'href')) === `#/athlete/${F.aid}/overview`, 'the profile header shows the reading on every tab');
  assert(await fits(), 'fits the iPhone screen');
  await p.locator('.fat-card').screenshot({ path: SP + '/v122-fatigue.png' });
  const zones = await st(() => [fatiguePos(0), fatiguePos(-1.5), fatiguePos(2), fatiguePos(-3), fatiguePos(9), fatiguePos(-9)]);
  assert(zones.join() === '37.5,62.5,12.5,87.5,1.5,98.5', `marker positions follow the readiness thresholds (${zones.join(', ')})`);
  // a check 10 days old is out of date; a fresh one above normal moves the marker left
  await st(id => { S.readiness.filter(r => r.athleteId === id && r.date > addDays(today(), -9)).forEach(r => removeRec('readiness', r.id)); }, F.aid);
  await p.goto(BASE + '#/athletes'); await p.waitForTimeout(150);
  await p.goto(BASE + `#/athlete/${F.aid}/testing`); await p.waitForTimeout(300);
  assert((await p.innerText('.profile-head .fat-chip')).includes('9 days ago') && await p.locator('.profile-head .fat-chip.stale').count() === 1, 'an old reading is shown as old');
  await p.goto(BASE + `#/athlete/${F.aid}/overview`); await p.waitForTimeout(300);
  assert(await p.locator('.fat-card.stale').count() === 1 && (await p.innerText('.fat-card')).includes('Last check 9 days ago: check again'), 'and the meter asks for a new check');
  await st(id => upsert('readiness', { athleteId: id, date: today(), mode: 'cmj', trials: { cmj: [43, 43.5, 43] }, m: { cmj: 43.17 } }), F.aid);
  await p.goto(BASE + '#/athletes'); await p.waitForTimeout(150);
  await p.goto(BASE + `#/athlete/${F.aid}/overview`); await p.waitForTimeout(300);
  assert((await p.innerText('.fat-names .on')) === 'Above normal' && await st(() => parseFloat(document.querySelector('.fat-meter i').style.left)) < 25 && (await p.innerText('.fat-chip')).includes('Today'), 'a jump above normal today reads “Above normal”');

  console.log('== Isometric squat results kept apart from the IMTP (audit fix)');
  const I = await st(() => {
    const a = upsert('athletes', { firstName: 'Iso', lastName: 'Test', sex: 'M', dob: '2009-01-01', archived: false });
    const d = n => addDays(today(), -n);
    upsert('tests', { athleteId: a.id, date: d(30), sides: {}, isoType: 'IMTP', m: { imtpPF: 2000 } });
    upsert('tests', { athleteId: a.id, date: d(15), sides: {}, isoType: 'IMTP', m: { imtpPF: 2100 } });
    upsert('tests', { athleteId: a.id, date: d(2), sides: {}, isoType: 'ISQ', m: { imtpPF: 2600 } });
    return { aid: a.id, lb: lbEntries('imtpPF').filter(e => e.aid === a.id).map(e => e.v).join() };
  });
  await p.goto(BASE + `#/athlete/${I.aid}/testing`); await p.waitForTimeout(300);
  const names = await p.$$eval('.metric-card .mc-name', els => els.map(e => e.textContent.trim()));
  assert(names.includes('Peak force') && names.includes('Peak force (Isometric squat)'), `the IMTP and the isometric squat each get their own card (${names.join(', ')})`);
  const imtpCard = p.locator('.metric-card', { has: p.locator('.mc-name', { hasText: /^Peak force$/ }) });
  assert((await imtpCard.innerText()).includes('2,100') && (await imtpCard.locator('.mc-all').innerText()).includes('All 2 results') && !(await imtpCard.innerText()).includes('2,600'), 'the IMTP card’s change and chart use IMTP results only');
  await p.goto(BASE + `#/metric/${I.aid}/imtpPF`); await p.waitForTimeout(300);
  assert((await p.$$eval('.mt-table tbody tr', r => r.length)) === 2, 'the IMTP results page lists the 2 IMTP results');
  await p.goto(BASE + `#/metric/${I.aid}/ISQ%3AimtpPF`); await p.waitForTimeout(300);
  assert((await p.innerText('.topbar h1')).includes('Peak force (Isometric squat)') && (await p.$$eval('.mt-table tbody tr', r => r.length)) === 1, 'the isometric squat has its own results page');
  await p.goto(BASE + `#/athlete/${I.aid}/overview`); await p.waitForTimeout(300);
  assert(await p.locator(`a.tile[href="#/metric/${I.aid}/ISQ%3AimtpPF"]`).count() === 1 && (await p.innerText(`a.tile[href="#/metric/${I.aid}/ISQ%3AimtpPF"]`)).includes('(Isometric squat)'), 'the Overview tile follows the latest result and says which test it was');
  assert(I.lb === '2000,2100', `IMTP rankings and records use IMTP tests only (${I.lb})`);
  await p.goto(BASE + `#/metric/${I.aid}/ISQ%3Acmj`); await p.waitForTimeout(300);
  assert((await p.innerText('#view')).includes('isn’t available'), 'a made-up combination (isometric squat CMJ) says it isn’t available');

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
