// Performance HQ end-to-end tests — v1.30: a group session opens on an Overview with every athlete's program at once
// (cards that wrap, no sideways scrolling), with Edit for the column-per-athlete board
// Run all suites with:  npm test   (see CLAUDE.md)
const { chromium, devices } = require('playwright');
const SP = process.env.OUT_DIR || '.', BASE = (process.env.BASE_URL || 'http://localhost:8080/');
const assert = (c, m) => { if (!c) throw new Error('ASSERT: ' + m); console.log('  ✓ ' + m); };
(async () => {
  const browser = await chromium.launch();
  const errors = [];
  const setup = async (dev, n) => {
    const ctx = await browser.newContext(dev), p = await ctx.newPage();
    p.on('pageerror', e => errors.push(e.message));
    p.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
    await p.goto(BASE); await p.waitForSelector('.modal'); await p.click('.modal-wrap >> nth=-1 >> .modal-head button[type=submit]'); await p.waitForTimeout(400);
    await p.evaluate(() => addStarterLibrary());
    const G = await p.evaluate(n => {
      const T = today(), ex = name => S.exercises.find(e => e.name === name).id;
      const ids = [...Array(n)].map((_, i) => upsert('athletes', { firstName: ['Ava', 'Ben', 'Cy', 'Di', 'Eli', 'Fay', 'Gus', 'Hal'][i], lastName: 'Test', sex: i % 2 ? 'M' : 'F', dob: '2009-01-01', archived: false }).id);
      const ev = upsert('events', { type: 'session', group: true, title: 'Lift group', date: T, start: '15:30', athleteIds: ids, status: 'scheduled' });
      const rows = [[ex('Back Squat'), '3', '5', 'load', 100], [ex('Romanian Deadlift'), '3', '8', 'load', 70], [ex('Box Jump'), '3', '3', 'bw', null]];
      ids.slice(0, n - 1).forEach((aid, i) => upsert('workouts', { athleteId: aid, date: T, eventId: ev.id, title: 'Lift group', completed: false, items: rows.slice(0, 1 + (i % 3)).map((r, j) => ({ id: 'r' + j, exerciseId: r[0], sets: r[1], reps: r[2], intensity: r[3], load: r[4] })) }));
      return { gid: ev.id, ids };
    }, n);
    await p.goto(BASE + `#/groups/${G.gid}`); await p.waitForTimeout(500);
    return { ctx, p, G };
  };

  console.log('== On the Mac: everyone at once');
  const { ctx: mc, p, G } = await setup({ viewport: { width: 1280, height: 900 } }, 8);
  assert(await p.locator('.gb-wrap.view-over').count() === 1 && await p.locator('.gbo-card').count() === 8, 'the board opens on the Overview: a card for each of the 8 athletes');
  const stats = (await p.innerText('.gb-stats')).replace(/\s+/g, ' ');
  assert(stats.includes('8 athletes') && stats.includes('7 programmed') && stats.includes('0 logged'), `the header counts them (${stats})`);
  const lay = await p.evaluate(() => {
    const cards = [...document.querySelectorAll('.gbo-card')].map(c => c.getBoundingClientRect());
    const tops = [...new Set(cards.map(r => Math.round(r.top)))];
    return { perRow: cards.filter(r => Math.round(r.top) === Math.round(cards[0].top)).length, rows: tops.length, side: document.documentElement.scrollWidth <= document.documentElement.clientWidth, visible: document.querySelectorAll('.gb-col').length && getComputedStyle(document.querySelector('.gb-cols')).display };
  });
  assert(lay.perRow >= 3 && lay.side && lay.visible === 'none', `cards wrap ${lay.perRow} to a row (${lay.rows} rows), nothing scrolls sideways, the editing columns are put away`);
  const ava = (await p.innerText(`.gbo-card[data-gbo-aid="${G.ids[0]}"]`)).replace(/\s+/g, ' ');
  const cy = (await p.innerText(`.gbo-card[data-gbo-aid="${G.ids[2]}"]`)).replace(/\s+/g, ' ');
  const hal = await p.evaluate(id => { const c = document.querySelector(`.gbo-card[data-gbo-aid="${id}"]`); return { t: c.innerText.replace(/\s+/g, ' '), log: c.querySelector('[data-gbo-log]').disabled, copy: c.querySelector('[data-gbo-copy]').disabled }; }, G.ids[7]);
  assert(/Back Squat 3 × 5 @ 220\.5 lb/.test(ava) && /Romanian Deadlift 3 × 8 @ 154\.3 lb/.test(cy) && cy.includes('Box Jump 3 × 3') && cy.includes('3 exercises'), 'each card lists the exercises with sets × reps and the load');
  assert(hal.t.includes('No program') && hal.log && hal.copy, 'an athlete without a program says so (Log and Copy wait for exercises)');
  await p.screenshot({ path: SP + '/v130-group-overview-mac.png' });

  console.log('== Edit, and back');
  await p.click(`.gbo-card[data-gbo-aid="${G.ids[6]}"] >> [data-gbo-edit]`); await p.waitForTimeout(400);
  const ed = await p.evaluate(id => { const c = document.querySelector(`.gb-col[data-gb-aid="${id}"]`).getBoundingClientRect(); return { view: document.querySelector('.gb-wrap').className, left: c.left, right: c.right, w: innerWidth }; }, G.ids[6]);
  assert(ed.view.includes('view-edit') && ed.left >= 0 && ed.left < ed.w - 200, 'Edit on a card opens the editing board at that athlete');
  await p.click(`.gb-col[data-gb-aid="${G.ids[7]}"] >> [data-gb-add]`); await p.waitForSelector('[data-xp-q]');
  const bj = await p.evaluate(() => S.exercises.find(e => e.name === 'Box Jump').id);
  await p.fill('[data-xp-q]', 'Box Jump'); await p.click(`.xp-row[data-xp-id="${bj}"] >> visible=true`); await p.click('[data-xp-add]'); await p.waitForTimeout(500);
  await p.click('[data-gb-view=over]'); await p.waitForTimeout(200);
  assert((await p.innerText(`.gbo-card[data-gbo-aid="${G.ids[7]}"]`)).includes('Box Jump') && (await p.innerText('[data-gb-count]')) === '8', 'what you add under Edit shows on the Overview straight away');
  await p.goto(BASE + '#/groups'); await p.waitForTimeout(200);
  await p.goto(BASE + `#/groups/${G.gid}`); await p.waitForTimeout(400);
  assert(await p.locator('.gb-wrap.view-over').count() === 1, 'the board remembers the view you chose');

  console.log('== Log and copy from the Overview');
  await p.click(`.gbo-card[data-gbo-aid="${G.ids[1]}"] >> [data-gbo-log]`); await p.waitForTimeout(400);
  assert((await p.innerText('.modal-wrap >> nth=-1 >> .modal-head')).includes('Log session'), 'Log opens that athlete’s session log');
  await p.keyboard.press('Escape'); await p.waitForTimeout(200);
  await p.evaluate(({ aid, gid }) => { const w = S.workouts.find(x => x.athleteId === aid && x.eventId === gid); upsert('workouts', { ...w, completed: true, log: { r0: [{ load: 100, reps: 5 }] } }); refresh(); }, { aid: G.ids[1], gid: G.gid });
  await p.waitForTimeout(400);
  assert((await p.innerText(`.gbo-card[data-gbo-aid="${G.ids[1]}"]`)).includes('Logged') && (await p.innerText('[data-gb-logged]')) === '1', 'a logged session shows on its card and in the count');
  await p.click(`.gbo-card[data-gbo-aid="${G.ids[2]}"] >> [data-gbo-copy]`); await p.waitForTimeout(300);
  assert((await p.innerText('.modal-wrap >> nth=-1')).includes('Copy Cy’s program'), 'Copy offers the program to the others');
  await p.keyboard.press('Escape'); await p.waitForTimeout(150);
  await mc.close();

  console.log('== On the iPhone');
  const { ctx: ic, p: q } = await setup({ ...devices['iPhone 13'] }, 6);
  const ip = await q.evaluate(() => ({ cards: document.querySelectorAll('.gbo-card').length, side: document.documentElement.scrollWidth <= 391, oneCol: new Set([...document.querySelectorAll('.gbo-card')].map(c => Math.round(c.getBoundingClientRect().left))).size === 1 }));
  assert(ip.cards === 6 && ip.side && ip.oneCol, 'one card under another, the whole group in one scroll, nothing off the side');
  await q.screenshot({ path: SP + '/v130-group-overview-iphone.png' });
  await ic.close();

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
