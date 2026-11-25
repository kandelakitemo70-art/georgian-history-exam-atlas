// Step 4 of the tests pipeline: parsed tests -> site data.
//   data/tests/index.js        window.TESTS = [...]   (catalog)
//   data/tests/<id>.js         window.TESTDATA[id] = {...}
//   img/tests/<id>-<task>[-k].webp   maps, illustrations, battle schemes cropped from the PDFs at native resolution
// usage: node build.mjs [id ...] [--no-img]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { createCanvas } from '@napi-rs/canvas';
import { parseTest } from './parse.mjs';
import M, { MAPLINKS } from './manifest.mjs';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');

const here = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(here, '../..');
const OUT = path.join(ROOT, 'data/tests'), IMG = path.join(ROOT, 'img/tests');
fs.mkdirSync(OUT, { recursive: true }); fs.mkdirSync(IMG, { recursive: true });
const args = process.argv.slice(2), noImg = args.includes('--no-img'), only = args.filter(a => !a.startsWith('-'));

async function cropAll(id, jobs) {
  if (!jobs.length) return;
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(here, 'pdf', id + '-test.pdf'))), verbosity: 0, disableFontFace: true }).promise;
  const byPage = new Map();
  for (const j of jobs) { if (!byPage.has(j.page)) byPage.set(j.page, []); byPage.get(j.page).push(j); }
  for (const [pno, js] of byPage) {
    const page = await doc.getPage(pno);
    // render at the scale of the sharpest image on the page (native pixels), between 1.5x and 3x
    const scale = Math.min(3, Math.max(1.5, ...js.map(j => (j.box.nw || 0) / j.box.w || 0)));
    const v = page.getViewport({ scale });
    const c = createCanvas(Math.ceil(v.width), Math.ceil(v.height)); const ctx = c.getContext('2d');
    ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, c.width, c.height);
    await page.render({ canvasContext: ctx, viewport: v }).promise;
    const png = c.toBuffer('image/png');
    for (const j of js) {
      const b = j.box;
      const left = Math.max(0, Math.floor(b.x * scale)), top = Math.max(0, Math.floor(b.y * scale));
      const width = Math.min(c.width - left, Math.ceil(b.w * scale)), height = Math.min(c.height - top, Math.ceil(b.h * scale));
      let img = sharp(png).extract({ left, top, width, height });
      const maxW = Math.min(1800, Math.max(b.nw || 0, 900));
      if (width > maxW) img = img.resize({ width: maxW });
      const info = await img.webp({ quality: 80, effort: 5 }).toFile(path.join(IMG, j.file));
      j.out.w = info.width; j.out.h = info.height; j.out.kb = Math.round(info.size / 1024);
    }
    page.cleanup();
  }
  await doc.destroy();
}

const catalog = [];
const thumbs = {};
let totalKb = 0;
for (const m of M) {
  const r = parseTest(m.id);
  if (r.warn.length) console.log(m.id, 'WARN', r.warn.join('; '));
  const jobs = [];
  const items = r.items.map(it => {
    if (it.t !== 'group') {
      const { img, ...rest } = it;
      // a map or picture inside a multiple-choice question (2019)
      if (img && img.length) rest.img = img.map((im, k) => { const file = `${m.id}-${it.n}${img.length > 1 ? '-' + (k + 1) : ''}.webp`, out = { f: file }; jobs.push({ page: im.page, box: im.box, file, out }); return out; });
      return rest;
    }
    const imgs = it.stim.imgs.map((im, k, all) => {
      const file = `${m.id}-${it.n}${all.length > 1 ? '-' + (k + 1) : ''}.webp`;
      const out = { f: file };
      jobs.push({ page: im.page, box: im.box, file, out });
      return out;
    });
    const g = { n: it.n, t: 'group', kind: it.kind, title: it.title, instr: it.instr, prompt: it.prompt, stim: { img: imgs, text: it.stim.text }, sub: it.sub };
    if (it.critAll) g.critAll = it.critAll;
    return g;
  });
  if (!noImg && (!only.length || only.includes(m.id))) await cropAll(m.id, jobs);
  else for (const j of jobs) { // keep sizes from the existing files
    const f = path.join(IMG, j.file);
    if (fs.existsSync(f)) { const md = await sharp(f).metadata(); j.out.w = md.width; j.out.h = md.height; j.out.kb = Math.round(fs.statSync(f).size / 1024); }
  }
  for (const j of jobs) { totalKb += j.out.kb || 0; delete j.out.kb; }
  const sections = r.sections.map(s => ({ from: s.from, to: s.to, kind: s.kind, instr: s.instr }));
  const flat = items.flatMap(it => it.t === 'group' ? it.sub : [it]);
  const count = { mc: flat.filter(q => q.t === 'mc').length, order: flat.filter(q => q.t === 'order').length, open: flat.filter(q => q.t === 'open').length };
  const auto = flat.filter(q => q.t !== 'open').reduce((a, q) => a + q.p, 0);
  const data = { id: m.id, year: m.year, v: m.v, session: m.session, max: r.max, time: r.time, auto, count, src: { test: m.test, scheme: m.scheme, post: m.post }, sections, items };
  if (!only.length || only.includes(m.id)) {
    fs.writeFileSync(path.join(OUT, m.id + '.js'), `window.TESTDATA=window.TESTDATA||{};window.TESTDATA[${JSON.stringify(m.id)}]=${JSON.stringify(data)};\n`);
  }
  const mapItem = items.find(it => it.t === 'group' && (it.kind === 'map' || it.kind === 'mapmc'));
  catalog.push({ id: m.id, year: m.year, v: m.v, session: m.session, max: r.max, time: r.time, auto, count, kinds: [...new Set(items.filter(it => it.t === 'group').map(it => it.kind))], map: mapItem && mapItem.stim.img[0] ? mapItem.stim.img[0].f : null, mapTask: mapItem ? mapItem.n : null, maps: MAPLINKS[m.id] || [], imgs: jobs.map(j => j.file), thumb: thumbs[m.id] || null });
}
for (const c of catalog) if (c.map) {
  const src = path.join(IMG, c.map), out = path.join(IMG, 'thumbs', c.id + '.webp');
  fs.mkdirSync(path.dirname(out), { recursive: true });
  if (fs.existsSync(src) && (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs)) await sharp(src).resize({ width: 480, height: 300, fit: 'cover', position: 'centre' }).webp({ quality: 72 }).toFile(out);
  c.thumb = 'thumbs/' + c.id + '.webp';
}
fs.writeFileSync(path.join(OUT, 'index.js'), `window.TESTS=${JSON.stringify(catalog)};\n`);
console.log(`tests: ${catalog.length}, images ~${totalKb} KB, data ${fs.readdirSync(OUT).reduce((a, f) => a + fs.statSync(path.join(OUT, f)).size, 0) / 1024 | 0} KB`);
