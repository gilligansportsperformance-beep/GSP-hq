/* =========================================================
   One athlete's results for one test (#/metric/<athleteId>/<key>): a large chart and every data point,
   with where it came from, the trials, body mass and the change from the result before.
   key 'ft:<jump>' = that jump measured by OVR Jump (flight time), kept apart from force-plate results;
   key 'ISQ:<imtp key>' (or CALF:, OTHER:) = that result from another isometric test, kept apart from the IMTP.
   ========================================================= */
const ISO_KEYS = ['ISQ', 'CALF', 'OTHER'];
function metricPointsFor(aid, key) {
  const pre = String(key).match(/^(ft|ISQ|CALF|OTHER):(.+)$/), k = pre ? pre[2] : String(key), m = M[k];
  const ft = pre?.[1] === 'ft', iso = pre && pre[1] !== 'ft' ? pre[1] : 'IMTP';
  if (!m || (ft && !FT_KEYS.includes(k)) || (iso !== 'IMTP' && !isoSplit(k))) return null;
  let ser = metricSeries(aid, k);
  if (FT_KEYS.includes(k)) ser = ser.filter(p => jumpMethod(p.dev) === (ft ? 'ft' : 'fp'));
  if (isoSplit(k)) ser = ser.filter(p => isoOf(p) === iso);
  return { k, m, ft, iso, ser };
}
/* The results-page key and label tag for a series' method */
const metricKeyFor = (k, p) => (FT_KEYS.includes(k) && jumpMethod(p?.dev) === 'ft' ? 'ft:' + k : isoSplit(k) && isoOf(p) !== 'IMTP' ? `${isoOf(p)}:${k}` : k);
const metricTagFor = (k, p) => (FT_KEYS.includes(k) && jumpMethod(p?.dev) === 'ft' ? ' (OVR Jump)' : isoSplit(k) && isoOf(p) !== 'IMTP' ? ` (${ISO_NAME[isoOf(p)] || isoOf(p)})` : '');
const metricHref = (aid, key) => `#/metric/${aid}/${encodeURIComponent(key)}`;
/* Where a result came from */
function testSource(t) {
  if (!t) return 'Testing';
  if (t.evaluation) return 'Evaluation';
  if (t.teamTestId) return 'Team test day';
  if (t.workoutId) return 'Session log';
  if (String(t.id).startsWith('imp~')) return 'Imported';
  if (String(t.notes || '').startsWith('Added in past results')) return 'Past results';
  return 'Testing';
}
const ISO_NAME = { IMTP: 'IMTP', ISQ: 'Isometric squat', CALF: 'Calf', OTHER: 'Other isometric' };
ROUTES.metric = r => {
  const [aid, key] = r.parts || [];
  const a = getAthlete(aid), D = a && key ? metricPointsFor(aid, key) : null;
  if (!a || !D) return { title: 'Results', back: a ? `#/athlete/${a.id}/testing` : '#/athletes', nav: 'athletes', body: '<div class="card"><p class="muted">This result isn’t available.</p></div>' };
  const { k, m, ft, iso, ser } = D;
  const title = `${m.label}${ft ? ' (OVR Jump)' : iso !== 'IMTP' ? ` (${ISO_NAME[iso]})` : ''}`, back = `#/athlete/${a.id}/testing`;
  const head = `<div class="mt-who">${avatar(a, 'sm')}<div><b>${esc(athleteName(a))}</b><div class="faint small">${esc(metricGroupLabel(m))}${m.hint ? ` · ${esc(m.hint)}` : ''}</div></div></div>`;
  if (!ser.length) return { title, back, nav: 'athletes', body: `<div class="card">${head}${emptyState_('clipboard', 'No results yet', `${esc(a.firstName)} has no ${esc(m.label)} results yet.`)}</div>` };
  const t = trendOf(ser, m), bestP = m.dir ? ser.find(p => p.v === t.best) : null;
  const tile = (name, val, foot) => `<div class="tile"><div class="t-name">${name}</div><div class="t-val">${val}</div>${foot ? `<div class="t-foot">${foot}</div>` : ''}</div>`;
  const val = v => `${esc(fmtMetric(m, v, false))} <small>${esc(metricUnit(m) || '')}</small>`;
  const ref = k === 'dsi' ? { refY: 0.8, refLabel: '0.80' } : k === 'eur' ? { refY: 1.0, refLabel: '1.00' } : k === 'asym' ? { refY: 10, refLabel: '10%' } : {};
  const last = ser[ser.length - 1], lv = ft || iso !== 'IMTP' ? null : stdChartLevels(a, k, ser);
  const rows = [...ser].reverse().map((p, idx) => {
    const i = ser.length - 1 - idx, prev = ser[i - 1], test = getRec('tests', p.id);
    const pct = prev && prev.v ? (p.v - prev.v) / Math.abs(prev.v) * 100 : null;
    const trials = (test?.trials?.[k] || []).filter(Number.isFinite);
    const from = [testSource(test), p.dev, m.cat === 'iso' && p.iso ? ISO_NAME[p.iso] || p.iso : '', p.bm ? fmtMass(p.bm) : ''].filter(Boolean).join(' · ');
    return `<tr class="click" data-act="editTest" data-id="${esc(p.id)}">
      <td class="nowrap">${esc(fmtDateFull(p.date))}<div class="faint tiny mt-from">${esc(from)}</div></td>
      <td class="n"><b class="nowrap">${esc(fmtMetric(m, p.v))}</b>${bestP && p === bestP ? ' <span class="badge good">Best</span>' : ''}${trials.length > 1 ? `<div class="faint tiny">${esc(trials.map(x => fmtMetric(m, x, false)).join(' · '))}</div>` : ''}</td>
      <td class="n nowrap">${pct != null ? deltaHtml(m, pct) : '<span class="faint small">First</span>'}</td>
      <td class="mt-go">${icon('chevR', 'sm')}</td></tr>`;
  }).join('');
  const body = `
    <div class="card mt-head">${head}
      <div class="tiles mt-tiles">
        ${tile('Latest', val(last.v), esc(fmtDate(last.date)))}
        ${bestP ? tile('Best', val(t.best), esc(fmtDate(bestP.date))) : ''}
        ${tile('First', val(ser[0].v), esc(fmtDate(ser[0].date)))}
        ${tile('Since first', t.dBasePct != null ? deltaHtml(m, t.dBasePct) : '<span class="faint small">—</span>', esc(plural(ser.length, 'result')))}
      </div>
      <div class="mt-chart">${chart({ ...metricChartSpec(m, ser, { h: 260 }), ...(lv ? {} : ref), levels: lv?.levels })}</div>
      <p class="faint tiny" style="margin:6px 0 0">${lv ? `${lv.note} ` : ''}${m.te && ser.length > 1 ? `Shaded: the first result ± the test’s typical error (${fmtNum(m.te, 0)}%). Results outside it are real changes; inside it is normal test-to-test variation. ` : ''}${m.dir === -1 ? 'Lower is better, so the scale is flipped: higher on the chart is better. ' : ''}Tap a point for its value.</p>
      ${stdInlineHtml(a, k, last)}
    </div>
    <div class="section-title">Every result <span class="count">${ser.length}</span></div>
    <div class="card flush"><div class="table-wrap"><table class="t mt-table">
      <thead><tr><th>Date</th><th class="n">Result</th><th class="n">Change</th><th></th></tr></thead>
      <tbody>${rows}</tbody></table></div></div>
    <p class="faint tiny" style="margin:8px 2px 0">Newest first. Change is from the result before; coloured only when it is bigger than the test’s typical error. Tap a row to see, correct or delete that test.</p>`;
  return { title, back, nav: 'athletes', body };
};
