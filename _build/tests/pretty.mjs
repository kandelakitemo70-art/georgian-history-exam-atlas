// usage: node pretty.mjs <id> [-h] — readable dump of a parsed test for proofreading (-h: list hyphen decisions)
import { parseTest, hyphenLog } from './parse.mjs';
const id = process.argv[2];
const r = parseTest(id);
const L = 'აბგდ';
const P = a => (a || []).map(x => '      ' + x).join('\n');
console.log(`# ${id} max ${r.max} time ${r.time}`);
for (const it of r.items) {
  if (it.t === 'mc') console.log(`\n${it.n}. [${it.p}] ${it.q.join(' ¶ ')}\n${it.o.map((o, i) => `   ${i === it.a ? '*' : ' '}${L[i]}) ${o}`).join('\n')}${it.img ? '\n   IMG ' + JSON.stringify(it.img) : ''}`);
  else if (it.t === 'order') console.log(`\n${it.n}. [order] ${it.q.join(' ¶ ')}\n${it.items.map((o, i) => `    ${i + 1}. ${o}`).join('\n')}\n   KEY ${it.a.join(' ')}`);
  else {
    console.log(`\n=== ${it.n} ${it.kind} (${it.title})\n  INSTR:\n${P(it.instr)}\n  PROMPT:\n${P(it.prompt)}`);
    console.log(`  STIM pages=${it.stim.pages.join(',')} imgs=${it.stim.imgs.length}\n${P(it.stim.text)}`);
    for (const s of it.sub) {
      if (s.t === 'mc') console.log(`  ${s.n} [${s.p}] ${s.q.join(' ¶ ')}\n${s.o.map((o, i) => `     ${i === s.a ? '*' : ' '}${L[i]}) ${o}`).join('\n')}`);
      else console.log(`  ${s.n} [${s.p}] ${s.q.join(' ¶ ')}\n     CRIT: ${s.crit.join(' ¶ ')}`);
    }
    if (it.critAll) console.log(`  CRIT-ALL: ${it.critAll.join(' ¶ ')}`);
  }
}
if (r.warn.length) console.log('\nWARN\n' + r.warn.join('\n'));
if (process.argv.includes('-h')) console.log('\nHYPHENS\n' + [...new Set(hyphenLog)].join('\n'));
