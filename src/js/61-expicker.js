/* =========================================================
   Exercise picker: search, this athlete's recent exercises first,
   categories, and several exercises in one go (workout builder, session log)
   ========================================================= */
// Short names coaches type → words in the library names
const EX_ALIASES = {
  db: ['dumbbell'], kb: ['kettlebell'], bb: ['barbell'], rdl: ['romanian deadlift'], sldl: ['stiff leg'], ohp: ['overhead press'],
  bss: ['bulgarian split squat', 'rear foot elevated split squat'], rfess: ['rear foot elevated split squat'], rfe: ['rear foot elevated'], ffe: ['front foot elevated'],
  sl: ['single leg'], sa: ['single arm'], cmj: ['countermovement jump'], sj: ['squat jump'], dj: ['drop jump', 'depth'], imtp: ['isometric mid thigh pull'],
  iso: ['isometric'], ghr: ['glute ham'], mb: ['med ball'], hex: ['trap bar', 'hex bar'], cod: ['change of direction'], oly: ['clean', 'snatch', 'jerk'],
};
const xpNorm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
/* Every typed word must start a word in the name or category (or be a known short name, or part of a joined word like "pullup") */
function xpMatch(hay, q) {
  const words = xpNorm(q).split(' ').filter(Boolean);
  if (!words.length) return true;
  const h = ' ' + hay, joined = hay.replace(/ /g, '');
  return words.every(w => h.includes(' ' + w) || (w.length >= 4 && joined.includes(w)) || (EX_ALIASES[w] || []).some(a => h.includes(' ' + a)));
}
/* An athlete's workouts nearest a date: on or before it (latest first), then after it (soonest first) */
function athWorkoutsNear(aid, date, exceptId) {
  return S.workouts.filter(w => w.athleteId === aid && w.id !== exceptId).sort((a, b) => {
    const pa = a.date <= date, pb = b.date <= date;
    if (pa !== pb) return pa ? -1 : 1;
    return pa ? b.date.localeCompare(a.date) : a.date.localeCompare(b.date);
  });
}
/* exerciseId → the athlete's nearest prescription of it ({ it, date }) */
function lastRxMap(aid, date, exceptId) {
  const map = new Map();
  if (!aid) return map;
  athWorkoutsNear(aid, date, exceptId).forEach(w => (w.items || []).forEach(it => { if (it.exerciseId && !map.has(it.exerciseId) && getExercise(it.exerciseId)) map.set(it.exerciseId, { it, date: w.date }); }));
  return map;
}
/* "4 × 3-5 @ 225 lb" */
function rxShort(it) {
  const fpt = fpTestOf(getExercise(it.exerciseId));
  if (fpt) return plural(fpTrialsN(it, fpt), 'trial');
  const sr = it.sets || it.reps ? `${it.sets || '–'} × ${it.reps || '–'}` : '';
  const lo = it.vMin ?? it.vMax, hi = it.vMax ?? it.vMin;
  const iv = {
    load: it.loads?.length > 1 ? `${it.loads.map(x => fmtMass(x, false)).join('/')} ${U.mass()}` : it.load != null ? fmtMass(it.load) : '',
    pct: it.pct != null ? `${fmtNum(it.pct, 1, 0)}% 1RM` : '',
    rir: it.rir != null ? `${fmtNum(it.rir, 1, 0)} RIR` : '',
    zone: ZONES.find(z => z.key === it.zone)?.name || '',
    vel: lo != null ? `${fmtNum(lo, 2)}${hi !== lo ? '–' + fmtNum(hi, 2) : ''} m/s` : '',
    rpe: it.rpe != null ? `RPE ${fmtNum(it.rpe, 1, 0)}` : '',
  }[it.intensity] || '';
  return [sr, iv].filter(Boolean).join(' @ ');
}
/* Opens the picker; resolves with the chosen exercise ids in the order tapped ([] if cancelled).
   multi: tap several, then Add. Otherwise one tap chooses (changing a workout's exercise). */
function openExercisePicker({ aid, date = today(), wid = null, multi = true, current = '', title } = {}) {
  return new Promise(resolve => {
    let picked = [], cat;
    const sel = [];
    const a = getAthlete(aid);
    const last = lastRxMap(aid, date, wid);
    // recent: this athlete's exercises, else what has been programmed lately for anyone
    let recent = [...last.keys()].slice(0, 12), recentLabel = `Recent for ${a ? a.firstName || athleteName(a, true) : 'this athlete'}`;
    if (!recent.length) {
      const seen = new Set();
      [...S.workouts].sort((x, y) => y.date.localeCompare(x.date)).forEach(w => (w.items || []).forEach(it => { if (it.exerciseId && getExercise(it.exerciseId)) seen.add(it.exerciseId); }));
      recent = [...seen].slice(0, 12); recentLabel = 'Recently programmed';
    }
    cat = recent.length ? 'recent' : 'all';
    const cats = () => { const c = EX_CATS.filter(k => S.exercises.some(e => e.category === k)); if (S.exercises.some(e => !EX_CATS.includes(e.category))) c.push('Other'); return c; };
    const inCat = (e, k) => (k === 'Other' ? !EX_CATS.includes(e.category) || e.category === 'Other' : e.category === k);
    const row = e => {
      const l = last.get(e.id);
      return `<button type="button" class="xp-row" data-xp-id="${esc(e.id)}" data-q="${esc(xpNorm(`${e.name} ${e.category || ''}`))}" ${multi ? 'aria-pressed="false"' : ''}>
        <span class="xp-main"><span class="xp-nm">${esc(e.name)}${e.vbt ? ' <span class="xp-vbt" title="VBT-tracked">⚡</span>' : ''}${e.id === current ? ' <span class="badge">now</span>' : ''}</span>
        ${l ? `<span class="xp-sub">Last ${esc(fmtDate(l.date, { month: 'short', day: 'numeric' }))}: ${esc(rxShort(l.it)) || 'planned'}</span>` : fpTestOf(e) ? '<span class="xp-sub">Force plate test</span>' : ''}</span>
        ${multi ? '<span class="xp-tick" aria-hidden="true"></span>' : ''}</button>`;
    };
    const listHtml = () => {
      const byName = (x, y) => x.name.localeCompare(y.name);
      const secs = recent.length ? [`<div class="xp-sec" data-sec="recent"><div class="kicker xp-h">${esc(recentLabel)}</div>${recent.map(id => row(getExercise(id))).join('')}</div>`] : [];
      cats().forEach(k => secs.push(`<div class="xp-sec" data-sec="${esc(k)}"><div class="kicker xp-h">${esc(k)}</div>${S.exercises.filter(e => inCat(e, k)).sort(byName).map(row).join('')}</div>`));
      return secs.join('');
    };
    const chipsHtml = () => [...(recent.length ? [['recent', 'Recent']] : []), ['all', 'All'], ...cats().map(k => [k, k])]
      .map(([k, l]) => `<button type="button" class="chip${k === cat ? ' on' : ''}" data-xp-cat="${esc(k)}">${esc(l)}</button>`).join('');
    const m = openModal({
      title: title || (multi ? 'Add exercises' : 'Change exercise'), size: 'narrow', submit: 'Add',
      body: `<div class="xp">
        <div class="xp-top">
          <input type="search" data-xp-q placeholder="Search ${S.exercises.length} exercises" aria-label="Search exercises" autocomplete="off" autocorrect="off" autocapitalize="off" spellcheck="false" enterkeyhint="search" autofocus>
          <div class="chips scroll xp-cats" data-xp-cats>${chipsHtml()}</div>
        </div>
        <div data-xp-list>${listHtml()}</div>
        <p class="xp-none" data-xp-none hidden>No exercise matches. Add it to the library:</p>
        <button type="button" class="btn block" data-xp-new>${icon('plus', 'sm')}<span data-xp-newl>New exercise</span></button>
      </div>`,
      footer: multi ? '<button type="submit" class="btn primary" data-xp-add disabled>Tap exercises to add</button>' : '',
      onSubmit: () => {
        const vis = $$('.xp-row', m.wrap).filter(r => !r.hidden && !r.closest('.xp-sec').hidden);
        if (!sel.length && $('[data-xp-q]', m.wrap).value.trim() && new Set(vis.map(r => r.dataset.xpId)).size === 1) sel.push(vis[0].dataset.xpId);
        if (!sel.length) return multi ? 'Tap the exercises to add.' : false;
        picked = [...sel];
      },
      onMount: mm => {
        const q = $('[data-xp-q]', mm.wrap), list = $('[data-xp-list]', mm.wrap), chips = $('[data-xp-cats]', mm.wrap);
        if (!multi) $('.modal-head button[type=submit]', mm.wrap)?.replaceWith(document.createElement('span'));
        const apply = () => {
          const text = q.value.trim();
          let shown = 0;
          $$('.xp-sec', list).forEach(sec => {
            const k = sec.dataset.sec, on = text ? k !== 'recent' : cat === 'all' ? k !== 'recent' : k === cat;
            let n = 0;
            $$('.xp-row', sec).forEach(r => { const ok = on && (!text || xpMatch(r.dataset.q, text)); r.hidden = !ok; if (ok) n++; });
            sec.hidden = !n; shown += n;
          });
          $('[data-xp-none]', mm.wrap).hidden = shown > 0;
          $('[data-xp-newl]', mm.wrap).textContent = text ? `New exercise “${text}”` : 'New exercise';
        };
        const paint = () => {
          $$('.xp-row', list).forEach(r => {
            const k = sel.indexOf(r.dataset.xpId);
            r.classList.toggle('on', k >= 0);
            if (multi) { r.setAttribute('aria-pressed', String(k >= 0)); r.querySelector('.xp-tick').textContent = k >= 0 ? String(k + 1) : ''; }
          });
          const add = $('[data-xp-add]', mm.wrap), head = $('.modal-head button[type=submit]', mm.wrap);
          if (add) { add.disabled = !sel.length; add.textContent = sel.length ? `Add ${plural(sel.length, 'exercise')}` : 'Tap exercises to add'; }
          if (head) head.textContent = sel.length ? `Add ${sel.length}` : 'Add';
        };
        const setCat = k => { cat = k; $$('[data-xp-cat]', chips).forEach(c => c.classList.toggle('on', c.dataset.xpCat === k)); };
        chips.addEventListener('click', e => {
          const c = e.target.closest('[data-xp-cat]');
          if (!c) return;
          q.value = ''; setCat(c.dataset.xpCat); apply();
          $('.modal-body', mm.wrap).scrollTop = 0;
        });
        q.addEventListener('input', () => { if (q.value.trim() && cat !== 'all') setCat('all'); apply(); });
        list.addEventListener('click', e => {
          const r = e.target.closest('.xp-row');
          if (!r) return;
          const id = r.dataset.xpId;
          if (!multi) { picked = [id]; mm.close(); return; }
          const k = sel.indexOf(id);
          if (k >= 0) sel.splice(k, 1); else sel.push(id);
          paint(); mm.error('');
        });
        $('[data-xp-new]', mm.wrap).addEventListener('click', async () => {
          const ex = await quickExercise(q.value.trim(), EX_CATS.includes(cat) ? cat : '');
          if (!ex) return;
          if (!multi) { picked = [ex.id]; mm.close(); return; }
          sel.push(ex.id);
          list.innerHTML = listHtml(); chips.innerHTML = chipsHtml();
          q.value = ''; setCat(EX_CATS.includes(ex.category) ? ex.category : 'all');
          apply(); paint();
          list.querySelector(`.xp-row.on[data-xp-id="${CSS.escape(ex.id)}"]`)?.scrollIntoView({ block: 'nearest' });
        });
        apply(); paint();
      },
    });
    const obs = new MutationObserver(() => { if (!document.body.contains(m.wrap)) { obs.disconnect(); resolve(picked); } });
    obs.observe(document.body, { childList: true });
  });
}
