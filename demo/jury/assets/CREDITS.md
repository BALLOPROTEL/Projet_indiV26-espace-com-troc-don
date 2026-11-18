# Provenance des images du kit jury

## État de la revue — 18 novembre 2026

Les 20 fichiers présents dans `demo/jury/assets/` ont été rapprochés de leurs **pages Wikimedia Commons exactes** avant toute autorisation de démonstration.

La revue documentaire a confirmé :

- **don-lampe (5/5)** — Raphael Gobeil Gauthier — **CC BY-SA 4.0** — même ensemble de lampes en cuivre Model X ;
- **don-etagere (5/5)** — Matti Blume — fichier multi-licence permettant de sélectionner **CC BY-SA 4.0** — même série IKEA Ivar / éléments d’étagère ;
- **troc-sac (5/5)** — Dalibor Johánek — **CC BY-SA 3.0 Unported** — permission archivée sous le ticket Wikimedia VRT **#2013112710007237** ;
- **troc-livres (5/5)** — Paolo Monti / BEIC Foundation — **CC BY-SA 4.0** — les cinq fichiers figurent dans la catégorie Commons *Books photographed by Paolo Monti*.

### Restriction Benro

Les pages Benro affichent également un avertissement **personality rights**. Il est conservé dans les conditions du registre : l’usage prévu est limité à la démonstration jury, sans suggérer d’endossement ; toute réutilisation publique ou commerciale devra faire l’objet d’une nouvelle revue.

## Autorisation encore requise

Le registre `demo/jury/assets/provenance.json` contient maintenant les 20 preuves structurées avec leurs sources, auteurs, licences et conditions, mais conserve volontairement :

```json
"authorizedForDemo": false
```

L’autorisation finale doit être donnée explicitement par le responsable humain du projet avant de :
- passer les 20 entrées à `authorizedForDemo: true` ;
- remplacer les 20 `creditId: PENDING` du manifest ;
- passer `readiness` à `READY_FOR_REVIEW`.

Le validateur strict reste donc volontairement bloqué jusqu’à cette approbation.
