/* =========================================================
   GSP high-school force-plate standards: the coach's own chart for boys and girls, ages 14–18.
   Four levels (Poor, Average, Good, Elite). A result reaches a level at the number where the
   chart starts that level; a result in a gap between two levels counts as the lower level.
   Results are graded as they are shown (rounded to the displayed decimals).
   Relative IMTP forces are force above body weight ÷ body weight: the chart's numbers only fit
   that reading (force at 100 ms can't be below 1 × body weight while standing on the plate).
   These are coaching standards, not published percentile norms (those stay in 89s-pct.js).
   ========================================================= */
const STD_AGES = [14, 18];
const STD_LV = [['poor', 'Poor'], ['avg', 'Average'], ['good', 'Good'], ['elite', 'Elite']];
const TGT_LV = [['below', 'Below target'], ['in', 'In target'], ['above', 'Above target']];
const GRAV = 9.81;
/* Bands [Poor, Average, Good, Elite] exactly as printed, in the chart's unit: [low, high], null = open end.
   dec = decimals the chart prints; vdec = decimals the athlete's result is shown and graded at. */
const HS_STD = [
  { key: 'dlPlfRel', test: 'Drop landing', label: 'Peak landing force (relative)', unit: '× BW', dir: -1, dec: 1, vdec: 2,
    M: [[4.5, null], [3.5, 4.5], [2.5, 3.4], [null, 2.5]], F: [[4.0, null], [3.0, 4.0], [2.2, 2.9], [null, 2.2]], note: 'Landing from a 30–45 cm box (boys) or a 30 cm box (girls).' },
  { key: 'dlTts', test: 'Drop landing', label: 'Time to stabilisation', unit: 's', dir: -1, dec: 2, vdec: 2,
    M: [[1.20, null], [0.90, 1.19], [0.60, 0.89], [null, 0.60]], F: [[1.35, null], [1.05, 1.34], [0.75, 1.04], [null, 0.75]] },
  { key: 'cmj', test: 'Countermovement jump', label: 'Jump height', unit: 'in', len: true, dir: 1, dec: 0, vdec: 1,
    M: [[null, 14], [15, 18], [19, 22], [23, null]], F: [[null, 10], [11, 13], [14, 17], [18, null]], note: 'Hands on hips.' },
  { key: 'rsiMod', test: 'Countermovement jump', label: 'mRSI', unit: '', dir: 1, dec: 2, vdec: 2,
    M: [[null, 0.20], [0.21, 0.30], [0.31, 0.45], [0.46, null]], F: [[null, 0.16], [0.17, 0.24], [0.25, 0.35], [0.36, null]] },
  { key: 'ttt', test: 'Countermovement jump', label: 'Time to takeoff', unit: 's', dir: -1, dec: 2, vdec: 3,
    M: [[0.90, null], [0.70, 0.85], [0.55, 0.65], [null, 0.50]], F: [[0.95, null], [0.75, 0.90], [0.60, 0.70], [null, 0.55]] },
  { key: 'cmjRelPP', test: 'Countermovement jump', label: 'Peak propulsive power', unit: 'W/kg', dir: 1, dec: 0, vdec: 1,
    M: [[null, 40], [41, 50], [51, 65], [66, null]], F: [[null, 34], [35, 44], [45, 54], [55, null]] },
  { key: 'brakeRfd', test: 'Countermovement jump', label: 'Braking RFD', unit: 'N/s', dir: 1, dec: 0, vdec: 0,
    M: [[null, 4000], [5000, 9000], [10000, 14000], [15000, null]], F: [[null, 3000], [3500, 6500], [7000, 10000], [10500, null]] },
  { key: 'sj', test: 'Squat jump', label: 'Jump height', unit: 'in', len: true, dir: 1, dec: 0, vdec: 1,
    M: [[null, 12], [13, 16], [17, 20], [21, null]], F: [[null, 8], [9, 11], [12, 14], [15, null]], note: 'No countermovement.' },
  { key: 'vj', test: 'Abalakov jump', label: 'Jump height (arm swing)', unit: 'in', len: true, dir: 1, dec: 0, vdec: 1,
    M: [[null, 17], [18, 22], [23, 26], [27, null]], F: [[null, 12], [13, 16], [17, 20], [21, null]], note: 'CMJ with a free arm swing, on the plate. A Vertec or jump-and-reach vertical isn’t comparable.' },
  { key: 'imtpPF', test: 'Isometric mid-thigh pull', label: 'Peak force', unit: 'N', dir: 1, dec: 0, vdec: 0,
    M: [[null, 1300], [1500, 2200], [2300, 3200], [3300, null]], F: [[null, 900], [1000, 1500], [1600, 2200], [2300, null]] },
  { key: 'imtpRel', test: 'Isometric mid-thigh pull', label: 'Relative peak force', unit: '× BW', net: true, val: v => v / GRAV - 1, dir: 1, dec: 1, vdec: 2,
    M: [[null, 1.5], [1.6, 2.2], [2.3, 3.1], [3.2, null]], F: [[null, 1.2], [1.3, 1.9], [2.0, 2.6], [2.7, null]] },
  { key: 'imtpF100Rel', test: 'Isometric mid-thigh pull', label: 'Force at 100 ms (relative)', unit: '× BW', net: true, dir: 1, dec: 1, vdec: 2,
    M: [[null, 0.6], [0.7, 1.1], [1.2, 1.6], [1.7, null]], F: [[null, 0.4], [0.5, 0.8], [0.9, 1.3], [1.4, null]] },
  { key: 'imtpF200Rel', test: 'Isometric mid-thigh pull', label: 'Force at 200 ms (relative)', unit: '× BW', net: true, dir: 1, dec: 1, vdec: 2,
    M: [[null, 1.0], [1.1, 1.7], [1.8, 2.4], [2.5, null]], F: [[null, 0.8], [0.9, 1.3], [1.4, 1.9], [2.0, null]] },
  { key: 'imtpImp', test: 'Isometric mid-thigh pull', label: 'Net impulse (0–200 ms)', unit: 'N·s', dir: 1, dec: 0, vdec: 0,
    M: [[null, 150], [150, 250], [260, 400], [401, null]], F: [[null, 100], [100, 170], [180, 280], [281, null]] },
  { key: 'imtpRfd', test: 'Isometric mid-thigh pull', label: 'Peak RFD', unit: 'N/s', dir: 1, dec: 0, vdec: 0,
    M: [[null, 8000], [8500, 14000], [15000, 22000], [23000, null]], F: [[null, 5500], [6000, 9500], [10000, 15000], [15500, null]] },
];
/* Cross-test targets from the same chart (no boy/girl split) */
const HS_TARGETS = [
  { key: 'eur', test: 'CMJ ÷ squat jump', label: 'Eccentric utilisation ratio', unit: '', target: true, lo: 1.05, hi: 1.15, dec: 2, vdec: 2,
    low: 'Below 1.05: not using the elastic recoil of the countermovement; jumping mainly on muscular strength.' },
  { key: 'armSwing', test: 'Abalakov vs CMJ', label: 'Arm swing gain', unit: '%', target: true, lo: 10, hi: 15, dec: 0, vdec: 0,
    low: 'Little or no gain from the arm swing points to a coordination problem or energy leaks through the trunk and upper body.' },
];
const STD_BY = Object.fromEntries([...HS_STD, ...HS_TARGETS].map(s => [s.key, s]));
/* Relative values need body mass on the test; these are the results they come from */
const STD_BASE = { cmjRelPP: 'cmjPP', imtpRel: 'imtpPF', imtpF100Rel: 'imtpF100', imtpF200Rel: 'imtpF200', dlPlfRel: 'dlPlf' };
const SEX_WORD = { M: 'boys', F: 'girls' };

/* A stored result → the chart's unit, rounded the way it's shown */
function stdX(s, v) {
  if (v == null || !Number.isFinite(v)) return null;
  return round(s.len ? v / 2.54 : s.val ? s.val(v) : v, s.vdec);
}
/* The numbers that start Average, Good and Elite (for lower-is-better: the highest result that still counts) */
function stdCuts(s, sex) { const b = s[sex]; return s.dir === 1 ? [b[1][0], b[2][0], b[3][0]] : [b[1][1], b[2][1], b[3][1]]; }
function stdLevel(s, sex, x) {
  const [a, g, e] = stdCuts(s, sex), at = (p, q) => Math.abs(p - q) < 1e-9;
  if (s.dir === 1) return x >= e || at(x, e) ? 3 : x >= g || at(x, g) ? 2 : x >= a || at(x, a) ? 1 : 0;
  // lower is better: Elite is "under" its number, the others include theirs
  return x < e && !at(x, e) ? 3 : x <= g || at(x, g) ? 2 : x <= a || at(x, a) ? 1 : 0;
}
function tgtLevel(s, x) { return x < s.lo - 1e-9 ? 0 : x > s.hi + 1e-9 ? 2 : 1; }
/* Grade one result for an athlete (sex and age at the test date) */
function stdEval(a, key, v, date) {
  const s = STD_BY[key];
  if (!s || v == null || !Number.isFinite(v)) return null;
  const x = stdX(s, v), age = ageAt(a?.dob, date);
  if (s.target) return { s, v, x, lv: tgtLevel(s, x), target: true, age, inAge: true };
  const inAge = age != null && age >= STD_AGES[0] && age <= STD_AGES[1];
  const sex = a?.sex === 'M' || a?.sex === 'F' ? a.sex : null;
  if (!sex) return { s, v, x, need: 'sex', age, inAge };
  return { s, v, x, sex, lv: stdLevel(s, sex, x), age, inAge };
}

/* ---------- Formatting ---------- */
const stdUnit = s => (s.len ? U.len() : s.unit);
/* a chart number (chart unit) in the coach's units */
function stdNum(s, x) { return s.len && !U.imp() ? fmtNum(x * 2.54, 0) : fmtNum(x, s.dec); }
function stdVal(r) {
  const s = r.s, u = stdUnit(s);
  const n = s.len ? (U.imp() ? fmtNum(r.x, 1) : fmtNum(r.v, 1)) : fmtNum(r.x, s.vdec);
  return `${n}${u ? (u === '%' ? '%' : ' ' + u) : ''}`;
}
function stdRange(s, b, unit = true) {
  const [lo, hi] = b, u = stdUnit(s), n = x => stdNum(s, x);
  const t = lo == null ? `< ${n(hi)}` : hi == null ? (s.dir === -1 ? `> ${n(lo)}` : `${n(lo)}+`) : `${n(lo)}–${n(hi)}`;
  return t + (unit && u ? ' ' + u : '');
}
const stdLvName = r => (r.target ? TGT_LV[r.lv][1] : STD_LV[r.lv][1]);
const stdLvKey = r => (r.target ? TGT_LV[r.lv][0] : STD_LV[r.lv][0]);
function stdBadge(r, short = false) {
  if (!r || r.need) return '<span class="faint">—</span>';
  return `<span class="std-lv lv-${stdLvKey(r)}${r.inAge ? '' : ' ref'}" title="${r.inAge ? '' : 'Standards are for ages 14–18: reference only'}">${esc(short && r.target ? (r.lv === 1 ? 'In target' : r.lv ? 'Above' : 'Below') : stdLvName(r))}</span>`;
}
/* What it takes to reach the next level */
function stdNext(r) {
  const s = r.s, u = stdUnit(s), su = u ? (u === '%' ? '%' : ' ' + u) : '';
  if (r.target) return `Target ${stdNum(s, s.lo)}–${stdNum(s, s.hi)}${su}`;
  if (r.lv >= 3) return 'Top level';
  const cut = stdCuts(s, r.sex)[r.lv];
  const gapIn = s.dir === 1 ? cut - r.x : r.x - cut;
  const gap = s.len && !U.imp() ? fmtNum(gapIn * 2.54, 1) : fmtNum(gapIn, s.vdec);
  const word = s.dir === 1 ? 'from' : r.lv === 2 ? 'under' : 'at';
  return `${STD_LV[r.lv + 1][1]} ${word} ${stdNum(s, cut)}${su}${s.dir === -1 && r.lv < 2 ? ' or less' : ''} · ${gapIn > 1e-9 ? `${gap}${su} to go` : 'almost there'}`;
}
/* Four (or three) coloured zones with a marker; the marker sits inside the athlete's zone */
function stdMeter(r) {
  const s = r.s;
  if (r.target) {
    const span = (s.hi - s.lo) * 2, edges = [[s.lo - span, s.lo], [s.lo, s.hi], [s.hi, s.hi + span]], [lo, hi] = edges[r.lv];
    const pos = (r.lv + clamp((r.x - lo) / (hi - lo || 1), 0.06, 0.94)) / 3 * 100;
    return `<div class="std-meter three" role="img" aria-label="${esc(stdLvName(r))}">${TGT_LV.map(([k], i) => `<span class="seg ${k}${i === r.lv ? ' on' : ''}"></span>`).join('')}<i style="left:${pos.toFixed(1)}%"></i></div>
      <div class="std-ticks"><span style="left:33.33%">${esc(stdNum(s, s.lo))}</span><span style="left:66.67%">${esc(stdNum(s, s.hi))}</span></div>`;
  }
  const cuts = stdCuts(s, r.sex), g = v => (s.dir === 1 ? v : -v), c = cuts.map(g);
  const edges = [[c[0] - (c[1] - c[0]), c[0]], [c[0], c[1]], [c[1], c[2]], [c[2], c[2] + (c[2] - c[1])]], [lo, hi] = edges[r.lv];
  const pos = (r.lv + clamp((g(r.x) - lo) / (hi - lo || 1), 0.06, 0.94)) * 25;
  return `<div class="std-meter" role="img" aria-label="${esc(stdLvName(r))}">${STD_LV.map(([k], i) => `<span class="seg ${k}${i === r.lv ? ' on' : ''}"></span>`).join('')}<i style="left:${pos.toFixed(1)}%"></i></div>
    <div class="std-ticks">${cuts.map((v, i) => `<span style="left:${(i + 1) * 25}%">${esc(stdNum(s, v))}</span>`).join('')}</div>`;
}
function stdRowHtml(r, { name = true, date = null } = {}) {
  return `<div class="std-row">
    <div class="std-top">${name ? `<span class="std-name">${esc(r.s.label)}</span>` : ''}<span class="std-val">${esc(stdVal(r))} ${stdBadge(r)}</span></div>
    ${stdMeter(r)}
    <div class="std-sub">${esc(stdNext(r))}${!r.target && r.s.dir === -1 ? ' · lower is better' : ''}${date ? ` · ${esc(fmtDate(date))}` : ''}${r.inAge ? '' : ' · <b>reference only</b>'}</div>
  </div>`;
}

/* ---------- Athlete card (Overview) and inline meter (Testing tab) ---------- */
function athStdCard(a) {
  const sex = a.sex === 'M' || a.sex === 'F' ? a.sex : null;
  const groups = new Map(), needBm = [];
  let needSex = 0, out = null;
  [...HS_STD, ...HS_TARGETS].forEach(s => {
    const ser = metricSeries(a.id, s.key);
    if (!ser.length) { const b = STD_BASE[s.key]; if (b && metricSeries(a.id, b).length) needBm.push(s.label); return; }
    const p = ser[ser.length - 1], r = stdEval(a, s.key, p.v, p.date);
    if (!r) return;
    if (r.need) { needSex++; return; }
    if (!r.inAge) out = r.age;
    if (!groups.has(s.test)) groups.set(s.test, []);
    groups.get(s.test).push(stdRowHtml(r, { date: p.date }));
  });
  if (!groups.size && !needSex && !needBm.length) return '';
  const rows = [...groups.values()].reduce((n, g) => n + g.length, 0);
  return `<div class="card std-card"><div class="card-head"><h3>High-school standards</h3><span class="sub">${sex ? `${esc(SEX_WORD[sex])} · ages 14–18` : 'ages 14–18'}</span></div>
    ${needSex ? `<div class="banner info" style="margin:0 0 12px">${icon('info')}<div class="grow">Set ${esc(a.firstName)}’s sex to <b>Male</b> or <b>Female</b> to compare ${plural(needSex, 'result')} with the boys’ or girls’ standards.</div><button class="btn sm" data-act="editAthlete" data-id="${a.id}">Edit</button></div>` : ''}
    ${out != null ? `<div class="banner warn" style="margin:0 0 12px">${icon('info')}<div class="grow">These standards are for ages 14–18. ${esc(a.firstName)} was ${out} at the latest test, so treat the levels as a reference only.</div></div>` : ''}
    ${[...groups.entries()].map(([t, list]) => `<div class="kicker std-test">${esc(t)}</div>${list.join('')}`).join('')}
    ${needBm.length ? `<p class="faint small" style="margin:10px 0 0">Add body mass to the test to grade: ${esc(needBm.join(', '))}.</p>` : ''}
    <p class="faint tiny" style="margin:10px 0 0">GSP standards (your chart). ${rows ? 'Latest result for each metric. ' : ''}A level counts once the result reaches the number where the chart starts it. Relative IMTP force = force above body weight ÷ body weight. <a href="#/fpai/standards">See the full chart</a>.</p></div>`;
}
function stdInlineHtml(a, key, p) {
  const r = stdEval(a, key, p.v, p.date);
  if (!r) return '';
  if (r.need) return `<div class="std-inline faint tiny">High-school standard: set ${esc(a.firstName)}’s sex to compare.</div>`;
  return `<div class="std-inline"><div class="kicker">HS standard${r.target ? '' : ` · ${esc(SEX_WORD[r.sex])}`}</div>${stdRowHtml(r, { name: false })}</div>`;
}

/* ---------- The full chart (Force Plate AI → Standards, and the percentile page) ---------- */
function stdTableHtml(list = HS_STD) {
  return `<div class="std-grid">${list.map(s => `<div class="std-m"><div class="std-m-h"><b>${esc(s.label)}</b><span class="faint tiny">${esc([s.test, stdUnit(s) + (s.net ? ' above body weight' : ''), s.dir === -1 ? 'lower is better' : ''].filter(x => x && x.trim()).join(' · '))}</span></div>
    <table class="std-mt"><thead><tr><th></th><th>Boys</th><th>Girls</th></tr></thead><tbody>
    ${STD_LV.map(([k, l], i) => `<tr><td><span class="std-lv lv-${k}">${l}</span></td><td>${esc(stdRange(s, s.M[i], false))}</td><td>${esc(stdRange(s, s.F[i], false))}</td></tr>`).join('')}
    </tbody></table>${s.note ? `<div class="faint tiny" style="margin-top:6px">${esc(s.note)}</div>` : ''}</div>`).join('')}</div>`;
}
function stdTargetsHtml(list = HS_TARGETS) {
  return list.map(s => `<div class="std-tgt"><b>${esc(s.label)}</b> <span class="faint">(${esc(s.test)})</span>: target <b>${esc(stdNum(s, s.lo))}–${esc(stdNum(s, s.hi))}${s.unit === '%' ? '%' : ''}</b>. ${esc(s.low)}</div>`).join('');
}
/* Plain text for the AI */
function stdPromptText() {
  const line = s => `- ${s.test} · ${s.label}${s.net ? ' (force above body weight ÷ body weight)' : ''}: boys ${s.M.map((b, i) => `${STD_LV[i][1]} ${stdRangeRaw(s, b)}`).join(', ')}; girls ${s.F.map((b, i) => `${STD_LV[i][1]} ${stdRangeRaw(s, b)}`).join(', ')}`;
  return `${HS_STD.map(line).join('\n')}\n${HS_TARGETS.map(s => `- ${s.label} (${s.test}): target ${s.lo}–${s.hi}${s.unit === '%' ? '%' : ''}. ${s.low}`).join('\n')}`;
}
function stdRangeRaw(s, b) { const [lo, hi] = b, f = x => fmtNum(x, s.dec); return (lo == null ? `<${f(hi)}` : hi == null ? (s.dir === -1 ? `>${f(lo)}` : `${f(lo)}+`) : `${f(lo)}–${f(hi)}`) + (s.unit ? ' ' + s.unit : ''); }
/* One line per graded metric, for the AI's athlete context */
function athStdSummary(a) {
  return [...HS_STD, ...HS_TARGETS].map(s => {
    const ser = metricSeries(a.id, s.key);
    if (!ser.length) return null;
    const p = ser[ser.length - 1], r = stdEval(a, s.key, p.v, p.date);
    return r && !r.need ? `${s.test} ${s.label} ${stdVal(r)}: ${stdLvName(r)}${r.inAge ? '' : ' (outside 14–18, reference only)'}` : null;
  }).filter(Boolean);
}
