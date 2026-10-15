# F4 — Contrat sécurisé ADMIN, périmètre réel

Premier lot **F4 / issue #68** pour alimenter le futur dashboard F5. Il n'ajoute **aucune capacité d'administration des comptes Keycloak** et ne crée pas de fausses statistiques.

## Endpoint réalisé

`GET /api/admin/catalog/summary` — Gateway transmet **uniquement ce chemin exact** au Catalog Service ; Catalog applique `JwtAuthGuard` et `RolesGuard` sous `@Roles(AppRole.ADMIN)`.

Réponse calculée sur les lignes réelles du catalogue via `groupBy` Prisma :

```json
{
  "total": 7,
  "byStatus": { "pending": 2, "approved": 4, "rejected": 1 },
  "byOperation": { "donations": 3, "trades": 4 },
  "approvedAvailability": { "available": 3, "reserved": 1, "completed": 0 }
}
```

**Les chiffres sont un exemple de structure, pas une mesure du déploiement.**
`byOperation` couvre toutes les fiches, y compris PENDING/REJECTED ; `approvedAvailability` ne compte que les annonces APPROVED. Aucun `ownerId`, email, nom utilisateur, texte privé, média privé ou token n'est retourné.

**Sécurité :** absence de JWT → 401 ; rôle USER ou MODERATOR seul → 403 ; rôle ADMIN avec JWT vérifié → route autorisée. Les entrées HTTP ne permettent pas de choisir un schéma, un tenant, un rôle, un utilisateur ou une requête SQL. Il n'existe aucun endpoint générique `/api/admin/*`.

## Contrats supplémentaires — non disponibles

| Fonction illustrée dans le mockup | État réel | Décision |
| --- | --- | --- |
| Nombre d'utilisateurs actifs | Pas de définition métier ni de compteur Keycloak protégé | Ne pas afficher |
| Suspension/gestion de comptes | Pas de connecteur Keycloak Admin sécurisé, audit ni rollback | **Aucune action activée** |
| Signalements | Pas de modèle/endpoint incident dans Catalog | Ne pas afficher |
| Transactions globales | API Marketplace limitée aux participants ; contrat ADMIN pas encore implémenté | Ne pas afficher de total |
| Historique d'audit administrateur | Pas de journal d'audit général | À spécifier séparément, avant actions sensibles |

Le dashboard F5 peut exploiter **uniquement les métriques Catalog effectivement livrées**. Si l'équipe décide ensuite de gérer utilisateurs, signalements ou transactions globales, ajouter des sous-issues avec contrats REST, protection des données, tests de refus 401/403, piste d'audit et permissions de service minimales.

## Vérifications

- Tests de `@Roles(AppRole.ADMIN)` et des vrais guards (JWT absent, USER, MODERATOR, ADMIN).
- Agrégats `groupBy` sur données simulées **en tests**, sans noms fictifs affichés en production.
- Routage Gateway strict vers Catalog et rejet de `/api/admin/users`.
- Test HTTP du contrat avec Keycloak lors de l'intégration en CI avant fusion.

**Dépendances :** M10 #57 et F0/F1 livrés ; F5 #69 consommera ce contrat quand F4 sera validé. La PR F4 n'ajoute pas d'écran administrateur ni de fonctionnalité frontend.
