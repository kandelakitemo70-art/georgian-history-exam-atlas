// Small planar geometry helpers (lon/lat treated as planar; fine for regional maps).

function dpLine(pts, tol) {
  if (pts.length <= 2) return pts;
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  const t2 = tol * tol;
  while (stack.length) {
    const [a, b] = stack.pop();
    const [ax, ay] = pts[a], [bx, by] = pts[b];
    const dx = bx - ax, dy = by - ay, L = dx * dx + dy * dy;
    let maxD = -1, idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = pts[i];
      let d;
      if (L === 0) d = (px - ax) ** 2 + (py - ay) ** 2;
      else {
        let t = ((px - ax) * dx + (py - ay) * dy) / L; t = Math.max(0, Math.min(1, t));
        d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      }
      if (d > maxD) { maxD = d; idx = i; }
    }
    if (maxD > t2) { keep[idx] = 1; stack.push([a, idx], [idx, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

export function ringArea(r) { let s = 0; for (let i = 0, n = r.length; i < n; i++) { const [x1, y1] = r[i], [x2, y2] = r[(i + 1) % n]; s += x1 * y2 - x2 * y1; } return s / 2; }

function dpRing(r, tol) {
  const s = dpLine(r, tol);
  if (s.length < 4) return null;
  if (Math.abs(ringArea(s)) < tol * tol * 2) return null;
  return s;
}

export function dp(g, tol) {
  if (!g) return null;
  switch (g.type) {
    case 'LineString': { const c = dpLine(g.coordinates, tol); return c.length >= 2 ? { type: g.type, coordinates: c } : null; }
    case 'MultiLineString': { const c = g.coordinates.map(l => dpLine(l, tol)).filter(l => l.length >= 2); return c.length ? { type: g.type, coordinates: c } : null; }
    case 'Polygon': { const rings = []; for (let i = 0; i < g.coordinates.length; i++) { const r = dpRing(g.coordinates[i], tol); if (!r) { if (i === 0) return null; continue; } rings.push(r); } return { type: 'Polygon', coordinates: rings }; }
    case 'MultiPolygon': { const polys = g.coordinates.map(p => dp({ type: 'Polygon', coordinates: p }, tol)).filter(Boolean).map(p => p.coordinates); return polys.length ? { type: 'MultiPolygon', coordinates: polys } : null; }
    case 'GeometryCollection': { const gs = g.geometries.map(x => dp(x, tol)).filter(Boolean); return gs.length ? { type: g.type, geometries: gs } : null; }
    default: return g;
  }
}

export function roundGeom(g, dec) {
  if (!g) return null;
  const f = 10 ** dec;
  const r = c => typeof c[0] === 'number' ? [Math.round(c[0] * f) / f, Math.round(c[1] * f) / f] : c.map(r);
  if (g.type === 'GeometryCollection') return { type: g.type, geometries: g.geometries.map(x => roundGeom(x, dec)) };
  // drop consecutive duplicates created by rounding
  const dedup = c => {
    if (typeof c[0][0] === 'number') return c.filter((p, i) => i === 0 || p[0] !== c[i - 1][0] || p[1] !== c[i - 1][1]);
    return c.map(dedup);
  };
  let coords = r(g.coordinates);
  if (g.type !== 'Point' && g.type !== 'MultiPoint') coords = dedup(coords);
  return { type: g.type, coordinates: coords };
}

// --- clipping to an axis-aligned box [w,s,e,n] ---
function clipRing(ring, box) {
  const [w, s, e, n] = box;
  const edges = [
    [p => p[0] >= w, (a, b) => [w, a[1] + (b[1] - a[1]) * (w - a[0]) / (b[0] - a[0])]],
    [p => p[0] <= e, (a, b) => [e, a[1] + (b[1] - a[1]) * (e - a[0]) / (b[0] - a[0])]],
    [p => p[1] >= s, (a, b) => [a[0] + (b[0] - a[0]) * (s - a[1]) / (b[1] - a[1]), s]],
    [p => p[1] <= n, (a, b) => [a[0] + (b[0] - a[0]) * (n - a[1]) / (b[1] - a[1]), n]],
  ];
  let out = ring.slice(0, ring.length - 1);
  for (const [inside, inter] of edges) {
    const inp = out; out = [];
    if (!inp.length) break;
    for (let i = 0; i < inp.length; i++) {
      const cur = inp[i], prev = inp[(i + inp.length - 1) % inp.length];
      const ci = inside(cur), pi = inside(prev);
      if (ci) { if (!pi) out.push(inter(prev, cur)); out.push(cur); }
      else if (pi) out.push(inter(prev, cur));
    }
  }
  if (out.length < 3) return null;
  out.push(out[0]);
  return out;
}

function clipLine(line, box) {
  const [w, s, e, n] = box;
  const inside = p => p[0] >= w && p[0] <= e && p[1] >= s && p[1] <= n;
  // Liang–Barsky per segment
  const seg = (a, b) => {
    let t0 = 0, t1 = 1; const dx = b[0] - a[0], dy = b[1] - a[1];
    const p = [-dx, dx, -dy, dy], q = [a[0] - w, e - a[0], a[1] - s, n - a[1]];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return null; }
      else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return null; if (t > t0) t0 = t; } else { if (t < t0) return null; if (t < t1) t1 = t; } }
    }
    return [[a[0] + t0 * dx, a[1] + t0 * dy], [a[0] + t1 * dx, a[1] + t1 * dy]];
  };
  const parts = []; let cur = null;
  for (let i = 1; i < line.length; i++) {
    const c = seg(line[i - 1], line[i]);
    if (!c) { if (cur) { parts.push(cur); cur = null; } continue; }
    if (!cur) cur = [c[0]];
    cur.push(c[1]);
    if (!inside(line[i])) { parts.push(cur); cur = null; }
  }
  if (cur) parts.push(cur);
  return parts.filter(p => p.length >= 2);
}

export function clipGeom(g, box) {
  if (!g) return null;
  switch (g.type) {
    case 'Polygon': { const rings = []; for (let i = 0; i < g.coordinates.length; i++) { const r = clipRing(g.coordinates[i], box); if (!r) { if (i === 0) return null; continue; } rings.push(r); } return { type: 'Polygon', coordinates: rings }; }
    case 'MultiPolygon': { const ps = g.coordinates.map(p => clipGeom({ type: 'Polygon', coordinates: p }, box)).filter(Boolean).map(p => p.coordinates); return ps.length ? { type: 'MultiPolygon', coordinates: ps } : null; }
    case 'LineString': { const ls = clipLine(g.coordinates, box); return ls.length ? { type: 'MultiLineString', coordinates: ls } : null; }
    case 'MultiLineString': { const ls = g.coordinates.flatMap(l => clipLine(l, box)); return ls.length ? { type: 'MultiLineString', coordinates: ls } : null; }
    default: return g;
  }
}

export function bboxOf(g) {
  const b = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = c => { if (typeof c[0] === 'number') { if (c[0] < b[0]) b[0] = c[0]; if (c[1] < b[1]) b[1] = c[1]; if (c[0] > b[2]) b[2] = c[0]; if (c[1] > b[3]) b[3] = c[1]; } else c.forEach(walk); };
  if (g.type === 'GeometryCollection') g.geometries.forEach(x => walk(x.coordinates)); else walk(g.coordinates);
  return b;
}
export const boxHits = (b, box) => !(b[2] < box[0] || b[0] > box[2] || b[3] < box[1] || b[1] > box[3]);

// Convert any (Multi)Polygon geometry to polygon-clipping "MultiPolygon" coords and back.
export const toPC = g => g.type === 'Polygon' ? [g.coordinates] : g.coordinates;
export const fromPC = mp => !mp || !mp.length ? null : (mp.length === 1 ? { type: 'Polygon', coordinates: mp[0] } : { type: 'MultiPolygon', coordinates: mp });

// d3-geo spherical convention: exterior rings clockwise (negative planar shoelace area), holes counter-clockwise.
export function rewind(geom) {
  if (!geom) return geom;
  const fixPoly = rings => rings.map((r, i) => { const a = ringArea(r); return (i === 0 ? a > 0 : a < 0) ? r.slice().reverse() : r; });
  if (geom.type === 'Polygon') return { type: 'Polygon', coordinates: fixPoly(geom.coordinates) };
  if (geom.type === 'MultiPolygon') return { type: 'MultiPolygon', coordinates: geom.coordinates.map(fixPoly) };
  return geom;
}
