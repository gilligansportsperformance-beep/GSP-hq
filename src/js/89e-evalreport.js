/* =========================================================
   Evaluation report: one evaluation's results, each graded against the coach's
   high-school standards for the athlete's sex, with their age at the evaluation.
   Numbers and levels only: no AI text and no generated conclusions. The only
   words added are the coach's own (optional notes, movement-screen notes).
   ========================================================= */
const EVAL_REPORT = [
  ['Speed & agility', ['sprint10yd', 'fly10yd', 'proAgility', 'sprint10', 'sprint20yd', 'sprint40yd']],
  ['Countermovement jump', ['cmj', 'cmjRelPP', 'rsiMod', 'ttt', 'brakeRfd', 'cmjPF', 'cmjPP', 'cmDepth', 'takeoffVel', 'brakeTime', 'peakBrakeF', 'brakeImp', 'propTime', 'propImp', 'peakLandF']],
  ['Abalakov jump (arm swing)', ['vj', 'armSwing']],
  ['Squat jump', ['sj', 'eur']],
  ['Isometric mid-thigh pull', ['imtpPF', 'imtpRel', 'imtpF100Rel', 'imtpF200Rel', 'imtpF100', 'imtpF200', 'imtpImp', 'imtpRfd', 'imtpAvgF', 'imtpTtpf']],
  ['Single-leg IMTP', ['slImtpL', 'slImtpR', 'slImtpRel']],
  ['Drop jump', ['djRsi', 'djGct', 'djHeight', 'dropBox']],
  ['Drop landing', ['dlPlfRel', 'dlPlf', 'dlTts']],
];
/* Results never shown on this report (no longer part of the evaluation) */
const evalRepSkip = k => /asym/i.test(k) || /^calfIso/.test(k) || k === 'fly10yd10';

/* The rows of one evaluation: graded where the chart has a standard, plain otherwise */
function evalReportData(a, t) {
  const tm = testMetrics(t), age = ageAt(a.dob, t.date), sex = a.sex === 'M' || a.sex === 'F' ? a.sex : null;
  const pt = { iso: t.isoType, dev: t.device };
  const used = new Set();
  const row = k => {
    used.add(k);
    const v = tm[k], d = M[k];
    if (v == null || !Number.isFinite(v) || !d || evalRepSkip(k)) return null;
    const s = STD_BY[k];
    const r = s && stdPtOk(s, pt) ? stdEval(a, k, v, t.date, t.bodyMassKg) : null;
    return { k, d, v, r: r && !r.need ? r : null, need: r?.need || null };
  };
  const sections = EVAL_REPORT.map(([title, keys]) => ({ title, rows: keys.map(row).filter(Boolean) }));
  // anything else typed in this evaluation (metrics added with "+ Add metric")
  const other = Object.keys(t.m || {}).filter(k => !used.has(k) && M[k] && !M[k].calc).map(row).filter(Boolean);
  if (other.length) sections.push({ title: 'Other results', rows: other });
  const graded = sections.flatMap(x => x.rows).filter(x => stdGraded(x.r));
  const counts = STD_LV.map(([key, label], i) => ({ key, label, n: graded.filter(x => !x.r.target && x.r.lv === i).length }));
  return { a, t, tm, age, sex, inAge: age != null && age >= STD_AGES[0] && age <= STD_AGES[1], sections: sections.filter(x => x.rows.length), graded, counts, screen: screenTotal(t) };
}
const evalRepVal = x => (x.r ? stdVal(x.r) : `${fmtMetric(x.d, x.v)}`);
/* "Average 15–18 in · Good 19–22 in · Elite 23+ in" for the athlete's sex */
function evalRepBands(x, sex) {
  const s = x.r?.s;
  if (!s) return '';
  if (s.target) return `Target ${stdNum(s, s.lo)}–${stdNum(s, s.hi)}${stdUnit(s) ? ' ' + stdUnit(s) : ''}`;
  if (!sex) return '';
  return STD_LV.slice(1).map(([, l], i) => `${l} ${stdRange(s, s[sex][i + 1])}`).join(' · ');
}
function evalReportHtml(D) {
  const b = brand(), { a, t } = D;
  const sexWord = SEX_WORD[D.sex];
  const bar = r => { const lv = r.target ? TGT_LV : STD_LV; return `<span class="r-lvbar lv-${stdLvKey(r)}${r.target ? ' three' : ''}">${lv.map((_, i) => `<i class="${r.target ? (i === r.lv ? 'on' : '') : i <= r.lv ? 'on' : ''}"></i>`).join('')}</span>`; };
  const mark = s => (s?.prov ? '<sup>*</sup>' : s?.lowRel ? '<sup>†</sup>' : '');
  const level = x => x.r ? `<span class="r-pill lv-${stdLvKey(x.r)}${x.r.inAge && !x.r.s.prov && !x.r.s.lowRel ? '' : ' ref'}">${esc(stdLvName(x.r))}</span>`
    : x.need === 'sex' ? '<span class="r-sub">Needs sex on the profile</span>' : x.need === 'bm' ? '<span class="r-sub">Needs body mass</span>' : '<span class="r-sub">No standard</span>';
  const flags = D.sections.flatMap(x => x.rows).map(x => x.r?.s).filter(Boolean);
  const h = txt => `<h3 class="r-h">${esc(txt)}</h3>`;
  const ageLine = D.age == null ? 'Add a birth date to the profile to grade by age.'
    : D.inAge ? `Age ${D.age} at the evaluation: graded against the ${esc(bizName())} high-school standards for ${esc(sexWord || 'athletes')} aged 14–18.`
    : `Age ${D.age} at the evaluation. The ${esc(bizName())} high-school standards are for ages 14–18, so the levels are shown as a reference only.`;
  const screen = SCREEN.map(x => ({ x, r: t.screen?.[x.key] })).filter(o => o.r && (o.r.score || o.r.notes));
  return `<article class="report" style="--bp:${esc(b.primary)};--ba:${esc(b.accent)}">
    <header class="r-head">
      <div class="r-brand">${brandMark(b, 'report')}</div>
      <div class="r-title"><div class="r-t1">Evaluation Report</div><div class="r-t2">${esc(fmtDateFull(t.date))}</div></div>
    </header>
    <section class="r-athlete">
      <div><div class="r-name">${esc(athleteName(a))}</div><div class="r-meta">${esc([a.sport, a.position, a.team, D.age != null ? `Age ${D.age}` : '', { M: 'Male', F: 'Female' }[D.sex] || '', t.bodyMassKg ? `Body mass ${fmtMass(t.bodyMassKg)}` : ''].filter(Boolean).join(' · '))}</div></div>
      <div class="r-prep"><div>Coach ${esc(S.settings.coachName || bizName())}</div><div>${esc(fmtDateFull(t.date))}</div></div>
    </section>
    ${D.sex && D.graded.length ? `<section class="r-kpis">${D.counts.slice().reverse().map(c => `<div class="r-kpi"><div class="r-kpi-v">${c.n}</div><div class="r-kpi-l">${esc(c.label)}</div></div>`).join('')}</section>` : ''}
    <section class="r-sec"><p class="r-note" style="margin-top:0">${ageLine}${D.sex ? '' : ' Sex isn’t on the profile, so results aren’t graded yet.'}</p></section>
    ${D.sections.map(sec => `<section class="r-sec">${h(sec.title)}
      <table class="r-table r-std"><thead><tr><th>Test</th><th>Result</th><th>Level</th><th></th></tr></thead><tbody>
      ${sec.rows.map(x => `<tr><td>${esc(x.d.label)}${mark(x.r?.s)}${evalRepBands(x, D.sex) ? `<div class="r-sub">${esc(evalRepBands(x, D.sex))}${x.r && !x.r.target && x.r.s.dir === -1 ? ' · lower is better' : ''}</div>` : ''}</td>
        <td class="r-nw"><b>${esc(evalRepVal(x))}</b></td><td>${level(x)}</td><td>${x.r ? bar(x.r) : ''}</td></tr>`).join('')}
      </tbody></table></section>`).join('')}
    ${screen.length ? `<section class="r-sec">${h('Movement screen')}
      <table class="r-table"><thead><tr><th>Movement</th><th>Score</th><th>Notes</th></tr></thead><tbody>
      ${screen.map(({ x, r }) => `<tr><td>${esc(x.label)}</td><td class="r-nw"><b>${r.score ? `${r.score} / 5` : '—'}</b></td><td>${esc(r.notes || '')}</td></tr>`).join('')}
      </tbody></table>${D.screen ? `<p class="r-note">Total ${D.screen.total} / ${D.screen.max}. Each movement is scored 1–5 (1 = poor, 5 = excellent).</p>` : ''}</section>` : ''}
    ${t.reportNotes ? `<section class="r-sec">${h('Coach’s notes')}<p class="r-text">${esc(t.reportNotes).replace(/\n/g, '<br>')}</p></section>` : ''}
    <section class="r-sec"><p class="r-note">Levels: Poor, Average, Good, Elite, from the ${esc(bizName())} high-school standards (ages 14–18, ${esc(sexWord || 'boys and girls')}). A result reaches a level at the number where the chart starts it.${flags.some(s => s.prov) ? ' <sup>*</sup> Provisional standard: still being checked against published data.' : ''}${flags.some(s => s.lowRel) ? ' <sup>†</sup> Less reliable on portable force plates: best used to track change.' : ''} Timed tests keep the fastest trial; force-plate trials are averaged.</p></section>
    <footer class="r-foot"><div><b>${esc(bizName())}</b>${b.tagline ? ` · ${esc(b.tagline)}` : ''}</div><div>${esc([b.email, b.phone, b.website].filter(Boolean).join(' · '))}</div></footer>
  </article>`;
}

/* ---------------- The report page (#/evalreport/<testId>) ---------------- */
ROUTES.evalreport = r => {
  const t = getRec('tests', r.parts?.[0]), a = t && getAthlete(t.athleteId);
  if (!t || !a) return { title: 'Evaluation report', back: '#/athletes', nav: 'athletes', body: '<div class="card"><p class="muted">This evaluation was deleted.</p></div>' };
  const D = evalReportData(a, t);
  const warn = [!D.sex ? `Add ${esc(a.firstName)}’s sex to the profile to grade the results.` : '', D.age == null ? `Add ${esc(a.firstName)}’s birth date to grade by age.` : '',
    D.sections.some(x => x.rows.some(y => y.need === 'bm')) ? 'Add the body mass to this evaluation: your IMTP force is net, so grading it needs body weight.' : ''].filter(Boolean);
  const body = `
    ${warn.length ? `<div class="banner warn">${icon('alert')}<div class="grow small">${warn.join('<br>')} <button class="btn sm" data-act="editAthlete" data-id="${a.id}">Edit profile</button></div></div>` : ''}
    <div class="card er-tools">
      <div class="er-btns">
        <button class="btn primary" data-act="evalRepPrint" data-id="${t.id}">${icon('download', 'sm')}Print / PDF</button>
        <button class="btn" data-act="evalRepShare" data-id="${t.id}">${icon('upload', 'sm')}Share</button>
        <button class="btn" data-act="newEval" data-a="${a.id}" data-id="${t.id}">${icon('edit', 'sm')}Edit evaluation</button>
      </div>
      ${field('Coach’s notes (optional, printed on the report)', ta('reportNotes', t.reportNotes || '', 'rows="2" data-input="evalRepNotes" data-id="' + t.id + '" placeholder="Anything you want the athlete or parents to read. Leave empty for numbers only."'))}
    </div>
    <div class="report-preview" id="evalRepView">${evalReportHtml(D)}</div>`;
  return { title: 'Evaluation report', back: `#/athlete/${a.id}/evaluation`, nav: 'athletes', body };
};
let evalRepTimer = null;
A.evalRepNotes = el => {
  clearTimeout(evalRepTimer);
  evalRepTimer = setTimeout(() => {
    const t = getRec('tests', el.dataset.id);
    if (!t) return;
    const notes = el.value.trim().slice(0, 4000);
    if ((t.reportNotes || '') === notes) return;
    const saved = upsert('tests', { ...t, reportNotes: notes });
    const box = $('#evalRepView'), a = getAthlete(saved.athleteId);
    if (box && a) box.innerHTML = evalReportHtml(evalReportData(a, saved));
  }, 400);
};
const evalRepDoc = id => { const t = getRec('tests', id), a = t && getAthlete(t.athleteId); return t && a ? { t, a, html: evalReportHtml(evalReportData(a, t)) } : null; };
A.evalRepPrint = el => { const d = evalRepDoc(el.dataset.id); if (d) printReport(d.html); };
A.evalRepShare = el => {
  const d = evalRepDoc(el.dataset.id);
  if (d) return shareReport(d.html, `Evaluation — ${athleteName(d.a)}`, `${athleteName(d.a).replace(/[^\w]+/g, '-')}-Evaluation-${d.t.date}.html`);
};
