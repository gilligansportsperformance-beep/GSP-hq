/* =========================================================
   Team report: a branded, printable report of one team test day
   (same look as the athlete progress reports). Settings and notes are
   saved on the test day (teamtests.report) so they sync between devices.
   ========================================================= */
const TR_SECTIONS = [['kpis', 'Key numbers'], ['summary', 'Summary'], ['averages', 'Team averages'], ['rankings', 'Rankings'], ['highlights', 'PBs & changes'], ['table', 'All results'], ['notes', 'Coach’s notes'], ['philosophy', 'Philosophy']];
function trConfig(s) {
  const d = { title: 'Team Testing Report', recipient: '', names: 'full', top: 'all', summary: '', notes: '', sections: { kpis: true, summary: true, averages: true, rankings: true, highlights: true, table: true, notes: true, philosophy: false } };
  const r = s.report || {};
  return { ...d, ...r, sections: { ...d.sections, ...(r.sections || {}) } };
}
const trName = c => a => (c.names === 'short' ? athleteName(a, true) : athleteName(a));
function trData(s) {
  const roster = ttRoster(s), abs = new Set(s.absentIds || []);
  const recs = new Map(ttRecs(s).map(t => [t.athleteId, t]));
  const per = ttKeys(s).map(k => ttRanked(s, roster, k)).filter(x => x.rows.length);
  const flat = per.flatMap(x => x.rows.map(r => ({ ...r, k: x.k, d: x.d })));
  return {
    s, team: ttTeam(s.teamId), roster, per,
    tested: roster.filter(a => recs.has(a.id)), absent: roster.filter(a => abs.has(a.id)), notTested: roster.filter(a => !abs.has(a.id) && !recs.has(a.id)),
    here: roster.filter(a => !abs.has(a.id)).length,
    pbs: flat.filter(r => r.pb), up: flat.filter(r => r.cls === 'good' && !r.pb), down: flat.filter(r => r.cls === 'bad'),
  };
}
/* Team change words follow the test's typical error, the same rule as everywhere else */
function trChangeWord(x) {
  const c = changeClass(x.d, x.team.pct), p = fmtNum(Math.abs(x.team.pct), 1);
  return c === 'good' ? `improved ${p}%` : c === 'bad' ? `dropped ${p}%` : 'held steady';
}
function trAutoSummary(D, nm) {
  const miss = [D.absent.length ? `${D.absent.length} absent` : '', D.notTested.length ? `${D.notTested.length} not tested` : ''].filter(Boolean).join(', ');
  const out = [`${D.tested.length} of ${D.roster.length} athletes were tested on ${fmtDateFull(D.s.date)}${miss ? ` (${miss})` : ''}.`];
  const ch = D.per.filter(x => x.team);
  if (ch.length) {
    const dates = [...new Set(ch.map(x => x.team.prev.date))];
    out.push(dates.length === 1
      ? `Compared with the last test day (${fmtDate(dates[0])}), using only athletes tested both times: ${ch.map(x => `${ttLabel(x.k)} ${trChangeWord(x)}`).join(', ')}.`
      : `Compared with the last time each test was done (same athletes only): ${ch.map(x => `${ttLabel(x.k)} ${trChangeWord(x)} since ${fmtDate(x.team.prev.date)}`).join(', ')}.`);
    if (ch.length < D.per.length) out.push(`${D.per.filter(x => !x.team).map(x => ttLabel(x.k)).join(', ')} ${D.per.length - ch.length === 1 ? 'was' : 'were'} tested for the first time.`);
  } else out.push('This is the team’s first test day with these tests, so these results are the baseline for future testing.');
  const pbAth = new Set(D.pbs.map(r => r.a.id)).size;
  if (D.pbs.length) out.push(`${pbAth} athlete${pbAth === 1 ? '' : 's'} set ${D.pbs.length === 1 ? 'a personal best' : `${D.pbs.length} personal bests`}.`);
  const lead = D.per.filter(x => x.d.dir).map(x => `${ttLabel(x.k)}: ${nm(x.rows[0].a)} (${fmtMetric(x.d, x.rows[0].v)})`);
  if (lead.length) out.push(`Top results: ${lead.join('; ')}.`);
  return out.join(' ');
}
function teamReportHtml(c, D) {
  const b = brand(), s = D.s, sec = c.sections, nm = trName(c), team = D.team;
  const h = t => `<h3 class="r-h">${esc(t)}</h3>`;
  const chg = (d, pct) => (pct == null ? '<span class="r-flat">—</span>' : `<span class="r-${changeClass(d, pct)}">${pct > 0 ? '▲' : '▼'} ${fmtNum(Math.abs(pct), 1)}%</span>`);
  const val = (d, v) => esc(fmtMetric(d, v));
  const kpi = (v, l, sub = '') => `<div class="r-kpi"><div class="r-kpi-v">${v}</div><div class="r-kpi-l">${l}</div>${sub ? `<div class="r-kpi-s">${sub}</div>` : ''}</div>`;
  const lim = c.top === 'all' ? Infinity : +c.top;
  const best = D.per.filter(x => x.team && changeClass(x.d, x.team.pct) === 'good').sort((x, y) => Math.abs(y.team.pct) - Math.abs(x.team.pct))[0];
  const summary = c.summary || trAutoSummary(D, nm);
  const rankCard = x => {
    const rows = x.rows.slice(0, lim);
    return `<div class="tr-card"><div class="tr-card-h"><b>${esc(ttLabel(x.k))}</b><span>${esc(ttUnitLabel(s, x.k).replace('s or mph · ', 's · '))}</span></div>
      <table class="r-table tr-tab tr-keep"><tbody>${rows.map(r => `<tr><td class="tr-n">${x.d.dir ? `<span class="tr-rk r${r.rank}">${r.rank}</span>` : ''}</td><td>${esc(nm(r.a))}${r.pb ? ' <span class="r-pill pb">PB</span>' : ''}</td><td class="tr-v"><b>${val(x.d, r.v)}</b></td><td class="tr-c">${r.h ? chg(x.d, r.pct) : '<span class="r-flat">first</span>'}</td></tr>`).join('')}</tbody></table>
      <div class="tr-card-f">Team average <b>${val(x.d, x.avg)}</b>${x.rows.length > rows.length ? ` · top ${rows.length} of ${x.rows.length} shown` : ''}</div></div>`;
  };
  // grouped by test so a big team stays readable: "0–10 yd (11): Nora O., Mia N., …"
  const hl = (t, rows, cls, withChange) => (rows.length ? `<div><h4 class="${cls}">${esc(t)} <span class="r-flat">(${rows.length})</span></h4><ul>${D.per.map(x => {
    const rr = rows.filter(r => r.k === x.k);
    return rr.length ? `<li><b>${esc(ttLabel(x.k))}</b> (${rr.length}): ${rr.map(r => `${esc(nm(r.a))}${withChange ? ` ${chg(x.d, r.pct)}` : ''}`).join(', ')}</li>` : '';
  }).join('')}</ul></div>` : '');
  const p = philosophy();
  return `<article class="report team-report" style="--bp:${esc(b.primary)};--ba:${esc(b.accent)}">
    <header class="r-head"><div class="r-brand">${brandMark(b, 'report')}</div><div class="r-title"><div class="r-t1">${esc(c.title)}</div><div class="r-t2">${esc(fmtDateFull(s.date))}</div></div></header>
    <section class="r-athlete">
      <div><div class="r-name">${esc(team?.name || ttTitle(s))}</div><div class="r-meta">${esc([team?.sport, team && s.name ? s.name : '', plural(D.roster.length, 'athlete'), ttKeys(s).map(ttLabel).join(' · ')].filter(Boolean).join(' · '))}</div></div>
      <div class="r-prep">${c.recipient ? `<div>Prepared for <b>${esc(c.recipient)}</b></div>` : ''}<div>Coach ${esc(S.settings.coachName || bizName())} · ${esc(fmtDateFull(today()))}</div></div>
    </section>
    ${sec.kpis ? `<section class="r-kpis">
      ${kpi(`${D.tested.length}<small>/${D.roster.length}</small>`, 'Athletes tested', [D.absent.length ? `${D.absent.length} absent` : '', D.notTested.length ? `${D.notTested.length} not tested` : ''].filter(Boolean).join(' · ') || 'everyone tested')}
      ${kpi(D.per.length, D.per.length === 1 ? 'Test' : 'Tests', esc(D.per.map(x => ttLabel(x.k)).slice(0, 3).join(', ') + (D.per.length > 3 ? '…' : '')))}
      ${kpi(D.pbs.length, D.pbs.length === 1 ? 'Personal best' : 'Personal bests', D.pbs.length ? `by ${plural(new Set(D.pbs.map(r => r.a.id)).size, 'athlete')}` : 'on this test day')}
      ${kpi(best ? `${fmtNum(Math.abs(best.team.pct), 1)}%` : '—', best ? `${esc(ttLabel(best.k))} improved` : 'Team improvement', best ? `team average since ${esc(fmtDate(best.team.prev.date))}` : D.per.some(x => x.team) ? 'no change beyond test noise' : 'baseline test day')}
    </section>` : ''}
    ${sec.summary && summary ? `<section class="r-sec">${h('Summary')}<p class="r-text">${esc(summary).replace(/\n/g, '<br>')}</p></section>` : ''}
    ${sec.averages && D.per.length ? `<section class="r-sec">${h('Team averages')}
      <table class="r-table tr-keep"><thead><tr><th>Test</th><th>Athletes</th><th>Team average</th><th>Best result</th><th>Since last test day</th></tr></thead><tbody>
      ${D.per.map(x => `<tr><td>${esc(ttLabel(x.k))}</td><td>${x.rows.length}</td><td><b>${val(x.d, x.avg)}</b>${x.sd != null ? ` <span class="r-flat">± ${esc(fmtNum(metricDisp(x.d, x.sd), x.d.kind === 'len' ? 1 : x.d.dec))}</span>` : ''}</td><td>${x.d.dir ? `${val(x.d, x.rows[0].v)} <span class="r-flat">${esc(nm(x.rows[0].a))}</span>` : '—'}</td><td>${x.team ? `${chg(x.d, x.team.pct)} <span class="r-flat">${esc(fmtDate(x.team.prev.date))}, ${x.team.n} athletes</span>` : '<span class="r-flat">first test</span>'}</td></tr>`).join('')}
      </tbody></table><p class="r-note">Change since last test day = the average of each athlete’s own change, using only athletes tested both times. Changes are coloured only when they are bigger than the test’s normal day-to-day variation.</p></section>` : ''}
    ${sec.rankings && D.per.length ? `<section class="r-sec">${h('Rankings')}<div class="tr-ranks">${D.per.map(rankCard).join('')}</div></section>` : ''}
    ${sec.highlights && (D.pbs.length || D.up.length || D.down.length) ? `<section class="r-sec">${h('Personal bests & changes')}<div class="tr-hl">${hl('New personal bests', D.pbs, '', false)}${hl('Better than last time', D.up, 'r-good', true)}${hl('Down from last time', D.down, 'r-bad', true)}</div>
      <p class="r-note">“Better” and “Down” compare each athlete with their own last result and count only changes bigger than normal test variation.</p></section>` : ''}
    ${sec.table && D.per.length ? `<section class="r-sec">${h('All results')}<div class="tr-scroll"><table class="r-table tr-all tr-keep"><thead><tr><th>Athlete</th>${D.per.map(x => `<th>${esc(ttLabel(x.k))}${metricUnit(x.d) ? ` (${esc(metricUnit(x.d))})` : ''}</th>`).join('')}</tr></thead><tbody>
      ${D.tested.map(a => `<tr><td>${esc(nm(a))}</td>${D.per.map(x => { const r = x.rows.find(y => y.a.id === a.id); return `<td>${r ? `${esc(fmtNum(metricDisp(x.d, r.v), x.d.kind === 'len' ? 1 : x.d.dec))}${r.pb ? ' ★' : ''}` : '–'}</td>`; }).join('')}</tr>`).join('')}
      <tr class="tr-avg"><td>Team average</td>${D.per.map(x => `<td>${esc(fmtNum(metricDisp(x.d, x.avg), x.d.kind === 'len' ? 1 : x.d.dec))}</td>`).join('')}</tr>
      </tbody></table></div>
      <p class="r-note">★ personal best.${D.absent.length ? ` Absent: ${esc(D.absent.map(nm).join(', '))}.` : ''}${D.notTested.length ? ` Not tested: ${esc(D.notTested.map(nm).join(', '))}.` : ''}</p></section>` : ''}
    ${sec.notes && c.notes.trim() ? `<section class="r-sec">${h('Coach’s notes')}<p class="r-text">${esc(c.notes).replace(/\n/g, '<br>')}</p></section>` : ''}
    ${sec.philosophy ? `<section class="r-sec r-phil">${h('Our philosophy')}<p class="r-mission">${esc(p.mission)}</p><div class="r-prin">${p.principles.slice(0, 6).map((x, i) => `<div><span>${String(i + 1).padStart(2, '0')}</span><b>${esc(x.title)}</b></div>`).join('')}</div></section>` : ''}
    <footer class="r-foot"><div><b>${esc(bizName())}</b>${b.tagline ? ` · ${esc(b.tagline)}` : ''}</div><div>${esc([b.email, b.phone, b.website].filter(Boolean).join(' · '))}</div></footer>
  </article>`;
}

/* ---------- Report page ---------- */
const TR_PENDING = {};
function trSaveNow(sid) {
  const s = getRec('teamtests', sid), pend = TR_PENDING[sid];
  delete TR_PENDING[sid];
  if (!s || !pend) return;
  const c = trConfig(s);
  const next = { ...c, ...pend };
  // a summary left exactly as written from the results stays automatic (it updates if results change)
  if (pend.summary != null && pend.summary.trim() === trAutoSummary(trData(s), trName(next)).trim()) next.summary = '';
  upsert('teamtests', { ...s, report: next });
  const paper = $('#reportPaper');
  if (paper) paper.innerHTML = teamReportHtml(next, trData(getRec('teamtests', sid)));
}
const trSaveSoon = debounce(trSaveNow, 300);
function trUpdate(sid, patch) { TR_PENDING[sid] = { ...(TR_PENDING[sid] || {}), ...patch }; }
ROUTES.teamreport = r => {
  const s = getRec('teamtests', r.parts[0]);
  if (!s) return { title: 'Team Report', nav: 'teams', back: '#/teams', body: `<div class="card">${emptyState_('file', 'Test day not found', 'It may have been deleted on another device.', '<a class="btn primary" href="#/teams">Back to Team Testing</a>')}</div>` };
  const c = trConfig(s), D = trData(s);
  const auto = !c.summary;
  const body = `
    <div class="report-layout">
      <div class="col report-config">
        <div class="card"><div class="card-head"><h3>Report settings</h3></div>
          ${field('Title', inp('title', c.title, `data-input="trField" data-k="title" data-s="${s.id}"`))}
          ${field('Prepared for', inp('recipient', c.recipient, `placeholder="e.g. Coach Smith, HC Girls Soccer" data-input="trField" data-k="recipient" data-s="${s.id}"`))}
          <div class="fields">${field('Names', sel('names', [['full', 'Full names'], ['short', 'First name + initial']], c.names, `data-change="trSet" data-k="names" data-s="${s.id}"`))}${field('Rankings', sel('top', [['all', 'Everyone'], ['10', 'Top 10'], ['5', 'Top 5']], c.top, `data-change="trSet" data-k="top" data-s="${s.id}"`))}</div>
          <div class="field"><span class="field-label">Sections</span><div class="chips">${TR_SECTIONS.map(([k, l]) => `<button type="button" class="chip ${c.sections[k] ? 'on' : ''}" data-act="trSection" data-k="${k}" data-s="${s.id}">${esc(l)}</button>`).join('')}</div></div>
        </div>
        <div class="card">
          ${field('Summary', `<textarea rows="7" data-input="trField" data-k="summary" data-s="${s.id}">${esc(c.summary || trAutoSummary(D, trName(c)))}</textarea>`, { hint: auto ? 'Written from the results and kept up to date. Edit it as you like.' : 'Edited by you.' })}
          ${auto ? '' : `<div class="chips" style="margin:-4px 0 12px"><button class="btn sm" data-act="trRegen" data-s="${s.id}">${icon('activity', 'sm')}Rewrite from the results</button></div>`}
          ${field('Coach’s notes', `<textarea rows="5" data-input="trField" data-k="notes" data-s="${s.id}" placeholder="e.g. What the team will focus on before the next test day">${esc(c.notes)}</textarea>`)}
        </div>
        <div class="card"><div class="chips">
          <button class="btn primary" data-act="trPrint" data-s="${s.id}">${icon('download', 'sm')}Print / Save PDF</button>
          <button class="btn" data-act="trShare" data-s="${s.id}">${icon('upload', 'sm')}Share file</button>
          <button class="btn ghost" data-act="editBranding">Branding</button></div>
          <p class="faint small" style="margin:10px 0 0">On iPhone: Print opens the share sheet → <b>Save to Files</b>, or AirDrop / Message the PDF. “Share file” sends a web page version that opens on any device. Your settings and notes are saved with this test day.</p></div>
      </div>
      <div class="report-preview"><div id="reportPaper">${teamReportHtml(c, D)}</div></div>
    </div>`;
  return {
    title: 'Team Report', nav: 'teams', back: `#/teamtest/${s.id}?v=results`, body,
    actions: `<button class="btn primary" data-act="trPrint" data-s="${s.id}">${icon('download', 'sm')}<span class="lbl">Print / PDF</span></button>`,
    mount() { UI.leave = () => trSaveNow(s.id); },
  };
};
A.trField = el => {
  const k = el.dataset.k;
  if (!['title', 'recipient', 'summary', 'notes'].includes(k)) return;
  trUpdate(el.dataset.s, { [k]: el.value.slice(0, k === 'title' ? 120 : k === 'recipient' ? 200 : 4000) });
  trSaveSoon(el.dataset.s);
};
A.trSet = el => { trUpdate(el.dataset.s, { [el.dataset.k]: el.value }); trSaveNow(el.dataset.s); refresh(); };
A.trSection = el => {
  const s = getRec('teamtests', el.dataset.s);
  if (!s) return;
  const cur = { ...trConfig(s).sections, ...(TR_PENDING[s.id]?.sections || {}) };
  trUpdate(s.id, { sections: { ...cur, [el.dataset.k]: !cur[el.dataset.k] } });
  trSaveNow(s.id); refresh();
};
A.trRegen = el => { trUpdate(el.dataset.s, { summary: '' }); trSaveNow(el.dataset.s); refresh(); toast('Summary rewritten from the results'); };
function trCurrent(sid) {
  trSaveNow(sid);
  const s = getRec('teamtests', sid);
  return s ? { s, c: trConfig(s), D: trData(s) } : null;
}
A.trPrint = el => { const x = trCurrent(el.dataset.s); if (x) printReport(teamReportHtml(x.c, x.D)); };
A.trShare = el => {
  const x = trCurrent(el.dataset.s);
  if (!x) return;
  const name = `${(x.D.team?.name || ttTitle(x.s)).replace(/[^\w]+/g, '-')}-team-report-${x.s.date}.html`;
  shareReport(teamReportHtml(x.c, x.D), `${x.c.title} — ${x.D.team?.name || ttTitle(x.s)}`, name);
};
