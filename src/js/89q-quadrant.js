/* =========================================================
   Athletic profile (athlete Overview): every test the coach logs, grouped into four qualities
   (Speed, Power, Strength, Reactive & landing), and a Strength × Speed & power quadrant that shows
   where the athlete stands now and how they have moved.
   References, one per test:
   - the coach's high-school standards (`HS_STD`: the force-plate tests and drop landing),
   - else a published percentile table (`normFor`: built in, `NORMS_BUILTIN`, or one the coach loaded
     with its source on the Percentiles page),
   - else none: the test is listed with its trend but not scored.
   One scale for both (`qdPosOf`): four equal steps, 0–100. A standard places a result where its meter
   does (`stdPos`: Poor / Average / Good / Elite). A percentile maps below the 25th / 25th–75th /
   75th–90th / 90th and above (the Percentiles page's bands) onto the same steps (`pctPos`). The lines
   cross at Good.
   Scored = graded (`stdGraded`: ages 14–18, sex known, not provisional or low reliability) or placed in a
   published table, and tested in the 12 months up to the date shown (`QD_DAYS`). Strength = the mean of
   its scored results; Speed & power = the mean of the Speed and Power means, so each counts the same
   however many tests it has.
   ========================================================= */
const QD_DAYS = 365;
const QD_TRAIL = 8;
const QD_QUALS = [
  { key: 'speed', label: 'Speed', icon: 'zap', empty: 'Sprints, flying sprints and agility runs show here.' },
  { key: 'power', label: 'Power', icon: 'trend', empty: 'Jumps (CMJ, squat jump, broad jump) and CMJ power show here.' },
  { key: 'strength', label: 'Strength', icon: 'dumbbell', empty: 'IMTP, other isometric tests and tested 1RMs show here.' },
  { key: 'react', label: 'Reactive & landing', icon: 'target', empty: 'Drop jumps, RSI, CMJ braking and landing tests show here.' },
];
const QD_KEYS = {
  power: ['cmjPF', 'propImp', 'cmjPP', 'cmjRelPP', 'takeoffVel', 'relPropF', 'eur', 'armSwing', 'propAsym'],
  strength: ['dsi', 'f100Pct', 'imtpF100Rel', 'imtpF200Rel', 'slImtpAsym', 'slImtpRel', 'calfIsoAsym', 'calfIsoRel'],
  react: ['rsiMod', 'ttt', 'cmDepth', 'brakeTime', 'propTime', 'peakBrakeF', 'brakeRfd', 'brakeImp', 'relBrakeF', 'peakLandF', 'bci', 'brakeAsym', 'landAsym'],
};
const QD_NAMES = [['Fast, needs strength', 'Strong & fast'], ['Build both', 'Strong, needs speed']];
/* Which quality a test belongs to ('other' = custom tests without one of the app's categories) */
function qdQualOf(m) {
  if (!m || m.context || m.cat === 'body') return null;
  if (m.cat === 'sprint' || m.key === 'vmax') return 'speed';
  if (m.cat === 'jump' || QD_KEYS.power.includes(m.key)) return 'power';
  if (m.key !== 'asym' && (m.cat === 'iso' || QD_KEYS.strength.includes(m.key))) return 'strength';
  if (m.cat === 'rsi' || m.cat === 'land' || QD_KEYS.react.includes(m.key)) return 'react';
  return m.custom || m.key === 'asym' ? 'other' : null;
}
/* A percentile on the standards' four steps: <25th → Poor, 25th–75th → Average, 75th–90th → Good, 90th+ → Elite */
function pctPos(p) {
  const B = [[0, 0], [25, 25], [75, 50], [90, 75], [100, 100]], x = clamp(p, 0, 100);
  for (let i = 1; i < B.length; i++) if (x <= B[i][0]) return B[i - 1][1] + (x - B[i - 1][0]) / (B[i][0] - B[i - 1][0]) * (B[i][1] - B[i - 1][1]);
  return 100;
}
const qdLv = pos => Math.min(3, Math.max(0, Math.floor(pos / 25)));
const qdLvBadge = pos => `<span class="std-lv lv-${STD_LV[qdLv(pos)][0]}">${STD_LV[qdLv(pos)][1]}</span>`;

/* Every series the athlete has: one per test, split like the Testing tab (OVR Jump heights, isometric types) */
function qdName(m, p) {
  const lf = s => (/^[A-Z][a-z]/.test(s) ? s[0].toLowerCase() + s.slice(1) : s);
  if (isoSplit(m.key)) return `${ISO_NAME[isoOf(p)]} ${lf(m.label)}`;
  if (m.cat === 'cmjfp' || (m.cat === 'derived' && m.sub === 'CMJ')) return `CMJ ${lf(m.label)}`;
  if (m.cat === 'land') return `Drop landing: ${lf(m.label)}`;
  return m.label + metricTagFor(m.key, p);
}
function qdSeries(a) {
  const out = [];
  METRICS.forEach(m => {
    const q = qdQualOf(m);
    if (!q) return;
    const all = metricSeries(a.id, m.key);
    if (!all.length) return;
    const parts = FT_KEYS.includes(m.key) ? ['fp', 'ft'].map(x => all.filter(p => jumpMethod(p.dev) === x))
      : isoSplit(m.key) ? ['IMTP', ...ISO_KEYS].map(it => all.filter(p => isoOf(p) === it)) : [all];
    parts.filter(s => s.length).forEach(ser => { const last = ser[ser.length - 1]; out.push({ m, q, ser, last, key: metricKeyFor(m.key, last), name: qdName(m, last) }); });
  });
  // tested 1RMs (maxes), one series per lift, relative to body mass when it's known
  const lifts = new Map();
  S.maxes.filter(x => x.athleteId === a.id && x.kg > 0).sort(byKey('date')).forEach(x => { if (!lifts.has(x.exerciseId)) lifts.set(x.exerciseId, []); lifts.get(x.exerciseId).push(x); });
  lifts.forEach((list, exId) => {
    const ex = getExercise(exId);
    if (!ex) return;
    const ser = list.map(x => ({ date: x.date, v: x.kg, bm: bodyMassOn(a.id, x.date) }));
    out.push({ lift: ex, q: 'strength', ser, last: ser[ser.length - 1], key: 'lift:' + exId, name: `${ex.name} 1RM` });
  });
  return out;
}

/* The reference for one result: { kind: 'std' | 'target' | 'norm', pos (scored only), … } or null */
function qdRef(a, it, p) {
  if (it.lift) {
    const bm = p.bm, r = bm ? qdNormRef(a, 'rel:' + it.lift.id, p.v / bm, p.date) : null;
    return r || qdNormRef(a, it.key, p.v, p.date);
  }
  const s = STD_BY[it.m.key];
  if (s && stdPtOk(s, p)) {
    const r = stdEval(a, it.m.key, p.v, p.date, p.bm);
    if (r?.need) return { kind: s.target ? 'target' : 'std', need: r.need };
    if (r && r.target) return { kind: 'target', r };
    if (r) return { kind: 'std', r, pos: stdGraded(r) ? stdPos(r) : null };
  }
  return qdNormRef(a, it.key, p.v, p.date);
}
function qdNormRef(a, key, v, date) {
  const m = key.startsWith('lift:') || key.startsWith('rel:') ? { dir: 1 } : M[key.replace(/^(ft|ISQ|CALF|OTHER):/, '')];
  if (!m?.dir) return null;
  const me = { sex: a.sex === 'M' || a.sex === 'F' ? a.sex : '', age: ageAt(a.dob, date), sport: (a.sport || '').trim().toLowerCase() };
  const t = normFor(key, me);
  if (!t) {
    const any = normTablesAll().some(x => x.metric === key);
    return any && (!me.sex || me.age == null) ? { kind: 'norm', need: !me.sex ? 'sex' : 'date of birth' } : null;
  }
  const np = normPct(t, v, m.dir);
  return np ? { kind: 'norm', t, np, pos: pctPos(np.p) } : null;
}

/* Standing on a date: each series' latest result in the 12 months up to it */
function qdStanding(a, items, date) {
  const from = addDays(date, -QD_DAYS), per = {};
  items.forEach(it => {
    if (it.q === 'other') return;
    const p = [...it.ser].reverse().find(x => x.date <= date && x.date > from);
    if (!p) return;
    const ref = qdRef(a, it, p);
    if (ref?.pos == null) return;
    (per[it.q] ||= []).push(ref.pos);
  });
  const avg = xs => (xs?.length ? mean(xs) : null);
  const q = Object.fromEntries(QD_QUALS.map(x => [x.key, avg(per[x.key])]));
  const sp = [q.speed, q.power].filter(x => x != null);
  return { date, q, n: Object.fromEntries(QD_QUALS.map(x => [x.key, per[x.key]?.length || 0])), x: q.strength, y: sp.length ? mean(sp) : null };
}
/* Where the athlete stands today and how they got there (one point per test day, last QD_TRAIL) */
function athQuadrant(a) {
  const items = qdSeries(a), T = today();
  const now = qdStanding(a, items, T);
  const days = [...new Set(items.filter(it => it.q !== 'other').flatMap(it => it.ser.map(p => p.date)))].filter(d => d <= T).sort();
  const trail = [];
  days.forEach(d => {
    const s = qdStanding(a, items, d);
    if (s.x == null || s.y == null) return;
    const l = trail[trail.length - 1];
    if (!l || Math.abs(l.x - s.x) >= 0.5 || Math.abs(l.y - s.y) >= 0.5) trail.push(s);   // a point = the first day of each standing
  });
  const pts = trail.slice(-QD_TRAIL);
  if (now.x != null && now.y != null) {
    const l = pts[pts.length - 1];
    if (l && Math.abs(l.x - now.x) < 0.5 && Math.abs(l.y - now.y) < 0.5) pts.pop();
    pts.push({ ...now, now: true });
  }
  return { items, now, pts };
}

/* ---------- The chart ---------- */
function quadName(x, y) { return QD_NAMES[y >= 50 ? 0 : 1][x >= 50 ? 1 : 0]; }
function qdSvg(pts) {
  const S0 = 340, L = 40, Tp = 12, W = 286, X = v => L + v / 100 * W, Y = v => Tp + (100 - v) / 100 * W;
  let svg = `<svg viewBox="0 0 ${S0} ${S0}" class="qd-svg" role="img" aria-label="${esc(pts.length ? `${quadName(pts[pts.length - 1].x, pts[pts.length - 1].y)}: strength ${STD_LV[qdLv(pts[pts.length - 1].x)][1]}, speed and power ${STD_LV[qdLv(pts[pts.length - 1].y)][1]}` : 'Strength and speed & power quadrant')}">`;
  svg += `<rect x="${X(50)}" y="${Y(100)}" width="${W / 2}" height="${W / 2}" class="qd-best"/>`;
  [25, 75].forEach(v => { svg += `<line x1="${X(v)}" y1="${Y(0)}" x2="${X(v)}" y2="${Y(100)}" class="qd-grid"/><line x1="${X(0)}" y1="${Y(v)}" x2="${X(100)}" y2="${Y(v)}" class="qd-grid"/>`; });
  svg += `<rect x="${X(0)}" y="${Y(100)}" width="${W}" height="${W}" class="qd-frame"/>`;
  svg += `<line x1="${X(50)}" y1="${Y(0)}" x2="${X(50)}" y2="${Y(100)}" class="qd-mid"/><line x1="${X(0)}" y1="${Y(50)}" x2="${X(100)}" y2="${Y(50)}" class="qd-mid"/>`;
  const lab = (x, y, t, anchor) => `<text x="${x}" y="${y}" text-anchor="${anchor}" class="qd-q">${esc(t.toUpperCase())}</text>`;
  svg += lab(X(2), Y(100) + 16, QD_NAMES[0][0], 'start') + lab(X(98), Y(100) + 16, QD_NAMES[0][1], 'end') + lab(X(2), Y(0) - 8, QD_NAMES[1][0], 'start') + lab(X(98), Y(0) - 8, QD_NAMES[1][1], 'end');
  STD_LV.forEach(([, l], i) => {
    svg += `<text x="${X(i * 25 + 12.5)}" y="${Y(0) + 15}" text-anchor="middle" class="qd-t">${l}</text>`;
    svg += `<text transform="translate(${L - 8} ${Y(i * 25 + 12.5)}) rotate(-90)" text-anchor="middle" class="qd-t">${l}</text>`;
  });
  svg += `<text x="${X(50)}" y="${S0 - 4}" text-anchor="middle" class="qd-ax">STRENGTH →</text>`;
  svg += `<text transform="translate(13 ${Y(50)}) rotate(-90)" text-anchor="middle" class="qd-ax">SPEED &amp; POWER →</text>`;
  const P = p => [X(clamp(p.x, 1.5, 98.5)), Y(clamp(p.y, 1.5, 98.5))];
  if (pts.length > 1) svg += `<polyline points="${pts.map(p => P(p).map(v => v.toFixed(1)).join(',')).join(' ')}" class="qd-trail"/>`;
  pts.forEach((p, i) => {
    const [x, y] = P(p), last = i === pts.length - 1, op = pts.length > 1 ? 0.35 + 0.5 * i / (pts.length - 1) : 1;
    svg += last ? `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="8" class="qd-dot"/>` : `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4" class="qd-old" style="opacity:${op.toFixed(2)}"/>`;
    if (i === 0 && pts.length > 1) svg += `<text x="${(x + 7).toFixed(1)}" y="${(y + 13).toFixed(1)}" class="qd-date">${esc(fmtDate(p.date, { month: 'short', year: 'numeric' }))}</text>`;
    if (last) svg += `<text x="${(x + (x > X(80) ? -12 : 12)).toFixed(1)}" y="${(y - 10).toFixed(1)}" text-anchor="${x > X(80) ? 'end' : 'start'}" class="qd-now">${p.now ? 'NOW' : esc(fmtDate(p.date, { month: 'short', day: 'numeric' }))}</text>`;
    svg += `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="14" class="hit" data-tip="${esc(`${p.now ? 'Now' : fmtDate(p.date, { month: 'short', day: 'numeric', year: 'numeric' })}: strength ${STD_LV[qdLv(p.x)][1]} (${Math.round(p.x)}) · speed & power ${STD_LV[qdLv(p.y)][1]} (${Math.round(p.y)})`)}"/>`;
  });
  return svg + '</svg>';
}

/* ---------- The grid ---------- */
const QD_TR = { up: ['up', '▲'], down: ['down', '▼'], flat: ['flat', '→'], steady: ['steady', '='] };
function qdTrendHtml(it) {
  const t = it.lift ? qdLiftTrend(it) : seriesTrend(it.m.key, it.ser);
  if (!t || t.dir === 'new' || !QD_TR[t.dir]) return '<span class="qd-tr"></span>';
  const [c, g] = QD_TR[t.dir], txt = it.lift ? t.text : trendShort(t);
  return `<span class="qd-tr ${c}" title="${esc(txt)}" aria-label="${esc(txt)}">${g}</span>`;
}
/* 1RMs: up or down vs the previous tested max (a 2.5% change counts, about one plate step on a heavy lift) */
function qdLiftTrend(it) {
  if (it.ser.length < 2) return null;
  const a = it.ser[it.ser.length - 2].v, b = it.last.v, pct = (b - a) / a * 100;
  return { dir: pct >= 2.5 ? 'up' : pct <= -2.5 ? 'down' : 'steady', text: `${pct >= 0 ? '+' : '−'}${fmtNum(Math.abs(pct), 1)}% vs the previous tested 1RM` };
}
function qdRefHtml(a, it, ref, old) {
  if (old) return '<span class="faint tiny nowrap">not counted</span>';
  if (!ref) return '<span class="faint">—</span>';
  if (ref.need) return `<span class="faint tiny nowrap">needs ${esc(ref.need === 'bm' ? 'body mass' : ref.need)}</span>`;
  if (ref.kind === 'std' || ref.kind === 'target') return stdBadge(ref.r, true);
  const [bc] = pctBand(ref.np.p);
  return `<b class="pct-band ${bc} qd-pct">${esc(pctText(ref.np))}</b>`;
}
function qdSub(a, it, ref, old) {
  const d = fmtDate(it.last.date) + (it.lift && it.last.bm ? ` · ${fmtNum(it.last.v / it.last.bm, 2)} × BW` : '');
  if (old) return `${d} · over a year old`;
  if (!ref) return d;
  if (ref.need) return d;
  if (ref.kind === 'target') return `${d} · target`;
  if (ref.kind === 'std') return `${d} · HS standard${ref.r.s.prov ? ', provisional: not scored' : ref.r.s.lowRel ? ', low reliability: not scored' : ref.r.inAge ? '' : ', reference only'}`;
  return `${d} · vs ${ref.t.sex === 'F' ? 'girls' : ref.t.sex === 'M' ? 'boys' : 'all'}${ref.t.ageMin != null && ref.t.ageMin === ref.t.ageMax ? ` ${ref.t.ageMin}` : ''}, ${ref.t.level || 'published table'}`;
}
function qdRowHtml(a, it, ref = qdRef(a, it, it.last)) {
  const old = daysBetween(it.last.date, today()) >= QD_DAYS;
  const val = it.lift ? `${esc(fmtMass(it.last.v, false))} <small>${esc(U.mass())}</small>` : `${esc(fmtMetric(it.m, it.last.v, false))} <small>${esc(metricUnit(it.m))}</small>`;
  const href = it.lift ? `#/athlete/${a.id}/vbt` : metricHref(a.id, it.key);
  return `<a class="qd-row${old ? ' old' : ''}${ref?.pos != null && !old ? ' scored' : ''}" href="${href}">
    <span class="qd-name">${esc(it.name)}<small>${esc(qdSub(a, it, ref, old))}</small></span>
    <span class="qd-val">${val}</span><span class="qd-ref">${qdRefHtml(a, it, ref, old)}</span>${qdTrendHtml(it)}</a>`;
}
/* Each panel leads with the tests that have a reference, the sprints, lifts and main jump and IMTP results;
   the other force-plate numbers fold under "N more results" so the four panels stay readable */
const QD_MAIN = new Set(['cmj', 'sj', 'vj', 'broad', 'djHeight', 'djRsi', 'rsi105', 'imtpPF', 'imtpRel', 'slImtpRel', 'calfIsoRel']);
function qdPanelHtml(a, Q, items, now) {
  const list = items.filter(it => it.q === Q.key).map(it => ({ it, ref: qdRef(a, it, it.last) }));
  let main = list.filter(x => x.it.lift || x.it.q === 'speed' || x.ref || QD_MAIN.has(x.it.m.key)), more = list.filter(x => !main.includes(x));
  if (!main.length) [main, more] = [more, []];
  const sc = now.q[Q.key], row = x => qdRowHtml(a, x.it, x.ref);
  return `<div class="qd-panel" data-q="${Q.key}"><div class="qd-ph">${icon(Q.icon, 'sm')}<b>${esc(Q.label)}</b><span class="qd-ps">${sc != null ? `${qdLvBadge(sc)}<span class="faint tiny">${plural(now.n[Q.key], 'test')}</span>` : list.length ? '<span class="faint tiny">not scored</span>' : ''}</span></div>
    ${list.length ? main.map(row).join('') + (more.length ? `<details class="qd-more"><summary>${plural(more.length, 'more result')}</summary>${more.map(row).join('')}</details>` : '') : `<div class="faint small qd-empty">${esc(Q.empty)}</div>`}</div>`;
}

/* ---------- The card ---------- */
function athQuadCard(a) {
  const Q = athQuadrant(a), { items, now, pts } = Q;
  if (!items.some(it => it.q !== 'other')) return '';
  const first = a.firstName || 'This athlete', sex = a.sex === 'M' || a.sex === 'F';
  const age = ageFrom(a.dob), outAge = age != null && (age < STD_AGES[0] || age > STD_AGES[1]);
  const placed = now.x != null && now.y != null;
  const why = [];
  if (!sex) why.push(`Set ${esc(first)}’s sex to <b>Male</b> or <b>Female</b>: the standards and published tables are by sex.`);
  else {
    if (age == null) why.push(`Add ${esc(first)}’s date of birth: your high-school standards are for ages 14–18 and the published tables are by age.`);
    else if (outAge && !placed) why.push(`Your high-school standards are for ages 14–18 and ${esc(first)} is ${age}, so those results are reference only${now.x != null || now.y != null ? '' : ' and can’t place them on the chart'}.`);
    else {
      if (now.x == null) why.push('<b>Strength</b> needs a graded result from the last 12 months: an IMTP (peak force, or relative force with body mass) gives one.');
      if (now.y == null) why.push('<b>Speed &amp; power</b> needs a graded result from the last 12 months: a CMJ, squat jump or broad jump gives one.');
    }
  }
  const read = (lbl, v, n) => `<div class="qd-read"><span>${lbl}</span>${v != null ? `${qdLvBadge(v)}<span class="faint tiny">${plural(n, 'test')}</span>` : '<span class="faint small">not placed</span>'}</div>`;
  const other = items.filter(it => it.q === 'other');
  return `<div class="card qd-card"><div class="card-head"><h3>Athletic profile</h3><span class="sub">where ${esc(first)} stands now</span></div>
    <div class="qd-layout">
      <div class="qd-chart">
        ${placed ? `<div class="qd-name-now">${esc(quadName(now.x, now.y))}</div>` : ''}
        <div class="qd-wrap${placed ? '' : ' empty'}">${qdSvg(placed ? pts : [])}${placed ? '' : '<div class="qd-wait"><span>Not placed yet</span></div>'}</div>
        <div class="qd-reads">${read('Strength', now.x, now.n.strength)}${read('Speed &amp; power', now.y, now.n.speed + now.n.power)}</div>
        ${why.length ? `<div class="banner info qd-why">${icon('info')}<div class="grow small">${why.join('<br>')}</div></div>` : ''}
      </div>
      <div class="qd-grid">${QD_QUALS.map(x => qdPanelHtml(a, x, items, now)).join('')}</div>
    </div>
    ${other.length ? `<div class="qd-other"><div class="kicker">Other tests</div>${other.map(it => qdRowHtml(a, it)).join('')}</div>` : ''}
    <details class="qd-how"><summary>How this works</summary><div class="small muted">
      <p>Every test you log is listed with its latest result and trend (▲ better, ▼ worse, → no real change over 6+ weeks, = within the test’s normal noise). Each test is measured against one reference: your high-school standards for the force-plate tests, otherwise a published percentile table for the athlete’s sex and age when there is one. A test with neither is listed but not scored.</p>
      <p>Both go on the same four steps, so they can share one chart: your standards’ Poor, Average, Good and Elite, or below the 25th, 25th–75th, 75th–90th and the 90th percentile and above on a published table. The lines cross at Good. Strength is the average of its scored tests; Speed &amp; power the average of Speed and Power. Only results from the last 12 months count, and only graded ones (ages 14–18, sex set, not provisional or low reliability). The dot moves as soon as you add a result; the faint trail is where ${esc(first)} stood after earlier test days.</p>
      <p>Built-in table: broad jump, girls and boys 6–18 (European youth, general population, 1.3 million results), so athletes usually rank high on it. No published high-school table for sprints or agility could be checked against its source, so they are listed but not scored. If you have one (for example from the NSCA journals), add it on the <a href="#/percentiles">Percentiles page</a> with its source and it is used here automatically.</p>
      ${refLinks(['ortega2023'])}</div></details>
  </div>`;
}
