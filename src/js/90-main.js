/* =========================================================
   Sample data, onboarding, theme and app start-up
   ========================================================= */
A.loadDemo = async () => {
  if (S.athletes.some(a => a.demo)) return toast('Sample data is already loaded');
  if (!(await confirmBox('Load sample data?', 'Adds 4 example athletes with 6 months of testing, VBT sets, programs and this week’s schedule. Everything is tagged as sample data and can be removed in one tap from Settings.', { ok: 'Load sample data', danger: false }))) return;
  buildDemo();
  toast('Sample data loaded'); refresh();
};
A.removeDemo = async () => {
  if (!(await confirmBox('Remove all sample data?', 'Only records created as sample data are removed. Your own data is untouched.', { ok: 'Remove' }))) return;
  COLS.forEach(c => S[c].filter(r => r.demo).forEach(r => removeRec(c, r.id)));
  toast('Sample data removed'); refresh();
};

function buildDemo() {
  addStarterLibrary();
  const R = rng(42);
  const n = (mu, sdv) => mu + (R() + R() + R() - 1.5) * sdv * 1.4;
  const ex = name => S.exercises.find(e => e.name === name)?.id;
  const T = today();
  const D = { demo: true };
  const people = [
    { firstName: 'Maya', lastName: 'Thompson', sport: 'Soccer', position: 'Winger', team: 'Westfield HS', dob: '2008-04-12', sex: 'F', heightCm: 165, massKg: 57, goals: 'Improve acceleration and repeat-sprint ability before fall season.', color: '#8b4ef3' },
    { firstName: 'Jordan', lastName: 'Reyes', sport: 'Football', position: 'Running back', team: 'State University', dob: '2004-09-30', sex: 'M', heightCm: 178, massKg: 88, goals: 'Increase lower-body strength and 40 yd time for pro day.', injuries: 'Left hamstring strain (2 seasons ago) — monitor high-speed running volume.', color: '#2f5bff' },
    { firstName: 'Ava', lastName: 'Chen', sport: 'Volleyball', position: 'Outside hitter', team: 'Club 17s', dob: '2007-01-22', sex: 'F', heightCm: 180, massKg: 68, goals: 'Vertical jump and landing mechanics.', color: '#0e9384' },
    { firstName: 'Marcus', lastName: 'Bell', sport: 'Basketball', position: 'Guard', team: 'Lincoln HS', dob: '2007-07-08', sex: 'M', heightCm: 185, massKg: 77, goals: 'Get stronger without losing reactive ability.', color: '#e0661b' },
  ];
  const created = people.map(p => upsert('athletes', { ...p, ...D, email: '', phone: '', archived: false, createdAt: Date.now() - 200 * 864e5 }));
  const [maya, jordan, ava, marcus] = created;

  /* Testing: 6 sessions, ~4 weeks apart, with trends tailored to each athlete */
  const plan = [
    { a: maya, base: { sprint10: 1.98, sprint20: 3.35, fly10: 1.30, cmj: 33, sj: 32, broad: 205, djHeight: 27, djGct: 0.215, cmjPF: 1390, cmjPP: 2650, imtpPF: 1620, ttt: 0.78, asym: 6 }, step: { sprint10: -0.012, sprint20: -0.02, fly10: -0.004, cmj: 0.5, sj: 0.4, broad: 2, djHeight: 0.4, djGct: -0.002, cmjPF: 12, cmjPP: 35, imtpPF: 25, ttt: -0.008, asym: -0.3 } },
    { a: jordan, base: { sprint10: 1.74, sprint40yd: 4.72, fly10: 1.05, cmj: 58, sj: 54, broad: 280, djHeight: 44, djGct: 0.19, cmjPF: 2480, cmjPP: 5600, imtpPF: 3350, ttt: 0.72, asym: 9 }, step: { sprint10: -0.008, sprint40yd: -0.018, fly10: -0.003, cmj: 0.6, sj: 0.6, broad: 1.5, djHeight: 0.3, djGct: 0, cmjPF: 10, cmjPP: 45, imtpPF: 60, ttt: -0.004, asym: 1.4 } },
    { a: ava, base: { sprint10: 2.02, cmj: 42, sj: 41.5, vj: 52, broad: 230, djHeight: 33, djGct: 0.29, cmjPF: 1850, cmjPP: 3500, imtpPF: 2050, ttt: 0.86, asym: 5 }, step: { sprint10: -0.004, cmj: 0.35, sj: 0.5, vj: 0.4, broad: 1, djHeight: 0.4, djGct: -0.004, cmjPF: 15, cmjPP: 30, imtpPF: 30, ttt: -0.006, asym: 0 } },
    { a: marcus, base: { sprint10: 1.80, sprint20: 3.05, fly10: 1.12, proAgility: 4.55, cmj: 52, sj: 47, vj: 70, broad: 255, djHeight: 40, djGct: 0.18, cmjPF: 1900, cmjPP: 4400, imtpPF: 2650, ttt: 0.70, asym: 7 }, step: { sprint10: -0.004, sprint20: -0.006, fly10: -0.003, proAgility: -0.02, cmj: 0.3, sj: 0.3, vj: 0.3, broad: 1.2, djHeight: 0.3, djGct: 0, cmjPF: 8, cmjPP: 25, imtpPF: 45, ttt: -0.003, asym: 0 } },
  ];
  plan.forEach((p, ai) => {
    for (let i = 0; i < 6; i++) {
      const date = addDays(T, -(150 - i * 28) - ai);
      const m = {};
      Object.entries(p.base).forEach(([k, v]) => {
        const def = M[k]; const noise = (def.te || 3) / 100 * 0.45 * Math.abs(v);
        let val = v + p.step[k] * i * (k === 'asym' ? 1 : 1) + n(0, noise);
        if (p.a === marcus && k === 'cmj' && i === 5) val = v + p.step[k] * 4 - v * 0.07; // fatigue dip in latest test
        m[k] = round(Math.max(0, val), def.unit === 's' ? 3 : def.kind === 'len' ? 1 : def.unit === '%' ? 1 : 0);
      });
      upsert('tests', { ...D, athleteId: p.a.id, date, m, bodyMassKg: round(p.a.massKg + n(0, 0.6) + i * (p.a === jordan ? 0.4 : 0.1), 1), asymSide: p.a === jordan ? 'Right' : '', notes: i === 0 ? 'Baseline battery' : '' });
    }
  });

  /* VBT: back squat & bench, last ~10 weeks, linear L–V relationship + noise; progressing strength */
  const lv = [
    { a: jordan, ex: 'Back Squat', orm: 165, mvt: 0.30, v0: 1.62 },
    { a: jordan, ex: 'Bench Press', orm: 120, mvt: 0.17, v0: 1.55 },
    { a: marcus, ex: 'Back Squat', orm: 125, mvt: 0.30, v0: 1.6 },
    { a: maya, ex: 'Trap Bar Deadlift', orm: 115, mvt: 0.20, v0: 1.5 },
    { a: ava, ex: 'Back Squat', orm: 92, mvt: 0.30, v0: 1.58 },
  ];
  lv.forEach(cfg => {
    const exId = ex(cfg.ex);
    for (let wk = 0; wk < 10; wk++) {
      for (const dayOff of [0, 3]) {
        const date = addDays(startOfWeek(T), -7 * (9 - wk) + 1 + dayOff + (cfg.a === marcus ? 1 : 0));
        if (date > T) continue;
        const orm = cfg.orm * (1 + wk * 0.006);
        const slope = (cfg.mvt - cfg.v0) / orm;
        const fatigue = cfg.a === marcus && daysBetween(date, T) <= 4 ? -0.08 : 0;
        const pcts = dayOff === 0 ? [0.5, 0.65, 0.8, 0.85] : [0.4, 0.55, 0.7];
        pcts.forEach(pc => {
          const load = roundLoad(orm * pc);
          const vb = cfg.v0 + slope * load + n(0, 0.025) + fatigue;
          const reps = pc >= 0.8 ? 3 : 5;
          const vl = pc >= 0.8 ? 0.18 : 0.10;
          const rv = [...Array(reps)].map((_, r) => round(vb * (1 - vl * (r / (reps - 1)) ** 1.3) + n(0, 0.008), 2));
          rv[0] = round(vb, 2);
          const st = velStats(rv);
          upsert('vbt', { ...D, athleteId: cfg.a.id, exerciseId: exId, date, load, reps: rv, n: st.n, vBest: st.best, vMean: st.mean, vl: st.vl, peak: null, notes: '' });
        });
      }
    }
  });
  upsert('maxes', { ...D, athleteId: jordan.id, exerciseId: ex('Back Squat'), kg: 160, date: addDays(T, -85), notes: 'Pre-block test' });

  /* Programs: 2 per week per athlete, from 4 weeks ago to 2 weeks ahead */
  const lower = (sq) => [
    { exerciseId: ex('Countermovement Jump'), sets: '3', reps: '3', intensity: 'bw', notes: 'Max intent' },
    { exerciseId: ex(sq), sets: '4', reps: '3-5', intensity: 'zone', zone: 'acc', vlCutoff: 20, rest: '2–3 min' },
    { exerciseId: ex('Romanian Deadlift'), sets: '3', reps: '6', intensity: 'rpe', rpe: 7, rest: '90 s' },
    { exerciseId: ex('Rear-Foot Elevated Split Squat'), sets: '3', reps: '6/side', intensity: 'rpe', rpe: 7 },
    { exerciseId: ex('Copenhagen Plank'), sets: '3', reps: '20 s/side', intensity: 'bw' },
  ];
  const speed = () => [
    { exerciseId: ex('A-Skip'), sets: '2', reps: '20 m', intensity: 'bw' },
    { exerciseId: ex('Acceleration Sprint (10–20 m)'), sets: '6', reps: '1 × 15 m', intensity: 'bw', rest: '2 min', notes: 'Full recovery, timed' },
    { exerciseId: ex('Flying Sprint (10–30 m)'), sets: '4', reps: '1 × 20 m fly', intensity: 'bw', rest: '3 min' },
    { exerciseId: ex('Hurdle Hops'), sets: '3', reps: '5', intensity: 'bw' },
    { exerciseId: ex('Bench Press'), sets: '4', reps: '4', intensity: 'pct', pct: 80, vlCutoff: 20, rest: '2–3 min' },
  ];
  created.forEach((a, ai) => {
    const sq = a === maya ? 'Trap Bar Deadlift' : 'Back Squat';
    for (let wk = -4; wk <= 2; wk++) {
      [[1, 'Lower — Strength', lower(sq)], [4, 'Speed + Upper', speed()]].forEach(([dow, title, items]) => {
        const date = addDays(startOfWeek(T), wk * 7 + dow);
        const past = date < T;
        const rpe = Math.min(10, Math.max(3, Math.round(n(6.3, 1) + (a === jordan && wk === -1 ? 2 : 0))));
        const dur = a === jordan && wk === -1 ? 90 : 65;
        upsert('workouts', { ...D, athleteId: a.id, date, title, phase: wk < 0 ? 'Block 2 — Strength' : 'Block 3 — Power', notes: '', items: items.filter(i => i.exerciseId).map(i => ({ ...blankItem(), ...i, id: uid() })), completed: past, rpe: past ? rpe : null, durationMin: past ? dur : null });
        if (a === jordan && wk === -1) upsert('workouts', { ...D, athleteId: a.id, date: addDays(date, 1), title: 'Extra conditioning', phase: 'Block 2 — Strength', items: [{ ...blankItem(), exerciseId: ex('Tempo Runs'), sets: '1', reps: '12 × 100 m', intensity: 'bw' }], completed: true, rpe: 8, durationMin: 60 });
      });
    }
  });

  /* Calendar: this week + next week, plus evaluations */
  const slots = [['06:30', jordan], ['15:30', maya], ['16:30', marcus], ['17:30', ava]];
  for (let wk = -2; wk <= 1; wk++) {
    [1, 4].forEach(dow => {
      slots.forEach(([start, a]) => {
        const date = addDays(startOfWeek(T), wk * 7 + dow);
        upsert('events', { ...D, type: 'session', date, start, duration: 60, athleteIds: [a.id], title: '', location: 'Main facility', notes: '', status: date < T ? 'completed' : 'scheduled' });
      });
    });
  }
  upsert('events', { ...D, type: 'session', date: T, start: '07:30', duration: 60, athleteIds: [maya.id, ava.id], title: 'Speed group', location: 'Turf', notes: 'Acceleration focus — bring timing gates', status: 'scheduled' });
  upsert('events', { ...D, type: 'evaluation', date: addDays(T, 3), start: '16:00', duration: 90, athleteIds: [marcus.id], title: '', location: 'Main facility', notes: 'Full battery: 10/20 m, flying 10, CMJ, SJ, DJ, IMTP', status: 'scheduled' });
  upsert('events', { ...D, type: 'evaluation', date: addDays(T, 9), start: '07:00', duration: 90, athleteIds: [jordan.id], title: 'Pre-pro-day testing', location: 'Indoor track', notes: '', status: 'scheduled' });
  upsert('events', { ...D, type: 'consult', date: addDays(T, 1), start: '12:00', duration: 30, athleteIds: [ava.id], title: 'Parent check-in — Ava', location: 'Zoom', notes: '', status: 'scheduled' });
  upsert('notes', { ...D, athleteId: jordan.id, date: addDays(T, -6), text: 'Reported tight right hamstring after Thursday sprints. Reduced fly volume; monitor.' });
  upsert('notes', { ...D, athleteId: marcus.id, date: addDays(T, -2), text: 'Exams this week — sleeping ~6 h. Expect lower readiness.' });
}

/* ---------- Onboarding ---------- */
function onboarding() {
  openModal({
    title: 'Welcome', submit: 'Get started', cancel: 'Skip',
    body: `<div style="text-align:center;margin:4px 0 18px"><div class="brand-mark" style="width:56px;height:56px;border-radius:16px;margin:0 auto 12px">${BOLT}</div>
      <h3 style="font-size:20px">${APP_NAME}</h3><p class="muted small">Your private sports-performance workspace. Everything is stored on this device and works offline.</p></div>
      ${field('Business name', inp('businessName', '', 'placeholder="e.g. Apex Performance"'))}
      ${field('Your name', inp('coachName', '', 'placeholder="Coach"'))}
      ${field('Units', segmented('units', [['imperial', 'Imperial (lb, in)'], ['metric', 'Metric (kg, cm)']], 'imperial'))}
      <label class="check"><input type="checkbox" name="starter" checked> Add the starter exercise library (${STARTER.length} exercises, fully editable)</label>
      <label class="check"><input type="checkbox" name="demo"> Load sample athletes & data to explore (removable)</label>`,
    onSubmit: v => {
      Object.assign(S.settings, { businessName: v.businessName.trim(), coachName: v.coachName.trim(), units: v.units || 'imperial', onboarded: true });
      if (v.starter) addStarterLibrary();
      if (v.demo) buildDemo();
      persist(); updateBrand(); refresh();
    },
  });
  // "Skip" still counts as onboarded
  S.settings.onboarded = true; persist();
}

/* ---------- Theme, brand, shell ---------- */
const BOLT = '<svg viewBox="0 0 24 24" width="60%" height="60%" aria-hidden="true"><path d="M13.5 2 4 13.5h6.5L9.5 22 20 9.5h-6.5z" fill="#fff"/></svg>';
function applyTheme() {
  const t = S.settings.theme;
  if (t === 'light' || t === 'dark') document.documentElement.setAttribute('data-theme', t);
  else document.documentElement.removeAttribute('data-theme');
  const dark = t === 'dark' || (t !== 'light' && window.matchMedia('(prefers-color-scheme: dark)').matches);
  $('meta[name="theme-color"]')?.setAttribute('content', dark ? '#0b0d12' : '#f4f5f8');
}
window.matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', applyTheme);
function updateBrand() {
  const el = $('#brandSub');
  if (el) el.textContent = S.settings.businessName || 'Coach workspace';
}
const NAV = [['dashboard', 'Dashboard', 'home'], ['calendar', 'Calendar', 'calendar'], ['athletes', 'Athletes', 'users'], ['library', 'Library', 'book'], ['vbt', 'VBT', 'gauge']];
function buildShell() {
  $('#app').innerHTML = `
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">${BOLT}</div><div><div class="brand-name">${APP_NAME}</div><div class="brand-sub" id="brandSub"></div></div></div>
      ${NAV.map(([k, l, ic]) => `<a class="nav-link" data-nav="${k}" href="#/${k}">${icon(ic)}${l}</a>`).join('')}
      <a class="nav-link" data-nav="insights" href="#/insights">${icon('bulb')}Insights</a>
      <span class="nav-spacer"></span>
      <a class="nav-link" data-nav="settings" href="#/settings">${icon('settings')}Settings</a>
    </aside>
    <div class="main"><header class="topbar" id="topbar"></header><main class="view" id="view"></main></div>
    <nav class="tabbar">${NAV.map(([k, l, ic]) => `<a class="tab" data-nav="${k}" href="#/${k}">${icon(ic)}<span>${l}</span></a>`).join('')}</nav>`;
  updateBrand();
  window.addEventListener('scroll', () => $('#topbar')?.classList.toggle('scrolled', window.scrollY > 4), { passive: true });
}
document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
});

async function boot() {
  buildShell();
  const mode = await Store.init();
  try {
    const saved = await Store.get('state');
    if (saved) S = normalizeState(saved);
  } catch (e) {
    console.error(e);
    toast('Could not read saved data', 'err');
  }
  applyTheme(); updateBrand();
  if (navigator.storage?.persist) navigator.storage.persist().catch(() => {});
  if (S.settings.lockEnabled && S.settings.pinHash) showLock();
  window.addEventListener('hashchange', render);
  render();
  if (!S.settings.onboarded && !S.athletes.length && mode !== 'none') onboarding();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    navigator.serviceWorker.register('sw.js').catch(err => console.warn('SW registration failed', err));
  }
}
boot();
