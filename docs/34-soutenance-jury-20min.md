# LOT 10-B — Storyboard et script de soutenance jury (20 minutes)

> Référence de préparation pour l'issue #59. Ce document prépare le support et l'oral ; il ne vaut pas répétition chronométrée réelle ni vidéo de secours enregistrée.

## 1. Message directeur

La soutenance doit démontrer une idée simple :

> **La Petite Maison de l’Épouvante est passée d’un POC monolithique à une plateforme microservices démontrable, testée de bout en bout et accompagnée de preuves techniques reproductibles.**

Trois fils rouges à conserver du début à la fin :

1. **Métier** : publier, modérer, donner ou troquer un objet, puis confirmer la remise entre deux utilisateurs.
2. **Architecture** : Gateway, Catalog, Marketplace, Notification, Keycloak, RabbitMQ, PostgreSQL et MinIO.
3. **Preuves** : CI, tests navigateur réels, sécurité, performance, observabilité et limites assumées.

Ne jamais présenter une capacité de laboratoire comme une garantie de production.

---

## 2. Découpage 20 minutes

| Temps | Partie | Objectif |
| --- | --- | --- |
| 00:00–01:00 | Introduction | Problème, solution, promesse |
| 01:00–02:15 | Besoin métier | DON/TROC, rôles, contraintes |
| 02:15–04:45 | Architecture + flux | Microservices, Strangler, cycle DON/TROC |
| 04:45–06:00 | Sécurité / identité | Keycloak, JWT, RBAC |
| 06:00–07:15 | CI/CD et qualité | GitHub Actions, gates, Trivy, couverture |
| 07:15–08:30 | Observabilité / performance | Prometheus/Grafana, JMeter/HPA |
| 08:30–14:30 | Démo métier | DON/TROC + rôles + galerie |
| 14:30–16:15 | Résilience et limites | Outbox partielle, SQL partagé, Legacy, labo |
| 16:15–17:45 | Résultats / preuves | Runs, artifacts, chiffres clés |
| 17:45–18:30 | Conclusion | Bilan, apprentissages, suite |

Budget cible : **18 min 30**, soit **1 min 30 de marge** avant le plafond des 20 minutes. Les slides 3 et 4 partagent explicitement le même créneau Architecture + flux de 2 min 30.

---

## 3. Storyboard — 11 slides

### Slide 1 — Titre et promesse
**La Petite Maison de l’Épouvante — plateforme de DON/TROC en architecture microservices**

À dire :
- projet CESI individuel ;
- objectif : passer d’un POC à une plateforme démontrable ;
- le jury verra le métier, l’architecture et les preuves.

Durée cible : **1 min**.

### Slide 2 — Besoin métier et utilisateurs

Montrer :
- VISITOR : consulte le catalogue ;
- USER : publie, demande un DON, propose un TROC, confirme une remise ;
- MODERATOR : contrôle et approuve les annonces ;
- ADMIN : accède aux indicateurs et fonctions réservées.

Contraintes métier importantes :
- 5 à 8 images par annonce ;
- modération avant publication ;
- DON et TROC avec statuts persistés ;
- double confirmation avant clôture ;
- séparation des droits.

Durée : **1 min 15**.

### Slide 3 — Architecture finale

Montrer le diagramme M10 simplifié :

Navigateur → Gateway → Catalog / Marketplace / Legacy  
Keycloak pour OIDC/JWT  
Marketplace ↔ Catalog par HTTP interne  
Marketplace → RabbitMQ → Notification  
PostgreSQL + MinIO  
Prometheus/Grafana en laboratoire

À dire :
- le Gateway centralise l’entrée HTTP ;
- Catalog possède les annonces/images/souhaits ;
- Marketplace possède propositions et transactions ;
- Notification consomme les événements RabbitMQ ;
- Legacy reste partiellement présent dans une stratégie Strangler.

Durée : **1 min 45**.

### Slide 4 — Flux DON/TROC

Montrer un schéma très simple :

Publication → PENDING → modération → APPROVED  
Demande → PENDING → ACCEPTED/REJECTED  
Acceptation → RESERVED → IN_PROGRESS  
2 confirmations → COMPLETED

Pour un TROC :
- deux annonces sont réservées ;
- compensation best effort si la seconde réservation échoue.

Durée : **45 s**. Cette slide partage le créneau Architecture + flux avec la slide 3.

### Slide 5 — Sécurité et identité

Points :
- Keycloak OIDC Authorization Code + PKCE ;
- JWT validé dans les services métier ;
- rôles USER / MODERATOR / ADMIN ;
- preuve ADMIN autorisé et USER refusé 403 ;
- images privées non publiques avant approbation.

Nuance :
- les secrets Compose sont locaux ;
- pas de mTLS/service mesh démontré ;
- principal PostgreSQL encore partagé en laboratoire.

Durée : **1 min 15**.

### Slide 6 — CI/CD et qualité

Montrer la chaîne :
- lint / typecheck ;
- tests unitaires ;
- intégration PostgreSQL ;
- contrats ;
- E2E HTTP/JWT/RabbitMQ ;
- Chrome réel ;
- Bootstrap ;
- audit dépendances ;
- Trivy HIGH/CRITICAL.

Chiffres de couverture API Bootstrap #569 :
- lignes : **96,44 %** ;
- statements : **96,61 %** ;
- fonctions : **100 %** ;
- branches : **93,51 %**.

Précision obligatoire :
- ces pourcentages concernent **3 fichiers API configurés**, pas tout le projet.

Durée : **1 min 15**.

### Slide 7 — Observabilité et performance

Performance laboratoire :
- baseline : 8 767 requêtes, 0 % erreur, p95 47 ms ;
- stress : 35 962 requêtes ;
- débit ≈ **299,7 req/s** ;
- erreur **0,067 %** ;
- p95 **399 ms** ;
- HPA Gateway : **1 → 4 réplicas**.

Observabilité :
- Prometheus + Grafana ;
- health/readiness ;
- logs corrélés ;
- Prometheus scrute réellement le **Gateway**, pas tous les microservices.

Durée : **1 min 15**.

### Slide 8 — Démo live

Ne pas expliquer trop longtemps : basculer sur le navigateur.

Parcours recommandé :
1. catalogue public + galerie ;
2. compte USER demandeur ;
3. création/consultation d’une demande DON ou TROC ;
4. compte propriétaire : **accepter** la proposition retenue pour créer la transaction ;
5. double confirmation obligatoire sur ce parcours live : première confirmation → IN_PROGRESS, seconde → COMPLETED ;
6. ADMIN : indicateurs ;
7. USER : refus ADMIN.

Objectif : démontrer le **changement d’état réel**, pas refaire tous les tests du projet.

Durée maximum : **6 min**.

### Slide 9 — Preuves de certification

Présenter :
- 4 acteurs distincts ;
- 4 annonces ;
- 20 médias autorisés ;
- 20/20 byte-identiques après upload navigateur ;
- DON refusé : PASS ;
- DON accepté + double confirmation : PASS ;
- TROC accepté + double confirmation : PASS ;
- ADMIN 200 / USER 403 : PASS ;
- événement `proposal.rejected` unique : PASS.

Références :
- run jury final `44333998288` ;
- artifact `14441750513` ;
- réseau complet #137 : run `44409560702`, artifact `14477287192`.

Durée : **1 min 30**.

### Slide 10 — Limites assumées

Dire explicitement :
- PostgreSQL partagé en laboratoire ; ownership logique ≠ isolation SQL ;
- Keycloak Minikube utilise aussi le principal PG commun ;
- outbox généralisée **non** implémentée : elle protège surtout le refus ;
- compensation distribuée best effort ;
- Legacy encore présent ;
- Prometheus ne scrute que le Gateway ;
- pas de NetworkPolicy/mTLS/HA multi-zone/SLO production ;
- Next.js : 0 HIGH/CRITICAL à l’audit actuel, 2 advisories MODERATE suivies en #115 ;
- Trivy #569 : 0 HIGH/CRITICAL détectée, LOW/MEDIUM hors périmètre de cette gate.

Cette slide est importante : elle montre la maîtrise technique plutôt qu’une promesse irréaliste.

Durée : **1 min 45**.

### Slide 11 — Conclusion

Message :
- le métier principal est fonctionnel ;
- l’architecture microservices est réellement exécutée ;
- les décisions sont soutenues par des preuves ;
- les limites de laboratoire sont connues ;
- la prochaine étape serait le durcissement production : isolation DB, sécurité réseau, outbox généralisée, observabilité multi-services, sauvegardes/HA.

Phrase de fermeture :

> « Mon objectif n’était pas seulement de faire fonctionner une application, mais de pouvoir expliquer, tester et prouver son comportement de bout en bout. »

Durée : **45 s**.

---

## 4. Script oral chronométré

### 00:00–01:00 — Introduction

« Mon projet s’appelle La Petite Maison de l’Épouvante. C’est une plateforme de don et de troc d’objets. Mon objectif a été de partir d’un POC existant et de le faire évoluer vers une architecture microservices testable, observable et démontrable devant un jury. Je vais vous présenter le besoin métier, l’architecture, les choix de sécurité et de qualité, puis vous montrer le parcours réel dans l’application. »

### 01:00–02:15 — Métier

« Le parcours repose sur quatre rôles. Un visiteur consulte le catalogue. Un utilisateur peut publier un objet, demander un don ou proposer un troc. Un modérateur vérifie les annonces avant leur publication. Un administrateur accède aux indicateurs réservés. Une transaction n’est considérée terminée qu’après confirmation des deux participants. »

### 02:15–04:45 — Architecture + flux DON/TROC

« L’entrée principale est l’API Gateway. Le Catalog Service gère les annonces, les images MinIO, les souhaits de troc et la modération. Le Marketplace Service gère les propositions, réservations, transactions et confirmations. Le Notification Service reçoit les événements via RabbitMQ. Keycloak porte l’identité et les rôles. PostgreSQL stocke les données métier dans plusieurs schémas. Le Legacy reste partiellement actif dans une stratégie Strangler. Côté métier, une annonce passe de PENDING à APPROVED après modération ; une proposition acceptée réserve les ressources, crée une transaction IN_PROGRESS, puis les deux confirmations terminent la transaction en COMPLETED. »

### 04:45–06:00 — Sécurité

« L’authentification repose sur Keycloak avec OIDC et PKCE. Les services métier valident le JWT et appliquent les règles de rôles et de propriété. Nous avons une preuve réelle qu’un ADMIN peut appeler l’API d’administration tandis qu’un USER reçoit un 403. Les médias d’une annonce en attente restent privés. En revanche, le laboratoire utilise encore un principal PostgreSQL partagé : ce n’est pas une séparation de sécurité suffisante pour une production. »

### 06:00–07:15 — CI/CD

« La qualité n’est pas vérifiée uniquement à la main. GitHub Actions exécute lint, typecheck, tests unitaires, intégration, contrats, E2E, Chrome réel et scans de sécurité. Le Bootstrap certifié publie aussi une couverture API : 96,44 % des lignes et 93,51 % des branches, mais seulement sur trois fichiers explicitement ciblés. Je ne généralise donc pas ce chiffre à toute l’application. »

### 07:15–08:30 — Performance / observabilité

« En laboratoire, le stress test a traité 35 962 requêtes à environ 300 requêtes par seconde, avec 0,067 % d’erreurs et un p95 de 399 ms. Le HPA du Gateway est monté jusqu’à quatre réplicas. Prometheus et Grafana permettent de suivre le Gateway et les health checks, mais je n’affirme pas une observabilité complète de tous les services ni des SLO de production. »

### 08:30–14:30 — Démo

Parler très peu. Annoncer chaque changement d’acteur et chaque statut.

Phrases utiles :
- « Je suis maintenant connecté avec le compte demandeur. »
- « La proposition passe ici à PENDING. »
- « Je bascule sur le propriétaire ; pour ce parcours live, j’accepte la proposition afin de créer la transaction. Le refus est déjà certifié séparément dans les preuves. »
- « Une première confirmation ne termine pas la transaction. »
- « Après la seconde confirmation, la transaction et l’annonce sont COMPLETED. »
- « Ici, un ADMIN voit le tableau de bord ; avec un USER, la même fonction est refusée. »

Ne pas commenter chaque clic.

### 14:30–16:15 — Résilience et limites

« Le projet comporte aussi des choix qui restent volontairement imparfaits. L’outbox n’est pas généralisée à tous les événements. Certaines transitions distribuées reposent sur une compensation best effort. Le Legacy n’est pas entièrement retiré. La base PostgreSQL est partagée. Prometheus scrute surtout le Gateway. Ce sont des limites que j’ai documentées parce qu’une architecture crédible doit aussi expliquer ses zones de risque. »

### 16:15–17:45 — Preuves

« La recette jury automatisée a validé quatre acteurs, quatre annonces et vingt médias autorisés. Les vingt médias ont été vérifiés byte-à-byte après upload. Le DON refusé, le DON accepté, le TROC, la double confirmation et le RBAC sont tous certifiés. Un second parcours a validé l’application sous Slow 3G, y compris les pixels MinIO hors cache, Mon espace, une panne Catalog et la récupération. »

### 17:45–18:30 — Conclusion

« Le résultat est une plateforme fonctionnelle et surtout explicable : chaque affirmation importante peut être reliée à un test, un run, un artifact ou une limite documentée. Pour aller vers la production, je renforcerais l’isolation SQL, la sécurité réseau, l’outbox, l’observabilité de tous les services et la haute disponibilité. »

---

## 5. Règles d’oral

- Une slide = une idée principale.
- Ne jamais lire les diagrammes bloc par bloc.
- Ne jamais annoncer « production ready ».
- Toujours qualifier Kubernetes/JMeter/Prometheus comme **preuves de laboratoire**.
- Dire « 0 HIGH/CRITICAL détectée » pour Trivy, jamais « zéro vulnérabilité ».
- Dire « couverture API ciblée » pour les pourcentages Jest.
- Ne jamais exposer secret, mot de passe, token, cookie, URL signée ou e-mail privé.
- Si la démo ralentit, basculer immédiatement sur le plan de secours plutôt que déboguer devant le jury.

---

## 6. Questions probables du jury

### Pourquoi des microservices ?
Réponse : séparation claire des responsabilités métier, contrats HTTP/AMQP, déploiement/test isolé et capacité d’évolution. Contrepartie : complexité distribuée, cohérence et observabilité plus difficiles.

### Pourquoi RabbitMQ ?
Réponse : découplage de Notification et possibilité de retry/ACK. Limite : l’outbox n’est pas généralisée à tous les événements.

### Pourquoi Keycloak ?
Réponse : centraliser OIDC, rôles et identité au lieu de réimplémenter l’authentification.

### Que se passe-t-il si le deuxième service Catalog échoue pendant un TROC ?
Réponse : la réservation possède une compensation best effort. Pour la clôture, aucune transaction distribuée ne garantit l’atomicité entre les deux annonces ; un diagnostic/rattrapage opérateur est nécessaire.

### Est-ce prêt pour la production ?
Réponse : non. Les flux sont fonctionnels et testés, mais l’environnement reste un laboratoire. Isolation SQL, réseau, HA, sauvegarde, Keycloak production, outbox généralisée, observabilité multi-services et durcissements publics restent à traiter.

### Quelle preuve avez-vous que ce n’est pas seulement une maquette frontend ?
Réponse : tests E2E HTTP/JWT/RabbitMQ, Chrome réel, vérification des états API persistés, images MinIO byte-identiques, RBAC backend 403, JMeter/HPA et artifacts GitHub versionnés.
