# Environnement local — LOT 0

Cette procédure prépare la machine de développement pour les LOT 1 à LOT 10.

## Cible Windows

Outils nécessaires :

- Git
- Node.js **Active LTS** ; la version exacte sera figée lors de l'initialisation du workspace
- Corepack / pnpm
- Docker Desktop avec moteur Linux
- kubectl
- Minikube
- Java 17+ pour JMeter
- Apache JMeter

## Vérification automatique

Depuis PowerShell, à la racine du dépôt :

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\check-env.ps1
```

Le script ne modifie pas la machine. Il vérifie uniquement la présence des outils et affiche leurs versions.

## Vérifications manuelles finales

### Docker

```powershell
docker version
docker info
```

Le daemon Docker doit répondre.

### Kubernetes local

```powershell
minikube start --driver=docker
kubectl get nodes
minikube status
```

Le nœud doit apparaître `Ready`.

### Node / pnpm

```powershell
node --version
corepack --version
pnpm --version
```

Si pnpm n'est pas disponible alors que Corepack est présent :

```powershell
corepack enable
corepack prepare pnpm@latest --activate
```

La version pnpm sera figée dans le projet lors du LOT 1.

### JMeter

```powershell
java -version
jmeter -v
```

## Critères de sortie LOT 0

L'environnement local est considéré prêt lorsque :

- Git répond ;
- Node et pnpm répondent ;
- Docker daemon répond ;
- Minikube démarre ;
- `kubectl get nodes` affiche un nœud Ready ;
- Java répond ;
- JMeter répond.

## Sécurité

Ne pas stocker de token GitHub, mot de passe, certificat privé ou fichier `.env` réel dans le dépôt.
