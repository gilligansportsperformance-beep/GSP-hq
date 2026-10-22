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
  for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-6; v += step) out.push(+v.toPrecision(12));
  return out;
}
function tickFmt(v, ticks) {
  const step = ticks.length > 1 ? Math.abs(ticks[1] - ticks[0]) : Math.abs(v) || 1;
  const d = step >= 1 ? 0 : Math.min(3, Math.ceil(-Math.log10(step)));
  return fmtNum(v, d);
}
function domain(vals, padFrac = 0.12) {
  let lo = Math.min(...vals), hi = Math.max(...vals);
  const pad = (hi - lo) * padFrac || Math.abs(hi) * 0.05 || 1;
  return [lo - pad, hi + pad];
}

function drawLine(spec, W) {
  const H = spec.h || 170, pl = 46, pr = 16, pt = 12, pb = 26;
  const pts = spec.points;
  if (!pts.length) return '';
  const xs = pts.map(p => parseDS(p.x).getTime());
  let x0 = Math.min(...xs), x1 = Math.max(...xs);
  if (x0 === x1) { x0 -= 864e5 * 14; x1 += 864e5 * 14; }
  const yVals = pts.map(p => p.y).concat(spec.refY != null ? [spec.refY] : []);
  let [y0, y1] = domain(yVals);
  const ticks = niceTicks(y0, y1, H < 140 ? 3 : 4);
  const X = t => pl + (t - x0) / (x1 - x0) * (W - pl - pr);
  const Y = v => pt + (1 - (v - y0) / (y1 - y0)) * (H - pt - pb);
  const col = spec.color || 'var(--accent)';
  let s = `<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" role="img">`;
  for (const t of ticks) {
    if (t < y0 || t > y1) continue;
    s += `<line class="grid-l" x1="${pl}" x2="${W - pr}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${pl - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(spec.yFmt ? spec.yFmt(t) : tickFmt(t, ticks))}</text>`;
  }
  if (spec.refY != null) {
    s += `<line x1="${pl}" x2="${W - pr}" y1="${Y(spec.refY)}" y2="${Y(spec.refY)}" stroke="var(--text-3)" stroke-dasharray="4 4"/>`;
    if (spec.refLabel) s += `<text x="${W - pr}" y="${Y(spec.refY) - 5}" text-anchor="end">${esc(spec.refLabel)}</text>`;
  }
  // x labels
  const spanDays = (x1 - x0) / 864e5;
  const xo = spanDays > 300 ? { month: 'short', year: '2-digit' } : { month: 'short', day: 'numeric' };
  const nLab = Math.max(2, Math.min(5, Math.floor(W / 110)));
  for (let i = 0; i < nLab; i++) {
    const t = x0 + (x1 - x0) * i / (nLab - 1);
    s += `<text x="${X(t)}" y="${H - 6}" text-anchor="${i === 0 ? 'start' : i === nLab - 1 ? 'end' : 'middle'}">${esc(new Date(t).toLocaleDateString(undefined, xo))}</text>`;
  }
  const P = pts.map((p, i) => [X(xs[i]), Y(p.y)]);
  if (P.length > 1) {
    const d = P.map((q, i) => (i ? 'L' : 'M') + q[0].toFixed(1) + ' ' + q[1].toFixed(1)).join('');
    const gid = 'g' + Math.random().toString(36).slice(2, 8);
    s += `<defs><linearGradient id="${gid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${col}" stop-opacity=".18"/><stop offset="1" stop-color="${col}" stop-opacity="0"/></linearGradient></defs>`;
    s += `<path d="${d}L${P[P.length - 1][0].toFixed(1)} ${H - pb}L${P[0][0].toFixed(1)} ${H - pb}Z" fill="url(#${gid})"/>`;
    s += `<path d="${d}" fill="none" stroke="${col}" stroke-width="2.25" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  P.forEach((q, i) => {
    const last = i === P.length - 1;
    s += `<circle cx="${q[0]}" cy="${q[1]}" r="${last ? 4.5 : 3.5}" fill="${last ? col : 'var(--surface)'}" stroke="${col}" stroke-width="2"/>`;
    s += `<circle class="hit" cx="${q[0]}" cy="${q[1]}" r="13" data-tip="${esc(pts[i].tip || '')}"/>`;
  });
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
