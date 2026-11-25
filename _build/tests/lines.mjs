// Text layout helpers for pdf.js items (top-left origin, PDF points).

// Chunks: runs of items on one baseline; a wide gap (> 2.5 em) starts a new chunk (columns, side captions).
export function buildChunks(items) {
  const its = items.slice().sort((a, b) => a.y - b.y || a.x - b.x);
  const rows = [];
  for (const it of its) {
    let row = null;
    for (let k = rows.length - 1; k >= 0 && k >= rows.length - 4; k--) {
      const r = rows[k];
      if (Math.abs(r.y - it.y) <= Math.max(2.5, 0.3 * Math.min(r.sz, it.sz))) { row = r; break; }
    }
    if (!row) { row = { y: it.y, sz: it.sz, items: [] }; rows.push(row); }
    row.items.push(it); row.sz = Math.max(row.sz, it.sz);
  }
  const chunks = [];
  for (const r of rows) {
    r.items.sort((a, b) => a.x - b.x);
    let ch = null;
    for (const it of r.items) {
      const gap = ch ? it.x - ch.x1 : 0;
      if (!ch || gap > 2.5 * it.sz) { ch = { y: r.y, sz: it.sz, x0: it.x, x1: it.x + it.w, text: '', fonts: new Set(), items: [] }; chunks.push(ch); }
      else if (gap > 0.1 * it.sz && !ch.text.endsWith(' ') && !it.s.startsWith(' ')) ch.text += ' ';
      ch.text += it.s; ch.items.push(it); ch.x1 = Math.max(ch.x1, it.x + it.w); ch.sz = Math.max(ch.sz, it.sz); ch.fonts.add(it.f);
    }
  }
  for (const c of chunks) { c.text = c.text.replace(/[  ]+/g, ' ').trim(); c.fonts = [...c.fonts]; }
  return chunks.filter(c => c.text);
}

// Lines (chunks merged across wide gaps, joined with a tab) — handy for dumps.
export function buildLines(items) {
  const ch = buildChunks(items);
  const lines = [];
  for (const c of ch) {
    const l = lines.find(l => Math.abs(l.y - c.y) <= Math.max(2.5, 0.3 * Math.min(l.sz, c.sz)));
    if (l) { l.parts.push(c); l.sz = Math.max(l.sz, c.sz); } else lines.push({ y: c.y, sz: c.sz, parts: [c] });
  }
  for (const l of lines) { l.parts.sort((a, b) => a.x0 - b.x0); l.text = l.parts.map(p => p.text).join('\t'); l.x0 = l.parts[0].x0; l.x1 = l.parts[l.parts.length - 1].x1; l.fonts = [...new Set(l.parts.flatMap(p => p.fonts))]; }
  return lines.sort((a, b) => a.y - b.y);
}

export const isPageNum = (l, page) => /^\d{1,3}$/.test(l.text) && l.y > page.H * 0.86;

// Two text columns? Returns the split x, or null. Chunks crossing the split, or too few on a side, mean one column.
export function columnSplit(chunks, W) {
  let best = null;
  for (let x = W * 0.32; x <= W * 0.68; x += 2) {
    let cross = 0, L = 0, R = 0;
    for (const c of chunks) { if (c.x0 < x - 1 && c.x1 > x + 1) cross++; else if (c.x1 <= x + 1) L++; else R++; }
    if (!cross && L >= 3 && R >= 3 && (best == null || Math.abs(x - W / 2) < Math.abs(best - W / 2))) best = x;
  }
  return best;
}
