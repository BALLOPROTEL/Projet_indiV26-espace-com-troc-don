# L5C2 — Stripe Checkout réel en mode test

## Objectif

L5C2 connecte les commandes Commerce à **Stripe Checkout** sans faire transiter de données carte dans l'application.

Le navigateur reçoit uniquement une URL Checkout Stripe hébergée.

## Flux

```text
Order AWAITING_PAYMENT
  -> POST /api/orders/:id/payment-session
  -> Commerce vérifie propriétaire + réservation active
  -> Catalog extend(orderId)
       réservation prolongée à 35 min sans nouveau décrément
  -> Stripe Checkout Session
       expiration 30 min
       carte gérée chez Stripe
  -> navigateur redirigé vers Stripe
  -> paiement test
  -> Stripe webhook signé
  -> Gateway
  -> Commerce
       vérifie Stripe-Signature
       déduplique providerEventId
       Catalog commit(orderId)
       Order -> PAID
```

## Pourquoi 35 minutes de réservation

La réservation normale L5C1 reste à **15 minutes**.

Au démarrage d'un paiement :
- Checkout Stripe expire à 30 minutes ;
- Catalog prolonge la réservation à 35 minutes ;
- les 5 minutes supplémentaires laissent une marge de traitement au webhook.

L'extension ne décrémente jamais le stock une seconde fois.

## Variables serveur

Compose / Codespaces :

```bash
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...
```

Ces valeurs ne doivent jamais être exposées avec un préfixe `NEXT_PUBLIC_`.

Le Web n'a besoin d'aucune clé Stripe.

## API authentifiée

`POST /api/orders/:id/payment-session`

Conditions :
- utilisateur propriétaire dérivé du JWT `sub` ;
- Order `AWAITING_PAYMENT` ;
- réservation active ;
- Order non payé.

Réponse :

```json
{
  "sessionId": "cs_test_...",
  "url": "https://checkout.stripe.com/...",
  "expiresAt": "..."
}
```

Une clé d'idempotence Stripe déterministe par Order empêche la création de plusieurs sessions lors d'un retry réseau.

## Webhook

`POST /api/payments/stripe/webhook`

Le webhook :
- n'utilise pas JWT ;
- exige `Stripe-Signature` ;
- utilise le corps HTTP brut ;
- vérifie HMAC SHA-256 ;
- refuse un timestamp de plus de 5 minutes ;
- persiste `PaymentWebhookEvent.providerEventId` unique.

Seul `checkout.session.completed` avec `payment_status=paid` peut déclencher le paiement métier.

## Transition PAID

Avant de marquer la commande payée :

1. la session doit correspondre à `paymentSessionId` ;
2. `metadata.orderId` / `client_reference_id` doit correspondre à l'Order ;
3. l'Order doit être `AWAITING_PAYMENT` ;
4. Catalog doit réussir `commitStock(orderId)`.

Ensuite Commerce persiste :
- `status=PAID` ;
- `paymentIntentId` interne ;
- `paidAt` ;
- événement webhook traité.

Les identifiants Stripe internes ne sont pas exposés dans la vue Order du navigateur.

## Annulation / expiration

Si une Checkout Session existe, Commerce l'expire **avant** de libérer le stock.

Si Stripe indique que la session est déjà `complete + paid`, Commerce :
- refuse l'annulation ;
- ne libère pas le stock ;
- attend le webhook de confirmation.

Cela protège le cas de concurrence paiement terminé / webhook légèrement retardé.

## UX

Sur la confirmation :
- DRAFT -> Réserver mon stock ;
- AWAITING_PAYMENT -> Payer avec Stripe (test) ;
- PAID -> Paiement Stripe confirmé ;
- CANCELLED / EXPIRED -> pas de paiement possible.

Le retour navigateur `payment=success` n'est pas une preuve de paiement. Seul le webhook serveur peut produire `PAID`.

## Hors périmètre

- mode live ;
- remboursement ;
- facture Stripe ;
- gestion fiscale ;
- Apple Pay / Google Pay spécifiques ;
- suppression ciblée des articles achetés du panier courant.
