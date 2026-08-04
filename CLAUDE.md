# AIGEN Solutions — Site vitrine

Contexte projet pour Claude Code. **Site en production : https://aigen-solutions.fr**

## 1. Ce que c'est
Site vitrine **statique** (HTML/CSS/JS vanilla, **aucun build, aucune dépendance npm**) de l'agence **AIGEN Solutions** : conception d'outils d'IA sur-mesure. Cible = **entreprises de toutes tailles** (de l'artisan au grand groupe), avec un accent PME **subtil**.

## 2. Démarrer en local
Site statique, aucun build : `python3 -m http.server` → http://localhost:8000.
Pour tester les **fonctions serverless** (formulaire `/api/contact`, agent vocal `/api/live-token`) : **`vercel dev`** → http://localhost:3000 (charge `.env` local, voir §11).
L'**accueil cinématique** (plein écran) est actif sur **tous les écrans** (desktop : molette/clavier ; mobile/tablette : balayage) ; seule exception : `prefers-reduced-motion` -> défilement classique. Forçage debug : `?cine=1`, `?s=N` (scène ciblée), `?flat=1` (sans transition).

## 3. Arborescence
- **Pages** : `index.html`, `solutions.html`, `realisations.html`, `technologies.html` (onglet affiché « Comprendre l'IA »), `approche.html`, `faq.html` (onglet « FAQ », les 5 questions retirées de l'accueil pour l'alléger ; JSON-LD FAQPage dessus), `contact.html`, `mentions-legales.html`, `confidentialite.html`.
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

## 7. Cookies & suivi (Google Ads / GA4)
- `js/consent.js` : bannière cookies **minimaliste**, charge GA4/Ads **uniquement après « Accepter »** (RGPD). **GA4 ACTIF** : `GA4_ID = 'G-RBK5QWNYGH'` (propriété AIGEN Solutions), page confidentialité à jour.
- **À FAIRE** : coller l'`AW-XXXX` (`ADS_ID`) quand le compte Google Ads existera. Puis : landing page pub + kit de campagne.
- Conversions déjà câblées : `generate_lead` (envoi formulaire) et `book_appointment` (clic RDV) via `window.AIGENConsent.track(...)`.

## 7 bis. Internationalisation (fr / en / ar)
- Le site est **trilingue** : français (langue source, écrite dans le HTML), anglais, arabe (**RTL**). La langue s'applique selon : `?lang=xx` dans l'URL → choix mémorisé (`localStorage aigen-lang`) → **langue du navigateur** → fr. Sélecteur **FR / EN / ع** dans le header (généré par `buildHeader`).
- `js/i18n.js` (chargé dans `<head>` AVANT les autres scripts) : détection, chargement du dictionnaire, application. API : `AIGENI18N.lang`, `.t(clé, 'français source')`, `.ready(cb)` (les scripts qui affichent du texte attendent `ready`), `.setLang(l)` (recharge la page). Anti-flash : `html.i18n-wait body{visibility:hidden}` max 2,5 s ; en cas d'échec de chargement du dictionnaire → site en français.
- **Dictionnaires** : `js/lang/en.js` + `js/lang/ar.js` (`window.AIGEN_DICT.en/.ar`). Clés préfixées par page (`home.`, `sol.`, `real.`, `tech.`, `app.`, `faq.`, `contact.`, `legal.`, `priv.`) + communes (`nav.`, `footer.`, `cookie.`, `va.` agent vocal, `cine.`, `scene.`, `brand.slogan`, `a11y.skip`).
- **Balisage HTML** : `data-i18n="clé"` (remplace le innerHTML, peut contenir du HTML), `data-i18n-attr="attr:clé;attr2:clé2"` (attributs : alt, placeholder, data-label des scènes…). `<title>` et `<meta name="description">` balisés aussi. Les og:/JSON-LD restent en français (SEO du domaine .fr).
- **RTL arabe** : `dir="rtl"` posé par i18n.js ; pile de polices arabes système + `letter-spacing:0` forcé (les interlettrages cassent les ligatures arabes) dans `aigen.css` ; miroirs de composants en fin de `components.css` (`[dir="rtl"] …`). Le logo/nom de marque reste LTR.
- **Agent vocal multilingue** : le front envoie `lang` dans le message `start` (WS) et dans le payload `/lead`. Le back (`server/index.js`) : section « # Langue » du SYSTEM_PROMPT + consigne dans `greetingPrompt` → l'agent fait son accueil dans la langue du navigateur et suit le visiteur s'il change ; la **synthèse reste en français** (brief interne). Email de confirmation visiteur en fr/en/ar (`CONFIRM_I18N`) ; pour en/ar on n'y reprend pas la synthèse française, seulement le message du visiteur.
- **AJOUT DE CONTENU** : toute nouvelle chaîne visible doit être balisée `data-i18n` + ajoutée aux DEUX dictionnaires (en + ar). Un libellé généré en JS passe par `AIGENI18N.t('clé', 'texte fr')`.

## 8. Conventions à respecter (IMPORTANT)
- **JAMAIS de tiret cadratin `—`** dans les textes français (virgule / deux-points / parenthèses à la place). Le client y tient.
- **Cibler toutes les tailles** d'entreprise (ne pas écrire « PME/TPE » en titre), accent PME **subtil**.
- **Mentions légales volontairement minimales** (choix client) : capital social, n° TVA, nom du dirigeant et hébergeur ont été **retirés**.
- Pas de **faux chiffres** ni de témoignages inventés.

## 9. Société (mentions légales)
AIGEN Solutions — **SAS**, siège **77 Avenue la Bruyère, 38100 Grenoble**, **RCS Grenoble 993 234 632** (SIREN 993 234 632). Président : **Onur Baran**. Email : **contact@aigen-solutions.fr**.

## 10. Tâches en attente
- [x] **GA4** : ID `G-RBK5QWNYGH` actif dans `consent.js`, bannière + page confidentialité à jour.
- [ ] **Google Ads** : landing page dédiée + kit de campagne (mots-clés, annonces, ciblage).
- [x] **LinkedIn** : icône réintégrée dans le footer (`buildFooter`) → https://www.linkedin.com/company/ai-gensolutions
- [ ] **Sécurité (rotation des clés)** : les clés **Gemini**, **Resend** et **Anthropic** ont transité en clair -> à régénérer chez le fournisseur, révoquer l'ancienne, puis restreindre (Gemini : limiter à l'API Generative Language ; Resend : scope envoi + domaine `aigen-solutions.fr`). Les 3 (+ `MAIL_FALLBACK_TO`) sont désormais en env **Railway** (backend). Rotation SÉCURISÉE sans jamais exposer la valeur : `./secure-keys.sh NOM_DE_LA_CLE` (saisie masquée -> pousse sur Railway prod + met à jour `.env` local, hors chat/historique). Dépôt vérifié propre : aucune clé dans le code ni l'historique git, `.env` gitignoré et jamais committé.
- [x] **Agent vocal en prod** : backend déployé sur **Railway** (`aigen-voice-backend`), `GEMINI_API_KEY` posée, relais opérationnel (endpoint standard, fiable).
- [x] Assets orphelins supprimés (`grandirserein.png`, `etabli.png`). `mediatrad-1.png` est UTILISÉ (galerie carte réalisation, `index.html`), conservé.
- [x] Strip « Ils nous font confiance » : Grandir Serein + L'Établi retirés (ne reste que emlyon business school, Bioforce, Grand compte BTP).

## 11. Agent vocal (front + back) + accueil cinématique

### Agent vocal : architecture navigateur ↔ backend Railway ↔ Gemini
- **Front** (`js/voice-agent.js`) : le navigateur ouvre un **WebSocket vers le backend Railway** (`wss://aigen-voice-backend-production.up.railway.app/live` ; constante **`RAILWAY_HOST`** en haut du fichier ; bascule auto sur `ws://localhost:8787/live` en local). Il gère micro/haut-parleurs (AudioWorklet), sous-titres, orbe réactif, **formulaire de lead inséré dans le chat** (nom, email, entreprise, secteur, tél, + upload doc) → POST `/lead` sur le **backend Railway** (email de confirmation Resend au visiteur + brief **Opus 5** à l'équipe), raccrochage gracieux (attend la **fin réelle de la voix** + sécurité 2 s, via signal `drained` du worklet), coupure après ~80 s d'inactivité. **AUCUN SDK ni clé côté navigateur.** **Découvrabilité** : étiquette « Essayer l'agent vocal » + halo pulsé tant que jamais essayé (localStorage `aigen_va_used`), bulle d'invitation unique après 12 s (`aigen_va_teased`, max 1/30 jours), boutons `[data-va-open]` (hero accueil, page contact, carte réalisations), et **interception RDV** : au clic sur `[data-booking]` (hors chat), fenêtre « préparer avec l'agent OU réserver directement » (1 fois par session, sautée si l'agent est déjà connu). Bannière cookies déplacée **bas-centre** (consent.js inchangé, CSS `.cookie-bar`).
- **Back** (`server/index.js`, sur **Railway**) : relais Node (`ws` + `@google/genai`). Tient la session **Gemini Live** (voix **Charon**, FR, modèle **`gemini-3.1-flash-live-preview`**) avec la **vraie clé**, sur l'**endpoint standard** (fiable). Prompt de découverte commerciale + réalisations + garde-fous (**jamais de tarif**) + outils (`proposer_contact` {mode, synthese}, `terminer_conversation`) définis ici. Endpoint HTTP **`/lead`** (**Opus 5** + emails Resend) également porté par ce serveur. **Anti-abus `/lead`** : limiteur de débit en mémoire (8 leads/IP/15 min, rafale 3/60 s, plafond GLOBAL 80/15 min qui tient même si l'IP est falsifiée) -> réponse **429** sans déclencher le modèle ni email ; le front affiche « trop de demandes, patientez » (page contact : repli mailto). **Rapport de conversation** : si un visiteur discute substantiellement (≥250 caractères ou ≥4 prises de parole) puis part SANS envoyer le formulaire, **Opus 5** rédige un rapport interne emailé à contact@ (En deux mots / Intérêt commercial / Ce que ça vous apporte / Actions suggérées, + signal d'abus éventuel), SANS transcript (choix client), plafond 10/jour. **Si l'analyse échoue malgré les réessais, l'email part quand même** avec un avertissement (durée, page, langue) : mieux qu'un silence total. Note fin de conversation : `terminer_conversation` ne renvoie **pas** de réponse d'outil (sinon le modèle lisait « conversation terminée » à voix haute). Filtrage d'origine + logs.
- **Pourquoi ce choix** : l'ancien jeton éphémère cachait la clé mais **forçait l'endpoint `BidiGenerateContentConstrained`** (expérimental, échecs intermittents selon navigateur/extensions). Le relais backend = fiabilité (endpoint standard) + clé jamais exposée + base pour de futures fonctionnalités.

### L'accueil de l'agent vocal (4 août 2026)

Le visiteur qui ouvre l'assistant **ne sait pas à quoi sert la conversation** : avant, l'agent se présentait puis demandait « que puis-je pour vous », et beaucoup partaient. L'accueil annonce désormais en trois temps **qui parle**, **ce que le visiteur y gagne**, **la suite possible** (rappel ou créneau, sans engagement), puis rend la parole par une question ouverte.

Garde-fous inscrits dans le prompt (section « # Accueil » de `SYSTEM_PROMPT` et `greetingPrompt`), car un accueil trop long fait fuir :

- **QUINZE SECONDES MAXIMUM à l'oral**, règle prioritaire. Mesure réelle en production : 38 mots en fr, 37 en en, 29 en ar, soit 12 à 16 secondes.
- **LE RYTHME COMPTE AUTANT QUE LE CONTENU.** ⚠️ Piège rencontré le 4 août : une première consigne disait « trois phrases courtes maximum », ce qui produisait mécaniquement un accueil **haché et récité** (retour d'Onur). La règle est désormais l'ALTERNANCE : une phrase courte pour se présenter, **une phrase ample d'un seul souffle** qui porte tout le sens (liée par « et », « pour que », « ensuite »), puis une phrase brève qui rend la parole. Rythme mesuré en production : **8 / 27 / 3 mots**. Trois ou quatre phrases courtes d'affilée sonnent artificielles à l'oral.
- **L'agent ne promet PAS de donner lui-même la solution** pendant l'appel : il écoute et recueille, c'est l'équipe qui revient ensuite sur ce qui serait réalisable. Formules interdites : « je vous dis ce que l'IA peut faire pour vous », « je vais analyser votre besoin ».
- **Le bénéfice, jamais la méthode** : interdit de dire « notre approche est », « nous procédons en plusieurs étapes », « je vais recueillir vos besoins ». On annonce où va la conversation, on ne vend pas.
- **Dit une seule fois** : si le visiteur coupe, l'agent abandonne le reste et écoute. Jamais répété plus tard.
- **S'il faut raccourcir** : sacrifier ce qui suit les deux-points, jamais l'invitation finale.
- **Seulement pour un nouveau visiteur** : celui qui revient connaît déjà tout cela (branche « Visiteur de retour »).
- **Vocabulaire idiomatique par langue**, jamais de traduction mot à mot : « conseiller vocal » en français, **« voice assistant »** en anglais (le modèle produisait « vocal counselor », qui désigne un thérapeute), « المساعد الصوتي » en arabe. Règle inscrite dans la section « # Langue » du prompt.

Le texte affiché dans le panneau (`va.intro`, les trois langues) porte la **même promesse** que ce que l'agent dit : le visiteur lit et entend la même chose.

⚠️ Le prompt donne un exemple de phrase et le modèle le reprend quasi tel quel : c'est voulu (accueil homogène), mais **toute retouche de l'exemple change ce qu'entendent tous les visiteurs**. Reteste après modification, la longueur dérive vite.

### Fiabilité des appels au modèle (brief + rapport)
- `server/index.js` : helper **`anthropicText()`** partagé par le brief de lead et le rapport de conversation. **`BRIEF_MODEL` = `claude-opus-5`** (dernier modèle, moitié du prix de Fable 5) ; libellé affiché dans l'email via `BRIEF_MODEL_LABEL`.
- **Réessais obligatoires** : 4 tentatives, attente croissante avec gigue, respect de l'en-tête `retry-after`, sur 429 / 529 / 5xx / erreurs réseau. ⚠️ Historique : le 30/07/2026 un **529 (surcharge)** a fait perdre définitivement un rapport de conversation, car l'ancien code abandonnait au premier échec. Ne jamais retirer les réessais.
- **`fallbacks: 'default'`** + en-tête `anthropic-beta: server-side-fallback-2026-07-01` : si les garde-fous du modèle refusent la demande (`stop_reason: "refusal"`), l'API la rejoue côté serveur sur le modèle de repli recommandé. Vérifié accepté par le compte.
- **Langue du visiteur dans les emails internes** : `sessionLang` (WebSocket) et `lead.lang` (formulaire) alimentent l'objet (« visiteur arabophone »), la ligne « Langue du visiteur » et une consigne au modèle pour qu'il précise dans le rapport la langue réellement parlée. Les emails internes restent **en français** (langue de travail d'Onur) ; seul l'email de confirmation du visiteur est traduit.

### Déploiement de l'agent vocal (Railway)
- Projet Railway **`aigen-voice-backend`** (workspace « Onur Baran's Projects »), env **production**, domaine `aigen-voice-backend-production.up.railway.app`.
- Env Railway : **`GEMINI_API_KEY`**, **`ANTHROPIC_API_KEY`** (brief + rapport, modèle **`claude-opus-5`**), **`RESEND_API_KEY`** + **`MAIL_FALLBACK_TO`** (emails via `/lead`) (+ optionnels `LIVE_MODEL`, `BRIEF_MODEL`, `BRIEF_MODEL_LABEL`, `ALLOWED_ORIGINS`). Le front n'a AUCUNE clé. Rotation via `./secure-keys.sh` (voir §10 Sécurité).
- Déployer : depuis `server/`, **`railway up --detach --service aigen-voice-backend`** (le projet contient plusieurs services : sans `--service` la CLI refuse). Logs : `railway logs --service aigen-voice-backend`. Santé : `curl https://aigen-voice-backend-production.up.railway.app/health`.

### Test local
- Backend : depuis `server/`, `set -a; . ../.env; set +a; node index.js` (port 8787, charge les 4 clés du `.env`). Front : `python3 -m http.server 8000` (site statique, plus de fonction Vercel `api/`). Le client détecte `localhost` et parle à `ws://localhost:8787/live` (WS) + `http://localhost:8787/lead` (formulaire).
- Micro : contexte sécurisé (localhost/https) + en-tête **`Permissions-Policy: microphone=(self)`** dans `vercel.json`.

### Accueil cinématique
- `js/cinematic.js` + `css/cinematic.css` : accueil découpé en `<div class="scene">` plein écran ; molette/clavier/**balayage tactile** font **disparaître/apparaître** les scènes par dissolution (fondu + profondeur + flou), sans défilement. **Actif sur tous les écrans** (repli défilement classique uniquement si `prefers-reduced-motion`). Contenu plus haut que l'écran -> défilement interne de la scène, passage à la suivante au bord. Adaptation par écran dans cinematic.css : compaction à `max-height:860/720` (portables 13") et `max-width:680` (téléphones : header 2 lignes -> padding 112px, hero compacté, visuel réduit) ; UI compacte sur mobile (points 8px sans infobulle, compteur réduit, indice « Balayer » avec chevron via `pointer:coarse`). Tactile : gestes horizontaux ignorés (pills de nav), surcouches exclues (`.va-panel`, `.cookie-bar`, `.va-rdv`, `.va-teaser`, `.lightbox`, header). ⚠️ Consentement cookies : **fenêtre centrée** (`.cookie-bar`, z 1360) avec voile plein écran en `::before` (inset géant : le transform du parent fait du modal le référent fixed) qui bloque la page tant que le visiteur n'a pas choisi. Boutons : « **Essentiel uniquement** » (= refus de la mesure ; les éléments techniques exemptés restent) et « **Tout accepter** » (charge GA4/Ads), aussi simples l'un que l'autre (CNIL). Sur `confidentialite.html` et `mentions-legales.html` : variante **`.cookie-quiet`** en coin SANS voile (la politique doit rester lisible avant de choisir). L'invitation de l'agent attend que le choix cookies soit fait. Étendu aussi à réalisations/technologies/approche. `aigen.js` `reveal()` se désactive en mode scènes. Debug : `?cine=1`, `?s=N`, `?flat=1`. Note test : Chrome headless macOS impose une fenêtre ≥500px -> pour tester <500px, passer par un iframe de la largeur voulue.
