# LOT 10-B — Checklist pré-soutenance et démo de secours

> Procédure non destructive. Le jour du jury, ne jamais improviser un nettoyage de volumes, une migration ou un correctif en direct.

## 1. Décision GO / NO GO avant la session

### Git
- [ ] `git status --short` propre ou changements locaux explicitement connus.
- [ ] `git rev-parse HEAD` relevé.
- [ ] version présentée = commit/release prévu.
- [ ] aucun secret dans le terminal, l’historique ou les onglets visibles.

### Machine / Codespaces
- [ ] au moins 4 Gio libres avant lancement de la stack jury.
- [ ] ports jury distincts de la stack de travail.
- [ ] aucune commande destructive prévue.
- [ ] alimentation/réseau stable si présentation locale.

### Jeu jury
- [ ] `pnpm jury:plan:check`.
- [ ] `pnpm jury:plan:test`.
- [ ] `pnpm jury:assets:check`.
- [ ] 20 médias autorisés.
- [ ] quatre acteurs : propriétaire, demandeur, modérateur, administrateur.

### Identité
- [ ] compte demandeur USER réellement connectable.
- [ ] compte propriétaire USER réellement connectable.
- [ ] MODERATOR fonctionne.
- [ ] ADMIN fonctionne.
- [ ] aucun mot de passe affiché dans les slides/captures.

### Stack
- [ ] Gateway healthy.
- [ ] Catalog healthy.
- [ ] Marketplace healthy.
- [ ] Notification healthy.
- [ ] Keycloak accessible.
- [ ] RabbitMQ accessible.
- [ ] MinIO accessible.
- [ ] Web accessible.

Si une gate critique échoue : **NO GO démo live complète** → passer au plan B/C.

---

## 2. Démo live — parcours compressé

Durée cible : **5 à 6 minutes maximum**.

### Étape A — Catalogue public (30 s)
- montrer une annonce approuvée ;
- ouvrir la galerie ;
- rappeler que les images sont servies par Catalog/MinIO.

### Étape B — USER demandeur (60–90 s)
- connexion ;
- ouvrir un DON ou TROC ;
- soumettre la demande ;
- vérifier le statut visible.

### Étape C — Propriétaire (60–90 s)
- changer réellement de compte ;
- **accepter la proposition retenue** ;
- vérifier la transition vers ACCEPTED / réservation et la création de la transaction ;
- ne pas choisir « Refuser » dans ce parcours live, sinon aucune transaction n’existe pour l’étape suivante.

Le parcours de refus reste démontrable via la preuve certifiée du DON refusé (artifact jury principal). Si l’on choisit volontairement de montrer un refus live, on **saute l’étape D** et on bascule ensuite sur cette preuve certifiée pour la double confirmation.

### Étape D — Confirmation (60–90 s)
- prérequis : proposition acceptée et transaction créée ;
- une première confirmation → IN_PROGRESS ;
- seconde confirmation depuis l’autre compte → COMPLETED.

### Étape E — ADMIN / RBAC (45–60 s)
- ouvrir le dashboard ADMIN ;
- montrer les indicateurs ;
- rappeler la preuve backend USER → ADMIN = 403.

### Étape F — TROC (option si temps) (45–60 s)
- montrer la comparaison des deux annonces et/ou la transaction certifiée ;
- si le temps est court, utiliser la capture certifiée plutôt que refaire l’intégralité du TROC.

---

## 3. Plan B — application accessible, parcours métier trop lent

Basculer immédiatement si :
- authentification lente ;
- un service met trop de temps ;
- une action live dépasse ~30–45 secondes ;
- le réseau devient instable.

Montrer :
1. l’application encore accessible ;
2. les captures certifiées de la recette jury ;
3. `jury-final-report.json` ;
4. le diagramme M10 ;
5. les résultats JMeter/HPA ;
6. les preuves RBAC.

Dire explicitement :

> « Je bascule sur la preuve certifiée de ce même parcours pour ne pas transformer la soutenance en séance de dépannage. »

Ne pas prétendre que la capture est une action live.

---

## 4. Plan C — application indisponible

Utiliser uniquement des preuves déjà certifiées.

### Artifact jury principal
- run : `44333998288`;
- artifact : `14441750513`;
- 4 acteurs ;
- 4 annonces ;
- 20 médias ;
- DON refusé ;
- DON terminé ;
- TROC terminé ;
- ADMIN 200 / USER 403.

Archive Library :
`/Projet_individuel26/Preuves/Final_2026-11-18/jury-final-browser-evidence.zip`

### Artifact réseau/accessibilité
- #137 HEAD : `9291b85856f245fcefd4c3ff3a4ec9618e0b723c`;
- run : `44409560702`;
- artifact : `14477287192`;
- Slow 3G ;
- cache Chrome désactivé ;
- pixels MinIO réellement chargés ;
- Mon espace stabilisé ;
- panne Catalog ;
- récupération via `Réessayer`.

Archive Library :
`/Projet_individuel26/Preuves/Final_2026-11-18/network-degraded-final-pr137.zip`

### Couverture
Archive :
`/Projet_individuel26/Preuves/Final_2026-11-18/api-coverage-e886d457.zip`

### Sécurité
Archive :
`/Projet_individuel26/Preuves/Final_2026-11-18/security-reports-e886d457.zip`

---

## 5. Matériel à garder ouvert avant de commencer

Ordre recommandé des onglets :

1. support de présentation ;
2. application catalogue ;
3. Mon espace du premier compte ;
4. page Keycloak/login prête pour changement de compte ;
5. diagramme M10 ;
6. preuves de secours ;
7. GitHub Actions uniquement si nécessaire.

Éviter :
- dix onglets GitHub ;
- terminal avec secrets ;
- console navigateur ouverte ;
- logs verbeux ;
- IDE en plein écran pendant l’oral.

---

## 6. Ce qu’il ne faut jamais faire devant le jury

- lancer `docker compose down -v` ;
- supprimer un PVC ;
- lancer un prune ;
- modifier directement la base pour fabriquer un statut ;
- changer un rôle Keycloak pour simuler un autre utilisateur ;
- relancer une CI longue en espérant qu’elle finisse pendant la soutenance ;
- déboguer plus d’une minute ;
- montrer un token, mot de passe, cookie ou secret ;
- annoncer une fonctionnalité non prouvée.

---

## 7. Checklist de sortie

Après la répétition finale :
- [ ] temps total <= 20 min ;
- [ ] démo <= 6 min ;
- [ ] aucune slide > 2 min 30 ;
- [ ] introduction < 1 min ;
- [ ] limites expliquées sans se dévaloriser ;
- [ ] Plan B testé ;
- [ ] Plan C testé ;
- [ ] vidéo de secours enregistrée et lisible ;
- [ ] support final exporté ;
- [ ] artifacts copiés localement / Library ;
- [ ] commit/tag final relevé ;
- [ ] aucune donnée sensible dans le support.
