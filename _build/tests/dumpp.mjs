import fs from 'fs';
import { buildLines } from './lines.mjs';
const [id, from, to] = process.argv.slice(2);
const d = JSON.parse(fs.readFileSync(`ex/${id}-test.json`, 'utf8'));
for (const pg of d.pages) {
  if (pg.p < +from || pg.p > +to) continue;
  console.log(`--- p${pg.p} imgs=${JSON.stringify(pg.images.map(b => [b.x | 0, b.y | 0, b.w | 0, b.h | 0]))}`);
  for (const l of buildLines(pg.items)) console.log(`${l.x0.toFixed(0).padStart(4)} ${l.y.toFixed(0).padStart(4)} ${String(l.sz).padStart(5)} ${JSON.stringify(l.text).slice(0, 150)}`);
}
