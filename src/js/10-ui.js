/* =========================================================
   UI helpers: icons, toasts, modals, form fields
   ========================================================= */
const ICONS = {
  home: '<path d="M3 9.5 12 3l9 6.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>',
  users: '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
  book: '<path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2zM22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/>',
  gauge: '<path d="M12 14l4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  chevL: '<polyline points="15 18 9 12 15 6"/>',
  chevR: '<polyline points="9 18 15 12 9 6"/>',
  chevU: '<polyline points="18 15 12 9 6 15"/>',
  chevD: '<polyline points="6 9 12 15 18 9"/>',
  trend: '<polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/>',
  check: '<polyline points="20 6 9 17 4 12"/>',
  x: '<path d="M18 6 6 18M6 6l12 12"/>',
  search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>',
  edit: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4z"/>',
  trash: '<polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>',
  copy: '<rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
  clock: '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
  lock: '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  download: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><path d="M12 15V3"/>',
  upload: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><path d="M12 3v12"/>',
  alert: '<path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><path d="M12 9v4M12 17h.01"/>',
  info: '<circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/>',
  checkCircle: '<path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>',
  target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
  pin: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
  clipboard: '<path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1"/>',
  ref: '<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>',
  zap: '<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/>',
  activity: '<polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>',
  bulb: '<path d="M9 18h6M10 22h4"/><path d="M12 2a7 7 0 0 0-4 12.74V17h8v-2.26A7 7 0 0 0 12 2z"/>',
  list: '<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
  grid: '<rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>',
  dumbbell: '<path d="M6.5 6.5v11M17.5 6.5v11M3 9.5v5M21 9.5v5M6.5 12h11"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>',
  smartphone: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M12 18h.01"/>',
  monitor: '<rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/>',
  trophy: '<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M17 5h3v2a3 3 0 0 1-3 3M7 5H4v2a3 3 0 0 0 3 3"/>',
  medal: '<circle cx="12" cy="15" r="6"/><path d="M8.5 10.5 6 3h4l2 5 2-5h4l-2.5 7.5"/>',
  note: '<path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z"/>',
};
function icon(name, cls = '') { return `<svg class="i ${cls}" viewBox="0 0 24 24" aria-hidden="true">${ICONS[name] || ''}</svg>`; }

/* ---------- Toast ---------- */
function toast(msg, kind) {
  let host = $('.toast-host');
  if (!host) { host = document.createElement('div'); host.className = 'toast-host'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = 'toast' + (kind === 'err' ? ' err' : '');
  el.textContent = msg;
  host.appendChild(el);
  setTimeout(() => { el.style.transition = 'opacity .3s'; el.style.opacity = '0'; setTimeout(() => el.remove(), 320); }, kind === 'err' ? 4200 : 2200);
}

/* ---------- Modal ---------- */
const modalStack = [];
function openModal({ title, body, submit = 'Save', onSubmit, onDelete, deleteLabel = 'Delete', size = '', onMount, footer = '', cancel = 'Cancel', center = false }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap' + (center ? ' center' : '');
  const hasFoot = onDelete || footer;
  wrap.innerHTML = `
    <div class="modal ${size}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
      <form class="modal-form" novalidate autocomplete="off">
        <header class="modal-head">
          <button type="button" class="btn-text" data-close>${esc(cancel)}</button>
          <h2>${esc(title)}</h2>
          ${onSubmit ? `<button type="submit" class="btn-text strong">${esc(submit)}</button>` : `<span></span>`}
        </header>
        <div class="modal-body"><div class="form-error hidden" role="alert"></div>${body}</div>
        ${hasFoot ? `<footer class="modal-foot">${onDelete ? `<button type="button" class="btn danger-ghost" data-del>${icon('trash', 'sm')}${esc(deleteLabel)}</button>` : ''}<span class="grow"></span>${footer}</footer>` : ''}
      </form>
    </div>`;
  document.body.appendChild(wrap);
  document.body.style.overflow = 'hidden';
  const form = $('form', wrap);
  const m = { wrap, form, close };
  modalStack.push(m);
  function close() {
    const i = modalStack.indexOf(m);
    if (i >= 0) modalStack.splice(i, 1);
    wrap.remove();
    if (!modalStack.length) document.body.style.overflow = '';
  }
  m.error = msg => {
    const el = $('.form-error', wrap);
    if (!msg) { el.classList.add('hidden'); return; }
    el.textContent = msg; el.classList.remove('hidden');
    $('.modal-body', wrap).scrollTop = 0;
  };
  wrap.addEventListener('mousedown', e => { if (e.target === wrap) m._bd = true; });
  wrap.addEventListener('click', e => {
    if (e.target === wrap && m._bd) close();
    m._bd = false;
    if (e.target.closest('[data-close]')) close();
  });
  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!onSubmit) return close();
    let res;
    try { res = await onSubmit(formData(form), form, m); }
    catch (err) { console.error(err); res = 'Something went wrong: ' + err.message; }
    if (typeof res === 'string') m.error(res);
    else if (res !== false) close();
  });
  if (onDelete) $('[data-del]', wrap).addEventListener('click', async () => {
    const r = await onDelete(m);
    if (r !== false) close();
  });
  onMount?.(m);
  const first = $('[autofocus]', wrap);
  if (first && window.matchMedia('(pointer:fine)').matches) setTimeout(() => first.focus(), 50);
  return m;
}
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalStack.length) { modalStack[modalStack.length - 1].close(); }
});

function formData(form) {
  const o = {};
  for (const el of form.elements) {
    if (!el.name || el.disabled) continue;
    const arr = el.name.endsWith('[]');
    const k = arr ? el.name.slice(0, -2) : el.name;
    if (el.type === 'checkbox') {
      if (arr) { (o[k] ??= []); if (el.checked) o[k].push(el.value); }
      else o[k] = el.checked;
    } else if (el.type === 'radio') {
      if (el.checked) o[k] = el.value; else if (!(k in o)) o[k] = undefined;
    } else o[k] = el.value;
  }
  return o;
}

/* Promise-based dialogs */
function choose(title, message, buttons) {
  return new Promise(resolve => {
    const wrap = document.createElement('div');
    wrap.className = 'modal-wrap center';
    wrap.innerHTML = `<div class="modal narrow dialog" role="alertdialog" aria-modal="true">
      <div class="modal-body"><h3>${esc(title)}</h3>${message ? `<p class="muted">${message}</p>` : ''}</div>
      <div class="dlg-actions">${buttons.map((b, i) => `<button type="button" class="btn ${b.style || ''}" data-i="${i}">${esc(b.label)}</button>`).join('')}</div></div>`;
    document.body.appendChild(wrap);
    const done = v => { wrap.remove(); resolve(v); };
    wrap.addEventListener('click', e => {
      const b = e.target.closest('[data-i]');
      if (b) done(buttons[+b.dataset.i].value);
      else if (e.target === wrap) done(null);
    });
  });
}
function confirmBox(title, message = '', { ok = 'Delete', danger = true } = {}) {
  return choose(title, message, [{ label: ok, value: true, style: danger ? 'danger' : 'primary' }, { label: 'Cancel', value: false }]).then(v => !!v);
}

/* ---------- Form field builders ---------- */
function field(label, input, { hint = '', unit = '', cls = '' } = {}) {
  // Inputs that contain their own labels (segmented controls) must not be wrapped in another <label>
  const tag = /<label[\s>]/.test(input) ? 'div' : 'label';
  return `<${tag} class="field ${cls}"><span class="field-label"><span>${label}</span>${unit ? `<span class="u">${unit}</span>` : ''}</span>${input}${hint ? `<span class="hint">${hint}</span>` : ''}</${tag}>`;
}
function inp(name, val = '', attrs = '') { return `<input name="${name}" value="${esc(val ?? '')}" ${attrs}>`; }
function numInp(name, val = '', attrs = '') { return `<input type="text" inputmode="decimal" name="${name}" value="${esc(val ?? '')}" ${attrs}>`; }
function sel(name, options, val, attrs = '') {
  return `<select name="${name}" ${attrs}>${options.map(o => {
    if (o.group) return `<optgroup label="${esc(o.group)}">${o.options.map(p => opt(p, val)).join('')}</optgroup>`;
    return opt(o, val);
  }).join('')}</select>`;
}
function opt(o, val) { const [v, l] = Array.isArray(o) ? o : [o, o]; return `<option value="${esc(v)}" ${String(v) === String(val ?? '') ? 'selected' : ''}>${esc(l)}</option>`; }
function ta(name, val = '', attrs = '') { return `<textarea name="${name}" ${attrs}>${esc(val ?? '')}</textarea>`; }
function segmented(name, options, val) {
  return `<div class="seg">${options.map(([v, l]) => `<label><input type="radio" name="${name}" value="${esc(v)}" ${v === val ? 'checked' : ''}><span>${esc(l)}</span></label>`).join('')}</div>`;
}
function toggleRow(name, checked, label, sub = '') {
  return `<label class="settings-row"><div class="grow"><div style="font-weight:600">${label}</div>${sub ? `<div class="muted">${sub}</div>` : ''}</div><span class="switch"><input type="checkbox" name="${name}" ${checked ? 'checked' : ''}><span></span></span></label>`;
}
function athletePicker(name, selected = [], { multi = true } = {}) {
  const list = sortedAthletes().filter(a => !a.archived || selected.includes(a.id));
  if (!list.length) return `<div class="muted small" style="padding:8px 0 12px">No athletes yet — add one from the Athletes tab.</div>`;
  const type = multi ? 'checkbox' : 'radio';
  return `<div class="picker">
    ${list.length > 8 ? `<div class="searchbox">${icon('search', 'sm')}<input type="search" placeholder="Search athletes" data-picker-search></div>` : ''}
    <div class="picker-list">${list.map(a => `<label data-name="${esc(athleteName(a).toLowerCase())}"><input type="${type}" name="${name}${multi ? '[]' : ''}" value="${a.id}" ${selected.includes(a.id) ? 'checked' : ''}><span>${esc(athleteName(a))}</span></label>`).join('')}</div>
  </div>`;
}
document.addEventListener('input', e => {
  if (e.target.matches('[data-picker-search]')) {
    const q = e.target.value.trim().toLowerCase();
    $$('.picker-list label', e.target.closest('.picker')).forEach(l => { l.style.display = !q || l.dataset.name.includes(q) || l.querySelector('input').checked ? '' : 'none'; });
  }
});
function athleteOptions(includeArchived = false, placeholder = 'Select athlete…') {
  return [['', placeholder], ...sortedAthletes().filter(a => includeArchived || !a.archived).map(a => [a.id, athleteName(a) + (a.archived ? ' (archived)' : '')])];
}
function emptyState_(ic, title, text, btn = '') {
  return `<div class="empty">${icon(ic)}<h4>${esc(title)}</h4><p>${text}</p>${btn}</div>`;
}

/* ---------- Global delegated actions ---------- */
const A = {};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = A[el.dataset.act];
  if (fn) { e.preventDefault(); e.stopPropagation(); fn(el, e); }
});
document.addEventListener('change', e => {
  const el = e.target.closest('[data-change]');
  if (el && A[el.dataset.change]) A[el.dataset.change](el, e);
});
document.addEventListener('input', e => {
  const el = e.target.closest('[data-input]');
  if (el && A[el.dataset.input]) A[el.dataset.input](el, e);
});
A.goHome = () => go('#/dashboard');
