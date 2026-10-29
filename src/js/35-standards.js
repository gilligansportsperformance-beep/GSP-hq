/* =========================================================
   GSP high-school force-plate standards: the coach's own chart for boys and girls, ages 14–18.
   Four levels (Poor, Average, Good, Elite). A result reaches a level at the number where the
   chart starts that level; a result in a gap between two levels counts as the lower level.
   Results are graded as they are shown (rounded to the displayed decimals).
   Relative IMTP forces are force above body weight ÷ body weight: the chart's numbers only fit
   that reading (force at 100 ms can't be below 1 × body weight while standing on the plate).
   IMTP peak force in newtons is graded as total force (body weight included): only then do the
   chart's newton and relative numbers agree for high-school body masses.
   These are coaching standards, not published percentile norms (those stay in 89s-pct.js).
   ========================================================= */
Object.assign(REFS, {
  ovrMetrics: { short: 'OVR metrics guide', cite: 'OVR Performance. OVR Force metrics (product documentation). ovrperformance.com/pages/ovr-force-metrics. Accessed 2026.', what: 'Vendor documentation: Net Peak Force is the force above body weight (OVR’s main IMTP number); Gross Peak Force includes body weight and is the one used for DSI. Jump height comes from take-off velocity.' },
  ovrDsi: { short: 'OVR DSI guide', cite: 'OVR Performance. How to test and calculate Dynamic Strength Index (DSI). ovrperformance.com/blogs/news/how-to-test-dynamic-strength-index. Accessed 2026.', what: 'Vendor guidance: calculate DSI as gross ÷ gross peak force; above 0.80, bias maximal strength.' },
  ovrCmjNorms: { short: 'OVR CMJ norms', cite: 'OVR Performance. CMJ norms by age, sport and competition level. ovrperformance.com/blogs/news/cmj-norms-by-age-sport-level. Accessed 2026.', what: 'Vendor reference ranges, hands-on-hips CMJ: high-school boys average 17.0–19.2 in (elite 22.4+), girls average 12.8–14.9 in (elite 18.1+).' },
  sole2018rsi: { cite: 'Sole CJ, Suchomel TJ, Stone MH. Preliminary scale of reference values for evaluating reactive strength index-modified in male and female NCAA Division I athletes. Sports. 2018;6(4):133.', what: 'RSImod scales from 151 Division I athletes: 0.21–0.70 (men) and 0.14–0.55 (women). Time to takeoff did not differ between performance groups; jump height drove the differences.' },
  witte2024: { cite: 'Witte BC, Schouten TC, Westphal JA, et al. The modified reactive strength index is a valid measure of lower-body explosiveness in male and female high school athletes. J Strength Cond Res. 2024;38(8):1428–1432.', what: 'mRSI is a valid measure of explosiveness in high-school athletes (132 boys, 43 girls); no normative table.' },
  badby2025: { cite: 'Badby AJ et al. Normative data and objective benchmarks for selected force plate tests for professional and youth soccer players in the English Football League. J Sports Sci. 2025;43(20):2306–2323.', what: 'Youth players (17 ± 1 years): IMTP peak force 2,441 ± 452 N and 34.0 ± 4.7 N/kg; professionals 3,031 ± 549 N and 37.4 ± 5.4 N/kg.' },
  keogh2020: { cite: 'Keogh C et al. Intra-trial reliability and usefulness of isometric mid-thigh pull testing on portable force plates. J Hum Kinet. 2020;71.', what: 'On portable plates, peak force, relative peak force and force at 150–250 ms were reliable; impulse and RFD were unreliable at every time point.' },
  hewett1996: { cite: 'Hewett TE, Stroupe AL, Nance TA, Noyes FR. Plyometric training in female athletes: decreased impact forces and increased hamstring torques. Am J Sports Med. 1996;24(6):765–773.', what: 'Jump-landing training in high-school athletes cut peak landing force by 22% and knee adduction/abduction moments by about half.' },
  myer2005: { cite: 'Myer GD, Ford KR, Palumbo JP, Hewett TE. Neuromuscular training improves performance and lower-extremity biomechanics in female athletes. J Strength Cond Res. 2005;19(1):51–60.', what: 'Six weeks of plyometric, strength, balance and speed training improved jump height and reduced knee valgus and varus torques.' },
  lees2004: { cite: 'Lees A, Vanrenterghem J, De Clercq D. Understanding how an arm swing enhances performance in the vertical jump. J Biomech. 2004;37(12):1929–1940.', what: 'An arm swing added about 8.6 cm of jump height in adult men, mostly through higher take-off velocity.' },
  harman1990: { cite: 'Harman EA, Rosenstein MT, Frykman PN, Rosenstein RM. The effects of arms and countermovement on vertical jumping. Med Sci Sports Exerc. 1990;22(6):825–833.', what: 'Arm swing raised jump height more than the countermovement did.' },
  lloyd2014: { cite: 'Lloyd RS, Faigenbaum AD, Stone MH, et al. Position statement on youth resistance training: the 2014 International Consensus. Br J Sports Med. 2014;48(7):498–505.', what: 'Resistance training is safe and effective for young athletes when it is supervised by qualified coaches and progressed with technique first.' },
});
const STD_AGES = [14, 18];
const STD_LV = [['poor', 'Poor'], ['avg', 'Average'], ['good', 'Good'], ['elite', 'Elite']];
const TGT_LV = [['below', 'Below target'], ['in', 'In target'], ['above', 'Above target']];
const GRAV = 9.81;
/* Bands [Poor, Average, Good, Elite] exactly as printed, in the chart's unit: [low, high], null = open end.
   dec = decimals the chart prints; vdec = decimals the athlete's result is shown and graded at. */
const HS_STD = [
  { key: 'dlPlfRel', test: 'Drop landing', ev: 'No published high-school table was found to check these numbers. Lowering landing force through jump-landing training is well supported.', refs: ['hewett1996', 'myer2005'],  label: 'Peak landing force (relative)', unit: '× BW', dir: -1, dec: 1, vdec: 2,
    M: [[4.5, null], [3.5, 4.5], [2.5, 3.4], [null, 2.5]], F: [[4.0, null], [3.0, 4.0], [2.2, 2.9], [null, 2.2]], note: 'Landing from a 30–45 cm box (boys) or a 30 cm box (girls).' },
  { key: 'dlTts', test: 'Drop landing', ev: 'No published high-school table was found to check these numbers; compare athletes tested the same way.', refs: [],  label: 'Time to stabilisation', unit: 's', dir: -1, dec: 2, vdec: 2,
    M: [[1.20, null], [0.90, 1.19], [0.60, 0.89], [null, 0.60]], F: [[1.35, null], [1.05, 1.34], [0.75, 1.04], [null, 0.75]] },
  { key: 'cmj', test: 'Countermovement jump', ev: 'Close to OVR’s high-school CMJ norms (boys average 17.0–19.2 in, elite 22.4+; girls average 12.8–14.9 in, elite 18.1+). Your Average starts a little lower. OVR measures jump height from take-off velocity.', refs: ['ovrCmjNorms', 'ovrMetrics'],  label: 'Jump height', unit: 'in', len: true, dir: 1, dec: 0, vdec: 1,
    M: [[null, 14], [15, 18], [19, 22], [23, null]], F: [[null, 10], [11, 13], [14, 17], [18, null]], note: 'Hands on hips.' },
  { key: 'rsiMod', test: 'Countermovement jump', prov: true, ev: 'Provisional. mRSI is a valid measure in high-school athletes, but no high-school norm table was found. College (NCAA Division I) values run 0.21–0.70 for men and 0.14–0.55 for women. With OVR’s high-school jump heights, a typical athlete’s mRSI sits well above this chart’s Average, so most athletes grade Good or Elite. Use the GSP percentile and the athlete’s own trend.', refs: ['witte2024', 'sole2018rsi', 'ovrCmjNorms'],  label: 'mRSI', unit: '', dir: 1, dec: 2, vdec: 2,
    M: [[null, 0.20], [0.21, 0.30], [0.31, 0.45], [0.46, null]], F: [[null, 0.16], [0.17, 0.24], [0.25, 0.35], [0.36, null]] },
  { key: 'ttt', test: 'Countermovement jump', prov: true, ev: 'Provisional. In Division I athletes, time to takeoff did not differ between high and low mRSI groups; jump height drove the difference. This chart’s Good (0.65 s or less) and Elite (under 0.50 s) are faster than the data found supports. Track it against the athlete’s own normal: a slower takeoff at the same height is a fatigue sign.', refs: ['sole2018rsi', 'gathercole2015'],  label: 'Time to takeoff', unit: 's', dir: -1, dec: 2, vdec: 3,
    M: [[0.90, null], [0.70, 0.85], [0.55, 0.65], [null, 0.50]], F: [[0.95, null], [0.75, 0.90], [0.60, 0.70], [null, 0.55]] },
  { key: 'cmjRelPP', test: 'Countermovement jump', ev: 'No published high-school table was found to check these numbers.', refs: [],  label: 'Peak propulsive power', unit: 'W/kg', dir: 1, dec: 0, vdec: 1,
    M: [[null, 40], [41, 50], [51, 65], [66, null]], F: [[null, 34], [35, 44], [45, 54], [55, null]] },
  { key: 'brakeRfd', test: 'Countermovement jump', ev: 'Braking metrics depend on how the software finds each phase of the jump, so compare athletes on the same plate and software.', refs: ['mcmahon2018'],  label: 'Braking RFD', unit: 'N/s', dir: 1, dec: 0, vdec: 0,
    M: [[null, 4000], [5000, 9000], [10000, 14000], [15000, null]], F: [[null, 3000], [3500, 6500], [7000, 10000], [10500, null]] },
  { key: 'sj', test: 'Squat jump', ev: 'No published high-school table was found to check these numbers.', refs: [],  label: 'Jump height', unit: 'in', len: true, dir: 1, dec: 0, vdec: 1,
    M: [[null, 12], [13, 16], [17, 20], [21, null]], F: [[null, 8], [9, 11], [12, 14], [15, null]], note: 'No countermovement.' },
  { key: 'vj', test: 'Abalakov jump', ev: 'An arm swing normally adds height (about 8.6 cm in adult men), so these numbers sit above the CMJ’s.', refs: ['lees2004', 'harman1990'],  label: 'Jump height (arm swing)', unit: 'in', len: true, dir: 1, dec: 0, vdec: 1,
    M: [[null, 17], [18, 22], [23, 26], [27, null]], F: [[null, 12], [13, 16], [17, 20], [21, null]], note: 'CMJ with a free arm swing, on the plate. A Vertec or jump-and-reach vertical isn’t comparable.' },
  { key: 'imtpPF', test: 'Isometric mid-thigh pull', gross: true, ev: 'Graded as total force (body weight included, OVR’s Gross Peak Force). Only then do this chart’s newton and relative numbers agree: Good for boys starts at 2,300 N and at 2.3 × BW above body weight, which match for a 71 kg athlete (girls: 54 kg); read as net force they would only match at 102 kg (girls: 82 kg). If you type Net Peak Force, the app adds body weight. Fits youth data: English Football League youth players (17 ± 1 years) averaged 2,441 ± 452 N total, Good for boys here. Peak force is the most reliable IMTP number.', refs: ['badby2025', 'keogh2020', 'ovrMetrics'],  label: 'Peak force (total)', unit: 'N', dir: 1, dec: 0, vdec: 0,
    M: [[null, 1300], [1500, 2200], [2300, 3200], [3300, null]], F: [[null, 900], [1000, 1500], [1600, 2200], [2300, null]] },
  { key: 'imtpRel', test: 'Isometric mid-thigh pull', ev: 'Fits youth data: 34.0 ± 4.7 N/kg in youth soccer players, about 2.5 × BW above body weight, which is Good for boys here. OVR’s relative × BW is net force ÷ body weight.', refs: ['badby2025', 'ovrMetrics'],  label: 'Relative peak force', unit: '× BW', net: true, val: v => v / GRAV - 1, dir: 1, dec: 1, vdec: 2,
    M: [[null, 1.5], [1.6, 2.2], [2.3, 3.1], [3.2, null]], F: [[null, 1.2], [1.3, 1.9], [2.0, 2.6], [2.7, null]] },
  { key: 'imtpF100Rel', test: 'Isometric mid-thigh pull', ev: 'Early force is less repeatable than peak force; force at 150–250 ms was reliable on portable plates.', refs: ['keogh2020'],  label: 'Force at 100 ms (relative)', unit: '× BW', net: true, dir: 1, dec: 1, vdec: 2,
    M: [[null, 0.6], [0.7, 1.1], [1.2, 1.6], [1.7, null]], F: [[null, 0.4], [0.5, 0.8], [0.9, 1.3], [1.4, null]] },
  { key: 'imtpF200Rel', test: 'Isometric mid-thigh pull', ev: 'Force at 200 ms was reliable on portable force plates.', refs: ['keogh2020'],  label: 'Force at 200 ms (relative)', unit: '× BW', net: true, dir: 1, dec: 1, vdec: 2,
    M: [[null, 1.0], [1.1, 1.7], [1.8, 2.4], [2.5, null]], F: [[null, 0.8], [0.9, 1.3], [1.4, 1.9], [2.0, null]] },
  { key: 'imtpImp', test: 'Isometric mid-thigh pull', lowRel: true, ev: 'Low reliability: impulse was unreliable at every time point on portable force plates. Use it as a trend, not to grade.', refs: ['keogh2020'],  label: 'Net impulse (0–200 ms)', unit: 'N·s', dir: 1, dec: 0, vdec: 0,
    M: [[null, 150], [150, 250], [260, 400], [401, null]], F: [[null, 100], [100, 170], [180, 280], [281, null]] },
  { key: 'imtpRfd', test: 'Isometric mid-thigh pull', lowRel: true, ev: 'Low reliability: RFD was unreliable at every time point on portable force plates. Use it as a trend, not to grade.', refs: ['keogh2020'],  label: 'Peak RFD', unit: 'N/s', dir: 1, dec: 0, vdec: 0,
    M: [[null, 8000], [8500, 14000], [15000, 22000], [23000, null]], F: [[null, 5500], [6000, 9500], [10000, 15000], [15500, null]] },
];
/* Cross-test targets from the same chart (no boy/girl split) */
const HS_TARGETS = [
  { key: 'eur', test: 'CMJ ÷ squat jump', ev: 'CMJ ÷ squat jump ratios above 1.0 are typical in stretch-shortening sports, and the ratio changes with training phase.', refs: ['mcguigan2006'],  label: 'Eccentric utilisation ratio', unit: '', target: true, lo: 1.05, hi: 1.15, dec: 2, vdec: 2,
    low: 'Below 1.05: not using the elastic recoil of the countermovement; jumping mainly on muscular strength.' },
  { key: 'armSwing', test: 'Abalakov vs CMJ', ev: 'Arm swing adds jump height mainly through a faster take-off; 10–15% is at the lower end of the gains reported.', refs: ['lees2004', 'harman1990'],  label: 'Arm swing gain', unit: '%', target: true, lo: 10, hi: 15, dec: 0, vdec: 0,
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
function stdEval(a, key, v, date, bm) {
  const s = STD_BY[key];
  if (!s || v == null || !Number.isFinite(v)) return null;
  const age = ageAt(a?.dob, date), inAge = age != null && age >= STD_AGES[0] && age <= STD_AGES[1];
  // graded as total force: a net value (OVR Force mode) needs the test's body weight added
  if (s.gross && imtpBasis() === 'net') { if (!(bm > 0)) return { s, v, need: 'bm', age, inAge }; v += bm * GRAV; }
  const x = stdX(s, v);
  if (s.target) return { s, v, x, lv: tgtLevel(s, x), target: true, age, inAge: true };
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
/* A name that is unique across tests, for lists ("CMJ jump height", "SJ jump height") */
const STD_TEST_SHORT = { 'Countermovement jump': 'CMJ', 'Squat jump': 'SJ', 'Abalakov jump': 'Abalakov', 'Isometric mid-thigh pull': 'IMTP' };
function stdName(s) { const t = STD_TEST_SHORT[s.test]; return t ? `${t} ${s.label[0].toLowerCase()}${s.label.slice(1)}` : s.label; }
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
/* Provisional (chart numbers don't fit the published data) and low-reliability metrics are tagged, never hidden */
function stdTag(s) {
  return s.prov ? `<span class="std-tag" title="${esc(s.ev || '')}">Provisional</span>` : s.lowRel ? `<span class="std-tag" title="${esc(s.ev || '')}">Low reliability</span>` : '';
}
/* Up or down a level since the previous result */
function stdChange(r, prev) {
  if (!prev || prev.need || prev.lv === r.lv) return '';
  const up = prev.lv < r.lv, was = stdLvName(prev);
  return `<span class="std-ch ${up ? 'up' : 'down'}">${up ? '▲ up' : '▼ down'} from ${esc(was)}</span>`;
}
function stdRowHtml(r, { name = true, date = null, prev = null } = {}) {
  return `<div class="std-row${r.s.prov || r.s.lowRel ? ' soft' : ''}">
    <div class="std-top">${name ? `<span class="std-name">${esc(r.s.label)} ${stdTag(r.s)}</span>` : stdTag(r.s)}<span class="std-val">${esc(stdVal(r))} ${stdBadge(r)}</span></div>
    ${stdMeter(r)}
    <div class="std-sub">${stdChange(r, prev)}${esc(stdNext(r))}${!r.target && r.s.dir === -1 ? ' · lower is better' : ''}${date ? ` · ${esc(fmtDate(date))}` : ''}${r.inAge ? '' : ' · <b>reference only</b>'}</div>
    ${r.s.prov || r.s.lowRel ? `<div class="std-ev">${esc(r.s.ev)} ${refLinks(r.s.refs)}</div>` : ''}
  </div>`;
}
/* The latest graded result of one standard for an athlete, with the one before it */
function stdLatest(a, key) {
  const ser = metricSeries(a.id, key);
  if (!ser.length) return null;
  const p = ser[ser.length - 1], q = ser[ser.length - 2];
  const r = stdEval(a, key, p.v, p.date, p.bm);
  if (!r) return null;
  return { ...r, date: p.date, prev: q ? stdEval(a, key, q.v, q.date, q.bm) : null };
}
/* Graded = counts toward levels and training priorities: in the age range, sex known, not provisional or low reliability */
const stdGraded = r => !!(r && !r.need && r.inAge && !r.s.prov && !r.s.lowRel);

/* ---------- Which IMTP force the coach types (OVR shows both) ---------- */
function athHasImtp(a) { return testsFor(a.id).some(t => ['imtpPF', 'imtpF100', 'imtpF200'].some(k => t.m?.[k] != null)); }
function imtpBasisPrompt() {
  if (S.settings.imtpBasis) return '';
  return `<div class="banner warn std-basis" style="margin:0 0 12px">${icon('alert')}<div class="grow"><b>Which IMTP force do you type in?</b> OVR Force shows <b>Net Peak Force</b> (above body weight) in Force mode and <b>Gross Peak Force</b> (total) in Free mode. It decides DSI and the IMTP levels. Until you choose, the app reads them as gross.
    <div class="chips" style="margin-top:8px"><button type="button" class="btn sm primary" data-act="setImtpBasis" data-v="net">Net (Force mode)</button><button type="button" class="btn sm" data-act="setImtpBasis" data-v="gross">Gross (total)</button></div></div></div>`;
}
function imtpBasisNote() {
  if (!S.settings.imtpBasis) return imtpBasisPrompt();
  return `<p class="hint" style="margin:0 0 8px">Enter OVR’s <b>${S.settings.imtpBasis === 'net' ? 'Net' : 'Gross'} Peak Force</b> and forces at 100/200 ms ${S.settings.imtpBasis === 'net' ? '(above body weight)' : '(total, including body weight)'} · <a href="#/settings">change</a></p>`;
}
A.setImtpBasis = el => {
  S.settings.imtpBasis = el.dataset.v === 'net' ? 'net' : 'gross';
  persist();
  toast(`IMTP forces read as ${S.settings.imtpBasis === 'net' ? 'net (above body weight)' : 'gross (total)'}`);
  if (modalStack.length) { const b = el.closest('.std-basis'); if (b) b.outerHTML = imtpBasisNote(); } else refresh();
};

/* ---------- Athlete card (Overview) and inline meter (Testing tab) ---------- */
function athStdCard(a) {
  const sex = a.sex === 'M' || a.sex === 'F' ? a.sex : null;
  const groups = new Map(), needBm = [], counts = [0, 0, 0, 0], ups = [];
  let needSex = 0, out = null;
  [...HS_STD, ...HS_TARGETS].forEach(s => {
    const r = stdLatest(a, s.key);
    if (!r) { const b = STD_BASE[s.key]; if (b && metricSeries(a.id, b).length) needBm.push(s.label); return; }
    if (r.need === 'bm') { needBm.push(s.label); return; }
    if (r.need) { needSex++; return; }
    if (!r.inAge) out = r.age;
    if (stdGraded(r) && !r.target) counts[r.lv]++;
    if (stdGraded(r) && !r.target && r.prev && !r.prev.need && r.prev.lv < r.lv) ups.push(stdName(s));
    if (!groups.has(s.test)) groups.set(s.test, []);
    groups.get(s.test).push(stdRowHtml(r, { date: r.date, prev: r.prev }));
  });
  if (!groups.size && !needSex && !needBm.length) return '';
  const rows = [...groups.values()].reduce((n, g) => n + g.length, 0);
  const graded = counts.reduce((x, y) => x + y, 0);
  return `<div class="card std-card"><div class="card-head"><h3>High-school standards</h3><span class="sub">${sex ? `${esc(SEX_WORD[sex])} · ages 14–18` : 'ages 14–18'}</span></div>
    ${graded ? `<div class="std-sum">${STD_LV.map(([k, l], i) => counts[i] ? `<span class="std-lv lv-${k}">${counts[i]} ${l}</span>` : '').reverse().join('')}</div>` : ''}
    ${ups.length ? `<div class="std-ups">${icon('trend', 'sm')}<span>Up a level since the last test: <b>${esc(ups.join(', '))}</b></span></div>` : ''}
    ${athHasImtp(a) ? imtpBasisPrompt() : ''}
    ${needSex ? `<div class="banner info" style="margin:0 0 12px">${icon('info')}<div class="grow">Set ${esc(a.firstName)}’s sex to <b>Male</b> or <b>Female</b> to compare ${plural(needSex, 'result')} with the boys’ or girls’ standards.</div><button class="btn sm" data-act="editAthlete" data-id="${a.id}">Edit</button></div>` : ''}
    ${out != null ? `<div class="banner warn" style="margin:0 0 12px">${icon('info')}<div class="grow">These standards are for ages 14–18. ${esc(a.firstName)} was ${out} at the latest test, so treat the levels as a reference only.</div></div>` : ''}
    ${[...groups.entries()].map(([t, list]) => `<div class="kicker std-test">${esc(t)}</div>${list.join('')}`).join('')}
    ${needBm.length ? `<p class="faint small" style="margin:10px 0 0">Add body mass to the test to grade: ${esc(needBm.join(', '))}.</p>` : ''}
    <p class="faint tiny" style="margin:10px 0 0">GSP standards (your chart). ${rows ? 'Latest result for each metric. ' : ''}A level counts once the result reaches the number where the chart starts it. IMTP peak force is graded as total force; relative IMTP force = force above body weight ÷ body weight. <a href="#/fpai/standards">See the full chart</a>.</p></div>`;
}
function stdInlineHtml(a, key, p) {
  const r = stdEval(a, key, p.v, p.date, p.bm);
  if (!r) return '';
  if (r.need === 'bm') return `<div class="std-inline faint tiny">High-school standard: add body mass to this test to grade total force (net + body weight).</div>`;
  if (r.need) return `<div class="std-inline faint tiny">High-school standard: set ${esc(a.firstName)}’s sex to compare.</div>`;
  return `<div class="std-inline"><div class="kicker">HS standard${r.target ? '' : ` · ${esc(SEX_WORD[r.sex])}`}</div>${stdRowHtml(r, { name: false })}</div>`;
}

/* ---------- Progress report: the latest graded result of each standard up to the report's end date.
   Provisional and low-reliability standards are left out of reports for parents. ---------- */
function stdReportRows(a, to = today()) {
  return [...HS_STD, ...HS_TARGETS].map(s => {
    if (s.prov || s.lowRel) return null;
    const ser = metricSeries(a.id, s.key).filter(p => p.date <= to), p = ser[ser.length - 1];
    const r = p ? stdEval(a, s.key, p.v, p.date, p.bm) : null;
    return r && !r.need ? { ...r, date: p.date } : null;
  }).filter(Boolean);
}
function stdReportHtml(a, to = today()) {
  const rows = stdReportRows(a, to);
  if (!rows.length) return '';
  const bar = r => { const lv = r.target ? TGT_LV : STD_LV; return `<span class="r-lvbar lv-${stdLvKey(r)}${r.target ? ' three' : ''}">${lv.map((x, i) => `<i class="${r.target ? (i === r.lv ? 'on' : '') : i <= r.lv ? 'on' : ''}"></i>`).join('')}</span>`; };
  const sex = SEX_WORD[a.sex] || 'athletes', ref = rows.some(r => !r.inAge);
  return `<table class="r-table r-std"><thead><tr><th>Test</th><th>Result</th><th>Level</th><th></th></tr></thead><tbody>
    ${rows.map(r => `<tr><td>${esc(r.s.label)}<div class="r-sub">${esc(r.s.test)}</div></td><td class="r-nw"><b>${esc(stdVal(r))}</b></td><td><span class="r-pill lv-${stdLvKey(r)}">${esc(stdLvName(r))}</span></td><td>${bar(r)}</td></tr>`).join('')}
    </tbody></table><p class="r-note">${esc(bizName())} high-school standards for ${esc(sex)} aged 14–18: Poor, Average, Good, Elite. ${ref ? 'Outside ages 14–18 the levels are a reference only. ' : ''}Latest result for each test up to ${esc(fmtDateFull(to))}.</p>`;
}

/* ---------- The full chart (Force Plate AI → Standards, and the percentile page) ---------- */
function stdTableHtml(list = HS_STD) {
  return `<div class="std-grid">${list.map(s => `<div class="std-m"><div class="std-m-h"><b>${esc(s.label)}</b><span class="faint tiny">${esc([s.test, stdUnit(s) + (s.net ? ' above body weight' : s.gross ? ' total (body weight included)' : ''), s.dir === -1 ? 'lower is better' : ''].filter(x => x && x.trim()).join(' · '))}</span></div>
    <table class="std-mt"><thead><tr><th></th><th>Boys</th><th>Girls</th></tr></thead><tbody>
    ${STD_LV.map(([k, l], i) => `<tr><td><span class="std-lv lv-${k}">${l}</span></td><td>${esc(stdRange(s, s.M[i], false))}</td><td>${esc(stdRange(s, s.F[i], false))}</td></tr>`).join('')}
    </tbody></table>${s.note ? `<div class="faint tiny" style="margin-top:6px">${esc(s.note)}</div>` : ''}
    ${s.ev ? `<div class="std-ev">${stdTag(s)} ${esc(s.ev)} ${refLinks(s.refs)}</div>` : ''}</div>`).join('')}</div>`;
}
function stdTargetsHtml(list = HS_TARGETS) {
  return list.map(s => `<div class="std-tgt"><b>${esc(s.label)}</b> <span class="faint">(${esc(s.test)})</span>: target <b>${esc(stdNum(s, s.lo))}–${esc(stdNum(s, s.hi))}${s.unit === '%' ? '%' : ''}</b>. ${esc(s.low)}${s.ev ? `<div class="std-ev">${esc(s.ev)} ${refLinks(s.refs)}</div>` : ''}</div>`).join('');
}
/* Plain text for the AI */
function stdPromptText() {
  const line = s => `- ${s.test} · ${s.label}${s.net ? ' (force above body weight ÷ body weight)' : s.gross ? ' (total force including body weight; net + body weight)' : ''}${s.prov ? ' [PROVISIONAL: these bands don’t fit published data; prefer the athlete’s trend and GSP percentile]' : s.lowRel ? ' [LOW RELIABILITY on portable plates: use as a trend only]' : ''}: boys ${s.M.map((b, i) => `${STD_LV[i][1]} ${stdRangeRaw(s, b)}`).join(', ')}; girls ${s.F.map((b, i) => `${STD_LV[i][1]} ${stdRangeRaw(s, b)}`).join(', ')}`;
  return `${HS_STD.map(line).join('\n')}\n${HS_TARGETS.map(s => `- ${s.label} (${s.test}): target ${s.lo}–${s.hi}${s.unit === '%' ? '%' : ''}. ${s.low}`).join('\n')}`;
}
function stdRangeRaw(s, b) { const [lo, hi] = b, f = x => fmtNum(x, s.dec); return (lo == null ? `<${f(hi)}` : hi == null ? (s.dir === -1 ? `>${f(lo)}` : `${f(lo)}+`) : `${f(lo)}–${f(hi)}`) + (s.unit ? ' ' + s.unit : ''); }
/* One line per graded metric, for the AI's athlete context */
function athStdSummary(a) {
  return [...HS_STD, ...HS_TARGETS].map(s => {
    const ser = metricSeries(a.id, s.key);
    if (!ser.length) return null;
    const p = ser[ser.length - 1], r = stdEval(a, s.key, p.v, p.date, p.bm);
    return r && !r.need ? `${s.test} ${s.label} ${stdVal(r)}: ${stdLvName(r)}${r.inAge ? '' : ' (outside 14–18, reference only)'}` : null;
  }).filter(Boolean);
}
