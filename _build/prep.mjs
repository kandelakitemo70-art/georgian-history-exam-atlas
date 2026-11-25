// One-time raw data preparation: slims Natural Earth, OSM rivers and historical-basemaps
// into _build/raw/. Usage: node prep.mjs <naturalEarthDir> <historicalBasemapsDir> <osmDir>
import fs from 'fs';
import path from 'path';
import { dp, roundGeom } from './geo-util.mjs';

const [NE, HB, OSM] = process.argv.slice(2);
const OUT = path.resolve('raw');
fs.mkdirSync(path.join(OUT, 'hb'), { recursive: true });

const load = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const save = (f, obj) => { fs.writeFileSync(path.join(OUT, f), JSON.stringify(obj)); console.log('wrote', f, (fs.statSync(path.join(OUT, f)).size / 1024).toFixed(0) + 'KB'); };
const fc = features => ({ type: 'FeatureCollection', features });

function slim(geom, tol, dec) {
  return roundGeom(dp(geom, tol), dec);
}
function bboxOf(geom) {
  let b = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = c => { if (typeof c[0] === 'number') { b[0] = Math.min(b[0], c[0]); b[1] = Math.min(b[1], c[1]); b[2] = Math.max(b[2], c[0]); b[3] = Math.max(b[3], c[1]); } else c.forEach(walk); };
  walk(geom.coordinates); return b;
}
const hits = (b, box) => !(b[2] < box[0] || b[0] > box[2] || b[3] < box[1] || b[1] > box[3]);

if (NE) {
  // land
  for (const [src, out, tol, dec] of [['ne_10m_land', 'land10', 0.002, 4], ['ne_50m_land', 'land50', 0.01, 3], ['ne_110m_land', 'land110', 0.05, 2]]) {
    const j = load(path.join(NE, src + '.geojson'));
    save(out + '.json', fc(j.features.map(f => ({ type: 'Feature', properties: {}, geometry: slim(f.geometry, tol, dec) })).filter(f => f.geometry)));
  }
  // lakes (natural lakes only, no reservoirs)
  const notRes = n => !/reservoir|baraj|vodokhran|водохран|dam\b|barrage|lake nasser|kakhovka|kuybyshev|mingevir|tsimlyansk|ataturk|keban|habbaniyah|tharthar|assad|razazah/i.test(n || '');
  for (const [src, out, tol, dec, maxRank] of [['ne_10m_lakes', 'lakes10', 0.002, 4, 8], ['ne_50m_lakes', 'lakes50', 0.01, 3, 9]]) {
    const j = load(path.join(NE, src + '.geojson'));
    save(out + '.json', fc(j.features.filter(f => notRes(f.properties.name) && (f.properties.scalerank ?? 0) <= maxRank)
      .map(f => ({ type: 'Feature', properties: { n: f.properties.name || '', r: f.properties.scalerank }, geometry: slim(f.geometry, tol, dec) })).filter(f => f.geometry)));
  }
  // rivers
  for (const [src, out, tol, dec] of [['ne_10m_rivers_lake_centerlines', 'rivers10', 0.003, 3], ['ne_50m_rivers_lake_centerlines', 'rivers50', 0.01, 3]]) {
    const j = load(path.join(NE, src + '.geojson'));
    save(out + '.json', fc(j.features.filter(f => /River/i.test(f.properties.featurecla || 'River') && notRes(f.properties.name))
      .map(f => ({ type: 'Feature', properties: { n: f.properties.name_en || f.properties.name || '', r: f.properties.scalerank }, geometry: slim(f.geometry, tol, dec) })).filter(f => f.geometry)));
  }
  // modern countries
  const a50 = load(path.join(NE, 'ne_50m_admin_0_countries.geojson'));
  save('admin0_50.json', fc(a50.features.map(f => ({ type: 'Feature', properties: { a3: f.properties.ADM0_A3, n: f.properties.NAME }, geometry: slim(f.geometry, 0.01, 3) }))));
  const a10 = load(path.join(NE, 'ne_10m_admin_0_countries.geojson'));
  const ME = [20, 28, 62, 50];
  save('admin0_10_me.json', fc(a10.features.filter(f => hits(bboxOf(f.geometry), ME)).map(f => ({ type: 'Feature', properties: { a3: f.properties.ADM0_A3, n: f.properties.NAME }, geometry: slim(f.geometry, 0.002, 4) }))));
  // admin-1 units around the Caucasus (building blocks for historical regions)
  const a1 = load(path.join(NE, 'ne_10m_admin_1_states_provinces.geojson'));
  const CA = [34, 35, 54, 46.5];
  save('admin1_cauc.json', fc(a1.features.filter(f => ['GEO', 'ARM', 'AZE', 'TUR', 'IRN', 'RUS'].includes(f.properties.adm0_a3) && hits(bboxOf(f.geometry), CA))
    .map(f => ({ type: 'Feature', properties: { id: f.properties.iso_3166_2, n: f.properties.name, a3: f.properties.adm0_a3 }, geometry: slim(f.geometry, 0.002, 4) }))));
  // mountain ranges
  const gr = load(path.join(NE, 'ne_10m_geography_regions_polys.geojson'));
  save('mountains.json', fc(gr.features.filter(f => /Range\/mtn/.test(f.properties.FEATURECLA) && f.properties.SCALERANK <= 5)
    .map(f => ({ type: 'Feature', properties: { n: f.properties.NAME, r: f.properties.SCALERANK }, geometry: slim(f.geometry, 0.02, 3) })).filter(f => f.geometry)));
}

if (OSM) {
  const canon = n => {
    if (!n) return null;
    if (/Kura|Kür|Кура|Mtkvari|მტკვარი/.test(n)) return 'მტკვარი';
    if (/Aras|Araz|Արաքս|Apaqs|آراز|ارس/.test(n)) return 'არაქსი';
    if (/Терек|თერგი/.test(n)) return 'თერგი';
    if (/Кубань/.test(n)) return 'ყუბანი';
    if (/Akhurian|Ախուրյան|Arpaçay/.test(n)) return 'ახურიანი';
    if (/Сулак|სულაკი/.test(n)) return 'სულაკი';
    if (/Самур/.test(n)) return 'სამური';
    if (/Kars Çayı/.test(n)) return null;
    if (/ლიახვი/.test(n)) return 'ლიახვი';
    if (/არაგვი/.test(n)) return 'არაგვი';
    if (/ფოცხოვ/.test(n)) return 'ფოცხოვი';
    return n;
  };
  const byName = {};
  for (const f of ['rivers_all.json']) {
    const j = load(path.join(OSM, f));
    for (const e of j.elements) {
      const n = canon(e.tags['name:ka'] || e.tags.name);
      if (!n || !e.geometry) continue;
      (byName[n] = byName[n] || []).push(e.geometry.map(p => [p.lon, p.lat]));
    }
  }
  // stitch ways end-to-end where possible, then simplify
  const key = p => p[0].toFixed(5) + ',' + p[1].toFixed(5);
  const feats = [];
  for (const [n, lines] of Object.entries(byName)) {
    let segs = lines.map(l => l.slice());
    let merged = true;
    while (merged) {
      merged = false;
      outer: for (let i = 0; i < segs.length; i++) for (let j = 0; j < segs.length; j++) {
        if (i === j) continue;
        const a = segs[i], b = segs[j];
        if (key(a[a.length - 1]) === key(b[0])) { segs[i] = a.concat(b.slice(1)); segs.splice(j, 1); merged = true; break outer; }
        if (key(a[a.length - 1]) === key(b[b.length - 1])) { segs[i] = a.concat(b.slice(0, -1).reverse()); segs.splice(j, 1); merged = true; break outer; }
      }
    }
    const g = roundGeom(dp({ type: 'MultiLineString', coordinates: segs }, 0.002), 4);
    if (g) feats.push({ type: 'Feature', properties: { n }, geometry: g });
  }
  save('rivers_cauc.json', fc(feats));
}

if (HB) {
  for (const f of fs.readdirSync(HB).filter(f => /^world_.*\.geojson$/.test(f))) {
    const y = f.replace('world_', '').replace('.geojson', '');
    const j = load(path.join(HB, f));
    const feats = j.features.filter(ft => ft.geometry).map(ft => ({ type: 'Feature', properties: { n: ft.properties.NAME || null, s: ft.properties.SUBJECTO || null, p: ft.properties.PARTOF || null }, geometry: slim(ft.geometry, 0.004, 3) })).filter(ft => ft.geometry);
    fs.writeFileSync(path.join(OUT, 'hb', y + '.json'), JSON.stringify(fc(feats)));
  }
  console.log('hb done');
}
