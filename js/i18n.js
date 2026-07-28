/* ============================================================
   AIGEN SOLUTIONS — Internationalisation (fr / en / ar)
   Le FRANÇAIS est la langue source, écrite dans le HTML.
   Ce moteur détecte la langue (?lang → localStorage → navigateur),
   charge le dictionnaire (js/lang/en.js ou ar.js) et remplace le
   contenu des éléments balisés data-i18n / data-i18n-attr.
   L'arabe passe la page en dir="rtl".
   À charger DANS <head>, AVANT les autres scripts.
   API : AIGENI18N.lang, .t(clé, replFr), .ready(cb), .setLang(l)
   ============================================================ */
(function () {
  'use strict';

  var SUPPORTED = ['fr', 'en', 'ar'];
  var KEY = 'aigen-lang';

  function normalize(code) {
    code = String(code || '').toLowerCase();
    for (var i = 0; i < SUPPORTED.length; i++) {
      if (code === SUPPORTED[i] || code.indexOf(SUPPORTED[i] + '-') === 0) return SUPPORTED[i];
    }
    return null;
  }

  function detect() {
    // 1) ?lang=xx dans l'URL (lien partageable, débogage)
    try {
      var m = location.search.match(/[?&]lang=([a-zA-Z-]+)/);
      if (m) { var u = normalize(m[1]); if (u) { try { localStorage.setItem(KEY, u); } catch (e) {} return u; } }
    } catch (e) {}
    // 2) choix mémorisé
    try { var s = normalize(localStorage.getItem(KEY)); if (s) return s; } catch (e) {}
    // 3) langue(s) du navigateur
    var langs = (navigator.languages && navigator.languages.length) ? navigator.languages : [navigator.language || 'fr'];
    for (var i = 0; i < langs.length; i++) { var n = normalize(langs[i]); if (n) return n; }
    return 'fr';
  }

  var lang = detect();
  var dict = null;           // dictionnaire de la langue courante (null pour fr)
  var readyCbs = [], isReady = false;

  function fireReady() {
    if (isReady) return; isReady = true;
    document.documentElement.classList.remove('i18n-wait');
    for (var i = 0; i < readyCbs.length; i++) { try { readyCbs[i](); } catch (e) {} }
    readyCbs = [];
  }

  function t(key, fr) {
    if (dict && Object.prototype.hasOwnProperty.call(dict, key)) return dict[key];
    return fr !== undefined ? fr : '';
  }

  function applyTo(root) {
    if (!dict) return;
    var els = (root || document).querySelectorAll('[data-i18n]');
    for (var i = 0; i < els.length; i++) {
      var k = els[i].getAttribute('data-i18n');
      if (dict[k] !== undefined) els[i].innerHTML = dict[k];
    }
    // data-i18n-attr="attr1:clé1;attr2:clé2"
    var attrs = (root || document).querySelectorAll('[data-i18n-attr]');
    for (var j = 0; j < attrs.length; j++) {
      var pairs = attrs[j].getAttribute('data-i18n-attr').split(';');
      for (var p = 0; p < pairs.length; p++) {
        var kv = pairs[p].split(':');
        if (kv.length === 2 && dict[kv[1]] !== undefined) attrs[j].setAttribute(kv[0], dict[kv[1]]);
      }
    }
  }

  function applyDocument() {
    applyTo(document);
    // <title> et meta description balisés par clé
    var titleEl = document.querySelector('title[data-i18n]');
    if (titleEl && dict && dict[titleEl.getAttribute('data-i18n')] !== undefined) {
      document.title = dict[titleEl.getAttribute('data-i18n')];
    }
    var desc = document.querySelector('meta[name="description"][data-i18n]');
    if (desc && dict && dict[desc.getAttribute('data-i18n')] !== undefined) {
      desc.setAttribute('content', dict[desc.getAttribute('data-i18n')]);
    }
  }

  function setLang(l) {
    l = normalize(l) || 'fr';
    try { localStorage.setItem(KEY, l); } catch (e) {}
    // Rechargement : ré-applique tout proprement (contenu, scènes, agent, dir RTL).
    // On retire un éventuel ?lang= de l'URL pour que le choix mémorisé prime.
    if (/[?&]lang=/.test(location.search)) {
      location.href = location.pathname + location.hash;
    } else {
      location.reload();
    }
  }

  // ----- Application immédiate de la langue au document -----
  document.documentElement.lang = lang;
  document.documentElement.dir = (lang === 'ar') ? 'rtl' : 'ltr';

  if (lang === 'fr') {
    // Langue source : rien à charger
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', fireReady);
    else fireReady();
  } else {
    // Anti-flash : on masque le contenu jusqu'à l'application du dictionnaire
    document.documentElement.classList.add('i18n-wait');
    var s = document.createElement('style');
    s.textContent = '.i18n-wait body{visibility:hidden}';
    document.head.appendChild(s);

    var script = document.createElement('script');
    script.src = 'js/lang/' + lang + '.js';
    script.async = true;
    var done = function () {
      dict = (window.AIGEN_DICT && window.AIGEN_DICT[lang]) || null;
      var go = function () { applyDocument(); fireReady(); };
      if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', go);
      else go();
    };
    script.onload = done;
    script.onerror = function () { dict = null; fireReady(); }; // repli : site en français
    document.head.appendChild(script);
    // Failsafe : jamais plus de 2,5 s de page masquée
    setTimeout(fireReady, 2500);
  }

  window.AIGENI18N = {
    lang: lang,
    isRTL: lang === 'ar',
    t: t,
    apply: applyTo,
    ready: function (cb) { if (isReady) { try { cb(); } catch (e) {} } else readyCbs.push(cb); },
    setLang: setLang
  };
})();
