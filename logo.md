# AIGEN Solutions — Charte du logo & de la marque

> Document de référence. Tout ce qu'il faut pour **reproduire**, **décliner** ou **confier à un designer** le logo actuel.
> Dernière mise à jour : juin 2026.

---

## 1. Le concept

**Un noyau algorithmique en orbite.**
Le symbole est un **graphe triangulaire** (3 nœuds reliés à un hub central) — la métaphore de l'algorithme / du réseau de neurones — entouré d'une **orbite** parcourue par un satellite. Le triangle évoque aussi discrètement la lettre **A** de AIGEN.

Deux états :
- **Figé** — usage courant (header, footer, favicon, signatures, documents).
- **Animé** — le réseau « calcule » (les nœuds pulsent, le satellite tourne) : réservé au hero du site et à un court « boot » au chargement. *Désactivé automatiquement si l'utilisateur a activé « réduire les animations ».*

Pistes écartées (historique) : monogramme « AG » littéral (chevron + anneau) ; concept « A en réseau / G en orbite » côte à côte. Jugés trop chargés / peu lisibles.

---

## 2. Palette de couleurs

### Couleurs de marque (le périwinkle est la signature)
| Rôle | Hex | Usage |
|---|---|---|
| Navy (encre) | `#232939` | Texte logo en thème clair, ancrage |
| Périwinkle profond | `#4A5895` | Le bleu « exact » historique, fin des dégradés |
| Périwinkle | `#7D8BD4` | Rayons internes du graphe, accent dark |
| Périwinkle clair | `#A5B0EC` | Satellite, accents lumineux |
| Périwinkle pâle | `#B9C2F2` → `#8E9BE0` | Hautes lumières des nœuds |

### Dégradés utilisés dans le symbole
- **Trait (orbite + triangle)** : linéaire `#8E9BE0` → `#4A5895` (diagonale haut-gauche → bas-droite).
- **Nœuds** : linéaire `#B9C2F2` → `#6E7ECF`.
- **Satellite** : aplat `#A5B0EC` (en thème clair, préférer `#5E6FC4` pour le contraste).

### Fonds
| Thème | Fond | Texte principal |
|---|---|---|
| Sombre (défaut) | `#080A0F` | `#EEF1F8` |
| Clair | `#FFFFFF` | `#141925` |

### Favicon (tuile)
Dégradé tuile `#2E3A6B` → `#141925` ; nœuds `#CBD3FB` → `#8E9BE0`.

---

## 3. Typographie

| Usage | Police | Graisses | Source |
|---|---|---|---|
| **Nom de marque** « AIGEN Solutions » | **Sora** | 600 (semi-bold) | Google Fonts |
| Titres (h1–h4) du site | Space Grotesk | 600 | Google Fonts |
| Texte courant | Manrope | 400–800 | Google Fonts |

- Le bloc-nom : **« AI » en périwinkle clair** (`--accent-bright`), « GEN Solutions » dans la couleur d'encre.
- `letter-spacing` du nom : `-0.01em`.
- Le « AI » est mis en avant car il signifie *Artificial Intelligence*.

> Migration possible : passer aussi les titres en Sora pour une cohérence totale (non fait à ce jour).

---

## 4. Construction géométrique (pour reproduction exacte)

Repère : **viewBox `0 0 100 100`**, centre du symbole en `(50, 50)`.

| Élément | Coordonnées | Dimensions |
|---|---|---|
| Sommet haut du triangle (TOP) | `(50, 30)` | nœud r = 4.8 |
| Sommet bas-gauche (BL) | `(33, 61)` | nœud r = 4.8 |
| Sommet bas-droite (BR) | `(67, 61)` | nœud r = 4.8 |
| Hub central (C) | `(50, 50)` | nœud r = 3.2 |
| Arêtes du triangle | TOP→BL→BR→TOP | trait 3, bouts ronds |
| Rayons internes (C→sommets) | 3 segments | trait 1.7, opacité 0.85 |
| Orbite | arc `M50 8 A42 42 0 1 1 20 21` (rayon 42, ouverture en haut-gauche) | trait 6, bouts ronds |
| Satellite | `(50, 8)` | r = 6.5 |

Ordre de superposition (du fond vers l'avant) : orbite → satellite → triangle → rayons → nœuds.

---

## 5. Code SVG — version figée (autonome, prête à l'emploi)

> Fichier livré : **`logo.svg`** (à la racine). Couleurs en dur. Pour le thème clair, remplacer le satellite `#A5B0EC` par `#5E6FC4`.

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" fill="none">
  <defs>
    <linearGradient id="ag-stroke" x1="18" y1="22" x2="82" y2="78" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8E9BE0"/><stop offset="1" stop-color="#4A5895"/>
    </linearGradient>
    <linearGradient id="ag-node" x1="32" y1="28" x2="68" y2="64" gradientUnits="userSpaceOnUse">
      <stop stop-color="#B9C2F2"/><stop offset="1" stop-color="#6E7ECF"/>
    </linearGradient>
  </defs>
  <path d="M50 8 A42 42 0 1 1 20 21" stroke="url(#ag-stroke)" stroke-width="6" stroke-linecap="round"/>
  <circle cx="50" cy="8" r="6.5" fill="#A5B0EC"/>
  <path d="M50 30 L33 61 L67 61 Z" stroke="url(#ag-stroke)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <g stroke="#7D8BD4" stroke-width="1.7" stroke-linecap="round" opacity=".85">
    <line x1="50" y1="50" x2="50" y2="30"/>
    <line x1="50" y1="50" x2="33" y2="61"/>
    <line x1="50" y1="50" x2="67" y2="61"/>
  </g>
  <circle cx="50" cy="30" r="4.8" fill="url(#ag-node)"/>
  <circle cx="33" cy="61" r="4.8" fill="url(#ag-node)"/>
  <circle cx="67" cy="61" r="4.8" fill="url(#ag-node)"/>
  <circle cx="50" cy="50" r="3.2" fill="url(#ag-node)"/>
</svg>
```

---

## 6. Code SVG — version animée (hero / boot)

Animation pure SVG (SMIL) : nœuds qui pulsent en séquence + satellite en orbite. `dur` = durée d'un tour (≈ 7 s).

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100" height="100" fill="none">
  <defs>
    <linearGradient id="ag-stroke" x1="18" y1="22" x2="82" y2="78" gradientUnits="userSpaceOnUse">
      <stop stop-color="#8E9BE0"/><stop offset="1" stop-color="#4A5895"/>
    </linearGradient>
    <linearGradient id="ag-node" x1="32" y1="28" x2="68" y2="64" gradientUnits="userSpaceOnUse">
      <stop stop-color="#B9C2F2"/><stop offset="1" stop-color="#6E7ECF"/>
    </linearGradient>
  </defs>
  <path d="M50 8 A42 42 0 1 1 20 21" stroke="url(#ag-stroke)" stroke-width="6" stroke-linecap="round" opacity=".55"/>
  <path d="M50 30 L33 61 L67 61 Z" stroke="url(#ag-stroke)" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <g stroke="#7D8BD4" stroke-width="1.7" stroke-linecap="round">
    <line x1="50" y1="50" x2="50" y2="30"><animate attributeName="opacity" values="0.4;1;0.4" dur="3.5s" begin="0s" repeatCount="indefinite"/></line>
    <line x1="50" y1="50" x2="33" y2="61"><animate attributeName="opacity" values="0.4;1;0.4" dur="3.5s" begin="1.17s" repeatCount="indefinite"/></line>
    <line x1="50" y1="50" x2="67" y2="61"><animate attributeName="opacity" values="0.4;1;0.4" dur="3.5s" begin="2.33s" repeatCount="indefinite"/></line>
  </g>
  <circle cx="50" cy="30" r="4.8" fill="url(#ag-node)"><animate attributeName="r" values="4;5.6;4" dur="2.33s" begin="0s" repeatCount="indefinite"/></circle>
  <circle cx="33" cy="61" r="4.8" fill="url(#ag-node)"><animate attributeName="r" values="4;5.6;4" dur="2.33s" begin="0.78s" repeatCount="indefinite"/></circle>
  <circle cx="67" cy="61" r="4.8" fill="url(#ag-node)"><animate attributeName="r" values="4;5.6;4" dur="2.33s" begin="1.56s" repeatCount="indefinite"/></circle>
  <circle cx="50" cy="50" r="3.2" fill="url(#ag-node)"/>
  <g><circle cx="50" cy="8" r="6.5" fill="#A5B0EC"/>
    <animateTransform attributeName="transform" type="rotate" from="0 50 50" to="360 50 50" dur="7s" repeatCount="indefinite"/></g>
</svg>
```

---

## 7. Le bloc-marque (logo + nom)

Disposition horizontale : **symbole** + **« AIGEN Solutions »**, alignés verticalement au centre, écart ≈ 30 % de la hauteur du symbole.

```
[ ◯△ ]  AIGEN Solutions
         └ "AI" en #A5B0EC, le reste en encre ; police Sora 600
```

Versions à prévoir : horizontale (défaut), symbole seul (favicon/avatar), empilée (symbole au-dessus du nom, pour formats carrés).

---

## 8. Règles d'usage

**Espace de protection :** garder autour du logo une marge ≥ la moitié de la hauteur du symbole.

**Tailles minimales :** symbole seul 16 px (favicon OK) ; bloc-marque ≥ 120 px de large pour que le nom reste lisible.

**Fonds autorisés :** `#080A0F` (sombre), `#FFFFFF` / `#F5F7FB` (clair). Sur photo, poser le logo sur une zone calme ou un voile sombre. Le favicon (tuile navy) règle les fonds incertains.

**À faire :** conserver les proportions ; utiliser les dégradés officiels ; sur fond clair, basculer le satellite en `#5E6FC4`.

**À éviter :** déformer / étirer ; recolorer hors palette ; ajouter une ombre portée dure ; poser le symbole sans contraste suffisant ; animer le logo ailleurs que sur le hero/boot.

---

## 9. Où c'est dans le code

| Fichier | Rôle |
|---|---|
| `js/logo.js` | Générateur du logo : `markSVG()` (figé), `markAnimSVG()` (animé), `brandLockup()` (logo + nom). Source de vérité. |
| `favicon.svg` | Favicon (triangle sur tuile navy). Lié dans le `<head>` des pages. |
| `logo.svg` | Export autonome de la version figée (handoff designer). |
| `css/aigen.css` | Style du bloc-marque : `.brand .wm .name` (police Sora), couleurs de thème (`--peri*`, `--accent-bright`, `--logo-ink`). |
| `js/aigen.js` | Injecte le logo dans le header/footer et l'animé dans le hero + gère le « boot ». |

**Pour changer la couleur/vitesse globalement :** tout est centralisé dans `js/logo.js` (constantes `PERI2`, `NODEG`, et le paramètre `dur` de l'animation).
