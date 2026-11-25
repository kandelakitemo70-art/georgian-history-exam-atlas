// Build: map definitions (src/*.mjs) -> data/maps/<id>.js + data/catalog.js (+ artifact page)
// Usage: node build.mjs [mapId ...]   (no ids = all maps)
import fs from 'fs';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import * as d3 from 'd3';
import pc from 'polygon-clipping';
import * as topoServer from 'topojson-server';
import * as topoSimplify from 'topojson-simplify';
import * as topoClient from 'topojson-client';
import { dp, roundGeom, clipGeom, bboxOf, boxHits, toPC, fromPC, ringArea, rewind } from './geo-util.mjs';
import { PALETTE, HB_KA } from './src/common.mjs';
import { BLOCKS } from './src/blocks.mjs';
import { REGIONS } from './src/regions.mjs';
const REAL = fs.existsSync(path.join(path.dirname(fileURLToPath(import.meta.url)), 'src', 'real.mjs')) ? (await import(pathToFileURL(path.join(path.dirname(fileURLToPath(import.meta.url)), 'src', 'real.mjs')).href + '?t=' + Date.now())).default : {};

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '..');
const RAW = path.join(HERE, 'raw');
const only = new Set(process.argv.slice(2));

// ---------- raw data cache ----------
const cache = {};
const raw = name => cache[name] || (cache[name] = JSON.parse(fs.readFileSync(path.join(RAW, name + '.json'), 'utf8')));
const hbYear = y => raw('hb/' + y);
const admin1ById = () => {
  if (cache._a1) return cache._a1;
  const m = {};
  for (const src of ['admin1_cauc', 'admin1_usa']) for (const f of raw(src).features) (m[f.properties.id] = m[f.properties.id] || []).push(f.geometry);
  return (cache._a1 = m);
};

// ---------- load map definitions ----------
const srcDir = path.join(HERE, 'src');
const mapFiles = fs.readdirSync(srcDir).filter(f => /^b\d\d.*\.mjs$/.test(f)).sort();
let MAPS = [];
for (const f of mapFiles) {
  const mod = await import(pathToFileURL(path.join(srcDir, f)).href + '?t=' + Date.now());
  MAPS = MAPS.concat(mod.default.map(m => ({ ...m, real: m.real && m.real.length ? m.real : (REAL[m.id] || []), _file: f })));
}
// order: by block, then year, then explicit order
MAPS.sort((a, b) => a.block - b.block || (a.ord ?? a.year) - (b.ord ?? b.year));
const ids = new Set();
for (const m of MAPS) { if (ids.has(m.id)) throw new Error('duplicate id ' + m.id); ids.add(m.id); }

// ---------- geometry helpers ----------
const closeRing = r => { const a = r[0], b = r[r.length - 1]; return (a[0] === b[0] && a[1] === b[1]) ? r : r.concat([a]); };
const polyOf = ring => ({ type: 'Polygon', coordinates: [closeRing(ring)] });
function unionGeoms(gs) {
  gs = gs.filter(Boolean);
  if (!gs.length) return null;
  if (gs.length === 1) return gs[0];
  return fromPC(pc.union(...gs.map(toPC)));
}

function resolveSpec(spec, ctx) {
  if (!spec) return null;
  if (Array.isArray(spec)) {
    if (typeof spec[0] === 'string') return unionGeoms(spec.map(s => resolveSpec(s, ctx)));      // list of region names
    if (typeof spec[0][0] === 'number') return polyOf(spec);                                        // ring
    return unionGeoms(spec.map(s => resolveSpec(s, ctx)));                                          // list of specs
  }
  if (typeof spec === 'string') {
    const r = REGIONS[spec];
    if (!r) throw new Error('unknown region ' + spec);
    return resolveSpec(r, ctx);
  }
  let g = null;
  const parts = [];
  if (spec.p) parts.push(polyOf(spec.p));
  if (spec.pp) parts.push(...spec.pp.map(polyOf));
  if (spec.u) { const m = admin1ById(); for (const id of spec.u) { if (!m[id]) throw new Error('unknown admin1 ' + id); parts.push(...m[id]); } }
  if (spec.c) {
    const srcs = [raw('admin0_10_me'), raw('admin0_50')];
    for (const a3 of spec.c) {
      const f = srcs[0].features.find(f => f.properties.a3 === a3) || srcs[1].features.find(f => f.properties.a3 === a3);
      if (!f) throw new Error('unknown country ' + a3);
      parts.push(f.geometry);
    }
  }
  if (spec.hb) {
    const y = spec.y ?? ctx.hbY;
    if (y == null) throw new Error('hb without year in ' + ctx.id);
    const names = [].concat(spec.hb);
    const fs_ = hbYear(y).features.filter(f => names.includes(f.properties.n));
    if (fs_.length === 0) throw new Error(`hb name(s) ${names} not found in ${y} (${ctx.id})`);
    parts.push(...fs_.map(f => f.geometry));
  }
  if (spec.r) parts.push(resolveSpec(spec.r, ctx));
  if (spec.or) parts.push(...spec.or.map(s => resolveSpec(s, ctx)));
  g = unionGeoms(parts);
  if (g && spec.minus) { const m = resolveSpec(spec.minus, ctx); if (m) g = fromPC(pc.difference(toPC(g), toPC(m))); }
  if (g && spec.and) { const a = resolveSpec(spec.and, ctx); if (a) g = fromPC(pc.intersection(toPC(g), toPC(a))); }
  return g;
}

function largestPolyCentroid(g) {
  const polys = g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
  let best = null, bestA = 0;
  for (const p of polys) { const a = Math.abs(ringArea(p[0])); if (a > bestA) { bestA = a; best = p; } }
  if (!best) return null;
  const c = d3.polygonCentroid(best[0]);
  return [+c[0].toFixed(3), +c[1].toFixed(3)];
}

function expand(v, f) { const w = v[2] - v[0], h = v[3] - v[1]; return [v[0] - w * f, v[1] - h * f, v[2] + w * f, v[3] + h * f]; }

function fcClip(fc, box, tol, dec, filter = () => true) {
  const out = [];
  for (const f of fc.features) {
    if (!f.geometry || !filter(f)) continue;
    const b = bboxOf(f.geometry);
    if (!boxHits(b, box)) continue;
    let g = clipGeom(f.geometry, box);
    g = roundGeom(dp(g, tol), dec);
    if (g) out.push({ p: f.properties, g });
  }
  return out;
}
const mergeGeoms = (gs, type) => {
  if (!gs.length) return null;
  if (type === 'poly') return { type: 'MultiPolygon', coordinates: gs.flatMap(g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates) };
  return { type: 'MultiLineString', coordinates: gs.flatMap(g => g.type === 'LineString' ? [g.coordinates] : g.coordinates) };
};

// ---------- projection (mirrors assets/app.js makeProjection) ----------
export function makeProjection(view, kind, W, H, pad = 0) {
  const [w, s, e, n] = view;
  const k = kind || ((e - w) > 100 ? 'ee' : 'merc');
  let p;
  if (k === 'ee') p = d3.geoEqualEarth().rotate([-(w + e) / 2, 0]);
  else if (k === 'conic') p = d3.geoConicConformal().parallels([s + (n - s) / 4, n - (n - s) / 4]).rotate([-(w + e) / 2, 0]);
  else p = d3.geoMercator().rotate([-(w + e) / 2, 0]);
  const pts = []; for (let i = 0; i <= 8; i++) { const x = w + (e - w) * i / 8, y = s + (n - s) * i / 8; pts.push([x, s], [x, n], [w, y], [e, y]); }
  p.fitExtent([[pad, pad], [W - pad, H - pad]], { type: 'MultiPoint', coordinates: pts });
  return p;
}

// ---------- per-map build ----------
const color = c => PALETTE[c] || c || PALETTE.gray;

function buildMap(m) {
  const V = m.view;
  if (!V || V.length !== 4) throw new Error('bad view ' + m.id);
  const width = V[2] - V[0], height = V[3] - V[1];
  const M = expand(V, 0.35);
  const span = Math.max(width, height * 1.3);
  const tol = span / 1500;
  const dec = tol < 0.004 ? 4 : tol < 0.04 ? 3 : 2;
  const fine = width <= 32;
  const ctx = { id: m.id, hbY: m.ctx?.y };

  // base geography
  const landSrc = span > 150 ? 'land110' : fine ? 'land10' : 'land50';
  const land = rewind(mergeGeoms(fcClip(raw(landSrc), M, tol, dec).map(x => x.g), 'poly'));
  const lakeRank = span < 8 ? 9 : span < 20 ? 7 : span < 45 ? 5 : 3;
  const lakes = rewind(mergeGeoms(fcClip(raw(fine ? 'lakes10' : 'lakes50'), M, tol, dec, f => (f.properties.r ?? 0) <= lakeRank).map(x => x.g), 'poly'));
  const riverRank = span < 8 ? 10 : span < 20 ? 8 : span < 45 ? 6 : 4;
  const useCauc = fine && boxHits(V, [38, 38.5, 50.5, 45]) && m.caucRivers !== false;
  let rivers = fcClip(raw(fine ? 'rivers10' : 'rivers50'), M, tol, dec, f => (f.properties.r ?? 0) <= riverRank && !(useCauc && /Kura|Aras|Kuban|Terek|Coruh|Çoruh/i.test(f.properties.n)));
  if (useCauc) rivers = rivers.concat(fcClip(raw('rivers_cauc'), M, tol, dec, f => !m.hideRivers?.includes(f.properties.n) && (span < 9 || ['მტკვარი', 'არაქსი', 'რიონი', 'ალაზანი', 'იორი', 'ჭოროხი', 'თერგი', 'ყუბანი', 'ენგური', 'არაგვი', 'ხრამი', 'ყვირილა', 'ლიახვი', 'კოდორი', 'ბზიფი', 'ცხენისწყალი', 'დებედა', 'ახურიანი', 'სულაკი', 'სამური'].includes(f.properties.n))));
  const riverG = mergeGeoms(rivers.map(x => x.g), 'line');
  const mtn = m.mountains === false ? null : rewind(mergeGeoms(fcClip(raw('mountains'), M, tol * 2, dec, f => f.properties.r <= (span < 20 ? 5 : span < 60 ? 4 : 3)).map(x => x.g), 'poly'));

  // context polities from historical-basemaps
  let ctxOut = null;
  if (m.ctx) {
    const y = m.ctx.y;
    const hide = new Set(m.ctx.hide || []);
    const feats = fcClip(hbYear(y), M, 0, 4, f => f.properties.n && !hide.has(f.properties.n))
      .map((x, i) => ({ type: 'Feature', id: i, properties: x.p, geometry: x.g }));
    let out = [], borders = null;
    if (feats.length) {
      let topo = topoServer.topology({ c: { type: 'FeatureCollection', features: feats } });
      topo = topoSimplify.presimplify(topo);
      topo = topoSimplify.simplify(topo, tol * tol * 0.6);
      const fcs = topoClient.feature(topo, topo.objects.c);
      const nb = topoClient.neighbors(topo.objects.c.geometries);
      // greedy colouring so neighbours differ
      const ci = new Array(fcs.features.length).fill(-1);
      const order = fcs.features.map((f, i) => i).sort((a, b) => nb[b].length - nb[a].length);
      for (const i of order) { const used = new Set(nb[i].map(j => ci[j])); let c = 0; while (used.has(c)) c++; ci[i] = c % 6; }
      const names = m.ctx.names || {};
      fcs.features.forEach((f, i) => {
        const g = rewind(roundGeom(f.geometry, dec)); if (!g) return;
        const en = f.properties.n;
        out.push({ en, n: names[en] ?? HB_KA[en] ?? null, ci: ci[i], g });
      });
      borders = roundGeom(topoClient.mesh(topo, topo.objects.c, (a, b) => a !== b), dec);
    }
    ctxOut = { y, f: out, b: borders, lbl: (m.ctx.lbl || []) };
  }

  // areas
  const areas = (m.areas || []).map((a, i) => {
    let g = resolveSpec(a.g ?? a, ctx);
    if (!g) throw new Error(`area ${i} (${a.n}) has no geometry in ${m.id}`);
    g = rewind(roundGeom(dp(g, tol * 0.6), dec));
    const lbl = a.lbl === false ? null : (a.lbl || largestPolyCentroid(g));
    return { n: a.n, st: a.st || 'solid', c: color(a.c), c2: a.c2 ? color(a.c2) : undefined, g, lbl, ls: a.ls, lr: a.lr, note: a.note, leg: a.leg, lt: a.lt, num: a.num, sea: a.sea };
  });

  const out = {
    id: m.id, t: m.title, d: m.date, view: V, proj: m.proj || null,
    land, lakes, rivers: riverG, mtn, ctx: ctxOut, areas,
    lines: (m.lines || []).map(l => ({ ...l, c: color(l.c) })),
    arrows: (m.arrows || []).map(a => ({ ...a, c: color(a.c) })),
    pts: m.pts || [], labels: m.labels || [], kindNames: m.kindNames || null,
    text: m.text || {}, real: m.real || [], exam: m.exam || null,
  };
  return out;
}

// ---------- thumbnails ----------
const TW = 320, TH = 200;
function thumbSVG(m, data) {
  const proj = makeProjection(m.view, m.proj, TW, TH, 6);
  const gp = d3.geoPath(proj).digits(0);
  const parts = [];
  const pathD = g => g ? gp(g) || '' : '';
  const simp = g => g ? roundGeom(dp(g, (m.view[2] - m.view[0]) / 180), 2) : null;
  parts.push(`<rect class="t-sea" width="${TW}" height="${TH}"/>`);
  parts.push(`<path class="t-land" d="${pathD(simp(data.land))}"/>`);
  if (data.ctx) for (const f of data.ctx.f) { const d = pathD(simp(f.g)); if (d) parts.push(`<path class="t-ctx t-c${f.ci}" d="${d}"/>`); }
  for (const a of data.areas) {
    const d = pathD(simp(a.g)); if (!d) continue;
    const op = a.st === 'light' ? 0.45 : a.st === 'hatch' || a.st === 'stripes' ? 0.55 : a.st === 'outline' ? 0 : 0.85;
    parts.push(`<path d="${d}" fill="${a.c}" fill-opacity="${op}" stroke="${a.c}" stroke-width=".6"/>`);
  }
  if (data.lakes) parts.push(`<path class="t-sea" d="${pathD(simp(data.lakes))}"/>`);
  for (const ar of data.arrows) {
    const pts = ar.p.map(p => proj(p)).filter(Boolean);
    if (pts.length < 2) continue;
    const d = d3.line().curve(d3.curveCatmullRom.alpha(0.5))(pts);
    parts.push(`<path d="${d.replace(/\.\d+/g, '')}" fill="none" stroke="${ar.c}" stroke-width="1.6" ${ar.k === 'ret' ? 'stroke-dasharray="3 2"' : ''}/>`);
  }
  return `<svg viewBox="0 0 ${TW} ${TH}" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${parts.join('')}</svg>`;
}

// ---------- run ----------
fs.mkdirSync(path.join(ROOT, 'data', 'maps'), { recursive: true });
const thumbCachePath = path.join(HERE, 'thumbs-cache.json');
const thumbCache = fs.existsSync(thumbCachePath) ? JSON.parse(fs.readFileSync(thumbCachePath, 'utf8')) : {};
let n = 0, bytes = 0;
for (const m of MAPS) {
  if (only.size && !only.has(m.id)) continue;
  const t0 = Date.now();
  const data = buildMap(m);
  // sanity checks
  const V = expand(m.view, 0.02), inV = p => p && p[0] >= V[0] && p[0] <= V[2] && p[1] >= V[1] && p[1] <= V[3];
  const warn = s => console.log(`  ! ${m.id}: ${s}`);
  for (const p of data.pts) if (!inV(p.at)) warn(`point outside view: ${p.n} ${p.at}`);
  for (const l of data.labels) if (!inV(l.at)) warn(`label outside view: ${l.n} ${l.at}`);
  for (const a of data.arrows) if (!a.p.some(inV)) warn(`arrow outside view: ${a.n || a.d}`);
  for (const a of data.areas) { const ar = d3.geoArea(a.g); if (ar > 2 * Math.PI) warn(`inverted area ${a.n}`); if (a.lbl && a.lt !== false && a.n && !inV(a.lbl)) warn(`area label outside view: ${a.n} ${a.lbl}`); }
  for (const k of ['title', 'date', 'year', 'block']) if (m[k] == null) warn('missing ' + k);
  if (!m.text?.s || !(m.text?.f || []).length || !(m.text?.r || []).length || !m.text?.how) warn('text incomplete');
  const js =`(window.MAPDATA=window.MAPDATA||{})[${JSON.stringify(m.id)}]=${JSON.stringify(data)};\n`;
  fs.writeFileSync(path.join(ROOT, 'data', 'maps', m.id + '.js'), js);
  thumbCache[m.id] = thumbSVG(m, data);
  n++; bytes += js.length;
  console.log(`${m.id.padEnd(22)} ${(js.length / 1024).toFixed(0).padStart(5)}KB  ${Date.now() - t0}ms`);
}
fs.writeFileSync(thumbCachePath, JSON.stringify(thumbCache));

// catalog (always rebuilt from all definitions)
const strip = s => (s || '').replace(/<[^>]+>/g, '');
const catalog = MAPS.map(m => ({
  id: m.id, b: m.block, ge: !!m.ge, t: m.title, d: m.date, y: m.year,
  s: strip(m.text?.s).slice(0, 220),
  ex: m.exam || null,
  kw: [m.title, m.date, m.kw || '', (m.areas || []).map(a => a.n).join(' '), (m.pts || []).map(p => p.n).join(' '), (m.arrows || []).map(a => a.n || '').join(' ')].join(' ').replace(/\s+/g, ' ').slice(0, 1500),
  real: (m.real || []).length,
  th: thumbCache[m.id] || '',
}));
fs.writeFileSync(path.join(ROOT, 'data', 'catalog.js'),
  `window.BLOCKS=${JSON.stringify(BLOCKS)};\nwindow.CATALOG=${JSON.stringify(catalog)};\nwindow.PALETTE=${JSON.stringify(PALETTE)};\n`);
console.log(`built ${n} maps (${(bytes / 1024).toFixed(0)}KB), catalog ${MAPS.length} entries, ${(fs.statSync(path.join(ROOT, 'data', 'catalog.js')).size / 1024).toFixed(0)}KB`);

// artifact page: index.html without the document skeleton
const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const art = idx.replace(/<!doctype html>\s*/i, '').replace(/<html[^>]*>\s*/i, '').replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '').replace(/<\/head>\s*/i, '').replace(/<body[^>]*>\s*/i, '').replace(/<\/body>\s*/i, '')
  .replace(/<meta charset[^>]*>\s*/i, '').replace(/<meta name="viewport"[^>]*>\s*/i, '');
fs.writeFileSync(path.join(HERE, 'artifact-index.html'), art);
