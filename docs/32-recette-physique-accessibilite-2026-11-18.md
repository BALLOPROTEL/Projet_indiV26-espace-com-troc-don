# Recette physique & accessibilité — 18 novembre 2026

## But

Fermer la dernière gate UX #71 sans refaire des contrôles déjà automatisés.

La CI couvre déjà :
- Chrome desktop et mobile 320/390 px ;
- touch emulation / pointeur grossier ;
- cibles tactiles >= 44 px ;
- absence d'overflow horizontal sur les principaux écrans ;
- navigation clavier/focus Keycloak ;
- focus-visible du bouton afficher/masquer le mot de passe ;
- forced-colors / High Contrast ;
- largeur du champ mot de passe desktop/mobile ;
- parcours VISITEUR / USER / MODERATOR / ADMIN ;
- DON/TROC, galerie MinIO et RBAC backend.

Preuve récente : Jury final browser run `44333998288` = SUCCESS sur #129, avec captures
`uxv3-keycloak-desktop-1280`, `uxv3-keycloak-mobile-390`,
`jury-admin-dashboard` et `jury-user-admin-denied`.

## Ce qui reste réellement manuel

### 1. iPhone / Safari

Appareil réel recommandé. À défaut : iPhone physique équivalent disponible.

1. Ouvrir l'accueil.
2. Vérifier qu'il n'existe aucun scroll horizontal.
3. Ouvrir une annonce avec 5 photos.
4. Faire défiler les miniatures / photo suivante-précédente.
5. Ouvrir `Mon espace`, se connecter et afficher le formulaire de publication.
6. Toucher chaque champ : le clavier virtuel ne doit masquer ni bloquer le bouton d'action.
7. Vérifier que les champs texte ne provoquent pas de zoom Safari intempestif.
8. Vérifier menu mobile, retour arrière et déconnexion.

**PASS si :** aucune zone inaccessible, aucun chevauchement, aucun zoom automatique gênant, galerie et navigation utilisables.

### 2. Android / Chrome

1. Refaire accueil → fiche annonce → galerie → connexion → Mon espace.
2. Vérifier menu mobile et boutons tactiles.
3. Vérifier qu'un champ actif reste visible quand le clavier virtuel apparaît.
4. Faire défiler jusqu'au bas du formulaire et revenir en arrière.
5. Vérifier déconnexion/reconnexion.

**PASS si :** aucun overflow, aucune action cachée, aucun élément impossible à toucher.

### 3. Zoom navigateur 200 %

Sur desktop Chrome/Edge/Firefox :

1. Mettre le zoom navigateur à **200 %**.
2. Tester accueil, fiche annonce, Mon espace, modération et ADMIN.
3. Vérifier que le menu se replie au besoin.
4. Vérifier que les textes et boutons ne se chevauchent pas.
5. Vérifier qu'aucun contenu essentiel n'impose un scroll horizontal permanent.

**PASS si :** contenu lisible, actions accessibles, pas de chevauchement bloquant.

### 4. Clavier, contrastes et réduction des animations

Sur desktop :

1. Ne pas utiliser la souris.
2. `Tab` depuis le haut de page.
3. Vérifier l'ordre logique du focus sur navigation, CTA, champs et boutons.
4. Vérifier que le focus reste clairement visible.
5. Ouvrir/fermer le menu si présent.
6. Se connecter puis parcourir Mon espace.
7. Vérifier le bouton œil Keycloak au clavier.
8. Avec l'outil de contraste du navigateur, contrôler les textes/actions représentatifs de l'accueil, d'une fiche, de Mon espace, modération et ADMIN : texte normal >= 4,5:1 ; grand texte / composants graphiques selon le seuil WCAG applicable.
9. Activer `prefers-reduced-motion: reduce` dans l'OS ou les DevTools Rendering, puis vérifier que les animations non essentielles sont supprimées ou fortement réduites et qu'aucune information ne dépend d'une animation.

**PASS si :** aucune action essentielle inaccessible, aucun piège clavier, contrastes conformes sur les écrans représentatifs et préférence `reduced-motion` respectée.

### 5. Réseau dégradé

Avec DevTools > Network > Slow 3G (ou réseau mobile réellement faible) :

1. Recharger l'accueil.
2. Ouvrir une fiche annonce.
3. Ouvrir une galerie 5 photos.
4. Accéder à Mon espace.
5. Vérifier qu'un chargement lent n'affiche pas de faux succès.
6. Vérifier que les erreurs restent compréhensibles et que la page ne devient pas inutilisable.

**PASS si :** états de chargement/erreur compréhensibles, aucune donnée fictive, récupération possible après retour réseau.

## Journal de preuve

| Test | Appareil / navigateur | Résultat | Preuve |
| --- | --- | --- | --- |
| iPhone / Safari | À renseigner | ☐ PASS / ☐ FAIL | capture |
| Android / Chrome | À renseigner | ☐ PASS / ☐ FAIL | capture |
| Zoom 200 % | À renseigner | ☐ PASS / ☐ FAIL | capture |
| Clavier + contrastes + reduced-motion | À renseigner | ☐ PASS / ☐ FAIL | capture / relevé contraste |
| Réseau dégradé | À renseigner | ☐ PASS / ☐ FAIL | capture |

## Règle de clôture

#71 et son parent #63 peuvent être fermés lorsque les 5 lignes ci-dessus sont PASS ou lorsqu'une anomalie découverte a été corrigée puis revalidée.

Cette recette ne demande **aucun reset de données**, aucune suppression de volume et aucune nouvelle fonctionnalité.
