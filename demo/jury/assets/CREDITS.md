# Provenance des images du kit jury

Le registre **machine** `demo/jury/assets/provenance.json` est la source de vérité de la gate stricte. Initialement `credits: []` : aucune image autorisée n'a encore été fournie.

Pour chacune des 20 photos, enregistrer **une entrée unique** :
```json
{
  "id": "credit-verifie-unique",
  "file": "assets/don-lampe/01.jpg",
  "source": "URL ou référence originale vérifiable",
  "author": "Auteur ou titulaire des droits",
  "licenseOrPermission": "Licence exacte ou référence d'autorisation écrite",
  "verifiedAt": "2026-10-16",
  "conditions": "Conditions de démonstration et de redistribution",
  "authorizedForDemo": true
}
```

Les champs de cet exemple ne sont **pas des droits réellement vérifiés**. Le validateur exige le chemin exact, l'identifiant associé, la date et les champs de preuve mais ne peut **pas juridiquement certifier** l'authenticité d'une licence. L'humain doit examiner les autorisations avant toute démonstration.

Les images doivent être de vrais fichiers réguliers non vides avec une signature JPEG/PNG/WebP attendue. La signature de fichier est un filtre de base, pas une preuve que l'image se décode correctement : ouvrir les images dans la recette réelle.

Ne pas utiliser de photo internet sans droits de réutilisation vérifiés ; ne pas stocker de données personnelles.


## Catalogue de candidats

`demo/jury/assets/sources.json` contient 20 **candidats à examiner**, issus de Wikimedia Commons. Les champs `expectedAuthor` et `expectedLicense` servent au contrôle humain ; ils ne constituent pas à eux seuls une certification.

Le script `pnpm jury:assets:fetch` télécharge les fichiers pour revue mais **n'ajoute aucun crédit** à `provenance.json` et ne change aucun `creditId`. Une entrée de provenance ne doit être créée qu'après ouverture du fichier, vérification de la page source, de l'auteur, de la licence/permission, des éventuelles restrictions complémentaires et de la cohérence avec l'objet de démonstration.


## Revue humaine du 18 novembre 2026

Les 20 médias présents dans `feat/56-jury-media-candidates-clean` ont été ouverts visuellement puis recoupés avec les métadonnées Wikimedia Commons exactes (auteur, licence, URL de licence et crédit).

- `don-lampe` : Raphael Gobeil Gauthier — CC BY-SA 4.0.
- `don-etagere` : Matti Blume — CC BY-SA 4.0.
- `troc-sac` : Dalibor Johánek — CC BY-SA 3.0, avec ticket Wikimedia VRT `2013112710007237`. Commons expose aussi une restriction `personality`; la démonstration utilise uniquement les vues produit et n'implique aucune approbation.
- `troc-livres` : Paolo Monti / BEIC Foundation — CC BY-SA 4.0.

Le registre `provenance.json` contient désormais une entrée unique par fichier avec les conditions de réutilisation retenues. Le manifest peut donc être placé en `READY_FOR_REVIEW` pour la gate stricte.