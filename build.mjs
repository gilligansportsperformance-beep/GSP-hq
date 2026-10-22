// Builds dist/: a self-contained index.html (CSS + JS inlined) plus service worker, manifest and icons.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const src = 'src', out = 'docs';
fs.rmSync(out, { recursive: true, force: true });
fs.mkdirSync(path.join(out, 'icons'), { recursive: true });

const css = fs.readFileSync(path.join(src, 'styles.css'), 'utf8');
const js = fs.readdirSync(path.join(src, 'js')).filter(f => f.endsWith('.js')).sort()
  .map(f => `/* ---- ${f} ---- */\n` + fs.readFileSync(path.join(src, 'js', f), 'utf8')).join('\n');
if (/<\/script/i.test(js)) throw new Error('JS contains a closing script tag');

const html = fs.readFileSync(path.join(src, 'index.html'), 'utf8')
  .replace('/*__CSS__*/', () => css)
  .replace('/*__JS__*/', () => js);
fs.writeFileSync(path.join(out, 'index.html'), html);

const version = crypto.createHash('sha256').update(html).digest('hex').slice(0, 10);
fs.writeFileSync(path.join(out, 'sw.js'), fs.readFileSync(path.join(src, 'sw.js'), 'utf8').replace('__VERSION__', version));
fs.copyFileSync(path.join(src, 'manifest.webmanifest'), path.join(out, 'manifest.webmanifest'));
for (const f of fs.readdirSync(path.join(src, 'icons'))) fs.copyFileSync(path.join(src, 'icons', f), path.join(out, 'icons', f));
fs.mkdirSync(path.join(out, 'fonts'), { recursive: true });
for (const f of fs.readdirSync(path.join(src, 'fonts'))) fs.copyFileSync(path.join(src, 'fonts', f), path.join(out, 'fonts', f));
fs.writeFileSync(path.join(out, '.nojekyll'), '');
console.log(`Built ${out}/ — index.html ${(html.length / 1024).toFixed(0)} KB, cache version ${version}`);
