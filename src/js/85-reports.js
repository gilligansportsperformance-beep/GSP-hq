/* =========================================================
   Branding, training philosophy and athlete progress reports
   ========================================================= */
const DEFAULT_BRAND = {
  logo: null, primary: '#101010', accent: '#C8A96E',
  wordTop: 'Gilligan Sports', wordBottom: 'Performance · NJ',
  tagline: 'Elite Athletic Development · Hunterdon County, NJ',
  email: 'gilligansportsperformance@gmail.com', phone: '(908) 235-6133', website: '', location: 'Hunterdon County, NJ',
};
function brand() { return { ...DEFAULT_BRAND, ...(S.settings.brand || {}) }; }
function bizName() { return S.settings.businessName || `${brand().wordTop} ${brand().wordBottom.split('·')[0]}`.trim(); }

/* ---------- Training philosophy ---------- */
const DEFAULT_PHILOSOPHY = {
  mission: 'Train Different. Perform Elite. Science-backed speed and strength coaching that develops stronger, faster and more confident athletes — every session has a purpose.',
  principles: [
    { title: 'Tested every week', text: 'Athletes are timed and evaluated every week. Progress is tracked, shared with families and used to continuously refine each program — everyone always knows exactly where they stand.' },
    { title: 'Built around the athlete', text: 'No cookie-cutter workouts. Every plan is built from the athlete’s evaluation, reflecting the demands of their sport, their strengths and their weaknesses.' },
    { title: 'Coaching that transfers', text: 'Sprint mechanics, strength with technique and explosive power that carry onto the field, court or track — not just gym numbers.' },
    { title: 'Science, intensity, accountability', text: 'Every session blends evidence-based training, real intensity and accountability, while keeping it competitive and fun. High standards, real relationships.' },
    { title: 'Long-term development', text: 'Age-appropriate strength work and progressive overload that respect growth and maturation, building discipline and confidence that carry beyond sport.' },
  ],
  process: 'Evaluate → Build the individual program → Coach every rep → Test weekly → Report monthly → Refine.',
  standards: 'Show up, compete, own the details. Quality before load, speed before fatigue.',
};
function philosophy() { return { ...DEFAULT_PHILOSOPHY, ...(S.settings.philosophy || {}) }; }
function philosophyText() {
  const p = philosophy();
  return `Mission: ${p.mission}\nPrinciples:\n${p.principles.map(x => `- ${x.title}: ${x.text}`).join('\n')}\nProcess: ${p.process}\nStandards: ${p.standards}`;
}
ROUTES.philosophy = () => {
  const p = philosophy();
  const b = brand();
  const body = `
    <div class="phil-hero" style="--bp:${esc(b.primary)};--ba:${esc(b.accent)}">
      <div class="kicker" style="color:var(--ba)">Training philosophy</div>
      <h2>${esc(p.mission)}</h2>
    </div>
    <div class="grid cards" style="margin-top:16px">${p.principles.map((x, i) => `<div class="card"><div class="phil-num" style="color:${esc(b.accent)}">${String(i + 1).padStart(2, '0')}</div><h3 style="font-size:17px;margin:4px 0 6px">${esc(x.title)}</h3><p class="muted" style="margin:0">${esc(x.text)}</p></div>`).join('')}</div>
    <div class="grid halves" style="margin-top:16px">
      <div class="card"><div class="card-head"><h3>Process</h3></div><p style="margin:0;white-space:pre-wrap">${esc(p.process)}</p></div>
      <div class="card"><div class="card-head"><h3>Standards</h3></div><p style="margin:0;white-space:pre-wrap">${esc(p.standards)}</p></div>
    </div>
    <p class="faint small" style="margin-top:14px">Your philosophy appears in progress reports (optional section) and guides the Force Plate AI’s recommendations. ${S.settings.philosophy ? '' : 'This draft was written from your website — edit it to make it yours.'}</p>`;
  return { title: 'Training Philosophy', body, actions: `<button class="btn primary" data-act="editPhilosophy">${icon('edit', 'sm')}<span class="lbl">Edit</span></button>` };
};
A.editPhilosophy = () => {
  const p = JSON.parse(JSON.stringify(philosophy()));
  const draw = () => p.principles.map((x, i) => `<div class="item-editor" data-pi="${i}"><div class="ie-head"><span class="ie-n">${i + 1}</span><input type="text" data-pk="title" value="${esc(x.title)}" placeholder="Principle" style="flex:1"><button type="button" class="btn icon sm ghost" data-prm="${i}" style="color:var(--bad)" aria-label="Remove">${icon('x', 'sm')}</button></div><textarea data-pk="text" rows="2" style="margin-bottom:12px">${esc(x.text)}</textarea></div>`).join('');
  openModal({
    title: 'Edit philosophy', size: 'wide',
    body: `${field('Mission statement', ta('mission', p.mission, 'rows="3"'))}
      <div class="field"><span class="field-label">Core principles</span><div id="prinHost">${draw()}</div><button type="button" class="btn block" data-padd>${icon('plus', 'sm')}Add principle</button></div>
      ${field('Process', ta('process', p.process, 'rows="2"'))}
      ${field('Standards / non-negotiables', ta('standards', p.standards, 'rows="2"'))}`,
    footer: '<button type="button" class="btn" data-preset>Reset to website draft</button>',
    onSubmit: v => {
      const principles = p.principles.filter(x => x.title.trim() || x.text.trim()).map(x => ({ title: x.title.trim(), text: x.text.trim() }));
      if (!v.mission.trim()) return 'Add a mission statement.';
      S.settings.philosophy = { mission: v.mission.trim(), principles, process: v.process.trim(), standards: v.standards.trim() };
      persist(); toast('Philosophy saved'); refresh();
    },
    onMount: m => {
      const host = $('#prinHost', m.wrap);
      host.addEventListener('input', e => { const box = e.target.closest('[data-pi]'); if (box && e.target.dataset.pk) p.principles[+box.dataset.pi][e.target.dataset.pk] = e.target.value; });
      host.addEventListener('click', e => { const b = e.target.closest('[data-prm]'); if (b) { p.principles.splice(+b.dataset.prm, 1); host.innerHTML = draw(); } });
      $('[data-padd]', m.wrap).addEventListener('click', () => { p.principles.push({ title: '', text: '' }); host.innerHTML = draw(); host.lastElementChild?.querySelector('input')?.focus(); });
      $('[data-preset]', m.wrap).addEventListener('click', async () => {
        if (!(await confirmBox('Reset to the website draft?', 'Your edits will be replaced.', { ok: 'Reset' }))) return;
        delete S.settings.philosophy; persist(); m.close(); refresh();
      });
    },
  });
};

/* ---------- Branding (settings) ---------- */
function brandMark(b = brand(), size = 'md') {
  if (b.logo) return `<img class="brand-logo size-${size}" src="${b.logo}" alt="${esc(bizName())} logo">`;
  return `<div class="wordmark size-${size}" style="--ba:${esc(b.accent)}"><span class="wm-top">${esc(b.wordTop)}</span><span class="wm-bottom">${esc(b.wordBottom)}</span></div>`;
}
A.editBranding = () => {
  const b = brand();
  let logo = b.logo;
  openModal({
    title: 'Branding', size: 'wide',
    body: `<div class="brand-preview" id="brandPrev" style="--bp:${esc(b.primary)};--ba:${esc(b.accent)}">${brandMark(b)}</div>
      <div class="field"><span class="field-label">Logo</span><div class="chips"><button type="button" class="btn" data-logo-up>${icon('upload', 'sm')}${b.logo ? 'Replace logo' : 'Upload logo'}</button><button type="button" class="btn danger-ghost ${b.logo ? '' : 'hidden'}" data-logo-rm>Remove logo</button></div>
        <span class="hint">PNG with a transparent background looks best (shown on your dark header). Without a logo, the wordmark below is used.</span><input type="file" accept="image/*" class="hidden" data-logo-file></div>
      <div class="fields">
        ${field('Wordmark — top line', inp('wordTop', b.wordTop))}
        ${field('Wordmark — bottom line', inp('wordBottom', b.wordBottom))}
        ${field('Primary colour', `<input type="color" name="primary" value="${esc(b.primary)}" style="height:42px;padding:4px">`)}
        ${field('Accent colour', `<input type="color" name="accent" value="${esc(b.accent)}" style="height:42px;padding:4px">`)}
        ${field('Tagline', inp('tagline', b.tagline), { cls: 'full' })}
        ${field('Email', inp('email', b.email, 'type="email" autocapitalize="off"'))}
        ${field('Phone', inp('phone', b.phone, 'type="tel"'))}
        ${field('Website', inp('website', b.website, 'type="url" autocapitalize="off" placeholder="https://…"'))}
        ${field('Location', inp('location', b.location))}
      </div>`,
    footer: '<button type="button" class="btn" data-brand-reset>Reset to GSP defaults</button>',
    onSubmit: v => {
      S.settings.brand = { logo, primary: v.primary, accent: v.accent, wordTop: v.wordTop.trim(), wordBottom: v.wordBottom.trim(), tagline: v.tagline.trim(), email: v.email.trim(), phone: v.phone.trim(), website: v.website.trim(), location: v.location.trim() };
      persist(); applyTheme(); toast('Branding saved'); refresh();
    },
    onMount: m => {
      const prev = () => { const f = formData(m.form); const nb = { ...b, ...f, logo }; const el = $('#brandPrev', m.wrap); el.style.setProperty('--bp', f.primary); el.style.setProperty('--ba', f.accent); el.innerHTML = brandMark(nb); $('[data-logo-rm]', m.wrap).classList.toggle('hidden', !logo); };
      m.form.addEventListener('input', prev);
      $('[data-logo-up]', m.wrap).addEventListener('click', () => $('[data-logo-file]', m.wrap).click());
      $('[data-logo-file]', m.wrap).addEventListener('change', async e => {
        const f = e.target.files?.[0]; e.target.value = '';
        if (!f) return;
        try { logo = await shrinkImage(f, 900); prev(); } catch (err) { toast('Couldn’t read that image', 'err'); }
      });
      $('[data-logo-rm]', m.wrap).addEventListener('click', () => { logo = null; prev(); });
      $('[data-brand-reset]', m.wrap).addEventListener('click', async () => {
        if (!(await confirmBox('Reset branding to the GSP defaults?', 'Your logo and colours will be cleared.', { ok: 'Reset' }))) return;
        delete S.settings.brand; persist(); applyTheme(); m.close(); refresh();
      });
    },
  });
};
function shrinkImage(file, max) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onerror = reject;
    fr.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const s = Math.min(1, max / Math.max(img.naturalWidth || max, img.naturalHeight || max));
        const c = document.createElement('canvas');
        c.width = Math.max(1, Math.round((img.naturalWidth || max) * s)); c.height = Math.max(1, Math.round((img.naturalHeight || max) * s));
        c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
        resolve(c.toDataURL('image/png'));
      };
      img.src = fr.result;
    };
    fr.readAsDataURL(file);
  });
}

/* ---------- Reports ---------- */
const REPORT_SECTIONS = [
  ['highlights', 'Highlights'], ['testing', 'Performance testing table'], ['standards', 'High-school standards'], ['charts', 'Trend charts'], ['forceplate', 'Force plate profile'],
  ['strength', 'Strength & VBT'], ['attendance', 'Attendance & training'], ['assessment', 'Coach’s assessment'], ['next', 'Focus for next period'], ['philosophy', 'Training philosophy'],
];
const REPORT_KEYS = ['sprint10', 'sprint10yd', 'sprint20', 'sprint30', 'sprint40yd', 'fly10', 'fly10yd', 'vmax', 'proAgility', 'cod505', 'cmj', 'sj', 'vj', 'broad', 'djRsi', 'rsi105', 'rsiMod', 'ttt', 'takeoffVel', 'propImp', 'cmjPP', 'cmjRelPP', 'brakeRfd', 'imtpPF', 'imtpRel', 'imtpF100', 'imtpF200', 'imtpF100Rel', 'imtpF200Rel', 'slImtpRel', 'calfIsoRel', 'dlPlfRel', 'dlTts', 'dsi', 'eur', 'bm'];
function repDefaults(aid) {
  return { athleteId: aid, period: '30', from: addDays(today(), -30), to: today(), title: 'Monthly Progress Report', recipient: '', sections: Object.fromEntries(REPORT_SECTIONS.map(([k]) => [k, k !== 'philosophy'])), metrics: null, assessment: '', next: '', reportId: null, baseline: 'first' };
}
/* The athlete's first day of data (tests, sessions or workouts), for the "All time" period */
function firstDataDate(aid) {
  return [testsFor(aid)[0]?.date, ...eventsFor(aid).map(e => e.date), ...S.workouts.filter(w => w.athleteId === aid).map(w => w.date)].filter(isDS).sort()[0] || null;
}
function repRange(c) {
  if (c.period === 'custom') return { from: isDS(c.from) ? c.from : addDays(today(), -30), to: isDS(c.to) ? c.to : today() };
  if (c.period === 'all') { const f = firstDataDate(c.athleteId); return { from: f && f < today() ? f : addDays(today(), -30), to: today() }; }
  return { from: addDays(today(), -(+c.period)), to: today() };
}
function repData(c) {
  const a = getAthlete(c.athleteId);
  const { from, to } = repRange(c);
  const tests = testsFor(a.id);
  const inP = tests.filter(t => t.date >= from && t.date <= to);
  const metricRows = [...REPORT_KEYS, ...customKeys()].filter(k => M[k]).map(k => {
    const s = metricSeries(a.id, k).filter(p => p.date <= to);
    const inside = s.filter(p => p.date >= from);
    if (!inside.length) return null;
    // change is measured from the athlete's first result (default) or from the start of the period
    const before = s.filter(p => p.date < from);
    const start = c.baseline === 'period' ? (before.length ? before[before.length - 1] : inside[0]) : s[0];
    const last = inside[inside.length - 1];
    const pct = start !== last ? (last.v - start.v) / Math.abs(start.v) * 100 : null;
    const vals = s.map(p => p.v);
    const best = M[k].dir === -1 ? Math.min(...vals) : Math.max(...vals);
    const pb = M[k].dir !== 0 && s.length > 1 && last.v === best && s.filter(p => p.v === best).length === 1;
    const cls = changeClass(M[k], pct);
    return { k, def: M[k], start, last, pct, best, pb, cls, series: s };
  }).filter(Boolean);
  const evs = eventsFor(a.id).filter(e => e.date >= from && e.date <= to);
  const done = evs.filter(e => athleteStatus(e, a.id) === 'completed').length, noshow = evs.filter(e => athleteStatus(e, a.id) === 'noshow').length;
  const sched = evs.filter(e => e.status !== 'cancelled' && (e.date < today() || e.status !== 'scheduled')).length;
  const wos = S.workouts.filter(w => w.athleteId === a.id && w.date >= from && w.date <= to);
  const woDone = wos.filter(w => w.completed);
  const rpes = woDone.filter(w => w.rpe != null).map(w => w.rpe);
  const vbt = S.vbt.filter(l => l.athleteId === a.id && l.date >= from && l.date <= to);
  const lifts = [...new Set(S.vbt.filter(l => l.athleteId === a.id).map(l => l.exerciseId).concat(S.maxes.filter(m => m.athleteId === a.id).map(m => m.exerciseId)))].map(id => ({ ex: getExercise(id), orm: bestOneRM(a.id, id), sets: vbt.filter(l => l.exerciseId === id) })).filter(x => x.ex && (x.orm || x.sets.length));
  return { a, from, to, inP, metricRows, evs, done, noshow, sched, attend: done + noshow ? Math.round(done / (done + noshow) * 100) : null, wos, woDone, avgRpe: rpes.length ? mean(rpes) : null, vbt, lifts, fp: fpAnalyze(a) };
}
function metricLine(r, name) {
  const d = r.def, ch = r.pct;
  const verb = d.dir === -1 ? (ch < 0 ? 'improved' : 'slowed') : (ch > 0 ? 'improved' : 'dropped');
  return `${name}'s ${d.label.toLowerCase()} ${d.dir === 0 ? 'changed' : verb} from ${fmtMetric(d, r.start.v)} to ${fmtMetric(d, r.last.v)} (${ch > 0 ? '+' : ''}${fmtNum(ch, 1)}%)`;
}
function autoAssessment(D) {
  const name = D.a.firstName;
  const parts = [];
  if (D.sched) parts.push(`Over this period ${name} completed ${D.done} of ${D.sched} scheduled sessions${D.attend != null ? ` (${D.attend}% attendance)` : ''}.`);
  const good = D.metricRows.filter(r => r.cls === 'good' && r.pct != null).sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
  const bad = D.metricRows.filter(r => r.cls === 'bad' && r.pct != null);
  const pbs = D.metricRows.filter(r => r.pb);
  if (good.length) parts.push(good.slice(0, 3).map(r => metricLine(r, name)).join('; ') + ' — ' + (good.length > 1 ? 'all larger than normal test-to-test variation.' : 'larger than normal test-to-test variation.'));
  if (pbs.length) parts.push(`New personal bests: ${pbs.map(r => r.def.label).join(', ')}.`);
  const flat = D.metricRows.filter(r => r.cls === 'flat' && r.pct != null && r.def.dir !== 0);
  if (flat.length && !good.length) parts.push(`${name}'s results held steady (${flat.slice(0, 3).map(r => r.def.label).join(', ')}), within normal test-to-test variation.`);
  if (bad.length) parts.push(`${bad.slice(0, 2).map(r => r.def.label).join(' and ')} ${bad.length > 1 ? 'were' : 'was'} lower than the start of the period; we will keep an eye on ${bad.length > 1 ? 'these' : 'this'} and adjust training if the trend continues.`);
  if (!parts.length) parts.push(`${name} is building a baseline — more testing data will make trends visible in the next report.`);
  return parts.join(' ');
}
function autoNext(D) {
  // the athlete's training priorities first (today's readiness is left out: it isn't a focus for the period)
  const items = athPriorities(D.a).filter(p => p.key !== 'ready').slice(0, 3).map(p => `• ${p.focus}.`);
  if (items.length) return items.join('\n');
  athleteInsights(D.a).filter(i => i.level === 'warn' || i.level === 'alert' || i.level === 'info').slice(0, 3).forEach(i => items.push(`• ${i.action}`));
  D.fp.priorities.slice(0, 2).forEach(p => { if (!items.some(x => x.includes(p))) items.push('• ' + p); });
  return items.slice(0, 4).join('\n') || '• Continue the current program and retest weekly.';
}

ROUTES.reports = r => {
  const list = sortedAthletes();
  if (!list.length) return { title: 'Reports', body: `<div class="card">${emptyState_('file', 'No athletes yet', 'Add athletes and testing data to create progress reports.', '<a class="btn primary" href="#/athletes">Go to athletes</a>')}</div>` };
  if (r.q.athlete && getAthlete(r.q.athlete) && UI.rep?.athleteId !== r.q.athlete) UI.rep = repDefaults(r.q.athlete);
  if (!UI.rep || !getAthlete(UI.rep.athleteId)) UI.rep = repDefaults((activeAthletes()[0] || list[0]).id);
  const c = UI.rep;
  const D = repData(c);
  if (c.metrics == null) c.metrics = D.metricRows.filter(x => ['sprint10', 'sprint40yd', 'fly10', 'cmj', 'broad', 'djRsi', 'rsiMod', 'imtpPF', 'propImp', 'proAgility', 'sprint20'].includes(x.k)).slice(0, 6).map(x => x.k);
  if (!c.assessment) c.assessment = autoAssessment(D);
  if (!c.next) c.next = autoNext(D);
  const saved = (S.reports || []).slice().sort((x, y) => y.createdAt - x.createdAt);
  const body = `
    <div class="report-layout">
      <div class="col report-config">
        <div class="card">
          <div class="card-head"><h3>Report settings</h3></div>
          ${field('Athlete', sel('athleteId', list.map(a => [a.id, athleteName(a) + (a.archived ? ' (archived)' : '')]), c.athleteId, 'data-change="repAthlete"'))}
          ${field('Title', inp('title', c.title, 'data-input="repField" data-k="title"'))}
          ${field('Period', sel('period', [['7', 'Last 7 days'], ['30', 'Last 30 days'], ['60', 'Last 60 days'], ['90', 'Last 90 days'], ['180', 'Last 6 months'], ['365', 'Last 12 months'], ['all', 'All time (since their first test)'], ['custom', 'Custom dates']], c.period, 'data-change="repPeriod"'))}
          ${field('Show change from', sel('baseline', [['first', 'Their first test'], ['period', 'The start of this period']], c.baseline === 'period' ? 'period' : 'first', 'data-change="repBaseline"'), { hint: 'Each result is compared with the athlete’s first result for that test, or with their last result before the period.' })}
          ${c.period === 'custom' ? `<div class="fields">${field('From', `<input type="date" value="${c.from}" data-change="repDate" data-k="from">`)}${field('To', `<input type="date" value="${c.to}" data-change="repDate" data-k="to">`)}</div>` : ''}
          ${field('Prepared for', inp('recipient', c.recipient, 'placeholder="e.g. The Thompson family" data-input="repField" data-k="recipient"'))}
          <div class="field"><span class="field-label">Sections</span><div class="chips">${REPORT_SECTIONS.map(([k, l]) => `<button type="button" class="chip ${c.sections[k] ? 'on' : ''}" data-act="repSection" data-k="${k}">${esc(l)}</button>`).join('')}</div></div>
          ${c.sections.charts ? `<div class="field"><span class="field-label">Charts <span class="u">${c.metrics.length}/6</span></span><div class="chips">${D.metricRows.filter(x => x.series.length > 1).map(x => `<button type="button" class="chip ${c.metrics.includes(x.k) ? 'on' : ''}" data-act="repMetric" data-k="${x.k}">${esc(x.def.label)}</button>`).join('') || '<span class="muted small">Needs 2+ results for a metric.</span>'}</div></div>` : ''}
        </div>
        ${c.sections.assessment || c.sections.next ? `<div class="card">
          ${c.sections.assessment ? field('Coach’s assessment', `<textarea rows="6" data-input="repField" data-k="assessment">${esc(c.assessment)}</textarea>`) : ''}
          ${c.sections.next ? field('Focus for next period', `<textarea rows="5" data-input="repField" data-k="next">${esc(c.next)}</textarea>`) : ''}
          <div class="chips"><button class="btn sm" data-act="repRegen">${icon('activity', 'sm')}Regenerate from data</button>${aiReady() ? `<button class="btn sm" data-act="repAi">${icon('bulb', 'sm')}Write with AI</button>` : ''}</div>
        </div>` : ''}
        <div class="card"><div class="chips">
          <button class="btn primary" data-act="repPrint">${icon('download', 'sm')}Print / Save PDF</button>
          <button class="btn" data-act="repShare">${icon('upload', 'sm')}Share file</button>
          <button class="btn" data-act="repSave">${icon('check', 'sm')}${c.reportId ? 'Update saved' : 'Save'}</button>
          <button class="btn ghost" data-act="editBranding">Branding</button>
          <a class="btn ghost" href="#/teams">${icon('users', 'sm')}Team reports</a></div>
          <p class="faint small" style="margin:10px 0 0">On iPhone: Print opens the share sheet → <b>Save to Files</b> or AirDrop/Message the PDF. “Share file” sends a web page version that opens on any device.</p></div>
        ${saved.length ? `<div class="card"><div class="card-head"><h3>Saved reports</h3><span class="sub">${saved.length}</span></div><div class="list">${saved.slice(0, 20).map(s => `<div class="row"><span class="row-main"><button class="link" data-act="repOpen" data-id="${s.id}">${esc(athleteName(getAthlete(s.athleteId), true))} · ${esc(s.title)}</button><span class="row-sub">${esc(fmtDate(s.from))} – ${esc(fmtDate(s.to))} · saved ${esc(fmtDate(toDS(new Date(s.createdAt))))}</span></span><button class="btn icon sm ghost" data-act="repDelete" data-id="${s.id}" aria-label="Delete">${icon('trash', 'sm')}</button></div>`).join('')}</div></div>` : ''}
      </div>
      <div class="report-preview"><div id="reportPaper">${reportHtml(c, D)}</div></div>
    </div>`;
  return { title: 'Progress Reports', body, nav: 'reports' };
};
function repRedraw() { const el = $('#reportPaper'); if (el) el.innerHTML = reportHtml(UI.rep, repData(UI.rep)); }
A.repAthlete = el => { UI.rep = { ...repDefaults(el.value), period: UI.rep.period, from: UI.rep.from, to: UI.rep.to, title: UI.rep.title, sections: UI.rep.sections }; refresh(); };
A.repPeriod = el => { UI.rep.period = el.value; if (el.value === 'custom') { const r = repRange({ period: '30' }); UI.rep.from = r.from; UI.rep.to = r.to; } UI.rep.metrics = null; UI.rep.assessment = ''; UI.rep.next = ''; refresh(); };
A.repDate = el => { if (isDS(el.value)) { UI.rep[el.dataset.k] = el.value; UI.rep.metrics = null; UI.rep.assessment = ''; UI.rep.next = ''; refresh(); } };
A.repBaseline = el => {
  // redraft the text only if the coach hasn't edited it
  const c = UI.rep, D0 = repData(c), autoA = c.assessment === autoAssessment(D0);
  c.baseline = el.value === 'period' ? 'period' : 'first';
  if (autoA) c.assessment = '';
  refresh();
};
A.repField = debounce(el => { UI.rep[el.dataset.k] = el.value; repRedraw(); }, 250);
A.repSection = el => { const k = el.dataset.k; UI.rep.sections[k] = !UI.rep.sections[k]; refresh(); };
A.repMetric = el => {
  const m = UI.rep.metrics, k = el.dataset.k, i = m.indexOf(k);
  if (i >= 0) m.splice(i, 1); else if (m.length >= 6) return toast('Up to 6 charts'); else m.push(k);
  refresh();
};
A.repRegen = () => { const D = repData(UI.rep); UI.rep.assessment = autoAssessment(D); UI.rep.next = autoNext(D); refresh(); toast('Draft regenerated'); };
A.repSave = () => {
  const c = UI.rep, { from, to } = repRange(c);
  const rec = upsert('reports', { id: c.reportId || undefined, athleteId: c.athleteId, title: c.title, period: c.period, from, to, recipient: c.recipient, sections: { ...c.sections }, metrics: [...c.metrics], assessment: c.assessment, next: c.next, baseline: c.baseline === 'period' ? 'period' : 'first' });
  c.reportId = rec.id; toast('Report saved'); refresh();
};
A.repOpen = el => {
  const s = getRec('reports', el.dataset.id);
  if (!s || !getAthlete(s.athleteId)) return toast('That athlete no longer exists', 'err');
  UI.rep = { ...repDefaults(s.athleteId), ...JSON.parse(JSON.stringify(s)), period: 'custom', reportId: s.id, baseline: s.baseline === 'period' ? 'period' : 'first' };
  refresh(); window.scrollTo(0, 0);
};
A.repDelete = async el => { if (!(await confirmBox('Delete this saved report?'))) return; removeRec('reports', el.dataset.id); if (UI.rep.reportId === el.dataset.id) UI.rep.reportId = null; refresh(); };
A.repPrint = () => printReport(reportHtml(UI.rep, repData(UI.rep)));
/* Print only the report (athlete or team), not the app around it */
function printReport(html) {
  let root = $('#printRoot');
  if (!root) { root = document.createElement('div'); root.id = 'printRoot'; document.body.appendChild(root); }
  root.innerHTML = html;
  document.body.classList.add('print-report');
  const done = () => { document.body.classList.remove('print-report'); root.innerHTML = ''; window.removeEventListener('afterprint', done); };
  window.addEventListener('afterprint', done);
  setTimeout(() => { window.print(); setTimeout(() => { if (!window.matchMedia('print').matches) done(); }, 1500); }, 60);
};
A.repShare = () => {
  const c = UI.rep, D = repData(c);
  return shareReport(reportHtml(c, D), `${c.title} — ${athleteName(D.a)}`, `${athleteName(D.a).replace(/[^\w]+/g, '-')}-${c.title.replace(/[^\w]+/g, '-')}-${D.to}.html`);
};
/* A report as a self-contained web page (fonts included): share sheet on iPhone, download elsewhere */
async function shareReport(html, title, name) {
  const fonts = await fontFaceCss();
  const doc = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title)}</title><style>${fonts}${REPORT_CSS}body{margin:0;background:#e9e9ec;padding:16px}@media print{body{background:#fff;padding:0}}</style></head><body>${html}</body></html>`;
  const blob = new Blob([doc], { type: 'text/html' });
  try {
    const file = new File([blob], name, { type: 'text/html' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title }); return; }
  } catch (e) { if (e.name === 'AbortError') return; }
  downloadBlob(blob, name); toast('Report file downloaded');
}
A.repAi = async el => {
  const c = UI.rep, D = repData(c);
  const rows = D.metricRows.map(r => `${r.def.label}: ${c.baseline === 'period' ? 'start' : 'first test'} ${fmtMetric(r.def, r.start.v)} (${r.start.date}) → latest ${fmtMetric(r.def, r.last.v)} (${r.last.date}); change ${r.pct == null ? 'n/a' : fmtNum(r.pct, 1) + '%'}; ${r.cls === 'flat' ? 'within normal test noise' : r.cls === 'good' ? 'meaningful improvement' : 'meaningful decline'}${r.pb ? '; personal best' : ''}`).join('\n');
  const prompt = `Write two short sections for a monthly progress report that parents and the athlete will read. Use the placeholder {NAME} for the athlete's first name. Plain, warm, professional language; no jargon without a short explanation; no hype; be honest about declines. Base everything ONLY on the data below.
Return exactly:
ASSESSMENT:
<one paragraph, 4–6 sentences>
NEXT:
<3–4 bullet points starting with "• ", concrete training focus for next period>

Athlete: ${D.a.sport || 'athlete'}${D.a.position ? ', ' + D.a.position : ''}, age ${ageFrom(D.a.dob) ?? 'unknown'}. Goals: ${D.a.goals || '—'}.
Period: ${D.from} to ${D.to}. Sessions completed ${D.done} of ${D.sched}${D.attend != null ? ` (${D.attend}% attendance)` : ''}. Workouts completed ${D.woDone.length}${D.avgRpe != null ? `, average session RPE ${fmtNum(D.avgRpe, 1)}` : ''}.
Testing:
${rows || 'No tests in this period.'}
Force-plate notes: ${D.fp.sections.flatMap(s => s.items.map(i => i.title)).join('; ') || 'none'}.
High-school standards (coach's chart, ages 14–18): ${stdReportRows(D.a, D.to).map(r => `${r.s.test} ${r.s.label} ${stdVal(r)}: ${stdLvName(r)}${r.inAge ? '' : ' (reference only)'}`).join('; ') || 'none'}.
Trends across tests (judged against each test's typical error): ${athTrendLines(D.a).slice(0, 12).join('; ') || 'not enough repeat tests'}.
Coach's training priorities: ${athPriorities(D.a).filter(p => p.key !== 'ready').slice(0, 3).map(p => `${p.title} (${p.why})`).join('; ') || 'none'}.`;
  el.disabled = true; el.textContent = 'Writing…';
  try {
    let txt = '';
    await streamClaude(`You write clear, encouraging, accurate youth sports-performance progress reports for ${bizName()}. Coach's philosophy:\n${philosophyText()}`, [{ role: 'user', content: prompt }], t => { txt = t; });
    const m = txt.match(/ASSESSMENT:\s*([\s\S]*?)\s*NEXT:\s*([\s\S]*)/i);
    if (!m) throw new Error('Unexpected response format');
    const fill = s => s.trim().replace(/\{NAME\}/g, D.a.firstName);
    UI.rep.assessment = fill(m[1]); UI.rep.next = fill(m[2]);
    toast('Draft written — review before sending'); refresh();
  } catch (e) { toast('AI draft failed: ' + e.message, 'err'); el.disabled = false; el.textContent = 'Write with AI'; }
};

let fontCache = null;
const FONT_FILES = [['Bebas Neue', 'bebas-neue', '400'], ['DM Sans', 'dm-sans', '100 1000'], ['DM Serif Display', 'dm-serif-display', '400']];
function fontFaceUrls() { return FONT_FILES.map(([f, n, w]) => `@font-face{font-family:'${f}';src:url('fonts/${n}.woff2') format('woff2');font-weight:${w};font-display:swap}`).join(''); }
async function fontFaceCss() {
  const files = FONT_FILES;
  if (fontCache) return fontCache;
  const parts = await Promise.all(files.map(async ([f, n, w]) => {
    try {
      const b = await (await fetch(`fonts/${n}.woff2`)).blob();
      const d = await new Promise(r => { const fr = new FileReader(); fr.onload = () => r(fr.result); fr.readAsDataURL(b); });
      return `@font-face{font-family:'${f}';src:url('${d}') format('woff2');font-weight:${w}}`;
    } catch { return ''; }
  }));
  return (fontCache = parts.join(''));
}

function reportHtml(c, D) {
  const b = brand(), a = D.a, sec = c.sections;
  const age = ageFrom(a.dob);
  const fmtChange = r => r.pct == null ? '<span class="r-flat">—</span>' : `<span class="r-${r.cls}">${r.pct > 0 ? '▲' : '▼'} ${fmtNum(Math.abs(r.pct), 1)}%</span>`;
  const status = r => r.pb ? '<span class="r-pill pb">Personal best</span>' : r.pct == null ? '<span class="r-pill">Baseline</span>' : r.cls === 'good' ? '<span class="r-pill good">Improved</span>' : r.cls === 'bad' ? `<span class="r-pill bad">${c.baseline === 'period' ? 'Below start' : 'Below first test'}</span>` : '<span class="r-pill">Maintained</span>';
  const good = D.metricRows.filter(r => r.cls === 'good' && r.pct != null).sort((x, y) => Math.abs(y.pct) - Math.abs(x.pct));
  const top = good[0];
  const pbs = D.metricRows.filter(r => r.pb).length;
  const kpi = (v, l, s = '') => `<div class="r-kpi"><div class="r-kpi-v">${v}</div><div class="r-kpi-l">${l}</div>${s ? `<div class="r-kpi-s">${s}</div>` : ''}</div>`;
  const chartFor = k => {
    const r = D.metricRows.find(x => x.k === k);
    if (!r || r.series.length < 2) return '';
    const pts = r.series.map(p => ({ x: p.date, y: metricDisp(r.def, p.v) }));
    return `<div class="r-chart"><div class="r-chart-h"><span>${esc(r.def.label)}</span><b>${esc(fmtMetric(r.def, r.last.v))}</b></div>${drawLine({ points: pts, h: 120, color: b.accent }, 320)}<div class="r-chart-f">${fmtChange(r)} <span>since ${esc(fmtDate(r.start.date))}</span></div></div>`;
  };
  const fpL = D.fp.latest ? testMetrics(D.fp.latest) : null;
  const fpKeys = fpL ? ['cmj', 'takeoffVel', 'rsiMod', 'ttt', 'brakeRfd', 'propImp', 'cmjRelPP', 'imtpPF', 'imtpRel', 'dsi', 'brakeAsym', 'propAsym'].filter(k => fpL[k] != null) : [];
  const p = philosophy();
  const h = (t) => `<h3 class="r-h">${esc(t)}</h3>`;
  return `<article class="report" style="--bp:${esc(b.primary)};--ba:${esc(b.accent)}">
    <header class="r-head">
      <div class="r-brand">${brandMark(b, 'report')}</div>
      <div class="r-title"><div class="r-t1">${esc(c.title)}</div><div class="r-t2">${esc(fmtDateFull(D.from))} – ${esc(fmtDateFull(D.to))}</div></div>
    </header>
    <section class="r-athlete">
      <div><div class="r-name">${esc(athleteName(a))}</div><div class="r-meta">${esc([a.sport, a.position, a.team, age != null ? `Age ${age}` : ''].filter(Boolean).join(' · '))}</div></div>
      <div class="r-prep">${c.recipient ? `<div>Prepared for <b>${esc(c.recipient)}</b></div>` : ''}<div>Coach ${esc(S.settings.coachName || bizName())} · ${esc(fmtDateFull(today()))}</div></div>
    </section>
    ${sec.highlights ? `<section class="r-kpis">
      ${kpi(D.sched ? `${D.done}<small>/${D.sched}</small>` : D.done, 'Sessions completed', D.attend != null ? `${D.attend}% attendance` : '')}
      ${kpi(D.inP.length, 'Testing sessions', `${plural(D.metricRows.length, 'metric')} tracked`)}
      ${kpi(pbs, pbs === 1 ? 'Personal best' : 'Personal bests', 'this period')}
      ${kpi(top ? `${top.pct > 0 ? '+' : ''}${fmtNum(top.pct, 1)}%` : '—', top ? esc(top.def.label) : 'Top improvement', top ? (c.baseline === 'period' ? 'biggest meaningful gain' : 'biggest gain since first test') : 'needs 2+ tests')}
    </section>` : ''}
    ${sec.testing && D.metricRows.length ? `<section class="r-sec">${h('Performance testing')}
      <table class="r-table"><thead><tr><th>Test</th><th>${c.baseline === 'period' ? 'Start' : 'First'}</th><th>Latest</th><th>Change</th><th>Best</th><th></th></tr></thead><tbody>
      ${D.metricRows.map(r => `<tr><td>${esc(r.def.label)}</td><td>${esc(fmtMetric(r.def, r.start.v))}<div class="r-sub">${esc(fmtDate(r.start.date))}</div></td><td><b>${esc(fmtMetric(r.def, r.last.v))}</b><div class="r-sub">${esc(fmtDate(r.last.date))}</div></td><td>${fmtChange(r)}</td><td>${r.def.dir ? esc(fmtMetric(r.def, r.best)) : '—'}</td><td>${status(r)}</td></tr>`).join('')}
      </tbody></table><p class="r-note">Change is measured from ${c.baseline === 'period' ? 'the last result before this period' : 'each test’s first result'}. “Improved” and “${c.baseline === 'period' ? 'Below start' : 'Below first test'}” are shown only when the change is larger than the normal test-to-test variation for that test.</p></section>` : ''}
    ${sec.standards ? (h2 => h2 ? `<section class="r-sec">${h('Where they stand: high-school standards')}${h2}</section>` : '')(stdReportHtml(D.a, D.to)) : ''}
    ${sec.charts && c.metrics?.length ? `<section class="r-sec">${h('Progress over time')}<div class="r-charts">${c.metrics.map(chartFor).join('')}</div></section>` : ''}
    ${sec.forceplate && fpKeys.length ? `<section class="r-sec">${h('Force plate profile')}
      ${(() => { const pr = athleteProfileSummary(D.a.id); return pr ? `<p class="r-text" style="margin:0 0 10px"><b>Athlete profile: ${esc(pr.label)}</b> — DSI ${fmtNum(pr.dsi, 2)}, EUR ${fmtNum(pr.eur, 2)} (${esc(fmtDate(pr.date))}). ${esc(PROFILES[pr.primary].what)}</p>` : ''; })()}
      <div class="r-fp">${fpKeys.map(k => `<div><span>${esc(M[k].label)}</span><b>${esc(fmtMetric(M[k], fpL[k]))}</b></div>`).join('')}</div>
      ${D.fp.sections.length ? `<ul class="r-list">${D.fp.sections.flatMap(s => s.items).slice(0, 4).map(i => `<li><b>${esc(i.title)}.</b> ${esc(i.text.split('. ')[0])}.</li>`).join('')}</ul>` : ''}
      <p class="r-note">OVR Force plate · latest test ${esc(fmtDateFull(D.fp.latest.date))}.</p></section>` : ''}
    ${sec.strength && D.lifts.length ? `<section class="r-sec">${h('Strength & velocity-based training')}
      <table class="r-table"><thead><tr><th>Lift</th><th>1RM</th><th>Source</th><th>Sets logged</th><th>Fastest rep</th></tr></thead><tbody>
      ${D.lifts.map(x => `<tr><td>${esc(x.ex.name)}</td><td><b>${x.orm ? esc(fmtMass(x.orm.kg)) : '—'}</b></td><td>${x.orm ? (x.orm.source === 'tested' ? 'Tested' : 'Estimated from bar speed') : '—'}</td><td>${x.sets.length}</td><td>${x.sets.length ? fmtNum(Math.max(...x.sets.map(l => l.vBest)), 2) + ' m/s' : '—'}</td></tr>`).join('')}
      </tbody></table></section>` : ''}
    ${sec.attendance ? `<section class="r-sec">${h('Attendance & training')}<div class="r-att">
      <div><span>Sessions completed</span><b>${D.done}</b></div><div><span>Missed (no-show)</span><b>${D.noshow}</b></div>
      <div><span>Workouts completed</span><b>${D.woDone.length}</b></div><div><span>Avg. session effort (RPE)</span><b>${D.avgRpe != null ? fmtNum(D.avgRpe, 1) + '/10' : '—'}</b></div></div></section>` : ''}
    ${sec.assessment && c.assessment ? `<section class="r-sec">${h('Coach’s assessment')}<p class="r-text">${esc(c.assessment).replace(/\n/g, '<br>')}</p></section>` : ''}
    ${sec.next && c.next ? `<section class="r-sec">${h('Focus for the next period')}<p class="r-text">${esc(c.next).replace(/\n/g, '<br>')}</p></section>` : ''}
    ${sec.philosophy ? `<section class="r-sec r-phil">${h('Our philosophy')}<p class="r-mission">${esc(p.mission)}</p><div class="r-prin">${p.principles.slice(0, 6).map((x, i) => `<div><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(x.title)}</b></div>`).join('')}</div></section>` : ''}
    <footer class="r-foot"><div><b>${esc(bizName())}</b>${b.tagline ? ` · ${esc(b.tagline)}` : ''}</div><div>${esc([b.email, b.phone, b.website].filter(Boolean).join(' · '))}</div></footer>
  </article>`;
}

const REPORT_CSS = `
.report{--ink:#141414;--muted:#5f5f5f;--line:#e6e2d9;background:#fff;color:var(--ink);font:13px/1.5 'DM Sans',-apple-system,'Helvetica Neue',Arial,sans-serif;width:100%;max-width:816px;margin:0 auto;box-shadow:0 2px 24px rgba(0,0,0,.12);-webkit-print-color-adjust:exact;print-color-adjust:exact}
.report *{box-sizing:border-box}
.r-head{background:var(--bp);color:#fff;display:flex;align-items:center;justify-content:space-between;gap:20px;padding:26px 36px;border-bottom:4px solid var(--ba)}
.r-brand{min-width:0}
.r-title{text-align:right}
.r-t1{font:400 34px/1 'Bebas Neue',Impact,'Arial Narrow',sans-serif;letter-spacing:.04em;color:var(--ba)}
.r-t2{font-size:12px;color:#cfcfcf;margin-top:6px;letter-spacing:.04em;text-transform:uppercase}
.r-athlete{display:flex;justify-content:space-between;align-items:flex-end;gap:16px;padding:22px 36px 16px;border-bottom:1px solid var(--line);flex-wrap:wrap}
.r-name{font:400 30px/1.1 'DM Serif Display',Georgia,serif}
.r-meta{color:var(--muted);margin-top:4px}
.r-prep{text-align:right;color:var(--muted);font-size:12px}
.r-prep b{color:var(--ink)}
.r-kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;padding:18px 36px}
.r-kpi{border:1px solid var(--line);border-top:3px solid var(--ba);padding:10px 12px;border-radius:4px;break-inside:avoid}
.r-kpi-v{font:400 30px/1 'Bebas Neue',Impact,sans-serif;letter-spacing:.02em}
.r-kpi-v small{font-size:18px;color:var(--muted)}
.r-kpi-l{font-weight:600;font-size:12px;margin-top:4px}
.r-kpi-s{font-size:11px;color:var(--muted)}
.r-sec{padding:6px 36px 14px}
.r-h{break-after:avoid;page-break-after:avoid;font:400 20px/1 'Bebas Neue',Impact,sans-serif;letter-spacing:.06em;margin:10px 0 10px;display:flex;align-items:center;gap:10px;color:var(--ink)}
.r-h::after{content:'';flex:1;height:1px;background:var(--line)}
.r-table{width:100%;border-collapse:collapse;font-size:12.5px}
.r-table th{text-align:left;font-size:10.5px;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);border-bottom:2px solid var(--ink);padding:6px 8px}
.r-table td{padding:7px 8px;border-bottom:1px solid var(--line)}
.r-table tr{break-inside:avoid}
.r-good{color:#12804e;font-weight:700}.r-bad{color:#c0392b;font-weight:700}.r-flat{color:#8a8a8a;font-weight:600}
.r-pill{display:inline-block;font-size:10.5px;font-weight:700;padding:2px 8px;border-radius:99px;background:#f1efe9;color:#6b6b6b;white-space:nowrap}
.r-pill.good{background:#e5f5ec;color:#12804e}.r-pill.bad{background:#fbe9e7;color:#c0392b}.r-pill.pb{background:var(--ba);color:#111}
.r-pill.lv-poor,.r-pill.lv-below{background:#fbe9e7;color:#c0392b}.r-pill.lv-avg{background:#fdf0d9;color:#9a5b00}.r-pill.lv-good,.r-pill.lv-in{background:#e5f5ec;color:#12804e}.r-pill.lv-elite{background:var(--ba);color:#111}.r-pill.lv-above{background:#e6eefa;color:#1f5fa8}
.r-sub{font-size:10.5px;color:var(--muted)}.r-nw{white-space:nowrap}
.r-lvbar{display:inline-grid;grid-template-columns:repeat(4,16px);gap:3px;vertical-align:middle}.r-lvbar.three{grid-template-columns:repeat(3,16px)}
.r-lvbar i{display:block;height:8px;border-radius:2px;background:#ebe8e0}
.r-lvbar.lv-poor i.on,.r-lvbar.lv-below i.on{background:#c0392b}.r-lvbar.lv-avg i.on{background:#d98a00}.r-lvbar.lv-good i.on,.r-lvbar.lv-in i.on{background:#12804e}.r-lvbar.lv-elite i.on{background:var(--ba)}.r-lvbar.lv-above i.on{background:#1f5fa8}
.r-note{font-size:10.5px;color:var(--muted);margin:8px 0 0}
.r-charts{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.r-chart{border:1px solid var(--line);border-radius:4px;padding:10px 12px;break-inside:avoid}
.r-chart-h{display:flex;justify-content:space-between;font-size:12px;font-weight:600}
.r-chart-f{font-size:11px;color:var(--muted)}
.r-chart svg{width:100%;height:auto;display:block;margin:4px 0}
.r-chart svg text{fill:#8a8a8a;font-size:11px;font-family:'DM Sans',sans-serif}
.r-chart .grid-l{stroke:#ece9e1}
.r-chart .hit{fill:transparent}
.r-fp{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.r-fp div{break-inside:avoid;border:1px solid var(--line);border-radius:4px;padding:8px 10px}
.r-fp span{display:block;font-size:10.5px;color:var(--muted);text-transform:uppercase;letter-spacing:.04em}
.r-fp b{font-size:15px}
.r-list{margin:10px 0 0;padding-left:18px}.r-list li{margin-bottom:4px}
.r-att{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}
.r-att div{background:#f7f6f2;border-radius:4px;padding:10px 12px}
.r-att span{display:block;font-size:11px;color:var(--muted)}.r-att b{font:400 24px/1.1 'Bebas Neue',Impact,sans-serif}
.r-text{margin:0;font-size:13.5px;line-height:1.65}
.r-phil{break-inside:avoid;background:#faf8f3;border-top:1px solid var(--line);border-bottom:1px solid var(--line);margin-top:6px;padding-bottom:16px}
.r-mission{font:italic 400 17px/1.4 'DM Serif Display',Georgia,serif;margin:0 0 10px}
.r-prin{display:grid;grid-template-columns:repeat(3,1fr);gap:8px}
.r-prin div{font-size:12px}.r-prin span{color:var(--ba);font:400 18px 'Bebas Neue',sans-serif;margin-right:6px}
.r-foot{background:var(--bp);color:#d6d6d6;padding:14px 36px;font-size:11px;display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-top:10px;border-top:3px solid var(--ba)}
.r-foot b{color:#fff}
.wordmark{display:flex;flex-direction:column;line-height:1}
.wordmark .wm-top{font:400 26px/1 'Bebas Neue',Impact,sans-serif;letter-spacing:.06em;color:#fff;text-transform:uppercase}
.wordmark .wm-bottom{font:600 10px/1.4 'DM Sans',sans-serif;letter-spacing:.22em;color:var(--ba);text-transform:uppercase;margin-top:4px}
.wordmark.size-report .wm-top{font-size:30px}
.brand-logo{display:block;max-height:64px;max-width:240px;object-fit:contain}
.brand-logo.size-report{max-height:70px}
@media (max-width:640px){.r-std th:nth-child(4),.r-std td:nth-child(4){display:none}.r-table th,.r-table td{padding:6px 5px}.r-table .r-pill{white-space:normal;text-align:center}.r-head,.r-athlete,.r-sec,.r-kpis,.r-foot{padding-left:18px;padding-right:18px}.r-kpis,.r-att,.r-fp{grid-template-columns:repeat(2,1fr)}.r-charts{grid-template-columns:1fr}.r-prin{grid-template-columns:1fr 1fr}.r-t1{font-size:26px}.r-table{font-size:11.5px}.r-table th:nth-child(5),.r-table td:nth-child(5){display:none}}
/* team report */
.tr-ranks{display:grid;grid-template-columns:repeat(2,1fr);gap:12px}
.tr-card{border:1px solid var(--line);border-top:3px solid var(--ba);border-radius:4px;padding:10px 12px;break-inside:avoid}
.tr-card-h{display:flex;justify-content:space-between;align-items:baseline;gap:8px;margin-bottom:4px}
.tr-card-h b{font:400 19px/1 'Bebas Neue',Impact,sans-serif;letter-spacing:.04em}
.tr-card-h span{font-size:10.5px;color:var(--muted);text-align:right}
.tr-tab td{padding:5px 6px}
.tr-n{width:28px}
.tr-rk{display:inline-grid;place-items:center;width:20px;height:20px;border-radius:50%;background:#f1efe9;font-size:10.5px;font-weight:700}
.tr-rk.r1{background:var(--ba);color:#111}.tr-rk.r2{background:#d4d7dc;color:#111}.tr-rk.r3{background:#d9a77a;color:#111}
.tr-v,.tr-c{text-align:right;white-space:nowrap}.tr-c{font-size:11.5px}
.tr-card-f{font-size:11px;color:var(--muted);margin-top:6px}
.tr-scroll{overflow-x:auto}
.tr-all th,.tr-all td{text-align:right;white-space:nowrap}.tr-all th:first-child,.tr-all td:first-child{text-align:left}
.tr-all tr.tr-avg td{background:#f7f6f2;font-weight:700}
.tr-hl{display:grid;gap:8px}
.tr-hl>div{background:#f7f6f2;border-radius:4px;padding:10px 12px;break-inside:avoid}
.tr-hl h4{margin:0 0 6px;font-size:11px;text-transform:uppercase;letter-spacing:.06em}
.tr-hl ul{margin:0;padding-left:16px;font-size:12px;line-height:1.55}.tr-hl li{margin-bottom:3px}
@media (max-width:640px){.tr-ranks{grid-template-columns:1fr}.report .tr-keep th:nth-child(5),.report .tr-keep td:nth-child(5){display:table-cell}}
@media print{@page{size:letter;margin:0.35in}.report{box-shadow:none;max-width:none}.r-std th:nth-child(4),.r-std td:nth-child(4){display:table-cell!important}.tr-ranks{grid-template-columns:repeat(2,1fr)!important}.r-kpis,.r-att,.r-fp{grid-template-columns:repeat(4,1fr)!important}.r-charts{grid-template-columns:repeat(2,1fr)!important}.r-head,.r-athlete,.r-sec,.r-kpis,.r-foot{padding-left:28px!important;padding-right:28px!important}}
`;
