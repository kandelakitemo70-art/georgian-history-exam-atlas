// Step 2 of the tests pipeline: PDF -> positioned text + image boxes (JSON).
// usage: node extract.mjs [id ...]   (default: every PDF in pdf/ that has no ex/<name>.json yet; -f to redo)
import fs from 'fs'; import path from 'path'; import { fileURLToPath } from 'url';
const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
const here = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2), force = args.includes('-f'), only = args.filter(a => a !== '-f');
const OPS = pdfjs.OPS;
const mul = (m, n) => [m[0] * n[0] + m[2] * n[1], m[1] * n[0] + m[3] * n[1], m[0] * n[2] + m[2] * n[3], m[1] * n[2] + m[3] * n[3], m[0] * n[4] + m[2] * n[5] + m[4], m[1] * n[4] + m[3] * n[5] + m[5]];
const r1 = v => Math.round(v * 10) / 10;

export async function extractPdf(pdfPath) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)), verbosity: 0, disableFontFace: true }).promise;
  const out = { file: path.basename(pdfPath), pages: [] };
  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const vp = page.getViewport({ scale: 1 });
    const tc = await page.getTextContent();
    const items = [];
    for (const it of tc.items) {
      if (!it.str || !it.str.trim()) continue;
      const m = pdfjs.Util.transform(vp.transform, it.transform);
      items.push({ s: it.str, x: r1(m[4]), y: r1(m[5]), w: r1(it.width), sz: r1(Math.hypot(m[2], m[3])), f: it.fontName });
    }
    const ol = await page.getOperatorList();
    const images = [];
    let ctm = [1, 0, 0, 1, 0, 0]; const stack = [];
    for (let i = 0; i < ol.fnArray.length; i++) {
      const fn = ol.fnArray[i], a = ol.argsArray[i];
      if (fn === OPS.save) stack.push(ctm.slice());
      else if (fn === OPS.restore) ctm = stack.pop() || [1, 0, 0, 1, 0, 0];
      else if (fn === OPS.transform) ctm = mul(ctm, a);
      else if (fn === OPS.paintImageXObject || fn === OPS.paintInlineImageXObject || fn === OPS.paintImageMaskXObject) {
        const m = mul(vp.transform, ctm);
        const pts = [[0, 0], [1, 0], [0, 1], [1, 1]].map(([u, v]) => [m[0] * u + m[2] * v + m[4], m[1] * u + m[3] * v + m[5]]);
        const xs = pts.map(q => q[0]), ys = pts.map(q => q[1]);
        const box = { x: r1(Math.min(...xs)), y: r1(Math.min(...ys)), w: r1(Math.max(...xs) - Math.min(...xs)), h: r1(Math.max(...ys) - Math.min(...ys)) };
        if (fn === OPS.paintImageXObject && a) { box.nw = a[1]; box.nh = a[2]; }
        if (box.w > 8 && box.h > 8) images.push(box);
      }
    }
    out.pages.push({ p, W: r1(vp.width), H: r1(vp.height), items, images });
    page.cleanup();
  }
  await doc.destroy();
  return out;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === path.resolve(process.argv[1])) {
  const pdfDir = path.join(here, 'pdf'), exDir = path.join(here, 'ex');
  fs.mkdirSync(exDir, { recursive: true });
  for (const f of fs.readdirSync(pdfDir).filter(f => f.endsWith('.pdf')).sort()) {
    const base = f.replace(/\.pdf$/, '');
    if (only.length && !only.some(o => base.startsWith(o))) continue;
    const outF = path.join(exDir, base + '.json');
    if (!force && fs.existsSync(outF)) continue;
    const d = await extractPdf(path.join(pdfDir, f));
    fs.writeFileSync(outF, JSON.stringify(d));
    console.log(base, d.pages.length, 'pages');
  }
}
