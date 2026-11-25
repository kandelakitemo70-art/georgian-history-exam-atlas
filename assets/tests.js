/* საგამოცდო ისტორიული ატლასი — ეროვნული გამოცდების ტესტები (2020–2026)
   Routes: #tests · #test-<id> (write) · #test-<id>-answers[-<task>] · #test-<id>-result
   Data: window.TESTS (data/tests/index.js), window.TESTDATA[id] (data/tests/<id>.js, loaded on demand). */
(function () {
  'use strict';
  const TESTS = window.TESTS || [];
  const byId = Object.fromEntries(TESTS.map(t => [t.id, t]));
  const LET = ['ა', 'ბ', 'გ', 'დ'];
  let H = null;          // helpers from app.js (init)
  let tick = null;       // runner timer
  let keyHandler = null;

  // ---------- small helpers
  const esc = s => H.esc(s);
  const P = arr => (arr || []).map(p => `<p>${esc(p)}</p>`).join('');
  const pad = n => String(n).padStart(2, '0');
  const clock = sec => { sec = Math.max(0, Math.round(sec)); const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60), s = sec % 60; return (h ? h + ':' + pad(m) : m) + ':' + pad(s); };
  const dur = min => { const h = Math.floor(min / 60), m = min % 60; return [h ? h + ' სთ' : '', m ? m + ' წთ' : ''].filter(Boolean).join(' ') || '0 წთ'; };
  const durSec = sec => { const m = Math.round(sec / 60); return m < 1 ? '1 წთ-ზე ნაკლები' : dur(m); };
  const vName = t => t.session === 'extra' ? 'დამატებითი სესია' : `${t.v} ვარიანტი`;
  const vFull = t => t.session === 'extra' ? `${t.v} ვარიანტი · დამატებითი სესია` : `${t.v} ვარიანტი`;
  const title = t => `ისტორია ${t.year} — ${vName(t)}`;
  const nUnits = t => t.count.mc + t.count.order + t.count.open;
  const MONTHS = ['იან', 'თებ', 'მარ', 'აპრ', 'მაი', 'ივნ', 'ივლ', 'აგვ', 'სექ', 'ოქტ', 'ნოე', 'დეკ'];
  const date = ts => { const d = new Date(ts); return isNaN(d) ? '' : `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}`; };
  const KIND = { map: 'რუკა', mapmc: 'რუკა', document: 'დოკუმენტი', illustration: 'ილუსტრაცია', sources: 'ორი წყარო', event: 'მოვლენის ანალიზი', significance: 'მნიშვნელობის შეფასება' };
  const ICON = {
    pen: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></svg>',
    eye: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>',
    clock: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    inf: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M7.5 15.5C5 15.5 3 13.9 3 12s2-3.5 4.5-3.5c4 0 5 7 9 7 2.5 0 4.5-1.6 4.5-3.5s-2-3.5-4.5-3.5c-4 0-5 7-9 7z"/></svg>',
    gear: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M5 12h14M12 5v14"/></svg>',
    flag: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4M5 4h11l-2 4 2 4H5"/></svg>',
    grid: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.5"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.5"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.5"/></svg>',
    zoom: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6M8 11h6M11 8v6"/></svg>',
    pause: '<svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>',
    print: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><path d="M7 8V3h10v5M7 17H4v-7h16v7h-3"/><rect x="7" y="14" width="10" height="7"/></svg>',
    close: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
    back: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    next: '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
    check: '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7"/></svg>',
  };

  // ---------- data
  const loading = {};
  function loadTest(id) {
    if (window.TESTDATA && window.TESTDATA[id]) return Promise.resolve(window.TESTDATA[id]);
    if (loading[id]) return loading[id];
    loading[id] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'data/tests/' + encodeURIComponent(id) + '.js';
      s.onload = () => (window.TESTDATA && window.TESTDATA[id]) ? res(window.TESTDATA[id]) : rej(new Error('no data'));
      s.onerror = () => { delete loading[id]; rej(new Error('load failed')); };
      document.head.appendChild(s);
    });
    return loading[id];
  }
  // screens (one per question / per task with its sub-questions) and answerable units
  function model(D) {
    const screens = [], units = [];
    for (const it of D.items) {
      const sc = { it, units: [] };
      const subs = it.t === 'group' ? it.sub : [it];
      for (const q of subs) { const u = { key: q.n, q, it, screen: screens.length, i: units.length }; units.push(u); sc.units.push(u); }
      screens.push(sc);
    }
    return { screens, units };
  }

  // ---------- attempts (localStorage)
  const getAtt = id => H.store.get('att:' + id, null);
  const setAtt = (id, a) => H.store.set('att:' + id, a);
  const getHist = id => H.store.get('hist:' + id, []);
  const answered = (a, q) => { const v = a && a.ans && a.ans[q.n]; return q.t === 'open' ? !!(v && String(v).trim()) : q.t === 'order' ? Array.isArray(v) && v.length === q.items.length : v != null; };

  function grade(D, att) {
    const M = model(D);
    const r = { total: 0, max: D.max, auto: 0, autoMax: 0, open: 0, openMax: 0, graded: 0, openN: 0, ok: 0, bad: 0, empty: 0, units: {} };
    for (const u of M.units) {
      const q = u.q, v = att.ans[q.n];
      let st, pts = 0;
      if (q.t === 'open') {
        r.openMax += q.p; r.openN++;
        const s = att.self && att.self[q.n];
        if (s != null) { pts = s; r.graded++; st = 'self'; } else st = answered(att, q) ? 'ungraded' : 'empty';
        if (!answered(att, q) && s == null) r.empty++;
        r.open += pts;
      } else {
        r.autoMax += q.p;
        if (!answered(att, q)) { st = 'empty'; r.empty++; }
        else if (q.t === 'mc' ? v === q.a : v.join(' ') === q.a.join(' ')) { st = 'ok'; pts = q.p; r.ok++; }
        else { st = 'bad'; r.bad++; }
        r.auto += pts;
      }
      r.units[q.n] = { st, pts };
      r.total += pts;
    }
    return r;
  }

  // ---------- dialog (modal on desktop, bottom sheet on phones); Back closes it
  let dlg = null, dlgPushed = false;
  function dialog(html, cls) {
    if (!dlg) {
      dlg = document.createElement('dialog'); dlg.className = 'dlg';
      document.body.appendChild(dlg);
      dlg.addEventListener('click', e => { if (e.target === dlg) closeDialog(); });
      dlg.addEventListener('cancel', e => { e.preventDefault(); closeDialog(); });
      window.addEventListener('popstate', () => { if (dlg.open && dlgPushed) { dlgPushed = false; closeDialog(true); } });
    }
    dlg.className = 'dlg ' + (cls || '');
    dlg.innerHTML = `<div class="dlg-in">${html}</div>`;
    if (!dlg.open) {
      if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
      try { history.pushState({ hdlg: 1 }, ''); dlgPushed = true; } catch (e) { dlgPushed = false; }
    }
    dlg.querySelectorAll('[data-close]').forEach(b => b.addEventListener('click', () => closeDialog()));
    const f = dlg.querySelector('[data-focus]'); if (f) try { f.focus({ preventScroll: true }); } catch (e) { /* ignore */ }
    dlg.querySelector('.dlg-in').scrollTop = 0;
    return dlg;
  }
  function closeDialog(fromPop) {
    if (!dlg || !dlg.open) return;
    if (dlg.close) dlg.close(); else dlg.removeAttribute('open');
    if (dlgPushed && !fromPop) { dlgPushed = false; try { history.back(); } catch (e) { /* ignore */ } }
  }
  // leave the dialog for another route without a stray history entry
  function go(hash) {
    if (dlg && dlg.open) { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); }
    if (dlgPushed) { dlgPushed = false; history.replaceState(null, '', hash); H.route(); }
    else if (location.hash === hash) H.route(); else location.hash = hash;
  }

  // ---------- start chooser: write (official / no limit / own time) or view answers
  function chooser(id) {
    const t = byId[id]; if (!t) return;
    const att = getAtt(id), hist = getHist(id);
    const live = att && !att.done;
    const last = hist[hist.length - 1], best = hist.reduce((a, h) => Math.max(a, h.total), -1);
    const pref = H.store.get('timepref', { mode: 'official', min: 60 });
    const html = `
      <header class="dlg-h">
        <div><span class="eyebrow">ეროვნული გამოცდა · ${t.year}</span><h2>${esc(title(t))}</h2>
        <p class="dlg-meta">${t.max} ქულა · ${t.count.mc + t.count.order} ტესტური და ${t.count.open} ღია კითხვა · საგამოცდო დრო ${dur(t.time)}</p></div>
        <button class="iconbtn" data-close aria-label="დახურვა">${ICON.close}</button>
      </header>
      ${live ? `<div class="resume"><div><b>დაწყებული ტესტი</b><span>${Object.keys(att.ans || {}).length} პასუხი · ${att.limit ? 'დარჩა ' + clock(att.limit - att.elapsed) : 'გასული ' + clock(att.elapsed)}</span></div>
        <button class="btn primary" data-act="resume">გაგრძელება</button></div>` : ''}
      <section class="choice primary-choice">
        <div class="ch-head"><span class="ch-ico">${ICON.pen}</span><div><h3>${live ? 'თავიდან დაწერა' : 'ტესტის დაწერა'}</h3><p>უპასუხე კითხვებს, ბოლოს ნახავ შედეგს და შეცდომებს.</p></div></div>
        <div class="seg" role="radiogroup" aria-label="დრო">
          <button role="radio" data-tm="official" aria-checked="${pref.mode === 'official'}">${ICON.clock}<span><b>საგამოცდო დრო</b><small>${dur(t.time)}, როგორც გამოცდაზე</small></span></button>
          <button role="radio" data-tm="none" aria-checked="${pref.mode === 'none'}">${ICON.inf}<span><b>დროის გარეშე</b><small>წამზომი მხოლოდ აითვლის</small></span></button>
          <button role="radio" data-tm="custom" aria-checked="${pref.mode === 'custom'}">${ICON.gear}<span><b>ჩემი დრო</b><small>თავად აირჩიე წუთები</small></span></button>
        </div>
        <div class="custom" ${pref.mode === 'custom' ? '' : 'hidden'}>
          <label for="cmin">დრო წუთებში</label>
          <div class="stepper"><button data-step="-10" aria-label="10 წუთით ნაკლები">−</button><input id="cmin" type="number" inputmode="numeric" min="5" max="300" step="5" value="${pref.min}"><button data-step="10" aria-label="10 წუთით მეტი">+</button></div>
          <div class="presets">${[30, 60, 90, 120].map(m => `<button data-min="${m}">${dur(m)}</button>`).join('')}</div>
        </div>
        <button class="btn primary big" data-act="start" data-focus>დაწყება</button>
      </section>
      <section class="choice">
        <button class="ch-row" data-act="answers"><span class="ch-ico">${ICON.eye}</span><span><b>პასუხების ნახვა</b><small>ყველა კითხვა სწორი პასუხებით და ოფიციალური შეფასების სქემით</small></span>${ICON.next}</button>
      </section>
      ${hist.length ? `<p class="dlg-hist">ბოლო შედეგი: <b>${last.total} / ${last.max}</b> (${date(last.at)})${hist.length > 1 ? ` · საუკეთესო: <b>${best}</b>` : ''} · <a href="#test-${id}-result" data-act="result">ბოლო შედეგის ნახვა</a></p>` : ''}
      <p class="dlg-src">ოფიციალური წყარო: <a href="${esc(t.src ? t.src.test : '#')}" target="_blank" rel="noopener" data-src="test">ტესტი (PDF)</a> · <a href="#" target="_blank" rel="noopener" data-src="scheme">შეფასების სქემა</a> — <a href="https://naec.ge/" target="_blank" rel="noopener">naec.ge</a></p>`;
    const d = dialog(html, 'chooser');
    // official PDF links come with the test data; fill them in when it is loaded
    loadTest(id).then(D => { d.querySelectorAll('[data-src]').forEach(a => { a.href = D.src[a.dataset.src]; }); }).catch(() => { });
    let mode = pref.mode;
    const custom = d.querySelector('.custom'), cmin = d.querySelector('#cmin');
    d.querySelectorAll('[data-tm]').forEach(b => b.addEventListener('click', () => {
      mode = b.dataset.tm;
      d.querySelectorAll('[data-tm]').forEach(x => x.setAttribute('aria-checked', x === b));
      custom.hidden = mode !== 'custom';
      if (mode === 'custom') cmin.focus();
    }));
    d.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { cmin.value = Math.max(5, Math.min(300, (+cmin.value || 0) + +b.dataset.step)); }));
    d.querySelectorAll('[data-min]').forEach(b => b.addEventListener('click', () => { cmin.value = b.dataset.min; }));
    d.addEventListener('click', e => {
      const a = e.target.closest('[data-act]'); if (!a) return;
      const act = a.dataset.act;
      if (act === 'start') {
        const min = Math.max(5, Math.min(300, Math.round(+cmin.value || 60)));
        H.store.set('timepref', { mode, min });
        const limit = mode === 'official' ? t.time * 60 : mode === 'custom' ? min * 60 : null;
        setAtt(id, { mode, limit, started: Date.now(), elapsed: 0, ans: {}, flags: {}, cur: 0, done: false });
        go('#test-' + id);
      } else if (act === 'resume') go('#test-' + id);
      else if (act === 'answers') go('#test-' + id + '-answers');
      else if (act === 'result') { e.preventDefault(); go('#test-' + id + '-result'); }
    }, { once: false });
  }

  // ---------- catalog
  function renderCatalog() {
    document.title = 'ეროვნული გამოცდების ტესტები ისტორიაში · საგამოცდო ისტორიული ატლასი';
    const years = [...new Set(TESTS.map(t => t.year))].sort((a, b) => b - a);
    const st = H.store.get('tfilter', { year: 'all' });
    const nQ = TESTS.reduce((a, t) => a + nUnits(t), 0);
    H.app.innerHTML = `
      <section class="wrap hero thero">
        <span class="eyebrow">ეროვნული გამოცდები · ისტორია</span>
        <h1>ეროვნული გამოცდების ტესტები</h1>
        <p>${years[years.length - 1]}–${years[0]} წლების ისტორიის ყველა ვარიანტი, დამატებითი სესიების ჩათვლით — ოფიციალური პასუხებითა და შეფასების სქემებით. დაწერე საგამოცდო დროით, შენი დროით ან დროის გარეშე; ბოლოს ნახავ შედეგს.</p>
        <div class="stats"><span><b>${TESTS.length}</b>ტესტი</span><span><b>${years.length}</b>წელი</span><span><b>${nQ.toLocaleString('en-US')}</b>კითხვა</span><span><b>${[...new Set(TESTS.map(t => t.max))].sort().join("–")}</b>ქულა თითო ტესტში</span></div>
      </section>
      <div class="wrap how3">
        <div><span class="hn">1</span><b>აირჩიე ვარიანტი</b><small>წელი და ვარიანტი; გამოჩნდება ფანჯარა არჩევანით.</small></div>
        <div><span class="hn">2</span><b>დაწერე ან ნახე პასუხები</b><small>საგამოცდო დრო (${dur(TESTS[0] ? TESTS[0].time : 160)}), შენი დრო ან დროის გარეშე.</small></div>
        <div><span class="hn">3</span><b>შედეგი</b><small>ტესტური ნაწილი ფასდება ავტომატურად, ღია კითხვებს აფასებ თავად სქემით.</small></div>
      </div>
      ${progressHTML()}
      <div class="controls tcontrols"><div class="wrap"><div class="chips yearchips" role="group" aria-label="წელი">
        <button class="chip" data-year="all">ყველა წელი <span class="n">${TESTS.length}</span></button>
        ${years.map(y => `<button class="chip" data-year="${y}">${y} <span class="n">${TESTS.filter(t => t.year === y).length}</span></button>`).join('')}
      </div></div></div>
      <div class="wrap" id="tlist"></div>`;
    const list = H.app.querySelector('#tlist');
    const draw = () => {
      H.app.querySelectorAll('[data-year]').forEach(b => b.classList.toggle('on', String(st.year) === b.dataset.year));
      list.innerHTML = years.filter(y => st.year === 'all' || +st.year === y).map(y => `
        <section class="tyear" id="year-${y}">
          <div class="blockhead"><span class="blocknum">${y}</span><h2>წლის ეროვნული გამოცდა</h2></div>
          <div class="blockmeta">${TESTS.filter(t => t.year === y).length} ვარიანტი · ${dur(TESTS.find(t => t.year === y).time)} · ${TESTS.find(t => t.year === y).max} ქულა</div>
          <div class="tgrid">${TESTS.filter(t => t.year === y).map(card).join('')}</div>
        </section>`).join('');
    };
    draw();
    H.app.querySelectorAll('[data-year]').forEach(b => b.addEventListener('click', () => { st.year = b.dataset.year; H.store.set('tfilter', st); draw(); }));
    list.addEventListener('click', e => { const c = e.target.closest('[data-test]'); if (c) { e.preventDefault(); chooser(c.dataset.test); } });
  }
  function progressHTML() {
    const done = TESTS.map(t => ({ t, h: getHist(t.id) })).filter(x => x.h.length);
    const live = TESTS.filter(t => { const a = getAtt(t.id); return a && !a.done; });
    if (!done.length && !live.length) return '';
    const best = done.map(x => Math.max(...x.h.map(h => h.total / h.max)));
    const avg = best.length ? Math.round(100 * best.reduce((a, b) => a + b, 0) / best.length) : 0;
    return `<div class="wrap"><div class="tprogress">
      <span><b>${done.length}</b> / ${TESTS.length} ტესტი დაწერილი</span>
      ${best.length ? `<span>საუკეთესო შედეგების საშუალო: <b>${avg}%</b></span><span class="pbar" aria-hidden="true"><i style="width:${avg}%"></i></span>` : ''}
      ${live.length ? `<a href="#test-${live[0].id}" class="btn">${live[0].year} · ${esc(vName(live[0]))} — გაგრძელება</a>` : ''}
    </div></div>`;
  }
  function card(t) {
    const att = getAtt(t.id), hist = getHist(t.id);
    const live = att && !att.done;
    const last = hist[hist.length - 1];
    let status = '';
    if (live) status = `<span class="tst live">დაწყებულია · ${Object.keys(att.ans || {}).length}/${nUnits(t)}</span>`;
    else if (last) { const pc = last.total / last.max; status = `<span class="tst ${pc >= .75 ? 'good' : pc >= .5 ? 'mid' : 'low'}">ბოლო შედეგი: ${last.total}/${last.max}</span>`; }
    const kinds = [...new Set(t.kinds.map(k => KIND[k]))];
    return `<a class="tcard" href="#test-${t.id}" data-test="${t.id}">
      <div class="tthumb">${t.thumb ? `<img src="img/tests/${t.thumb}" alt="" loading="lazy" decoding="async">` : ''}${t.session === 'extra' ? '<span class="tbadge extra">დამატებითი სესია</span>' : ''}</div>
      <div class="tbody">
        <span class="date">${t.year} · ${t.session === 'extra' ? 'დამატებითი სესია' : 'ძირითადი სესია'}</span>
        <h3>${t.v} ვარიანტი</h3>
        <p class="tmeta">${t.count.mc + t.count.order} ტესტური · ${t.count.open} ღია · ${dur(t.time)}</p>
        <p class="tkinds">${kinds.map(k => `<span>${k}</span>`).join('')}</p>
        ${status}
      </div></a>`;
  }

  // ---------- question rendering (shared by write / answers / result modes)
  // ctx: { mode: 'write'|'answers'|'result', att, reveal (answers mode: show the key), g (grades) }
  function fig(D, im, label, cap) {
    const w = im.w || 1200, h = im.h || 800;
    return `<figure class="tfig"><button class="zoomable" data-zoom="img/tests/${esc(im.f)}" aria-label="${esc(label)} — გადიდება">
      <img src="img/tests/${esc(im.f)}" alt="${esc(label)}" width="${w}" height="${h}" loading="lazy" decoding="async"><span class="zbadge">${ICON.zoom}გადიდება</span></button>${cap ? `<figcaption>${esc(cap)}</figcaption>` : ''}</figure>`;
  }
  function qHead(q, ctx, extra) {
    const n = q.virt ? q.n.replace(/\.(\d)$/, ' · $1') : q.n;
    const flag = ctx.mode === 'write' ? `<button class="qflag" data-flag="${esc(q.n)}" aria-pressed="${!!(ctx.att.flags && ctx.att.flags[q.n])}" title="მონიშვნა მოგვიანებით გადასახედად">${ICON.flag}<span>მონიშვნა</span></button>` : '';
    return `<div class="qhead"><span class="qn">${esc(n)}</span><span class="qp">${q.p} ქულა</span>${extra || ''}${flag}</div>`;
  }
  function stateBadge(st, pts, p) {
    if (st === 'ok') return `<span class="qres ok">${ICON.check}სწორია · +${p}</span>`;
    if (st === 'bad') return `<span class="qres bad">შეცდომა · 0</span>`;
    if (st === 'empty') return `<span class="qres empty">უპასუხო</span>`;
    if (st === 'self') return `<span class="qres self">შენი შეფასება · ${pts}/${p}</span>`;
    if (st === 'ungraded') return `<span class="qres ungraded">შეაფასე</span>`;
    return '';
  }
  function mcBlock(q, ctx) {
    const v = ctx.att ? ctx.att.ans[q.n] : null;
    const show = ctx.mode === 'result' || (ctx.mode === 'answers' && ctx.reveal);
    return `<div class="opts" role="radiogroup" aria-label="პასუხები">${q.o.map((o, i) => {
      const cls = ['opt'];
      if (ctx.mode !== 'answers' && v === i) cls.push('sel');
      if (show && i === q.a) cls.push('right');
      if (ctx.mode === 'result' && v === i && i !== q.a) cls.push('wrong');
      const dis = ctx.mode === 'write' ? '' : ' disabled';
      return `<button class="${cls.join(' ')}" role="radio" aria-checked="${v === i}" data-q="${esc(q.n)}" data-o="${i}"${dis}><span class="ol">${LET[i]}</span><span class="ot">${esc(o)}</span></button>`;
    }).join('')}</div>${ctx.mode === 'answers' && !ctx.reveal ? `<button class="reveal" data-reveal="${esc(q.n)}">პასუხის ნახვა</button>` : ''}`;
  }
  function orderBlock(q, ctx) {
    const v = (ctx.att && ctx.att.ans[q.n]) || [];
    const show = ctx.mode === 'result' || (ctx.mode === 'answers' && ctx.reveal);
    const seq = ctx.mode === 'answers' ? (show ? q.a : []) : v;
    const boxes = q.items.map((_, k) => `<span class="obox${show && ctx.mode === 'result' ? (v[k] === q.a[k] ? ' right' : ' wrong') : ''}">${seq[k] || ''}</span>`).join('');
    return `<ol class="oitems">${q.items.map((it, k) => {
      const r = seq.indexOf(k + 1);
      return `<li><button class="oitem${r >= 0 ? ' ranked' : ''}" data-q="${esc(q.n)}" data-it="${k + 1}"${ctx.mode === 'write' ? '' : ' disabled'}><span class="onum">${k + 1}</span><span class="ot">${esc(it)}</span><span class="orank">${r >= 0 ? (r + 1) + '.' : ''}</span></button></li>`;
    }).join('')}</ol>
    <div class="oseq"><span class="osl">${ctx.mode === 'write' ? 'შენი თანმიმდევრობა (ადრეულიდან გვიანდელამდე):' : ctx.mode === 'result' ? 'შენი პასუხი:' : 'სწორი თანმიმდევრობა:'}</span>${boxes}
      ${ctx.mode === 'write' ? `<button class="linkbtn" data-oreset="${esc(q.n)}">გასუფთავება</button>` : ''}</div>
    ${ctx.mode === 'result' ? `<p class="okey">სწორი თანმიმდევრობა: <b>${q.a.join(' → ')}</b></p>` : ''}
    ${ctx.mode === 'answers' && !ctx.reveal ? `<button class="reveal" data-reveal="${esc(q.n)}">პასუხის ნახვა</button>` : ''}
    ${ctx.mode === 'write' ? '<p class="ohint">დააჭირე მოვლენებს იმ თანმიმდევრობით, რომლითაც მოხდა — ჯერ ყველაზე ადრეულს.</p>' : ''}`;
  }
  function openBlock(q, ctx) {
    const v = (ctx.att && ctx.att.ans[q.n]) || '';
    const crit = q.crit && q.crit.length ? `<div class="crit"><b>შეფასების სქემა (NAEC):</b>${P(q.crit)}</div>` : '';
    if (ctx.mode === 'write') return `<textarea class="oa" data-q="${esc(q.n)}" rows="${q.p > 1 ? 4 : 3}" placeholder="ჩაწერე პასუხი…" aria-label="პასუხი ${esc(q.n)}">${esc(v)}</textarea>`;
    if (ctx.mode === 'answers') return ctx.reveal ? crit : `<button class="reveal" data-reveal="${esc(q.n)}">შეფასების სქემის ნახვა</button>`;
    const self = ctx.att.self && ctx.att.self[q.n];
    return `<div class="myans${v.trim() ? '' : ' none'}"><b>შენი პასუხი:</b>${v.trim() ? `<p>${esc(v)}</p>` : '<p>პასუხი არ დაწერილა.</p>'}</div>${crit}
      <div class="selfgrade" role="group" aria-label="შეაფასე პასუხი"><span>შენი შეფასება სქემის მიხედვით:</span>${Array.from({ length: q.p + 1 }, (_, k) => `<button data-self="${esc(q.n)}" data-pts="${k}" aria-pressed="${self === k}">${k}</button>`).join('')}<small>ქულა</small></div>`;
  }
  function unitHTML(q, ctx, inGroup) {
    const res = ctx.mode === 'result' && ctx.g ? ctx.g.units[q.n] : null;
    const body = q.t === 'mc' ? mcBlock(q, ctx) : q.t === 'order' ? orderBlock(q, ctx) : openBlock(q, ctx);
    const cls = ['q', 'q-' + q.t]; if (res) cls.push('st-' + res.st);
    if (ctx.mode === 'answers' && ctx.reveal) cls.push('revealed');
    return `<article class="${cls.join(' ')}" id="q-${esc(q.n)}" data-unit="${esc(q.n)}">
      ${qHead(q, ctx, res ? stateBadge(res.st, res.pts, q.p) : '')}
      ${q.q && q.q.length ? `<div class="qtext">${P(q.q)}</div>` : ''}
      ${(q.img || []).map(im => fig(null, im, `კითხვა ${q.n}`)).join('')}
      ${body}</article>`;
  }
  function groupHTML(D, it, ctx) {
    const pts = it.sub.reduce((a, q) => a + q.p, 0);
    const imgs = it.stim.img || [];
    const label = KIND[it.kind] || 'წყარო';
    const hasStim = imgs.length || (it.stim.text || []).length;
    const stim = hasStim ? `<div class="stim${it.kind === 'document' || it.kind === 'sources' ? ' doc' : ''}">
        ${imgs.map((im, k) => fig(D, im, `${label} ${it.n}${imgs.length > 1 ? ' №' + (k + 1) : ''}`, imgs.length > 1 ? '№' + (k + 1) : '')).join('')}
        ${(it.stim.text || []).length ? `<div class="stext">${P(it.stim.text)}</div>` : ''}
      </div>` : '';
    return `<section class="grp kind-${it.kind}" id="q-${esc(it.n)}">
      <header class="ghead"><span class="gn">დავალება ${esc(it.n)}</span><h2>${esc(it.title)}</h2><span class="qp">${pts} ქულა</span></header>
      ${it.instr && it.instr.length ? `<details class="instr"${ctx.mode === 'write' ? '' : ''}><summary>ინსტრუქცია</summary>${P(it.instr)}</details>` : ''}
      <div class="gbody${hasStim ? ' has-stim' : ''}">
        ${stim ? `<div class="gstim">${stim}</div>` : ''}
        <div class="gsubs">
          ${it.prompt && it.prompt.length ? `<div class="prompt">${P(it.prompt)}</div>` : ''}
          ${it.sub.map(q => unitHTML(q, ctx, true)).join('')}
          ${it.critAll && it.critAll.length && ctx.mode !== 'write' && (ctx.mode === 'result' || ctx.reveal) ? `<div class="crit all"><b>შენიშვნა სქემიდან:</b>${P(it.critAll)}</div>` : ''}
        </div>
      </div></section>`;
  }
  function screenHTML(D, sc, ctx) { return sc.it.t === 'group' ? groupHTML(D, sc.it, ctx) : unitHTML(sc.it, ctx); }
  // section intro (instructions) shown above the first question of a section
  function sectionFor(D, n) { return (D.sections || []).find(s => +n >= s.from && +n <= s.to); }
  const SEC_TITLE = { mc: 'ტესტური დავალებები', order: 'ქრონოლოგიური თანმიმდევრობა' };

  // ---------- image zoom (pinch / wheel / drag), Back closes
  let lb = null, lbPushed = false;
  function lightbox(src, alt) {
    if (!lb) {
      lb = document.createElement('div'); lb.className = 'lightbox'; lb.hidden = true;
      lb.innerHTML = `<div class="lb-stage"><img alt=""></div><div class="lb-tools"><button data-lb="in" aria-label="გადიდება">+</button><button data-lb="out" aria-label="დაპატარავება">−</button><button data-lb="close" aria-label="დახურვა">${ICON.close}</button></div><p class="lb-hint">ორი თითით ან ბორბლით გაადიდე</p>`;
      document.body.appendChild(lb);
      const stage = lb.querySelector('.lb-stage'), img = lb.querySelector('img');
      const z = d3.zoom().scaleExtent([1, 8]).on('zoom', ev => { img.style.transform = `translate(${ev.transform.x}px,${ev.transform.y}px) scale(${ev.transform.k})`; });
      lb._z = z; d3.select(stage).call(z).on('dblclick.zoom', null);
      lb.addEventListener('click', e => {
        const b = e.target.closest('[data-lb]');
        if (b) { const a = b.dataset.lb; if (a === 'close') closeLb(); else d3.select(stage).transition().duration(200).call(z.scaleBy, a === 'in' ? 1.6 : 1 / 1.6); }
      });
      document.addEventListener('keydown', e => { if (!lb.hidden && e.key === 'Escape') closeLb(); });
      window.addEventListener('popstate', () => { if (!lb.hidden && lbPushed) { lbPushed = false; closeLb(true); } });
    }
    const img = lb.querySelector('img');
    img.src = src; img.alt = alt || '';
    lb.hidden = false; document.documentElement.classList.add('fs-lock');
    d3.select(lb.querySelector('.lb-stage')).call(lb._z.transform, d3.zoomIdentity);
    try { history.pushState({ hlb: 1 }, ''); lbPushed = true; } catch (e) { lbPushed = false; }
  }
  function closeLb(fromPop) {
    if (!lb || lb.hidden) return;
    lb.hidden = true; document.documentElement.classList.remove('fs-lock');
    if (lbPushed && !fromPop) { lbPushed = false; try { history.back(); } catch (e) { /* ignore */ } }
  }

  // ---------- write mode (runner)
  function renderRunner(id, D) {
    const t = byId[id];
    let att = getAtt(id);
    if (!att || att.done) { renderStart(id); return; }
    const M = model(D);
    att.cur = Math.min(att.cur || 0, M.screens.length - 1);
    document.title = `${title(t)} · ტესტი`;
    document.documentElement.classList.add('in-runner');
    const ctx = { mode: 'write', att };
    H.app.innerHTML = `
      <div class="runner">
        <div class="rbar"><div class="wrap">
          <a class="iconbtn" href="#tests" aria-label="ტესტების სია" title="ტესტების სია">${ICON.back}</a>
          <div class="rtitle"><b>ისტორია ${t.year}</b><small>${esc(vName(t))}</small></div>
          <span class="spacer"></span>
          <div class="rtimer" role="timer" aria-live="off" title="${att.limit ? 'დარჩენილი დრო' : 'გასული დრო'}">${att.limit ? ICON.clock : ICON.inf}<span id="tclock">${clock(att.limit ? att.limit - att.elapsed : att.elapsed)}</span></div>
          ${att.mode !== 'official' ? `<button class="iconbtn" id="tpause" aria-label="პაუზა" title="პაუზა">${ICON.pause}</button>` : ''}
          <button class="btn sheetbtn" id="tsheet" aria-label="პასუხების ფურცელი">${ICON.grid}<span id="tcount"></span></button>
          <button class="btn primary" id="tfinish" aria-label="დასრულება">${ICON.check}<span>დასრულება</span></button>
        </div><div class="rprog" aria-hidden="true"><i id="tprog"></i></div></div>
        <div class="wrap rgrid">
          <main class="rmain" id="rmain" tabindex="-1"></main>
          <aside class="rside" aria-label="პასუხების ფურცელი"><div class="sheet" id="sheet"></div></aside>
        </div>
        <nav class="rnav" aria-label="ნავიგაცია"><div class="wrap">
          <button class="btn" id="tprev">${ICON.back}<span>წინა</span></button>
          <span class="rpos"><span id="tpos"></span><small class="khint">1–4 პასუხი · ← → გადასვლა · F მონიშვნა</small></span>
          <button class="btn primary" id="tnext"><span>შემდეგი</span>${ICON.next}</button>
        </div></nav>
        <div class="pausecover" id="pausecover" hidden><div><h2>პაუზა</h2><p>დრო გაჩერებულია.</p><button class="btn primary big" id="tresume">გაგრძელება</button></div></div>
      </div>`;
    const main = H.app.querySelector('#rmain'), sheet = H.app.querySelector('#sheet');
    const save = () => setAtt(id, att);
    const nAns = () => M.units.filter(u => answered(att, u.q)).length;
    function sheetHTML() {
      let out = '', lastSec = null;
      for (const u of M.units) {
        const s = sectionFor(D, u.it.n) || {};
        const key = s.from + '-' + s.to;
        if (key !== lastSec) {
          if (lastSec) out += '</div>';
          const name = s.kind === 'mc' ? `ტესტური ${s.from}–${s.to}` : s.kind === 'order' ? `ქრონოლოგია ${s.from}–${s.to}` : `${s.from === s.to ? s.from : s.from + '–' + s.to} · ${KIND[s.kind] || ''}`;
          out += `<h4>${esc(name)}</h4><div class="cells">`; lastSec = key;
        }
        const cls = ['cell']; if (answered(att, u.q)) cls.push('done'); if (att.flags[u.key]) cls.push('flag'); if (u.screen === att.cur) cls.push('cur');
        const label = u.q.virt ? u.key.replace(/\.(\d)$/, '·$1') : u.key;
        out += `<button class="${cls.join(' ')}" data-goto="${u.i}" title="${esc(u.key)}">${esc(label)}</button>`;
      }
      return out + '</div><div class="slegend"><span><i class="cell done"></i>პასუხი</span><span><i class="cell flag"></i>მონიშნული</span><span><i class="cell"></i>უპასუხო</span></div>';
    }
    function updateBar() {
      const n = nAns();
      H.app.querySelector('#tcount').textContent = `${n}/${M.units.length}`;
      H.app.querySelector('#tprog').style.width = (100 * n / M.units.length) + '%';
      H.app.querySelector('#tpos').textContent = `${att.cur + 1} / ${M.screens.length}`;
      H.app.querySelector('#tprev').disabled = att.cur === 0;
      const last = att.cur === M.screens.length - 1;
      const nb = H.app.querySelector('#tnext'); nb.innerHTML = last ? '<span>დასრულება</span>' : `<span>შემდეგი</span>${ICON.next}`; nb.dataset.last = last ? '1' : '';
      sheet.innerHTML = sheetHTML();
    }
    function show(i, focusUnit) {
      att.cur = Math.max(0, Math.min(M.screens.length - 1, i)); save();
      const sc = M.screens[att.cur];
      const s = sectionFor(D, sc.it.n);
      const first = s && +sc.it.n === s.from && (s.kind === 'mc' || s.kind === 'order');
      main.innerHTML = (first ? `<div class="secintro"><b>${esc(SEC_TITLE[s.kind] || '')} ${s.from}–${s.to}</b>${s.kind === 'mc' ? '<p>თითოეულ კითხვაზე ოთხი სავარაუდო პასუხია, მათგან მხოლოდ ერთია სწორი. თითო კითხვა — 1 ქულა.</p>' : `<p>დაალაგე მოვლენები ქრონოლოგიურად — ჯერ ყველაზე ადრეული. თითო დავალება — 1 ქულა (მხოლოდ სრულად სწორი თანმიმდევრობა).</p><details><summary>ოფიციალური ინსტრუქცია</summary>${P(s.instr)}</details>`}</div>` : '') + screenHTML(D, sc, ctx);
      autosize();
      updateBar();
      if (focusUnit) { const el = main.querySelector(`[data-unit="${CSS.escape(focusUnit)}"]`); if (el) { el.scrollIntoView({ block: 'center' }); el.classList.add('pulse'); setTimeout(() => el.classList.remove('pulse'), 900); } }
      else window.scrollTo(0, 0);
    }
    function autosize() { main.querySelectorAll('textarea.oa').forEach(ta => { ta.style.height = 'auto'; ta.style.height = Math.min(600, ta.scrollHeight + 2) + 'px'; }); }
    // answers
    main.addEventListener('click', e => {
      const o = e.target.closest('.opt[data-o]');
      if (o) {
        const q = o.dataset.q, i = +o.dataset.o;
        att.ans[q] = att.ans[q] === i ? undefined : i; if (att.ans[q] === undefined) delete att.ans[q];
        save();
        o.parentNode.querySelectorAll('.opt').forEach(b => { const on = +b.dataset.o === att.ans[q]; b.classList.toggle('sel', on); b.setAttribute('aria-checked', on); });
        updateBar(); return;
      }
      const it = e.target.closest('.oitem[data-it]');
      if (it) {
        const q = it.dataset.q, k = +it.dataset.it;
        const v = (att.ans[q] || []).slice(); const at = v.indexOf(k);
        if (at >= 0) v.splice(at, 1); else v.push(k);
        if (v.length) att.ans[q] = v; else delete att.ans[q];
        save(); rerenderUnit(q); updateBar(); return;
      }
      const r = e.target.closest('[data-oreset]'); if (r) { delete att.ans[r.dataset.oreset]; save(); rerenderUnit(r.dataset.oreset); updateBar(); return; }
      const f = e.target.closest('[data-flag]');
      if (f) { const q = f.dataset.flag; if (att.flags[q]) delete att.flags[q]; else att.flags[q] = 1; save(); f.setAttribute('aria-pressed', !!att.flags[q]); updateBar(); return; }
      const z = e.target.closest('[data-zoom]'); if (z) { lightbox(z.dataset.zoom, z.getAttribute('aria-label')); }
    });
    let saveTo = null;
    main.addEventListener('input', e => {
      const ta = e.target.closest('textarea.oa'); if (!ta) return;
      const v = ta.value; if (v.trim()) att.ans[ta.dataset.q] = v; else delete att.ans[ta.dataset.q];
      ta.style.height = 'auto'; ta.style.height = Math.min(600, ta.scrollHeight + 2) + 'px';
      clearTimeout(saveTo); saveTo = setTimeout(() => { save(); updateBar(); }, 400);
    });
    function rerenderUnit(qn) {
      const u = M.units.find(x => x.key === qn); const el = main.querySelector(`[data-unit="${CSS.escape(qn)}"]`);
      if (u && el) el.outerHTML = unitHTML(u.q, ctx, !!u.it.sub);
    }
    sheet.addEventListener('click', e => { const c = e.target.closest('[data-goto]'); if (c) { const u = M.units[+c.dataset.goto]; show(u.screen, u.it.t === 'group' ? u.key : null); } });
    H.app.querySelector('#tprev').addEventListener('click', () => show(att.cur - 1));
    H.app.querySelector('#tnext').addEventListener('click', e => { if (e.currentTarget.dataset.last) finish(); else show(att.cur + 1); });
    H.app.querySelector('#tfinish').addEventListener('click', () => finish());
    H.app.querySelector('#tsheet').addEventListener('click', () => {
      const d = dialog(`<header class="dlg-h"><div><h2>პასუხების ფურცელი</h2><p class="dlg-meta">${nAns()} / ${M.units.length} პასუხი</p></div><button class="iconbtn" data-close aria-label="დახურვა">${ICON.close}</button></header><div class="sheet">${sheetHTML()}</div>`, 'sheetdlg');
      d.querySelector('.sheet').addEventListener('click', e => { const c = e.target.closest('[data-goto]'); if (c) { closeDialog(); const u = M.units[+c.dataset.goto]; setTimeout(() => show(u.screen, u.it.t === 'group' ? u.key : null), 30); } });
    });
    // timer: counts while the page is visible; pause in your-own-time / no-limit modes
    let paused = false, lastT = Date.now();
    const clockEl = H.app.querySelector('#tclock'), timerEl = H.app.querySelector('.rtimer');
    const step = () => {
      const now = Date.now();
      if (!paused && (att.mode === 'official' || document.visibilityState === 'visible')) att.elapsed += (now - lastT) / 1000;
      lastT = now;
      const left = att.limit ? att.limit - att.elapsed : null;
      clockEl.textContent = clock(att.limit ? left : att.elapsed);
      if (att.limit) { timerEl.classList.toggle('warn', left <= 600 && left > 300); timerEl.classList.toggle('crit', left <= 300); }
      if (att.limit && left <= 0) { save(); timeUp(); }
    };
    tick = setInterval(() => { step(); if (Math.round(att.elapsed) % 5 === 0) save(); }, 1000);
    const vis = () => { step(); save(); };
    document.addEventListener('visibilitychange', vis);
    window.addEventListener('pagehide', vis);
    const pauseBtn = H.app.querySelector('#tpause'), cover = H.app.querySelector('#pausecover');
    if (pauseBtn) {
      pauseBtn.addEventListener('click', () => { step(); paused = true; cover.hidden = false; save(); H.app.querySelector('#tresume').focus(); });
      H.app.querySelector('#tresume').addEventListener('click', () => { lastT = Date.now(); paused = false; cover.hidden = true; });
    }
    let warned = false;
    function timeUp() {
      if (warned) return; warned = true;
      clearInterval(tick); tick = null;
      complete();
      const d = dialog(`<header class="dlg-h"><div><h2>დრო ამოიწურა</h2><p class="dlg-meta">ტესტი დასრულდა — როგორც ნამდვილ გამოცდაზე.</p></div></header><button class="btn primary big" data-ok data-focus>შედეგის ნახვა</button>`, 'small');
      d.querySelector('[data-ok]').addEventListener('click', () => go('#test-' + id + '-result'));
    }
    function complete() {
      step();
      att.done = true; att.finished = Date.now(); att.self = att.self || {};
      save();
      const g = grade(D, att);
      const hist = getHist(id); hist.push({ at: att.finished, total: g.total, max: g.max, auto: g.auto, autoMax: g.autoMax, mode: att.mode, elapsed: Math.round(att.elapsed) });
      H.store.set('hist:' + id, hist.slice(-12));
    }
    function finish() {
      const n = nAns(), left = M.units.length - n, fl = Object.keys(att.flags).length;
      const d = dialog(`<header class="dlg-h"><div><h2>დავასრულოთ ტესტი?</h2><p class="dlg-meta">${n} / ${M.units.length} კითხვაზე გაქვს პასუხი${left ? ` · <b>${left} უპასუხო</b>` : ''}${fl ? ` · ${fl} მონიშნული` : ''}</p></div><button class="iconbtn" data-close aria-label="დახურვა">${ICON.close}</button></header>
        <p class="dlg-note">დასრულების შემდეგ ნახავ შედეგს: ტესტური ნაწილი შეფასდება ავტომატურად, ღია კითხვებს კი შენ შეაფასებ ოფიციალური სქემით.</p>
        <div class="dlg-actions"><button class="btn" data-close>გაგრძელება</button><button class="btn primary" data-act="done" data-focus>დასრულება</button></div>`, 'small');
      d.querySelector('[data-act="done"]').addEventListener('click', () => { clearInterval(tick); tick = null; complete(); go('#test-' + id + '-result'); });
    }
    // keyboard: 1–4 / ა–დ choose, ←/→ move, F flag
    keyHandler = e => {
      if (e.target.closest('textarea, input, select') || e.metaKey || e.ctrlKey || e.altKey || (dlg && dlg.open) || (lb && !lb.hidden)) return;
      const sc = M.screens[att.cur];
      const k = e.key;
      if (k === 'ArrowRight') { if (att.cur < M.screens.length - 1) show(att.cur + 1); e.preventDefault(); }
      else if (k === 'ArrowLeft') { show(att.cur - 1); e.preventDefault(); }
      else if (sc.it.t === 'mc' && /^[1-4]$|^[ა-დ]$/.test(k)) { const i = /\d/.test(k) ? +k - 1 : LET.indexOf(k); const b = main.querySelector(`.opt[data-o="${i}"]`); if (b) b.click(); }
      else if ((k === 'f' || k === 'F' || k === 'ფ') && sc.units.length === 1) { const b = main.querySelector('[data-flag]'); if (b) b.click(); }
    };
    document.addEventListener('keydown', keyHandler);
    H.setLeave(() => {
      clearInterval(tick); tick = null; step(); if (!att.done) save();
      document.removeEventListener('visibilitychange', vis); window.removeEventListener('pagehide', vis);
      document.removeEventListener('keydown', keyHandler); keyHandler = null;
      document.documentElement.classList.remove('in-runner');
    });
    show(att.cur);
  }
  // a link to #test-<id> without a running attempt: the start page (same choices as the dialog)
  function renderStart(id) {
    renderCatalog();
    chooser(id);
  }

  // ---------- answers mode (study): every question with the key
  function renderAnswers(id, D, target) {
    const t = byId[id];
    document.title = `${title(t)} · პასუხები`;
    let reveal = H.store.get('reveal', true);
    const shown = new Set();
    H.app.innerHTML = `
      <div class="rbar static"><div class="wrap">
        <a class="iconbtn" href="#tests" aria-label="ტესტების სია" title="ტესტების სია">${ICON.back}</a>
        <div class="rtitle"><b>ისტორია ${t.year}</b><small>${esc(vName(t))} · პასუხები</small></div>
        <span class="spacer"></span>
        <label class="switch"><input type="checkbox" id="rv" ${reveal ? 'checked' : ''}><span>პასუხები ჩანს</span></label>
        ${window.self === window.top ? `<button class="iconbtn hide-sm" id="tprint" aria-label="ბეჭდვა" title="ბეჭდვა">${ICON.print}</button>` : ''}
        <button class="btn primary" id="twrite">${ICON.pen}<span class="hide-sm">დაწერა</span></button>
      </div></div>
      <div class="wrap review">
        <header class="revhead"><span class="eyebrow">${t.year} · ${esc(vFull(t))}</span><h1>${esc(title(t))}</h1>
          <p>${t.max} ქულა · ${t.count.mc + t.count.order} ტესტური და ${t.count.open} ღია კითხვა · ${dur(t.time)} · წყარო: <a href="${esc(D.src.test)}" target="_blank" rel="noopener">ტესტი</a>, <a href="${esc(D.src.scheme)}" target="_blank" rel="noopener">შეფასების სქემა</a> (NAEC)</p>
          <nav class="jump" aria-label="დავალებები">${D.sections.map(s => `<a href="#q-${s.from}" data-jump="${s.from}">${s.from === s.to ? s.from : s.from + '–' + s.to}<small>${esc(s.kind === 'mc' ? 'ტესტური' : s.kind === 'order' ? 'ქრონოლოგია' : KIND[s.kind] || '')}</small></a>`).join('')}</nav>
        </header>
        <div id="revlist"></div>
      </div>`;
    const list = H.app.querySelector('#revlist');
    const draw = () => {
      const ctx = { mode: 'answers', reveal };
      let out = '', lastSec = null;
      for (const it of D.items) {
        const s = sectionFor(D, it.n);
        if (s && (s.kind === 'mc' || s.kind === 'order') && s !== lastSec) { out += `<div class="secintro"><b>${esc(SEC_TITLE[s.kind])} ${s.from}–${s.to}</b></div>`; lastSec = s; }
        out += it.t === 'group' ? groupHTML(D, it, ctx) : unitHTML(it, ctx);
      }
      list.innerHTML = out;
      if (!reveal) shown.forEach(n => revealOne(n));
    };
    function revealOne(n) {
      const u = model(D).units.find(x => x.key === n); const el = list.querySelector(`[data-unit="${CSS.escape(n)}"]`);
      if (u && el) { el.outerHTML = unitHTML(u.q, { mode: 'answers', reveal: true }); }
    }
    draw();
    H.app.querySelector('#rv').addEventListener('change', e => { reveal = e.target.checked; H.store.set('reveal', reveal); shown.clear(); draw(); });
    const pb = H.app.querySelector('#tprint'); if (pb) pb.addEventListener('click', () => window.print());   // printing is not available inside embedding frames
    H.app.querySelector('#twrite').addEventListener('click', () => chooser(id));
    list.addEventListener('click', e => {
      const r = e.target.closest('[data-reveal]'); if (r) { shown.add(r.dataset.reveal); revealOne(r.dataset.reveal); return; }
      const z = e.target.closest('[data-zoom]'); if (z) lightbox(z.dataset.zoom, z.getAttribute('aria-label'));
    });
    H.app.querySelector('.jump').addEventListener('click', e => { const a = e.target.closest('[data-jump]'); if (a) { e.preventDefault(); const el = document.getElementById('q-' + a.dataset.jump); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); } });
    if (target) requestAnimationFrame(() => { const el = document.getElementById('q-' + target); if (el) el.scrollIntoView({ block: 'start' }); });
    else window.scrollTo(0, 0);
  }

  // ---------- result
  function renderResult(id, D) {
    const t = byId[id];
    const att = getAtt(id);
    if (!att || !att.done) { renderStart(id); return; }
    att.self = att.self || {};
    document.title = `${title(t)} · შედეგი`;
    let filter = 'all';
    H.app.innerHTML = `
      <div class="rbar static"><div class="wrap">
        <a class="iconbtn" href="#tests" aria-label="ტესტების სია" title="ტესტების სია">${ICON.back}</a>
        <div class="rtitle"><b>ისტორია ${t.year}</b><small>${esc(vName(t))} · შედეგი</small></div>
        <span class="spacer"></span>
        <button class="btn primary" id="tagain">${ICON.pen}<span>ხელახლა</span></button>
      </div></div>
      <div class="wrap result">
        <section class="rsum" id="rsum"></section>
        <div class="chips rfilter" role="group" aria-label="ფილტრი">
          <button class="chip on" data-f="all">ყველა</button><button class="chip" data-f="bad">შეცდომები</button><button class="chip" data-f="open">ღია კითხვები</button><button class="chip" data-f="empty">უპასუხო</button>
        </div>
        <div id="rlist"></div>
        <div class="ractions"><button class="btn primary" id="tagain2">${ICON.pen}თავიდან დაწერა</button><a class="btn" href="#test-${id}-answers">${ICON.eye}პასუხების ნახვა</a><a class="btn" href="#tests">ყველა ტესტი</a></div>
      </div>`;
    const sum = H.app.querySelector('#rsum'), list = H.app.querySelector('#rlist');
    function drawSum() {
      const g = grade(D, att);
      const pc = Math.round(100 * g.total / g.max);
      const R = 52, C = 2 * Math.PI * R;
      const secs = D.sections.map(s => {
        let got = 0, max = 0, self = false;
        for (const it of D.items) if (+it.n >= s.from && +it.n <= s.to) for (const q of (it.t === 'group' ? it.sub : [it])) { max += q.p; got += g.units[q.n].pts; if (q.t === 'open') self = true; }
        return { s, got, max, self };
      });
      sum.innerHTML = `
        <div class="ring" role="img" aria-label="${g.total} ქულა ${g.max}-დან"><svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="${R}" class="rt"/><circle cx="60" cy="60" r="${R}" class="rv" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - g.total / g.max)}"/></svg><div><b>${g.total}</b><small>/ ${g.max}</small></div></div>
        <div class="rinfo">
          <span class="eyebrow">${t.year} · ${esc(vFull(t))}</span>
          <h1>შენი შედეგი: ${g.total} ქულა <small>(${pc}%)</small></h1>
          <p>ტესტური ნაწილი: <b>${g.auto} / ${g.autoMax}</b> (ავტომატურად) · ღია კითხვები: <b>${g.open} / ${g.openMax}</b> <span class="muted">(შეფასებულია ${g.graded} / ${g.openN})</span></p>
          <p class="muted">დრო: ${clock(att.elapsed)}${att.limit ? ` · ლიმიტი ${clock(att.limit)}` : ' · დროის გარეშე'} · ${date(att.finished)}</p>
          ${g.graded < g.openN ? `<p class="callout">ღია კითხვებისთვის ქვემოთ ნახე შენი პასუხი და NAEC-ის შეფასების სქემა, მერე მიანიჭე ქულა — შედეგი განახლდება.</p>` : ''}
        </div>
        <div class="rtiles">
          <span class="ok"><b>${g.ok}</b>სწორი</span><span class="bad"><b>${g.bad}</b>შეცდომა</span><span class="empty"><b>${g.empty}</b>უპასუხო</span><span class="self"><b>${g.graded}/${g.openN}</b>შეფასებული ღია</span>
        </div>
        <table class="rsecs"><thead><tr><th>დავალებები</th><th>ქულა</th></tr></thead><tbody>${secs.map(x => `<tr><td>${x.s.from === x.s.to ? x.s.from : x.s.from + '–' + x.s.to} · ${esc(x.s.kind === 'mc' ? 'ტესტური' : x.s.kind === 'order' ? 'ქრონოლოგია' : KIND[x.s.kind] || '')}</td><td><b>${x.got}</b> / ${x.max}${x.self ? ' <span class="muted">(შენი შეფასებით)</span>' : ''}<span class="bar"><i style="width:${x.max ? 100 * x.got / x.max : 0}%"></i></span></td></tr>`).join('')}</tbody></table>`;
      // keep the history entry in step with self-grading
      const hist = getHist(id); const h = hist.find(x => x.at === att.finished); if (h) { h.total = g.total; H.store.set('hist:' + id, hist); }
      return g;
    }
    function drawList() {
      const g = grade(D, att);
      const ctx = { mode: 'result', att, g };
      const keep = q => filter === 'all' || (filter === 'bad' && g.units[q.n].st === 'bad') || (filter === 'open' && q.t === 'open') || (filter === 'empty' && g.units[q.n].st === 'empty');
      let out = '';
      for (const it of D.items) {
        if (it.t === 'group') { if (it.sub.some(keep)) out += groupHTML(D, { ...it, sub: it.sub.filter(keep) }, ctx); }
        else if (keep(it)) out += unitHTML(it, ctx);
      }
      list.innerHTML = out || '<p class="empty">ამ ფილტრით კითხვა არ არის.</p>';
    }
    drawSum(); drawList();
    H.app.querySelectorAll('[data-f]').forEach(b => b.addEventListener('click', () => { filter = b.dataset.f; H.app.querySelectorAll('[data-f]').forEach(x => x.classList.toggle('on', x === b)); drawList(); }));
    list.addEventListener('click', e => {
      const s = e.target.closest('[data-self]');
      if (s) {
        const q = s.dataset.self, k = +s.dataset.pts;
        if (att.self[q] === k) delete att.self[q]; else att.self[q] = k;
        setAtt(id, att);
        const g = drawSum();
        const el = list.querySelector(`[data-unit="${CSS.escape(q)}"]`);
        const u = model(D).units.find(x => x.key === q);
        if (el && u) el.outerHTML = unitHTML(u.q, { mode: 'result', att, g }, true);
        return;
      }
      const z = e.target.closest('[data-zoom]'); if (z) lightbox(z.dataset.zoom, z.getAttribute('aria-label'));
    });
    const again = () => chooser(id);
    H.app.querySelector('#tagain').addEventListener('click', again);
    H.app.querySelector('#tagain2').addEventListener('click', again);
    window.scrollTo(0, 0);
  }

  // ---------- links from atlas map pages: tests whose map task is on this topic
  function testsForMap(mapId) { return TESTS.filter(t => (t.maps || []).includes(mapId)); }
  function examLinksHTML(mapId) {
    const ts = testsForMap(mapId);
    if (!ts.length) return '';
    return `<section class="panel examtests"><h3>გამოცდაზე იყო</h3><p>ამ თემის რუკა იყო ეროვნული გამოცდის ტესტში:</p><ul>${ts.map(t => `<li><a href="#test-${t.id}-answers-${t.mapTask}">${t.year} · ${esc(vFull(t))}<small>დავალება ${t.mapTask} — რუკის ანალიზი</small></a></li>`).join('')}</ul></section>`;
  }

  // ---------- routing
  // plain hash names (letters, digits, hyphens): #test-2024-1, #test-2024-1-answers, #test-2024-1-answers-36, #test-2024-1-result
  const RX_ROUTE = /^test-(\d{4}-\d)(?:-(answers|result)(?:-(\d{1,2}))?)?$/;
  function match(h) { return h === 'tests' || RX_ROUTE.test(h); }
  function render(h) {
    if (h === 'tests') { renderCatalog(); window.scrollTo(0, 0); return; }
    const [, id, sub, target] = h.match(RX_ROUTE) || [];
    if (!byId[id]) { renderCatalog(); return; }
    H.app.innerHTML = `<div class="wrap"><p class="loadmsg">ტესტი იტვირთება…</p></div>`;
    loadTest(id).then(D => {
      if (location.hash.replace(/^#/, '') !== h && decodeURIComponent(location.hash.replace(/^#/, '')) !== h) return;
      if (sub === 'answers') renderAnswers(id, D, target);
      else if (sub === 'result') renderResult(id, D);
      else renderRunner(id, D);
    }).catch(err => { console.error(err); H.app.innerHTML = `<div class="wrap"><p class="loadmsg">ტესტის ჩატვირთვა ვერ მოხერხდა. შეამოწმე ინტერნეტი და სცადე თავიდან.</p></div>`; });
  }
  window.TestsUI = {
    init(h) { H = h; },
    match, render, testsForMap, examLinksHTML, chooser,
    count: TESTS.length,
  };
})();
