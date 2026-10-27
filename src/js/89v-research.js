/* =========================================================
   Research AI: strength & conditioning questions answered from the research.
   Claude searches the literature (web search), opens and reads the key sources (web fetch),
   cross-checks and appraises them, then answers with references. The app then checks every
   reference link against the pages actually found or opened during that research.
   No athlete data is sent. Needs an Anthropic API key and an internet connection.
   ========================================================= */
const RS = { msgs: [], busy: false, live: null, abort: null, loaded: false };
const RS_MAX_CONTINUE = 4;
const RS_STARTERS = [
  'Is plyometric training safe and effective for 10–13 year olds?',
  'What velocity-loss threshold is best for strength vs power in high school athletes?',
  'Does resisted sled sprinting improve acceleration more than free sprinting?',
  'How should strength training change around peak height velocity?',
];

function researchSystemPrompt() {
  return `You are the research assistant in ${bizName()}'s private coaching app: a strength and conditioning scientist and experienced coach, expert at finding, reading and critically appraising sport-science research. The coach mostly trains youth athletes (10–18) for speed, strength, power and jumping, using velocity-based training and OVR force plates.

Before answering any question that depends on evidence:
1. Pin down the question: population (age, sex, training level, sport), intervention or exposure, comparison and outcome.
2. Search for the best available evidence. Prefer systematic reviews and meta-analyses and position statements (e.g. NSCA, ACSM, UKSCA, IOC), then randomized controlled trials, then other studies. Prefer peer-reviewed journals, PubMed/PMC, DOI and journal pages over blogs, commercial or social-media sources.
3. Open the key sources and confirm they say what you will claim: read the abstract and results, not only the title. Check important claims against at least two independent sources when they exist. When sources disagree, explain why (population, methods, training status, outcome measures).
4. Appraise each key source: design, sample size and population, effect sizes and practical relevance, limitations and how recent it is. Say when youth data are lacking and you are extrapolating from adults.
5. Then write the answer.

Answer format (it is read on a phone; keep it tight):
**Bottom line:** 2–4 sentences.
**What the research shows:** short bullets, each with author and year.
**How to apply it:** specific, practical guidance for youth athletes when relevant (sets, reps, intensity, frequency, progressions, safety).
**Certainty:** High, Moderate, Low or Very low, with one line on why.
**References:** a numbered list, each as Authors (Year). Title. Journal. followed by a markdown link [link](URL) to the exact page you found or opened.

Rules:
- Never invent studies, authors, numbers, quotes or links. Only list references you found or opened while researching this question. If you mention something from memory that you could not find, mark it "(not verified)".
- If the evidence is thin, mixed or absent, say so plainly rather than overstating it.
- Simple definitions or arithmetic don't need a search.
- No medical diagnosis: for pain, injury or medical conditions give general information and recommend a physician or physical therapist.
- Where the evidence allows, align practical advice with the coach's philosophy below.

Coach's training philosophy:
${philosophyText()}`;
}

/* ---------- Streaming with full content-block reconstruction (needed to resume a paused turn) ---------- */
async function rsStream(body, onEvent, signal) {
  const res = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: claudeHeaders(), body: JSON.stringify({ ...body, stream: true }), signal });
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error?.message || msg; } catch { }
    if (res.status === 401) msg = 'The API key was rejected. Check it in console.anthropic.com.';
    if (res.status === 429) msg = 'Rate limited. Wait a moment and try again.';
    if (res.status === 529) msg = 'Claude is busy right now. Try again in a minute.';
    throw new Error(msg);
  }
  const reader = res.body.getReader(), dec = new TextDecoder();
  const msg = { content: [], stop_reason: null, stop_details: null, usage: null };
  let buf = '';
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += dec.decode(value, { stream: true });
    let i;
    while ((i = buf.indexOf('\n\n')) >= 0) {
      const chunk = buf.slice(0, i); buf = buf.slice(i + 2);
      const line = chunk.split('\n').find(l => l.startsWith('data:'));
      if (!line) continue;
      let ev; try { ev = JSON.parse(line.slice(5)); } catch { continue; }
      if (ev.type === 'message_start') msg.usage = ev.message?.usage || null;
      else if (ev.type === 'content_block_start') {
        const b = JSON.parse(JSON.stringify(ev.content_block || {}));
        if (b.type === 'server_tool_use' || b.type === 'tool_use') b._json = '';
        msg.content[ev.index] = b;
      } else if (ev.type === 'content_block_delta') {
        const b = msg.content[ev.index], d = ev.delta || {};
        if (!b) continue;
        if (d.type === 'text_delta') b.text = (b.text || '') + d.text;
        else if (d.type === 'citations_delta') (b.citations ||= []).push(d.citation);
        else if (d.type === 'input_json_delta') b._json = (b._json || '') + (d.partial_json || '');
        else if (d.type === 'thinking_delta') b.thinking = (b.thinking || '') + d.thinking;
        else if (d.type === 'signature_delta') b.signature = d.signature;
      } else if (ev.type === 'content_block_stop') {
        const b = msg.content[ev.index];
        if (b && '_json' in b) { try { b.input = b._json ? JSON.parse(b._json) : (b.input || {}); } catch { b.input = b.input || {}; } delete b._json; }
      } else if (ev.type === 'message_delta') {
        if (ev.delta?.stop_reason) msg.stop_reason = ev.delta.stop_reason;
        if (ev.delta?.stop_details) msg.stop_details = ev.delta.stop_details;
        if (ev.usage) msg.usage = { ...(msg.usage || {}), ...ev.usage };
      } else if (ev.type === 'error') throw new Error(ev.error?.message || 'Stream error');
      onEvent?.(ev, msg);
    }
  }
  msg.content = msg.content.filter(Boolean);
  return msg;
}

/* ---------- Turning the response blocks into an answer + its evidence trail ---------- */
function rsNormUrl(u) {
  try { const x = new URL(u); return (x.hostname.replace(/^www\./, '') + x.pathname.replace(/\/+$/, '')).toLowerCase(); } catch { return String(u || '').toLowerCase(); }
}
const rsDoi = u => (decodeURIComponent(String(u || '')).match(/10\.\d{4,9}\/[^\s?#&]+/i) || [''])[0].replace(/[.,;)]+$/, '').toLowerCase();
function rsDigest(blocks) {
  const searches = [], fetched = [], found = new Map(), segs = [], notes = [];
  let lastTool = -1;
  blocks.forEach((b, i) => {
    if (b.type === 'server_tool_use') {
      lastTool = i;
      if (b.name === 'web_search' && b.input?.query) searches.push(b.input.query);
    } else if (b.type === 'web_search_tool_result') {
      lastTool = i;
      if (Array.isArray(b.content)) b.content.forEach(r => { if (r?.url && /^https?:/i.test(r.url)) found.set(rsNormUrl(r.url), { url: r.url, title: r.title || r.url }); });
      else if (b.content?.error_code) notes.push(`A search failed (${b.content.error_code}).`);
    } else if (b.type === 'web_fetch_tool_result') {
      lastTool = i;
      const c = b.content;
      if (c?.type === 'web_fetch_result' && /^https?:/i.test(c.url || '')) {
        const doc = { url: c.url, title: c.content?.title || c.url };
        fetched.push(doc); found.set(rsNormUrl(c.url), doc);
      } else if (c?.error_code) notes.push(`A page couldn’t be opened (${c.error_code}).`);
    } else if (b.type !== 'text' && b.type !== 'thinking' && b.type !== 'redacted_thinking') lastTool = i;
  });
  blocks.forEach((b, i) => {
    if (b.type !== 'text' || (lastTool >= 0 && i < lastTool)) return;
    const cites = (b.citations || []).map(c => {
      if (c.type === 'web_search_result_location' && /^https?:/i.test(c.url || '')) return { url: c.url, title: c.title || c.url, quote: c.cited_text || '' };
      const doc = fetched[c.document_index] || fetched.find(d => d.title === c.document_title);
      return doc ? { url: doc.url, title: doc.title, quote: c.cited_text || '' } : null;
    }).filter(Boolean);
    segs.push({ text: b.text || '', cites });
  });
  return { segs, searches, fetched, found: [...found.values()], notes };
}
/* Every link in the answer is checked against the pages found or opened during this research */
function rsRefCheck(text, found) {
  const keys = new Set(found.map(f => rsNormUrl(f.url))), dois = new Set(found.map(f => rsDoi(f.url)).filter(Boolean));
  const urls = [...new Set([...String(text).matchAll(/\]\((https?:\/\/[^\s)]+)\)/g)].map(m => m[1]).concat([...String(text).matchAll(/(?:^|[\s(])(https?:\/\/[^\s)<>\]]+)/g)].map(m => m[1])))];
  const ok = u => keys.has(rsNormUrl(u)) || (rsDoi(u) && dois.has(rsDoi(u)));
  return { total: urls.length, verified: urls.filter(ok).length, ok };
}
function rsRender(m) {
  const allCites = [], idx = new Map();
  const text = m.segs.map(s => s.text + s.cites.map(c => {
    if (!idx.has(c.url)) { idx.set(c.url, allCites.length); allCites.push(c); }
    return `[[c:${idx.get(c.url)}]]`;
  }).join('')).join('');
  const check = rsRefCheck(text, m.found || []);
  // Links first (the text is already escaped), then the citation markers, whose tooltips may contain URLs
  let html = mdLite(text.trim());
  const mark = u => (check.ok(u) ? '<span class="ref-ok" title="Found or opened during this research">✓</span>' : '<span class="ref-warn" title="Not found during this research. Check it before relying on it.">⚠</span>');
  const unesc = u => u.replace(/&amp;/g, '&');
  html = html.replace(/\[([^\]<]+)\]\((https?:\/\/[^\s)<"]+)\)/g, (_, t, u) => `<a href="${u}" target="_blank" rel="noopener noreferrer">${t}</a>${mark(unesc(u))}`);
  html = html.replace(/(^|[\s(])(https?:\/\/[^\s)<"\]]+)/g, (_, pre, u) => `${pre}<a href="${u}" target="_blank" rel="noopener noreferrer">${u}</a>${mark(unesc(u))}`);
  html = html.replace(/\[\[c:(\d+)\]\]/g, (_, n) => { const c = allCites[+n]; return c ? `<a class="rs-cite" href="${esc(c.url)}" target="_blank" rel="noopener noreferrer" title="${esc(c.title)}${c.quote ? ': “' + esc(c.quote) + '”' : ''}">↗</a>` : ''; });
  const checkBox = check.total ? `<div class="rs-check ${check.verified < check.total ? 'warn' : ''}">${check.verified === check.total ? `✓ All ${check.total} reference link${check.total === 1 ? ' was' : 's were'} found or opened during this research.` : `⚠ ${check.total - check.verified} of ${check.total} reference links weren’t found during this research (marked ⚠). Check those before relying on them.`}</div>` : '';
  const trail = (m.searches?.length || m.fetched?.length) ? `<details class="rs-sources"><summary>How this was researched: ${plural(m.searches.length, 'search', 'searches')}, ${plural(m.fetched.length, 'source')} read</summary>
    ${m.searches.length ? `<div class="kicker" style="margin-top:8px">Searches</div><div class="rs-log">${m.searches.map(q => `<span>🔎 ${esc(q)}</span>`).join('')}</div>` : ''}
    ${m.fetched.length ? `<div class="kicker" style="margin-top:8px">Read in full</div><ol>${m.fetched.map(d => `<li><a href="${esc(d.url)}" target="_blank" rel="noopener noreferrer">${esc(d.title)}</a></li>`).join('')}</ol>` : ''}
    ${allCites.length ? `<div class="kicker" style="margin-top:8px">Passages cited (↗ in the answer)</div><ol>${allCites.map(c => `<li><a href="${esc(c.url)}" target="_blank" rel="noopener noreferrer">${esc(c.title)}</a>${c.quote ? `<div class="faint tiny">“${esc(c.quote)}”</div>` : ''}</li>`).join('')}</ol>` : ''}
    ${(m.notes || []).length ? `<div class="faint tiny" style="margin-top:6px">${m.notes.map(esc).join(' ')}</div>` : ''}</details>` : '';
  const foot = m.stopped ? '<div class="faint tiny" style="margin-top:8px">Stopped before finishing.</div>' : m.truncated ? '<div class="faint tiny" style="margin-top:8px">The answer hit the length limit. Ask a follow-up to continue.</div>' : '';
  return `${html || '<p class="muted">No answer text.</p>'}${checkBox}${trail}${foot}`;
}

/* ---------- Asking ---------- */
function rsContextText(q) {
  const prior = [];
  for (let i = 0; i < RS.msgs.length - 1; i++) if (RS.msgs[i].role === 'user' && RS.msgs[i + 1]?.role === 'assistant' && RS.msgs[i + 1].segs) prior.push([RS.msgs[i].text, RS.msgs[i + 1].segs.map(s => s.text).join('').slice(0, 2500)]);
  const last = prior.slice(-2);
  return (last.length ? `Earlier in this conversation (for context only):\n${last.map(([uq, a]) => `Q: ${uq}\nA: ${a}`).join('\n\n')}\n\nNew question: ` : '') + q;
}
async function askResearch(q) {
  if (RS.busy || !q.trim()) return;
  if (!aiReady()) return toast('Connect Claude first (Force Plate AI → Ask, or below)');
  if (!navigator.onLine) return toast('Research AI needs an internet connection');
  RS.msgs.push({ role: 'user', text: q.trim(), at: Date.now() });
  RS.busy = true; RS.abort = new AbortController();
  RS.live = { status: 'Planning the research…', log: [], text: '' };
  refresh();
  const base = {
    model: AI_MODEL, max_tokens: 64000,
    thinking: { type: 'adaptive', display: 'summarized' },
    output_config: { effort: 'high' },
    fallbacks: 'default',
    cache_control: { type: 'ephemeral' },
    system: researchSystemPrompt(),
    tools: [
      { type: 'web_search_20260209', name: 'web_search', max_uses: 10 },
      { type: 'web_fetch_20260209', name: 'web_fetch', max_uses: 8, citations: { enabled: true }, max_content_tokens: 30000 },
    ],
  };
  const userMsg = { role: 'user', content: rsContextText(q.trim()) };
  let blocks = [], last = null, stopped = false, error = null;
  const onEvent = (ev, msg) => {
    const L = RS.live;
    if (ev.type === 'content_block_stop') {
      const b = msg.content[ev.index];
      if (b?.type === 'server_tool_use' && b.name === 'web_search' && b.input?.query) { L.log.push(`🔎 ${b.input.query}`); L.status = `Searching: ${b.input.query}`; }
      if (b?.type === 'server_tool_use' && b.name === 'web_fetch' && b.input?.url) { let h = b.input.url; try { h = new URL(b.input.url).hostname.replace(/^www\./, ''); } catch { } L.log.push(`📄 Reading ${h}`); L.status = `Reading ${h}`; }
    } else if (ev.type === 'content_block_delta') {
      if (ev.delta?.type === 'thinking_delta') { const t = msg.content[ev.index]?.thinking || ''; const s = t.split(/(?<=[.!?])\s/).filter(Boolean).pop() || ''; if (s.length > 12) L.status = s.slice(0, 160); }
      else if (ev.delta?.type === 'text_delta') { L.status = 'Writing the answer…'; L.text = rsDigest([...blocks, ...msg.content.filter(Boolean)]).segs.map(s => s.text).join(''); }
    }
    rsPaint();
  };
  try {
    let messages = [userMsg];
    for (let n = 0; n <= RS_MAX_CONTINUE; n++) {
      last = await rsStream({ ...base, messages }, onEvent, RS.abort.signal);
      blocks = blocks.concat(last.content);
      if (last.stop_reason !== 'pause_turn') break;
      // Long research turn paused by the API: send the paused turn back unchanged and it resumes
      messages = [userMsg, { role: 'assistant', content: last.content }];
      if (n === RS_MAX_CONTINUE - 1) RS.live.status = 'Finishing up…';
    }
  } catch (e) {
    if (e.name === 'AbortError') stopped = true; else { error = e.message; console.warn(e); }
  }
  const d = rsDigest(blocks);
  if (error && !d.segs.length) RS.msgs.push({ role: 'assistant', segs: [{ text: `**Couldn’t complete the research:** ${error}`, cites: [] }], searches: d.searches, fetched: d.fetched, found: d.found, notes: d.notes, at: Date.now() });
  else if (last?.stop_reason === 'refusal' && !d.segs.length) RS.msgs.push({ role: 'assistant', segs: [{ text: 'Claude declined to answer that question. Try rephrasing it as a training or research question.', cites: [] }], searches: [], fetched: [], found: [], at: Date.now() });
  else RS.msgs.push({ role: 'assistant', ...d, stopped, truncated: last?.stop_reason === 'max_tokens', at: Date.now() });
  RS.busy = false; RS.live = null; RS.abort = null;
  try { await Store.set('researchChat', JSON.parse(JSON.stringify(RS.msgs.slice(-30)))); } catch { }
  if (parseHash().name === 'research') { refresh(); setTimeout(() => $('#rsLog .rs-msg:last-child')?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 60); }
}
let rsPaintT = 0;
function rsPaint() {
  const now = Date.now();
  if (now - rsPaintT < 120) return;
  rsPaintT = now;
  const el = $('#rsLive');
  if (el && RS.live) el.innerHTML = rsLiveHtml();
}
function rsLiveHtml() {
  const L = RS.live;
  return `<div class="rs-status"><span class="spin"></span><span>${esc(L.status)}</span></div>
    ${L.log.length ? `<div class="rs-log">${L.log.slice(-6).map(x => `<span>${esc(x)}</span>`).join('')}</div>` : ''}
    ${L.text ? `<div style="margin-top:10px">${mdLite(L.text)}</div>` : ''}`;
}

/* ---------- Page ---------- */
ROUTES.research = () => {
  if (!RS.loaded) {
    RS.loaded = true;
    Store.get('researchChat').then(v => { if (Array.isArray(v) && v.length && !RS.msgs.length) { RS.msgs = v; if (parseHash().name === 'research') refresh(); } }).catch(() => {});
  }
  const ready = aiReady(), offline = !navigator.onLine;
  const msgs = RS.msgs.map(m => m.role === 'user' ? `<div class="rs-msg user">${esc(m.text)}</div>` : `<div class="rs-msg assistant">${rsRender(m)}</div>`).join('');
  const body = `
    <div class="grid two">
      <div class="col">
        ${!RS.msgs.length ? `<div class="card"><div class="card-head"><h3>Ask any strength & conditioning question</h3></div>
          <p class="muted small" style="margin-top:0">Research AI searches the research, opens and reads the key studies, cross-checks them, then answers with references you can open. Every reference link is checked against what it actually found.</p>
          <div class="chips">${RS_STARTERS.map(s => `<button class="chip" data-act="rsSuggest" data-q="${esc(s)}" ${ready && !RS.busy ? '' : 'disabled'}>${esc(s)}</button>`).join('')}</div></div>` : ''}
        <div class="rs-wrap" id="rsLog">${msgs}${RS.live ? `<div class="rs-msg assistant" id="rsLive">${rsLiveHtml()}</div>` : ''}</div>
        ${ready ? `<form id="rsForm" class="card rs-input"><textarea name="q" rows="2" placeholder="${RS.msgs.length ? 'Ask a follow-up…' : 'e.g. How many sprint sessions a week for youth soccer players?'}" ${RS.busy ? 'disabled' : ''}></textarea>
            ${RS.busy ? `<button type="button" class="btn" data-act="rsStop">Stop</button>` : `<button class="btn primary" type="submit" ${offline ? 'disabled' : ''}>Ask</button>`}</form>
          ${offline ? '<div class="small" style="color:var(--warn)">You’re offline. Research AI needs the internet; your saved answers are still here.</div>' : ''}` :
          `<div class="card"><div class="card-head"><h3>Connect Claude</h3></div><p class="small muted" style="margin-top:0">Research AI uses your Anthropic API key (the same one as Force Plate AI), stored only on this device. Get one at <b>console.anthropic.com</b>.</p>${aiKeyFormHtml()}</div>`}
      </div>
      <div class="col">
        <div class="card prose small"><b>How it answers</b>
          <ol><li>Pins down the question: who (age, sex, training level, sport), what, compared with what, which outcome.</li>
          <li>Searches for the best evidence first: meta-analyses, systematic reviews and position statements, then trials.</li>
          <li>Opens the key papers and checks they say what it claims, against at least two sources where possible.</li>
          <li>Rates the evidence (design, sample, youth vs adult, effect size) and states how certain it is.</li>
          <li>Answers: bottom line, what the research shows, how to apply it, certainty, references.</li></ol>
          <p style="margin:0">Each reference link gets <span class="ref-ok">✓</span> if it was found or opened during the research, or <span class="ref-warn">⚠</span> if not. ↗ marks a passage quoted straight from a source.</p></div>
        <div class="card prose small"><b>Good to know</b><ul>
          <li>Thorough answers take about 1–3 minutes and usually cost well under $1 on your Anthropic account.</li>
          <li>No athlete data is sent; only your question (and the last two answers, for follow-ups) plus your training philosophy.</li>
          <li>For questions about your OVR force-plate data, use <a href="#/fpai/ask">Force Plate AI</a>.</li></ul>
          ${RS.msgs.length && !RS.busy ? '<button class="btn sm ghost" data-act="rsClear">Clear conversation</button>' : ''}</div>
      </div>
    </div>`;
  return {
    title: 'Research AI', nav: 'research', body,
    mount() {
      bindAiKeyForm();
      $('#rsForm')?.addEventListener('submit', e => { e.preventDefault(); const q = e.target.q.value; if (q.trim()) askResearch(q); });
      $('#rsForm textarea')?.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.shiftKey && window.matchMedia('(pointer:fine)').matches) { e.preventDefault(); $('#rsForm').requestSubmit(); } });
    },
  };
};
A.rsSuggest = el => askResearch(el.dataset.q);
A.rsStop = () => RS.abort?.abort();
A.rsClear = async () => {
  if (!(await confirmBox('Clear the Research AI conversation?', 'Saved answers on this device are removed.', { ok: 'Clear' }))) return;
  RS.msgs = []; try { await Store.set('researchChat', []); } catch { }
  refresh();
};
['online', 'offline'].forEach(ev => window.addEventListener(ev, () => { if (parseHash().name === 'research' && !RS.busy && !modalStack.length) refresh(); }));
