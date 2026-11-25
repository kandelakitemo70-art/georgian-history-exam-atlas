// Step 3 of the tests pipeline: ex/<id>-test.json + ex/<id>-scheme.json -> structured test (questions, answer key, criteria).
// Exported parseTest(id) is used by build.mjs; run directly to print a report:  node parse.mjs [id ...] [-v]
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
import { buildChunks, columnSplit } from './lines.mjs';
import M from './manifest.mjs';
import FIX from './fixes.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const EX = path.join(here, 'ex');
const load = f => JSON.parse(fs.readFileSync(path.join(EX, f), 'utf8'));

// ---------- text helpers
const JUNK = [
  /^კითხვები იხილეთ/, /^კითხვები\s*$/, /^იხილეთ\s*$/, /^შემდეგ გვერდზე\.?$/, /^ტექსტის გაგრძელება/, /^ტექსტი იხილეთ/, /^გადასვლა/, /^დაბრუნება/,
  /იხილეთ შემდეგ გვერდ/, /^რუკა და კითხვები/, /^დავალება და კითხვები/, /^გისურვებთ/, /^შემდეგ გვერდზე გადასასვლელად/, /^შეგიძლიათ გამოიყენოთ/,
  /^\d{1,2}(\s+\d{1,2}){3,}$/,   // "1 2 3 4 5 6" link rows
];
const isJunk = t => JUNK.some(r => r.test(t));
const GE_VOWEL = /[აეიოუ]/;

// word list for de-hyphenation, from every extracted file
const DICT = new Map();
for (const f of fs.readdirSync(EX).filter(f => f.endsWith('.json'))) {
  for (const pg of load(f).pages) for (const it of pg.items) for (const w of it.s.split(/[\s,.;:!?„“"'()«»\[\]]+/)) if (w) DICT.set(w, (DICT.get(w) || 0) + 1);
}
export const hyphenLog = [];
function joinText(a, b) {
  if (!a) return b; if (!b) return a;
  const m = a.match(/([ა-ჿA-Za-z]+)-$/);
  if (m && !/\s-$/.test(a)) {
    const w1 = m[1], w2 = (b.match(/^([ა-ჿA-Za-z]+)/) || [, ''])[1];
    if (!w2) return a + b;
    const hy = w1 + '-' + w2, so = w1 + w2;
    let keep;
    const ENDING = /^(ს|მ|მა|ის|ისა|ისი|ში|ზე|თან|ით|ად|ისთვის|ისგან|იდან|ამდე|ზეც|საც|ისაც)$/;
    if (FIX.hyphen && FIX.hyphen[hy] != null) keep = FIX.hyphen[hy];
    else if (/^[A-Za-z0-9]+$/.test(w1)) keep = true;                                   // I-ის, XIX-ის
    else if (!GE_VOWEL.test(w1) && w1.length >= 3 && ENDING.test(w2)) keep = true;     // სსრკ-მა, აშშ-ში
    else if (DICT.has(hy) && !DICT.has(so)) keep = true;
    else if (DICT.has(so)) keep = false;
    else if (DICT.has(hy)) keep = true;
    else if (/^ხან/.test(w2)) keep = true;                                             // დაუდ-ხანი
    else if (w1.length >= 4 && w2.length >= 4 && DICT.has(w1) && DICT.has(w2.replace(/[,.;:]$/, ''))) keep = true;   // two whole words
    else keep = false;                                                                  // typesetting break inside a word
    hyphenLog.push(`${keep ? 'KEEP' : 'JOIN'} ${hy}`);
    return keep ? a + b : a.slice(0, -1) + b;
  }
  return a + ' ' + b;
}
const clean = s => s.replace(/\s+/g, ' ').replace(/\s+([,.;:!?])/g, '$1').replace(/„\s+/g, '„').replace(/\s+“/g, '“').trim();

// ---------- page model
function pageModel(pg) {
  const chunks = buildChunks(pg.items).filter(c => !(/^\d{1,3}$/.test(c.text) && c.y > pg.H * 0.86));
  // navigation leftovers of the electronic booklet ("კითხვები იხილეთ შემდეგ გვერდზე", link rows) are dropped item by item
  const junkItems = new Set(chunks.filter(c => isJunk(c.text)).flatMap(c => c.items));
  const items = chunks.filter(c => !isJunk(c.text)).flatMap(c => c.items).filter(i => !junkItems.has(i));
  const images = pg.images.filter(b => b.w > 120 && b.h > 120 && !(b.w < 200 && b.h < 200));   // drop the small instruction icons
  return { p: pg.p, W: pg.W, H: pg.H, items, all: chunks, images };
}
// rows of items -> lines (one per baseline), words joined with spaces by gap
function rowsToLines(items) {
  const rows = [];
  for (const it of items.slice().sort((a, b) => a.y - b.y || a.x - b.x)) {
    let row = null;
    for (let k = rows.length - 1; k >= 0 && k >= rows.length - 3; k--) if (Math.abs(rows[k].y - it.y) <= Math.max(2.5, 0.3 * Math.min(rows[k].sz, it.sz))) { row = rows[k]; break; }
    if (!row) { row = { y: it.y, sz: it.sz, its: [] }; rows.push(row); }
    row.its.push(it); row.sz = Math.max(row.sz, it.sz);
  }
  return rows.map(r => {
    r.its.sort((a, b) => a.x - b.x);
    let s = '', end = null;
    for (const it of r.its) { if (end != null && it.x - end > 0.1 * it.sz && !s.endsWith(' ') && !it.s.startsWith(' ')) s += ' '; s += it.s; end = it.x + it.w; }
    return { text: s.replace(/[  ]+/g, ' ').trim(), x0: r.its[0].x, x1: end, y: r.y, sz: r.sz };
  }).filter(l => l.text && !isJunk(l.text));
}
// two text columns? split where no word crosses and both sides hold text
function splitItems(items, W) {
  // a real gutter: an empty vertical band (no word touches x±4) with at least 3 lines on each side,
  // and the right-hand lines starting close to the gutter (not the tail of one long line)
  const rowKey = i => Math.round(i.y / 4);
  let best = null;
  for (let x = W * 0.3; x <= W * 0.7; x += 2) {
    if (items.some(i => i.x < x + 4 && i.x + i.w > x - 4)) continue;
    const left = new Set(), rightStart = new Map();
    for (const i of items) {
      if (i.x + i.w <= x) left.add(rowKey(i));
      else { const k = rowKey(i); rightStart.set(k, Math.min(rightStart.get(k) ?? 1e9, i.x)); }
    }
    const aligned = [...rightStart.values()].filter(x0 => x0 < x + 45).length;
    if (left.size >= 3 && rightStart.size >= 3 && aligned >= 3 && (best == null || Math.abs(x - W / 2) < Math.abs(best - W / 2))) best = x;
  }
  return best;
}
// reading-order lines per column; each line knows its column's left edge and width
function columnsOf(pm, items = pm.items) {
  const split = splitItems(items, pm.W);
  const cols = split == null ? [items] : [items.filter(i => i.x + i.w <= split + 1), items.filter(i => i.x + i.w > split + 1)];
  return cols.map(its => {
    const ls = rowsToLines(its);
    if (!ls.length) return ls;
    const xs = ls.map(l => l.x0).sort((a, b) => a - b);
    const base = xs[Math.floor(xs.length * 0.2)] ?? xs[0], right = Math.max(...ls.map(l => l.x1));
    ls.forEach((l, i) => { l.base = Math.min(base, l.x0 + 0.01); l.right = right; l.colStart = i === 0; });
    return ls;
  }).filter(c => c.length);
}
// paragraphs: an indented line, a big vertical gap, a list marker, or a short line ending a sentence starts a new one
function paragraphs(lines, { listBreaks = true, colon = true } = {}) {
  if (!lines.length) return [];
  const gaps = []; for (let i = 1; i < lines.length; i++) if (!lines[i].colStart) gaps.push(lines[i].y - lines[i - 1].y);
  const med = gaps.length ? gaps.slice().sort((a, b) => a - b)[Math.floor(gaps.length / 2)] : 20;
  const paras = [];
  let cur = null, prev = null;
  for (const l of lines) {
    const t = l.text;
    const base = l.base ?? lines[0].x0, right = l.right ?? Math.max(...lines.map(q => q.x1));
    const indent = l.x0 > base + 12;
    const gap = prev && !l.colStart ? l.y - prev.y : 0;
    const list = listBreaks && /^(\d{1,2}[.)]|[•●]|[ა-ე]\))\s/.test(t);
    const prevEnded = prev && /[.:!?“»)]$/.test(prev.text) && (prev.right ?? right) - prev.x1 > 0.12 * ((prev.right ?? right) - (prev.base ?? base));
    if (!cur || indent || gap > med * 1.55 || list || (colon && prevEnded) || (colon && prev && /[:!]$/.test(prev.text))) { cur = { t }; paras.push(cur); }
    else cur.t = joinText(cur.t, t);
    prev = l;
  }
  // a source citation "( … )" broken over lines stays one paragraph
  const out = [];
  for (const p of paras.map(p => clean(p.t)).filter(Boolean)) {
    const last = out[out.length - 1];
    if (last && /^\(/.test(last) && (last.split('(').length > last.split(')').length)) out[out.length - 1] = joinText(last, p);
    else out.push(p);
  }
  return out;
}

// ---------- regexes
const RX_INSTR = /^ინსტრუქცია\s*დავალებ\S*\s*[№#]\s*(\d{1,2})(?:\s*[-–]\s*(\d{1,2})|\s*და\s*(\d{1,2}))?\.?\s*(.*)$/;
const RX_Q = /^(?:\((\d{1,2})\)\s*)?(\d{1,2})\.\s+(.*)$/;          // "(1) 12. text" / "12. text"
const RX_SUB = /^\((\d{1,2})\)\s*(\d{1,2})\.(\d{1,2})\.?\s*(.*)$/;   // "(2) 25.9. text" / "(1) 38.1 text"
const RX_OPT = /^([ა-დ])(?:\)\s*|\.\s+)(.*)$/;   // "ა) …" (2017–) or "ა. …" (2016)
const RX_TASK = /^დავალება\s*(\d{1,2})\.?\s*(.*)$/;
const LETTERS = ['ა', 'ბ', 'გ', 'დ'];

function classify(instr) {
  if (/ქრონოლოგიურად/.test(instr)) return 'order';
  if (/რუკა,? რომელსაც ახლავს/.test(instr)) return 'mapmc';
  if (/ოთხი სავარაუდო პასუხი/.test(instr)) return 'mc';
  if (/ორი სხვადასხვა ტიპის წყარო|წყაროს|წყარო:/.test(instr)) return 'sources';
  if (/ილუსტრაცი/.test(instr)) return 'illustration';
  if (/დოკუმენტ/.test(instr)) return 'document';
  if (/რუკა/.test(instr)) return 'map';
  if (/მნიშვნელობა/.test(instr)) return 'significance';
  return 'event';
}
export const KIND_NAMES = {
  mc: 'ტესტური დავალებები', order: 'ქრონოლოგიური თანმიმდევრობა', mapmc: 'ისტორიული რუკის ანალიზი', map: 'ისტორიული რუკის ანალიზი',
  sources: 'ორი წყაროს შეჯერება', illustration: 'ილუსტრაციის ანალიზი', document: 'ისტორიული დოკუმენტის ანალიზი',
  event: 'მოვლენის ანალიზი', significance: 'ისტორიული პროცესის მნიშვნელობის შეფასება',
};

// ---------- test parser
export function parseTest(id) {
  const meta = M.find(m => m.id === id);
  const fx = (FIX.tests && FIX.tests[id]) || {};
  const T = load(id + '-test.json');
  const pages = T.pages.map(pageModel);
  const warn = [];
  // cover: points and time
  const cover = pages[0].all.map(c => c.text).join(' ');
  let max = +((cover.match(/მაქსიმალური ქულაა\s*-?\s*(\d+)/) || [])[1] || 0);   // older covers are drawn, not text: see the scheme below
  const tm = cover.match(/(\d+)\s*საათი(?:\s*და\s*(\d+)\s*წუთი)?/);
  const time = tm ? (+tm[1]) * 60 + (+(tm[2] || 0)) : 160;

  const sections = [];
  const tasks = new Map();   // n -> task
  let sec = null;
  const task = (n, kind) => {
    if (!tasks.has(n)) tasks.set(n, { n: String(n), kind, sec: sections.indexOf(sec), stimPages: [], prompt: [], sub: [] });
    return tasks.get(n);
  };
  const stimTask = () => sec && sec.from === sec.to ? task(sec.from, sec.kind) : null;

  for (const pm of pages.slice(1)) {
    const cols = columnsOf(pm);
    const flat = cols.flat();
    if (!flat.length && !pm.images.length) continue;
    const first = flat[0] ? flat[0].text : '';
    const mi = first.match(RX_INSTR);
    if (mi) {
      const from = +mi[1], to = +(mi[2] || mi[3] || mi[1]);
      const rest = [mi[4], ...flat.slice(1).map(c => c.text)].filter(Boolean);
      const instrParas = paragraphs([{ ...flat[0], text: mi[4] || '' }, ...flat.slice(1)].filter(l => l.text), { listBreaks: false });
      const text = rest.join(' ');
      sec = { from, to, kind: classify(text), instr: instrParas, page: pm.p };
      if (fx.kinds && fx.kinds[from]) sec.kind = fx.kinds[from];
      sections.push(sec);
      continue;
    }
    if (!sec) { warn.push(`p${pm.p}: content before first instruction: ${first.slice(0, 50)}`); continue; }

    // MC / chronology question pages: one question per page
    const mq = first.match(RX_Q);
    if ((sec.kind === 'mc' || sec.kind === 'order') && mq && +mq[2] >= sec.from && +mq[2] <= sec.to && !RX_SUB.test(first)) {
      const n = +mq[2];
      const t = task(n, sec.kind);
      t.page = pm.p;
      if (mq[1]) t.p = +mq[1];
      const lines = flat.slice(1);
      const base = flat[0].x0;
      const stem = [{ ...flat[0], text: mq[3] }];
      const opts = [], items = [];
      for (const l of lines) {
        const mo = l.text.match(RX_OPT);
        const mitem = sec.kind === 'order' && l.text.match(/^(\d)\.\s*(.*)$/);
        if (mo) opts.push({ k: mo[1], t: mo[2] });
        else if (mitem && l.x0 > base + 8) items.push({ k: mitem[1], t: mitem[2] });
        else if (opts.length) opts[opts.length - 1].t = joinText(opts[opts.length - 1].t, l.text);
        else if (items.length && l.x0 > base + 8) items[items.length - 1].t = joinText(items[items.length - 1].t, l.text);
        else stem.push(l);
      }
      t.q = paragraphs(stem, { colon: false });
      if (sec.kind === 'mc') {
        t.o = opts.map(o => clean(o.t));
        if (opts.map(o => o.k).join('') !== 'აბგდ') warn.push(`${n}: options ${opts.map(o => o.k).join('')}`);
      } else {
        t.items = items.map(o => clean(o.t).replace(/[;.]$/, ''));
        if (items.length < 3) warn.push(`${n}: chronology items ${items.length}`);
      }
      if (pm.images.length) t.img = pm.images.map(b => ({ page: pm.p, box: b }));
      continue;
    }

    // sub-questions (open or map-MC), possibly preceded by a "დავალება N." prompt on the same page
    const hasSub = flat.some(c => RX_SUB.test(c.text));
    let mt = first.match(RX_TASK);
    if (!mt && !hasSub && sec.from !== sec.to) { const mn = first.match(/^(\d{1,2})\.\s*\.?\s*(.+)$/); if (mn && +mn[1] >= sec.from && +mn[1] <= sec.to) mt = [mn[0], mn[1], '', mn[2]]; }
    // "დავალება 33." over pictures, or "დავალება 38. ნაწყვეტი …" opening a document: that page is the task's source material
    const srcKinds = ['document', 'sources', 'illustration', 'map', 'mapmc'];
    if (mt && !hasSub && (pm.images.length || srcKinds.includes(sec.kind))) {
      const tk = task(+mt[1], sec.kind);
      tk.page = tk.page || pm.p;
      addStim(tk, pm, mt[2] || mt[3] || '');
      continue;
    }
    if (hasSub || mt) {
      let cur = null, curTask = null, prompt = [];
      if (mt) { curTask = task(+mt[1], sec.kind); curTask.page = curTask.page || pm.p; if (mt[3]) curTask.topic = mt[3].trim(); if (mt[2] && !isJunk(mt[2])) prompt.push({ ...flat[0], text: mt[2] }); }
      for (const l of mt ? flat.slice(1) : flat) {
        const ms = l.text.match(RX_SUB);
        if (ms) {
          const n = +ms[2];
          curTask = task(n, sec.kind);
          curTask.page = curTask.page || pm.p;
          cur = { n: `${ms[2]}.${ms[3]}`, p: +ms[1], qLines: [{ ...l, text: ms[4] }], opts: [], page: pm.p };
          if (curTask.sub.some(s => s.n === cur.n)) warn.push(`dup sub ${cur.n}`);
          curTask.sub.push(cur);
          continue;
        }
        if (/^კითხვები:?$/.test(l.text)) continue;
        if (!cur) { prompt.push(l); continue; }
        const mo = l.text.match(RX_OPT);
        if (mo) cur.opts.push({ k: mo[1], t: mo[2] });
        else if (cur.opts.length) cur.opts[cur.opts.length - 1].t = joinText(cur.opts[cur.opts.length - 1].t, l.text);
        else cur.qLines.push(l);
      }
      if (prompt.length) {
        const tk = curTask || stimTask();
        if (tk) tk.prompt.push(...paragraphs(prompt)); else warn.push(`p${pm.p}: orphan prompt`);
      }
      continue;
    }

    // stimulus page (map, illustration, scheme, source text) for a one-task section
    const tk = stimTask();
    if (!tk) { warn.push(`p${pm.p}: stimulus outside a one-task section: ${first.slice(0, 60)}`); continue; }
    tk.page = tk.page || pm.p;
    addStim(tk, pm, null);
  }
  function addStim(tk, pm, title) {
    const imgs = pm.images.slice().sort((a, b) => Math.abs(a.y - b.y) > 30 ? a.y - b.y : a.x - b.x);   // reading order: rows, then left to right
    // text inside an image box belongs to the image (labels); bare figure numbers ("1   2") are dropped too
    const outside = i => !imgs.some(b => i.x >= b.x - 2 && i.x + i.w <= b.x + b.w + 2 && i.y >= b.y - 2 && i.y <= b.y + b.h + 2);
    const tcols = columnsOf(pm, pm.items.filter(outside));
    let lines = tcols.flat().filter(l => !/^[\d\s№N]+$/.test(l.text));
    if (title != null && lines.length) {
      // the first line carried "დავალება N." — keep only what followed it (a document title)
      const t0 = lines[0].text.replace(/^დავალება\s*\d{1,2}\.?\s*|^\d{1,2}\.\s*\.?\s*/, '').trim();
      lines = t0 ? [{ ...lines[0], text: t0 }, ...lines.slice(1)] : lines.slice(1);
    }
    tk.stimPages.push({ page: pm.p, imgs, lines, cols: tcols.length });
  }

  // ---------- answer key / criteria from the scheme
  const S = load(id + '-scheme.json');
  const key = { mc: {}, order: {}, crit: {}, total: {} };
  let ctx = null;   // current criteria label
  const schemeLines = [];
  for (const pg of S.pages) {
    const ch = buildChunks(pg.items).filter(c => !(/^\d{1,2}$/.test(c.text) && c.y > pg.H * 0.86));
    ch.sort((a, b) => a.y - b.y || a.x0 - b.x0);
    for (const c of ch) schemeLines.push(c);
  }
  for (const c of schemeLines) {
    let t = c.text.replace(/ /g, ' ').trim();
    for (const [a, b] of fx.scheme || []) t = t.replace(a, b);
    let m;
    if (!max && (m = t.match(/^სულ\s*(\d{2})\s*ქულა\.?$/))) max = +m[1];
    if (/ერთიანი ეროვნული გამოცდები|შეფასების სქემა|^სულ\s*\d+\s*ქულა$|თითოეული (დავალება|კითხვა) 1 ქულით/.test(t)) continue;
    if ((m = t.match(/^(\d{1,2})\s*[.–-]\s*([ა-დ])\s*[.;]?$/))) { key.mc[m[1]] = m[2]; ctx = null; continue; }
    if ((m = t.match(/^(\d{1,2}\.\d{1,2})\.?\s*([ა-დ])\s*[.;]?$/))) { key.mc[m[1]] = m[2]; ctx = null; continue; }
    if ((m = t.match(/^(\d{1,2})\.\s*(\d)[\s,;–-]*(\d)[\s,;–-]*(\d)(?:[\s,;–-]*(\d))?\s*\.?$/))) { key.order[m[1]] = [m[2], m[3], m[4], m[5]].filter(Boolean).map(Number); ctx = null; continue; }
    if ((m = t.match(/^(\d{1,2})\.\s*სულ\s*(\d+)\s*ქულა\.?\s*(.*)$/))) { key.total[m[1]] = +m[2]; ctx = m[1]; key.crit[ctx] = m[3] ? [m[3]] : []; continue; }
    if ((m = t.match(/^(\d{1,2}\.\d{1,2})\.?\s*(.*)$/))) { ctx = m[1]; key.crit[ctx] = m[2] ? [m[2]] : []; continue; }
    if ((m = t.match(/^(\d{1,2})\.\s(\d{1,2})\.\s*(.*)$/))) { ctx = m[1] + '.' + m[2]; key.crit[ctx] = m[3] ? [m[3]] : []; continue; }   // "34. 1." typed with a space
    if (ctx) key.crit[ctx].push(t);
  }
  for (const k in key.crit) key.crit[k] = critParas(key.crit[k]);

  // ---------- assemble items
  const out = [];
  for (const [n, t] of [...tasks.entries()].sort((a, b) => a[0] - b[0])) {
    const s = sections[t.sec] || {};
    if (t.kind === 'mc') {
      const a = key.mc[n];
      if (!a) warn.push(`${n}: no key`);
      out.push({ n: t.n, t: 'mc', p: t.p || 1, q: t.q, o: t.o, a: LETTERS.indexOf(a), ...(t.img ? { img: t.img } : {}) });
    } else if (t.kind === 'order') {
      const a = key.order[n];
      if (!a) warn.push(`${n}: no order key`);
      out.push({ n: t.n, t: 'order', p: t.p || 1, q: t.q, items: t.items, a: a || [] });
    } else {
      const sub = t.sub.map(sq => {
        const q = paragraphs(sq.qLines, { colon: false });
        if (sq.opts.length) {
          const a = key.mc[sq.n];
          if (!a) warn.push(`${sq.n}: no key`);
          if (sq.opts.map(o => o.k).join('') !== 'აბგდ') warn.push(`${sq.n}: options ${sq.opts.map(o => o.k).join('')}`);
          return { n: sq.n, t: 'mc', p: sq.p, q, o: sq.opts.map(o => clean(o.t)), a: LETTERS.indexOf(a) };
        }
        const crit = key.crit[sq.n];
        if (!crit) warn.push(`${sq.n}: no criteria`);
        return { n: sq.n, t: 'open', p: sq.p, q, crit: crit || [] };
      });
      if (sub.length && sub.every(q => q.t === 'mc')) t.kind = 'mapmc';
      const stim = { imgs: t.stimPages.flatMap(sp => sp.imgs.map(b => ({ page: sp.page, box: b }))), text: paragraphs(t.stimPages.flatMap(sp => sp.lines)), pages: t.stimPages.map(sp => sp.page + (sp.cols > 1 ? '(2 cols)' : '')) };
      const g = { n: t.n, t: 'group', kind: t.kind, title: KIND_NAMES[t.kind] || '', instr: s.instr || [], prompt: t.prompt, stim, sub };
      if (!sub.length) {
        // a task without sub-questions (2020–22 tasks 22–23): the prompt is the question
        const p = key.total[n] || (fx.points && fx.points[n]) || 2;
        const crit = key.crit[n] || [];
        if (!key.crit[n]) warn.push(`${n}: no criteria (whole task)`);
        // "მოიყვანეთ ერთი არგუმენტი … მომხრე / … მოწინააღმდეგე": one answer box per request, 1 point each
        const asks = g.prompt.filter(x => /^(მოიყვანეთ|მოიტანეთ|დაასახელეთ|შეაფასეთ)/.test(x));
        if (asks.length >= 2 && asks.length === p) {
          g.prompt = g.prompt.filter(x => !asks.includes(x));
          g.sub = asks.map((x, i) => ({ n: `${t.n}.${i + 1}`, virt: true, t: 'open', p: 1, q: [x], crit: crit.length === asks.length ? [crit[i]] : crit }));
        } else g.sub = [{ n: t.n, t: 'open', p, q: [], crit }];
      } else if (key.crit[n] && key.crit[n].length) g.critAll = key.crit[n];
      out.push(g);
    }
  }
  // points check
  const pts = out.reduce((a, it) => a + (it.t === 'group' ? it.sub.reduce((b, s) => b + s.p, 0) : it.p), 0);
  if (pts !== max) warn.push(`points ${pts} != max ${max}`);
  for (const n in key.total) {
    const g = out.find(it => it.n === n && it.t === 'group');
    if (g) { const s = g.sub.reduce((b, q) => b + q.p, 0); if (s !== key.total[n]) warn.push(`task ${n}: sub points ${s} != scheme total ${key.total[n]}`); }
  }
  return { meta, max, time, sections, items: out, warn };
}
function critParas(lines) {
  // criteria lines: keep the official wording; join wrapped lines, start a new paragraph after "ქულა" endings
  const out = [];
  let cur = '';
  for (const l of lines) {
    cur = cur ? joinText(cur, l) : l;
    if (/ქულ[აით]\.?;?$|ფასდება\.?$|ქულაა\.?$/.test(l)) { out.push(clean(cur)); cur = ''; }
  }
  if (cur) out.push(clean(cur));
  return out;
}

// ---------- report
if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const args = process.argv.slice(2), verbose = args.includes('-v'), ids = args.filter(a => !a.startsWith('-'));
  for (const m of M) {
    if (ids.length && !ids.some(i => m.id.startsWith(i))) continue;
    const r = parseTest(m.id);
    const nMc = r.items.reduce((a, it) => a + (it.t === 'mc' ? 1 : it.t === 'group' ? it.sub.filter(s => s.t === 'mc').length : 0), 0);
    const nOpen = r.items.reduce((a, it) => a + (it.t === 'group' ? it.sub.filter(s => s.t === 'open').length : 0), 0);
    const nOrd = r.items.filter(it => it.t === 'order').length;
    console.log(`${m.id}: max ${r.max} time ${r.time} | items ${r.items.length} mc ${nMc} order ${nOrd} open ${nOpen} | sections ${r.sections.map(s => s.from + (s.to !== s.from ? '-' + s.to : '') + ':' + s.kind).join(' ')}${r.warn.length ? '\n   WARN ' + r.warn.join('\n   WARN ') : ''}`);
    if (verbose) console.log(JSON.stringify(r.items, null, 1).slice(0, 20000));
  }
}
