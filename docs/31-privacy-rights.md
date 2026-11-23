# Droits utilisateur et conformité — #168

## Principes

Cette implémentation ne prétend pas inventer une conformité juridique finale.
Elle rend visibles les traitements réellement présents dans le code et refuse
de fabriquer des coordonnées légales, durées de conservation ou traceurs qui
n'existent pas.

Références de conception :

- RGPD : droits d'accès, rectification, effacement et portabilité ;
- CNIL : réponse aux demandes de droits, cookies et traceurs ;
- Keycloak : suppression de compte depuis l'Account Console lorsque la
  capability `Delete Account` et le rôle client `account/delete-account`
  sont activés.

## Export utilisateur

`/parametres` génère côté navigateur un JSON structuré comprenant :

- identité issue du jeton Keycloak ;
- annonces et favoris ;
- propositions envoyées/reçues ;
- transactions ;
- conversations et messages accessibles au compte ;
- notifications ;
- panier et commandes.

Aucun mot de passe, secret ou donnée carte n'est inclus.

## Suppression / anonymisation

Deux sujets restent volontairement séparés :

1. **Identité Keycloak** — suppression self-service via l'action
   `delete_account`, si elle est activée pour le compte.
2. **Données applicatives** — elles ne doivent pas être supprimées en masse
   sans politique de conservation. Une demande d'anonymisation est donc
   orientée vers le workflow de contact/Privacy Request du lot #169.

### Configuration Keycloak

Dans le realm de production :

1. Authentication → Required Actions → activer **Delete Account** ;
2. attribuer le rôle client **account / delete-account** aux utilisateurs
   autorisés à supprimer eux-mêmes leur identité ;
3. tester la ré-authentification et le retour de session.

Le fichier de realm contenant des identifiants de démonstration n'est pas
réécrit automatiquement pour cette activation.

## Production

Avant publication réelle, renseigner :

- `NEXT_PUBLIC_LEGAL_CONTROLLER_NAME`
- `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL`
- `NEXT_PUBLIC_LEGAL_HOST_NAME`

et fixer une politique de conservation documentée pour les traitements réels.
