// Performance HQ end-to-end tests — v1.16 Leads: communicated → consult call → evaluation → signed up (or not)
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
  const lead = () => st(() => S.leads.find(l => l.firstName === 'Riley'));
  const chip = k => p.innerText(`.ld-card:has-text("Riley Parker") [data-k=${k}]`);
  const sections = () => p.$$eval('#leadResults .section-title', els => els.map(e => e.childNodes[0].textContent.trim()));
  await p.goto(BASE); await p.waitForSelector('.modal'); await submit(); await p.waitForTimeout(400);
  const D = await st(() => ({ t: today(), t1: addDays(today(), 1), t2: addDays(today(), 2), t5: addDays(today(), 5), y: addDays(today(), -1) }));

  console.log('== A Leads tab');
  const tabs = await p.$$eval('.tabbar .tab span', s => s.map(x => x.textContent));
  assert(tabs.join('|') === 'Home|Calendar|Athletes|Leads|VBT|More', `Leads is a tab on the iPhone (${tabs.join(', ')})`);
  assert(await st(() => NAV.some(n => n[0] === 'leads')), 'and in the Mac sidebar');
  await p.click('.tabbar [data-nav=leads]'); await p.waitForTimeout(250);
  assert(p.url().endsWith('#/leads') && (await p.innerText('#view')).includes('No leads yet'), 'empty until the first lead');

  console.log('== Adding a lead');
  await p.click('.top-actions [data-act=newLead]'); await p.waitForTimeout(250);
  await submit(); await p.waitForTimeout(100);
  assert((await p.innerText(`${top} >> .form-error`)).includes('first name'), 'a first name is needed');
  await p.fill(`${top} >> input[name=firstName]`, 'Riley'); await p.fill(`${top} >> input[name=lastName]`, 'Parker');
  await p.fill(`${top} >> input[name=parent]`, 'Dana Parker'); await p.fill(`${top} >> input[name=phone]`, '(555) 010-1234');
  await p.fill(`${top} >> input[name=email]`, 'dana@example.com'); await p.fill(`${top} >> input[name=sport]`, 'Soccer'); await p.fill(`${top} >> input[name=source]`, 'Referral');
  assert(await fits(), 'the lead form fits the iPhone screen');
  await p.screenshot({ path: SP + '/v116-lead-form.png' });
  await submit(); await p.waitForTimeout(300);
  let l = await lead();
  assert(l && l.lastName === 'Parker' && l.parent === 'Dana Parker' && !l.contacted && !l.outcome, 'saved');
  assert((await sections()).join() === 'New · not contacted yet' && (await p.innerText('.ld-tiles .tile >> nth=0')).includes('1'), 'listed as a new lead');
  const steps = await p.$$eval('.ld-card .ld-step', els => els.map(e => e.textContent.trim()));
  assert(steps.join('|') === 'Communicated?|Consult call|Evaluation|Signed up?', `the four steps on the card (${steps.join(', ')})`);
  const hrefs = await p.$$eval('.ld-card .ld-contact a', as => as.map(a => a.getAttribute('href')));
  assert(hrefs.join(' ') === 'tel:5550101234 sms:5550101234 mailto:dana@example.com', 'one tap to call, text or email');

  console.log('== Communicated');
  await p.click('.ld-card [data-k=contact]'); await p.waitForTimeout(250);
  l = await lead();
  assert(l.contacted && l.contactedDate === D.t && (await chip('contact')).startsWith('Communicated ') && (await sections()).join() === 'Communicated', 'one tap marks it (with today’s date) and moves the lead along');

  console.log('== Consult call on the calendar');
  await p.click('.ld-card [data-k=consult]'); await p.waitForTimeout(250);
  assert((await p.innerText(`${top} >> .modal-head h2`)) === 'Consult call — Riley Parker' && await p.isChecked(`${top} >> input[name=cal]`), 'scheduling asks for a date and time, on the calendar by default');
  await p.fill(`${top} >> input[name=date]`, D.t1); await p.fill(`${top} >> input[name=time]`, '17:30'); await submit(); await p.waitForTimeout(300);
  l = await lead();
  let ev = await st(id => getRec('events', `lead~${id}~consult`), l.id);
  assert(ev && ev.type === 'consult' && ev.date === D.t1 && ev.start === '17:30' && ev.title === 'Consult call — Riley Parker' && ev.status === 'scheduled' && ev.leadId === l.id && ev.notes.includes('Dana Parker'), 'it is a consult event on the calendar, with the parent and phone in its notes');
  assert(await st(id => leadStage(getRec('leads', id)), l.id) === 'consult' && /^Consult .*5:30/.test(await chip('consult')), 'the lead shows the consult call');
  await st(d => { UI.cal.sel = d; UI.cal.cursor = d; }, D.t1);
  await p.goto(BASE + '#/calendar'); await p.waitForTimeout(350);
  assert((await p.innerText('#view')).includes('Consult call — Riley Parker'), 'and the calendar shows it on that day');

  console.log('== Moved on the calendar');
  await st(id => openEventModal(getRec('events', id)), ev.id); await p.waitForTimeout(250);
  assert((await p.innerText(`${top}`)).includes('Lead: Riley Parker'), 'the calendar event links back to the lead');
  await p.fill(`${top} >> input[name=date]`, D.t2); await submit(); await p.waitForTimeout(300);
  await p.goto(BASE + '#/leads'); await p.waitForTimeout(300);
  assert(await st(id => leadSlot(getRec('leads', id), 'consult').date, l.id) === D.t2, 'moving it on the calendar moves it on the lead');
  await p.click('.ld-card [data-act=editLead]'); await p.waitForTimeout(250);
  assert((await p.inputValue(`${top} >> input[name=consultDate]`)) === D.t2, 'the lead form shows the new date');
  await submit(); await p.waitForTimeout(300);
  assert(await st(id => getRec('events', `lead~${id}~consult`)?.date, l.id) === D.t2, 'saving the lead keeps it');

  console.log('== Done, and an evaluation off the calendar');
  await p.click('.ld-card [data-k=consult]'); await p.waitForTimeout(250);
  await p.click(`${top} >> .seg label:has-text("Done")`); await submit(); await p.waitForTimeout(300);
  assert(await st(id => getRec('events', `lead~${id}~consult`).status, l.id) === 'completed' && (await chip('consult')) === 'Consult done', 'marking the consult call done marks the calendar event completed');
  await p.click('.ld-card [data-k=eval]'); await p.waitForTimeout(250);
  await p.fill(`${top} >> input[name=date]`, D.t5); await p.fill(`${top} >> input[name=time]`, '16:00'); await p.uncheck(`${top} >> input[name=cal]`); await submit(); await p.waitForTimeout(300);
  l = await lead();
  assert(l.evalDate === D.t5 && l.evalTime === '16:00' && !(await st(id => getRec('events', `lead~${id}~eval`), l.id)) && (await st(id => leadStage(getRec('leads', id)), l.id)) === 'eval', 'an evaluation can be kept off the calendar');
  assert((await sections()).join() === 'Evaluation scheduled' && (await chip('eval')).startsWith('Evaluation '), 'the lead moves to Evaluation scheduled');

  console.log('== Follow-ups');
  await st(() => upsert('athletes', { firstName: 'Current', lastName: 'Athlete', sex: 'F', dob: '2009-01-01', archived: false }));
  await p.click('.ld-card [data-k=eval]'); await p.waitForTimeout(250);
  await p.fill(`${top} >> input[name=date]`, D.y); await submit(); await p.waitForTimeout(300);
  assert((await p.getAttribute('.ld-card [data-k=eval]', 'class')).includes('late'), 'a past evaluation not marked done is flagged');
  await st(() => upsert('leads', { firstName: 'Taylor', lastName: 'Nguyen', contacted: false, outcome: '' }));
  await p.goto(BASE + '#/dashboard'); await p.waitForTimeout(350);
  const na = (await p.$$eval('.na-card .na-text', els => els.map(e => e.textContent))).filter(t => /lead/.test(t));
  assert(na.some(t => t.startsWith('1 new lead to contact: Taylor Nguyen')) && na.some(t => t.startsWith('1 lead to follow up after their consult call or evaluation: Riley Parker')), `Needs attention: ${na.join(' | ')}`);

  console.log('== Signed up → athlete');
  await p.goto(BASE + '#/leads'); await p.waitForTimeout(300);
  await p.click('.ld-card:has-text("Riley Parker") [data-k=outcome]'); await p.waitForTimeout(200);
  await p.click('.dlg-actions button:has-text("Signed up")'); await p.waitForTimeout(250);
  assert((await p.innerText('.dialog')).includes('Add Riley Parker as an athlete?'), 'signing up offers to start an athlete profile');
  await p.click('.dlg-actions button:has-text("Add athlete")'); await p.waitForTimeout(250);
  const pre = { f: await p.inputValue(`${top} >> input[name=firstName]`), s: await p.inputValue(`${top} >> input[name=sport]`), ph: await p.inputValue(`${top} >> input[name=phone]`), em: await p.inputValue(`${top} >> input[name=email]`) };
  assert(pre.f === 'Riley' && pre.s === 'Soccer' && pre.ph === '(555) 010-1234' && pre.em === 'dana@example.com', 'the athlete form starts with the lead’s details');
  await p.selectOption(`${top} >> select[name=sex]`, 'F'); await submit(); await p.waitForTimeout(350);
  l = await lead();
  const ath = await st(id => getAthlete(id), l.athleteId);
  assert(ath && ath.lastName === 'Parker' && l.outcome === 'signed' && l.outcomeDate === D.t && p.url().includes(`#/athlete/${ath.id}`), 'the athlete is added, linked to the lead, and their profile opens');
  assert(JSON.stringify(await st(id => getRec('events', `lead~${id}~consult`).athleteIds, l.id)) === JSON.stringify([ath.id]), 'their calendar event now names the athlete');
  await p.goto(BASE + '#/leads'); await p.waitForTimeout(300);
  assert(!(await sections()).includes('Signed up') && await p.locator('.ld-card:has-text("Riley Parker")').count() === 0, 'a signed-up lead leaves the Open list');

  console.log('== Views, search and Find');
  await st(() => saveLead({ firstName: 'Morgan', lastName: 'Lee', contacted: true, contactedDate: today(), outcome: 'declined' }));
  await p.click('[data-act=leadView][data-v=signed]'); await p.waitForTimeout(200);
  assert((await p.innerText('#leadResults')).includes('Riley Parker') && (await p.innerText('.ld-card [data-act=leadToAthlete], .ld-card a[href^="#/athlete/"]')).includes('View athlete'), 'Signed up view, with a link to the athlete');
  await p.click('[data-act=leadView][data-v=declined]'); await p.waitForTimeout(200);
  assert((await p.innerText('#leadResults')).includes('Morgan Lee') && !(await p.innerText('#leadResults')).includes('Riley'), 'Didn’t sign up view');
  await p.click('[data-act=leadView][data-v=all]'); await p.waitForTimeout(200);
  await p.fill('[data-input=leadSearch]', 'dana'); await p.waitForTimeout(150);
  const found = await p.$$eval('#leadResults .ld-name', els => els.map(e => e.textContent));
  assert(found.join() === 'Riley Parker', 'search finds a lead by the parent’s name');
  assert(/Signed up\s*1/.test(await p.innerText('.ld-tiles')) && (await p.innerText('.ld-tiles')).includes('50%'), 'sign-up rate among those who decided (1 of 2)');
  await p.fill('[data-input=leadSearch]', ''); await p.click('[data-act=leadView][data-v=open]'); await p.waitForTimeout(150);
  await st(() => A.quickFind()); await p.waitForTimeout(200);
  await p.fill('#qfInput', 'taylor'); await p.waitForTimeout(250);
  await p.click(`${top} >> a[href^="#/leads/"]`); await p.waitForTimeout(400);
  assert(p.url().endsWith('#/leads') && (await p.innerText(`${top} >> .modal-head h2`)) === 'Taylor Nguyen', 'Find (⌘K) opens a lead');

  console.log('== Delete');
  await p.click(`${top} >> .modal-head [data-close]`); await p.waitForTimeout(150);
  await p.click('[data-act=leadView][data-v=all]'); await p.waitForTimeout(150);
  await p.click('.ld-card:has-text("Riley Parker") [data-act=editLead]'); await p.waitForTimeout(250);
  await p.click(`${top} >> [data-del]`); await p.waitForTimeout(200);
  assert((await p.innerText('.dialog')).includes('Their athlete profile is kept'), 'deleting says what happens');
  await p.click('.dlg-actions button[data-i="0"]'); await p.waitForTimeout(300);
  assert(await st(id => !getRec('leads', id) && !S.events.some(e => e.leadId === id) && !!S.athletes.find(a => a.firstName === 'Riley'), l.id), 'the lead and its calendar events are gone; the athlete stays');

  console.log('== Data safety and sync');
  const clean = await st(() => normalizeState({ leads: [{ id: 'x1', firstName: '<img src=x onerror="window.__xss=1">', consultDate: 'tomorrow', consultTime: '25pm', evalStatus: 'whatever', outcome: 'maybe', contacted: 'yes', athleteId: 'bad id!', notes: 'n'.repeat(5000) }] }).leads[0]);
  assert(clean.consultDate === null && clean.consultTime === '' && clean.evalStatus === '' && clean.outcome === '' && clean.contacted === false && clean.athleteId === '' && clean.notes.length === 4000, 'lead data is checked on load, import and sync');
  await st(c => { S.leads.push(c); }, clean); await p.goto(BASE + '#/leads?x=1'); await p.waitForTimeout(300);
  assert(await st(() => !document.querySelector('#view img') && !window.__xss && document.querySelector('#view').innerText.includes('<img')), 'names are shown as text, never as code');
  await st(() => removeRec('leads', 'x1'));
  const sync = await st(() => {
    const r1 = mergeState(normalizeState({ leads: [{ id: 'L9', firstName: 'Sam', createdAt: 1, updatedAt: Date.now() + 1000 }] }));
    const had = !!getRec('leads', 'L9');
    removeRec('leads', 'L9');
    mergeState(normalizeState({ leads: [{ id: 'L9', firstName: 'Sam', createdAt: 1, updatedAt: 5 }] }));
    return { inCols: COLS.includes('leads'), added: r1.added, had, back: !!getRec('leads', 'L9') };
  });
  assert(sync.inCols && sync.added === 1 && sync.had && !sync.back, 'leads sync and back up like athletes (a deleted lead stays deleted)');

  console.log('== Demo data');
  const ctx2 = await browser.newContext({ ...devices['iPhone 13'] }); const q = await ctx2.newPage();
  q.on('pageerror', e => errors.push(e.message));
  await q.goto(BASE); await q.waitForSelector('.modal'); await q.check('input[name=demo]'); await q.click('.modal-head button[type=submit]'); await q.waitForTimeout(800);
  const demo = await q.evaluate(() => ({ st: S.leads.map(leadStage).sort().join(), ev: S.events.filter(e => e.leadId).map(e => `${e.type}:${e.demo}`).sort().join() }));
  assert(demo.st === 'consult,declined,eval,new,signed,talk' && demo.ev === 'consult:true,evaluation:true', `sample leads at every step (${demo.st})`);
  await q.goto(BASE + '#/leads'); await q.waitForTimeout(400);
  assert((await q.evaluate(() => document.documentElement.scrollWidth)) <= 391, 'the Leads tab fits the iPhone screen');
  await q.screenshot({ path: SP + '/v116-leads.png' });
  await ctx2.close();

  await browser.close();
  console.log(errors.length ? 'ERRORS:\n' + errors.join('\n') : 'ALL PASSED, NO CONSOLE ERRORS');
})().catch(e => { console.error(e.message); process.exit(1); });
