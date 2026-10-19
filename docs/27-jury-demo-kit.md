# LOT 9B-F — Kit de démonstration jury (étape 1 : plan)

**État : DRAFT. Pas de seed, pas de reset, pas de médias livrés.** Ceci est un scénario préparatoire pour l'issue [#56](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/issues/56), distinct des fixtures jetables certifiées en CI par la PR #61.

## Vérifications faites sur le dépôt

Le realm de labo dispose de `demo-user` (USER), `demo-moderator` (MODERATOR) et `demo-admin` (ADMIN). **Il manque encore un deuxième USER distinct** : `actors.memberRequester` vaut `null` dans le manifeste. Aucun compte fictif n'est présenté comme existant.

Le manifeste réserve **quatre annonces** : deux dons (lampe, étagère) et deux annonces de troc (sac et livres), chacune avec **cinq photos à fournir**. Ces vingt chemins d'images ne pointent pas vers des photos réellement présentes. **Il est interdit de présenter le kit comme prêt tant que les droits de réutilisation et les fichiers n'ont pas été validés.**

## Démonstration prévue une fois les données préparées

1. Le membre propriétaire publie ses dons et son annonce TROC avec cinq photos par article, et cinq souhaits distincts pour chaque troc.
2. Le modérateur consulte les annonces `PENDING` et la galerie privée, puis approuve.
3. Le deuxième membre formule deux demandes DON : une sera refusée, l'autre acceptée ; il propose son annonce de livres comme contrepartie du sac.
4. Le propriétaire refuse la première demande, accepte la seconde et le troc. Les disponibilités deviennent réservées.
5. Les deux membres confirment chaque transaction acceptée jusqu'à `COMPLETED` ; consulter l'historique et les notifications persistées.
6. L'administrateur affiche ses indicateurs de catalogue réels ; vérifier l'accès refusé aux rôles non ADMIN.

## Contrôles de sécurité du manifeste

- Les comptes `memberOwner` et `memberRequester` doivent être **deux utilisateurs distincts**. Les identités du modérateur et de l'administrateur doivent aussi être différentes de celles des membres et l'une de l'autre. Ce contrôle vérifie uniquement les identifiants déclarés ; les **rôles réels Keycloak/RBAC** doivent encore être vérifiés lors de la recette.
- Chaque photo doit être une image régulière identifiable (signature JPEG, PNG ou WebP) d'au plus **5 Mio**, et posséder une entrée de provenance propre au fichier : source, auteur, autorisation, conditions et date réelle **non future**. L'approbation juridique reste manuelle.
- Les tests unitaires Node s'appuient sur des **fixtures de brouillon autonomes**, et non sur les avertissements du manifeste réel : la conversion du jeu de données en `READY_FOR_REVIEW` ne peut donc pas casser les tests de brouillon.
- La CI exécute le contrôle des médias `--assets` **automatiquement** dès que le manifeste du dépôt porte le statut `READY_FOR_REVIEW`. Ne changer ce statut qu'après constitution du second compte et des vingt photos autorisées, dans un environnement isolé.

## Contrôles sûrs (aucune connexion à la base)

```bash
pnpm jury:plan:check   # Vérifie le schéma : doit avertir que le kit reste incomplet
pnpm jury:plan:test    # Tests natifs Node, sans dépendance serveur
pnpm jury:assets:check # Gate bloquante tant que membre, médias ou crédits manquent
```

Fournir uniquement des images réutilisables légalement. Compléter le `creditId` de chaque photo et une entrée **correspondante** dans le registre structuré `demo/jury/assets/provenance.json` (source, auteur, licence/autorisation, date, conditions, droit de démonstration), en suivant `demo/jury/assets/CREDITS.md`. Ce contrôle informatique ne remplace pas la vérification humaine des licences. En outre, la gate refuse les répertoires, les fichiers vides, les signatures média invalides, les textes hors limites API et les scénarios DON/TROC incohérents. Avant le contrôle strict, un responsable doit marquer explicitement le manifeste `READY_FOR_REVIEW`. Ne jamais intégrer mots de passe, tokens ni données personnelles dans Git.

## Relance et secours

- Avant toute manipulation dans Codespaces : `git status`, `df -h .`, puis `pnpm codespaces:check`. Ces vérifications ne doivent pas détruire les données.
- Créer et valider les données uniquement dans un **environnement de démonstration explicitement choisi**, jamais via un seed silencieux en production ni une réinitialisation du Codespace courant.
- Relever les identifiants des annonces et propositions dans des notes de session non versionnées ; ne pas les inventer.
- **Codespaces : interdiction absolue** de `docker compose down -v`, `docker system prune`, supprimer les volumes/PVC, purger la base ou réinitialiser des données utilisateur. Aucune exception, même avec sauvegarde ou accord. Une procédure de reconstruction ne peut être envisagée que dans un **environnement éphémère externe distinct**, avec plan de retour arrière vérifié.
- Préparer une procédure de démonstration et un mode de secours après validation des vraies données ; les captures Chrome CI ne doivent pas être présentées comme un essai physique ou une preuve de démo live.

## Critères restants avant clôture

- [ ] Deuxième USER réellement provisionné et RBAC vérifié.
- [ ] 20 fichiers images réels disponibles et droits vérifiés.
- [ ] Création, publication, DON/TROC et double confirmation réellement testés depuis l'interface avec ce dataset.
- [ ] Procédure de réinitialisation **non destructive**, rapport de recette, preuve des statuts finaux.
- [ ] Validation explicite pour fermer #56/#35.

Les preuves LOT 10-A et les slides LOT 10-B attendront la réussite de cette phase et de la recette physique mobile #71.
