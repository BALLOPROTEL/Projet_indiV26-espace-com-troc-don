# LOT 9B-B — Stockage objet S3-compatible et images

## Objectif

Ajouter un vrai stockage d'images au parcours marketplace sans stocker les fichiers binaires dans PostgreSQL.

Le sous-lot fournit :
- MinIO local compatible S3 ;
- bucket privé `listing-images` ;
- utilisateur applicatif à privilèges limités ;
- upload sécurisé de 5 à 8 images ;
- métadonnées en PostgreSQL ;
- lecture publique uniquement pour une annonce approuvée ;
- suppression/remplacement réservé au propriétaire ;
- validation Docker, Kubernetes, sécurité et intégration réelle.

Le frontend d'upload est volontairement réservé au LOT 9B-C.

## Architecture

~~~text
Navigateur
   |
   | multipart/form-data
   v
API NestJS
   |
   +--> validation ownership
   +--> validation nombre d'images
   +--> validation taille / MIME / signature binaire
   |
   +--> S3 API --> MinIO --> bucket privé listing-images
   |
   +--> PostgreSQL --> ListingImage
~~~

L'application utilise l'API S3 via le SDK AWS.

Le code métier n'importe aucune API spécifique à MinIO. Une cible S3-compatible peut donc remplacer MinIO sans modifier le modèle métier.

## Stockage PostgreSQL

PostgreSQL conserve uniquement :
- l'identifiant de l'image ;
- le listing parent ;
- l'object key interne ;
- le MIME validé ;
- la taille ;
- la position.

Le binaire reste dans le stockage objet.

## Contraintes d'upload

Un lot doit contenir :
- minimum : **5 images** ;
- maximum : **8 images**.

Chaque fichier :
- maximum **5 MiB** ;
- JPEG, PNG ou WEBP ;
- type détecté par signature binaire ;
- MIME déclaré obligatoirement cohérent avec la signature.

Le nom de fichier envoyé par le navigateur n'est jamais utilisé comme object key.

L'API génère une clé du type :

~~~text
listings/<listingId>/<uuid>.<extension>
~~~

Cela évite :
- path traversal ;
- collision sur les noms fournis par l'utilisateur ;
- exposition d'un chemin contrôlé par le client.

## Endpoints

### Remplacer le lot d'images

~~~text
PUT /api/listings/:id/images
Authorization: Bearer <JWT>
Content-Type: multipart/form-data

champ répété : images
~~~

Conditions :
- utilisateur authentifié ;
- propriétaire de l'annonce ;
- annonce non APPROVED ;
- annonce encore AVAILABLE ;
- 5 à 8 fichiers valides.

Le remplacement remet l'annonce en `PENDING` et efface l'ancien motif de modération.

### Supprimer les images

~~~text
DELETE /api/listings/:id/images
Authorization: Bearer <JWT>
~~~

Réservé au propriétaire d'une annonce modifiable.

### Métadonnées publiques

~~~text
GET /api/listings/:id/images
~~~

Disponible uniquement si l'annonce est `APPROVED`.

La réponse n'expose jamais `objectKey`.

### Contenu public

~~~text
GET /api/listings/:id/images/:imageId/content
~~~

Disponible uniquement lorsque l'image appartient à une annonce `APPROVED`.

Le bucket MinIO reste privé : le navigateur ne parle jamais directement au bucket dans ce sous-lot.

## Atomicité et rollback

Une transaction SQL ne peut pas englober directement S3 et PostgreSQL.

La stratégie utilisée est donc :

1. valider le lot complet ;
2. vérifier la disponibilité du bucket ;
3. uploader les nouveaux objets avec des clés aléatoires ;
4. enregistrer le nouveau lot de métadonnées dans PostgreSQL ;
5. supprimer en best effort les anciens objets.

Si l'upload échoue en cours de lot :
- les nouveaux objets déjà écrits sont supprimés.

Si PostgreSQL échoue après l'upload :
- tous les nouveaux objets sont supprimés.

Si la suppression finale des anciens objets échoue :
- la nouvelle version reste fonctionnelle ;
- l'incident est journalisé ;
- seuls des objets orphelins peuvent rester, jamais une référence PostgreSQL cassée.

## MinIO Docker

Services :

~~~text
minio
minio-init
~~~

Ports locaux :

~~~text
127.0.0.1:9000  S3
127.0.0.1:9001  console
~~~

Les ports sont liés à localhost uniquement.

Le bootstrap :
- crée le bucket `listing-images` ;
- force l'accès anonyme à `none` ;
- crée l'utilisateur `marketplace-api` ;
- applique une policy bucket-scoped.

Le compte applicatif reçoit uniquement :
- GetBucketLocation ;
- ListBucket ;
- GetObject ;
- PutObject ;
- DeleteObject.

Il ne reçoit pas `s3:*` ni de droit d'administration MinIO.

## Minikube

MinIO est déployé avec :
- PVC 2 Gi ;
- Service ClusterIP ;
- aucun Ingress ;
- probes ;
- ressources CPU/mémoire ;
- non-root ;
- seccomp RuntimeDefault ;
- no privilege escalation ;
- capabilities Linux supprimées.

Les secrets sont créés au runtime par `scripts/lot6-minikube-up.sh`.

L'API reçoit uniquement :

~~~text
S3_ACCESS_KEY
S3_SECRET_KEY
~~~

Les variables :

~~~text
MINIO_ROOT_USER
MINIO_ROOT_PASSWORD
~~~

ne sont pas injectées dans le pod API.

## Configuration

Variables API :

~~~text
S3_ENDPOINT
S3_REGION
S3_BUCKET
S3_ACCESS_KEY
S3_SECRET_KEY
S3_FORCE_PATH_STYLE
~~~

Développement Docker :

~~~text
S3_ENDPOINT=http://127.0.0.1:9000
S3_REGION=us-east-1
S3_BUCKET=listing-images
S3_ACCESS_KEY=marketplace-api
S3_SECRET_KEY=marketplace_storage_local_change_me_2026
S3_FORCE_PATH_STYLE=true
~~~

Les valeurs ci-dessus sont des credentials de laboratoire local et ne doivent pas être réutilisées en production.

## Validation

Validation statique :

~~~bash
pnpm storage:validate:manifests
~~~

Validation réelle :

~~~bash
pnpm storage:validate
~~~

Cette commande :
- démarre MinIO ;
- exécute le bootstrap ;
- vérifie le health endpoint ;
- vérifie que l'accès anonyme au bucket renvoie 403 ;
- exécute le test PostgreSQL + MinIO réel.

Puis :

~~~bash
pnpm api:quality
pnpm security:audit:static
~~~

## Preuve d'intégration

Le test `object-storage.integration-spec.ts` :
1. crée une annonce PENDING ;
2. génère 5 images PNG valides ;
3. les écrit réellement dans MinIO ;
4. vérifie 5 métadonnées en PostgreSQL ;
5. approuve l'annonce ;
6. liste les images publiques sans object key ;
7. relit le contenu du premier objet ;
8. compare le binaire récupéré au binaire original ;
9. nettoie les objets et la base.

## Limites assumées

Pour le POC :
- MinIO est mono-instance ;
- les credentials Docker sont des fixtures locales ;
- le téléchargement public transite par l'API ;
- aucune transformation/thumbnail n'est réalisée ;
- les métadonnées EXIF ne sont pas supprimées ;
- le nettoyage d'objets orphelins est best effort.

Une industrialisation pourrait ajouter :
- bucket versionné ;
- chiffrement KMS ;
- antivirus / malware scanning ;
- suppression EXIF ;
- thumbnails asynchrones ;
- CDN ;
- lifecycle policies ;
- presigned URLs de courte durée ;
- réplication / stockage managé.

## Suite

LOT 9B-C branchera ce socle sur la publication enrichie :
- sélection visuelle de 5 à 8 images ;
- preview locale ;
- progression d'upload ;
- 5 souhaits minimum pour un troc ;
- galerie publique.
