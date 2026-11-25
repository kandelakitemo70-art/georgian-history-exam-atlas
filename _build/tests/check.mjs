// Sanity checks over every parsed test; prints anything suspicious.
import { parseTest } from './parse.mjs';
import M from './manifest.mjs';
const bad = /[\t�]|გადასვლა|იხილეთ|\s{2,}| [ა-დ]\) .* [ა-დ]\) /;
let n = 0;
const flag = (id, where, msg, s) => { n++; console.log(`${id} ${where}: ${msg}${s ? ' | ' + String(s).slice(0, 160) : ''}`); };
for (const m of M) {
  const r = parseTest(m.id);
  for (const w of r.warn) flag(m.id, '-', 'WARN ' + w);
  for (const it of r.items) {
    const chkQ = (where, q) => {
      if (!q.length) flag(m.id, where, 'empty stem');
      for (const p of q) if (bad.test(p)) flag(m.id, where, 'odd text', p);
      if (q.length > 1) flag(m.id, where, `stem has ${q.length} paragraphs`, q.join(' ¶ '));
      const last = q[q.length - 1] || '';
      if (last && !/[?:.!“»)]$/.test(last)) flag(m.id, where, 'stem ending', last.slice(-60));
    };
    if (it.t === 'mc' || it.t === 'order') chkQ(it.n, it.q);
    if (it.t === 'mc') {
      if (it.o.length !== 4) flag(m.id, it.n, 'options ' + it.o.length);
      it.o.forEach((o, i) => { if (!o || bad.test(o) || o.length > 260) flag(m.id, it.n, 'option ' + i, o); });
      if (!(it.a >= 0)) flag(m.id, it.n, 'no answer');
    }
    if (it.t === 'order') {
      if (it.items.length < 3) flag(m.id, it.n, 'order items ' + it.items.length);
      if ([...it.a].sort().join() !== it.items.map((_, i) => i + 1).join()) flag(m.id, it.n, 'order key ' + it.a.join(' '));
    }
    if (it.t === 'group') {
      const needImg = ['map', 'mapmc', 'illustration', 'sources'].includes(it.kind), needText = ['document', 'sources'].includes(it.kind);
      if (needImg && !it.stim.imgs.length) flag(m.id, it.n, 'no image for ' + it.kind);
      if (needText && !it.stim.text.length) flag(m.id, it.n, 'no text for ' + it.kind);
      for (const p of it.stim.text.concat(it.prompt)) if (bad.test(p)) flag(m.id, it.n, 'odd stim text', p);
      for (const s of it.sub) {
        if (s.t === 'mc') { chkQ(s.n, s.q); if (s.o.length !== 4) flag(m.id, s.n, 'options ' + s.o.length); if (!(s.a >= 0)) flag(m.id, s.n, 'no answer'); s.o.forEach((o, i) => { if (!o || bad.test(o)) flag(m.id, s.n, 'option ' + i, o); }); }
        else { if (!s.virt || s.q.length) chkQ(s.n, s.q.length || s.virt ? s.q : ['(task)']); if (!s.crit.length) flag(m.id, s.n, 'no criteria'); }
      }
    }
  }
}
console.log('flags:', n);
