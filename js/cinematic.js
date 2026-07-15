/* ============================================================
   AIGEN — Moteur cinématique (accueil)
   Chaque .scene occupe le viewport. La molette / le clavier
   font DISPARAITRE la scène courante et APPARAITRE la suivante
   par dissolution (géré en CSS). Pas de défilement vertical.
   Contenu plus haut que l'écran : défilement interne d'abord,
   puis passage à la scène suivante au bord.
   Actif sur TOUS les écrans (desktop : molette/clavier ;
   mobile/tablette : balayage). Seule exception : motion
   réduite -> défilement classique (les wrappers .scene restent
   inertes car tout le style plein écran est scopé .scenes-mode).
   ============================================================ */
(function () {
  'use strict';

  var mqReduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  var mqCoarse = window.matchMedia('(pointer:coarse)');
  function forced() { try { return location.search.indexOf('cine=1') > -1; } catch (e) { return false; } }
  function eligible() { return forced() || !mqReduce.matches; }

  var sceneList = document.querySelectorAll('.scene');
  // Marquage précoce : aigen.js (reveal) se désactive, et pas d'écran noir avant init.
  if (sceneList.length >= 2 && eligible() && document.body) {
    document.body.classList.add('scenes-mode');
    sceneList[0].classList.add('is-active');
  }

  function init() {
    if (!document.body.classList.contains('scenes-mode')) return;
    var scenes = Array.prototype.slice.call(document.querySelectorAll('.scene'));
    if (scenes.length < 2) { document.body.classList.remove('scenes-mode'); return; }
    if (location.search.indexOf('flat=1') > -1) document.body.classList.add('cine-flat'); // debug : sans transition

    var idx = 0, locked = false, pending = 0;
    function pad(n) { return (n < 10 ? '0' : '') + n; }

    // Footer déplacé dans la dernière scène (sinon inaccessible : body overflow hidden).
    var footer = document.querySelector('.site-footer');
    var lastInner = scenes[scenes.length - 1].querySelector('.scene-inner');
    if (footer && lastInner) lastInner.appendChild(footer);

    // --- UI : points de navigation, compteur, indice, barre de progression
    var nav = document.createElement('nav');
    nav.className = 'scene-nav';
    nav.setAttribute('aria-label', 'Navigation par sections');
    scenes.forEach(function (s, i) {
      var label = s.getAttribute('data-label') || ('Section ' + (i + 1));
      var b = document.createElement('button');
      b.type = 'button';
      b.setAttribute('data-label', label);
      b.setAttribute('aria-label', 'Aller à : ' + label);
      b.addEventListener('click', function () { go(i); });
      nav.appendChild(b);
    });
    document.body.appendChild(nav);

    var count = document.createElement('div');
    count.className = 'scene-count';
    document.body.appendChild(count);

    var prog = document.createElement('div');
    prog.className = 'scene-prog';
    document.body.appendChild(prog);

    var hint = document.createElement('div');
    hint.className = 'scene-hint';
    hint.innerHTML = mqCoarse.matches
      ? '<span class="swipe"></span><span>Balayer</span>'
      : '<span class="wheel"></span><span>Défiler</span>';
    document.body.appendChild(hint);

    var dots = nav.querySelectorAll('button');

    function activate(i) {
      scenes.forEach(function (s, j) { s.classList.toggle('is-active', j === i); });
      // Réapparition staggerée du contenu de la scène
      var rev = scenes[i].querySelectorAll('.reveal');
      Array.prototype.forEach.call(rev, function (el, k) {
        el.classList.remove('in');
        var d = parseInt(el.getAttribute('data-delay') || '0', 10);
        if (!d) d = k * 75;
        setTimeout(function () { el.classList.add('in'); }, 130 + Math.min(d, 620));
      });
      Array.prototype.forEach.call(dots, function (b, j) {
        b.classList.toggle('on', j === i);
        b.setAttribute('aria-current', j === i ? 'true' : 'false');
      });
      count.innerHTML = '<b>' + pad(i + 1) + '</b> / ' + pad(scenes.length);
      prog.style.width = ((i) / (scenes.length - 1) * 100) + '%';
      hint.classList.toggle('gone', i > 0);
      var inner = scenes[i].querySelector('.scene-inner');
      if (inner) inner.scrollTop = 0;
    }

    function go(i) {
      if (locked || i < 0 || i >= scenes.length || i === idx) return;
      locked = true;
      var out = scenes[idx];
      out.classList.add('is-leaving');
      out.classList.remove('is-active');
      idx = i;
      activate(idx);
      setTimeout(function () {
        out.classList.remove('is-leaving'); locked = false;
        if (pending) { var p = pending; pending = 0; if (p > 0) next(); else prev(); }
      }, 720);
    }
    function next() { if (locked) { pending = 1; return; } go(idx + 1); }
    function prev() { if (locked) { pending = -1; return; } go(idx - 1); }

    // Démarrage (paramètre ?s=N pour viser une scène, utile au debug)
    var startAt = 0;
    try { var sm = location.search.match(/[?&]s=(\d+)/); if (sm) startAt = Math.max(0, Math.min(scenes.length - 1, parseInt(sm[1], 10))); } catch (e) {}
    if (startAt > 0) { scenes[0].classList.remove('is-active'); scenes[startAt].classList.add('is-active'); idx = startAt; }
    activate(startAt);

    // --- Molette : défilement interne d'abord, puis passage de scène au bord
    var acc = 0, accTs = 0;
    window.addEventListener('wheel', function (e) {
      if (e.target && e.target.closest && e.target.closest('.va-panel,.cookie-bar,.va-rdv,.va-teaser,.lightbox')) return; // laisse vivre les surcouches fixes
      var inner = scenes[idx].querySelector('.scene-inner');
      var down = e.deltaY > 0;
      if (inner && inner.scrollHeight > inner.clientHeight + 4) {
        var atTop = inner.scrollTop <= 0;
        var atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 2;
        if ((down && !atBottom) || (!down && !atTop)) return; // laisse défiler le contenu interne
      }
      e.preventDefault();
      // Normalisation du delta : souris à crans (mode lignes/pages) vs trackpad (pixels),
      // pour une réactivité identique quel que soit le périphérique.
      var dy = e.deltaY;
      if (e.deltaMode === 1) dy *= 16; else if (e.deltaMode === 2) dy *= (window.innerHeight || 800);
      if (locked) { pending = down ? 1 : -1; return; } // mémorise, déclenché en fin de transition
      var now = Date.now();
      if (now - accTs > 220) acc = 0;
      accTs = now;
      acc += dy;
      if (Math.abs(acc) < 18) return;
      acc = 0;
      if (down) next(); else prev();
    }, { passive: false });

    // --- Clavier
    window.addEventListener('keydown', function (e) {
      var tag = (e.target && e.target.tagName) || '';
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(tag) || (e.target && e.target.isContentEditable)) return;
      if (e.target && e.target.closest && e.target.closest('.va-panel')) return;
      var inner = scenes[idx].querySelector('.scene-inner');
      var k = e.key;
      if (k === 'ArrowDown' || k === 'PageDown' || k === ' ' || k === 'Spacebar') {
        if (inner && inner.scrollHeight > inner.clientHeight + 4 &&
            inner.scrollTop + inner.clientHeight < inner.scrollHeight - 2) return;
        e.preventDefault(); next();
      } else if (k === 'ArrowUp' || k === 'PageUp') {
        if (inner && inner.scrollTop > 2) return;
        e.preventDefault(); prev();
      } else if (k === 'Home') { e.preventDefault(); go(0); }
      else if (k === 'End') { e.preventDefault(); go(scenes.length - 1); }
    });

    // --- Tactile (mobile / tablette) : balayage vertical = changement de scène.
    // Défilement interne d'abord si le contenu dépasse ; on ignore les gestes
    // horizontaux (pills de nav, galeries) et ceux commencés sur une surcouche.
    var touchY = null, touchX = null, touchOk = false;
    window.addEventListener('touchstart', function (e) {
      var t = e.target;
      touchOk = !(t && t.closest && t.closest('.va-panel,.cookie-bar,.va-rdv,.va-teaser,.lightbox,.site-header,.scene-nav'));
      touchY = e.touches[0].clientY; touchX = e.touches[0].clientX;
    }, { passive: true });
    window.addEventListener('touchend', function (e) {
      if (touchY === null || !touchOk) { touchY = null; return; }
      var dy = touchY - (e.changedTouches[0].clientY);
      var dx = touchX - (e.changedTouches[0].clientX);
      touchY = null;
      if (Math.abs(dy) < 56 || Math.abs(dx) > Math.abs(dy)) return; // trop court, ou geste horizontal
      var inner = scenes[idx].querySelector('.scene-inner');
      if (inner && inner.scrollHeight > inner.clientHeight + 4) {
        var atTop = inner.scrollTop <= 0, atBottom = inner.scrollTop + inner.clientHeight >= inner.scrollHeight - 2;
        if ((dy > 0 && !atBottom) || (dy < 0 && !atTop)) return; // laisse le défilement interne vivre
      }
      if (dy > 0) next(); else prev();
    }, { passive: true });

    // --- Liens d'ancrage internes (ex : sommaire) : aller à la scène cible + défilement interne
    Array.prototype.forEach.call(document.querySelectorAll('a[href^="#"]'), function (a) {
      var href = a.getAttribute('href');
      if (!href || href.length < 2) return;
      a.addEventListener('click', function (e) {
        var target = document.querySelector(href);
        if (!target) return;
        var sc = target.closest('.scene');
        if (!sc) return;
        e.preventDefault(); e.stopPropagation();
        var ti = scenes.indexOf(sc);
        var doScroll = function () {
          var inner = sc.querySelector('.scene-inner');
          if (!inner) return;
          var top = target.getBoundingClientRect().top - inner.getBoundingClientRect().top + inner.scrollTop - 18;
          inner.scrollTo({ top: top, behavior: 'smooth' });
        };
        if (ti === idx) doScroll(); else { go(ti); setTimeout(doScroll, 760); }
      }, true);
    });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
