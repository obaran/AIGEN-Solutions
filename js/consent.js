/* ============================================================
   AIGEN SOLUTIONS — Consentement cookies + mesure d'audience
   Bannière minimaliste. Les balises Google (GA4 / Ads) ne se
   chargent QU'APRÈS un « Accepter » (conforme RGPD / CNIL).
   La bannière n'apparaît QUE si un identifiant est renseigné
   ci-dessous : tant que les champs sont vides, rien ne se passe.
   ============================================================ */
(function () {
  'use strict';

  // ===== À RENSEIGNER quand vos comptes seront créés =====
  var GA4_ID = 'G-RBK5QWNYGH';   // Google Analytics 4 (propriété AIGEN Solutions)
  var ADS_ID = '';   // ex. 'AW-123456789'  (Google Ads)
  // =======================================================

  var KEY = 'aigen-consent';
  function get() { try { return localStorage.getItem(KEY); } catch (e) { return null; } }
  function set(v) { try { localStorage.setItem(KEY, v); } catch (e) {} }
  function hasTags() { return !!(GA4_ID || ADS_ID); }

  function loadTags() {
    if (!hasTags() || window.gtag) return;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + (GA4_ID || ADS_ID);
    document.head.appendChild(s);
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () { dataLayer.push(arguments); };
    gtag('js', new Date());
    if (GA4_ID) gtag('config', GA4_ID);
    if (ADS_ID) gtag('config', ADS_ID);
  }

  // API publique pour déclencher les conversions (formulaire, RDV…)
  window.AIGENConsent = {
    granted: function () { return get() === 'yes'; },
    track: function (name, params) {
      if (get() === 'yes' && window.gtag) gtag('event', name, params || {});
    }
  };

  if (get() === 'yes') { loadTags(); return; }   // déjà accepté → on charge
  if (get() === 'no') { return; }                // déjà refusé → rien
  if (!hasTags()) { return; }                    // aucun identifiant → pas de bannière

  function banner() {
    // Traduction (js/i18n.js) : t('clé', 'texte français source')
    var T = function (k, fr) { return (window.AIGENI18N ? window.AIGENI18N.t(k, fr) : fr); };
    // Sur les pages confidentialité / mentions légales : variante DISCRÈTE en coin,
    // sans voile (on doit pouvoir LIRE la politique avant de choisir).
    var quiet = /confidentialite|mentions-legales/.test(location.pathname);
    var b = document.createElement('div');
    b.className = 'cookie-bar' + (quiet ? ' cookie-quiet' : '');
    b.setAttribute('role', 'dialog');
    b.setAttribute('aria-label', 'Cookies');
    b.innerHTML =
      '<p>' + T('cookie.text', 'L’essentiel au fonctionnement, et, avec votre accord, une mesure d’audience pour améliorer le site.') + ' ' +
      '<a href="confidentialite.html">' + T('cookie.more', 'En savoir plus') + '</a></p>' +
      '<div class="cookie-actions">' +
        '<button type="button" class="cookie-refuse">' + T('cookie.refuse', 'Essentiel uniquement') + '</button>' +
        '<button type="button" class="cookie-accept">' + T('cookie.accept', 'Tout accepter') + '</button>' +
      '</div>';
    document.body.appendChild(b);
    requestAnimationFrame(function () { b.classList.add('in'); });
    b.querySelector('.cookie-accept').addEventListener('click', function () { set('yes'); loadTags(); b.remove(); });
    b.querySelector('.cookie-refuse').addEventListener('click', function () { set('no'); b.remove(); });
  }
  function boot() {
    if (window.AIGENI18N) window.AIGENI18N.ready(banner); else banner();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
  else boot();
})();
