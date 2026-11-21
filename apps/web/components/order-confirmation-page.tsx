'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ordersApi } from '../lib/api';
import type { Order, OrderStatus } from '../lib/types';
import { useAuth } from './auth-provider';
import { RoadmapBadge } from './design-system';

function money(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function dateTime(value: string) {
  return new Intl.DateTimeFormat('fr-FR', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: OrderStatus) {
  switch (status) {
    case 'DRAFT':
      return 'Brouillon';
    case 'AWAITING_PAYMENT':
      return 'Stock réservé · en attente de paiement';
    case 'PAID':
      return 'Paiement confirmé';
    case 'CANCELLED':
      return 'Annulée';
    case 'EXPIRED':
      return 'Réservation expirée';
  }
}

export function OrderConfirmationPage({
  orderId,
  paymentResult,
}: {
  orderId: string | null;
  paymentResult: 'success' | 'cancel' | null;
}) {
  const {
    ready,
    authenticated,
    subject,
    getToken,
    login,
  } = useAuth();
  const [orderState, setOrderState] = useState<{
    subject: string;
    orderId: string;
    order: Order;
  } | null>(null);
  const [errorState, setErrorState] = useState<{
    subject: string;
    orderId: string;
    message: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<
    'reserve' | 'cancel' | 'payment' | null
  >(null);

  const order =
    subject &&
    orderId &&
    orderState?.subject === subject &&
    orderState.orderId === orderId
      ? orderState.order
      : null;
  const error =
    subject &&
    orderId &&
    errorState?.subject === subject &&
    errorState.orderId === orderId
      ? errorState.message
      : null;

  useEffect(() => {
    if (
      !ready ||
      !authenticated ||
      !subject ||
      !orderId
    ) {
      return;
    }

    let active = true;
    const currentSubject = subject;
    const currentOrderId = orderId;

    void getToken()
      .then((token) => ordersApi.byId(token, currentOrderId))
      .then((value) => {
        if (active) {
          setOrderState({
            subject: currentSubject,
            orderId: currentOrderId,
            order: value,
          });
          setErrorState(null);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setErrorState({
            subject: currentSubject,
            orderId: currentOrderId,
            message:
              caught instanceof Error
                ? caught.message
                : 'Commande introuvable.',
          });
        }
      });

    return () => {
      active = false;
    };
  }, [
    ready,
    authenticated,
    subject,
    orderId,
    getToken,
  ]);

  async function startPayment() {
    if (!order || !orderId) {
      return;
    }

    setActionError(null);
    setBusy('payment');

    try {
      const token = await getToken();
      const session = await ordersApi.paymentSession(
        token,
        orderId,
      );
      window.location.assign(session.url);
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : 'Impossible de démarrer le paiement Stripe.',
      );
      setBusy(null);
    }
  }

  async function runAction(
    action: 'reserve' | 'cancel',
  ) {
    if (!order || !orderId || !subject) {
      return;
    }

    setActionError(null);
    setBusy(action);

    try {
      const token = await getToken();
      const updated =
        action === 'reserve'
          ? await ordersApi.reserve(token, orderId)
          : await ordersApi.cancel(token, orderId);

      setOrderState({
        subject,
        orderId,
        order: updated,
      });
    } catch (caught) {
      setActionError(
        caught instanceof Error
          ? caught.message
          : 'Action impossible sur cette commande.',
      );
    } finally {
      setBusy(null);
    }
  }

  if (!orderId) {
    return (
      <div className="pm-prototype-page">
        <section className="pm-confirmation-placeholder">
          <h1>Aucune commande sélectionnée</h1>
          <p>Ouvrez une commande depuis votre historique.</p>
          <Link className="pm-button pm-button--orange" href="/mes-commandes">
            Voir mes commandes
          </Link>
        </section>
      </div>
    );
  }

  if (!ready) {
    return <div className="pm-prototype-page"><p>Chargement…</p></div>;
  }

  if (!authenticated) {
    return (
      <div className="pm-prototype-page">
        <section className="pm-confirmation-placeholder">
          <h1>Connexion requise</h1>
          <p>Connectez-vous pour consulter cette commande.</p>
          <button
            className="pm-button pm-button--orange"
            type="button"
            onClick={() => void login()}
          >
            Se connecter
          </button>
        </section>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pm-prototype-page">
        <section className="pm-confirmation-placeholder">
          <h1>Commande inaccessible</h1>
          <p>{error}</p>
          <Link className="pm-button pm-button--outline" href="/mes-commandes">
            Retour à mes commandes
          </Link>
        </section>
      </div>
    );
  }

  if (!order) {
    return <div className="pm-prototype-page"><p>Chargement de la commande…</p></div>;
  }

  return (
    <div className="pm-prototype-page">
      <section className="pm-confirmation-placeholder pm-order-confirmation">
        <div aria-hidden="true">✓</div>
        <span className="pm-overline">COMMANDE RÉELLE</span>
        <h1>{statusLabel(order.status)}</h1>
        <p>
          Commande <strong>#{order.id.slice(-8).toUpperCase()}</strong> ·
          sous-total figé au moment de sa préparation.
        </p>

        <RoadmapBadge>
          {order.status === 'PAID'
            ? 'PAIEMENT STRIPE CONFIRMÉ'
            : order.status === 'AWAITING_PAYMENT'
              ? 'STOCK RÉSERVÉ · STRIPE TEST'
              : 'PAIEMENT NON EFFECTUÉ'}
        </RoadmapBadge>

        <div className="pm-order-confirmation__details">
          <div>
            <span>Statut</span>
            <strong>{statusLabel(order.status)}</strong>
          </div>
          <div>
            <span>Sous-total articles</span>
            <strong>{money(order.subtotalCents, order.currency)}</strong>
          </div>
          <div>
            <span>Destinataire</span>
            <strong>
              {order.recipientFirstName} {order.recipientLastName}
            </strong>
          </div>
          <div>
            <span>Livraison</span>
            <strong>
              {order.addressLine1}, {order.postalCode} {order.city} · {order.countryCode}
            </strong>
          </div>
          {order.status === 'AWAITING_PAYMENT' &&
          order.reservationExpiresAt ? (
            <div>
              <span>Stock réservé jusqu’au</span>
              <strong>{dateTime(order.reservationExpiresAt)}</strong>
            </div>
          ) : null}
        </div>

        {order.status === 'DRAFT' ? (
          <div className="pm-info-notice">
            Le prix est déjà figé dans ce brouillon, mais le stock ne l’est pas encore.
            Réservez-le pour passer à l’étape pré-paiement.
          </div>
        ) : null}

        {order.status === 'AWAITING_PAYMENT' ? (
          <div className="pm-info-notice">
            Le stock est réellement réservé dans Catalog. Le paiement passe par
            Stripe Checkout en mode test ; aucune donnée carte ne transite dans
            l’application.
          </div>
        ) : null}

        {order.status === 'PAID' ? (
          <div className="pm-info-notice">
            Le paiement Stripe a été confirmé côté serveur et la réservation de
            stock a été commitée.
            {order.paidAt
              ? ` Paiement confirmé le ${dateTime(order.paidAt)}.`
              : ''}
          </div>
        ) : null}

        {paymentResult === 'success' &&
        order.status !== 'PAID' ? (
          <div className="pm-info-notice">
            Retour Stripe reçu. La confirmation serveur est en cours ; rechargez
            la page si le statut reste temporairement en attente.
          </div>
        ) : null}

        {paymentResult === 'cancel' &&
        order.status === 'AWAITING_PAYMENT' ? (
          <div className="pm-info-notice">
            Paiement Stripe interrompu. La commande reste en attente tant que la
            réservation de stock est active.
          </div>
        ) : null}

        {order.status === 'EXPIRED' ? (
          <div className="pm-info-notice">
            La réservation a expiré et le stock a été restitué au catalogue.
          </div>
        ) : null}

        {order.status === 'CANCELLED' ? (
          <div className="pm-info-notice">
            Cette commande a été annulée. Tout stock réservé a été restitué.
          </div>
        ) : null}

        {actionError ? (
          <p className="pm-cart-real__warning" role="alert" aria-live="polite">
            {actionError}
          </p>
        ) : null}

        <div className="pm-confirmation-placeholder__actions">
          {order.status === 'DRAFT' ? (
            <button
              className="pm-button pm-button--orange"
              type="button"
              disabled={busy !== null}
              onClick={() => void runAction('reserve')}
            >
              {busy === 'reserve'
                ? 'Réservation…'
                : 'Réserver mon stock'}
            </button>
          ) : null}

          {order.status === 'AWAITING_PAYMENT' ? (
            <button
              className="pm-button pm-button--orange"
              type="button"
              disabled={busy !== null}
              onClick={() => void startPayment()}
            >
              {busy === 'payment'
                ? 'Ouverture de Stripe…'
                : 'Payer avec Stripe (test)'}
            </button>
          ) : null}

          {(order.status === 'DRAFT' ||
            order.status === 'AWAITING_PAYMENT') ? (
            <button
              className="pm-button pm-button--outline"
              type="button"
              disabled={busy !== null}
              onClick={() => void runAction('cancel')}
            >
              {busy === 'cancel' ? 'Annulation…' : 'Annuler la commande'}
            </button>
          ) : null}

          <Link className="pm-button pm-button--outline" href="/mes-commandes">
            Voir mes commandes
          </Link>
          <Link className="pm-button pm-button--outline" href="/boutique">
            Retour à la boutique
          </Link>
        </div>
      </section>
    </div>
  );
}
