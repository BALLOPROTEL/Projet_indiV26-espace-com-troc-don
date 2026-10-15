# FRONT-V2 / Epic #63 — Skills design & recette UI

## Provenance
Référence publique : https://github.com/emilkowalski/skills — snapshot `2d228630ba1446365f614a108cb8252f1feda202`.
Fichiers projet dans `.agents/skills/` :
- `emil-design-eng/SKILL.md`
- `mobile-native/SKILL.md`
- `break-ui/SKILL.md` et son `CATALOG.md`.
Le contenu original est redistribué selon la licence MIT d'Emil Kowalski (copie dans `.agents/skills/UPSTREAM-LICENSE.txt`). Ne pas écraser ces fichiers sans vérifier le nouvel upstream.

Ces skills **guident Codex** : ils ne remplacent pas les tests, le navigateur, les contrôles RBAC du backend ou l'évaluation humaine. Ils sont intégrés dans le dépôt pour rester disponibles dans Codespaces sans exécuter une installation externe à chaque session.

## Plan de recette de l'Epic
| Lot | Cible | Contrôles |
| --- | --- | --- |
| F1 #65 | Accueil / 6 annonces par page | 0, 1, 6, 7, 100+ annonces ; recherche, pagination et états d'erreur ; écrans 320, 390, 768, 1280 px |
| F2 #66 | Fiche et galerie | 0 / 5 / 8 photos MinIO, grandes et petites images, navigation clavier, photos invalides, DON/TROC et CTA accessibles |
| F3 #67 | Dashboard MODERATOR | Texte très long, accent, filtres, file vide, erreur API vs erreur action, annonce privée, contraste, pas de statistiques inventées |
| F4 #68 | Backend ADMIN | 401 sans token, 403 USER et MODERATOR, 200 ADMIN, route Gateway exacte, métriques sur données réelles |
| F5 #69 | Dashboard ADMIN | Route directe /admin refusée pour non-ADMIN, état vide/erreur, données réelles, milliers avec format FR, grille mobile sans débordement |
| F7 #71 | Recette transversale | Zoom 200 %, clavier, `:focus-visible`, `prefers-reduced-motion`, hover vs tactile, appareils physiques et Chrome E2E |

## Exigences UX à ne pas confondre
1. **Aucune donnée métier simulée en production.** Les fixtures extrêmes de `break-ui` restent dans les tests ou une route dev-only explicitement non déployée.
2. Contrastes texte normaux **≥ 4.5:1** ; nom, statuts et nombres lisibles à zoom 200 %.
3. Les indications d'attente, erreurs et résultats filtrés sont annoncées correctement aux technologies d'assistance (`role=status` / `aria-live` / `role=alert`).
4. Sur écran tactile, éviter les effets `:hover` persistants ; boutons ≥ 44px selon le contexte, `touch-action: manipulation`, champs de saisie à 16px pour éviter le zoom automatique iOS.
5. N'animer que lorsqu'une transition informe ou aide ; respecter `prefers-reduced-motion` et éviter `transition: all`.
6. Les textes longs, identifiants et nombres ne doivent jamais déborder ; préférer `overflow-wrap: anywhere` sur les champs qui peuvent contenir des chaînes non sécables, `min-width: 0` dans grid/flex et chiffres tabulaires.
7. Chrome mobile émulé ne certifie pas les détails natifs : prévoir un contrôle Safari iOS / Chrome Android réel avant validation finale.

## Procédure de PR
1. Associer la PR à l'issue ; décrire les parcours et les risques.
2. Passer lint, typecheck, Vitest, build, puis E2E Chrome / RBAC nécessaires.
3. Demander `@codex review` (et `@codex security review` pour auth/API).
4. Traiter chaque remarque, répondre dans les fils, renouveler la revue sur le dernier HEAD.
5. Faire valider visuellement par le propriétaire et **attendre son GO explicite avant toute fusion**.

La consolidation des preuves et la préparation de la soutenance restent hors périmètre jusqu'à la clôture du chantier frontend.
