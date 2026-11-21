'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { cartApi, ordersApi } from '../lib/api';
import type { Cart, CreateOrderInput } from '../lib/types';
import { useAuth } from './auth-provider';
import { RoadmapBadge } from './design-system';

function money(cents: number, currency = 'EUR') {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function field(
  form: FormData,
  name: keyof CreateOrderInput,
): string {
  return String(form.get(name) ?? '').trim();
}

export function CheckoutPage() {
  const router = useRouter();
  const {
    ready,
    authenticated,
    subject,
    email,
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
  const [busy, setBusy] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  const currentCart =
    subject && cartState?.subject === subject
      ? cartState.cart
      : null;
  const loadError =
    subject && loadErrorState?.subject === subject
      ? loadErrorState.message
      : null;

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
      .catch((error: unknown) => {
        if (active) {
          setLoadErrorState({
            subject: currentSubject,
            message:
              error instanceof Error
                ? error.message
                : 'Impossible de charger le panier.',
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

  async function submit(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !currentCart ||
      currentCart.items.length === 0 ||
      currentCart.hasUnavailableItems
    ) {
      return;
    }

    setActionError(null);
    setBusy(true);

    const form = new FormData(event.currentTarget);
    const input: CreateOrderInput = {
      recipientFirstName: field(form, 'recipientFirstName'),
      recipientLastName: field(form, 'recipientLastName'),
      email: field(form, 'email'),
      addressLine1: field(form, 'addressLine1'),
      postalCode: field(form, 'postalCode'),
      city: field(form, 'city'),
      countryCode: field(form, 'countryCode').toUpperCase(),
    };

    idempotencyKey.current ??= crypto.randomUUID();

    try {
      const token = await getToken();
      const order = await ordersApi.prepare(
        token,
        idempotencyKey.current,
        input,
      );

      router.push(
        `/commande/confirmation?id=${encodeURIComponent(order.id)}`,
      );
    } catch (error) {
      setActionError(
        error instanceof Error
          ? error.message
          : 'Impossible de préparer la commande.',
      );
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className="pm-prototype-page">
        <p>Chargement de votre session…</p>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div className="pm-prototype-page">
        <section className="pm-cart-empty">
          <h1>Finaliser ma commande</h1>
          <p>Connectez-vous pour accéder à votre panier et préparer une commande.</p>
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

  if (loadError) {
    return (
      <div className="pm-prototype-page">
        <section className="pm-cart-empty">
          <h1>Finaliser ma commande</h1>
          <p>{loadError}</p>
          <Link className="pm-button pm-button--outline" href="/panier">
            Retour au panier
          </Link>
        </section>
      </div>
    );
  }

  if (!currentCart) {
    return (
      <div className="pm-prototype-page">
        <p>Chargement du panier…</p>
      </div>
    );
  }

  if (currentCart.items.length === 0) {
    return (
      <div className="pm-prototype-page">
        <section className="pm-cart-empty">
          <h1>Votre panier est vide</h1>
          <p>Ajoutez un produit avant de préparer une commande.</p>
          <Link className="pm-button pm-button--orange" href="/boutique">
            Voir la boutique
          </Link>
        </section>
      </div>
    );
  }

  return (
    <div className="pm-prototype-page">
      <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
        <Link href="/">Accueil</Link>
        <span className="pm-breadcrumbs__pair">
          <span aria-hidden="true">›</span>
          <Link href="/panier">Panier</Link>
        </span>
        <span className="pm-breadcrumbs__pair">
          <span aria-hidden="true">›</span>
          <strong>Commande</strong>
        </span>
      </nav>

      <header className="pm-prototype-title">
        <h1>Finaliser ma commande</h1>
        <div className="pm-checkout-steps" aria-label="Étapes de commande">
          <span>1. Panier</span><b aria-hidden="true">›</b>
          <strong>2. Coordonnées</strong><b aria-hidden="true">›</b>
          <span>3. Brouillon</span>
        </div>
      </header>

      <div className="pm-checkout-layout">
        <form className="pm-checkout-form" onSubmit={submit}>
          <div className="pm-order-heading">
            <div>
              <span className="pm-overline">COMMANDE RÉELLE · L5B</span>
              <h2>Coordonnées de livraison</h2>
            </div>
            <RoadmapBadge>PAIEMENT NON ACTIVÉ</RoadmapBadge>
          </div>

          <div className="pm-checkout-fields">
            <label>
              <span>Prénom</span>
              <input
                name="recipientFirstName"
                autoComplete="given-name"
                maxLength={80}
                required
              />
            </label>
            <label>
              <span>Nom</span>
              <input
                name="recipientLastName"
                autoComplete="family-name"
                maxLength={80}
                required
              />
            </label>
            <label className="pm-checkout-fields__wide">
              <span>Adresse e-mail</span>
              <input
                name="email"
                type="email"
                autoComplete="email"
                defaultValue={email ?? ''}
                maxLength={254}
                required
              />
            </label>
            <label className="pm-checkout-fields__wide">
              <span>Adresse</span>
              <input
                name="addressLine1"
                autoComplete="street-address"
                maxLength={200}
                required
              />
            </label>
            <label>
              <span>Code postal</span>
              <input
                name="postalCode"
                autoComplete="postal-code"
                maxLength={20}
                required
              />
            </label>
            <label>
              <span>Ville</span>
              <input
                name="city"
                autoComplete="address-level2"
                maxLength={100}
                required
              />
            </label>
            <label>
              <span>Pays (code ISO)</span>
              <input
                name="countryCode"
                autoComplete="country"
                placeholder="FR"
                minLength={2}
                maxLength={2}
                pattern="[A-Za-z]{2}"
                required
              />
            </label>
          </div>

          <div className="pm-info-notice">
            Cette étape crée un <strong>brouillon réel de commande</strong>.
            Aucun paiement n’est effectué et aucun stock n’est réservé. Le panier
            reste disponible jusqu’au futur lot paiement.
          </div>

          {currentCart.hasUnavailableItems ? (
            <p className="pm-cart-real__warning" role="alert">
              Votre panier contient un article devenu indisponible. Corrigez-le
              avant de préparer la commande.
            </p>
          ) : null}

          {actionError ? (
            <p className="pm-cart-real__warning" role="alert" aria-live="polite">
              {actionError}
            </p>
          ) : null}

          <button
            className="pm-button pm-button--orange"
            type="submit"
            disabled={busy || currentCart.hasUnavailableItems}
          >
            {busy ? 'Préparation…' : 'Préparer ma commande'}
          </button>
        </form>

        <aside className="pm-checkout-summary">
          <h2>Votre panier</h2>
          <div className="pm-order-lines">
            {currentCart.items.map((item) => (
              <div className="pm-order-line" key={item.variantId}>
                <div>
                  <strong>{item.productName ?? 'Produit indisponible'}</strong>
                  <small>
                    {item.variantLabel ?? 'Variante inconnue'} · Qté {item.quantity}
                  </small>
                </div>
                <strong>
                  {item.lineTotalCents !== null
                    ? money(
                        item.lineTotalCents,
                        item.currency ?? currentCart.currency,
                      )
                    : 'Indisponible'}
                </strong>
              </div>
            ))}
          </div>

          <div className="pm-summary-line pm-summary-line--total">
            <span>Sous-total articles</span>
            <strong>
              {money(
                currentCart.subtotalCents,
                currentCart.currency,
              )}
            </strong>
          </div>
          <div className="pm-summary-line">
            <span>Livraison</span>
            <strong>Calculée au paiement</strong>
          </div>
          <small>
            Aucun total final n’est inventé avant l’intégration du paiement.
          </small>
          <Link className="pm-button pm-button--outline" href="/panier">
            ← Retour au panier
          </Link>
        </aside>
      </div>
    </div>
  );
}
