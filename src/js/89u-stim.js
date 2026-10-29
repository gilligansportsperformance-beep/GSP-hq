/* =========================================================
   Training stimulus: what the athlete's program is emphasising
   Every programmed set is classified from exercise type, reps, %1RM (given or estimated)
   and proximity to failure (RIR / RPE, or estimated from reps at that %1RM), using the
   NSCA load–rep assignments by goal. Rule-based, so it works offline and is transparent;
   an optional Claude summary turns the numbers into two sentences.
   ========================================================= */
Object.assign(REFS, {
  haff2016: { cite: 'Haff GG, Triplett NT, eds. Essentials of Strength Training and Conditioning. 4th ed. Champaign, IL: Human Kinetics; 2016.', what: 'Load and rep assignments by goal: strength ≥85% 1RM ≤6 reps; power 75–90% 1–5 reps (explosive lifts); hypertrophy 67–85% 6–12 reps; muscular endurance ≤67% ≥12 reps.' },
  schoenfeld2017: { cite: 'Schoenfeld BJ, Grgic J, Ogborn D, Krieger JW. Strength and hypertrophy adaptations between low- vs. high-load resistance training: a systematic review and meta-analysis. J Strength Cond Res. 2017;31(12):3508–3523.', what: 'Light and heavy loads build similar muscle when sets are taken close to failure; heavy loads build more maximal strength.' },
  refalo2023: { cite: 'Refalo MC, Helms ER, Trexler ET, Hamilton DL, Fyfe JJ. Influence of resistance training proximity-to-failure on skeletal muscle hypertrophy: a systematic review with meta-analysis. Sports Med. 2023;53(3):649–665.', what: 'Hypertrophy depends on sets being reasonably close to failure (roughly within a few reps in reserve).' },
  suchomel2018: { cite: 'Suchomel TJ, Nimphius S, Bellon CR, Stone MH. The importance of muscular strength: training considerations. Sports Med. 2018;48(4):765–785.', what: 'Strength underpins power; combine heavy strength work with ballistic and weightlifting-derivative training.' },
});
const STIM = [
  { key: 'str', label: 'Strength', color: '#d92d3a', what: 'heavy sets: ≈80%+ 1RM or ≤5 reps near max' },
  { key: 'pow', label: 'Power', color: '#e0661b', what: 'explosive lifts and moderate loads moved fast, far from failure' },
  { key: 'hyp', label: 'Hypertrophy', color: '#8b4ef3', what: '6–12 reps at ≈67–85% 1RM, or lighter loads close to failure' },
  { key: 'spd', label: 'Speed & reactive', color: '#2f5bff', what: 'sprints, jumps and plyometrics' },
  { key: 'end', label: 'Muscular endurance', color: '#0e9384', what: '12+ reps with lighter loads, not near failure' },
];
const STIM_LOWER = ['Squat', 'Hinge', 'Single-leg'], STIM_UPPER = ['Upper push', 'Upper pull'];
const ZONE_STIM = { abs: 'str', ss: 'pow', sps: 'pow', st: 'spd' };
/* Reps possible at a %1RM (inverse of the Epley/Brzycki mean used elsewhere) */
function repsAtPct(pc) { if (pc >= 100) return 1; let lo = 1, hi = 30; for (let i = 0; i < 40; i++) { const mid = (lo + hi) / 2; if (repsToPct(mid) * 100 > pc) lo = mid; else hi = mid; } return (lo + hi) / 2; }

function itemStim(it, aid) {
  const ex = getExercise(it.exerciseId);
  if (!ex) return null;
  const sets = Math.max(1, Math.min(20, Math.max(parseInt(it.sets, 10) || 1, it.loads?.length || 0)));
  const reps = planReps(it), cat = ex.category;
  const out = { sets, reps, ex, cat, pct: null, rir: itemRir(it), key: 'gen', why: '' };
  if (['Plyometric & jumps', 'Speed & agility'].includes(cat)) return { ...out, key: 'spd', why: 'sprint / jump / plyometric' };
  if (['Core', 'Mobility & prep', 'Conditioning', 'Other'].includes(cat)) return { ...out, key: 'gen', why: cat.toLowerCase() };
  if (fpTestOf(ex) || cat === FP_CAT) return { ...out, key: 'gen', why: 'force plate test' };
  if (cat === 'Olympic & derivatives') return { ...out, key: 'pow', why: 'weightlifting derivative' };
  if (it.intensity === 'zone' || it.intensity === 'vel') {
    const z = it.intensity === 'zone' ? ZONES.find(x => x.key === it.zone) : zoneOf(((it.vMin ?? it.vMax) + (it.vMax ?? it.vMin)) / 2);
    if (z) {
      const k = ZONE_STIM[z.key] || ((reps || 5) <= 6 ? 'str' : 'hyp');
      return { ...out, key: k, why: `${z.name.toLowerCase()} velocity zone` };
    }
  }
  const orm = it.exerciseId && aid ? bestOneRM(aid, it.exerciseId) : null;
  if (it.intensity === 'pct' && it.pct) out.pct = it.pct;
  else if (it.intensity === 'load' && orm?.kg > 0) { const ls = it.loads?.length ? it.loads : it.load != null ? [it.load] : []; if (ls.length) out.pct = mean(ls) / orm.kg * 100; }
  else if ((it.intensity === 'rir' || it.intensity === 'rpe') && reps && out.rir != null) out.pct = repsToPct(reps + out.rir) * 100;
  if (out.rir == null && out.pct && reps) out.rir = Math.max(0, repsAtPct(out.pct) - reps);
  if (!reps) return { ...out, why: 'reps not set' };
  if (cat === 'Isometric') return { ...out, key: 'str', why: 'isometric' };
  const easy = (out.rir != null && out.rir >= 4) || (it.vlCutoff && it.vlCutoff <= 20);
  const pc = out.pct;
  let key, why;
  if (pc != null) {
    if (pc >= 85 || (pc >= 80 && reps <= 5)) { key = 'str'; why = `${fmtNum(pc, 0)}% 1RM × ${reps}`; }
    else if (pc >= 67) { key = reps <= 3 && easy ? 'pow' : reps <= 5 ? 'str' : reps <= 12 ? 'hyp' : 'end'; why = `${fmtNum(pc, 0)}% × ${reps}${easy && reps <= 3 ? ', far from failure' : ''}`; }
    else { key = reps <= 6 ? 'pow' : reps <= 12 ? (out.rir != null && out.rir <= 3 ? 'hyp' : 'end') : (out.rir != null && out.rir <= 2 ? 'hyp' : 'end'); why = `${fmtNum(pc, 0)}% × ${reps}`; }
  } else {
    key = reps <= 3 && easy ? 'pow' : reps <= 5 ? 'str' : reps <= 12 ? 'hyp' : (out.rir != null && out.rir <= 2 ? 'hyp' : 'end');
    why = `${reps} reps${out.rir != null ? ` @ ${fmtNum(out.rir, 0)} RIR` : ''} (no %1RM on file)`;
  }
  return { ...out, key, why };
}
/* Summary of programmed sets in a date window */
function stimWindow(aid, from, to) {
  const wos = S.workouts.filter(w => w.athleteId === aid && w.date >= from && w.date <= to);
  const by = Object.fromEntries([...STIM.map(s => [s.key, 0]), ['gen', 0]]);
  let lower = 0, upper = 0, hard = 0, rirSum = 0, rirN = 0;
  const rows = [];
  wos.forEach(w => (w.items || []).forEach(it => {
    const c = itemStim(it, aid);
    if (!c) return;
    by[c.key] += c.sets;
    rows.push({ ...c, date: w.date });
    if (c.key === 'gen') return;
    if (STIM_LOWER.includes(c.cat)) lower += c.sets; else if (STIM_UPPER.includes(c.cat)) upper += c.sets;
    if (c.rir != null && ['str', 'hyp', 'end'].includes(c.key)) { rirSum += c.rir * c.sets; rirN += c.sets; if (c.rir <= 3) hard += c.sets; }
  }));
  const work = STIM.reduce((s, x) => s + by[x.key], 0);
  const weeks = Math.max(1, (daysBetween(from, to) + 1) / 7);
  return { wos: wos.length, by, work, share: Object.fromEntries(STIM.map(s => [s.key, work ? by[s.key] / work * 100 : 0])), lower, upper, hard, weeks, avgRir: rirN ? rirSum / rirN : null, rows };
}
function athStim(aid) {
  const to = addDays(today(), 6), from = addDays(today(), -27);
  const cur = stimWindow(aid, from, to), prev = stimWindow(aid, addDays(from, -28), addDays(from, -1));
  return { cur, prev, from, to };
}
function stimPoints(s) {
  const c = s.cur, out = [];
  const ranked = STIM.filter(x => c.share[x.key] > 0).sort((a, b) => c.share[b.key] - c.share[a.key]);
  if (!ranked.length) return out;
  const main = ranked[0], second = ranked[1] && c.share[ranked[1].key] >= 20 ? ranked[1] : null;
  out.push(`<b>Main focus: ${esc(main.label.toLowerCase())}</b>${second ? ` with ${esc(second.label.toLowerCase())}` : ''}, ${esc(main.what)}.`);
  if (s.prev.work >= 6) {
    const d = STIM.map(x => ({ x, d: c.share[x.key] - s.prev.share[x.key] })).filter(o => Math.abs(o.d) >= 10).sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 2);
    out.push(d.length ? `Trend vs previous 4 weeks: ${d.map(o => `${o.d > 0 ? 'more' : 'less'} ${esc(o.x.label.toLowerCase())} (${o.d > 0 ? '+' : '−'}${fmtNum(Math.abs(o.d), 0)} pts)`).join(', ')}.` : 'Trend vs previous 4 weeks: similar emphasis.');
  } else out.push('No earlier block to compare yet.');
  const perWk = c.work / c.weeks;
  out.push(`${fmtNum(perWk, 0)} working sets/week${c.avgRir != null ? ` · strength/size sets average ≈${fmtNum(c.avgRir, 1)} RIR (${fmtNum(c.hard / c.weeks, 0)}/week within 3 RIR)` : ''}${c.lower + c.upper ? ` · lower body ${fmtNum(c.lower / (c.lower + c.upper) * 100, 0)}%` : ''}.`);
  if (!c.by.spd && !c.by.pow && c.work >= 8) out.push('No speed, jump or power work programmed. Consider adding some: it develops separately from strength.');
  else if (c.avgRir != null && c.avgRir < 1) out.push('Most strength/size sets are at or near failure, which costs more fatigue. 1–3 RIR usually gives similar gains.');
  return out;
}
function athStimCard(a) {
  const s = athStim(a.id), c = s.cur;
  const head = `<div class="card-head"><h3>Training stimulus</h3><span class="sub">last 4 weeks + this week</span></div>`;
  if (!c.work) return `<div class="card">${head}<p class="muted small" style="margin:0">${c.wos ? 'The programmed exercises are general work (core, mobility, conditioning) or have no reps set.' : 'Program workouts with sets, reps and an intensity (%1RM, load, RIR/RPE or velocity) to see which qualities they target.'}</p></div>`;
  const bar = STIM.filter(x => c.by[x.key]).map(x => `<span style="width:${c.share[x.key]}%;background:${x.color}" title="${esc(x.label)} ${fmtNum(c.share[x.key], 0)}%"></span>`).join('');
  const legend = STIM.filter(x => c.by[x.key]).sort((x, y) => c.by[y.key] - c.by[x.key]).map(x => `<span><i style="background:${x.color}"></i>${esc(x.label)} <b>${fmtNum(c.share[x.key], 0)}%</b></span>`).join('');
  const ai = UI.stimAi?.[a.id];
  const byEx = new Map();
  c.rows.filter(r => r.key !== 'gen').forEach(r => { const k = r.ex.id + r.key; const o = byEx.get(k) || { ...r, n: 0 }; o.n += r.sets; byEx.set(k, o); });
  return `<div class="card">${head}
    <div class="stim-bar" role="img" aria-label="Share of working sets by quality">${bar}</div>
    <div class="stim-legend">${legend}</div>
    <ul class="stim-points">${stimPoints(s).map(t => `<li>${t}</li>`).join('')}</ul>
    ${ai ? `<div class="stim-ai">${ai.busy ? '<span class="faint">Claude is reading the program…</span>' : mdLite(ai.text || '')}</div>` : ''}
    <details class="e1-detail" style="margin-top:8px"><summary>How each exercise was classified</summary><div class="small">
      ${[...byEx.values()].sort((x, y) => y.n - x.n).slice(0, 12).map(r => `<div class="split" style="gap:8px;padding:3px 0"><span>${esc(r.ex.name)} <span class="faint">· ${esc(r.why)}</span></span><span class="nowrap"><b style="color:${STIM.find(x => x.key === r.key).color}">${esc(STIM.find(x => x.key === r.key).label)}</b> · ${r.n} sets</span></div>`).join('')}
      <p class="faint tiny" style="margin:8px 0 0">Counts programmed working sets (core, mobility and conditioning excluded). %1RM comes from the prescription or the athlete’s 1RM; if RIR isn’t set it is estimated from reps at that %1RM.</p>
      ${refLinks(['haff2016', 'schoenfeld2017', 'refalo2023', 'suchomel2018'])}</div></details>
    ${aiReady() ? `<button class="btn sm" style="margin-top:10px" data-act="stimAi" data-a="${a.id}" ${ai?.busy ? 'disabled' : ''}>${icon('bulb', 'sm')}${ai?.text ? 'Refresh AI summary' : 'AI summary'}</button>` : ''}
  </div>`;
}
A.stimAi = async el => {
  const aid = el.dataset.a, a = getAthlete(aid);
  if (!a || !aiReady()) return;
  if (!navigator.onLine) return toast('AI summary needs an internet connection');
  const s = athStim(aid), c = s.cur;
  const lines = c.rows.map(r => `${r.date}: ${r.ex.name} (${r.cat}) ${r.sets}×${r.reps ?? '?'}${r.pct != null ? ` @ ~${fmtNum(r.pct, 0)}% 1RM` : ''}${r.rir != null ? `, ~${fmtNum(r.rir, 1)} RIR` : ''} → ${r.key}`).slice(0, 120).join('\n');
  const share = w => STIM.map(x => `${x.label} ${fmtNum(w.share[x.key], 0)}%`).join(', ');
  const prompt = `Athlete: ${ageFrom(a.dob) ?? 'unknown age'} y, ${a.sex === 'F' ? 'female' : a.sex === 'M' ? 'male' : 'sex not given'}, sport: ${a.sport || 'not given'}.\nCurrent 4-week block (working sets): ${share(c)}; ${fmtNum(c.work / c.weeks, 0)} sets/week; avg RIR on strength/size sets ${c.avgRir != null ? fmtNum(c.avgRir, 1) : 'unknown'}.\nPrevious 4 weeks: ${s.prev.work ? share(s.prev) : 'no data'}.\nProgrammed sets:\n${lines}\n\nIn at most 3 short sentences for the coach: which adaptations this program is mainly driving, how the emphasis is trending, and one specific, evidence-based consideration. Plain language, no headings, no bullet lists.`;
  (UI.stimAi ||= {})[aid] = { busy: true, text: '' };
  refresh();
  try {
    await streamClaude(`You are an expert strength & conditioning coach assistant for ${bizName()}. Be accurate and concise; base statements only on the data given. Coach's philosophy:\n${philosophyText()}`, [{ role: 'user', content: prompt }], t => { UI.stimAi[aid].text = t; });
  } catch (e) { UI.stimAi[aid].text = `Couldn’t reach Claude: ${e.message}`; }
  UI.stimAi[aid].busy = false;
  refresh();
};
