/* საგამოცდო ისტორიული ატლასი — app */
(function () {
  'use strict';
  const BLOCKS = window.BLOCKS || [];
  const CATALOG = window.CATALOG || [];
  const byId = Object.fromEntries(CATALOG.map(m => [m.id, m]));
  const app = document.getElementById('app');

  // ---------- utils ----------
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const rich = s => esc(s).replace(/&lt;(\/?)(b|i|em|strong)&gt;/g, '<$1$2>');
  const store = {
    get(k, d) { try { const v = localStorage.getItem('hatlas:' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('hatlas:' + k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
  };
  const blockOf = b => BLOCKS.find(x => x.b === b) || { b, t: '', sh: '' };
  const mq = q => (window.matchMedia ? window.matchMedia(q) : { matches: false });
  const PHONE = mq('(max-width: 640px), (max-height: 500px) and (pointer: coarse)');   // keep in sync with style.css
  const COARSE = mq('(pointer: coarse)');
  let onLayout = null;   // per-page relayout hook (resize, fonts loaded)
  window.addEventListener('resize', () => { if (onLayout) onLayout(); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { if (onLayout) onLayout(); });
  const SVGNS = 'http://www.w3.org/2000/svg';
  const svgEl = (tag, attrs, parent) => { const e = document.createElementNS(SVGNS, tag); if (attrs) for (const k in attrs) if (attrs[k] != null) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
  let leave = null;   // per-page cleanup (test timer, key handlers), run before the next route renders
  const TESTS = window.TestsUI ? (window.TESTS || []) : [];
  const examMaps = new Set(TESTS.flatMap(t => t.maps || []));   // atlas maps whose topic was on a national exam
  const isExam = m => !!(m.ex || examMaps.has(m.id));

  // ---------- theme: follows the device until the reader picks one
  const root = document.documentElement;
  const darkMQ = mq('(prefers-color-scheme: dark)');
  const themeNow = () => root.dataset.theme || (darkMQ.matches ? 'dark' : 'light');
  function applyTheme(t) {
    if (t) root.dataset.theme = t; else delete root.dataset.theme;
    const meta = document.querySelector('meta[name="theme-color"]:not([media])');
    if (meta) meta.content = themeNow() === 'dark' ? '#17140f' : '#fffdf8';
    document.querySelectorAll('[data-theme-toggle]').forEach(b => { const d = themeNow() === 'dark'; b.setAttribute('aria-pressed', d); b.title = d ? 'ღია ფერები' : 'მუქი ფერები'; b.setAttribute('aria-label', b.title); });
  }
  applyTheme(store.get('theme', null));
  document.addEventListener('click', e => { const b = e.target.closest('[data-theme-toggle]'); if (!b) return; const t = themeNow() === 'dark' ? 'light' : 'dark'; store.set('theme', t); applyTheme(t); });
  if (darkMQ.addEventListener) darkMQ.addEventListener('change', () => applyTheme(store.get('theme', null)));

  // ---------- phones: the bottom tab bar slides away while reading down, comes back on scroll up
  (function tabbar() {
    let lastY = window.scrollY, acc = 0, raf = 0;
    window.addEventListener('scroll', () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const y = window.scrollY, dy = y - lastY; lastY = y;
        acc = (acc > 0) === (dy > 0) ? acc + dy : dy;
        if (y < 80 || acc < -24) root.classList.remove('tab-away');
        else if (acc > 48) root.classList.add('tab-away');
      });
    }, { passive: true });
  })();

  // ---------- data loading ----------
  const loading = {};
  function loadMapData(id) {
    if (window.MAPDATA && window.MAPDATA[id]) return Promise.resolve(window.MAPDATA[id]);
    if (loading[id]) return loading[id];
    loading[id] = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'data/maps/' + encodeURIComponent(id) + '.js';
      s.onload = () => (window.MAPDATA && window.MAPDATA[id]) ? res(window.MAPDATA[id]) : rej(new Error('no data'));
      s.onerror = () => { delete loading[id]; rej(new Error('load failed')); };
      document.head.appendChild(s);
    });
    return loading[id];
  }

  // ---------- router ----------
  let homeScroll = 0, current = null;
  function route() {
    const h = decodeURIComponent((location.hash || '').replace(/^#/, ''));
    if (leave) { try { leave(); } catch (e) { console.error(e); } leave = null; }
    const tests = !!(window.TestsUI && window.TestsUI.match(h));
    const sec = tests ? 'tests' : h === 'about' ? 'about' : 'home';
    document.querySelectorAll('[data-nav]').forEach(a => { const on = a.dataset.nav === sec; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    root.dataset.sec = byId[h] ? 'map' : sec;
    root.classList.remove('tab-away');
    if (current === 'home') homeScroll = window.scrollY;
    root.classList.remove('fs-lock');
    onLayout = null;
    if (tests) { current = h; window.TestsUI.render(h); }
    else if (byId[h]) { current = h; renderMapPage(h); window.scrollTo(0, 0); }
    else if (h === 'about') { current = 'about'; renderAbout(); window.scrollTo(0, 0); }
    else { const back = current && current !== 'home'; current = 'home'; renderHome(); if (back) requestAnimationFrame(() => window.scrollTo(0, homeScroll)); }
  }
  window.addEventListener('hashchange', route);
  if (window.TestsUI) window.TestsUI.init({ app, esc, rich, store, route, mq, PHONE, COARSE, setLeave: fn => { leave = fn; } });

  // ---------- home ----------
  const SEARCH_ICON = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.6-3.6"/></svg>';
  const norm = s => (s || '').toLowerCase().replace(/[.,;:!?()„“"'«»\-–—]/g, ' ');
  function renderHome() {
    document.title = 'საგამოცდო ისტორიული ატლასი';
    const st = store.get('filter', { scope: 'all', exam: false, q: '' });
    const nGe = CATALOG.filter(m => m.ge).length, nEx = CATALOG.filter(isExam).length;
    app.innerHTML = `
      <section class="wrap hero">
        <h1>ისტორიის საგამოცდო რუკები ერთ ადგილას</h1>
        <p>ეროვნული საგამოცდო პროგრამის 11 თემის მიხედვით დალაგებული რუკები: საქართველოს და მსოფლიო ისტორია. თითო რუკაზე: ინტერაქტიული რუკა ქართული წარწერებით, რეალური ისტორიული რუკა, ახსნა და მთავარი ფაქტები.</p>
        <div class="stats"><span><b>${CATALOG.length}</b>რუკა</span><span><b>${nGe}</b>საქართველოს ისტორია</span><span><b>${CATALOG.length - nGe}</b>მსოფლიო ისტორია</span><span><b>11</b>საგამოცდო თემა</span></div>
        ${TESTS.length ? `<a class="promo" href="#tests"><span class="promo-ico" aria-hidden="true"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="3" width="16" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg></span><span><b>ეროვნული გამოცდების ტესტები</b><small>${TESTS.length} ვარიანტი (${Math.min(...TESTS.map(t => t.year))}–${Math.max(...TESTS.map(t => t.year))}) პასუხებით — დაწერე დროით ან ნახე პასუხები</small></span><span class="promo-go" aria-hidden="true">›</span></a>` : ''}
      </section>
      <div class="controls"><div class="wrap">
        <div class="searchrow">
          <label class="search">${SEARCH_ICON}<input id="q" type="search" placeholder="მოძებნე: თამარი, დიდგორი, ნაპოლეონი, 1921…" autocomplete="off" value="${esc(st.q)}" aria-label="ძებნა"></label>
          <div class="chips" role="group" aria-label="ფილტრი">
            <button class="chip" data-scope="all">ყველა <span class="n">${CATALOG.length}</span></button>
            <button class="chip" data-scope="ge">საქართველო <span class="n">${nGe}</span></button>
            <button class="chip" data-scope="wo">მსოფლიო <span class="n">${CATALOG.length - nGe}</span></button>
            ${nEx ? `<button class="chip" data-exam="1">გამოცდაზე ნანახი <span class="n">${nEx}</span></button>` : ''}
          </div>
        </div>
        <nav class="blocknav" aria-label="თემები">${BLOCKS.map(b => `<button data-go="${b.b}"><i>${b.b}</i>${esc(b.sh)}</button>`).join('')}</nav>
      </div></div>
      <div class="wrap" id="blocks"></div>`;
    const q = app.querySelector('#q');
    const apply = () => {
      st.q = q.value; store.set('filter', st);
      app.querySelectorAll('[data-scope]').forEach(b => b.classList.toggle('on', b.dataset.scope === st.scope));
      const ex = app.querySelector('[data-exam]'); if (ex) ex.classList.toggle('on', !!st.exam);
      const terms = norm(st.q).split(/\s+/).filter(Boolean);
      const list = CATALOG.filter(m => (st.scope === 'all' || (st.scope === 'ge') === m.ge) && (!st.exam || isExam(m)) &&
        terms.every(t => norm(m.kw + ' ' + blockOf(m.b).t).includes(t)));
      const host = app.querySelector('#blocks');
      if (!list.length) { host.innerHTML = `<p class="empty">ამ ძებნით რუკა ვერ მოიძებნა. სცადე სხვა სიტყვა, მაგალითად მმართველის სახელი, ბრძოლა ან წელი.</p>`; return; }
      host.innerHTML = BLOCKS.map(b => {
        const ms = list.filter(m => m.b === b.b);
        if (!ms.length) return '';
        return `<section class="block" id="block-${b.b}">
          <div class="blockhead"><span class="blocknum">${b.b}</span><h2>${esc(b.t)}</h2></div>
          <div class="blockmeta">${esc(b.d)} · ${ms.length} რუკა</div>
          <div class="grid">${ms.map(card).join('')}</div></section>`;
      }).join('');
      app.querySelectorAll('.blocknav button').forEach(btn => { btn.disabled = !host.querySelector('#block-' + btn.dataset.go); btn.style.opacity = btn.disabled ? .4 : 1; });
    };
    q.addEventListener('input', apply);
    app.querySelectorAll('[data-scope]').forEach(b => b.addEventListener('click', () => { st.scope = b.dataset.scope; apply(); }));
    const exb = app.querySelector('[data-exam]'); if (exb) exb.addEventListener('click', () => { st.exam = !st.exam; apply(); });
    app.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', () => { const s = document.getElementById('block-' + b.dataset.go); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }));
    apply();

    // phones: pin only the theme row (search + filter chips scroll away with the page)
    const ctl = app.querySelector('.controls'), nav = app.querySelector('.blocknav'), host = app.querySelector('#blocks');
    const stick = () => { if (ctl.isConnected) ctl.style.setProperty('--ctl-stick', PHONE.matches ? -nav.offsetTop + 'px' : '0px'); };
    stick();
    onLayout = stick;
    // phones: highlight the theme being read and keep its button in view
    let raf = 0, cur = null;
    const spy = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        if (!nav.isConnected) { window.removeEventListener('scroll', spy); return; }
        if (!PHONE.matches) { if (cur) { cur.classList.remove('on'); cur = null; } return; }
        const lim = ctl.getBoundingClientRect().bottom + 30;
        let id = null;
        for (const s of host.querySelectorAll('.block')) { if (s.getBoundingClientRect().top <= lim) id = s.id.slice(6); else break; }
        const b = id && nav.querySelector(`[data-go="${id}"]`);
        if (b === cur) return;
        if (cur) cur.classList.remove('on');
        cur = b || null;
        if (cur) { cur.classList.add('on'); nav.scrollTo({ left: cur.offsetLeft - (nav.clientWidth - cur.offsetWidth) / 2, behavior: 'smooth' }); }
      });
    };
    window.addEventListener('scroll', spy, { passive: true });
  }
  function card(m) {
    return `<a class="card" href="#${encodeURIComponent(m.id)}">
      <div class="thumb">${m.th}<div class="tags"><span class="tag ${m.ge ? 'ge' : 'wo'}">${m.ge ? 'საქართველო' : 'მსოფლიო'}</span>${isExam(m) ? `<span class="tag ex">გამოცდაზე</span>` : ''}</div></div>
      <div class="cardbody"><span class="date">${esc(m.d)}</span><h3>${esc(m.t)}</h3><p>${esc(m.s)}</p></div></a>`;
  }

  // ---------- about ----------
  function renderAbout() {
    document.title = 'შესახებ · საგამოცდო ისტორიული ატლასი';
    app.innerHTML = `<article class="wrap about">
      <h1>საიტის შესახებ</h1>
      <p>ატლასი ეხმარება აბიტურიენტებს ისტორიის ერთიანი ეროვნული გამოცდისთვის მზადებაში. გამოცდაზე ცალკე დავალებაა „ისტორიული რუკის ანალიზი“: მოცემულია რუკა და კითხვები, მაგალითად რომელ საუკუნეს ან მმართველს ასახავს რუკა, რომელი ქალაქი აიღეს, რომელი სახელმწიფოს ჯარი მოძრაობს ისრით. ოფიციალური „რუკების სია“ არ არსებობს: რუკა შეიძლება იყოს პროგრამის ნებისმიერი თემიდან. ამიტომ აქ რუკები დალაგებულია <b>შეფასებისა და გამოცდების ეროვნული ცენტრის (NAEC) 2026 წლის საგამოცდო პროგრამის</b> 11 თემის მიხედვით, და თითო თემის ყველა მნიშვნელოვანი გეოგრაფიული საკითხი რუკაზეა დატანილი.</p>
      <h2>როგორ ვისწავლოთ</h2>
      <ul>
        <li>ჯერ წაიკითხე „მოკლედ“ და „მთავარი ფაქტები“, მერე რუკაზე იპოვე ყველა ქალაქი, ბრძოლა და ლაშქრობა.</li>
        <li>ჩართე <b>ციფრების რეჟიმი</b> (ღილაკი რუკის მარჯვენა კუთხეში): სახელები ციფრებით შეიცვლება, როგორც გამოცდაზე. სცადე გაიხსენო, მერე გვერდით სიაში გახსენი პასუხი.</li>
        <li>„როგორ ამოვიცნოთ რუკა“ გეუბნება, რა ნიშნებით მიხვდები, რომელ ეპოქას ასახავს რუკა.</li>
        <li>„რეალური რუკა“ ჩანართში არის ისტორიული ან სახელმძღვანელოს სტილის რუკა ღია წყაროდან, შესადარებლად.</li>
        <li>„გამოცდაზე ნანახი“ ფილტრი აჩვენებს თემებს, რომელთა რუკაც უკვე იყო ეროვნულ გამოცდაზე ან NAEC-ის ნიმუშში. რუკის გვერდზე „გამოცდაზე იყო“ ბმული პირდაპირ იმ ტესტის დავალებაზე გადაგიყვანს.</li>
      </ul>
      <h2 id="about-tests">ეროვნული გამოცდების ტესტები</h2>
      <p>„ტესტები“ განყოფილებაში არის ისტორიის ერთიანი ეროვნული გამოცდის <b>${TESTS.length} ვარიანტი (${TESTS.length ? Math.min(...TESTS.map(t => t.year)) + '–' + Math.max(...TESTS.map(t => t.year)) : ''})</b>, დამატებითი სესიების ჩათვლით — NAEC-ის მიერ გამოქვეყნებული ტესტები და შეფასების სქემები, გადმოტანილი ტექსტად: კითხვები, რუკები, ილუსტრაციები და ისტორიული დოკუმენტები.</p>
      <ul>
        <li><b>დაწერა</b>: აირჩიე საგამოცდო დრო (როგორც გამოცდაზე, ${TESTS.length ? Math.floor(TESTS[0].time / 60) + ' სთ ' + (TESTS[0].time % 60) + ' წთ' : '2 სთ 40 წთ'}), დროის გარეშე ან შენი დრო. წერისას შეგიძლია კითხვის მონიშვნა, პასუხების ფურცლით გადასვლა ნებისმიერ კითხვაზე; კომპიუტერზე პასუხს ირჩევ 1–4 ღილაკებით, ←/→ ისრებით გადადიხარ.</li>
        <li><b>შედეგი</b>: ტესტური კითხვები და ქრონოლოგია ფასდება ავტომატურად. ღია კითხვებთან ნახავ შენს პასუხს და ოფიციალურ შეფასების სქემას — ქულას თავად ანიჭებ, და საერთო ქულა განახლდება.</li>
        <li><b>პასუხების ნახვა</b>: მთელი ტესტი სწორი პასუხებით; „პასუხები ჩანს“ გამორთვით შეგიძლია საკუთარი თავი შეამოწმო და პასუხი სათითაოდ გახსნა. გვერდი იბეჭდება.</li>
        <li>დაწყებული ტესტი და შედეგები ინახება მხოლოდ ამ მოწყობილობის ბრაუზერში.</li>
      </ul>
      <h2>ტელეფონზე და ოფლაინ</h2>
      <p>საიტი მუშაობს ტელეფონზე, პლანშეტზე და კომპიუტერზე. ტელეფონზე შეგიძლია დაამატო მთავარ ეკრანზე როგორც აპლიკაცია: Android-ზე Chrome-ის მენიუ → „Add to Home screen / Install app“, iPhone-ზე Safari → „გაზიარება“ → „Add to Home Screen“. ერთხელ გახსნილი რუკები და ტესტები ინტერნეტის გარეშეც გაიხსნება.</p>
      <p id="offline-row" hidden><button class="btn" id="offline-btn" type="button">ყველა რუკისა და ტესტის ჩამოტვირთვა ოფლაინისთვის (~25 MB)</button> <span class="small" id="offline-msg"></span></p>
      <h2>როგორ არის შედგენილი რუკები</h2>
      <p>ინტერაქტიული რუკები ერთ სტილშია და მიჰყვება გამოცდის რუკების პირობით ნიშნებს: საქართველოს სამეფო წითლად, ვასალები ღია ფერით, დამოკიდებული ტომები შტრიხით, ლაშქრობები თარიღიანი ისრებით, აღებული ქალაქები დროშით, ბრძოლები გადაჯვარედინებული მახვილებით. ისტორიული საზღვრები <b>სქემატურია</b> და ზოგად სურათს გადმოსცემს; ზუსტი დეტალებისთვის გადაამოწმე სასკოლო სახელმძღვანელოში.</p>
      <h2>წყაროები და ლიცენზიები</h2>
      <ul>
        <li>NAEC: ერთიანი ეროვნული საგამოცდო პროგრამა ისტორიაში (2026), საგამოცდო ტესტები და ნიმუშები (naec.ge).</li>
        <li>ტესტები და შეფასების სქემები: <a href="https://naec.ge/" target="_blank" rel="noopener">შეფასებისა და გამოცდების ეროვნული ცენტრი</a> — „გამოცდები 2020–2026 — ერთიან ეროვნულ გამოცდებზე გამოყენებული ტესტები“; თითო ტესტთან მითითებულია ორიგინალი PDF.</li>
        <li>ფიზიკური რუკა: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a> (საჯარო საკუთრება).</li>
        <li>საქართველოს მდინარეები: © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>-ის მონაწილეები (ODbL).</li>
        <li>ზოგი ისტორიული საზღვარი მსოფლიო რუკებზე: <a href="https://github.com/aourednik/historical-basemaps" target="_blank" rel="noopener">historical-basemaps</a> (A. Ourednik, GPL-3.0).</li>
        <li>რეალური რუკები: <a href="https://commons.wikimedia.org/" target="_blank" rel="noopener">Wikimedia Commons</a>; ავტორი და ლიცენზია მითითებულია თითო რუკასთან.</li>
      </ul>
      <p class="about-go"><a class="btn primary" href="#">რუკები</a> <a class="btn" href="#tests">ტესტები</a></p>
    </article>`;
    // offline copy of every map and test (service worker installed, i.e. served over http(s) outside a frame)
    const row = app.querySelector('#offline-row');
    if (row && navigator.serviceWorker && navigator.serviceWorker.controller) {
      row.hidden = false;
      const btn = app.querySelector('#offline-btn'), msg = app.querySelector('#offline-msg');
      btn.addEventListener('click', () => {
        const urls = CATALOG.map(m => 'data/maps/' + encodeURIComponent(m.id) + '.js')
          .concat(TESTS.map(t => 'data/tests/' + t.id + '.js'), TESTS.flatMap(t => (t.imgs || []).map(f => 'img/tests/' + f)), TESTS.map(t => t.thumb ? 'img/tests/' + t.thumb : null).filter(Boolean));
        const ch = new MessageChannel();
        btn.disabled = true; msg.textContent = 'იტვირთება…';
        ch.port1.onmessage = e => { msg.textContent = e.data.done < e.data.total ? `${e.data.done} / ${e.data.total}` : 'მზადაა — ყველაფერი ხელმისაწვდომია ოფლაინ.'; if (e.data.done >= e.data.total) btn.disabled = false; };
        navigator.serviceWorker.controller.postMessage({ type: 'cache-all', urls }, [ch.port2]);
      });
    }
  }

  // ---------- map page ----------
  function neighbours(id) {
    const i = CATALOG.findIndex(m => m.id === id);
    return { prev: CATALOG[i - 1], next: CATALOG[i + 1] };
  }
  let mapCtl = null;
  function renderMapPage(id) {
    const m = byId[id];
    const blk = blockOf(m.b);
    const { prev, next } = neighbours(id);
    document.title = m.t + ' · საგამოცდო ისტორიული ატლასი';
    const sameBlock = CATALOG.filter(x => x.b === m.b);
    app.innerHTML = `
      <div class="mapbar"><div class="wrap">
        <a class="btn" href="#" title="ყველა რუკა" aria-label="ყველა რუკა">←<span class="lbl">რუკები</span></a>
        <span class="pick"><select id="pick" aria-label="ამ თემის რუკები">${sameBlock.map(x => `<option value="${esc(x.id)}" ${x.id === id ? 'selected' : ''}>${esc(x.d)} · ${esc(x.t)}</option>`).join('')}</select></span>
        <span class="spacer"></span>
        <a class="btn" href="${prev ? '#' + encodeURIComponent(prev.id) : '#'}" aria-disabled="${!prev}" title="${prev ? esc(prev.t) : ''}" aria-label="წინა რუკა">‹<span class="lbl">წინა</span></a>
        <a class="btn" href="${next ? '#' + encodeURIComponent(next.id) : '#'}" aria-disabled="${!next}" title="${next ? esc(next.t) : ''}" aria-label="შემდეგი რუკა"><span class="lbl">შემდეგი</span>›</a>
      </div></div>
      <div class="wrap maphead">
        <div class="crumb"><a href="#">რუკები</a> · <a href="#" data-block="${m.b}">${m.b}. ${esc(blk.t)}</a></div>
        <h1>${esc(m.t)}</h1>
        <div class="when"><span class="pill date">${esc(m.d)}</span><span class="pill ${m.ge ? 'ge' : 'wo'}">${m.ge ? 'საქართველოს ისტორია' : 'მსოფლიო ისტორია'}</span>${isExam(m) ? `<span class="pill ex">გამოცდაზე ნანახი</span>` : ''}</div>
      </div>
      <div class="wrap mapgrid">
        <div class="panel" id="mainpanel">
          <div class="tabs" role="tablist">
            <button class="tab on" data-tab="map" role="tab">ინტერაქტიული რუკა</button>
            <button class="tab" data-tab="real" role="tab">რეალური რუკა<span class="cnt">${m.real || ''}</span></button>
          </div>
          <div id="tab-map">
            <div class="stage" id="stage"><div class="realnone">რუკა იტვირთება…</div></div>
            <div class="legend" id="legend"></div>
          </div>
          <div id="tab-real" hidden></div>
        </div>
        <aside class="side" id="side"></aside>
      </div>`;
    app.querySelector('#pick').addEventListener('change', e => { location.hash = '#' + encodeURIComponent(e.target.value); });
    app.querySelector('[data-block]').addEventListener('click', e => { e.preventDefault(); location.hash = ''; setTimeout(() => { const s = document.getElementById('block-' + m.b); if (s) s.scrollIntoView(); }, 30); });
    app.querySelectorAll('.tab').forEach(t => t.addEventListener('click', () => {
      app.querySelectorAll('.tab').forEach(x => x.classList.toggle('on', x === t));
      app.querySelector('#tab-map').hidden = t.dataset.tab !== 'map';
      app.querySelector('#tab-real').hidden = t.dataset.tab !== 'real';
    }));
    const stage = app.querySelector('#stage');
    loadMapData(id).then(D => {
      if (current !== id) return;
      fillSide(D);
      mapCtl = drawMap(stage, D, app.querySelector('#legend'));
    }).catch(err => { console.error(err); stage.innerHTML = '<div class="realnone">რუკის ჩატვირთვა ვერ მოხერხდა.</div>'; });
  }
  function fillSide(D) {
    const T = D.text || {};
    const real = D.real || [];
    const facts = (T.f || []).map(f => Array.isArray(f) ? `<li><span class="fd">${esc(f[0])}</span><span>${rich(f[1])}</span></li>` : `<li class="nodate"><span>${rich(f)}</span></li>`).join('');
    app.querySelector('#tab-real').innerHTML = real.length ? real.map(r => `<div class="realmap"><figure>
        <a href="${esc(r.u)}" target="_blank" rel="noopener"><img src="img/real/${esc(r.f)}" alt="${esc(r.t)}" loading="lazy"></a>
        <figcaption>${esc(r.t)}${r.note ? ' — ' + esc(r.note) : ''}</figcaption>
        <div class="src"><span>ავტორი: ${esc(r.a || 'უცნობი')}</span><span>ლიცენზია: ${esc(r.l || '')}</span><a href="${esc(r.u)}" target="_blank" rel="noopener">Wikimedia Commons ↗</a></div>
      </figure></div>`).join('') : '<div class="realnone">ამ თემაზე ღია ლიცენზიის შესაფერისი რეალური რუკა ვერ მოიძებნა. ისარგებლე ინტერაქტიული რუკით.</div>';
    app.querySelector('#side').innerHTML = `
      ${T.s ? `<section class="panel"><h3>მოკლედ</h3><p>${rich(T.s)}</p></section>` : ''}
      ${facts ? `<section class="panel"><h3>მთავარი ფაქტები</h3><ul class="facts">${facts}</ul></section>` : ''}
      ${(T.r || []).length ? `<section class="panel"><h3>დაიმახსოვრე</h3><ul class="remember">${T.r.map(r => `<li>${rich(r)}</li>`).join('')}</ul></section>` : ''}
      ${T.how ? `<section class="panel how"><h3>როგორ ამოვიცნოთ რუკა</h3><p>${rich(T.how)}</p></section>` : ''}
      ${D.exam ? `<section class="panel exam"><h3>გამოცდაზე</h3><p>${rich(D.exam)}</p></section>` : ''}
      ${window.TestsUI && current ? window.TestsUI.examLinksHTML(current) : ''}
      <section class="panel" id="numpanel" hidden><h3>ციფრების გასაღები</h3><p class="small" style="margin-bottom:8px">დააჭირე, რომ ნახო სახელი.</p><ul class="numkey" id="numkey"></ul></section>`;
  }

  // ---------- projection (mirrors _build/build.mjs) ----------
  function makeProjection(view, kind, W, H, pad) {
    const [w, s, e, n] = view;
    const k = kind || ((e - w) > 100 ? 'ee' : 'merc');
    let p;
    if (k === 'ee') p = d3.geoEqualEarth().rotate([-(w + e) / 2, 0]);
    else if (k === 'conic') p = d3.geoConicConformal().parallels([s + (n - s) / 4, n - (n - s) / 4]).rotate([-(w + e) / 2, 0]);
    else p = d3.geoMercator().rotate([-(w + e) / 2, 0]);
    const pts = []; for (let i = 0; i <= 8; i++) { const x = w + (e - w) * i / 8, y = s + (n - s) * i / 8; pts.push([x, s], [x, n], [w, y], [e, y]); }
    p.fitExtent([[pad || 0, pad || 0], [W - (pad || 0), H - (pad || 0)]], { type: 'MultiPoint', coordinates: pts });
    return p;
  }

  // ---------- icons ----------
  const KIND_NAMES = { city: 'ქალაქი', cap: 'დედაქალაქი', battle: 'ბრძოლის ადგილი', flag: 'აღებული ქალაქი', camp: 'სამხედრო ბანაკი', fire: 'აჯანყება', treaty: 'ზავი, ხელშეკრულება, კონფერენცია', site: 'ძეგლი, ცენტრი', port: 'კოლონია, ნავსადგური', star: 'მნიშვნელოვანი მოვლენა', siege: 'ალყა' };
  function iconSVG(kind, c) {
    switch (kind) {
      case 'cap': return '<circle r="5.2" fill="#fff" stroke="#2a241d" stroke-width="1.9"/><circle r="1.9" fill="#2a241d"/>';
      case 'battle': return '<g stroke-linecap="round"><path d="M-6 6L6 -6M6 6L-6 -6M-5.6 1.6L-1.6 5.6M5.6 1.6L1.6 5.6" stroke="#fff" stroke-width="4.4"/><path d="M-6 6L6 -6M6 6L-6 -6" stroke="#2a241d" stroke-width="2"/><path d="M-5.6 1.6L-1.6 5.6M5.6 1.6L1.6 5.6" stroke="#b3261e" stroke-width="1.8"/></g>';
      case 'flag': return `<path d="M-1.5 7V-9" stroke="#fff" stroke-width="3.4" stroke-linecap="round"/><path d="M-1.5 7V-9" stroke="#2a241d" stroke-width="1.5" stroke-linecap="round"/><path d="M-0.8 -9L9 -5.2L-0.8 -1.4Z" fill="${c || '#18705a'}" stroke="#fff" stroke-width=".8"/>`;
      case 'camp': return '<path d="M-7 5.5L0 -7L7 5.5Z" fill="#fff" stroke="#2d4b94" stroke-width="1.7" stroke-linejoin="round"/><path d="M-2.6 5.5L0 0.5L2.6 5.5" fill="#2d4b94"/>';
      case 'fire': return `<path d="M0 -8.5C3.2 -4.2 6.2 -2 5.3 2.6C4.7 6 2.3 7.6 0 7.6S-4.8 6 -5.3 2.6C-5.8 -1 -2.3 -2.2 -1.7 -5.3C-0.2 -3.2 0.9 -2.6 0 -8.5Z" fill="${c || '#e8590c'}" stroke="#fff" stroke-width="1.1"/>`;
      case 'treaty': return '<rect x="-5.2" y="-6.8" width="10.4" height="13.6" rx="1.6" fill="#fff" stroke="#2a241d" stroke-width="1.5"/><path d="M-2.6 -3.2h5.2M-2.6 -0.2h5.2M-2.6 2.8h3.2" stroke="#2a241d" stroke-width="1.15"/>';
      case 'site': return `<path d="M0 -6.5L6 4.8H-6Z" fill="${c || '#9a6b45'}" stroke="#fff" stroke-width="1.3" stroke-linejoin="round"/>`;
      case 'port': return `<circle r="4.3" fill="${c || '#4a7fd0'}" stroke="#fff" stroke-width="1.5"/>`;
      case 'star': return `<path d="M0 -7.5L2.2 -2.4L7.4 -2.3L3.3 1L4.7 6.3L0 3.3L-4.7 6.3L-3.3 1L-7.4 -2.3L-2.2 -2.4Z" fill="${c || '#d9473f'}" stroke="#fff" stroke-width="1.1" stroke-linejoin="round"/>`;
      case 'siege': return '<circle r="6" fill="none" stroke="#b3261e" stroke-width="1.6" stroke-dasharray="2.4 1.8"/><circle r="2.6" fill="#2a241d" stroke="#fff" stroke-width="1"/>';
      default: return `<circle r="3.3" fill="${c || '#2a241d'}" stroke="#fff" stroke-width="1.3"/>`;
    }
  }

  // ---------- map renderer ----------
  function drawMap(stage, D, legendHost) {
    let mode = { nums: false };
    let ctl = {};
    let lastW = 0, lastH = 0;
    let pseudo = false, pushed = false, hintSeen = false, lastPT = 'mouse';
    const isFs = () => pseudo || document.fullscreenElement === stage;
    stage.addEventListener('pointerdown', ev => { lastPT = ev.pointerType || 'mouse'; }, true);
    function build() {
      stage.innerHTML = '';
      const fs = isFs();
      const tmp = makeProjection(D.view, D.proj, 1000, 1000, 0);
      const pts = [[D.view[0], D.view[1]], [D.view[2], D.view[3]], [D.view[0], D.view[3]], [D.view[2], D.view[1]]].map(tmp);
      const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
      const nat = (Math.max(...ys) - Math.min(...ys)) / (Math.max(...xs) - Math.min(...xs));
      let W, H;
      if (fs) {
        // full screen: fill the screen, but stretch the frame at most 1.5x past the map's own shape (land data reaches 35% beyond the view)
        const cs = getComputedStyle(stage), px = k => parseFloat(cs[k]) || 0;   // content box: the overlay is padded clear of the phone's system bars
        const SW = Math.max(200, (stage.clientWidth || window.innerWidth) - px('paddingLeft') - px('paddingRight')), SH = Math.max(200, (stage.clientHeight || window.innerHeight) - px('paddingTop') - px('paddingBottom'));
        const a = Math.min(nat * 1.5, Math.max(nat / 1.5, SH / SW));
        W = Math.round(Math.min(SW, SH / a)); H = Math.round(W * a);
        lastW = stage.clientWidth; lastH = stage.clientHeight;   // outer size, compared on resize
      } else {
        W = Math.max(300, Math.round(stage.clientWidth || 900));
        lastW = W;
        let aspect = nat;
        const small = W < 640;
        if (small) aspect = Math.max(aspect, Math.min(aspect * 1.5, 0.78));   // phones: taller frame, room for the map buttons
        aspect = Math.min(small ? 1.3 : 0.95, Math.max(0.48, aspect));
        if (COARSE.matches) { const maxH = window.innerHeight - 120; if (W * aspect > maxH && maxH > 220) aspect = Math.max(maxH / W, nat / 1.5, 0.3); }
        H = Math.round(W * aspect);
      }
      const declutterOn = W < 700 || (COARSE.matches && Math.min(W, H) < 500);
      const proj = makeProjection(D.view, D.proj, W, H, 6);
      // tolerate degenerate rings left by simplification (e.g. a 1–3 point ring in France on the 1939–45 maps used to break the whole map)
      const path0 = d3.geoPath(proj);
      const cleanGeom = g => {
        const fix = p => (p && p[0] && p[0].length >= 4) ? p.filter(r => r && r.length >= 4) : null;
        if (!g) return null;
        if (g.type === 'Polygon') { const p = fix(g.coordinates); return p ? { type: 'Polygon', coordinates: p } : null; }
        if (g.type === 'MultiPolygon') { const ps = g.coordinates.map(fix).filter(Boolean); return ps.length ? { type: 'MultiPolygon', coordinates: ps } : null; }
        return g;
      };
      const path = g => { try { return path0(g); } catch (e) { try { const c = cleanGeom(g); return c ? path0(c) : null; } catch (e2) { return null; } } };
      const svg = svgEl('svg', { class: 'map-svg', viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: 'img', 'aria-label': D.t });
      stage.appendChild(svg);
      const defs = svgEl('defs', null, svg);
      const uid = 'm' + Math.random().toString(36).slice(2, 7);
      // patterns
      const mtn = svgEl('pattern', { id: 'mtnpat', width: 9, height: 7, patternUnits: 'userSpaceOnUse' }, defs);
      svgEl('path', { d: 'M0 6 L3 1.5 L6 6', fill: 'none', stroke: '#b89a72', 'stroke-width': .9 }, mtn);
      const patCache = {};
      function pattern(st, c, c2) {
        const key = st + c + (c2 || '');
        if (patCache[key]) return patCache[key];
        const id = uid + 'p' + Object.keys(patCache).length;
        const p = svgEl('pattern', { id, width: 8, height: 8, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
        if (st === 'hatch') { svgEl('rect', { width: 8, height: 8, fill: '#fff', 'fill-opacity': .55 }, p); svgEl('rect', { width: 3.4, height: 8, fill: c }, p); }
        else if (st === 'stripes') { svgEl('rect', { width: 8, height: 8, fill: c2 || '#fff' }, p); svgEl('rect', { width: 4, height: 8, fill: c }, p); }
        else if (st === 'cross') { svgEl('rect', { width: 8, height: 8, fill: c, 'fill-opacity': .25 }, p); svgEl('path', { d: 'M0 0H8M0 4H8', stroke: c, 'stroke-width': 1 }, p); }
        return (patCache[key] = `url(#${id})`);
      }
      const clipId = uid + 'land';
      if (D.land) { const cp = svgEl('clipPath', { id: clipId }, defs); svgEl('path', { d: path(D.land) }, cp); }

      svgEl('rect', { class: 'm-sea', width: W, height: H }, svg);
      const gz = svgEl('g', { class: 'zoomg' }, svg);
      if (D.land) svgEl('path', { class: 'm-land', d: path(D.land) }, gz);
      if (D.mtn) svgEl('path', { class: 'm-mtn', d: path(D.mtn) }, gz);
      const tipItems = [];
      if (D.ctx) {
        const g = svgEl('g', { 'clip-path': `url(#${clipId})` }, gz);
        for (const f of D.ctx.f) { const d = path(f.g); if (d) { const e = svgEl('path', { class: 'm-ctx m-c' + f.ci, d }, g); if (f.n) tipItems.push([e, f.n, '']); } }
        if (D.ctx.b) svgEl('path', { class: 'm-ctxb', d: path(D.ctx.b) }, gz);
      }
      // areas
      const ga = svgEl('g', null, gz);
      const gaClip = svgEl('g', { 'clip-path': `url(#${clipId})` }, ga);
      D.areas.forEach((a, i) => {
        const d = path(a.g); if (!d) return;
        let fill = a.c, fo = .8, stroke = a.c, sw = 1.2, dash = null;
        if (a.st === 'light') fo = .42;
        else if (a.st === 'ctx') { fo = .28; stroke = 'none'; }
        else if (a.st === 'hatch' || a.st === 'stripes' || a.st === 'cross') { fill = pattern(a.st, a.c, a.c2); fo = 1; }
        else if (a.st === 'outline') { fill = 'none'; dash = '6 4'; sw = 2; }
        else if (a.st === 'sphere') { fill = 'none'; sw = 4.5; }
        const e = svgEl('path', { class: 'm-area' + (a.st === 'sphere' || a.st === 'outline' ? ' m-noev' : ''), d, fill, 'fill-opacity': fo, stroke, 'stroke-width': sw, 'stroke-dasharray': dash, 'stroke-opacity': a.st === 'sphere' ? .85 : null }, a.sea ? ga : gaClip);
        if (a.n) tipItems.push([e, a.n, a.note || '']);
      });
      if (D.lakes) svgEl('path', { class: 'm-lake', d: path(D.lakes) }, gz);
      if (D.rivers) svgEl('path', { class: 'm-river', d: path(D.rivers) }, gz);
      // lines
      const LS = { border: { w: 1.6, dash: '8 3 2 3' }, sphere: { w: 4.5, o: .8 }, front: { w: 3.2 }, route: { w: 1.8, dash: '6 4' }, wall: { w: 4, dash: '2 2' }, line: { w: 1.6 }, dash: { w: 2.2, dash: '7 4' } };
      for (const l of D.lines) {
        const s = LS[l.k] || LS.line;
        const ls = l.p.map(proj).filter(Boolean);
        const e = svgEl('path', { class: 'm-line', d: d3.line()(ls), stroke: l.c, 'stroke-width': l.w || s.w, 'stroke-dasharray': s.dash, 'stroke-opacity': s.o || 1 }, gz);
        if (l.n) tipItems.push([e, l.n, l.note || '']);
      }
      // arrows (paths in zoom group)
      const arrowEls = [];
      for (const a of D.arrows) {
        const ps = a.p.map(proj).filter(Boolean);
        if (ps.length < 2) continue;
        const d = d3.line().curve(d3.curveCatmullRom.alpha(0.5))(ps);
        const w = a.w || 2.6;
        const dash = a.k === 'ret' ? '9 6' : a.k === 'dot' ? '1.5 5' : null;
        const e = svgEl('path', { class: 'm-arrow', d, stroke: a.c, 'stroke-width': w, 'stroke-dasharray': dash }, gz);
        const hit = svgEl('path', { class: 'm-arrowhit', d }, gz);
        if (a.n || a.d) tipItems.push([hit, a.n || '', a.d ? a.d + (a.note ? ' · ' + a.note : '') : (a.note || '')]);
        arrowEls.push({ a, e, w });
      }

      // ---------- overlay (labels, symbols): fixed pixel size, repositioned on zoom
      const ov = svgEl('g', { class: 'ov' }, svg);
      const items = [];   // {node, x, y, rot, z}
      const nums = [];    // {name, textNodes, badge}
      let numCounter = 0;
      // m (collision meta, small maps only): {pri: 1 first … 5 last, texts: [hideable text], lg: group to move them, alt: 'p' point label (4 sides) | 'v' shift a line up/down,
      //   over: may cover symbols (big area names), icon: always-visible symbol, bx: number badge offset}
      const addItem = (node, xy, rot, z, m) => { items.push({ node, x: xy[0], y: xy[1], rot: rot || 0, z: z || 0, m: m || null }); return node; };
      function textNode(parent, str, cls, opts = {}) {
        const t = svgEl('text', { class: cls, 'text-anchor': opts.anchor || 'middle', 'dominant-baseline': opts.base || 'central', x: opts.x || 0, y: opts.y || 0, style: opts.size ? `font-size:${opts.size}px` : null }, parent);
        const lines = String(str).split('\n');
        if (lines.length === 1) t.textContent = str;
        else lines.forEach((ln, i) => { const ts = svgEl('tspan', { x: opts.x || 0, dy: i === 0 ? `${-(lines.length - 1) * 0.55}em` : '1.1em' }, t); ts.textContent = ln; });
        return t;
      }
      function badge(parent, x, y) {
        const g = svgEl('g', { class: 'nb hidden-l', transform: `translate(${x},${y})` }, parent);
        svgEl('circle', { r: 9 }, g);
        const t = svgEl('text', null, g); t.textContent = ++numCounter;
        return g;
      }
      // arrow heads + date labels
      for (const { a, e, w } of arrowEls) {
        const L = e.getTotalLength();
        if (!L) continue;
        const end = e.getPointAtLength(L), pre = e.getPointAtLength(Math.max(0, L - 3));
        const ang = Math.atan2(end.y - pre.y, end.x - pre.x) * 180 / Math.PI;
        if (a.k !== 'line') {
          const s = Math.max(1, w / 2.6);
          const g = svgEl('g', null, ov);
          svgEl('path', { d: `M${3 * s} 0 L${-9 * s} ${-5.6 * s} L${-6.4 * s} 0 L${-9 * s} ${5.6 * s} Z`, fill: a.c, stroke: '#fff', 'stroke-width': .8 }, g);
          addItem(g, [end.x, end.y], ang);
        }
        if (a.d) {
          const f = a.dp ?? 0.5;
          const m = e.getPointAtLength(L * f), m1 = e.getPointAtLength(Math.max(0, L * f - 2)), m2 = e.getPointAtLength(Math.min(L, L * f + 2));
          let ra = Math.atan2(m2.y - m1.y, m2.x - m1.x) * 180 / Math.PI;
          let side = a.ds ?? -1;
          if (ra > 90 || ra < -90) { ra += 180; side = -side; }
          const g = svgEl('g', null, ov);
          const t = textNode(g, a.d, 'l-ardate', { y: side * 9 });
          t.setAttribute('fill', a.c === '#ffffff' ? '#2a241d' : a.c);
          addItem(g, [m.x, m.y], ra, 0, { pri: 2, texts: [t] });
        }
      }
      // context labels
      if (D.ctx) for (const l of D.ctx.lbl) {
        const [en, at, txt] = l; const f = D.ctx.f.find(x => x.en === en);
        const name = txt || (f && f.n) || en; const p = proj(at); if (!p) continue;
        const g = svgEl('g', null, ov); const lg = svgEl('g', null, g); const t = textNode(lg, name, 'l-ctx'); addItem(g, p, l[3] || 0, 0, { pri: 4, texts: [t], lg, alt: 'v' });
      }
      // area labels
      D.areas.forEach(a => {
        if (!a.lbl || a.lt === false || !a.n) return;
        const p = proj(a.lbl); if (!p) return;
        const g = svgEl('g', null, ov);
        const lg = svgEl('g', null, g);
        const t = textNode(lg, a.lt || a.n, 'l-area', { size: a.ls ? 12.5 * a.ls : null });
        const cm = { pri: 1, texts: [t], lg, alt: 'v', over: true };
        addItem(g, p, a.lr || 0, 0, cm);
        if (a.num !== false) { const b = badge(g, 0, 0); cm.bx = [0, 0]; nums.push({ name: a.n, texts: [t], badge: b }); }
      });
      // free labels
      for (const l of D.labels) {
        const p = proj(l.at); if (!p) continue;
        const k = l.k || 'region';
        const g = svgEl('g', null, ov);
        const base = { sea: 15, state: 13, region: 11.5, tribe: 11.5, river: 10.5, mtn: 10.5, note: 11 }[k] || 11.5;
        const lg = svgEl('g', null, g);
        const t = textNode(lg, l.n, 'l-' + k, { size: l.s ? base * l.s : null });
        const cm = { pri: { state: 1, tribe: 3, region: 3, sea: 4, river: 5, mtn: 5, note: 5 }[k] || 3, texts: [t], lg, alt: 'v', over: k === 'state' };
        addItem(g, p, l.r || 0, l.z, cm);
        const numable = l.num ?? (k === 'state' || k === 'tribe' || k === 'region');
        if (numable) { const b = badge(g, 0, 0); cm.bx = [0, 0]; nums.push({ name: l.n.replace(/\n/g, ' '), texts: [t], badge: b }); }
      }
      // points
      const LP = { r: [9, 0, 'start'], l: [-9, 0, 'end'], t: [0, -12, 'middle'], b: [0, 13, 'middle'], tr: [7, -9, 'start'], tl: [-7, -9, 'end'], br: [7, 10, 'start'], bl: [-7, 10, 'end'] };
      for (const pt of D.pts) {
        const p = proj(pt.at); if (!p) continue;
        const g = svgEl('g', { class: 'pt' }, ov);
        const ic = svgEl('g', null, g); ic.innerHTML = iconSVG(pt.k || 'city', pt.c);
        const lp = Array.isArray(pt.lp) ? [pt.lp[0], pt.lp[1], pt.lp[0] < 0 ? 'end' : pt.lp[0] > 0 ? 'start' : 'middle'] : (LP[pt.lp || 'r'] || LP.r);
        const big = pt.k === 'battle' || pt.k === 'flag' || pt.k === 'camp' || pt.k === 'treaty' || pt.k === 'fire' || pt.k === 'star';
        const dx = lp[0] + (big && lp[0] ? Math.sign(lp[0]) * 3 : 0);
        const texts = [], lg = svgEl('g', null, g);
        if (pt.n) texts.push(textNode(lg, pt.n, pt.k === 'cap' ? 'l-cap' : 'l-pt', { x: dx, y: lp[1], anchor: lp[2] }));
        if (pt.d) {
          const dy = lp[1] + (pt.n ? (lp[1] < 0 ? -13 : 13) : 0);
          const t = textNode(lg, pt.d, 'l-date', { x: dx, y: pt.n ? dy : lp[1], anchor: lp[2] }); t.setAttribute('fill', '#b3261e'); texts.push(t);
        }
        const cm = { pri: pt.k === 'cap' ? 1.5 : (big || pt.d) ? 2 : 3, texts, icon: ic, lg, alt: 'p' };
        addItem(g, p, 0, pt.z, cm);
        tipItems.push([g, pt.n || '', [pt.d, pt.note].filter(Boolean).join(' · ')]);
        if (pt.n && pt.num !== false) { const bx = dx + (lp[2] === 'end' ? -8 : lp[2] === 'start' ? 8 : 0); const b = badge(g, bx, lp[1]); cm.bx = [bx, lp[1]]; nums.push({ name: pt.n + (pt.d ? ' (' + pt.d + ')' : ''), texts: texts.slice(0, 1), badge: b }); }
      }

      // ---------- declutter (small screens): hide labels that would overlap, most important first; zooming in brings them back.
      // Symbols always stay; a hidden name is still shown by tapping the symbol.
      let toolsBox = null;
      const order = items.filter(it => it.m).map((it, i) => { it.i = i; return it; }).sort((a, b) => a.m.pri - b.m.pri || a.i - b.i);
      const rbox = (b, rot, pad) => {
        if (!rot) return [b.x - pad, b.y - pad, b.x + b.width + pad, b.y + b.height + pad];
        const r = rot * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), X = [], Y = [];
        for (const [x, y] of [[b.x, b.y], [b.x + b.width, b.y], [b.x, b.y + b.height], [b.x + b.width, b.y + b.height]]) { X.push(x * c - y * s); Y.push(x * s + y * c); }
        return [Math.min(...X) - pad, Math.min(...Y) - pad, Math.max(...X) + pad, Math.max(...Y) + pad];
      };
      const bbox = el => { try { const b = el.getBBox(); return b && b.width ? b : null; } catch (e) { return null; } };
      function measure() {
        if (!declutterOn) return;
        for (const it of order) {
          const m = it.m;
          m.tb = m.texts.map((t, k) => { const b = bbox(t); return b ? rbox(b, it.rot, 1.5) : (m.tb && m.tb[k]) || null; });
          if (m.icon) { const b = bbox(m.icon); if (b) m.ib = rbox(b, 0, 0.5); }
        }
      }
      const hit = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
      // a label may graze a symbol, but not hide more than a third of it
      const covers = (o, q) => { const w = Math.min(o[2], q[2]) - Math.max(o[0], q[0]), h = Math.min(o[3], q[3]) - Math.max(o[1], q[1]); return w > 0 && h > 0 && w * h > 0.33 * (o[2] - o[0]) * (o[3] - o[1]); };
      function declutter() {
        if (!declutterOn) return;
        const placed = [], obst = [];
        if (toolsBox) placed.push(toolsBox);   // nothing under the map buttons
        for (const it of order) {
          const m = it.m;
          it.vis = !(it.z && T.k < it.z);
          if (!it.vis) continue;
          const ox = T.applyX(it.x), oy = T.applyY(it.y);
          if (m.ib) obst.push([ox + m.ib[0], oy + m.ib[1], ox + m.ib[2], oy + m.ib[3], it]);
          if (m.bx && mode.nums) obst.push([ox + m.bx[0] - 9, oy + m.bx[1] - 9, ox + m.bx[0] + 9, oy + m.bx[1] + 9, it]);
        }
        for (const it of order) {
          const m = it.m;
          if (!it.vis || !m.tb) continue;
          let b = null;
          m.texts.forEach((t, k) => { const q = m.tb[k]; if (!q || t.classList.contains('hidden-l')) return; b = b ? [Math.min(b[0], q[0]), Math.min(b[1], q[1]), Math.max(b[2], q[2]), Math.max(b[3], q[3])] : q.slice(); });
          let hide = false, sx = 0, sy = 0;
          if (b) {
            const ox = T.applyX(it.x), oy = T.applyY(it.y);
            const at = (tx, ty) => [ox + b[0] + tx, oy + b[1] + ty, ox + b[2] + tx, oy + b[3] + ty];
            const d = at(0, 0);
            if (!(d[2] < 0 || d[0] > W || d[3] < 0 || d[1] > H)) {
              // big area/state names may run over symbols; everything else must not cover a symbol
              const free = q => !placed.some(p => hit(p, q)) && !(!m.over && obst.some(o => o[4] !== it && covers(o, q)));
              // point labels (not in numbers mode, where badges sit at the usual spot): usual side, other side, above, below;
              // straight area/region names: one line up or down
              const w = b[2] - b[0], h = b[3] - b[1];
              let cands = [[0, 0]];
              if (m.alt === 'p' && !mode.nums) {
                // the author's spot, then right, left, below, above and the four corners around the symbol
                const ib = m.ib || [-4, -4, 4, 4], icx = (ib[0] + ib[2]) / 2, icy = (ib[1] + ib[3]) / 2;
                for (const [x0, y0] of [[ib[2] + 2, icy - h / 2], [ib[0] - 2 - w, icy - h / 2], [icx - w / 2, ib[3]], [icx - w / 2, ib[1] - h],
                  [ib[2] - 2, ib[1] - h + 3], [ib[2] - 2, ib[3] - 3], [ib[0] + 2 - w, ib[1] - h + 3], [ib[0] + 2 - w, ib[3] - 3]]) cands.push([x0 - b[0], y0 - b[1]]);
              } else if (m.alt === 'v' && !it.rot) cands = [[0, 0], [0, -h - 2], [0, h + 2]];
              hide = true;
              let cut = null;   // usual spot is free but runs off the map edge: use it only if no other spot fits
              for (let c = 0; c < cands.length; c++) {
                const [tx, ty] = cands[c];
                if (c && Math.abs(tx) < 2 && Math.abs(ty) < 2) continue;
                const q = at(tx, ty);
                if (!free(q)) continue;
                if (q[0] < 0 || q[2] > W || q[1] < 0 || q[3] > H) { if (!c) cut = q; continue; }
                hide = false; sx = tx; sy = ty; placed.push(q); break;
              }
              if (hide && cut) { hide = false; placed.push(cut); }
            }
          }
          if (m.lg && (sx !== (m.sx || 0) || sy !== (m.sy || 0))) { m.sx = sx; m.sy = sy; if (sx || sy) m.lg.setAttribute('transform', `translate(${sx.toFixed(1)},${sy.toFixed(1)})`); else m.lg.removeAttribute('transform'); }
          if (hide !== !!m.hid) { m.hid = hide; m.texts.forEach(t => t.classList.toggle('cx', hide)); }
        }
      }

      // ---------- zoom ----------
      let T = d3.zoomIdentity;
      function place() {
        for (const it of items) {
          const x = T.applyX(it.x), y = T.applyY(it.y);
          it.node.setAttribute('transform', `translate(${x.toFixed(1)},${y.toFixed(1)})${it.rot ? ` rotate(${it.rot.toFixed(1)})` : ''}`);
          if (it.z) it.node.style.display = T.k >= it.z ? '' : 'none';
        }
        declutter();
      }
      const zoom = d3.zoom().scaleExtent([1, 12]).translateExtent([[0, 0], [W, H]]).extent([[0, 0], [W, H]])
        .filter(ev => {
          if (ev.type === 'wheel') return ev.ctrlKey || ev.metaKey || stage.classList.contains('active') || fs;
          // in the page: one finger scrolls the page, two fingers zoom the map (cooperative gestures); full screen: any touch
          if (ev.type === 'touchstart') return fs || (ev.touches && ev.touches.length > 1) || T.k > 1.01;
          return !ev.button;
        })
        .on('zoom', ev => {
          T = ev.transform; gz.setAttribute('transform', T.toString()); place(); stage.classList.toggle('zoomed', T.k > 1.01);
          if (lastPT !== 'mouse') tip.hidden = true;
          if (COARSE.matches && T.k > 1.01 && !hint.hidden) { hint.hidden = true; hintSeen = true; }
        });
      d3.select(svg).call(zoom).on('dblclick.zoom', null);
      svg.addEventListener('click', () => {
        if (lastPT !== 'mouse') { tip.hidden = true; return; }
        stage.classList.add('active'); hint.textContent = 'ბორბლით მასშტაბი, გადაადგილება მაუსით';
      });
      measure();
      place();
      if (declutterOn && document.fonts && document.fonts.status !== 'loaded') document.fonts.ready.then(() => { if (svg.isConnected) { measure(); place(); } });

      // tooltip: follows the mouse; on touch screens a tap on a symbol, area or arrow opens it (tap elsewhere closes)
      const tip = document.createElement('div'); tip.className = 'tip'; tip.hidden = true; stage.appendChild(tip);
      const showTip = (title, sub) => { tip.innerHTML = `<b>${esc(title)}</b>${sub ? `<span>${esc(sub)}</span>` : ''}`; tip.hidden = false; };
      for (const [node, title, sub] of tipItems) {
        node.addEventListener('pointerenter', ev => { if (ev.pointerType !== 'mouse' || mode.nums || (!title && !sub)) return; showTip(title, sub); });
        node.addEventListener('pointermove', ev => { if (ev.pointerType !== 'mouse') return; const r = stage.getBoundingClientRect(); let x = ev.clientX - r.left + 14, y = ev.clientY - r.top + 14; if (x + 290 > r.width) x = Math.max(4, ev.clientX - r.left - 14 - Math.min(280, tip.offsetWidth)); if (y + tip.offsetHeight + 6 > r.height) y = ev.clientY - r.top - tip.offsetHeight - 10; tip.style.left = x + 'px'; tip.style.top = y + 'px'; });
        node.addEventListener('pointerleave', ev => { if (ev.pointerType === 'mouse') tip.hidden = true; });
        node.addEventListener('click', ev => {
          if (lastPT === 'mouse' || mode.nums || (!title && !sub)) return;
          ev.stopPropagation();
          showTip(title, sub);
          const r = stage.getBoundingClientRect(), tw = tip.offsetWidth, th = tip.offsetHeight;
          let x = ev.clientX - r.left - tw / 2, y = ev.clientY - r.top - th - 16;   // above the finger
          x = Math.max(6, Math.min(r.width - tw - 6, x));
          if (y < 6) y = Math.max(6, Math.min(r.height - th - 6, ev.clientY - r.top + 22));
          tip.style.left = x + 'px'; tip.style.top = y + 'px';
          if (!hint.hidden) { hint.hidden = true; hintSeen = true; }
        });
      }

      // tools
      const tools = document.createElement('div'); tools.className = 'tools';
      const fullIcon = !fs ? '<path d="M2.5 6V2.5H6M10 2.5h3.5V6M13.5 10v3.5H10M6 13.5H2.5V10"/>'
        : pseudo ? '<path d="M3.5 3.5l9 9M12.5 3.5l-9 9"/>' : '<path d="M6 2.5V6H2.5M10 2.5V6h3.5M13.5 10H10v3.5M2.5 10H6v3.5"/>';
      const fullTitle = fs ? 'დახურვა' : 'მთელ ეკრანზე';
      tools.innerHTML = `
        <button data-t="in" title="გადიდება" aria-label="გადიდება"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M8 3v10M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        <button data-t="out" title="დაპატარავება" aria-label="დაპატარავება"><svg width="16" height="16" viewBox="0 0 16 16"><path d="M3 8h10" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg></button>
        <button data-t="reset" title="საწყისი ხედი" aria-label="საწყისი ხედი"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="M2.5 8a5.5 5.5 0 1 0 1.8-4.1"/><path d="M2.5 2.5v3h3"/></svg></button>
        <button data-t="nums" title="ციფრების რეჟიმი: სახელების დამალვა" aria-label="ციფრების რეჟიმი"><svg width="18" height="18" viewBox="0 0 18 18"><circle cx="9" cy="9" r="7.4" fill="none" stroke="currentColor" stroke-width="1.6"/><text x="9" y="9.5" text-anchor="middle" dominant-baseline="central" font-size="9" font-weight="700" fill="currentColor" font-family="system-ui, sans-serif">12</text></svg></button>
        <button data-t="full" title="${fullTitle}" aria-label="${fullTitle}"><svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round">${fullIcon}</svg></button>`;
      stage.appendChild(tools);
      if (tools.offsetTop + tools.offsetHeight + 6 > stage.clientHeight) tools.classList.add('row');   // very wide map on a phone: buttons in a row
      if (declutterOn) { const tr = tools.getBoundingClientRect(), sr = svg.getBoundingClientRect(), k = sr.width ? W / sr.width : 1; toolsBox = [(tr.left - sr.left - 8) * k, (tr.top - sr.top - 4) * k, (tr.right - sr.left) * k, (tr.bottom - sr.top + 4) * k]; }
      const hint = document.createElement('div'); hint.className = 'hint';
      const turn = fs && COARSE.matches && lastH > lastW * 1.2 && nat < 0.8;   // wide map on an upright phone
      hint.textContent = turn ? 'მოაბრუნე ტელეფონი, რომ რუკა გადიდდეს' : COARSE.matches ? 'ორი თითით გაადიდე · დააჭირე ნიშანს' : 'დააჭირე რუკას, მერე გაადიდე ბორბლით ან ღილაკებით';
      hint.hidden = COARSE.matches && hintSeen && !turn;
      stage.appendChild(hint);
      if (toolsBox) place();
      tools.addEventListener('click', ev => {
        const b = ev.target.closest('button'); if (!b) return; ev.stopPropagation();
        const t = b.dataset.t;
        if (t === 'in') d3.select(svg).transition().duration(250).call(zoom.scaleBy, 1.6);
        else if (t === 'out') d3.select(svg).transition().duration(250).call(zoom.scaleBy, 1 / 1.6);
        else if (t === 'reset') d3.select(svg).transition().duration(300).call(zoom.transform, d3.zoomIdentity);
        else if (t === 'nums') setNums(!mode.nums);
        else if (t === 'full') toggleFs();
      });

      function setNums(on) {
        mode.nums = on;
        tools.querySelector('[data-t="nums"]').classList.toggle('on', on);
        for (const n of nums) { n.texts.forEach(t => t.classList.toggle('hidden-l', on)); n.badge.classList.toggle('hidden-l', !on); }
        const panel = document.getElementById('numpanel'), key = document.getElementById('numkey');
        if (panel && key) {
          // one-column layout: the key goes right under the map (not below the legend and the texts)
          const side = document.getElementById('side');
          if (on && legendHost && mq('(max-width: 1080px)').matches) { if (panel.nextElementSibling !== legendHost) legendHost.before(panel); }
          else if (side && panel.parentNode !== side) side.appendChild(panel);
          panel.hidden = !on;
          key.innerHTML = nums.map((n, i) => `<li><span class="nb">${i + 1}</span><button data-name="${esc(n.name)}">?</button></li>`).join('');
          key.querySelectorAll('button').forEach(b => b.addEventListener('click', () => { b.textContent = b.dataset.name; b.classList.add('shown'); }));
        }
        tip.hidden = true;
        place();
      }
      ctl = { setNums, get nums() { return mode.nums; } };
      if (mode.nums) setNums(true);
    }

    // legend
    function legend() {
      if (!legendHost) return;
      const rows = [];
      const sw = inner => `<svg width="30" height="18" viewBox="0 0 30 18" aria-hidden="true">${inner}</svg>`;
      for (const a of D.areas) {
        if (a.leg === false || !a.n) continue;
        const label = a.leg || a.n;
        let inner;
        if (a.st === 'hatch') inner = `<rect x="2" y="2" width="26" height="14" rx="2" fill="#fff" stroke="${a.c}"/>` + [0, 6, 12, 18, 24].map(x => `<path d="M${x + 2} 16L${x + 9} 2" stroke="${a.c}" stroke-width="2.4"/>`).join('');
        else if (a.st === 'stripes') inner = `<rect x="2" y="2" width="26" height="14" rx="2" fill="${a.c2 || '#fff'}" stroke="${a.c}"/>` + [0, 6, 12, 18, 24].map(x => `<path d="M${x + 2} 16L${x + 9} 2" stroke="${a.c}" stroke-width="3"/>`).join('');
        else if (a.st === 'sphere') inner = `<path d="M2 9H28" stroke="${a.c}" stroke-width="4.5" stroke-opacity=".85"/>`;
        else if (a.st === 'outline') inner = `<rect x="3" y="3" width="24" height="12" rx="2" fill="none" stroke="${a.c}" stroke-width="2" stroke-dasharray="5 3"/>`;
        else inner = `<rect x="2" y="2" width="26" height="14" rx="2" fill="${a.c}" fill-opacity="${a.st === 'light' ? .42 : a.st === 'ctx' ? .3 : .8}" stroke="${a.c}"/>`;
        if (!rows.some(r => r.label === label)) rows.push({ label, html: sw(inner) });
      }
      const seen = new Set();
      for (const a of D.arrows) {
        const key = a.c + (a.k || '') + (a.lg || '');
        if (seen.has(key) || !a.lg) continue; seen.add(key);
        const dash = a.k === 'ret' ? 'stroke-dasharray="5 3"' : a.k === 'dot' ? 'stroke-dasharray="1.5 3"' : '';
        rows.push({ label: a.lg, html: sw(`<path d="M2 9H22" stroke="${a.c}" stroke-width="2.6" ${dash}/><path d="M28 9L19 4L21 9L19 14Z" fill="${a.c}"/>`) });
      }
      const LS = { border: 'stroke-dasharray="6 2 2 2" stroke-width="1.6"', sphere: 'stroke-width="4.5" stroke-opacity=".8"', front: 'stroke-width="3.2"', route: 'stroke-dasharray="5 3" stroke-width="1.8"', wall: 'stroke-dasharray="2 2" stroke-width="4"', line: 'stroke-width="1.6"', dash: 'stroke-dasharray="6 3" stroke-width="2.2"' };
      for (const l of D.lines) {
        if (!l.lg || seen.has('l' + l.lg)) continue; seen.add('l' + l.lg);
        rows.push({ label: l.lg, html: sw(`<path d="M2 9H28" stroke="${l.c}" fill="none" ${LS[l.k] || LS.line}/>`) });
      }
      const kinds = [];
      for (const p of D.pts) { const k = p.k || 'city'; if (!kinds.includes(k)) kinds.push(k); }
      const kn = Object.assign({}, KIND_NAMES, D.kindNames || {});
      for (const k of kinds) rows.push({ label: kn[k] || k, html: `<svg width="30" height="18" viewBox="-15 -9 30 18" aria-hidden="true">${iconSVG(k)}</svg>` });
      if (D.pts.some(p => p.d) || D.arrows.some(a => a.d)) rows.push({ label: 'თარიღი (წელი)', html: sw(`<text x="15" y="13" text-anchor="middle" font-size="11" font-weight="700" fill="#b3261e" font-family="system-ui,sans-serif">1210</text>`) });
      legendHost.innerHTML = rows.length ? `<h4>რუკის პირობითი აღნიშვნები</h4><ul>${rows.map(r => `<li>${r.html}<span>${esc(r.label)}</span></li>`).join('')}</ul>` : '';
    }

    // full screen: the native API where it works (desktop), otherwise a fixed overlay (iPhone has no element
    // fullscreen; inside frames it is often blocked). The overlay adds a history entry so the phone's Back button closes it.
    function toggleFs() {
      if (pseudo) return closePseudo();
      if (document.fullscreenElement) { const p = document.exitFullscreen(); if (p && p.catch) p.catch(() => { }); return; }
      if (!COARSE.matches && document.fullscreenEnabled && stage.requestFullscreen) { const p = stage.requestFullscreen(); if (p && p.catch) p.catch(openPseudo); return; }
      openPseudo();
    }
    function openPseudo() {
      if (pseudo || !stage.isConnected) return;
      pseudo = true; stage.classList.add('fs'); document.documentElement.classList.add('fs-lock');
      try { history.pushState({ hfs: 1 }, ''); pushed = true; } catch (e) { pushed = false; }
      build();
    }
    function closePseudo(fromPop) {
      if (!pseudo) return;
      pseudo = false; stage.classList.remove('fs'); document.documentElement.classList.remove('fs-lock');
      if (pushed && !fromPop) { try { history.back(); } catch (e) { /* ignore */ } }
      pushed = false;
      build();
    }
    const onPop = () => { if (!stage.isConnected) { window.removeEventListener('popstate', onPop); return; } if (pseudo) closePseudo(true); };
    const onKey = e => { if (!stage.isConnected) { document.removeEventListener('keydown', onKey); return; } if (e.key === 'Escape' && pseudo) closePseudo(); };
    window.addEventListener('popstate', onPop);
    document.addEventListener('keydown', onKey);

    build();
    legend();
    let to = null;
    const onResize = () => {
      clearTimeout(to);
      to = setTimeout(() => {
        if (!stage.isConnected) { window.removeEventListener('resize', onResize); return; }
        const w = stage.clientWidth, h = stage.clientHeight;
        if (Math.abs(w - lastW) > 40 || (isFs() && Math.abs(h - lastH) > 60)) build();
      }, 200);
    };
    window.addEventListener('resize', onResize);
    document.addEventListener('fullscreenchange', () => { if (stage.isConnected) setTimeout(build, 60); });
    return { setNums: v => ctl.setNums && ctl.setNums(v) };
  }

  route();
})();
