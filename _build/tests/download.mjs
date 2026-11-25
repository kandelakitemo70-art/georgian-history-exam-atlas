// Step 1 of the tests pipeline: download the official NAEC PDFs (tests + scoring schemes) listed in manifest.mjs.
// usage: node download.mjs        (resumable; files go to pdf/<id>-test.pdf and pdf/<id>-scheme.pdf)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import M from './manifest.mjs';
const out = path.join(path.dirname(fileURLToPath(import.meta.url)), 'pdf');
fs.mkdirSync(out, { recursive: true });
for (const m of M) {
  for (const [kind, url] of [['test', m.test], ['scheme', m.scheme]]) {
    const f = path.join(out, `${m.id}-${kind}.pdf`);
    if (fs.existsSync(f) && fs.statSync(f).size > 10000) continue;
    let ok = false;
    for (let a = 0; a < 3 && !ok; a++) {
      try {
        const r = await fetch(encodeURI(url), { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const b = Buffer.from(await r.arrayBuffer());
        if (r.ok && b.subarray(0, 4).toString() === '%PDF') { fs.writeFileSync(f, b); ok = true; console.log('ok', m.id, kind, (b.length / 1024 | 0) + 'KB'); }
        else console.log('bad', m.id, kind, r.status);
      } catch (e) { console.log('err', m.id, kind, e.message); }
    }
  }
}
