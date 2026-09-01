# Audit de sécurité et de mise en service : aigen-solutions.fr

Réalisé le 1er septembre 2026, sur la production réelle (en-têtes servis, DNS publics, code déployé), pas sur la documentation. Ce qui n'a pas pu être vérifié est signalé comme tel plutôt qu'estimé.

Particularité : ce site est **déjà ouvert au public**. La question n'est donc pas « peut-on ouvrir » mais « y a-t-il un risque actif à rester ouvert ».

---

## Verdict

**Le site peut rester ouvert.** Il n'y a pas de faille exploitable en l'état : aucune authentification à casser, aucune base de données à vider, aucun compte à usurper. C'est un site statique servi par un CDN, plus un relais vocal sans stockage.

Deux choses méritent d'être traitées, et une seule est vraiment urgente.

**Le point qui traîne depuis juillet, et qui est le vrai sujet : la rotation des clés d'API.** Les clés Gemini, Anthropic, Resend et Telnyx ont transité en clair dans des conversations les 30 et 31 juillet 2026. Elles sont toujours actives. Ce ne sont pas des secrets « théoriquement exposés » : ils ont circulé. Une clé Gemini ou Anthropic qui fuite se traduit en facture, pas en fuite de données, mais la facture peut être lourde et rapide. L'outil `./secure-keys.sh` existe pour les remplacer sans jamais les afficher. Tant que ce n'est pas fait, le reste est du confort.

**Le manque opérationnel : personne n'est prévenu si le service tombe.** Le backend vocal est sur Railway, en instance unique. S'il s'arrête, l'agent vocal du site ne répond plus, le formulaire de l'agent ne part plus, et vous l'apprendrez par hasard ou par un client. Aucune surveillance externe n'interroge la route de santé.

Le trou de sécurité le plus sérieux du site lui-même, l'absence de politique de sécurité du contenu, a été corrigé et vérifié pendant cet audit (voir plus bas).

---

## 1. En-têtes et injection de contenu tiers

**Ce qui manquait : aucune Content-Security-Policy.** Ni dans `vercel.json`, ni dans les en-têtes réellement servis. Testé concrètement depuis la console du site, avant correction :

| Test | Résultat avant |
|---|---|
| Charger un script de régie publicitaire (`securepubads.g.doubleclick.net`) | **CHARGÉ** |
| Envoyer une requête vers un domaine tiers (`example.com`) | **PARTIE** |

Autrement dit, un script arrivé par n'importe quel biais pouvait charger une régie et sortir des données du navigateur, et le navigateur n'y voyait rien à redire.

**Corrigé.** Une CSP complète est en place. Le site n'ayant aucun script inline ni aucun attribut `onclick`, elle a pu être posée **sans `unsafe-inline` sur `script-src`**, ce qui la rend réellement protectrice et pas seulement décorative. Vérification après correction :

| Test | Résultat après |
|---|---|
| Script de régie publicitaire | **BLOQUÉ par la CSP** |
| Requête vers un domaine tiers | **BLOQUÉE par la CSP** |
| WebSocket de l'agent vocal (Railway) | ouvert, OK |
| POST du formulaire vers `/lead` | HTTP 200, OK |
| Chargement de la mesure d'audience (gtag) | chargé, OK |
| AudioWorklets de capture et de lecture | chargés, OK |
| Polices, logo, i18n, bandeau cookies | 39 polices chargées, tous les scripts présents |

Les autres en-têtes sont en place : `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, et une `Permissions-Policy` qui n'autorise le micro que pour le site lui-même.

**Non corrigé, volontairement : `Strict-Transport-Security` n'a pas `includeSubDomains`.** L'ajouter forcerait le HTTPS sur tous les sous-domaines, dont `em.aigen-solutions.fr` et `r.em.aigen-solutions.fr` qui servent désormais les liens de suivi des campagnes Brevo. Si l'un d'eux répondait en HTTP, les liens de vos emails casseraient. C'est un arbitrage, pas une évidence : à vérifier avec Brevo avant de le poser.

## 2. Le nom de domaine

| Élément | État |
|---|---|
| Verrouillage contre le transfert | **actif** sur `aigen-solutions.fr` et `.com` |
| DNSSEC | **activé et validé** (enregistrement DS publié, validation confirmée) |
| SPF | présent, `-all`, un seul enregistrement |
| DKIM | Resend et Brevo, résolus jusqu'à la clé |
| DMARC | présent depuis le 20 août 2026, en `p=none` |
| **CAA** | **absent** |

**Le CAA manque.** Sans lui, n'importe quelle autorité de certification peut émettre un certificat valide pour votre domaine, et servir un faux site que le navigateur acceptera. L'autorité qui émet réellement est **Let's Encrypt** (via Vercel), vérifié sur le certificat en production.

Je ne l'ai pas posé de ma propre initiative : un CAA trop strict casse le renouvellement du certificat si Vercel change d'autorité, et le site passerait en HTTPS invalide. C'est une décision à prendre en connaissance de cause.

**DMARC en `p=none`** signifie « observe et rapporte », sans rien bloquer. C'est le bon réglage au départ. Après quelques semaines de rapports, passer à `quarantine` puis `reject` fermerait réellement la porte à l'usurpation de votre adresse.

## 3. Authentification et sessions

**Sans objet.** Le site n'a ni compte, ni connexion, ni session utilisateur, ni mot de passe à hacher. Il n'y a rien à casser.

Le seul accès privilégié est celui des tableaux de bord : Vercel, Railway, OVH, Brevo, Resend, Google, Anthropic. **Je ne peux pas vérifier si la double authentification y est active** : c'est à faire de votre côté, et c'est le vrai périmètre d'authentification de ce projet. Un accès OVH compromis permet de rediriger le domaine et les emails.

## 4. Cloisonnement des données

**Sans objet.** Aucune base de données, aucun espace client, aucun identifiant dans les URL. Le backend ne stocke rien : il relaie l'audio et envoie des emails. Il n'existe donc pas de donnée d'un client qu'un autre pourrait lire.

## 5. Limites et abus

C'est le point qui protège votre facture, puisque chaque conversation appelle des modèles facturés à l'usage.

| Protection | Valeur |
|---|---|
| Formulaire `/lead` par IP | 8 par 15 min, rafale de 3 par minute |
| Formulaire `/lead`, plafond global | 80 par 15 min, tient même si l'IP est falsifiée |
| Sessions vocales par IP | 6 par 30 min |
| Sessions vocales simultanées | 12 |
| Durée d'une session vocale | 15 min maximum, 18 si un formulaire est en cours |
| Rapports de conversation (Anthropic) | 10 par jour |
| Pièce jointe | 8 Mo côté navigateur, 13 Mo côté serveur |

Les quatre dernières lignes ont été ajoutées le 1er septembre 2026, en même temps que les garde-fous de durée de l'agent vocal. Deux fuites de coût ont été fermées au passage : le serveur ferme désormais lui-même la session 12 secondes après une demande de raccrochage si le navigateur ne le fait pas, et une session ne peut plus durer indéfiniment.

**Ce qui manque : un plafond de dépense chez les fournisseurs eux-mêmes.** Les limites ci-dessus sont applicatives ; elles ne protègent pas d'une clé volée utilisée ailleurs. Une alerte de budget sur le compte Google Cloud et sur le compte Anthropic est le dernier filet, et il n'est pas posé.

## 6. Données personnelles

**La politique de confidentialité est honnête, et c'est rare.** Elle décrit l'assistant vocal, le fait que la voix est transmise en temps réel à Google, l'établissement d'une transcription, et son analyse interne « y compris à l'aide d'outils d'IA agissant pour notre compte ». Ce dernier point couvre l'analyse par Anthropic sans avoir à la nommer. La mesure d'audience n'est chargée qu'après consentement, et le code le respecte réellement.

**Écart n° 1, mineur mais réel : la durée de conservation annoncée n'est appliquée par rien.** La politique annonce « 3 ans à compter du dernier contact ». Or il n'existe aucune base de données : les demandes arrivent par email dans votre boîte Microsoft 365 et y restent indéfiniment. L'engagement est donc tenu à la main, ou pas tenu du tout. C'est exactement l'écart que regarde un contrôle. Le corriger ne demande pas de code : une règle de rangement annuelle dans votre messagerie suffit.

**Écart n° 2 : les sous-traitants ne sont pas nommés.** La politique parle de catégories (« hébergeur, service d'envoi de formulaire, outil d'agenda »). Ce n'est pas une faute, mais nommer Google, Anthropic, Resend, Vercel, Railway et Microsoft serait plus solide, notamment parce que certains traitements ont lieu hors Union européenne.

**Registre des traitements** : hors de ma portée, à confirmer de votre côté.

## 7. Exploitation

| Point | État |
|---|---|
| Surveillance externe du service | **absente** |
| Sauvegardes | sans objet, aucune donnée persistée ; le code est sur GitHub |
| Version en production, vérifiable de l'extérieur | **corrigé le 1er septembre** : `/health` renvoie le commit déployé, le modèle, l'uptime et le nombre de sessions en cours |
| Secrets dans le dépôt | aucun, historique git vérifié, `.env` ignoré depuis l'origine |
| Rotation des secrets exposés | **à faire**, voir le verdict |

L'absence de surveillance est le manque le plus concret. La route `/health` existe et répond en 60 ms : il suffit de la faire interroger toutes les cinq minutes par un service extérieur (UptimeRobot ou équivalent, gratuit à cette échelle) avec alerte par email. Une surveillance interne ne servirait à rien : elle tomberait en même temps que le service.

## 8. Tenue à la charge

| Mesure | Temps |
|---|---|
| Accueil | 0,18 s |
| Page Réalisations | 0,23 s |
| `/health` du backend vocal | 0,06 s |

Le site est statique et servi par le CDN de Vercel : il tiendra n'importe quelle charge réaliste pour une agence. Il n'y a ni requête de liste, ni index à surveiller, puisqu'il n'y a pas de base.

Le point de contention est le backend vocal : **instance Railway unique**. Le plafond de 12 sessions simultanées est désormais explicite et refuse proprement les suivantes, avec un message dédié au visiteur, plutôt que de dégrader tout le monde. Aucun test de charge n'a été mené, et il n'y a pas d'objectif écrit : à ce stade d'activité, ce serait prématuré.

---

## Ce qui a été corrigé pendant cet audit

1. **Content-Security-Policy** complète, sans `unsafe-inline` sur les scripts, vérifiée par test réel dans les deux sens : la régie publicitaire et l'exfiltration sont bloquées, et aucune fonction du site n'est cassée (agent vocal, formulaire, mesure d'audience, worklets audio, polices).
2. **`/health` prouve la version déployée** depuis l'extérieur.
3. **Plafonds de sessions vocales** par IP et en simultané, et durée de session bornée (voir point 5).

## Ce qui n'a pas été corrigé, et pourquoi

- **CAA** : casserait le renouvellement du certificat si l'autorité change. Demande votre décision.
- **HSTS `includeSubDomains`** : casserait les liens de suivi Brevo si l'un des sous-domaines répond en HTTP. À vérifier avant.
- **Rotation des clés** : demande des identifiants fournisseurs que je n'ai pas, et doit se faire par saisie masquée.
- **Double authentification des tableaux de bord** : hors de ma portée.

---

## Conditions vérifiables

**Avant tout le reste**

- [ ] Les quatre clés (Gemini, Anthropic, Resend, Telnyx) sont régénérées chez le fournisseur, les anciennes révoquées, et les nouvelles posées par `./secure-keys.sh`. Vérifiable : l'ancienne clé renvoie une erreur d'authentification.
- [ ] Une surveillance externe interroge `https://aigen-voice-backend-production.up.railway.app/health` toutes les 5 minutes et alerte par email. Vérifiable : couper le service et recevoir l'alerte.
- [ ] La double authentification est active sur Vercel, Railway, OVH et Brevo. Vérifiable : une connexion depuis un navigateur neuf la demande.

**Dans le mois**

- [ ] Une alerte de budget est posée sur les comptes Google et Anthropic. Vérifiable : le seuil apparaît dans la console de facturation.
- [ ] Un enregistrement CAA autorise l'autorité réellement utilisée. Vérifiable : `dig CAA aigen-solutions.fr` renvoie une valeur, et le certificat se renouvelle sans erreur au cycle suivant.
- [ ] Les sous-traitants sont nommés dans la politique de confidentialité.
- [ ] Une règle de rangement annuelle applique réellement la durée de conservation annoncée.

**Avant la montée en charge**

- [ ] Les rapports DMARC ont été lus, puis la politique est passée à `quarantine`, enfin à `reject`.
- [ ] Un objectif de charge est écrit (nombre de conversations simultanées visées), et le backend est testé à ce niveau.
- [ ] `includeSubDomains` est ajouté à HSTS après vérification des sous-domaines Brevo.
