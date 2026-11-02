/* =========================================================
   Leads: people interested in training, tracked from first contact to sign-up:
   communicated → consult call scheduled → evaluation scheduled → signed up (or not).
   A consult call or evaluation can sit on the calendar as an ordinary event with the id
   lead~<leadId>~consult | lead~<leadId>~eval (and leadId on the event). When that event exists it is
   the source of truth for the date, time and status (it may have been moved or completed there).
   ========================================================= */
const LEAD_SLOTS = {
  consult: { type: 'consult', label: 'Consult call', short: 'Consult', dur: 30 },
  eval: { type: 'evaluation', label: 'Evaluation', short: 'Evaluation', dur: 60 },
};
const LEAD_STAGES = [['new', 'New · not contacted yet'], ['talk', 'Communicated'], ['consult', 'Consult call scheduled'], ['eval', 'Evaluation scheduled'], ['signed', 'Signed up'], ['declined', 'Didn’t sign up']];
const LEAD_OPEN = ['new', 'talk', 'consult', 'eval'];
const LEAD_SOURCES = ['Referral', 'Instagram', 'Facebook', 'Website', 'Google', 'School / team', 'Event / clinic', 'Walk-in'];
const SLOT_STATUS = [['scheduled', 'Scheduled'], ['completed', 'Done'], ['noshow', 'No-show']];
const leadName = l => `${l.firstName || ''} ${l.lastName || ''}`.trim() || 'Lead';
const leadEvId = (l, k) => `lead~${l.id}~${k}`;
/* { date, time, status, ev } for a consult call / evaluation, or null if none is scheduled */
function leadSlot(l, k) {
  const ev = l.id ? getRec('events', leadEvId(l, k)) : null;
  if (ev) return { date: ev.date, time: ev.start || '', status: ev.status || 'scheduled', ev };
  return l[k + 'Date'] ? { date: l[k + 'Date'], time: l[k + 'Time'] || '', status: l[k + 'Status'] || 'scheduled', ev: null } : null;
}
const slotLive = s => !!s && s.status !== 'cancelled';
function leadStage(l) {
  if (l.outcome === 'signed' || l.outcome === 'declined') return l.outcome;
  if (slotLive(leadSlot(l, 'eval'))) return 'eval';
  if (slotLive(leadSlot(l, 'consult'))) return 'consult';
  return l.contacted ? 'talk' : 'new';
}
const slotWhen = s => `${fmtDate(s.date, { weekday: 'short', month: 'short', day: 'numeric' })}${s.time ? ', ' + fmtTime(s.time) : ''}`;
const leadAdded = l => (l.createdAt ? toDS(new Date(l.createdAt)) : null);

/* Saves a lead and keeps its consult call / evaluation events on the calendar in step.
   cal: { consult|eval: true/false } puts a slot on (or takes it off) the calendar; left out = keep as is.
   status: { consult|eval: 'completed' | … } when the coach changed it. */
function saveLead(l, { cal = {}, status = {} } = {}) {
  if (!l.id) l.id = uid();
  const old = getRec('leads', l.id);
  // scheduling a call or an evaluation means you've been in touch
  if ((l.consultDate || l.evalDate) && !l.contacted) { l.contacted = true; l.contactedDate ||= today(); }
  if (!l.contacted) l.contactedDate = null;
  if (!l.outcome) l.outcomeDate = null; else l.outcomeDate ||= today();
  const evs = [];
  Object.entries(LEAD_SLOTS).forEach(([k, d]) => {
    const id = leadEvId(l, k), cur = getRec('events', id), date = isDS(l[k + 'Date']) ? l[k + 'Date'] : null, time = date ? l[k + 'Time'] || '' : '';
    l[k + 'Date'] = date; l[k + 'Time'] = time;
    if (!date) { l[k + 'Status'] = ''; if (cur) evs.push([id, null]); return; }
    const was = cur ? { date: cur.date, time: cur.start || '' } : old ? { date: old[k + 'Date'], time: old[k + 'Time'] || '' } : null;
    const moved = !was || was.date !== date || was.time !== time;
    const st = status[k] || (moved ? 'scheduled' : cur?.status || l[k + 'Status'] || 'scheduled');
    l[k + 'Status'] = st;
    if (!(cal[k] ?? !!cur)) { if (cur) evs.push([id, null]); return; }
    evs.push([id, {
      ...(cur || { location: '', duration: d.dur }), id, leadId: l.id, type: d.type, date, start: time, status: st,
      title: `${d.label} — ${leadName(l)}`,
      athleteIds: l.athleteId && getAthlete(l.athleteId) ? [l.athleteId] : cur?.athleteIds || [],
      notes: cur ? cur.notes || '' : [l.parent ? `Parent: ${l.parent}` : '', l.phone, l.email].filter(Boolean).join(' · '),
    }]);
  });
  const saved = upsert('leads', l);
  evs.forEach(([id, ev]) => { if (ev) upsert('events', ev); else removeRec('events', id); });
  return saved;
}
function deleteLead(l) {
  Object.keys(LEAD_SLOTS).forEach(k => { if (getRec('events', leadEvId(l, k))) removeRec('events', leadEvId(l, k)); });
  removeRec('leads', l.id);
}

/* ---------------- Leads page ---------------- */
ROUTES.leads = (r = {}) => {
  const F = UI.leads;
  // #/leads/<id> (from Find) opens that lead; the address goes back to #/leads so a refresh doesn't reopen it
  const pick = r.parts?.[0] && getRec('leads', r.parts[0]);
  const mount = pick ? () => { history.replaceState(null, '', '#/leads'); openLeadModal(pick); } : undefined;
  const actions = `<button class="btn primary" data-act="newLead">${icon('plus', 'sm')}<span class="lbl">Lead</span></button>`;
  if (!S.leads.length) return {
    title: 'Leads', nav: 'leads', actions,
    body: `<div class="card">${emptyState_('filter', 'No leads yet', 'Add people who ask about training, then track each one: communicated, consult call, evaluation and whether they sign up. Consult calls and evaluations can go straight on your calendar.', `<button class="btn primary" data-act="newLead">${icon('plus', 'sm')}Add a lead</button>`)}</div>`,
  };
  const T = today(), st = new Map(S.leads.map(l => [l.id, leadStage(l)]));
  const n = k => S.leads.filter(l => st.get(l.id) === k).length;
  const open = S.leads.filter(l => LEAD_OPEN.includes(st.get(l.id))).length, signed = n('signed'), declined = n('declined');
  const upcoming = k => S.leads.filter(l => { const s = leadSlot(l, k); return LEAD_OPEN.includes(st.get(l.id)) && s && s.status === 'scheduled' && s.date >= T; }).length;
  const tile = (name, val, foot = '') => `<div class="tile"><div class="t-name">${name}</div><div class="t-val">${val}</div>${foot ? `<div class="faint tiny">${foot}</div>` : ''}</div>`;
  const body = `
    <div class="tiles ld-tiles">
      ${tile('Open', open, `${n('new')} not contacted yet`)}
      ${tile('Consults booked', upcoming('consult'), 'Upcoming consult calls')}
      ${tile('Evals booked', upcoming('eval'), 'Upcoming evaluations')}
      ${tile('Signed up', `${signed}${signed + declined ? ` <small>${Math.round(signed / (signed + declined) * 100)}%</small>` : ''}`, signed + declined ? 'Share of those who decided' : '')}
    </div>
    <div class="toolbar">
      <div class="searchbox grow">${icon('search', 'sm')}<input type="search" placeholder="Search name, parent, sport…" value="${esc(F.q)}" data-input="leadSearch" aria-label="Search leads"></div>
      <div class="seg inline">${[['open', `Open ${open}`], ['signed', `Signed up ${signed}`], ['declined', `Didn’t sign ${declined}`], ['all', 'All']].map(([v, l]) => `<button class="${F.view === v ? 'on' : ''}" data-act="leadView" data-v="${v}">${l}</button>`).join('')}</div>
    </div>
    <div id="leadResults">${leadResults()}</div>`;
  return { title: 'Leads', nav: 'leads', body, actions, mount };
};
A.leadSearch = el => { UI.leads.q = el.value; $('#leadResults').innerHTML = leadResults(); };
A.leadView = el => { UI.leads.view = el.dataset.v; refresh(); };
function leadResults() {
  const F = UI.leads, q = F.q.trim().toLowerCase();
  const stages = F.view === 'open' ? LEAD_OPEN : F.view === 'all' ? LEAD_STAGES.map(s => s[0]) : [F.view];
  let list = S.leads.map(l => ({ l, st: leadStage(l) })).filter(x => stages.includes(x.st));
  if (q) list = list.filter(({ l }) => [leadName(l), l.parent, l.sport, l.source, l.phone, l.email].join(' ').toLowerCase().includes(q));
  if (!list.length) return `<div class="card"><div class="muted" style="padding:6px 2px">${q ? 'No leads match your search.' : F.view === 'open' ? 'No open leads. New enquiries will show here.' : 'None yet.'}</div></div>`;
  const when = (l, k) => { const s = leadSlot(l, k); return s ? s.date + (s.time || '99:99') : '9999'; };
  const sorters = {
    new: (a, b) => (a.createdAt || 0) - (b.createdAt || 0),                       // waiting longest first
    talk: (a, b) => (a.contactedDate || '').localeCompare(b.contactedDate || ''),
    consult: (a, b) => when(a, 'consult').localeCompare(when(b, 'consult')),     // soonest first
    eval: (a, b) => when(a, 'eval').localeCompare(when(b, 'eval')),
    signed: (a, b) => (b.outcomeDate || '').localeCompare(a.outcomeDate || ''),   // latest first
    declined: (a, b) => (b.outcomeDate || '').localeCompare(a.outcomeDate || ''),
  };
  return LEAD_STAGES.filter(([k]) => stages.includes(k)).map(([k, label]) => {
    const g = list.filter(x => x.st === k).map(x => x.l).sort(sorters[k]);
    if (!g.length) return '';
    return `<div class="section-title">${esc(label)} <span class="count">${g.length}</span></div><div class="ld-list">${g.map(leadCard).join('')}</div>`;
  }).join('');
}
function leadCard(l) {
  const added = leadAdded(l), stage = leadStage(l);
  const sub = [l.sport, l.parent ? `Parent: ${l.parent}` : '', l.source, added ? `Added ${fmtDate(added)}` : ''].filter(Boolean).join(' · ');
  const tel = String(l.phone || '').replace(/[^\d+]/g, '');
  const contact = [
    tel ? `<a class="btn icon sm ghost" href="tel:${esc(tel)}" aria-label="Call ${esc(leadName(l))}" title="Call">${icon('phone', 'sm')}</a><a class="btn icon sm ghost" href="sms:${esc(tel)}" aria-label="Text ${esc(leadName(l))}" title="Text">${icon('message', 'sm')}</a>` : '',
    /^[^\s@<>"]+@[^\s@<>"]+$/.test(l.email || '') ? `<a class="btn icon sm ghost" href="mailto:${esc(l.email)}" aria-label="Email ${esc(leadName(l))}" title="Email">${icon('mail', 'sm')}</a>` : '',
  ].join('');
  const ath = l.athleteId && getAthlete(l.athleteId);
  const foot = stage === 'signed' ? (ath ? `<a class="btn sm" href="#/athlete/${ath.id}">${icon('users', 'sm')}View athlete</a>` : `<button class="btn sm primary" data-act="leadToAthlete" data-id="${l.id}">${icon('plus', 'sm')}Add as athlete</button>`) : '';
  return `<div class="card ld-card">
    <div class="ld-top"><button type="button" class="ld-open" data-act="editLead" data-id="${l.id}"><span class="ld-name">${esc(leadName(l))}</span>${sub ? `<span class="ld-sub">${esc(sub)}</span>` : ''}</button><span class="ld-contact">${contact}</span></div>
    <div class="ld-steps">${leadSteps(l)}</div>
    ${l.notes ? `<div class="ld-notes">${esc(l.notes)}</div>` : ''}
    ${foot ? `<div class="ld-foot">${foot}</div>` : ''}
  </div>`;
}
/* The four steps as buttons: tap to update that step */
function leadSteps(l) {
  const T = today();
  const chip = (k, cls, ic, text, label) => `<button type="button" class="ld-step ${cls}" data-act="leadStep" data-k="${k}" data-id="${l.id}" aria-label="${esc(label)}">${icon(ic, 'sm')}<span>${esc(text)}</span></button>`;
  const slotChip = k => {
    const d = LEAD_SLOTS[k], s = leadSlot(l, k);
    if (!slotLive(s)) return chip(k, 'todo', 'plus', `${d.label}${s ? ' (cancelled)' : ''}`, `Schedule the ${d.label.toLowerCase()}`);
    if (s.status === 'completed') return chip(k, 'done', 'check', `${d.short} done`, `${d.label} done (tap to change)`);
    if (s.status === 'noshow') return chip(k, 'bad', 'x', `${d.short}: no-show`, `${d.label}: no-show (tap to reschedule)`);
    return chip(k, s.date < T ? 'late' : 'sched', 'calendar', `${d.short} ${slotWhen(s)}`, `${d.label} ${slotWhen(s)}${s.date < T ? ', past: did it happen?' : ''} (tap to change)`);
  };
  return [
    l.contacted ? chip('contact', 'done', 'check', `Communicated${l.contactedDate ? ' ' + fmtDate(l.contactedDate) : ''}`, 'Communicated (tap to edit the lead)') : chip('contact', 'todo', 'plus', 'Communicated?', 'Mark as communicated today'),
    slotChip('consult'), slotChip('eval'),
    l.outcome === 'signed' ? chip('outcome', 'done', 'check', 'Signed up', 'Signed up (tap to change)') : l.outcome === 'declined' ? chip('outcome', 'bad', 'x', 'Didn’t sign up', 'Didn’t sign up (tap to change)') : chip('outcome', 'todo', 'plus', 'Signed up?', 'Did they sign up?'),
  ].join('');
}
A.newLead = () => openLeadModal(null);
A.editLead = el => { const l = getRec('leads', el.dataset.id); if (l) openLeadModal(l); };
A.leadToAthlete = el => { const l = getRec('leads', el.dataset.id); if (l) leadToAthlete(l); };
A.leadStep = async el => {
  const l = getRec('leads', el.dataset.id);
  if (!l) return;
  const k = el.dataset.k;
  if (k === 'contact') {
    if (l.contacted) return openLeadModal(l);
    saveLead({ ...l, contacted: true, contactedDate: today() });
    toast(`${leadName(l)}: communicated`); return refresh();
  }
  if (k === 'consult' || k === 'eval') return openLeadSlotModal(l, k);
  if (k === 'outcome') {
    const v = await choose(`Did ${l.firstName || leadName(l)} sign up?`, '', [{ label: 'Signed up', value: 'signed', style: 'primary' }, { label: 'Didn’t sign up', value: 'declined' }, { label: 'Not decided yet', value: 'open' }]);
    if (!v) return;
    const saved = saveLead({ ...l, outcome: v === 'open' ? '' : v, outcomeDate: v === l.outcome ? l.outcomeDate : null });
    toast(v === 'signed' ? `${leadName(l)} signed up` : v === 'declined' ? 'Marked as not signed up' : 'Marked as not decided');
    refresh();
    if (v === 'signed' && !(saved.athleteId && getAthlete(saved.athleteId))) offerLeadAthlete(saved);
  }
};
async function offerLeadAthlete(l) {
  const ok = await choose(`Add ${leadName(l)} as an athlete?`, 'Starts their profile with the name, sport and contact details from the lead. Add birth date and sex next, for the standards and percentiles.', [{ label: 'Add athlete', value: true, style: 'primary' }, { label: 'Later', value: false }]);
  if (ok) leadToAthlete(l);
}
function leadToAthlete(l) {
  openAthleteModal(null, { firstName: l.firstName, lastName: l.lastName, sport: l.sport, email: l.email, phone: l.phone }, a => {
    const cur = getRec('leads', l.id);
    if (cur) saveLead({ ...cur, athleteId: a.id, outcome: 'signed' });
  });
}
/* Schedule, move or complete a consult call / evaluation */
function openLeadSlotModal(l, k) {
  const d = LEAD_SLOTS[k], s = leadSlot(l, k), onCal = !!getRec('events', leadEvId(l, k));
  openModal({
    title: `${d.label} — ${leadName(l)}`, size: 'narrow', submit: 'Save', deleteLabel: 'Not scheduled',
    body: `<div class="fields">${field('Date', inp('date', s?.date || today(), 'type="date" required'))}${field('Time', inp('time', s?.time || '', 'type="time"'))}</div>
      ${slotLive(s) ? field('Status', segmented('status', SLOT_STATUS, s.status)) : ''}
      <label class="check"><input type="checkbox" name="cal" ${onCal || !s ? 'checked' : ''}> Show on my calendar</label>`,
    onSubmit: v => {
      if (!isDS(v.date)) return 'Choose a date.';
      // a cancelled one saved again is back on; otherwise only a changed status is passed on
      const status = !slotLive(s) ? { [k]: 'scheduled' } : v.status && v.status !== s.status ? { [k]: v.status } : {};
      saveLead({ ...l, [k + 'Date']: v.date, [k + 'Time']: v.time || '' }, { cal: { [k]: !!v.cal }, status });
      toast(status[k] === 'completed' ? `${d.label} done` : `${d.label} ${slotLive(s) ? 'updated' : 'scheduled'}`); refresh();
    },
    onDelete: s ? () => { saveLead({ ...l, [k + 'Date']: null, [k + 'Time']: '' }, { cal: { [k]: false } }); toast(`${d.label} removed`); refresh(); } : null,
  });
}
function openLeadModal(l, def = {}) {
  const isNew = !l;
  const x = l ? { ...l } : { firstName: '', lastName: '', parent: '', phone: '', email: '', sport: '', source: '', notes: '', contacted: false, contactedDate: null, consultDate: null, consultTime: '', evalDate: null, evalTime: '', outcome: '', outcomeDate: null, athleteId: '', ...def };
  const slots = { consult: leadSlot(x, 'consult'), eval: leadSlot(x, 'eval') };
  const onCal = k => (x.id && getRec('events', leadEvId(x, k))) || !slots[k];
  const step = (n, title, inner) => `<div class="ld-fstep"><div class="ld-fhead"><span class="ld-fn">${n}</span>${title}</div>${inner}</div>`;
  const slotStep = (n, k) => step(n, LEAD_SLOTS[k].label + ' scheduled', `<div class="fields three collapse">
      ${field('Date', inp(k + 'Date', slots[k]?.date || '', 'type="date"'))}
      ${field('Time', inp(k + 'Time', slots[k]?.time || '', 'type="time"'))}
      ${slotLive(slots[k]) ? field('Status', sel(k + 'Status', SLOT_STATUS, slots[k].status)) : '<div></div>'}
    </div><label class="check"><input type="checkbox" name="${k}Cal" ${onCal(k) ? 'checked' : ''}> Show on my calendar</label>`);
  const body = `
    <div class="fields">
      ${field('First name', inp('firstName', x.firstName, 'autofocus autocapitalize="words" required'))}
      ${field('Last name', inp('lastName', x.lastName, 'autocapitalize="words"'))}
      ${field('Parent / guardian', inp('parent', x.parent, 'autocapitalize="words" placeholder="If the athlete is under 18"'), { cls: 'full' })}
      ${field('Phone', inp('phone', x.phone, 'type="tel"'))}
      ${field('Email', inp('email', x.email, 'type="email" autocapitalize="off"'))}
      ${field('Sport', inp('sport', x.sport, 'list="sportList" placeholder="e.g. Soccer"'))}
      ${field('How they found you', inp('source', x.source, 'list="leadSources" placeholder="e.g. Referral"'))}
    </div>
    ${step(1, 'Communicated', `<div class="fields"><label class="check" style="align-self:center"><input type="checkbox" name="contacted" ${x.contacted ? 'checked' : ''}> We’ve communicated</label>${field('Date', inp('contactedDate', x.contactedDate || '', 'type="date"'))}</div>`)}
    ${slotStep(2, 'consult')}
    ${slotStep(3, 'eval')}
    ${step(4, 'Signed up?', segmented('outcome', [['', 'Not decided'], ['signed', 'Signed up'], ['declined', 'Didn’t sign up']], x.outcome || ''))}
    ${field('Notes', ta('notes', x.notes, 'rows="3" placeholder="What they’re looking for, follow-ups, pricing discussed…"'))}
    <datalist id="leadSources">${[...new Set([...LEAD_SOURCES, ...S.leads.map(o => o.source).filter(Boolean)])].map(s => `<option value="${esc(s)}">`).join('')}</datalist>
    <datalist id="sportList">${[...new Set([...S.athletes, ...S.leads].map(o => o.sport).filter(Boolean))].map(s => `<option value="${esc(s)}">`).join('')}</datalist>`;
  openModal({
    title: isNew ? 'New lead' : leadName(x), body, submit: isNew ? 'Add' : 'Save',
    onSubmit: v => {
      if (!v.firstName.trim()) return 'Add the lead’s first name.';
      for (const k of ['contactedDate', 'consultDate', 'evalDate']) if (v[k] && !isDS(v[k])) return 'Please choose valid dates.';
      if (v.email.trim() && !/^[^\s@<>"]+@[^\s@<>"]+$/.test(v.email.trim())) return 'That email address doesn’t look right.';
      const outcome = v.outcome || '';
      const rec = {
        ...x, firstName: v.firstName.trim(), lastName: v.lastName.trim(), parent: v.parent.trim(), phone: v.phone.trim(), email: v.email.trim(),
        sport: v.sport.trim(), source: v.source.trim(), notes: v.notes.trim(),
        contacted: !!v.contacted, contactedDate: v.contacted ? v.contactedDate || x.contactedDate || today() : null,
        consultDate: v.consultDate || null, consultTime: v.consultTime || '', evalDate: v.evalDate || null, evalTime: v.evalTime || '',
        outcome, outcomeDate: outcome && outcome === x.outcome ? x.outcomeDate : null,
      };
      const status = {};
      Object.keys(LEAD_SLOTS).forEach(k => { if (v[k + 'Status'] && v[k + 'Status'] !== slots[k]?.status) status[k] = v[k + 'Status']; });
      const saved = saveLead(rec, { cal: { consult: !!v.consultCal, eval: !!v.evalCal }, status });
      toast(isNew ? 'Lead added' : 'Lead saved');
      if (parseHash().name === 'leads') refresh(); else go('#/leads');
      if (outcome === 'signed' && x.outcome !== 'signed' && !(saved.athleteId && getAthlete(saved.athleteId))) setTimeout(() => offerLeadAthlete(saved), 50);
    },
    onMount: m => {
      // the communicated box and its date go together
      const box = $('input[name=contacted]', m.wrap), d = $('input[name=contactedDate]', m.wrap);
      box.addEventListener('change', () => { if (box.checked && !d.value) d.value = today(); if (!box.checked) d.value = ''; });
      d.addEventListener('change', () => { if (d.value) box.checked = true; });
    },
    onDelete: isNew ? null : async () => {
      const onc = Object.keys(LEAD_SLOTS).filter(k => getRec('events', leadEvId(x, k))).length;
      if (!(await confirmBox(`Delete ${leadName(x)}?`, `This removes the lead${onc ? ' and their consult call / evaluation from your calendar' : ''}.${x.athleteId && getAthlete(x.athleteId) ? ' Their athlete profile is kept.' : ''}`))) return false;
      deleteLead(x); toast('Lead deleted'); refresh();
    },
  });
}
