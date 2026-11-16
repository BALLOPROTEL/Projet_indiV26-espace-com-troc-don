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
