// Builds the app, serves docs/ locally, and runs every end-to-end suite in tests/suites.
// Usage: npm test            (all suites)
//        npm test -- 08      (only suites whose file name contains "08")
import { spawn, execSync } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const docs = path.join(root, 'docs'), out = path.join(root, 'tests', 'output');
const filter = process.argv[2] || '';
fs.mkdirSync(out, { recursive: true });

console.log('• Building…');
execSync('node build.mjs', { cwd: root, stdio: 'inherit' });

console.log('• Syntax check…');
const all = fs.readdirSync(path.join(root, 'src/js')).sort().map(f => fs.readFileSync(path.join(root, 'src/js', f), 'utf8')).join('\n');
const tmp = path.join(os.tmpdir(), `phq-check-${process.pid}.js`);
fs.writeFileSync(tmp, all);
execSync(`node --check "${tmp}"`, { stdio: 'inherit' });
fs.rmSync(tmp);

// Playwright: use a local install if present, otherwise the global one
let nodePath = process.env.NODE_PATH || '';
try { await import('playwright'); } catch {
  const g = execSync('npm root -g').toString().trim();
  nodePath = [g, nodePath].filter(Boolean).join(path.delimiter);
}

const types = { '.html': 'text/html', '.js': 'text/javascript', '.webmanifest': 'application/manifest+json', '.json': 'application/json', '.png': 'image/png', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.css': 'text/css' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(docs, p);
  if (!f.startsWith(docs) || !fs.existsSync(f)) { res.writeHead(404); return res.end('Not found'); }
  res.writeHead(200, { 'Content-Type': types[path.extname(f)] || 'application/octet-stream', 'Cache-Control': 'no-store' });
  fs.createReadStream(f).pipe(res);
});
await new Promise(r => server.listen(0, '127.0.0.1', r));
const base = `http://localhost:${server.address().port}/`;
console.log(`• Serving docs/ at ${base}`);

const suites = fs.readdirSync(path.join(root, 'tests/suites')).filter(f => f.endsWith('.js') && f.includes(filter)).sort();
const results = [];
for (const s of suites) {
  const t0 = Date.now();
  process.stdout.write(`\n▶ ${s}\n`);
  const code = await new Promise(resolve => {
    const child = spawn(process.execPath, [path.join(root, 'tests/suites', s)], { env: { ...process.env, BASE_URL: base, OUT_DIR: out, NODE_PATH: nodePath }, stdio: ['ignore', 'pipe', 'pipe'] });
    let text = '';
    child.stdout.on('data', d => { text += d; process.stdout.write(d); });
    child.stderr.on('data', d => { text += d; process.stderr.write(d); });
    const timer = setTimeout(() => child.kill('SIGKILL'), 15 * 60 * 1000);
    child.on('close', c => { clearTimeout(timer); resolve(c === 0 && /ALL PASSED/.test(text) && !/ERRORS:/.test(text) ? 0 : 1); results.push({ s, checks: (text.match(/✓/g) || []).length, ok: c === 0 && /ALL PASSED/.test(text) && !/ERRORS:/.test(text), secs: Math.round((Date.now() - t0) / 1000) }); });
  });
}
server.close();
console.log('\n──────── Summary ────────');
results.forEach(r => console.log(`${r.ok ? '✅' : '❌'} ${r.s.padEnd(42)} ${String(r.checks).padStart(4)} checks  ${r.secs}s`));
const failed = results.filter(r => !r.ok);
console.log(`\n${results.reduce((n, r) => n + r.checks, 0)} checks · ${failed.length ? failed.length + ' suite(s) FAILED' : 'all suites passed'}`);
process.exit(failed.length ? 1 : 0);
