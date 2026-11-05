// Performance HQ end-to-end tests — v1.18 Group sessions: athletes in a group, each with their own
// program side by side, every program saved to the athlete's own profile as you type
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
  const st = (fn, a) => p.evaluate(fn, a);
  const fits = async () => (await st(() => document.documentElement.scrollWidth)) <= 391;
  const col = id => `.gb-col[data-gb-aid="${id}"]`;
  const pick = async names => {
    await p.waitForSelector('[data-xp-q]');
    for (const n of names) {
      const id = await st(x => S.exercises.find(e => e.name === x).id, n);
      await p.fill('[data-xp-q]', n); await p.waitForTimeout(60);
      await p.click(`.xp-row[data-xp-id="${id}"] >> visible=true`);
    }
    await p.click('[data-xp-add]'); await p.waitForTimeout(400);
  };
  await p.goto(BASE); await p.waitForSelector('.modal'); await p.check('input[name=demo]'); await submit(); await p.waitForTimeout(800);
  const A = await st(() => { const f = n => activeAthletes().find(a => a.firstName === n).id; return { maya: f('Maya'), ava: f('Ava'), marcus: f('Marcus'), ...(() => { const ids = ['Maya', 'Ava', 'Marcus'].map(n => activeAthletes().find(a => a.firstName === n).id); const free = d => !S.workouts.some(w => ids.includes(w.athleteId) && (w.date === d || w.date === addDays(d, 7))); const days = []; for (let i = 1; days.length < 2 && i < 60; i++) if (free(addDays(today(), i))) days.push(addDays(today(), i)); return { t1: days[0], t2: days[1] }; })(), bs: S.exercises.find(e => e.name === 'Back Squat').id }; });
  const wo = aid => st(({ aid }) => { const e = S.events.find(x => x.title === 'Varsity lift' && x.date >= today() && x.athleteIds.includes(aid)) || S.events.find(x => x.title === 'Varsity lift'); const w = S.workouts.find(w => w.athleteId === aid && w.eventId === e.id); return w && { date: w.date, title: w.title, n: w.items.length, items: w.items.map(i => ({ name: getExercise(i.exerciseId).name, sets: i.sets, reps: i.reps, pct: i.pct, intensity: i.intensity })), eventId: w.eventId }; }, { aid });

  console.log('== A Groups tab');
  const tabs = await p.$$eval('.tabbar .tab span', s => s.map(x => x.textContent));
  assert(tabs.join('|') === 'Home|Calendar|Athletes|Groups|Leads|VBT|More' && await fits(), `Groups is a tab on the iPhone (${tabs.join(', ')})`);
  assert(await st(() => NAV.some(n => n[0] === 'groups')), 'and in the Mac sidebar');
  await p.click('.tabbar [data-nav=groups]'); await p.waitForTimeout(300);
  const list = await p.innerText('#view');
  // demo workouts fall on Mondays and Thursdays: on those days a same-day workout already counts as programmed for the demo Speed group
  const spd = await st(() => groupProgrammed(S.events.find(e => e.title === 'Speed group')));
  assert(list.includes('Speed group') && list.includes(`2 athletes · ${spd} of 2 programmed`), `a calendar session with several athletes is a group session (${spd} of 2 programmed)`);

  console.log('== A new group session');
  await p.click('.top-actions [data-act=newGroup]'); await p.waitForTimeout(250);
  await p.fill(`${top} >> input[name=title]`, 'Varsity lift');
  await p.fill(`${top} >> input[name=date]`, A.t1); await p.fill(`${top} >> input[name=start]`, '15:30');
  await submit(); await p.waitForTimeout(150);
  assert((await p.innerText(`${top} >> .form-error`)).includes('Choose the athletes'), 'it needs athletes');
  for (const id of [A.maya, A.ava, A.marcus]) await p.click(`${top} >> .picker-list label:has(input[value="${id}"])`);
  await p.selectOption(`${top} >> select[name=repeat]`, '2');
  await submit(); await p.waitForTimeout(500);
  const evs = await st(() => S.events.filter(e => e.title === 'Varsity lift').sort((a, b) => a.date.localeCompare(b.date)));
  assert(evs.length === 2 && evs.every(e => e.type === 'session' && e.group === true && e.athleteIds.length === 3 && e.start === '15:30') && evs[0].seriesId && evs[0].seriesId === evs[1].seriesId && evs[1].date === await st(d => addDays(d, 7), A.t1), 'it goes on the calendar (weekly for 2 weeks)');
  const ev = evs[0];
  assert(p.url().endsWith(`#/groups/${ev.id}`) && await p.locator('.gb-col').count() === 3, 'the board opens with a column per athlete');
  const states = await p.$$eval('[data-gb-state]', els => els.map(e => e.textContent));
  assert(states.every(s => s === 'No program yet') && await p.locator('.gb-last').count() >= 2, 'each column starts empty, with the athlete’s last session');

  console.log('== Add exercises to everyone');
  await p.click('[data-gb-addall]'); await pick(['Back Squat', 'Romanian Deadlift']);
  const own = await st(({ ids, bs, d }) => ids.map(aid => lastRxMap(aid, d).get(bs)?.it.sets ?? null), { ids: [A.maya, A.ava, A.marcus], bs: A.bs, d: A.t1 });
  const shown = [];
  for (const id of [A.maya, A.ava, A.marcus]) shown.push(await p.inputValue(`${col(id)} >> .item-editor >> nth=0 >> input[data-k=sets]`));
  assert(own.every((s, i) => s == null || shown[i] === s), `each athlete’s Back Squat starts from their own last prescription (sets ${shown.join(', ')})`);
  const w0 = await Promise.all([A.maya, A.ava, A.marcus].map(wo));
  assert(w0.every(w => w && w.n === 2 && w.date === A.t1 && w.title === 'Varsity lift' && w.eventId === ev.id), 'saved straight away: a workout on each athlete’s own profile, on that date, linked to the session');
  assert((await p.innerText(`${col(A.ava)} >> [data-gb-state]`)) === '2 exercises · saved to Ava’s profile', 'each column says it is saved');
  assert(await fits(), 'the board fits the iPhone screen (columns swipe sideways)');
  await p.screenshot({ path: SP + '/v118-group-iphone.png' });

  console.log('== Individual programs');
  await p.fill(`${col(A.ava)} >> .item-editor >> nth=0 >> input[data-k=sets]`, '5'); await p.waitForTimeout(900);
  assert((await wo(A.ava)).items[0].sets === '5' && (await wo(A.maya)).items[0].sets === shown[0], 'changing Ava’s sets saves to Ava only');
  await p.click(`${col(A.marcus)} >> [data-gb-add]`); await pick(['Box Jump']);
  assert((await wo(A.marcus)).n === 3 && (await wo(A.maya)).n === 2, 'an exercise added for one athlete is theirs alone');
  await p.selectOption(`${col(A.maya)} >> .item-editor >> nth=0 >> select[data-k=intensity]`, 'pct'); await p.waitForTimeout(150);
  await p.fill(`${col(A.maya)} >> .item-editor >> nth=0 >> input[data-k=pct]`, '150'); await p.waitForTimeout(900);
  assert((await p.innerText(`${col(A.maya)} >> [data-gb-err]`)).includes('%1RM') && (await wo(A.maya)).items[0].intensity !== 'pct', 'a value out of range is flagged and not saved');
  await p.fill(`${col(A.maya)} >> .item-editor >> nth=0 >> input[data-k=pct]`, '80'); await p.waitForTimeout(900);
  const m1 = await wo(A.maya);
  assert(m1.items[0].intensity === 'pct' && m1.items[0].pct === 80 && await p.locator(`${col(A.maya)} >> [data-gb-err].hidden`).count() === 1, 'fixed → saved');
  await p.fill(`${col(A.ava)} >> .item-editor >> nth=1 >> input[data-k=reps]`, '8');
  await p.goto(BASE + '#/groups'); await p.waitForTimeout(300);
  assert((await wo(A.ava)).items[1].reps === '8', 'typing is saved even if you leave the page straight away');
  assert((await p.innerText('#view')).includes('3 of 3 programmed'), 'the list shows who is programmed');

  console.log('== On each athlete’s profile');
  await p.goto(BASE + `#/athlete/${A.ava}/program`); await p.waitForTimeout(250);
  const avaW = await st(({ aid, d }) => S.workouts.find(w => w.athleteId === aid && w.date === d && w.eventId).id, { aid: A.ava, d: A.t1 });
  assert(await st(id => workoutCard(getRec('workouts', id)).includes('Varsity lift'), avaW), 'Ava’s program is an ordinary workout on her Program tab');
  await st(id => openWorkoutModal(getRec('workouts', id)), avaW); await p.waitForTimeout(300);
  assert(await p.locator('#itemsHost .item-editor').count() === 2 && (await p.inputValue('#itemsHost .item-editor >> nth=0 >> input[data-k=sets]')) === '5', 'and opens in the workout form with her own values');
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(150);
  await p.goto(BASE + `#/groups/${ev.id}`); await p.waitForTimeout(400);
  assert(await p.locator(`${col(A.marcus)} .item-editor`).count() === 3 && (await p.inputValue(`${col(A.ava)} >> .item-editor >> nth=1 >> input[data-k=reps]`)) === '8', 'the board shows what was saved');

  console.log('== Copy, log, take out');
  await p.click(`${col(A.marcus)} >> [data-gb-copy]`); await p.waitForTimeout(250);
  await p.click(`${top} >> .picker-list label:has(input[value="${A.ava}"])`);
  await p.click(`${top} >> .seg label:has-text("Replace theirs")`); await p.uncheck(`${top} >> input[name=own]`);
  await submit(); await p.waitForTimeout(500);
  const mc = await wo(A.maya), mk = await wo(A.marcus);
  assert(mc.items.map(i => i.name).join() === mk.items.map(i => i.name).join() && (await wo(A.ava)).n === 2, 'Marcus’s program copied to Maya (replacing hers), not to Ava');
  assert((await p.innerText(`${col(A.maya)} >> .ie-from >> nth=0`)).startsWith('Copied from Marcus'), 'copied rows say where they came from');
  await p.click(`${col(A.ava)} >> [data-gb-log]`); await p.waitForTimeout(400);
  assert(await p.locator('.log-item').count() === 2, 'Log opens the athlete’s session logger');
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(200);
  await p.click(`${col(A.marcus)} >> [data-gb-rm]`); await p.waitForTimeout(200);
  await p.click('.dlg-actions button:has-text("Take out and delete it")'); await p.waitForTimeout(400);
  assert(!(await st(id => getRec('events', id).athleteIds, ev.id)).includes(A.marcus) && !(await wo(A.marcus)) && await p.locator('.gb-col').count() === 2, 'taking an athlete out can delete their program for the day');
  for (let i = (await p.locator(`${col(A.maya)} .item-editor`).count()); i > 0; i--) { await p.click(`${col(A.maya)} >> .item-editor >> nth=0 >> [data-it=rm]`); await p.waitForTimeout(150); }
  assert(!(await wo(A.maya)) && (await p.innerText(`${col(A.maya)} >> [data-gb-state]`)) === 'No program yet', 'removing every exercise removes the empty workout');

  console.log('== Moving the session');
  await p.click('[data-act=groupEdit]'); await p.waitForTimeout(250);
  await p.fill(`${top} >> input[name=date]`, A.t2); await submit(); await p.waitForTimeout(400);
  assert((await wo(A.ava)).date === A.t2 && await st(id => getRec('events', id).date, ev.id) === A.t2, 'a new date moves everyone’s program with it');
  await st(id => openEventModal(getRec('events', id)), ev.id); await p.waitForTimeout(250);
  assert((await p.innerText(top)).includes('Group board'), 'the calendar event opens the group board');
  await p.click(`${top} >> a:has-text("Group board")`); await p.waitForTimeout(400);
  assert(p.url().endsWith(`#/groups/${ev.id}`), 'from the calendar');
  assert(await st(() => normalizeState({ events: [{ id: 'e1', type: 'session', group: 'yes', date: '2026-01-01' }] }).events[0].group === false), 'the group flag is checked on load');

  console.log('== Mac: side by side');
  const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 800 } }); const q = await ctx2.newPage();
  q.on('pageerror', e => errors.push(e.message));
  await q.goto(BASE); await q.waitForSelector('.modal'); await q.check('input[name=demo]'); await q.click('.modal-head button[type=submit]'); await q.waitForTimeout(800);
  const gid = await q.evaluate(() => S.events.find(isGroupEv).id);
  await q.goto(BASE + `#/groups/${gid}`); await q.waitForTimeout(400);
  await q.click('[data-gb-addall]'); await q.waitForSelector('[data-xp-q]');
  const bs2 = await q.evaluate(() => S.exercises.find(e => e.name === 'Back Squat').id);
  await q.fill('[data-xp-q]', 'Back Squat'); await q.click(`.xp-row[data-xp-id="${bs2}"] >> visible=true`); await q.click('[data-xp-add]'); await q.waitForTimeout(400);
  const boxes = await q.$$eval('.gb-col', cs => cs.map(c => { const r = c.getBoundingClientRect(); return [Math.round(r.left), Math.round(r.top)]; }));
  assert(boxes.length === 2 && boxes[1][0] > boxes[0][0] + 300 && boxes[0][1] === boxes[1][1], 'the programs sit side by side');
  await q.screenshot({ path: SP + '/v118-group-mac.png' });
  await ctx2.close();

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
