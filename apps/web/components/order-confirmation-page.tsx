'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { ordersApi } from '../lib/api';
import type { Order } from '../lib/types';
import { useAuth } from './auth-provider';
import { RoadmapBadge } from './design-system';

function money(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

export function OrderConfirmationPage({
  orderId,
}: {
  orderId: string | null;
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

  if (!orderId) {
    return (
      <div className="pm-prototype-page">
        <section className="pm-confirmation-placeholder">
          <h1>Aucune commande sélectionnée</h1>
          <p>Ouvrez un brouillon depuis votre historique.</p>
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
        <span className="pm-overline">BROUILLON CRÉÉ</span>
        <h1>Commande préparée</h1>
        <p>
          Le brouillon <strong>#{order.id.slice(-8).toUpperCase()}</strong> a été
          enregistré avec les prix du moment.
        </p>
        <RoadmapBadge>PAIEMENT NON EFFECTUÉ</RoadmapBadge>

        <div className="pm-order-confirmation__details">
          <div>
            <span>Statut</span>
            <strong>Brouillon</strong>
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
        </div>

        <div className="pm-info-notice">
          Aucun paiement n’a été lancé et aucun stock n’a été réservé. Le panier
          est conservé pour la prochaine étape du projet.
        </div>

        <div className="pm-confirmation-placeholder__actions">
          <Link className="pm-button pm-button--orange" href="/mes-commandes">
            Voir mes commandes
          </Link>
          <Link className="pm-button pm-button--outline" href="/panier">
            Retour au panier
          </Link>
        </div>
      </section>
    </div>
  );
}
