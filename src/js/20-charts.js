/* =========================================================
   Charts: dependency-free SVG, drawn at real container width
   ========================================================= */
const CHARTS = new Map();
let chartSeq = 0;
function chart(spec) {
  const id = 'ch' + (++chartSeq);
  CHARTS.set(id, spec);
  return `<div class="chart" id="${id}" style="height:${spec.h || 170}px"></div>`;
}
function drawCharts() {
  $$('.chart[id]').forEach(el => {
    const spec = CHARTS.get(el.id);
    if (!spec) return;
    const W = Math.max(200, el.clientWidth || 300);
    try { el.innerHTML = spec.type === 'scatter' ? drawScatter(spec, W) : spec.type === 'bar' ? drawBar(spec, W) : drawLine(spec, W); }
    catch (e) { console.error(e); el.innerHTML = '<div class="muted small">Chart unavailable</div>'; }
  });
}
window.addEventListener('resize', debounce(drawCharts, 150));

function niceTicks(min, max, count = 4) {
  const span = max - min;
  if (!(span > 0)) return [min];
  const step0 = span / count;
  const mag = 10 ** Math.floor(Math.log10(step0));
  const n = step0 / mag;
  const step = (n < 1.5 ? 1 : n < 3 ? 2 : n < 7 ? 5 : 10) * mag;
  const out = [];
  // a small allowance so floating-point error never drops the first tick (1.7000000000000002 / 0.05 must still give 1.70)
  for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-6; v += step) out.push(+v.toPrecision(12));
  return out;
}
function tickFmt(v, ticks) {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : Math.abs(v) || 1;
  const d = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
  return fmtNum(Math.abs(v) < step * 1e-9 ? 0 : v, d).replace(/^-/, '−');   // a real minus sign
}
function domain(vals, padFrac = 0.12) {
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * padFrac || Math.abs(hi) * 0.05 || 1;
  return [lo - pad, hi + pad];
}

/* Ticks for a date axis: days, weeks or months depending on the span */
function dateTicks(x0, x1, maxN) {
  const day = 864e5, span = (x1 - x0) / day, out = [];
  if (span <= 42) {
    const step = [1, 2, 7, 14].find(st => span / st <= maxN) || 14;
    const d = new Date(x0); d.setHours(0, 0, 0, 0);
    if (d.getTime() < x0) d.setDate(d.getDate() + 1);
    for (; d.getTime() <= x1; d.setDate(d.getDate() + step)) out.push(d.getTime());
    return { ticks: out, fmt: t => new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) };
  }
  const months = span / 30.44, stepM = [1, 2, 3, 6, 12].find(m => months / m <= maxN) || 12;
  const d = new Date(x0); d.setHours(0, 0, 0, 0); d.setDate(1);
  if (d.getTime() < x0) d.setMonth(d.getMonth() + 1);
  while (d.getMonth() % stepM) d.setMonth(d.getMonth() + 1);
  for (; d.getTime() <= x1; d.setMonth(d.getMonth() + stepM)) out.push(d.getTime());
  const multiYear = new Date(x0).getFullYear() !== new Date(x1).getFullYear();
  return { ticks: out, fmt: t => { const dt = new Date(t); const m = dt.toLocaleDateString(undefined, { month: 'short' }); return multiYear && (dt.getMonth() === 0 || t === out[0]) ? `${m} ’${String(dt.getFullYear()).slice(2)}` : m; } };
}
/* One metric's results as a chart spec: up always means better, the shaded band is the first result ± the
   test's typical error (changes outside it are real), the latest value and the best result are labelled */
function metricChartSpec(m, ser, { h = 150, color } = {}) {
  const pts = ser.map((p, i) => {
    const prev = ser[i - 1], pct = prev && prev.v ? (p.v - prev.v) / Math.abs(prev.v) * 100 : null;
    return { x: p.date, y: metricDisp(m, p.v), tip: `${fmtDate(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}: ${fmtMetric(m, p.v)}${pct != null ? ` (${pct >= 0 ? '+' : '−'}${fmtNum(Math.abs(pct), 1)}%)` : ''}` };
  });
  const first = pts[0]?.y, te = m.te;
  const ys = pts.map(p => p.y), best = m.dir === -1 ? ys.indexOf(Math.min(...ys)) : m.dir === 1 ? ys.indexOf(Math.max(...ys)) : null;
  return {
    type: 'line', points: pts, h, color, invert: m.dir === -1, unit: metricUnit(m) || '', best,
    upLabel: m.dir === -1 ? (metricUnit(m) === 's' ? '↑ faster' : '↑ lower is better') : m.dir === 1 ? '' : '',
    band: te && ser.length > 1 && Number.isFinite(first) ? { lo: first - Math.abs(first) * te / 100, hi: first + Math.abs(first) * te / 100, label: `first test ± ${fmtNum(te, 0)}%` } : null,
    minSpan: te && Number.isFinite(first) ? Math.abs(first) * te / 100 * 4 : null,
    valFmt: (y, i) => fmtMetric(m, ser[i].v),
  };
}
/* Line chart over time.
   spec: points [{x: 'YYYY-MM-DD', y, tip}], h, color, refY/refLabel, yFmt,
   invert (lower is better: the scale is flipped so up always means better),
   band {lo, hi, label} (e.g. the typical error around the first result), minSpan (smallest y range shown),
   unit (shown at the top), valFmt (labels for the latest and best points), best (index of the best point),
   levels [{y, label, cls, force}] (dashed level lines; force = always inside the y range). */
function drawLine(spec, W) {
  const H = spec.h || 170, pts = spec.points;
  if (!pts.length) return '';
  const xs = pts.map(p => parseDS(p.x).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 864e5 * 14; x1 += 864e5 * 14; }
  // y range: the points, the reference line and the band, never narrower than minSpan, padded, snapped to ticks
  const ys = pts.map(p => p.y), extra = [spec.refY, spec.band?.lo, spec.band?.hi, ...(spec.levels || []).filter(l => l.force).map(l => l.y)].filter(v => v != null && Number.isFinite(v));
  let lo = Math.min(...ys, ...extra), hi = Math.max(...ys, ...extra);
  if (spec.minSpan && hi - lo < spec.minSpan) { const c = (hi + lo) / 2; lo = c - spec.minSpan / 2; hi = c + spec.minSpan / 2; }
  const pad = (hi - lo) * 0.14 || Math.abs(hi) * 0.05 || 1;
  let y0 = lo - pad, y1 = hi + pad;
  if (Math.min(...ys) >= 0 && y0 < 0) y0 = 0;
  const nT = H < 140 ? 3 : H < 220 ? 4 : 5;
  let ticks = niceTicks(y0, y1, nT);
  if (ticks.length > 1) { const st = ticks[1] - ticks[0]; y0 = +(Math.floor(y0 / st + 1e-9) * st).toPrecision(12); y1 = +(Math.ceil(y1 / st - 1e-9) * st).toPrecision(12); ticks = niceTicks(y0, y1, nT); }
  const yLab = t => (spec.yFmt ? spec.yFmt(t) : tickFmt(t, ticks));
  const top = [spec.unit, spec.upLabel || (spec.invert ? '↑ better' : '')].filter(Boolean).join(' · ');
  const pl = Math.max(30, Math.max(...ticks.map(t => String(yLab(t)).length)) * 6.6 + 12), pr = 18, pt = top ? 22 : 12, pb = 26;
  const X = t => pl + (t - x0) / (x1 - x0) * (W - pl - pr);
  const Y = v => { const f = (v - y0) / (y1 - y0 || 1); return pt + (spec.invert ? f : 1 - f) * (H - pt - pb); };
  const col = spec.color || 'var(--accent)';
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
  if (top) s += `<text class="ax-u" x="${pl}" y="11" text-anchor="start">${esc(top)}</text>`;
  if (spec.band && Number.isFinite(spec.band.lo) && Number.isFinite(spec.band.hi)) {
    const by0 = Y(spec.band.lo), by1 = Y(spec.band.hi), top = Math.min(by0, by1), h = Math.abs(by1 - by0);
    s += `<rect class="band" x="${pl}" y="${top.toFixed(1)}" width="${(W - pl - pr).toFixed(1)}" height="${h.toFixed(1)}" rx="3"/>`;
    // legend in the top row (inside the band it would collide with the points)
    if (spec.band.label) s += `<rect class="band" x="${(W - pr - 8 - spec.band.label.length * 5.6 - 14).toFixed(1)}" y="3" width="10" height="10" rx="2" style="opacity:.35"/><text class="band-l" x="${W - pr}" y="11" text-anchor="end">${esc(spec.band.label)}</text>`;
  }
  ticks.forEach((t, i) => { if (t < y0 - 1e-9 || t > y1 + 1e-9) return; s += `<line class="grid-l${i === 0 && !spec.invert || i === ticks.length - 1 && spec.invert ? ' base' : ''}" x1="${pl}" x2="${W - pr}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}"/><text x="${pl - 8}" y="${(Y(t) + 4).toFixed(1)}" text-anchor="end">${esc(yLab(t))}</text>`; });
  if (spec.refY != null) {
    s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(spec.refY)}" y2="${Y(spec.refY)}" stroke="var(--text-3)" stroke-dasharray="4 4"/>`;
    if (spec.refLabel) s += `<text class="ref-t" x="${pl + 6}" y="${(Y(spec.refY) - 5 < pt + 8 ? Y(spec.refY) + 13 : Y(spec.refY) - 5).toFixed(1)}" text-anchor="start">${esc(spec.refLabel)}</text>`;
  }
  // level lines (e.g. high-school standards): dashed, coloured by level, labelled at the left
  (spec.levels || []).forEach(l => {
    if (!Number.isFinite(l.y) || l.y < Math.min(y0, y1) - 1e-9 || l.y > Math.max(y0, y1) + 1e-9) return;
    const y = Y(l.y);
    s += `<line class="lvl-l lv-${esc(l.cls || '')}" x1="${pl}" x2="${W - pr}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    if (l.label) s += `<text class="lvl-t lv-${esc(l.cls || '')}" x="${pl + 6}" y="${(y - 5 < pt + 8 ? y + 13 : y - 5).toFixed(1)}" text-anchor="start">${esc(l.label)}</text>`;
  });
  // date axis
  const dt = dateTicks(x0, x1, Math.max(2, Math.min(7, Math.floor((W - pl - pr) / 62))));
  const xt = dt.ticks.length >= 2 ? dt.ticks : [x0, x1];
  xt.forEach(t => { const x = X(t); if (x < pl - 1 || x > W - pr + 1) return; s += `<line class="tick-x" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${H - pb}" y2="${H - pb + 4}"/><text x="${x.toFixed(1)}" y="${H - 7}" text-anchor="${x < pl + 16 ? 'start' : x > W - pr - 16 ? 'end' : 'middle'}">${esc(dt.ticks.length >= 2 ? dt.fmt(t) : new Date(t).toLocaleDateString(undefined, { month: 'short', day: 'numeric' }))}</text>`; });
  const P = pts.map((p, i) => [X(xs[i]), Y(p.y)]);
  if (P.length > 1) {
    const d = P.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".14"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>`;
    if (!spec.band) s += `<path d="${d}L${P[P.length - 1][0].toFixed(1)} ${H - pb}L${P[0][0].toFixed(1)} ${H - pb}Z" fill="url(#${gid})"/>`;
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  const lastI = P.length - 1, bestI = spec.best != null && spec.best !== lastI && P.length > 1 ? spec.best : -1;
  P.forEach((q, i) => {
    const last = i === lastI;
    if (last) s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="9" fill="${col}" opacity=".16"/>`;
    s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="${last ? 4.8 : 3.4}" fill="${last ? col : 'var(--surface)'}" stroke="${col}" stroke-width="2"/>`;
    if (i === bestI) s += `<circle cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="7.5" fill="none" stroke="var(--good)" stroke-width="1.8"/>`;
  });
  // labels: the latest value, and "Best" when the best isn't the latest
  // above the point when there's room, else below; when neither fits, to its left (the line comes in from above)
  const lab = (q, txt, cls, prefer = 'above') => {
    const roomAbove = q[1] - 12 > pt + 4, roomBelow = q[1] + 20 <= H - pb;
    const pos = prefer === 'below' ? (roomBelow ? 'below' : q[0] > pl + 60 ? 'left' : 'above') : roomAbove ? 'above' : roomBelow ? 'below' : 'left';
    if (pos === 'left') return `<text class="pt-l ${cls}" x="${(q[0] - 11).toFixed(1)}" y="${(q[1] + 4).toFixed(1)}" text-anchor="end">${esc(txt)}</text>`;
    const x = Math.min(Math.max(q[0], pl + 12), W - pr - 2);
    return `<text class="pt-l ${cls}" x="${x.toFixed(1)}" y="${(pos === 'above' ? q[1] - 12 : q[1] + 20).toFixed(1)}" text-anchor="${q[0] > W - pr - 40 ? 'end' : q[0] < pl + 30 ? 'start' : 'middle'}">${esc(txt)}</text>`;
  };
  if (spec.valFmt) {
    // below the point when the line comes down into it, so the label doesn't sit on the line
    s += lab(P[lastI], spec.valFmt(pts[lastI].y, lastI), 'last', lastI > 0 && P[lastI - 1][1] < P[lastI][1] - 6 ? 'below' : 'above');
    if (bestI >= 0 && Math.abs(P[bestI][0] - P[lastI][0]) > 34) s += lab(P[bestI], `Best ${spec.valFmt(pts[bestI].y, bestI)}`, 'best');
  }
  P.forEach((q, i) => { s += `<circle class="hit" cx="${q[0].toFixed(1)}" cy="${q[1].toFixed(1)}" r="13" data-tip="${esc(pts[i].tip || '')}"/>`; });
  return s + '</svg>';
}

function drawScatter(spec, W) {
  const H = spec.h || 240, pl = 48, pr = 18, pt = 14, pb = 34;
  const pts = spec.points;
  if (!pts.length) return '';
  const xv = pts.map(p => p.x).concat(spec.marker ? [spec.marker.x] : []);
  const yv = pts.map(p => p.y).concat(spec.hline != null ? [spec.hline] : []);
  let [x0, x1] = domain(xv, 0.08), [y0, y1] = domain(yv, 0.1);
  x0 = Math.max(0, x0); y0 = Math.max(0, y0);
  const xt = niceTicks(x0, x1, Math.max(3, Math.min(6, Math.floor(W / 90)))), yt = niceTicks(y0, y1, 4);
  const X = v => pl + (v - x0) / (x1 - x0) * (W - pl - pr);
  const Y = v => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
  yt.forEach(t => { if (t >= y0 && t <= y1) s += `<line class="grid-l" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${pl - 8}" y="${Y(t) + 4}" text-anchor="end">${tickFmt(t, yt)}</text>`; });
  xt.forEach(t => { if (t >= x0 && t <= x1) s += `<text x="${X(t)}" y="${H - 16}" text-anchor="middle">${esc(spec.xFmt ? spec.xFmt(t) : tickFmt(t, xt))}</text>`; });
  if (spec.xLabel) s += `<text x="${(pl + W - pr) / 2}" y="${H - 1}" text-anchor="middle">${esc(spec.xLabel)}</text>`;
  if (spec.yLabel) s += `<text x="${pl}" y="${pt - 2}" text-anchor="start" style="font-weight:600">${esc(spec.yLabel)}</text>`;
  if (spec.hline != null) {
    s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(spec.hline)}" y2="${Y(spec.hline)}" stroke="var(--bad)" stroke-dasharray="5 4" stroke-width="1.5"/>`;
    if (spec.hlineLabel) s += `<text x="${pl + 6}" y="${Y(spec.hline) - 6}" text-anchor="start" style="fill:var(--bad)">${esc(spec.hlineLabel)}</text>`;
  }
  if (spec.line) {
    const { a, b } = spec.line;
    const la = Math.max(x0, spec.line.from ?? x0), lb = Math.min(x1, spec.line.to ?? x1);
    s += `<line x1="${X(la)}" y1="${Y(a + b * la)}" x2="${X(lb)}" y2="${Y(a + b * lb)}" stroke="var(--accent)" stroke-width="2" stroke-dasharray="${spec.line.dash ? '6 5' : ''}"/>`;
  }
  pts.forEach(p => {
    s += `<circle cx="${X(p.x)}" cy="${Y(p.y)}" r="4.5" fill="${p.color || 'var(--accent)'}" fill-opacity="${p.old ? .35 : .85}" stroke="var(--surface)" stroke-width="1.5"/>`;
    s += `<circle class="hit" cx="${X(p.x)}" cy="${Y(p.y)}" r="12" data-tip="${esc(p.tip || '')}"/>`;
  });
  if (spec.marker) {
    const m = spec.marker;
    s += `<circle cx="${X(m.x)}" cy="${Y(m.y)}" r="7" fill="none" stroke="var(--bad)" stroke-width="2.5"/>`;
    s += `<circle class="hit" cx="${X(m.x)}" cy="${Y(m.y)}" r="13" data-tip="${esc(m.tip || '')}"/>`;
    if (m.label) s += `<text x="${X(m.x) - 12}" y="${Y(m.y) - 14}" text-anchor="end" style="fill:var(--bad);font-weight:700;paint-order:stroke;stroke:var(--surface);stroke-width:4px">${esc(m.label)}</text>`;
  }
  return s + '</svg>';
}

function drawBar(spec, W) {
  const H = spec.h || 170, pl = 46, pr = 10, pt = 12, pb = 26;
  const bars = spec.bars;
  if (!bars.length) return '';
  const max = Math.max(1, ...bars.map(b => b.v));
  const ticks = niceTicks(0, max * 1.1, 4);
  const top = ticks[ticks.length - 1] || max;
  const Y = v => pt + (1 - v / top) * (H - pt - pb);
  const bw = (W - pl - pr) / bars.length;
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
  ticks.forEach(t => { s += `<line class="grid-l" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${pl - 8}" y="${Y(t) + 4}" text-anchor="end">${tickFmt(t, ticks)}</text>`; });
  const every = Math.ceil(bars.length / Math.max(2, Math.floor(W / 60)));
  bars.forEach((b, i) => {
    const x = pl + i * bw + bw * 0.18, w = bw * 0.64, y = Y(b.v);
    s += `<rect x="${x}" y="${y}" width="${w}" height="${Math.max(0, H - pb - y)}" rx="3" fill="${b.color || 'var(--accent)'}" opacity="${b.dim ? .45 : 1}"/>`;
    s += `<rect class="hit" x="${pl + i * bw}" y="${pt}" width="${bw}" height="${H - pt - pb}" data-tip="${esc(b.tip || '')}"/>`;
    if (i % every === 0 || i === bars.length - 1) s += `<text x="${x + w / 2}" y="${H - 6}" text-anchor="middle">${esc(b.label)}</text>`;
  });
  return s + '</svg>';
}

function sparkline(vals, color = 'var(--accent)') {
  if (vals.length < 2) return '';
  const lo = Math.min(...vals), hi = Math.max(...vals), r = hi - lo || 1;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1) * 60 + 2).toFixed(1)},${(20 - (v - lo) / r * 16).toFixed(1)}`).join(' ');
  return `<svg class="spark" viewBox="0 0 64 22" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="${color}" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/* Tooltip for chart points (tap on iPhone, hover on Mac) */
(function () {
  let tip = null;
  const hide = () => { tip?.remove(); tip = null; };
  const show = el => {
    const text = el.getAttribute('data-tip');
    if (!text) return;
    hide();
    tip = document.createElement('div');
    tip.className = 'chart-tip';
    tip.textContent = text;
    const r = el.getBoundingClientRect();
    tip.style.left = Math.min(window.innerWidth - 80, Math.max(80, r.left + r.width / 2)) + 'px';
    tip.style.top = (r.top + r.height / 2 - 4) + 'px';
    document.body.appendChild(tip);
  };
  document.addEventListener('pointerover', e => { if (e.pointerType === 'mouse' && e.target.matches?.('.chart .hit')) show(e.target); });
  document.addEventListener('pointerout', e => { if (e.pointerType === 'mouse' && e.target.matches?.('.chart .hit')) hide(); });
  document.addEventListener('click', e => { if (e.target.matches?.('.chart .hit')) show(e.target); else hide(); }, true);
  window.addEventListener('scroll', hide, { passive: true });
})();
