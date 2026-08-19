/* ============================================================
   AIGEN SOLUTIONS, Application shared logic
   ============================================================ */
(function () {
  'use strict';

  // Traduction : t('clé', 'texte français source') — voir js/i18n.js
  function T(k, fr) { return (window.AIGENI18N ? window.AIGENI18N.t(k, fr) : fr); }

  var PAGES = [
    { href: 'solutions.html', label: function () { return T('nav.solutions', 'Solutions'); }, key: 'solutions' },
    { href: 'realisations.html', label: function () { return T('nav.realisations', 'Réalisations'); }, key: 'realisations' },
    { href: 'technologies.html', label: function () { return T('nav.technologies', 'Comprendre l\'IA'); }, key: 'technologies' },
    { href: 'approche.html', label: function () { return T('nav.approche', 'Approche'); }, key: 'approche' },
    { href: 'faq.html', label: function () { return T('nav.faq', 'FAQ'); }, key: 'faq' }
  ];

  /* ---------- THEME ---------- */
  function initTheme() {
    var stored = null;
    try { stored = localStorage.getItem('aigen-theme'); } catch (e) {}
    var theme = stored || 'dark';
    document.documentElement.setAttribute('data-theme', theme);
  }
  function toggleTheme() {
    var cur = document.documentElement.getAttribute('data-theme');
    var next = cur === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem('aigen-theme', next); } catch (e) {}
  }
  initTheme(); // run ASAP to avoid flash

  /* ---------- HEADER ---------- */
  function buildHeader() {
    var current = document.body.getAttribute('data-page') || '';
    var links = PAGES.map(function (p) {
      var active = p.key === current ? ' active' : '';
      return '<a class="lnk' + active + '" href="' + p.href + '">' + p.label() + '</a>';
    }).join('');
    var curLang = (window.AIGENI18N && window.AIGENI18N.lang) || 'fr';
    var langSel =
      '<div class="lang-switch"><select data-lang-switch aria-label="' + T('lang.aria', 'Choisir la langue') + '">' +
        ['fr', 'en', 'ar'].map(function (l) {
          var names = { fr: 'FR', en: 'EN', ar: 'ع' };
          return '<option value="' + l + '"' + (l === curLang ? ' selected' : '') + '>' + names[l] + '</option>';
        }).join('') +
      '</select></div>';
    var html =
      '<div class="container"><div class="bar">' +
        '<a href="index.html" class="brand" aria-label="AIGEN Solutions">' + window.AIGENLogo.brandLockup({ size: 40, tag: false }) + '</a>' +
        '<nav class="nav" data-nav>' + links +
          '<a href="contact.html" class="btn btn-primary nav-cta">' + T('nav.cta', 'Démarrer un projet') + '</a>' +
        '</nav>' +
        '<div class="nav-tools">' + langSel +
          '<button class="theme-toggle" data-theme-toggle aria-label="' + T('theme.aria', 'Changer de thème') + '">' +
            '<svg class="ic-moon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>' +
            '<svg class="ic-sun" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.2" y1="4.2" x2="5.6" y2="5.6"/><line x1="18.4" y1="18.4" x2="19.8" y2="19.8"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.2" y1="19.8" x2="5.6" y2="18.4"/><line x1="18.4" y1="5.6" x2="19.8" y2="4.2"/></svg>' +
          '</button>' +
          '<button class="menu-toggle" data-menu-toggle aria-label="Menu"><span></span><span></span><span></span></button>' +
        '</div>' +
      '</div></div>';
    var header = document.querySelector('[data-header]');
    if (header) header.innerHTML = html;
  }

  /* ---------- FOOTER ---------- */
  function buildFooter() {
    var y = new Date().getFullYear();
    var html =
      '<div class="container">' +
        '<div class="footer-top">' +
          '<div class="footer-brand">' +
            '<a href="index.html" class="brand" aria-label="AIGEN Solutions">' + window.AIGENLogo.brandLockup({ size: 42, tag: false }) + '</a>' +
            '<p class="footer-slogan">' + T('brand.slogan', 'Imaginer&nbsp;·&nbsp;Concevoir&nbsp;·&nbsp;Libérer') + '</p>' +
            '<p>' + T('footer.desc', 'Nous concevons des outils d\'intelligence artificielle sur-mesure pour les entreprises qui veulent automatiser le concret.') + '</p>' +
            '<div class="footer-social">' +
              '<a href="mailto:contact@aigen-solutions.fr" aria-label="Email"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><polyline points="22,6 12,13 2,6"/></svg></a>' +
              '<a href="https://www.linkedin.com/company/ai-gensolutions" target="_blank" rel="noopener" aria-label="LinkedIn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4V8h4v1.5A6 6 0 0 1 16 8z"/><rect x="2" y="9" width="4" height="12"/><circle cx="4" cy="4" r="2"/></svg></a>' +
            '</div>' +
          '</div>' +
          '<div class="footer-col"><h4>' + T('footer.h.solutions', 'Solutions') + '</h4>' +
            '<a href="solutions.html">' + T('footer.l.apps', 'Applications métier') + '</a>' +
            '<a href="solutions.html">' + T('footer.l.agents', 'Agents IA &amp; automatisation') + '</a>' +
            '<a href="solutions.html">' + T('footer.l.extract', 'Extraction de données') + '</a>' +
            '<a href="solutions.html">' + T('footer.l.regulated', 'Secteurs réglementés') + '</a>' +
          '</div>' +
          '<div class="footer-col"><h4>' + T('footer.h.company', 'Société') + '</h4>' +
            '<a href="approche.html">' + T('footer.l.approach', 'Notre approche') + '</a>' +
            '<a href="realisations.html">' + T('nav.realisations', 'Réalisations') + '</a>' +
            '<a href="technologies.html">' + T('nav.technologies', 'Comprendre l\'IA') + '</a>' +
            '<a href="faq.html">' + T('nav.faq', 'FAQ') + '</a>' +
            '<a href="contact.html">' + T('footer.l.contact', 'Contact') + '</a>' +
          '</div>' +
          '<div class="footer-col"><h4>' + T('footer.h.start', 'Démarrer') + '</h4>' +
            '<a href="contact.html">' + T('footer.l.audit', 'Audit gratuit') + '</a>' +
            '<a href="contact.html">' + T('footer.l.describe', 'Décrire mon besoin') + '</a>' +
            '<a href="mailto:contact@aigen-solutions.fr">contact@aigen-solutions.fr</a>' +
          '</div>' +
        '</div>' +
        '<div class="footer-bottom">' +
          '<span>© ' + y + ' AIGEN Solutions, ' + T('footer.rights', 'Tous droits réservés.') + '</span>' +
          '<span style="display:flex;gap:22px"><a href="mentions-legales.html">' + T('footer.l.legal', 'Mentions légales') + '</a><a href="confidentialite.html">' + T('footer.l.privacy', 'Confidentialité') + '</a></span>' +
        '</div>' +
      '</div>';
    var footer = document.querySelector('[data-footer]');
    if (footer) footer.innerHTML = html;
  }

  /* ---------- Header scroll + interactions ---------- */
  function wireHeader() {
    var header = document.querySelector('.site-header');
    if (header) {
      // En mode scènes la fenêtre ne défile pas : le défilement a lieu dans .scene-inner.
      // On écoute donc aussi les conteneurs internes (phase de capture), sans quoi le
      // header resterait à l'état « haut de page » pendant que le contenu passe derrière.
      var onScroll = function () {
        var y = window.scrollY || (document.scrollingElement && document.scrollingElement.scrollTop) || 0;
        if (!y) {
          var inner = document.querySelector('.scene.is-active .scene-inner');
          if (inner) y = inner.scrollTop;
        }
        header.classList.toggle('scrolled', y > 24);
      };
      onScroll();
      window.addEventListener('scroll', onScroll, { passive: true });
      document.addEventListener('scroll', onScroll, { passive: true, capture: true });

      // La hauteur réelle du header (1 ligne, 2 lignes, arabe plus haut…) est publiée en
      // variable CSS : les pages s'en servent pour réserver la place au bon endroit.
      var syncHeight = function () {
        document.documentElement.style.setProperty(
          '--header-h', Math.round(header.getBoundingClientRect().height) + 'px');
      };
      syncHeight();
      window.addEventListener('resize', syncHeight);
      if (window.ResizeObserver) new ResizeObserver(syncHeight).observe(header);
    }
    var tt = document.querySelector('[data-theme-toggle]');
    if (tt) tt.addEventListener('click', toggleTheme);
    var ls = document.querySelector('[data-lang-switch]');
    if (ls) ls.addEventListener('change', function () { if (window.AIGENI18N) window.AIGENI18N.setLang(ls.value); });
    var mt = document.querySelector('[data-menu-toggle]');
    var nav = document.querySelector('[data-nav]');
    if (mt && nav) {
      mt.addEventListener('click', function () { nav.classList.toggle('open'); mt.classList.toggle('active'); });
      nav.querySelectorAll('a').forEach(function (a) {
        a.addEventListener('click', function () { nav.classList.remove('open'); mt.classList.remove('active'); });
      });
    }
  }

  /* ---------- Smooth anchor scroll ---------- */
  function smoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(function (a) {
      a.addEventListener('click', function (e) {
        var href = a.getAttribute('href');
        if (href === '#' || href.length < 2) return;
        var t = document.querySelector(href);
        if (!t) return;
        e.preventDefault();
        var header = document.querySelector('.site-header');
        var off = header ? header.offsetHeight + 14 : 0;
        window.scrollTo({ top: t.getBoundingClientRect().top + window.scrollY - off, behavior: 'smooth' });
      });
    });
  }

  /* ---------- Reveal ---------- */
  function reveal() {
    if (document.body.classList.contains('scenes-mode')) return; // accueil cinématique : géré par cinematic.js
    var els = document.querySelectorAll('.reveal');
    if (!('IntersectionObserver' in window) || !els.length) {
      els.forEach(function (el) { el.classList.add('in'); }); return;
    }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          var el = en.target, d = parseInt(el.getAttribute('data-delay') || '0', 10);
          setTimeout(function () { el.classList.add('in'); }, d);
          io.unobserve(el);
        }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -7% 0px' });
    var vh = window.innerHeight || 800;
    els.forEach(function (el) {
      // Reveal immediately anything already in the first viewport (no wait, no blank first screen)
      if (el.getBoundingClientRect().top < vh * 0.92) { el.classList.add('in'); }
      else { io.observe(el); }
    });
    setTimeout(function () { document.querySelectorAll('.reveal:not(.in)').forEach(function (el) { el.classList.add('in'); }); }, 2600);
  }

  /* ---------- Case filter ---------- */
  function caseFilter() {
    var btns = document.querySelectorAll('[data-filter]');
    var items = document.querySelectorAll('[data-cat]');
    if (!btns.length) return;
    btns.forEach(function (b) {
      b.addEventListener('click', function () {
        btns.forEach(function (x) { x.classList.remove('active'); });
        b.classList.add('active');
        var f = b.getAttribute('data-filter');
        items.forEach(function (it) {
          var show = f === 'all' || it.getAttribute('data-cat').indexOf(f) > -1;
          it.style.display = show ? '' : 'none';
        });
      });
    });
  }

  /* ---------- FAQ ---------- */
  function faq() {
    document.querySelectorAll('.faq-item').forEach(function (item) {
      var q = item.querySelector('.faq-q');
      var a = item.querySelector('.faq-a');
      if (!q || !a) return;
      q.setAttribute('role', 'button');
      q.setAttribute('tabindex', '0');
      q.setAttribute('aria-expanded', 'false');
      var toggle = function () {
        var open = item.classList.contains('open');
        item.classList.toggle('open');
        a.style.maxHeight = open ? '0' : a.scrollHeight + 'px';
        q.setAttribute('aria-expanded', open ? 'false' : 'true');
      };
      q.addEventListener('click', toggle);
      q.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    });
  }

  /* ---------- Magnetic ---------- */
  function magnetic() {
    if (window.matchMedia('(hover: none)').matches) return;
    document.querySelectorAll('.magnetic').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        el.style.transform = 'translate(' + (e.clientX - r.left - r.width / 2) * 0.18 + 'px,' + (e.clientY - r.top - r.height / 2) * 0.3 + 'px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------- Tilt ---------- */
  function tilt() {
    if (window.matchMedia('(hover: none)').matches) return;
    document.querySelectorAll('[data-tilt]').forEach(function (el) {
      el.addEventListener('mousemove', function (e) {
        var r = el.getBoundingClientRect();
        var px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transform = 'perspective(900px) rotateX(' + (-py * 4) + 'deg) rotateY(' + (px * 5) + 'deg) translateY(-6px)';
      });
      el.addEventListener('mouseleave', function () { el.style.transform = ''; });
    });
  }

  /* ---------- Lightbox gallery ---------- */
  function lightbox() {
    var triggers = document.querySelectorAll('[data-gallery]');
    if (!triggers.length) return;
    var lb = document.createElement('div');
    lb.className = 'lightbox';
    lb.innerHTML =
      '<button class="lb-close" aria-label="Fermer"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>' +
      '<button class="lb-nav lb-prev" aria-label="Précédent"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg></button>' +
      '<img alt="">' +
      '<button class="lb-nav lb-next" aria-label="Suivant"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg></button>' +
      '<div class="lb-counter"></div>';
    document.body.appendChild(lb);
    var img = lb.querySelector('img'), counter = lb.querySelector('.lb-counter');
    var list = [], idx = 0;
    function show(i) {
      idx = (i + list.length) % list.length;
      img.src = list[idx];
      counter.textContent = (idx + 1) + ' / ' + list.length;
    }
    function open(arr, start) {
      list = arr; lb.classList.add('open'); document.body.style.overflow = 'hidden'; show(start || 0);
    }
    function close() { lb.classList.remove('open'); document.body.style.overflow = ''; }
    triggers.forEach(function (t) {
      t.addEventListener('click', function () {
        var arr = (t.getAttribute('data-gallery') || '').split('|').filter(Boolean);
        if (!arr.length) return;
        open(arr, 0);
      });
    });
    lb.querySelector('.lb-close').addEventListener('click', close);
    lb.querySelector('.lb-prev').addEventListener('click', function (e) { e.stopPropagation(); show(idx - 1); });
    lb.querySelector('.lb-next').addEventListener('click', function (e) { e.stopPropagation(); show(idx + 1); });
    lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
    document.addEventListener('keydown', function (e) {
      if (!lb.classList.contains('open')) return;
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') show(idx - 1);
      if (e.key === 'ArrowRight') show(idx + 1);
    });
  }

  /* ---------- Contact form (Web3Forms — envoi réel) ---------- */
  function contactForm() {
    var form = document.querySelector('[data-contact]');
    if (!form) return;
    function mailtoFallback(d) {
      var body = 'Nom : ' + (d.get('name') || '') + '\n'
        + 'Email : ' + (d.get('email') || '') + '\n'
        + 'Entreprise : ' + (d.get('company') || '') + '\n'
        + 'Secteur : ' + (d.get('sector') || '') + '\n'
        + 'Besoin : ' + (d.get('topic') || '') + '\n\n'
        + (d.get('message') || '');
      window.location.href = 'mailto:contact@aigen-solutions.fr?subject='
        + encodeURIComponent('Nouvelle demande depuis le site AIGEN Solutions')
        + '&body=' + encodeURIComponent(body);
    }
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('[type="submit"]');
      var ok = form.querySelector('[data-form-ok]');
      var err = form.querySelector('[data-form-err]');
      if (ok) ok.classList.remove('show');
      if (err) err.classList.remove('show');
      var fd = new FormData(form);
      var payload = {};
      fd.forEach(function (v, k) { payload[k] = v; });
      payload.lang = (window.AIGENI18N && window.AIGENI18N.lang) || 'fr';
      if (btn) { btn.disabled = true; btn.dataset.orig = btn.textContent; btn.textContent = T('form.sending', 'Envoi en cours…'); }
      // Envoi vers le backend /lead (Railway : email client + brief Fable 5). Repli mailto en cas d'échec.
      var leadUrl = (location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'http://localhost:8787/lead' : 'https://aigen-voice-backend-production.up.railway.app/lead';
      fetch(leadUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
        .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { return { ok: r.ok, j: j }; }); })
        .then(function (o) {
          if (o.ok && o.j && o.j.success) {
            form.reset();
            if (ok) { ok.classList.add('show'); setTimeout(function () { ok.classList.remove('show'); }, 8000); }
            if (window.AIGENConsent) AIGENConsent.track('generate_lead', { method: 'formulaire' });
          } else { throw new Error('fail'); }
        })
        .catch(function () { mailtoFallback(fd); })
        .then(function () { if (btn) { btn.disabled = false; btn.textContent = btn.dataset.orig; } });
    });
  }

  /* ---------- INIT ---------- */
  function init() {
    buildHeader();
    buildFooter();
    wireHeader();
    smoothScroll();
    reveal();
    caseFilter();
    faq();
    magnetic();
    tilt();
    lightbox();
    contactForm();
    var bookBtn = document.querySelector('[data-booking]');
    if (bookBtn) bookBtn.addEventListener('click', function () { if (window.AIGENConsent) AIGENConsent.track('book_appointment'); });

    // Départs vers nos sites produits (extralys.fr, agentvox.fr) : savoir s'ils servent
    document.addEventListener('click', function (e) {
      var a = e.target && e.target.closest && e.target.closest('[data-ext-site]');
      if (a && window.AIGENConsent) AIGENConsent.track('outbound_product', { product: a.getAttribute('data-ext-site') });
    });
    if (window.AIGENFX) window.AIGENFX.start();
    if (window.AIGENHeroCore) window.AIGENHeroCore.start();

    var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Cœur de l'animation d'accueil : logo animé (figé si reduced-motion)
    var coreMark = document.querySelector('.hero-core-mark');
    if (coreMark && window.AIGENLogo) {
      coreMark.innerHTML = reduceMotion ? window.AIGENLogo.markSVG(92) : window.AIGENLogo.markAnimSVG(92);
    }

    // Boot : le logo du header s'anime une fois au chargement, puis se fige
    if (!reduceMotion && window.AIGENLogo) {
      var brand = document.querySelector('.brand');
      var staticMark = brand && brand.querySelector('.ag-mark');
      if (brand && staticMark) {
        staticMark.style.display = 'none';
        brand.insertAdjacentHTML('afterbegin', window.AIGENLogo.markAnimSVG(40, 3.6));
        var bootMark = brand.querySelector('.ag-mark');
        setTimeout(function () { if (bootMark) bootMark.remove(); staticMark.style.display = ''; }, 3800);
      }
    }
  }
  // Attendre le dictionnaire de langue (immédiat en français) avant de
  // construire header/footer, pour que la nav sorte dans la bonne langue.
  function boot() {
    if (window.AIGENI18N) window.AIGENI18N.ready(init);
    else init();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
