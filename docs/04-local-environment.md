# Environnement local — LOT 0 (Windows + WSL2)

Le poste hôte est Windows, mais **l'environnement de développement principal du projet est Linux sous WSL2**. Les commandes Node.js, pnpm, Git, kubectl, Minikube et JMeter doivent donc être vérifiées et utilisées depuis la distribution Linux WSL.

Docker peut être fourni par **Docker Desktop avec intégration WSL2**. Le daemon peut rester côté Docker Desktop tandis que le client `docker` est utilisé depuis WSL.

## Cible

Depuis WSL (Ubuntu ou distribution équivalente), les outils nécessaires sont :

- Git
- Node.js Active LTS
- Corepack / pnpm
- Docker CLI avec accès au daemon Docker
- kubectl
- Minikube
- Java 17+ pour JMeter
- Apache JMeter

## Diagnostic automatique

Depuis le terminal WSL, à la racine du dépôt :

```bash
chmod +x scripts/check-env.sh
./scripts/check-env.sh
```

Le script est en lecture seule : il ne modifie pas la machine.

## Vérifications attendues

### WSL

```bash
uname -a
cat /etc/os-release
```

Le résultat doit confirmer une distribution Linux exécutée sous WSL/WSL2.

### Git

```bash
git --version
```

### Node.js / pnpm

```bash
node --version
corepack --version
pnpm --version
```

Si Corepack existe mais pnpm n'est pas activé :

```bash
corepack enable
corepack prepare pnpm@latest --activate
```

La version exacte de pnpm sera figée dans `package.json` au LOT 1.

### Docker depuis WSL

```bash
docker version
docker info
```

Si Docker Desktop est utilisé, vérifier dans Windows :

**Docker Desktop → Settings → Resources → WSL Integration**

et activer l'intégration pour la distribution WSL utilisée.

### Kubernetes local

```bash
minikube start --driver=docker
kubectl get nodes
minikube status
```

Le nœud doit apparaître `Ready`.

### Java / JMeter

```bash
java -version
jmeter -v
```

## Recommandation de stockage du dépôt

Pour de meilleures performances avec WSL, cloner le dépôt dans le système de fichiers Linux, par exemple :

```bash
~/projects/Projet_indiV26-espace-com-troc-don
```

Éviter de travailler principalement depuis `/mnt/c/...` si ce n'est pas nécessaire, notamment pour `node_modules`, Docker et les builds.

## Critères de sortie LOT 0

L'environnement local est prêt lorsque :

- WSL2/Linux est confirmé ;
- Git répond ;
- Node et pnpm répondent ;
- Docker daemon est accessible depuis WSL ;
- Minikube démarre avec le driver Docker ;
- `kubectl get nodes` affiche un nœud `Ready` ;
- Java répond ;
- JMeter répond.

## Sécurité

Ne jamais stocker de token GitHub, mot de passe, certificat privé, clé privée ou fichier `.env` réel dans le dépôt.
