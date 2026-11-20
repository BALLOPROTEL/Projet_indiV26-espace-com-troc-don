/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  apiAssetUrl,
  cartApi,
} from '../lib/api';
import type {
  Cart,
  CartItem,
  CartUnavailableReason,
} from '../lib/types';
import { useAuth } from './auth-provider';
import { RoadmapBadge } from './design-system';

function money(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function unavailableLabel(
  reason: CartUnavailableReason | null,
) {
  switch (reason) {
    case 'PRODUCT_NOT_FOUND':
      return 'Ce produit n’existe plus dans le catalogue.';
    case 'PRODUCT_NOT_PUBLISHED':
      return 'Ce produit n’est plus disponible à la vente.';
    case 'VARIANT_INACTIVE':
      return 'Cette variante n’est plus proposée.';
    case 'INSUFFICIENT_STOCK':
      return 'La quantité demandée dépasse le stock actuel.';
    default:
      return null;
  }
}

function CartImage({
  item,
}: {
  item: CartItem;
}) {
  if (!item.imageUrl || !item.productName) {
    return (
      <div
        className="pm-cart-real__visual pm-cart-real__visual--empty"
        aria-hidden="true"
      >
        ✦
      </div>
    );
  }

  return (
    <div className="pm-cart-real__visual">
      <img
        src={apiAssetUrl(item.imageUrl)}
        alt={`Visuel de ${item.productName}`}
      />
    </div>
  );
}

export function CartPage() {
  const {
    ready,
    authenticated,
    subject,
    getToken,
    login,
  } = useAuth();
  const [cartState, setCartState] = useState<{
    subject: string;
    cart: Cart;
  } | null>(null);
  const [loadErrorState, setLoadErrorState] = useState<{
    subject: string;
    message: string;
  } | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const currentCart =
    subject && cartState?.subject === subject
      ? cartState.cart
      : null;
  const loadError =
    subject && loadErrorState?.subject === subject
      ? loadErrorState.message
      : null;
  const loading =
    ready &&
    authenticated &&
    Boolean(subject) &&
    currentCart === null &&
    loadError === null;

  useEffect(() => {
    if (!ready || !authenticated || !subject) {
      return;
    }

    let active = true;
    const currentSubject = subject;

    void getToken()
      .then(cartApi.mine)
      .then((cart) => {
        if (active) {
          setCartState({
            subject: currentSubject,
            cart,
          });
          setLoadErrorState(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setLoadErrorState({
            subject: currentSubject,
            message:
              reason instanceof Error
                ? reason.message
                : 'Impossible de charger votre panier.',
          });
        }
      });

    return () => {
      active = false;
    };
  }, [ready, authenticated, subject, getToken]);

  function applyCart(cart: Cart) {
    if (!subject) {
      return;
    }

    setCartState({ subject, cart });
    setActionError(null);
  }

  async function updateQuantity(
    item: CartItem,
    quantity: number,
  ) {
    setBusy(`quantity:${item.variantId}`);
    setActionError(null);

    try {
      const token = await getToken();
      applyCart(
        await cartApi.updateQuantity(
          token,
          item.variantId,
          quantity,
        ),
      );
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de modifier cette quantité.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function remove(item: CartItem) {
    setBusy(`remove:${item.variantId}`);
    setActionError(null);

    try {
      const token = await getToken();
      applyCart(
        await cartApi.remove(token, item.variantId),
      );
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de retirer cet article.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function clear() {
    setBusy('clear');
    setActionError(null);

    try {
      const token = await getToken();
      applyCart(await cartApi.clear(token));
      setConfirmClear(false);
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de vider le panier.',
      );
    } finally {
      setBusy(null);
    }
  }

  if (!ready) {
    return (
      <div className="pm-prototype-page">
        <div
          className="pm-prototype-empty"
          role="status"
          aria-busy="true"
        >
          <h1>Vérification de votre session…</h1>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="pm-prototype-page">
        <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
          <Link href="/">Accueil</Link>
          <span aria-hidden="true">›</span>
          <strong>Mon panier</strong>
        </nav>

        <div className="pm-cart-empty">
          <span aria-hidden="true">🛒</span>
          <h1>Connectez-vous pour accéder à votre panier.</h1>
          <p>
            Le panier est lié à votre compte Keycloak et n’est jamais stocké
            uniquement dans le navigateur.
          </p>
          <button
            className="pm-button pm-button--orange"
            type="button"
            onClick={() => void login()}
          >
            Se connecter
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pm-prototype-page">
      <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
        <Link href="/">Accueil</Link>
        <span aria-hidden="true">›</span>
        <strong>Mon panier</strong>
      </nav>

      <header className="pm-prototype-title pm-cart-real__heading">
        <div>
          <RoadmapBadge>PANIER SERVEUR CONNECTÉ</RoadmapBadge>
          <h1>Mon panier</h1>
          <p>
            Prix et disponibilité sont recalculés depuis Catalog à chaque
            chargement. L’ajout au panier ne réserve aucun stock.
          </p>
        </div>
        {currentCart && currentCart.items.length > 0 ? (
          confirmClear ? (
            <div
              className="pm-cart-real__clear-confirm"
              role="group"
              aria-label="Confirmation de vidage du panier"
            >
              <strong>Vider tout le panier ?</strong>
              <button
                className="pm-button pm-button--outline"
                type="button"
                disabled={busy === 'clear'}
                onClick={() => void clear()}
              >
                {busy === 'clear'
                  ? 'Vidage…'
                  : 'Confirmer'}
              </button>
              <button
                type="button"
                disabled={busy === 'clear'}
                onClick={() => setConfirmClear(false)}
              >
                Annuler
              </button>
            </div>
          ) : (
            <button
              className="pm-button pm-button--outline"
              type="button"
              onClick={() => setConfirmClear(true)}
            >
              Vider le panier
            </button>
          )
        ) : null}
      </header>

      {loadError ? (
        <div className="pm-prototype-empty" role="alert">
          <h2>Panier indisponible</h2>
          <p>{loadError}</p>
        </div>
      ) : loading ? (
        <div
          className="pm-prototype-empty"
          role="status"
          aria-busy="true"
        >
          <h2>Chargement de votre panier…</h2>
        </div>
      ) : currentCart && currentCart.items.length === 0 ? (
        <div className="pm-cart-empty" role="status">
          <span aria-hidden="true">🛒</span>
          <h2>Votre panier est vide</h2>
          <p>
            Ajoutez un produit publié depuis la boutique. Aucun article
            d’exemple n’est injecté.
          </p>
          <Link
            className="pm-button pm-button--orange"
            href="/boutique"
          >
            Découvrir la boutique
          </Link>
        </div>
      ) : currentCart ? (
        <div className="pm-cart-real">
          <section
            className="pm-cart-real__items"
            aria-label="Articles du panier"
          >
            {actionError ? (
              <p className="notice notice--error" role="alert">
                {actionError}
              </p>
            ) : null}

            {currentCart.items.map((item) => {
              const canAdjust =
                item.available ||
                item.unavailableReason ===
                  'INSUFFICIENT_STOCK';
              const maxPurchasableQuantity = Math.min(
                Math.max(item.stock ?? item.quantity, 1),
                99,
              );
              const quantityOptions = Array.from(
                {
                  length: maxPurchasableQuantity,
                },
                (_, index) => index + 1,
              );
              if (
                item.quantity > maxPurchasableQuantity &&
                item.quantity <= 99
              ) {
                quantityOptions.push(item.quantity);
              }

              return (
                <article
                  className={
                    item.available
                      ? 'pm-cart-real__item'
                      : 'pm-cart-real__item pm-cart-real__item--unavailable'
                  }
                  key={item.variantId}
                >
                  <CartImage item={item} />
                  <div className="pm-cart-real__item-info">
                    <small>
                      {item.variantLabel ?? 'Variante indisponible'}
                    </small>
                    <h2>
                      {item.productSlug && item.productName ? (
                        <Link
                          href={`/boutique/produit/${encodeURIComponent(item.productSlug)}`}
                        >
                          {item.productName}
                        </Link>
                      ) : (
                        item.productName ?? 'Produit indisponible'
                      )}
                    </h2>
                    {item.unitPriceCents !== null ? (
                      <span>
                        {money(
                          item.unitPriceCents,
                          item.currency ?? 'EUR',
                        )}{' '}
                        l’unité
                      </span>
                    ) : null}
                    {!item.available ? (
                      <p className="pm-cart-real__warning">
                        {unavailableLabel(
                          item.unavailableReason,
                        )}
                      </p>
                    ) : null}
                  </div>

                  <div className="pm-cart-real__controls">
                    <label>
                      <span>Quantité</span>
                      {canAdjust ? (
                        <select
                          value={item.quantity}
                          disabled={
                            busy ===
                            `quantity:${item.variantId}`
                          }
                          onChange={(event) =>
                            void updateQuantity(
                              item,
                              Number(event.target.value),
                            )
                          }
                        >
                          {quantityOptions.map((quantity) => (
                            <option
                              value={quantity}
                              key={quantity}
                              disabled={
                                quantity >
                                maxPurchasableQuantity
                              }
                            >
                              {quantity}
                              {quantity >
                              maxPurchasableQuantity
                                ? ' — stock insuffisant'
                                : ''}
                            </option>
                          ))}
                        </select>
                      ) : (
                        <strong>{item.quantity}</strong>
                      )}
                    </label>
                    <button
                      type="button"
                      disabled={
                        busy === `remove:${item.variantId}`
                      }
                      onClick={() => void remove(item)}
                    >
                      {busy === `remove:${item.variantId}`
                        ? 'Retrait…'
                        : 'Retirer'}
                    </button>
                  </div>

                  <div className="pm-cart-real__line-total">
                    {item.lineTotalCents !== null ? (
                      <strong>
                        {money(
                          item.lineTotalCents,
                          item.currency ?? 'EUR',
                        )}
                      </strong>
                    ) : (
                      <strong>Indisponible</strong>
                    )}
                  </div>
                </article>
              );
            })}
          </section>

          <aside className="pm-cart-real__summary">
            <h2>Récapitulatif</h2>
            <div>
              <span>Sous-total disponible</span>
              <strong>
                {money(
                  currentCart.subtotalCents,
                  currentCart.currency,
                )}
              </strong>
            </div>
            {currentCart.hasUnavailableItems ? (
              <p className="pm-cart-real__warning">
                Retirez ou corrigez les articles indisponibles avant une future
                commande.
              </p>
            ) : null}
            <button
              className="pm-button pm-button--orange"
              type="button"
              disabled
            >
              Commande disponible au lot L5B
            </button>
            <Link
              className="pm-button pm-button--outline"
              href="/boutique"
            >
              Continuer mes achats
            </Link>
            <small>
              Aucun paiement n’est actif dans L5A.
            </small>
          </aside>
        </div>
      ) : null}
    </div>
  );
}
