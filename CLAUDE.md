# AIGEN Solutions — Site vitrine

Contexte projet pour Claude Code. **Site en production : https://aigen-solutions.fr**

## 1. Ce que c'est
Site vitrine **statique** (HTML/CSS/JS vanilla, **aucun build, aucune dépendance npm**) de l'agence **AIGEN Solutions** : conception d'outils d'IA sur-mesure. Cible = **entreprises de toutes tailles** (de l'artisan au grand groupe), avec un accent PME **subtil**.

## 2. Démarrer en local
Aucun build. Ouvrir `index.html`, ou `python3 -m http.server` → http://localhost:8000.
Le formulaire (`/api/contact`) ne marche qu'une fois **déployé sur Vercel** (fonction serverless + variable d'env).

## 3. Arborescence
- **Pages** : `index.html`, `solutions.html`, `realisations.html`, `technologies.html` (onglet affiché « Comprendre l'IA »), `approche.html`, `contact.html`, `mentions-legales.html`, `confidentialite.html`.
- `css/aigen.css` : design system (tokens couleurs + thèmes dark/light), typo, header/footer, responsive.
- `css/components.css` : composants (cartes, hero, bannière cookies…).
- `js/logo.js` : logo monogramme **AG** en SVG (`markSVG`/`markAnimSVG`/`brandLockup`), couleurs adaptatives au thème. ⚠️ `logo.md` à la racine est **OBSOLÈTE** (ancien logo).
- `js/aigen.js` : logique partagée. **Header + footer générés en JS** (`buildHeader`/`buildFooter`). La nav vient du tableau `PAGES` — **pas d'onglet « Accueil »** (le logo sert d'accueil, convention moderne). Gère aussi formulaire, thème, animations d'interaction.
- `js/consent.js` : bannière cookies + chargement GA4/Google Ads après consentement (voir §7).
- `js/fx.js`, `js/hero-core.js` : animations de fond / hero.
- `api/contact.js` : **fonction serverless Vercel** — reçoit le formulaire, envoie l'email via Resend.
- `assets/img/` : visuels des réalisations (PNG + infographies SVG faites maison).
- `favicon.svg` : favicon (logo clair, fond transparent, adaptatif clair/sombre).
- `vercel.json` : en-têtes de sécurité.

## 4. Charte graphique
- Couleurs : **bleu #3159C9** (principal) / **#4F73D9** (secondaire), **anthracite #232D42**, gris texte #4A5568, gris interface #F5F7FA.
- Polices : **Outfit** (titres) + **Inter** (texte), via Google Fonts.
- Logo : monogramme **AG** (lettres + triangle + orbite). Slogan : **« Imaginer · Concevoir · Libérer »** (hero accueil + footer).
- Fichiers logo livrés au client (HORS dépôt) : `../Images/monogramme-couleur.svg`, `../Images/logo-complet-couleur.svg`.

## 5. Déploiement (Vercel)
- CLI : **`vercel deploy --prod --yes`** depuis ce dossier (besoin de `vercel login`).
- Projet Vercel : **`aigen-solutions`** (scope `obarans-projects`). Lien stocké dans `.vercel/` (gitignored).
- **Domaines** : `aigen-solutions.fr` (apex, sert le site) ; `www.aigen-solutions.fr` et `aigen-solutions.com` → **redirection 308** vers l'apex (réglée au **niveau domaine dans Vercel**, pas dans vercel.json).
- **DNS chez OVH** (nameservers OVH **conservés**) : `A @` et `A www` → **`76.76.21.21`**. ⚠️ Ne **pas** toucher aux MX / SPF / autodiscover (email M365). Protection de déploiement Vercel **désactivée** (site public).
- **GitHub** : https://github.com/obaran/AIGEN-Solutions (branche `main`). Push : nécessite `gh auth login` ou identifiants git.

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
- [ ] **Sécurité** : régénérer la clé Resend (a transité en clair) + mettre à jour la variable Vercel.
- [ ] (Optionnel) nettoyer les assets orphelins : `assets/img/grandirserein.png`, `etabli.png`, `mediatrad-1.png`.
- [ ] Décider : la barre « Ils nous ont fait confiance » (accueil) cite encore **Grandir Serein** + **L'Établi** (dont les réalisations ont été retirées).
