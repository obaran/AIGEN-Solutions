# AIGEN Solutions — Site vitrine

Contexte projet pour Claude Code. **Site en production : https://aigen-solutions.fr**

## 1. Ce que c'est
Site vitrine **statique** (HTML/CSS/JS vanilla, **aucun build, aucune dépendance npm**) de l'agence **AIGEN Solutions** : conception d'outils d'IA sur-mesure. Cible = **entreprises de toutes tailles** (de l'artisan au grand groupe), avec un accent PME **subtil**.

## 2. Démarrer en local
Site statique, aucun build : `python3 -m http.server` → http://localhost:8000.
Pour tester les **fonctions serverless** (formulaire `/api/contact`, agent vocal `/api/live-token`) : **`vercel dev`** → http://localhost:3000 (charge `.env` local, voir §11).
L'**accueil cinématique** (plein écran) ne s'active que sur **desktop** (pointeur fin + motion). Forçage debug : `?cine=1`, `?s=N` (scène ciblée), `?flat=1` (sans transition).

## 3. Arborescence
- **Pages** : `index.html`, `solutions.html`, `realisations.html`, `technologies.html` (onglet affiché « Comprendre l'IA »), `approche.html`, `contact.html`, `mentions-legales.html`, `confidentialite.html`.
- `css/aigen.css` : design system (tokens couleurs/espacement/rayons + thèmes dark/light), typo, focus-visible/skip-link, grain, header/footer, responsive.
- `css/components.css` : composants (cartes, hero, bannière cookies, **bande crédibilité**, **agent vocal**…).
- `css/cinematic.css` : **accueil plein écran** (scènes + transitions par dissolution). Chargé sur `index.html` uniquement.
- `css/fonts.css` + `assets/fonts/` : **polices Outfit + Inter self-hostées** (woff2 ; plus aucun appel à Google Fonts).
- `js/logo.js` : logo monogramme **AG** en SVG (`markSVG`/`markAnimSVG`/`brandLockup`), couleurs adaptatives au thème. ⚠️ `logo.md` à la racine est **OBSOLÈTE** (ancien logo).
- `js/aigen.js` : logique partagée. **Header + footer générés en JS** (`buildHeader`/`buildFooter`). La nav vient du tableau `PAGES` — **pas d'onglet « Accueil »** (le logo sert d'accueil, convention moderne). Gère aussi formulaire, thème, animations d'interaction.
- `js/consent.js` : bannière cookies + chargement GA4/Google Ads après consentement (voir §7).
- `js/fx.js`, `js/hero-core.js` : animations de fond / hero.
- `js/cinematic.js` : **moteur de scènes** de l'accueil (molette/clavier/tactile, points de nav, repli défilement classique si mobile/reduced-motion).
- `js/voice-agent.js` : **agent vocal (client)**. Parle au **backend Railway** via WebSocket (plus de SDK Gemini ni de clé côté navigateur). Voir §11.
- `js/audio-processors/capture.worklet.js` + `playback.worklet.js` : capture micro 16 kHz / lecture 24 kHz (AudioWorklet).
- `server/` : **backend Node (relais WebSocket Gemini Live)**, déployé sur **Railway**. `server/index.js` tient la session Gemini avec la vraie clé (endpoint standard, fiable), relaie audio/sous-titres/outils vers le navigateur. Voir §11.
- `api/contact.js` : fonction serverless Vercel, reçoit le formulaire (agent vocal ET page contact), envoie l'email via Resend.
- `package.json` (racine) : front SANS dépendance ni build. Les dépendances npm (`ws`, `@google/genai`) sont dans `server/` uniquement.
- `assets/img/` : visuels des réalisations (PNG + infographies SVG faites maison).
- `favicon.svg` : favicon (logo clair, fond transparent, adaptatif clair/sombre).
- `vercel.json` : en-têtes de sécurité.

## 4. Charte graphique
- Couleurs : **bleu #3159C9** (principal) / **#4F73D9** (secondaire), **anthracite #232D42**, gris texte #4A5568, gris interface #F5F7FA.
- Polices : **Outfit** (titres) + **Inter** (texte), **self-hostées** (`css/fonts.css` + `assets/fonts/`, plus d'appel à Google Fonts).
- Logo : monogramme **AG** (lettres + triangle + orbite). Slogan : **« Imaginer · Concevoir · Libérer »** (hero accueil + footer).
- Fichiers logo livrés au client (HORS dépôt) : `../Images/monogramme-couleur.svg`, `../Images/logo-complet-couleur.svg`.

## 5. Déploiement (Vercel)
- CLI : **`vercel deploy --prod --yes`** depuis ce dossier (besoin de `vercel login`).
- Projet Vercel : **`aigen-solutions`** (scope `obarans-projects`). Lien stocké dans `.vercel/` (gitignored).
- **Domaines** : `aigen-solutions.fr` (apex, sert le site) ; `www.aigen-solutions.fr` et `aigen-solutions.com` → **redirection 308** vers l'apex (réglée au **niveau domaine dans Vercel**, pas dans vercel.json).
- **DNS chez OVH** (nameservers OVH **conservés**) : `A @` et `A www` → **`76.76.21.21`**. ⚠️ Ne **pas** toucher aux MX / SPF / autodiscover (email M365). Protection de déploiement Vercel **désactivée** (site public).
- **GitHub** : https://github.com/obaran/AIGEN-Solutions (branche `main`). Push : nécessite `gh auth login` ou identifiants git.
- **Monorepo front + back** : le front (racine) va sur **Vercel**, le backend vocal (`server/`) va sur **Railway** (voir §11). À chaque évolution : commit + push GitHub (`main`), déploiement front `vercel deploy --prod --yes`, et si `server/` a changé, `railway up --detach` depuis `server/`.

## 6. Formulaire de contact & RDV
- Le formulaire poste en JSON sur `/api/contact` → **Resend** (UE). Expéditeur brandé `formulaire@aigen-solutions.fr` → `contact@aigen-solutions.fr`, `reply_to` = visiteur. Repli **mailto** automatique si l'API échoue.
- **Secrets (jamais dans le code)** : variables d'env Vercel **`RESEND_API_KEY`** + **`MAIL_FALLBACK_TO`**. Domaine Resend `aigen-solutions.fr` **vérifié** (DNS `send.` + `resend._domainkey` chez OVH).
- **RDV** : bouton « Choisir un créneau » → page **Microsoft Bookings** (lien dans `contact.html`, attribut `data-booking`).

## 7. Cookies & suivi (Google Ads / GA4) — EN COURS
- `js/consent.js` : bannière cookies **minimaliste**, charge GA4/Ads **uniquement après « Accepter »** (RGPD). **DORMANT** tant que les IDs en haut du fichier sont vides → aucune bannière ne s'affiche.
- **À FAIRE** : créer une propriété **GA4** → coller l'`G-XXXXXXXXXX` dans `consent.js` (`GA4_ID`) ; idem `AW-XXXX` (`ADS_ID`) quand le compte Google Ads existe. Puis : maj page **confidentialité** (mention GA4), créer une **landing page** pub, livrer le **kit de campagne**.
- Conversions déjà câblées : `generate_lead` (envoi formulaire) et `book_appointment` (clic RDV) via `window.AIGENConsent.track(...)`.

## 8. Conventions à respecter (IMPORTANT)
- **JAMAIS de tiret cadratin `—`** dans les textes français (virgule / deux-points / parenthèses à la place). Le client y tient.
- **Cibler toutes les tailles** d'entreprise (ne pas écrire « PME/TPE » en titre), accent PME **subtil**.
- **Mentions légales volontairement minimales** (choix client) : capital social, n° TVA, nom du dirigeant et hébergeur ont été **retirés**.
- Pas de **faux chiffres** ni de témoignages inventés.

## 9. Société (mentions légales)
AIGEN Solutions — **SAS**, siège **77 Avenue la Bruyère, 38100 Grenoble**, **RCS Grenoble 993 234 632** (SIREN 993 234 632). Président : **Onur Baran**. Email : **contact@aigen-solutions.fr**.

## 10. Tâches en attente
- [ ] **GA4** : récupérer l'ID `G-XXXX` → activer suivi + bannière + maj confidentialité.
- [ ] **Google Ads** : landing page dédiée + kit de campagne (mots-clés, annonces, ciblage).
- [ ] **LinkedIn** : URL de la page pro → réintégrer l'icône dans le footer (`buildFooter`).
- [ ] **Sécurité** : régénérer/restreindre la clé **Resend** ET la clé **Gemini** (toutes deux ont transité en clair). Gemini = env **Railway** ; Resend = env **Vercel**.
- [x] **Agent vocal en prod** : backend déployé sur **Railway** (`aigen-voice-backend`), `GEMINI_API_KEY` posée, relais opérationnel (endpoint standard, fiable).
- [ ] (Optionnel) nettoyer les assets orphelins : `assets/img/grandirserein.png`, `etabli.png`, `mediatrad-1.png`.
- [x] Strip « Ils nous font confiance » : Grandir Serein + L'Établi retirés (ne reste que emlyon business school, Bioforce, Grand compte BTP).

## 11. Agent vocal (front + back) + accueil cinématique

### Agent vocal : architecture navigateur ↔ backend Railway ↔ Gemini
- **Front** (`js/voice-agent.js`) : le navigateur ouvre un **WebSocket vers le backend Railway** (`wss://aigen-voice-backend-production.up.railway.app/live` ; constante **`RAILWAY_HOST`** en haut du fichier ; bascule auto sur `ws://localhost:8787/live` en local). Il gère micro/haut-parleurs (AudioWorklet), sous-titres, orbe réactif, **formulaire de lead inséré dans le chat** (nom, email, entreprise, secteur, tél) → POST `/api/contact` (email Resend), raccrochage gracieux (l'agent finit sa phrase + ~4 s), coupure après ~80 s d'inactivité. **AUCUN SDK ni clé côté navigateur.**
- **Back** (`server/index.js`, sur **Railway**) : relais Node (`ws` + `@google/genai`). Tient la session **Gemini Live** (voix **Charon**, FR, modèle **`gemini-3.1-flash-live-preview`**) avec la **vraie clé**, sur l'**endpoint standard** (fiable). Prompt commercial + réalisations + garde-fous (**jamais de tarif**) + outils (`recueillir_coordonnees`, `terminer_conversation`) définis ici. Filtrage d'origine + logs.
- **Pourquoi ce choix** : l'ancien jeton éphémère cachait la clé mais **forçait l'endpoint `BidiGenerateContentConstrained`** (expérimental, échecs intermittents selon navigateur/extensions). Le relais backend = fiabilité (endpoint standard) + clé jamais exposée + base pour de futures fonctionnalités.

### Déploiement de l'agent vocal (Railway)
- Projet Railway **`aigen-voice-backend`** (workspace « Onur Baran's Projects »), env **production**, domaine `aigen-voice-backend-production.up.railway.app`.
- Env Railway : **`GEMINI_API_KEY`** (+ optionnels `LIVE_MODEL`, `ALLOWED_ORIGINS`). Le front n'a PAS besoin de la clé.
- Déployer : depuis `server/`, **`railway up --detach`**. Domaine : `railway domain`. Logs : `railway logs`.

### Test local
- Backend : depuis `server/`, `GEMINI_API_KEY=... node index.js` (port 8787). Front : `vercel dev` (port 8000, pour `/api/contact`). Le client détecte `localhost` et parle à `ws://localhost:8787`.
- Micro : contexte sécurisé (localhost/https) + en-tête **`Permissions-Policy: microphone=(self)`** dans `vercel.json`.

### Accueil cinématique
- `js/cinematic.js` + `css/cinematic.css` : accueil découpé en `<div class="scene">` plein écran ; molette/clavier font **disparaître/apparaître** les scènes par dissolution (fondu + profondeur + flou), sans défilement. Desktop uniquement (sinon défilement classique). Étendu aussi à réalisations/technologies/approche. `aigen.js` `reveal()` se désactive en mode scènes. Debug : `?cine=1`, `?s=N`, `?flat=1`.
