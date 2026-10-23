/* =========================================================
   Custom tests (created in Settings, no code needed)
   Stored in settings.customMetrics and synced between devices.
   ========================================================= */
const CUSTOM_KINDS = [['number', 'Number (enter a unit)'], ['time', 'Time (seconds)'], ['len', 'Height / distance (in or cm)'], ['mass', 'Weight (lb or kg)']];
function customMetricDefs() { return Array.isArray(S.settings.customMetrics) ? S.settings.customMetrics : []; }
function customKeys() { return customMetricDefs().map(c => c.key); }
/* Rebuild the custom entries in METRICS / M from settings (call after load, settings change or sync) */
function registerCustomMetrics() {
  for (let i = METRICS.length - 1; i >= 0; i--) if (METRICS[i].custom) { delete M[METRICS[i].key]; METRICS.splice(i, 1); }
  if (!TEST_CATS.some(c => c.key === 'custom')) TEST_CATS.splice(TEST_CATS.findIndex(c => c.key === 'derived'), 0, { key: 'custom', label: 'Custom tests', color: '#0f766e' });
  const calcAt = METRICS.findIndex(m => m.calc);
  customMetricDefs().forEach((c, i) => {
    const def = { key: c.key, cat: c.cat || 'custom', label: c.label, dir: c.dir ?? 1, dec: c.dec ?? 2, te: c.te ?? null, custom: true };
    if (c.kind === 'len') def.kind = 'len';
    else if (c.kind === 'mass') def.kind = 'mass';
    else def.unit = c.kind === 'time' ? 's' : (c.unit || '');
    METRICS.splice(calcAt + i, 0, def);
    M[c.key] = def;
  });
}
function groupMetrics() { return [...GROUP_METRICS, ...customKeys()]; }

A.customTests = () => {
  const list = () => customMetricDefs().map(c => {
    const n = S.tests.filter(t => t.m?.[c.key] != null).length;
    return `<div class="row"><span class="row-main"><span class="row-title">${esc(c.label)}</span><span class="row-sub">${esc(TEST_CATS.find(x => x.key === (c.cat || 'custom'))?.label || 'Custom tests')} · ${esc(c.kind === 'number' ? (c.unit || 'no unit') : CUSTOM_KINDS.find(k => k[0] === c.kind)[1])} · ${c.dir === -1 ? 'lower is better' : c.dir === 0 ? 'no better/worse' : 'higher is better'} · ${plural(n, 'result')}</span></span><button type="button" class="btn sm" data-ced="${c.key}">${icon('edit', 'sm')}Edit</button></div>`;
  }).join('') || '<div class="muted small" style="padding:8px 0">No custom tests yet.</div>';
  const m = openModal({
    title: 'Custom tests', size: 'wide',
    body: `<p class="muted small">Add any test you run — e.g. “Med ball chest throw”, “5-0-5 left”, “Grip strength”. Custom tests appear in test entry, group testing, gym-floor quick tests, trend charts, the leaderboard, GSP records, reports, CSV import and export.</p>
      <div class="list" id="ctList">${list()}</div>
      <button type="button" class="btn primary" style="margin-top:12px" data-cnew>${icon('plus', 'sm')}New custom test</button>`,
  });
  m.wrap.addEventListener('click', e => {
    if (e.target.closest('[data-cnew]')) editCustomTest(null, () => { $('#ctList', m.wrap).innerHTML = list(); });
    const b = e.target.closest('[data-ced]');
    if (b) editCustomTest(customMetricDefs().find(c => c.key === b.dataset.ced), () => { $('#ctList', m.wrap).innerHTML = list(); });
  });
};
function editCustomTest(c, done) {
  const isNew = !c;
  const x = c || { label: '', cat: 'custom', kind: 'number', unit: '', dir: 1, dec: 2, te: 5 };
  const used = isNew ? 0 : S.tests.filter(t => t.m?.[x.key] != null).length;
  openModal({
    title: isNew ? 'New custom test' : 'Edit custom test', size: 'narrow', center: true,
    body: `${field('Test name', inp('label', x.label, 'autofocus placeholder="e.g. Med ball chest throw"'))}
      ${field('Section', sel('cat', TEST_CATS.filter(t => !['derived', 'body'].includes(t.key)).map(t => [t.key, t.label]), x.cat || 'custom'))}
      ${field('Type of result', sel('kind', CUSTOM_KINDS, x.kind, used ? 'disabled' : ''), { hint: used ? 'Can’t change once results are entered.' : 'Height/distance and weight follow your lb/in or kg/cm setting.' })}
      ${field('Unit', inp('unit', x.unit, 'placeholder="e.g. m, reps, kg, N"'), { hint: 'Only used for “Number”.' })}
      ${field('Which is better?', segmented('dir', [['1', 'Higher'], ['-1', 'Lower'], ['0', 'Neither']], String(x.dir)))}
      <div class="fields">${field('Decimal places', sel('dec', [['0', '0'], ['1', '1'], ['2', '2'], ['3', '3']], String(x.dec)))}
      ${field('Typical test noise', numInp('te', x.te ?? ''), { unit: '%', hint: 'Changes smaller than this show as “within noise”. 5% if unsure.' })}</div>`,
    onSubmit: v => {
      const label = v.label.trim();
      if (!label) return 'Give the test a name.';
      if (METRICS.some(m => m.label.toLowerCase() === label.toLowerCase() && m.key !== x.key)) return 'A test with that name already exists.';
      const te = num(v.te);
      if (v.te.trim() && (te == null || te < 0 || te > 100)) return 'Typical noise should be 0–100%.';
      const rec = { key: x.key || 'c_' + uid(), label, cat: v.cat, kind: used ? x.kind : v.kind, unit: v.unit.trim(), dir: +v.dir, dec: +v.dec, te: te ?? null };
      const arr = customMetricDefs().filter(o => o.key !== rec.key);
      S.settings.customMetrics = isNew ? [...arr, rec] : customMetricDefs().map(o => (o.key === rec.key ? rec : o));
      registerCustomMetrics(); persist(); recordBaseline();
      toast(isNew ? 'Custom test added' : 'Saved'); done?.(); refresh();
    },
    onDelete: isNew ? null : async () => {
      if (!(await confirmBox(`Delete “${x.label}”?`, used ? `${plural(used, 'result')} will be hidden (not erased) — re-create a test with the same name won’t bring them back.` : ''))) return false;
      S.settings.customMetrics = customMetricDefs().filter(o => o.key !== x.key);
      registerCustomMetrics(); persist(); recordBaseline(); done?.(); refresh();
    },
  });
}
