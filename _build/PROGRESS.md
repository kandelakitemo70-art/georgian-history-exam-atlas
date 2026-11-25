# საგამოცდო ისტორიული ატლასი — build notes & progress

Site = static files in the parent folder (`index.html`, `assets/`, `data/`, `img/real/`).
Build: `cd _build && node build.mjs [id ...]` → writes `data/maps/<id>.js`, `data/catalog.js`, `_build/artifact-index.html`.
Map definitions: `_build/src/bNN-*.mjs` (each `export default [ {map}, ... ]`), regions in `src/regions.mjs`, palette + hb names in `src/common.mjs`, program blocks in `src/blocks.mjs`.
Raw data (slimmed): `_build/raw/` (Natural Earth, OSM Caucasus rivers, historical-basemaps). Regenerate with `prep.mjs` if needed.
Local preview: any static server on the parent folder (file:// also works since data loads via <script>).

## Map definition cheat-sheet
- `id, block (1–11), ge (Georgian history), year (sort), title, date, view [w,s,e,n], proj ('merc'|'ee'|'conic')`
- `areas: [{n, st: solid|light|hatch|stripes|cross|outline|sphere|ctx, c, c2, g, lbl, lt, ls, lr, note, leg, sea}]`
  - `g`: ring `[[lon,lat]...]` | region name | list of region names | `{p}` `{pp}` `{u:[admin1 ids]}` `{c:[ADM0_A3]}` `{hb:'Name', y:year}` `{or:[..]}` + `minus`/`and`
- `arrows: [{n, c, p:[[lon,lat]...], d (date label), dp (label pos 0–1), ds (side ±1), k: ret|dot, w, lg (legend)}]`
- `lines: [{n, k: border|sphere|front|route|wall|line|dash, c, p, lg}]`
- `pts: [{n, at, k: city|cap|battle|flag|camp|fire|treaty|site|port|star|siege, d, note, lp: r|l|t|b|tr|tl|br|bl|[dx,dy], z (min zoom), c}]`
- `labels: [{n, at, k: sea|state|region|tribe|river|mtn|note, r, s, num, z}]`
- `text: {s (summary), f: [[date, text]...], r: [remember...], how}`, `exam` (string, only if seen on NAEC test/sample), `real: [{f, t, a, l, u, note}]`
- `kindNames` overrides legend labels of point kinds.

## Maps
DONE: all 104 maps across blocks 1–11 (files b01-02-world, b03-georgia-early, b03-world, b04-georgia, b04-georgia2, b04-georgia3, b04-world, b05-georgia, b05-world, b06-world, b07-georgia, b08, b09, b10, b11).
Real maps: picks in scratchpad/commons/picks.json → download.mjs (resumable) → srv/compress.mjs (webp) → _build/src/real.mjs (merged by build).
NEXT: real maps from Wikimedia Commons → img/real/<id>.jpg|png + 'real' entries; final QA (catalog, mobile, dark); publish artifact.
Commons tooling: scratchpad/commons/search.mjs (candidates.json, list*.txt).

Visual check without screenshots (Chrome window is throttled): scratchpad/srv/serve.mjs has POST /save → resvg PNG; page helper code stored in the site's localStorage.snapcode (eval it, then __shoot([...ids])); sheet.mjs makes contact sheets.

PUBLISHED 2026-11-18: https://claude.ai/artifact/KkD7kvRME3VDbFspgk9cLm (republish _build/artifact-index.html + files list: assets, data, img/real). 84/104 maps have a real map.

## Phone version (2026-11-19) — local files done, NOT yet republished
Front end only (assets/app.js, assets/style.css, topnav icon in index.html + _build/artifact-index.html); design tokens/look unchanged, desktop unchanged.
- ≤640px (and landscape phones): top bar scrolls away; only the theme row of `.controls` stays pinned (JS sets `--ctl-stick` = -blocknav.offsetTop); chips/blocknav are one horizontal scroll row; current theme highlighted (scroll spy); 2-column cards (summary hidden).
- Map page: one-row map bar (icon buttons ← ‹ ›), full-bleed map panel, taller frame on phones (≤1.5× the map's own shape — land data reaches 35% beyond the view), 40px tools, `tools.row` when the map is shorter than the column.
- Cooperative gestures (1 finger scrolls page, 2 fingers zoom, 1 finger pans once zoomed); tap = tooltip on touch; touch hint text.
- Full screen: native API on desktop; on touch a fixed overlay `.stage.fs` (iPhone has no element fullscreen) with a history entry so Back closes it; safe-area padded; "rotate the phone" hint for wide maps upright.
- Declutter (maps < 700px wide): labels hidden when overlapping, by priority (area/state names, capitals, dated points/arrow dates, cities/tribes, ctx/sea, rivers); point labels try 8 positions, straight names shift a line; symbols always stay; zoom brings labels back. ~21% of labels hidden at k=1 on a 390px phone.
- Numbers mode on one-column layouts: key moves directly under the map.
- Bug fix (all sizes): degenerate 1–3 point rings in ctx polygons (France/Switzerland on aggression-1930s, molotov-ribbentrop, europe-1945) crashed d3 → those 3 maps never rendered; `path()` now retries with cleaned geometry. Better long-term: drop rings < 4 points in the build (geo-util dp/roundGeom).
Testing: puppeteer-core + installed Chrome with mobile emulation (scratchpad shoot.mjs / allmaps.mjs); raw `Input.dispatchTouchEvent` for drags, `Input.synthesizePinchGesture` for pinch (synthesizeScrollGesture does not reach the page's touch handlers).

## Tests section + device redesign (2026-11-25/26)
Tests of the Unified National Exam in history, 37 variants: 2016–2019 (I, II; 70 points) and 2020–2026 (I–IV/V incl. additional
sessions; 60 points), all 2 h 40 min. Source list = NAEC posts "გამოცდები YYYY - ერთიან ეროვნულ გამოცდებზე გამოყენებული ტესტები"
(ids in `tests/manifest.mjs` POST); found via the NAEC API `https://naec.ge/post/list?searchExpression=...` (JSON, `desc` holds the links).
Pipeline (`_build/tests/`): download.mjs → pdf/ (gitignored) → extract.mjs (pdf.js: positioned items + image boxes with native size) →
parse.mjs (pages → sections from "ინსტრუქცია დავალებ… № a-b", MC / chronology / tasks with sub-questions "(p) N.M", stimulus pages,
two-column documents, de-hyphenation via a corpus word list + fixes.mjs; scheme → MC keys, chronology keys, criteria per sub-question)
→ build.mjs (data/tests/<id>.js, data/tests/index.js, img/tests/*.webp crops at native resolution, thumbs/). check.mjs = sanity sweep,
pretty.mjs <id> = proofreading dump. MAPLINKS in manifest.mjs = atlas map ids per test map task (shown both ways).
Gotchas: pdf.js word gaps can be ~0.2 em (space threshold 0.1 em); column gutters are narrower than 2.5 em, so columns are split on
items with an empty band ≥8 pt and ≥3 aligned lines; 2016 options are "ა." not "ა)"; old covers are drawn (max from the scheme);
2024-4 scheme has "28.7." for 38.7 (fixes.mjs); Git Bash heredocs strip backslashes from regexes — edit such code with the Edit tool.
Front end: assets/tests.js (routes #tests, #test-<id>, #test-<id>-answers[-<task>], #test-<id>-result (plain hash names: claude.ai frames keep only #name); chooser <dialog> = bottom sheet
on phones; attempts in localStorage `hatlas:att:<id>`, history `hatlas:hist:<id>`; official time counts while away from the tab,
other modes only while visible). app.js: router hook, theme toggle (data-theme), phone tab bar (hides on scroll down), exam links on
map pages, about page (offline download via sw.js message). PWA: manifest.webmanifest, sw.js, assets/icons/.
Checks: scratchpad tools/regress.mjs (every map + every test written/finished/self-graded/answers, 0 errors), shoot.mjs specs at
390×844, 320×640 (dark), 844×390, 820×1180, 1366/1440 desktop.
