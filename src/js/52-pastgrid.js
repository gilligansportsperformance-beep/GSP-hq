/* =========================================================
   Past results: a whole testing history for one athlete in one table, one row per test day and one
   column per test. Type or paste a block from a spreadsheet, Enter moves down, save once.
   Days already in the app show their values and can be corrected here; tests logged in a session
   are shown but changed in the session log.
   ========================================================= */
const PG_PRESETS = [
  ['OVR Force · CMJ', ['cmj', 'rsiMod', 'ttt', 'cmjPF', 'cmjPP', 'brakeRfd'], 'OVR Force'],
  ['OVR Force · IMTP', ['imtpPF', 'imtpF100', 'imtpF200'], 'OVR Force'],
  ['OVR Jump', ['cmj', 'vj', 'djRsi', 'djGct'], 'OVR Jump'],
  ['Sprints', ['sprint10yd', 'sprint20yd', 'sprint40yd', 'fly10yd', 'fly10yd10', 'proAgility'], null],
  ['Combine', ['sprint40yd', 'proAgility', 'vj', 'broad'], null],
];
const pgOk = k => !!(M[k] && !M[k].calc);
/* Start with the tests this athlete has done most, else the last columns used */
function pgDefaultKeys(aid) {
  const n = {};
  testsFor(aid).forEach(t => Object.keys(t.m || {}).forEach(k => { if (pgOk(k)) n[k] = (n[k] || 0) + 1; }));
  const top = Object.keys(n).sort((a, b) => n[b] - n[a]).slice(0, 5);
  const last = (S.settings.pastKeys || []).filter(pgOk);
  return top.length ? top : last.length ? last : PG_PRESETS[0][1];
}
const pgBmTxt = kg => (kg > 0 ? inVal(U.massOut(kg), 1) : '');
function pgRowFrom(t, keys) {
  const r = { id: t.id, date: ttDobOut(t.date), date0: ttDobOut(t.date), vals: {}, orig: {}, bm: pgBmTxt(t.bodyMassKg), bm0: pgBmTxt(t.bodyMassKg), ro: !!t.workoutId, dev: t.device || '',
    note: t.workoutId ? 'From a session log' : t.teamTestId ? 'Team test' : t.evaluation ? 'Evaluation' : '' };
  keys.forEach(k => { r.vals[k] = r.orig[k] = t.m?.[k] != null ? ttDisp(k, t.m[k]) : ''; });
  return r;
}
const pgBlank = () => ({ id: null, date: '', vals: {}, orig: {}, bm: '', bm0: '', ro: false, dev: '', note: '' });
const pgEmpty = r => !r.id && !r.date.trim() && !r.bm.trim() && !Object.values(r.vals).some(v => String(v).trim());
/* Always a couple of empty rows at the bottom to type into */
function pgPad(st, n = 2) { let k = 0; for (let i = st.rows.length - 1; i >= 0 && pgEmpty(st.rows[i]); i--) k++; for (; k < n; k++) st.rows.push(pgBlank()); }
/* Rows: every saved test with one of the chosen tests (oldest first), then the new rows */
function pgSync(st) {
  const have = new Map(st.rows.filter(r => r.id).map(r => [r.id, r]));
  const saved = testsFor(st.aid).filter(t => st.keys.some(k => t.m?.[k] != null) || have.has(t.id)).map(t => {
    const r = have.get(t.id);
    if (!r) return pgRowFrom(t, st.keys);
    st.keys.forEach(k => { if (!(k in r.orig)) r.vals[k] = r.orig[k] = t.m?.[k] != null ? ttDisp(k, t.m[k]) : ''; });
    return r;
  });
  const fresh = st.rows.filter(r => !r.id);
  while (fresh.filter(r => !r.date.trim() && !Object.values(r.vals).some(v => String(v).trim())).length < 3) fresh.push(pgBlank());
  st.rows = [...saved, ...fresh];
}
function pgCols(st) { return ['date', ...st.keys, ...(st.bmOn ? ['bm'] : [])]; }
function pgTableHtml(st) {
  const cols = pgCols(st);
  const head = cols.map(c => c === 'date' ? '<th class="pg-d">Date</th>' : c === 'bm' ? `<th>Body mass <span class="u">${esc(U.mass())}</span></th>`
    : `<th>${esc(M[c].label)}${metricUnit(M[c]) ? ` <span class="u">${esc(metricUnit(M[c]))}</span>` : ''}<button type="button" class="link pg-x" data-rmk="${c}" aria-label="Remove ${esc(M[c].label)} column">×</button></th>`).join('');
  const cell = (r, i, c, j) => {
    const v = c === 'date' ? r.date : c === 'bm' ? r.bm : (r.vals[c] ?? '');
    const ph = c === 'date' ? 'MM/DD/YYYY' : '';
    return `<td class="${c === 'date' ? 'pg-d' : ''}"><input type="text" ${c === 'date' ? 'inputmode="numeric" data-dob maxlength="10"' : 'inputmode="decimal"'} data-r="${i}" data-c="${j}" value="${esc(v)}" placeholder="${ph}" aria-label="${esc(c === 'date' ? 'Date' : c === 'bm' ? 'Body mass' : M[c].label)}, row ${i + 1}" ${r.ro ? 'disabled' : ''}>${c === 'date' && (r.note || r.dev) ? `<span class="pg-note">${esc([r.dev, r.note].filter(Boolean).join(' · '))}</span>` : ''}</td>`;
  };
  return `<div class="table-wrap pg-wrap"><table class="t pg-table"><thead><tr>${head}</tr></thead><tbody>
    ${st.rows.map((r, i) => `<tr class="${r.id ? 'saved' : ''}${r.ro ? ' ro' : ''}">${cols.map((c, j) => cell(r, i, c, j)).join('')}</tr>`).join('')}
    </tbody></table></div>`;
}
function pgPickerHtml(st) {
  const opts = metricSections(m => !m.calc && !st.keys.includes(m.key)).filter(x => !['derived', 'body'].includes(x.cat.key)).flatMap(({ cat, subs }) => subs.map(g => ({ group: g.sub ? `${cat.label} · ${g.sub}` : cat.label, options: g.defs.map(m => [m.key, m.label]) })));
  return `<div class="pg-bar">
    ${sel('pgAdd', [['', '+ Add a test'], ...opts], '', 'data-pgadd aria-label="Add a test (column)"')}
    ${sel('pgPreset', [['', 'Quick pick…'], ...PG_PRESETS.map(([l], i) => [String(i), l])], '', 'data-pgp aria-label="Quick pick of tests"')}
    ${sel('pgDev', [['', 'Measured with: force plate / other'], ['OVR Force', 'Measured with: OVR Force'], ['OVR Jump', 'Measured with: OVR Jump'], ['OVR Sprint', 'Measured with: OVR Sprint']], st.dev, 'data-pgdev aria-label="Measured with (new rows)"')}
  </div>`;
}
A.pastResults = el => {
  const a = getAthlete(el.dataset.a);
  if (!a) return;
  const st = { aid: a.id, keys: pgDefaultKeys(a.id), dev: '', bmOn: testsFor(a.id).some(t => t.bodyMassKg), rows: [] };
  pgSync(st);
  const read = root => $$('input[data-r]', root).forEach(inp => {
    const r = st.rows[+inp.dataset.r], c = pgCols(st)[+inp.dataset.c];
    if (!r || r.ro) return;
    if (c === 'date') r.date = inp.value; else if (c === 'bm') r.bm = inp.value; else r.vals[c] = inp.value;
  });
  const m = openModal({
    title: `Past results — ${athleteName(a, true)}`, size: 'wide', submit: 'Save',
    body: `<p class="muted small" style="margin-top:0">One row per test day: type the results, or paste a block from a spreadsheet (dates first). <b>Enter</b> moves down. Saved days show and can be corrected.</p>
      <div data-pgpick>${pgPickerHtml(st)}</div><div data-pggrid>${pgTableHtml(st)}</div>
      <div class="pg-foot"><button type="button" class="btn sm" data-pgrows="1">${icon('plus', 'sm')}Add a row</button><button type="button" class="btn sm" data-pgrows="5">Add 5 rows</button>
        <label class="check small"><input type="checkbox" data-pgbm ${st.bmOn ? 'checked' : ''}> Body mass column</label></div>
      <p class="faint tiny" style="margin:8px 0 0">“Measured with” applies to new rows. OVR Jump heights are kept apart from force-plate heights. Clearing a saved value removes it.</p>`,
    onSubmit: async (v, form, mm) => {
      read(mm.wrap);
      // a new row can't repeat a day: that day's results go in one row (saved tests may share a day)
      const errs = [], plan = [], dayKey = (d, dev) => d + (dev === 'OVR Jump' ? '|ft' : '');
      const savedDays = new Set(st.rows.filter(r => r.id && !r.ro).map(r => { const d = ttDob(r.date.trim()); return d ? dayKey(d, r.dev) : null; }).filter(Boolean));
      const newDays = new Set();
      st.rows.forEach((r, i) => {
        if (r.ro) return;
        const typed = st.keys.some(k => String(r.vals[k] ?? '').trim()) || (st.bmOn && r.bm.trim());
        if (!r.id && !typed) return;
        const date = r.date.trim() ? ttDob(r.date.trim()) : '';
        if (!date) { errs.push(`Row ${i + 1}: ${r.date.trim() ? `“${r.date.trim()}” isn’t a past date (MM/DD/YYYY)` : 'add the date'}.`); return; }
        const dev = r.id ? r.dev : st.dev, key = dayKey(date, dev);
        if (!r.id) {
          if (savedDays.has(key)) { errs.push(`${fmtDate(date)} already has a row above: add those results there.`); return; }
          if (newDays.has(key)) { errs.push(`${fmtDate(date)} is in the table twice: put that day’s results in one row.`); return; }
          newDays.add(key);
        }
        const set = {}, del = [];
        st.keys.forEach(k => {
          const s = String(r.vals[k] ?? '').trim();
          if (r.id && s === (r.orig[k] ?? '')) return;
          if (!s) { if (r.id && r.orig[k]) del.push(k); return; }
          const p = fpParse(k, s);
          if (!p || p.bad) { errs.push(`${fmtDate(date)} · ${M[k].label}: “${s}” isn’t a valid ${metricUnit(M[k]) ? `number in ${metricUnit(M[k])}` : 'number'}.`); return; }
          set[k] = p.v;
        });
        let bmKg;
        if (st.bmOn && !(r.id && r.bm.trim() === r.bm0)) {
          const x = num(r.bm);
          if (r.bm.trim() && !(x > 0)) errs.push(`${fmtDate(date)} · body mass: “${r.bm.trim()}” isn’t a valid number.`);
          else bmKg = x > 0 ? U.massIn(x) : null;
        }
        plan.push({ r, date, set, del, bmKg, dev });
      });
      if (errs.length) return errs.slice(0, 4).join(' ') + (errs.length > 4 ? ` (+${errs.length - 4} more)` : '');
      const dels = plan.reduce((n, p) => n + p.del.length, 0);
      if (dels && !(await confirmBox(`Remove ${plural(dels, 'saved result')}?`, 'You cleared values that were already saved. They will be removed from the athlete’s history.', { ok: 'Remove' }))) return false;
      let results = 0;
      const days = new Set();
      plan.forEach(({ r, date, set, del, bmKg, dev }) => {
        const n = Object.keys(set).length + del.length + (bmKg !== undefined ? 1 : 0);
        if (r.id) {
          const t = getRec('tests', r.id);
          if (!t) return;
          if (!n && date === t.date) return;
          const mm2 = { ...t.m, ...set }, tr = { ...(t.trials || {}) };
          del.forEach(k => delete mm2[k]);
          [...Object.keys(set), ...del].forEach(k => delete tr[k]);   // trials no longer match an edited result
          if (!Object.keys(mm2).length) { removeRec('tests', t.id); results += del.length; days.add(date); return; }
          upsert('tests', { ...t, date, m: mm2, trials: tr, bodyMassKg: bmKg !== undefined ? bmKg : t.bodyMassKg ?? null });
        } else {
          // a new day joins a test typed in for that day (not one logged in a session), else it's a new test
          const ex = S.tests.find(t => t.athleteId === st.aid && t.date === date && !t.workoutId && (t.device || '') === (dev || '') && t.isoType !== 'ISQ');
          if (ex) upsert('tests', { ...ex, m: { ...ex.m, ...set }, bodyMassKg: bmKg ?? ex.bodyMassKg ?? null });
          else upsert('tests', { athleteId: st.aid, date, m: set, sides: {}, isoType: 'IMTP', bodyMassKg: bmKg ?? null, device: dev || undefined, notes: 'Added in past results' });
        }
        results += Object.keys(set).length + del.length;
        days.add(date);
      });
      S.settings.pastKeys = [...st.keys];
      persist();
      toast(results || days.size ? `Saved ${plural(results, 'result')} on ${plural(days.size, 'test day')}` : 'Nothing changed');
      refresh();
    },
    onMount: mm => {
      const grid = () => $('[data-pggrid]', mm.wrap), pick = () => $('[data-pgpick]', mm.wrap);
      const redraw = (focus) => { grid().innerHTML = pgTableHtml(st); pick().innerHTML = pgPickerHtml(st); if (focus) $(`input[data-r="${focus[0]}"][data-c="${focus[1]}"]`, mm.wrap)?.focus(); };
      const setKeys = keys => { read(mm.wrap); st.keys = [...new Set(keys.filter(pgOk))]; pgSync(st); redraw(); };
      // values typed but not saved yet in a column
      const typedIn = k => st.rows.filter(r => !r.ro && String(r.vals[k] ?? '').trim() !== (r.orig[k] ?? '')).length;
      mm.wrap.addEventListener('click', e => {
        const t = e.target;
        const rm = t.closest('[data-rmk]');
        if (rm) {
          const k = rm.dataset.rmk;
          if (st.keys.length < 2) return toast('Keep at least one test');
          read(mm.wrap);
          const n = typedIn(k);
          (n ? confirmBox(`Remove ${M[k].label}?`, `${plural(n, 'value')} typed in this column will not be saved.`, { ok: 'Remove' }) : Promise.resolve(true)).then(ok => { if (ok) setKeys(st.keys.filter(x => x !== k)); });
          return;
        }
        const add = t.closest('[data-pgrows]');
        if (add) { read(mm.wrap); for (let i = 0; i < +add.dataset.pgrows; i++) st.rows.push(pgBlank()); redraw([st.rows.length - +add.dataset.pgrows, 0]); }
      });
      mm.wrap.addEventListener('change', e => {
        const t = e.target;
        if (t.matches('[data-pgadd]') && t.value) setKeys([...st.keys, t.value]);
        // a quick pick sets the columns, keeping any column you've typed in
        if (t.matches('[data-pgp]') && t.value !== '') { read(mm.wrap); const [, keys, dev] = PG_PRESETS[+t.value]; if (dev) st.dev = dev; setKeys([...keys, ...st.keys.filter(k => typedIn(k) && !keys.includes(k))]); }
        if (t.matches('[data-pgdev]')) st.dev = t.value;
        if (t.matches('[data-pgbm]')) { read(mm.wrap); st.bmOn = t.checked; redraw(); }
      });
      // Enter moves down a row (adding one at the end), as in a spreadsheet
      mm.wrap.addEventListener('keydown', e => {
        const inp = e.target.closest('input[data-r]');
        if (!inp || e.key !== 'Enter') return;
        e.preventDefault();
        const r = +inp.dataset.r, c = +inp.dataset.c;
        if (r + 1 >= st.rows.length) { read(mm.wrap); st.rows.push(pgBlank()); redraw([r + 1, c]); }
        else $(`input[data-r="${r + 1}"][data-c="${c}"]`, mm.wrap)?.focus();
      });
      // Pasting a block from a spreadsheet fills the cells to the right and below
      mm.wrap.addEventListener('paste', e => {
        const inp = e.target.closest('input[data-r]');
        const text = e.clipboardData?.getData('text') || '';
        if (!inp || !/[\t\n]/.test(text.trim())) return;
        e.preventDefault();
        read(mm.wrap);
        const cols = pgCols(st), r0 = +inp.dataset.r, c0 = +inp.dataset.c;
        const lines = text.replace(/\r/g, '').split('\n').filter(l => l.trim() !== '');
        let ri = r0;
        lines.forEach(line => {
          while (ri < st.rows.length && st.rows[ri].ro) ri++;
          while (ri >= st.rows.length) st.rows.push(pgBlank());
          const row = st.rows[ri];
          line.split('\t').forEach((cellTxt, j) => {
            const c = cols[c0 + j], v = cellTxt.trim();
            if (!c) return;
            if (c === 'date') { const d = parseDateAny(v); row.date = d ? ttDobOut(d) : v; } else if (c === 'bm') row.bm = v; else row.vals[c] = v;
          });
          ri++;
        });
        pgPad(st);
        redraw([Math.min(ri, st.rows.length - 1), c0]);
        toast(`Pasted ${plural(lines.length, 'row')}`);
      });
    },
  });
};
