# LOT 9B-F — Certification transversale finale

**Statut : EN COURS (issue #56).** Ceci est une première gate de certification, pas la clôture de LOT 9B-F.

## Gate A — Galerie et modération réelles

`scripts/lot9bf-media-certification.mjs` est lancé dans le même Compose **jetable** que M8/M9, lorsque `LOT9BF_RUN_MEDIA=true` et `M8_RUN_INTEGRATION=true` ; `M9_RUN_WORKFLOWS` n'est pas obligatoire. Il refuse d'exécuter des mutations dans un Compose non nommé `projet-indiv26-m6-ci` ou sans `M8_RUN_INTEGRATION=true`.

- Création réelle via API Gateway de trois annonces PENDING : un DON, un TROC et une contrepartie TROC.
- Génération locale de 15 images PNG uniques entre les trois annonces et entre chaque position (5 par annonce, sans dépendance ni image tierce).
- Upload multipart authentifié via Gateway vers Catalog / MinIO ; lecture publique avec comparaison octet pour octet.
- Accès à une annonce PENDING : 404 ; modération avant 5 images : 400 ; non-modérateur : 403 ; upload d'un tiers, même modérateur : 403.
- Pour chacune des 15 images PENDING : lecture publique 404 et lecture sans JWT 401 ; lecture privée modérateur et propriétaire comparée octet pour octet ; lecture privée par un autre simple membre refusée 403 (annonces du modérateur).
- La publication utilise le timestamp effectivement lu dans la file de modération (identique au frontend), et les cinq souhaits TROC sont comparés à leurs libellés originaux, pas seulement comptés.
- Approbation avec `reviewedUpdatedAt` après relecture dans l'inbox modération.
- Publication de 3 annonces avec 5 images chacune ; vérification de 5 souhaits distincts pour les 2 TROC.

**Attention :** cette étape utilise l'API HTTP réellement consommée par le Web, mais **pas encore les clics Chrome sur la création/upload/modération**. M9 couvre déjà l'interaction Chrome DON/TROC jusqu'à la double confirmation pour des annonces synthétiques. LOT 9B-F reste ouvert tant que les deux parcours ne sont pas combinés.

## Archive M9, 16 captures

Les seize captures PNG du [run Chrome M9 #38090618298](https://github.com/BALLOPROTEL/Projet_indiV26-espace-com-troc-don/actions/runs/38090618298) ont été téléchargées le 12/10/2026, avec signatures vérifiées et manifeste SHA-256 intégré dans l'archive ZIP.

- Archive privée pérenne : bibliothèque ChatGPT `/Projet_individuel26/Preuves/M9/Projet_individuel26_M9_16_captures_archive_2026-10-12.zip`.
- SHA-256 ZIP : `2fdc1dec6ffcba61e9b122322115a8a52708eddd4f9b5b115d2087e62af9a716`.
- Artefact GitHub Actions source : #11684230573 (expire le **17/10/2026**).
- Le chemin Library n'est **pas** un lien GitHub téléchargeable par le jury. Exporter le ZIP lors de la constitution du dossier #58.

## Gates restantes

- [ ] Gate A exécutée et verte en CI sur le dernier HEAD, après revue Codex.
- [ ] Extension navigateur : publier et modérer avec cinq fichiers via le formulaire avant le workflow transactionnel existant.
- [ ] Jeu de données de démonstration crédible, reproductible et légalement réutilisable.
- [ ] Vérifications sécurité, pannes, intégration complète et preuves durables.
- [ ] Dossier de recette final et validation explicite pour fermer #35.

Ne pas lancer cette recette contre le Codespace ou Minikube persistants. Ne pas attendre les CI longues en conversation : transmettre les références et vérifier sur demande.
