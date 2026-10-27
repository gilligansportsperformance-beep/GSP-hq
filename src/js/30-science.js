/* =========================================================
   Sports science: metric definitions, trends, VBT maths,
   evidence-based insight rules and references
   ========================================================= */

/* ---------- References (all peer-reviewed / professional journals) ---------- */
const REFS = {
  hopkins2000: { cite: 'Hopkins WG. Measures of reliability in sports medicine and science. Sports Med. 2000;30(1):1–15.', what: 'Typical error and the smallest worthwhile change — basis for flagging changes larger than test noise.' },
  claudino2017: { cite: 'Claudino JG, Cronin J, Mezêncio B, et al. The countermovement jump to monitor neuromuscular status: a meta-analysis. J Sci Med Sport. 2017;20(4):397–402.', what: 'CMJ height is a sensitive marker of neuromuscular fatigue/readiness when tracked over time.' },
  sheppard2011: { cite: 'Sheppard JM, Chapman D, Taylor KL. An evaluation of a strength qualities assessment method for the lower body. J Aust Strength Cond. 2011;19(2):4–10.', what: 'Dynamic Strength Index (ballistic ÷ isometric peak force) and the <0.60 / >0.80 practitioner thresholds.' },
  comfort2018: { cite: 'Comfort P, Thomas C, Dos’Santos T, et al. Changes in dynamic strength index in response to strength training. Sports. 2018;6(4):176.', what: 'DSI changes with training; interpret alongside the absolute values of each test.' },
  suchomel2016: { cite: 'Suchomel TJ, Nimphius S, Stone MH. The importance of muscular strength in athletic performance. Sports Med. 2016;46(10):1419–1449.', what: 'Greater maximal strength underpins rate of force development, jumping, sprinting and change of direction.' },
  mcguigan2006: { cite: 'McGuigan MR, Doyle TLA, Newton M, et al. Eccentric utilization ratios: effect of sport and phase of training. J Strength Cond Res. 2006;20(4):992–995.', what: 'Eccentric utilisation ratio (CMJ ÷ SJ) as an index of stretch-shortening-cycle use; values typically ~1.0–1.2.' },
  flanagan2008: { cite: 'Flanagan EP, Comyns TM. The use of contact time and the reactive strength index to optimize fast stretch-shortening cycle training. Strength Cond J. 2008;30(5):32–38.', what: 'RSI and the ~250 ms contact-time boundary for fast stretch-shortening-cycle (reactive) training.' },
  ebben2010: { cite: 'Ebben WP, Petushek EJ. Using the reactive strength index modified to evaluate plyometric performance. J Strength Cond Res. 2010;24(8):1983–1987.', what: 'RSI-modified (jump height ÷ time to take-off) from the CMJ.' },
  bishop2018: { cite: 'Bishop C, Turner A, Read P. Effects of inter-limb asymmetries on physical and sports performance: a systematic review. J Sports Sci. 2018;36(10):1135–1144.', what: 'Asymmetries >10–15% may be detrimental to performance; asymmetry is task-specific and variable.' },
  haugen2016: { cite: 'Haugen T, Buchheit M. Sprint running performance monitoring: methodological and practical considerations. Sports Med. 2016;46(5):641–656.', what: 'Sprint testing standards, measurement error and interpreting acceleration vs. maximal-velocity phases.' },
  morin2016: { cite: 'Morin JB, Samozino P. Interpreting power-force-velocity profiles for individualized and specific training. Int J Sports Physiol Perform. 2016;11(2):267–272.', what: 'Individualising sprint/jump training to the athlete’s force–velocity deficits.' },
  gonzalez2010: { cite: 'González-Badillo JJ, Sánchez-Medina L. Movement velocity as a measure of loading intensity in resistance training. Int J Sports Med. 2010;31(5):347–352.', what: 'Near-linear relationship between mean velocity and %1RM; velocity can prescribe and monitor intensity.' },
  sanchez2011: { cite: 'Sánchez-Medina L, González-Badillo JJ. Velocity loss as an indicator of neuromuscular fatigue during resistance training. Med Sci Sports Exerc. 2011;43(9):1725–1734.', what: 'Velocity loss within a set reflects fatigue (strongly related to lactate and ammonia).' },
  pareja2017: { cite: 'Pareja-Blanco F, Rodríguez-Rosell D, Sánchez-Medina L, et al. Effects of velocity loss during resistance training on athletic performance, strength gains and muscle adaptations. Scand J Med Sci Sports. 2017;27(7):724–735.', what: '20% velocity loss gave similar strength gains to 40%, better jump gains and less fatigue; 40% gave more hypertrophy.' },
  weakley2021: { cite: 'Weakley J, Mann B, Banyard H, et al. Velocity-based training: from theory to application. Strength Cond J. 2021;43(2):31–49.', what: 'Practical VBT: load–velocity profiling, autoregulation, velocity-loss thresholds and feedback.' },
  mann2015: { cite: 'Mann JB, Ivey PA, Sayers SG. Velocity-based training in football. Strength Cond J. 2015;37(6):52–57.', what: 'Velocity zones (absolute strength → starting strength) used to target strength qualities.' },
  banyard2017: { cite: 'Banyard HG, Nosaka K, Haff GG. Reliability and validity of the load–velocity relationship to predict the 1RM back squat. J Strength Cond Res. 2017;31(7):1897–1904.', what: 'Load–velocity 1RM predictions can over-estimate; treat estimated 1RM as a guide, not a test.' },
  jidovtseff2011: { cite: 'Jidovtseff B, Harris NK, Crielaard JM, Cronin JB. Using the load-velocity relationship for 1RM prediction. J Strength Cond Res. 2011;25(1):267–270.', what: 'Linear load–velocity regression extrapolated to a minimal velocity threshold to estimate 1RM.' },
  foster2001: { cite: 'Foster C, Florhaug JA, Franklin J, et al. A new approach to monitoring exercise training. J Strength Cond Res. 2001;15(1):109–115.', what: 'Session-RPE (CR-10 × minutes) as a valid internal training-load measure.' },
  gabbett2016: { cite: 'Gabbett TJ. The training—injury prevention paradox: should athletes be training smarter and harder? Br J Sports Med. 2016;50(5):273–280.', what: 'Rapid spikes in training load relative to recent load are associated with higher injury risk.' },
  impellizzeri2020: { cite: 'Impellizzeri FM, Tenan MS, Kempton T, et al. Acute:chronic workload ratio: conceptual issues and fundamental pitfalls. Int J Sports Physiol Perform. 2020;15(6):907–913.', what: 'Limitations of the ACWR — use it as a prompt for conversation, not a predictor.' },
};
const REF_ORDER = Object.keys(REFS);
function refShort(k) {
  const c = REFS[k].cite;
  const au = c.split('. ')[0].split(', ').map(x => x.split(' ')[0]);
  const yr = (c.match(/\b(19|20)\d\d\b/) || [''])[0];
  return `${au.length === 1 ? au[0] : au.length === 2 ? au[0] + ' & ' + au[1] : au[0] + ' et al.'} ${yr}`;
}
function refLinks(keys) {
  if (!keys?.length) return '';
  return `<div class="in-refs">Evidence: ${keys.map(k => `<a href="#/references?r=${k}">${esc(refShort(k))}</a>`).join(' · ')}</div>`;
}

/* ---------- Test metrics ---------- */
const TEST_CATS = [
  { key: 'sprint', label: 'Sprint & speed', color: '#2f5bff' },
  { key: 'jump', label: 'Jumps', color: '#8b4ef3' },
  { key: 'rsi', label: 'Reactive strength (RSI)', color: '#0e9384' },
  { key: 'cmjfp', label: 'OVR Force · CMJ (Jump mode)', color: '#e0661b' },
  { key: 'iso', label: 'OVR Force · Isometric (Force mode)', color: '#c2410c' },
  { key: 'derived', label: 'Calculated', color: '#d92d7a' },
  { key: 'body', label: 'Body', color: '#7a8496' },
];
/* dir: 1 higher is better, -1 lower is better, 0 neutral/strategy. te: approx. test–retest typical error (CV %) */
const METRICS = [
  { key: 'sprint5', cat: 'sprint', label: '5 m sprint', unit: 's', dir: -1, dec: 2, te: 3 },
  { key: 'sprint10', cat: 'sprint', label: '10 m sprint', unit: 's', dir: -1, dec: 2, te: 2 },
  { key: 'sprint10yd', cat: 'sprint', label: '10 yd sprint', unit: 's', dir: -1, dec: 2, te: 2, hint: '0–10 yd acceleration' },
  { key: 'sprint20', cat: 'sprint', label: '20 m sprint', unit: 's', dir: -1, dec: 2, te: 1.5 },
  { key: 'sprint30', cat: 'sprint', label: '30 m sprint', unit: 's', dir: -1, dec: 2, te: 1.5 },
  { key: 'sprint40yd', cat: 'sprint', label: '40 yd dash', unit: 's', dir: -1, dec: 2, te: 1.5 },
  { key: 'fly10', cat: 'sprint', label: 'Flying 10 m', unit: 's', dir: -1, dec: 2, te: 2 },
  { key: 'fly10yd', cat: 'sprint', label: 'Flying 10 yd', unit: 's', dir: -1, dec: 2, te: 2, hint: 'e.g. 5 yd build-up + 10 yd fly' },
  { key: 'proAgility', cat: 'sprint', label: 'Pro agility (5-10-5)', unit: 's', dir: -1, dec: 2, te: 2 },
  { key: 'cod505', cat: 'sprint', label: '505 change of direction', unit: 's', dir: -1, dec: 2, te: 2.5 },
  { key: 'cmj', cat: 'jump', label: 'CMJ height', kind: 'len', dir: 1, dec: 1, te: 4, hint: 'From OVR Force jump height or another device' },
  { key: 'sj', cat: 'jump', label: 'Squat jump height', kind: 'len', dir: 1, dec: 1, te: 4 },
  { key: 'vj', cat: 'jump', label: 'Vertical jump (arm swing)', kind: 'len', dir: 1, dec: 1, te: 4 },
  { key: 'broad', cat: 'jump', label: 'Broad jump', kind: 'len', dir: 1, dec: 1, te: 3 },
  { key: 'dropBox', cat: 'rsi', label: 'Drop height (box)', kind: 'len', dir: 0, dec: 0, te: null, context: true },
  { key: 'djHeight', cat: 'rsi', label: 'Drop jump height', kind: 'len', dir: 1, dec: 1, te: 5 },
  { key: 'djGct', cat: 'rsi', label: 'Drop jump contact time', unit: 's', dir: -1, dec: 3, te: 5, hint: 'e.g. 0.210' },
  { key: 'djRsi', cat: 'rsi', label: 'Drop jump RSI', unit: '', dir: 1, dec: 2, te: 6, hint: 'Auto-calculated from height ÷ contact time if left blank' },
  { key: 'rsi105', cat: 'rsi', label: 'RSI hops (10/5)', unit: '', dir: 1, dec: 2, te: 6 },
  { key: 'rsiMod', cat: 'cmjfp', label: 'mRSI (RSI-modified)', unit: 'm/s', dir: 1, dec: 2, te: 6, hint: 'Auto-calculated from jump height ÷ time to takeoff if left blank' },
  { key: 'takeoffVel', cat: 'cmjfp', label: 'Takeoff velocity', unit: 'm/s', dir: 1, dec: 2, te: 2.5 },
  { key: 'ttt', cat: 'cmjfp', label: 'Time to takeoff', unit: 's', dir: -1, dec: 3, te: 5, hint: 'e.g. 0.780' },
  { key: 'cmDepth', cat: 'cmjfp', label: 'Countermovement depth', kind: 'len', dir: 0, dec: 1, te: 6 },
  { key: 'brakeTime', cat: 'cmjfp', label: 'Braking time', unit: 's', dir: -1, dec: 3, te: 8, hint: 'Braking (eccentric) phase duration' },
  { key: 'peakBrakeF', cat: 'cmjfp', label: 'Peak braking force', unit: 'N', dir: 1, dec: 0, te: 6 },
  { key: 'brakeRfd', cat: 'cmjfp', label: 'Braking RFD', unit: 'N/s', dir: 1, dec: 0, te: 12 },
  { key: 'brakeImp', cat: 'cmjfp', label: 'Braking impulse', unit: 'N·s', dir: 1, dec: 0, te: 6 },
  { key: 'propTime', cat: 'cmjfp', label: 'Propulsive time', unit: 's', dir: 0, dec: 3, te: 6 },
  { key: 'cmjPF', cat: 'cmjfp', label: 'Peak propulsive force', unit: 'N', dir: 1, dec: 0, te: 5 },
  { key: 'propImp', cat: 'cmjfp', label: 'Propulsive impulse', unit: 'N·s', dir: 1, dec: 0, te: 4 },
  { key: 'cmjPP', cat: 'cmjfp', label: 'Peak power', unit: 'W', dir: 1, dec: 0, te: 5 },
  { key: 'cmjRelPP', cat: 'cmjfp', label: 'Relative peak power', unit: 'W/kg', dir: 1, dec: 1, te: 5, hint: 'Auto-calculated from peak power ÷ body mass if blank' },
  { key: 'peakLandF', cat: 'cmjfp', label: 'Peak landing force', unit: 'N', dir: 0, dec: 0, te: 10, hint: 'If reported' },
  { key: 'brakeAsym', cat: 'cmjfp', label: 'Braking asymmetry', unit: '%', dir: -1, dec: 1, te: null, side: true, hint: 'Needs two plates' },
  { key: 'propAsym', cat: 'cmjfp', label: 'Propulsive asymmetry', unit: '%', dir: -1, dec: 1, te: null, side: true, hint: 'Needs two plates' },
  { key: 'landAsym', cat: 'cmjfp', label: 'Landing asymmetry', unit: '%', dir: -1, dec: 1, te: null, side: true, hint: 'If reported' },
  { key: 'imtpPF', cat: 'iso', label: 'Peak force', unit: 'N', dir: 1, dec: 0, te: 5 },
  { key: 'imtpRel', cat: 'iso', label: 'Relative peak force', unit: 'N/kg', dir: 1, dec: 1, te: 5, hint: 'Auto-calculated from peak force ÷ body mass if blank' },
  { key: 'imtpF100', cat: 'iso', label: 'Force at 100 ms', unit: 'N', dir: 1, dec: 0, te: 8 },
  { key: 'imtpRfd', cat: 'iso', label: 'RFD', unit: 'N/s', dir: 1, dec: 0, te: 12, hint: 'As reported (e.g. 0–200 ms)' },
  { key: 'imtpTtpf', cat: 'iso', label: 'Time to peak force', unit: 's', dir: -1, dec: 2, te: 15 },
  { key: 'imtpImp', cat: 'iso', label: 'Impulse', unit: 'N·s', dir: 1, dec: 0, te: 8 },
  { key: 'imtpAvgF', cat: 'iso', label: 'Average force', unit: 'N', dir: 1, dec: 0, te: 6 },
  { key: 'imtpAsym', cat: 'iso', label: 'Isometric asymmetry', unit: '%', dir: -1, dec: 1, te: null, side: true, hint: 'Needs two plates' },
  { key: 'asym', cat: 'iso', label: 'Other asymmetry', unit: '%', dir: -1, dec: 1, te: null, side: true, hint: 'Any other left/right test' },
  { key: 'relBrakeF', cat: 'derived', label: 'Relative peak braking force', unit: 'N/kg', dir: 1, dec: 1, te: 6, calc: true },
  { key: 'relPropF', cat: 'derived', label: 'Relative peak propulsive force', unit: 'N/kg', dir: 1, dec: 1, te: 5, calc: true },
  { key: 'f100Pct', cat: 'derived', label: 'Early force (F100 ÷ peak force)', unit: '%', dir: 1, dec: 0, te: 10, calc: true },
  { key: 'dsi', cat: 'derived', label: 'Dynamic strength index', unit: '', dir: 0, dec: 2, te: 7, calc: true },
  { key: 'eur', cat: 'derived', label: 'Eccentric utilisation ratio', unit: '', dir: 1, dec: 2, te: 5, calc: true },
  { key: 'vmax', cat: 'derived', label: 'Max velocity (flying sprint)', unit: 'm/s', dir: 1, dec: 2, te: 2, calc: true },
  { key: 'bm', cat: 'body', label: 'Body mass', kind: 'mass', dir: 0, dec: 1, te: 2, calc: true },
];
const ASYM_KEYS = ['brakeAsym', 'propAsym', 'landAsym', 'imtpAsym', 'asym'];
const ISO_TYPES = [['IMTP', 'Isometric mid-thigh pull (IMTP)'], ['ISQ', 'Isometric squat'], ['CALF', 'Calf isometric'], ['OTHER', 'Other isometric']];
const M = Object.fromEntries(METRICS.map(m => [m.key, m]));

function metricUnit(def) { return def.kind === 'len' ? U.len() : def.kind === 'mass' ? U.mass() : def.unit; }
function metricDisp(def, v) { return def.kind === 'len' ? U.lenOut(v) : def.kind === 'mass' ? U.massOut(v) : v; }
function fmtMetric(def, v, withUnit = true) {
  if (v == null || !Number.isFinite(v)) return '–';
  const d = def.kind === 'len' ? 1 : def.dec;
  const u = metricUnit(def);
  return fmtNum(metricDisp(def, v), d) + (withUnit && u ? ' ' + u : '');
}

/* All metric values for a test, including calculated ones */
function testMetrics(t) {
  const m = { ...(t.m || {}) };
  const bm = t.bodyMassKg;
  if (m.djRsi == null && m.djHeight != null && m.djGct > 0) m.djRsi = (m.djHeight / 100) / m.djGct;
  if (m.rsiMod == null && m.cmj != null && m.ttt > 0) m.rsiMod = (m.cmj / 100) / m.ttt;
  if (m.cmjRelPP == null && m.cmjPP != null && bm > 0) m.cmjRelPP = m.cmjPP / bm;
  if (m.imtpRel == null && m.imtpPF != null && bm > 0 && (!t.isoType || t.isoType === 'IMTP')) m.imtpRel = m.imtpPF / bm;
  if (m.peakBrakeF != null && bm > 0) m.relBrakeF = m.peakBrakeF / bm;
  if (m.cmjPF != null && bm > 0) m.relPropF = m.cmjPF / bm;
  if (m.imtpF100 != null && m.imtpPF > 0) m.f100Pct = m.imtpF100 / m.imtpPF * 100;
  if (m.cmjPF != null && m.imtpPF > 0 && (!t.isoType || t.isoType === 'IMTP' || t.isoType === 'ISQ')) m.dsi = m.cmjPF / m.imtpPF;
  if (m.cmj != null && m.sj > 0) m.eur = m.cmj / m.sj;
  if (m.fly10 > 0) m.vmax = 10 / m.fly10;
  else if (m.fly10yd > 0) m.vmax = 9.144 / m.fly10yd;
  if (bm > 0) m.bm = bm;
  return m;
}
function metricSeries(aid, key) {
  return testsFor(aid).map(t => ({ date: t.date, v: testMetrics(t)[key], id: t.id })).filter(p => p.v != null && Number.isFinite(p.v));
}
/* Trend summary for a series */
function trendOf(series, def) {
  if (!series.length) return null;
  const last = series[series.length - 1], prev = series.length > 1 ? series[series.length - 2] : null, first = series[0];
  const vals = series.map(p => p.v);
  const best = def.dir === -1 ? Math.min(...vals) : Math.max(...vals);
  const pct = (a, b) => (b ? (a - b) / Math.abs(b) * 100 : null);
  const t = { last, prev, first, best, n: series.length, isBest: def.dir !== 0 && last.v === best && series.length > 1 };
  t.dPrevPct = prev ? pct(last.v, prev.v) : null;
  t.dBasePct = series.length > 1 ? pct(last.v, first.v) : null;
  t.cls = changeClass(def, t.dPrevPct);
  return t;
}
/* 'good' | 'bad' | 'flat' — flat when within typical error */
function changeClass(def, pctChange) {
  if (pctChange == null || !def.dir) return 'flat';
  if (def.te != null && Math.abs(pctChange) < def.te) return 'flat';
  return pctChange * def.dir > 0 ? 'good' : 'bad';
}
function deltaHtml(def, pctChange, label = '') {
  if (pctChange == null) return '';
  const cls = changeClass(def, pctChange);
  const arrow = pctChange > 0 ? '▲' : pctChange < 0 ? '▼' : '';
  return `<span class="delta ${cls}" title="${cls === 'flat' ? 'Within typical test noise' : 'Beyond typical test noise'}">${arrow} ${fmtNum(Math.abs(pctChange), 1)}%${label ? ' ' + label : ''}</span>`;
}

/* ---------- Velocity-based training ---------- */
const ZONES = [
  { key: 'abs', name: 'Absolute strength', min: 0.15, max: 0.5, pct: '≈ 80–100% 1RM', color: '#d92d3a', use: 'Maximal strength; heavy triples–singles.' },
  { key: 'acc', name: 'Accelerative strength', min: 0.5, max: 0.75, pct: '≈ 65–80% 1RM', color: '#e0661b', use: 'Strength with intent to accelerate; 3–5 reps.' },
  { key: 'ss', name: 'Strength-speed', min: 0.75, max: 1.0, pct: '≈ 45–65% 1RM', color: '#c9a20c', use: 'Moving moderately heavy loads fast; power development.' },
  { key: 'sps', name: 'Speed-strength', min: 1.0, max: 1.3, pct: '≈ 30–45% 1RM', color: '#12965a', use: 'Light loads, high velocity; ballistic emphasis.' },
  { key: 'st', name: 'Starting strength', min: 1.3, max: 1.8, pct: '< 30% 1RM', color: '#2f5bff', use: 'Very light/ballistic; rate of force development.' },
];
function zoneOf(v) { if (v == null) return null; return ZONES.find(z => v >= z.min && v < z.max) || (v >= 1.8 ? ZONES[4] : v < 0.15 ? ZONES[0] : null); }

function parseVels(str) {
  return String(str || '').split(/[\s,;/]+/).map(num).filter(v => v != null && v > 0 && v < 10);
}
function velStats(reps) {
  if (!reps.length) return null;
  const best = Math.max(...reps), last = reps[reps.length - 1];
  return { n: reps.length, best, mean: mean(reps), last, vl: reps.length > 1 ? (best - last) / best * 100 : 0 };
}
function linreg(points) {
  const n = points.length;
  if (n < 2) return null;
  const mx = mean(points.map(p => p.x)), my = mean(points.map(p => p.y));
  let sxy = 0, sxx = 0, syy = 0;
  points.forEach(p => { sxy += (p.x - mx) * (p.y - my); sxx += (p.x - mx) ** 2; syy += (p.y - my) ** 2; });
  if (sxx === 0) return null;
  const b = sxy / sxx, a = my - b * mx;
  const r2 = syy === 0 ? 1 : (sxy * sxy) / (sxx * syy);
  return { a, b, r2, n };
}
/* Load–velocity profile from logged sets (fastest rep of each set) */
function lvProfile(aid, exId, { from = null, to = null } = {}) {
  const ex = getExercise(exId);
  const logs = S.vbt.filter(l => l.athleteId === aid && l.exerciseId === exId && l.load > 0 && l.vBest > 0 && (!from || l.date >= from) && (!to || l.date <= to));
  const points = logs.map(l => ({ x: l.load, y: l.vBest, date: l.date, id: l.id }));
  const loads = new Set(points.map(p => round(p.x, 1)));
  const out = { points, logs, ex, loadsN: loads.size, reg: null };
  if (loads.size >= 2) out.reg = linreg(points);
  const v = velocityE1rm(aid, exId, logs);   // only for back squat, front squat, bench press, trap bar deadlift
  Object.assign(out, { lift: v.lift, mvt: v.mvt, mvtSource: v.mvtSource, mvtNote: v.mvtNote, e1rm: v.e1rm, quality: v.quality, excluded: v.excluded || 0 });
  return out;
}
function bestOneRM(aid, exId) {
  const r = e1rmFor(aid, exId);
  if (!r) return null;
  return { kg: r.kg, source: r.source === 'tested' ? 'tested' : 'estimated', date: r.date, conf: r.conf, prof: r.prof };
}

/* ---------- Training load (session-RPE) ---------- */
function sessionLoads(aid) {
  return S.workouts.filter(w => w.athleteId === aid && w.completed && w.rpe != null && w.durationMin > 0).map(w => ({ date: w.date, load: w.rpe * w.durationMin }));
}
function loadWindow(loads, end, days) { const start = addDays(end, -(days - 1)); return loads.filter(l => l.date >= start && l.date <= end).reduce((s, l) => s + l.load, 0); }
function acwr(aid, end = today()) {
  const loads = sessionLoads(aid);
  if (!loads.length) return null;
  const firstDate = loads.map(l => l.date).sort()[0];
  if (daysBetween(firstDate, end) < 21) return null;
  const acute = loadWindow(loads, end, 7);
  const chronic = loadWindow(loads, end, 28) / 4;
  if (!chronic) return null;
  return { acute, chronic, ratio: acute / chronic };
}

/* =========================================================
   Insight engine — rule-based, every rule cites its evidence
   ========================================================= */
const LEVEL_ORDER = { alert: 0, warn: 1, good: 2, info: 3 };
const LEVEL_ICON = { alert: 'alert', warn: 'alert', good: 'checkCircle', info: 'bulb' };

function athleteInsights(a) {
  const out = [];
  const name = a.firstName;
  const T = today();
  const add = (level, title, text, action, refs, extra = {}) => out.push({ id: a.id + ':' + out.length, athleteId: a.id, level, title, text, action, refs, ...extra });
  const tests = testsFor(a.id);
  const lastTest = tests[tests.length - 1];
  const latestOf = key => { const s = metricSeries(a.id, key); return s.length ? s[s.length - 1] : null; };
  const recent = (p, days = 120) => p && daysBetween(p.date, T) <= days;

  /* --- Testing cadence --- */
  if (!tests.length) {
    if (daysBetween(toDS(new Date(a.createdAt || Date.now())), T) >= 3)
      add('info', 'No baseline testing yet', `${name} has no test results on file.`, 'Run a baseline battery (e.g. 10 m sprint, CMJ, drop-jump RSI, IMTP) so progress and readiness can be tracked against their own norms.', ['hopkins2000', 'haugen2016']);
  } else {
    const d = daysBetween(lastTest.date, T);
    if (d > 56) add('info', `Last tested ${plural(Math.round(d / 7), 'week')} ago`, `${name}'s most recent testing was ${fmtDateFull(lastTest.date)}.`, 'Re-test every 4–8 weeks (or at the end of each training block) to confirm the program is working.', ['haugen2016']);
  }

  /* --- DSI --- */
  const dsi = latestOf('dsi');
  if (recent(dsi)) {
    const v = dsi.v, pctTxt = Math.round(v * 100);
    if (v < 0.6) add('warn', `Low DSI (${fmtNum(v, 2)}) — prioritise ballistic & explosive work`, `CMJ peak force is only ${pctTxt}% of IMTP peak force: ${name} has strength they can't yet express quickly.`, 'Emphasise ballistic training — loaded/unloaded jumps, trap-bar jumps at ~20–40% 1RM, Olympic-lift derivatives and plyometrics — while maintaining heavy strength work.', ['sheppard2011', 'comfort2018']);
    else if (v > 0.8) add('warn', `High DSI (${fmtNum(v, 2)}) — prioritise maximal strength`, `CMJ peak force is ${pctTxt}% of IMTP peak force: ${name} already expresses most of their available strength ballistically, so the force ceiling is the limiter.`, 'Emphasise maximal-strength work (≈80–90% 1RM, 2–5 reps; e.g. squat, trap-bar deadlift, IMTP-type pulls) while keeping plyometric exposure.', ['sheppard2011', 'comfort2018', 'suchomel2016']);
    else add('info', `DSI in the balanced range (${fmtNum(v, 2)})`, `CMJ peak force is ${pctTxt}% of IMTP peak force (0.60–0.80 band).`, 'Continue a concurrent approach — heavy strength plus ballistic/plyometric work — and re-assess DSI each block.', ['sheppard2011', 'comfort2018']);
  }

  /* --- EUR --- */
  const eur = latestOf('eur');
  if (recent(eur)) {
    if (eur.v < 1.0) add('warn', `EUR below 1.0 (${fmtNum(eur.v, 2)}) — limited stretch-shortening cycle use`, `${name} jumps no higher with a countermovement than from a static squat position.`, 'Add slow- and fast-SSC plyometrics (countermovement jumps, hurdle hops, low drop jumps) and coach a quick, committed countermovement.', ['mcguigan2006', 'flanagan2008']);
    else if (eur.v >= 1.1) add('good', `Good SSC utilisation (EUR ${fmtNum(eur.v, 2)})`, `${name} gains ${Math.round((eur.v - 1) * 100)}% jump height from the countermovement.`, 'If jump height is still a goal, concentric strength/power (squat jumps, heavy strength) may offer more return than additional SSC work.', ['mcguigan2006']);
  }

  /* --- Drop jump contact time --- */
  const gct = latestOf('djGct');
  if (recent(gct, 90) && gct.v > 0.25) {
    add('info', `Drop-jump contact time ${fmtNum(gct.v * 1000, 0)} ms (>250 ms)`, `This is a slow stretch-shortening response — reactive (fast-SSC) ability isn't being expressed.`, 'Use lower drop heights, cue "bounce off a hot floor", and only progress box height while contact stays under ~250 ms and RSI holds.', ['flanagan2008']);
  }

  /* --- CMJ readiness / adaptation --- */
  const cmjS = metricSeries(a.id, 'cmj');
  if (cmjS.length >= 2) {
    const last = cmjS[cmjS.length - 1];
    const prior = cmjS.slice(-4, -1).map(p => p.v);
    const ref = mean(prior);
    const ch = (last.v - ref) / ref * 100;
    if (daysBetween(last.date, T) <= 21) {
      if (ch <= -M.cmj.te) add('warn', `CMJ down ${fmtNum(-ch, 1)}% vs recent average`, `Latest ${fmtMetric(M.cmj, last.v)} vs ${fmtMetric(M.cmj, ref)} average of the previous ${plural(prior.length, 'test')} — larger than typical test noise (~${M.cmj.te}%).`, 'Possible neuromuscular fatigue. Check sleep, soreness and recent load; consider trimming high-intensity and plyometric volume for 48–72 h, then retest.', ['claudino2017', 'hopkins2000']);
      else if (ch >= M.cmj.te) add('good', `CMJ up ${fmtNum(ch, 1)}% vs recent average`, `Latest ${fmtMetric(M.cmj, last.v)} vs ${fmtMetric(M.cmj, ref)} — a change beyond typical test noise.`, 'Positive adaptation / good readiness. Current loading appears well tolerated.', ['claudino2017', 'hopkins2000']);
    }
  }

  /* --- Meaningful changes in the latest test (vs previous) --- */
  if (lastTest && daysBetween(lastTest.date, T) <= 60) {
    const keys = ['sprint10', 'sprint20', 'sprint30', 'sprint40yd', 'fly10', 'proAgility', 'broad', 'vj', 'djRsi', 'rsiMod', 'rsi105', 'cod505', 'takeoffVel', 'propImp', 'imtpPF', 'imtpF100', 'cmjPP', 'cmjRelPP'];
    const ups = [], downs = [];
    keys.forEach(k => {
      const s = metricSeries(a.id, k);
      if (s.length < 2 || s[s.length - 1].id !== lastTest.id) return;
      const t = trendOf(s, M[k]);
      const line = `${M[k].label}: ${fmtMetric(M[k], t.prev.v)} → ${fmtMetric(M[k], t.last.v)} (${t.dPrevPct > 0 ? '+' : ''}${fmtNum(t.dPrevPct, 1)}%)`;
      if (t.cls === 'good') ups.push(line); else if (t.cls === 'bad') downs.push(line);
    });
    if (ups.length) add('good', `${plural(ups.length, 'meaningful improvement')} in latest testing`, `Changes larger than the typical error of each test (${fmtDate(lastTest.date)}):`, 'Keep the current emphasis; consider progressing load or complexity in the qualities that are improving.', ['hopkins2000'], { list: ups });
    if (downs.length) add('warn', `${plural(downs.length, 'meaningful decline')} in latest testing`, `Changes larger than the typical error of each test (${fmtDate(lastTest.date)}):`, 'Check testing conditions (surface, warm-up, timing method) first; if confirmed, review fatigue, recent load and whether those qualities are still being trained.', ['hopkins2000', 'haugen2016'], { list: downs });
  }

  /* --- Acceleration vs max velocity --- */
  const s10 = metricSeries(a.id, 'sprint10'), sf = metricSeries(a.id, 'fly10');
  if (s10.length >= 2 && sf.length >= 2 && recent(s10[s10.length - 1], 90)) {
    const acc = -(s10[s10.length - 1].v - s10[0].v) / s10[0].v * 100;
    const mv = -(sf[sf.length - 1].v - sf[0].v) / sf[0].v * 100;
    if (mv >= M.fly10.te && acc < M.sprint10.te) add('info', 'Max velocity improving faster than acceleration', `Since ${fmtDate(s10[0].date)}: flying 10 m ${mv > 0 ? 'improved' : 'changed'} ${fmtNum(mv, 1)}%, 10 m acceleration ${fmtNum(acc, 1)}%.`, 'Shift emphasis toward acceleration: resisted sprints (sled loads that keep good posture), 10–20 m starts, and horizontal force work (e.g. heavy sled pushes, horizontal jumps).', ['haugen2016', 'morin2016']);
    else if (acc >= M.sprint10.te && mv < M.fly10.te) add('info', 'Acceleration improving faster than max velocity', `Since ${fmtDate(s10[0].date)}: 10 m acceleration improved ${fmtNum(acc, 1)}%, flying 10 m ${fmtNum(mv, 1)}%.`, 'Add regular max-velocity exposure: flying 10–30 m sprints at ≥95% effort with full recovery (2–3 min per 10 m), plus upright sprint technique drills.', ['haugen2016', 'morin2016']);
  }

  /* --- Asymmetry (all OVR asymmetry metrics) --- */
  const asyms = ASYM_KEYS.map(k => ({ k, p: latestOf(k) })).filter(x => recent(x.p, 90) && x.p.v >= 10);
  if (asyms.length) {
    const worst = asyms.reduce((a, b) => (b.p.v > a.p.v ? b : a));
    const tt = tests.find(t => t.id === worst.p.id);
    const side = tt?.sides?.[worst.k] || (worst.k === 'asym' ? tt?.asymSide : '');
    add(worst.p.v >= 15 ? 'alert' : 'warn', `${M[worst.k].label} ${fmtNum(worst.p.v, 1)}%${side ? ` (${side} greater)` : ''}`, `Asymmetries above ~10–15% have been linked to reduced jump, sprint and change-of-direction performance.${asyms.length > 1 ? ` Also ≥10%: ${asyms.filter(x => x !== worst).map(x => `${M[x.k].label} ${fmtNum(x.p.v, 1)}%`).join(', ')}.` : ''}`, 'Retest to confirm (asymmetry is task-specific and varies session to session) and check whether the same side leads across braking, propulsion and isometric tests. If it persists, add unilateral strength and plyometric work for the weaker side and review injury history.', ['bishop2018']);
  }

  /* --- VBT: velocity loss, readiness, e1RM --- */
  const logs = S.vbt.filter(l => l.athleteId === a.id);
  const recentLogs = logs.filter(l => daysBetween(l.date, T) <= 14 && daysBetween(l.date, T) >= 0);
  const highVL = recentLogs.filter(l => l.vl != null && l.vl > 40);
  if (highVL.length) add('warn', `${plural(highVL.length, 'set')} exceeded 40% velocity loss (last 14 days)`, `High within-set velocity loss means sets are being taken close to failure, increasing fatigue.`, 'For strength and power goals, cap sets at ~10–25% velocity loss; reserve ~40% only for hypertrophy-focused blocks.', ['pareja2017', 'sanchez2011']);

  const exIds = [...new Set(recentLogs.map(l => l.exerciseId))];
  exIds.forEach(exId => {
    const ex = getExercise(exId);
    if (!ex) return;
    const exLogs = logs.filter(l => l.exerciseId === exId && l.vBest > 0 && l.load > 0);
    const lastDate = exLogs.map(l => l.date).sort().pop();
    if (!lastDate || daysBetween(lastDate, T) > 14) return;
    const todays = exLogs.filter(l => l.date === lastDate);
    const diffs = [];
    todays.forEach(l => {
      const prior = exLogs.filter(p => p.date < lastDate && Math.abs(p.load - l.load) <= Math.max(2.5, l.load * 0.025)).map(p => p.vBest);
      if (prior.length >= 2) diffs.push({ d: l.vBest - mean(prior), load: l.load, v: l.vBest, ref: mean(prior) });
    });
    if (diffs.length) {
      const avg = mean(diffs.map(x => x.d));
      const ex1 = diffs[0];
      if (avg <= -0.06) add('warn', `${ex.name}: bar speed ${fmtNum(-avg, 2)} m/s below normal`, `${fmtDate(lastDate)} — ${fmtMass(ex1.load)} moved at ${fmtNum(ex1.v, 2)} m/s vs a usual ${fmtNum(ex1.ref, 2)} m/s at that load.`, 'Reduced readiness is likely. Autoregulate: reduce the load (≈5–10%) to hit the prescribed velocity, or cut a set, rather than grinding through the planned loads.', ['gonzalez2010', 'weakley2021']);
      else if (avg >= 0.06) add('good', `${ex.name}: bar speed ${fmtNum(avg, 2)} m/s above normal`, `${fmtDate(lastDate)} — ${fmtMass(ex1.load)} moved at ${fmtNum(ex1.v, 2)} m/s vs a usual ${fmtNum(ex1.ref, 2)} m/s.`, 'Good readiness / strength gain. If velocities stay above target, increase load (≈2.5–5%) until bar speed is back in the prescribed zone.', ['gonzalez2010', 'weakley2021']);
    }
    if (e1rmLiftOf(ex)) {
      const now = lvProfile(a.id, exId, { from: addDays(T, -42) });
      const before = lvProfile(a.id, exId, { from: addDays(T, -126), to: addDays(T, -43) });
      if (now.e1rm && before.e1rm) {
        const ch = (now.e1rm - before.e1rm) / before.e1rm * 100;
        if (Math.abs(ch) >= 5) add(ch > 0 ? 'good' : 'warn', `${ex.name}: estimated 1RM ${ch > 0 ? 'up' : 'down'} ${fmtNum(Math.abs(ch), 1)}%`, `Load–velocity estimate ${fmtMass(before.e1rm)} → ${fmtMass(now.e1rm)} (previous vs last 6 weeks).`, ch > 0 ? 'Update percentage-based loads to the new estimate. Estimated 1RMs can over-predict — confirm with a velocity-capped top set rather than a true max if needed.' : 'Check for accumulated fatigue or reduced training frequency on this lift before changing the plan; consider a lighter week and retest the profile.', ['jidovtseff2011', 'banyard2017']);
      }
    }
  });

  /* --- Session-RPE load spikes --- */
  const r = acwr(a.id);
  if (r) {
    if (r.ratio >= 1.5) add('warn', `Training-load spike (acute:chronic ${fmtNum(r.ratio, 2)})`, `Last 7 days: ${fmtNum(r.acute, 0)} AU vs a 4-week weekly average of ${fmtNum(r.chronic, 0)} AU (session-RPE × minutes).`, 'Avoid further increases this week and build load more gradually (≈10% per week is a common guide). The ratio is a prompt, not a predictor — check how the athlete is coping.', ['foster2001', 'gabbett2016', 'impellizzeri2020']);
    else if (r.ratio < 0.8) add('info', `Training load well below recent average (ratio ${fmtNum(r.ratio, 2)})`, `Last 7 days: ${fmtNum(r.acute, 0)} AU vs ${fmtNum(r.chronic, 0)} AU weekly average.`, 'Fine for a planned deload. If unplanned, rebuild gradually rather than jumping straight back to previous loads.', ['foster2001', 'gabbett2016', 'impellizzeri2020']);
  }
  return out.sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level]);
}
function allInsights() {
  return activeAthletes().flatMap(athleteInsights).sort((x, y) => LEVEL_ORDER[x.level] - LEVEL_ORDER[y.level]);
}
function insightHtml(ins, showWho = false) {
  const a = getAthlete(ins.athleteId);
  return `<div class="insight ${ins.level}">
    <div class="ic">${icon(LEVEL_ICON[ins.level])}</div>
    <div class="row-main" style="white-space:normal">
      ${showWho && a ? `<a class="in-who" href="#/athlete/${a.id}">${esc(athleteName(a))}</a>` : ''}
      <div class="in-title">${esc(ins.title)}</div>
      <div class="in-text">${esc(ins.text)}</div>
      ${ins.list ? `<ul>${ins.list.map(l => `<li>${esc(l)}</li>`).join('')}</ul>` : ''}
      <div class="in-action"><b>Suggestion:</b> ${esc(ins.action)}</div>
      ${refLinks(ins.refs)}
    </div></div>`;
}
