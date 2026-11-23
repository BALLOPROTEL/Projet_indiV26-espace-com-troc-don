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

function date(value: string) {
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
      return 'Stock réservé';
    case 'PAID':
      return 'Payée';
    case 'CANCELLED':
      return 'Annulée';
    case 'EXPIRED':
      return 'Expirée';
  }
}

export function OrdersPage() {
  const {
    ready,
    authenticated,
    subject,
    getToken,
    login,
  } = useAuth();
  const [ordersState, setOrdersState] = useState<{
    subject: string;
    orders: Order[];
  } | null>(null);
  const [errorState, setErrorState] = useState<{
    subject: string;
    message: string;
  } | null>(null);

  const orders =
    subject && ordersState?.subject === subject
      ? ordersState.orders
      : null;
  const error =
    subject && errorState?.subject === subject
      ? errorState.message
      : null;

  useEffect(() => {
    if (!ready || !authenticated || !subject) {
      return;
    }

    let active = true;
    const currentSubject = subject;

    void getToken()
      .then(ordersApi.mine)
      .then((value) => {
        if (active) {
          setOrdersState({
            subject: currentSubject,
            orders: value,
          });
          setErrorState(null);
        }
      })
      .catch((caught: unknown) => {
        if (active) {
          setErrorState({
            subject: currentSubject,
            message:
              caught instanceof Error
                ? caught.message
                : 'Impossible de charger les commandes.',
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
    getToken,
  ]);

  if (!ready) {
    return <div className="pm-prototype-page"><p>Chargement…</p></div>;
  }

  if (!authenticated) {
    return (
      <div className="pm-prototype-page">
        <section className="pm-cart-empty">
          <h1>Mes commandes</h1>
          <p>Connectez-vous pour consulter vos brouillons de commande.</p>
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
        <section className="pm-cart-empty">
          <h1>Mes commandes</h1>
          <p>{error}</p>
        </section>
      </div>
    );
  }

  if (!orders) {
    return <div className="pm-prototype-page"><p>Chargement de vos commandes…</p></div>;
  }

  return (
    <div className="pm-prototype-page">
      <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
        <Link href="/">Accueil</Link>
        <span className="pm-breadcrumbs__pair">
          <span aria-hidden="true">›</span>
          <strong>Mes commandes</strong>
        </span>
      </nav>

      <header className="pm-prototype-title pm-order-heading">
        <div>
          <span className="pm-overline">ESPACE PERSONNEL</span>
          <h1>Mes commandes</h1>
          <p>Historique réel des commandes et réservations de stock.</p>
        </div>
        <RoadmapBadge>STRIPE CHECKOUT · MODE TEST</RoadmapBadge>
      </header>

      {orders.length === 0 ? (
        <section className="pm-cart-empty">
          <h2>Aucune commande</h2>
          <p>Préparez votre première commande depuis un panier disponible.</p>
          <Link className="pm-button pm-button--orange" href="/boutique">
            Découvrir la boutique
          </Link>
        </section>
      ) : (
        <section className="pm-orders-real" aria-label="Historique des commandes">
          {orders.map((order) => (
            <article className="pm-order-card" key={order.id}>
              <div className="pm-order-card__top">
                <div>
                  <span className="pm-overline">
                    #{order.id.slice(-8).toUpperCase()}
                  </span>
                  <h2>{date(order.createdAt)}</h2>
                </div>
                <span className="pm-order-status">
                  {statusLabel(order.status)}
                </span>
              </div>

              <div className="pm-order-lines">
                {order.items.map((item) => (
                  <div className="pm-order-line" key={item.id}>
                    <div>
                      <strong>{item.productName}</strong>
                      <small>{item.variantLabel} · Qté {item.quantity}</small>
                    </div>
                    <strong>
                      {money(item.lineTotalCents, order.currency)}
                    </strong>
                  </div>
                ))}
              </div>

              <div className="pm-order-card__footer">
                <div>
                  <span>Sous-total figé</span>
                  <strong>{money(order.subtotalCents, order.currency)}</strong>
                  {order.status === 'AWAITING_PAYMENT' &&
                  order.reservationExpiresAt ? (
                    <small>
                      Stock réservé jusqu’au {date(order.reservationExpiresAt)}
                    </small>
                  ) : null}
                </div>
                <Link
                  className="pm-button pm-button--outline"
                  href={`/commande/confirmation?id=${encodeURIComponent(order.id)}`}
                >
                  Voir le détail
                </Link>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
