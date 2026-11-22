/* eslint-disable @next/next/no-img-element */
'use client';

import Link from 'next/link';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  apiAssetUrl,
  ApiError,
  cartApi,
  productsApi,
} from '../lib/api';
import type { Product } from '../lib/types';
import { useAuth } from './auth-provider';
import { RoadmapBadge } from './design-system';

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function ProductVisual({
  product,
  imageIndex = 0,
  className = '',
}: {
  product: Product;
  imageIndex?: number;
  className?: string;
}) {
  const image = product.images[imageIndex];

  if (!image) {
    return (
      <div
        className={`pm-real-product-visual ${className}`.trim()}
        aria-label="Visuel produit indisponible"
      >
        <span aria-hidden="true">✦</span>
        <strong>VISUEL INDISPONIBLE</strong>
      </div>
    );
  }

  return (
    <div
      className={`pm-real-product-visual ${className}`.trim()}
    >
      <img
        src={apiAssetUrl(image.contentUrl)}
        alt={`${product.name} — visuel ${imageIndex + 1}`}
      />
    </div>
  );
}

function ProductGallery({
  product,
}: {
  product: Product;
}) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const thumbsRef = useRef<HTMLDivElement | null>(null);

  const hasMultipleImages = product.images.length > 1;

  function selectPrevious() {
    setSelectedIndex((current) =>
      current <= 0
        ? product.images.length - 1
        : current - 1,
    );
  }

  function selectNext() {
    setSelectedIndex((current) =>
      current >= product.images.length - 1
        ? 0
        : current + 1,
    );
  }

  function scrollThumbs(direction: -1 | 1) {
    thumbsRef.current?.scrollBy({
      left: direction * 320,
      behavior: 'smooth',
    });
  }

  return (
    <div className="pm-real-product-gallery">
      <div className="pm-real-product-gallery__stage">
        <ProductVisual
          product={product}
          imageIndex={selectedIndex}
          className="pm-real-product-visual--detail"
        />

        {hasMultipleImages ? (
          <>
            <button
              className="pm-real-product-gallery__arrow pm-real-product-gallery__arrow--prev"
              type="button"
              aria-label="Image précédente"
              onClick={selectPrevious}
            >
              ←
            </button>
            <button
              className="pm-real-product-gallery__arrow pm-real-product-gallery__arrow--next"
              type="button"
              aria-label="Image suivante"
              onClick={selectNext}
            >
              →
            </button>
            <span
              className="pm-real-product-gallery__counter"
              aria-live="polite"
            >
              {selectedIndex + 1} / {product.images.length}
            </span>
          </>
        ) : null}
      </div>

      {hasMultipleImages ? (
        <div className="pm-real-product-gallery__thumb-strip">
          <button
            className="pm-real-product-gallery__thumb-arrow"
            type="button"
            aria-label="Faire défiler les miniatures vers la gauche"
            onClick={() => scrollThumbs(-1)}
          >
            ←
          </button>

          <div
            ref={thumbsRef}
            className="pm-real-product-gallery__thumbs"
            aria-label="Autres visuels du produit"
          >
            {product.images.map((image, index) => (
              <button
                key={image.id}
                className={
                  index === selectedIndex
                    ? 'pm-real-product-gallery__thumb is-active'
                    : 'pm-real-product-gallery__thumb'
                }
                type="button"
                aria-label={`Afficher le visuel ${index + 1} sur ${product.images.length}`}
                aria-current={
                  index === selectedIndex ? 'true' : undefined
                }
                onClick={() => setSelectedIndex(index)}
              >
                <img
                  src={apiAssetUrl(image.contentUrl)}
                  alt=""
                />
              </button>
            ))}
          </div>

          <button
            className="pm-real-product-gallery__thumb-arrow"
            type="button"
            aria-label="Faire défiler les miniatures vers la droite"
            onClick={() => scrollThumbs(1)}
          >
            →
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function ProductCatalog() {
  const [loadState, setLoadState] = useState<{
    items: Product[];
    error: string | null;
  } | null>(null);
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');

  useEffect(() => {
    let active = true;

    void productsApi
      .public()
      .then((items) => {
        if (active) {
          setLoadState({ items, error: null });
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setLoadState({
            items: [],
            error:
              reason instanceof Error
                ? reason.message
                : 'Impossible de charger le catalogue.',
          });
        }
      });

    return () => {
      active = false;
    };
  }, []);

  const products = loadState?.items ?? [];
  const categories = useMemo(
    () =>
      [...new Set(products.map((product) => product.category))]
        .sort((a, b) => a.localeCompare(b, 'fr')),
    [products],
  );
  const normalizedSearch = search.trim().toLocaleLowerCase('fr');
  const visibleProducts = products.filter((product) => {
    const matchesCategory =
      !category || product.category === category;
    const matchesSearch =
      !normalizedSearch ||
      product.name.toLocaleLowerCase('fr').includes(normalizedSearch) ||
      product.description
        .toLocaleLowerCase('fr')
        .includes(normalizedSearch);

    return matchesCategory && matchesSearch;
  });

  return (
    <div className="pm-prototype-page">
      <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
        <Link href="/">Accueil</Link>
        <span aria-hidden="true">›</span>
        <strong>Boutique</strong>
      </nav>

      <header className="pm-prototype-title">
        <h1>Notre boutique fantastique</h1>
        <p>
          Le catalogue ci-dessous contient uniquement les produits réellement
          publiés par l’administration.
        </p>
      </header>

      <div className="pm-shop-layout">
        <aside
          className="pm-shop-filters"
          aria-label="Filtres de la boutique"
        >
          <div className="pm-shop-filters__head">
            <strong>Filtres</strong>
            <button
              className="pm-shop-reset"
              type="button"
              onClick={() => {
                setCategory('');
                setSearch('');
              }}
              disabled={!category && !search}
            >
              Effacer
            </button>
          </div>

          <h2>Catégories réelles</h2>
          <label>
            <input
              type="radio"
              name="product-category"
              checked={category === ''}
              onChange={() => setCategory('')}
            />
            Toutes
          </label>
          {categories.map((item) => (
            <label key={item}>
              <input
                type="radio"
                name="product-category"
                checked={category === item}
                onChange={() => setCategory(item)}
              />
              {item}
            </label>
          ))}

          <hr />
          <p className="pm-future-note">
            Les prix et stocks sont issus du service Catalog. Le panier et les
            commandes sont réels ; le paiement Stripe reste en mode test.
          </p>
        </aside>

        <section className="pm-shop-content" aria-labelledby="catalog-title">
          <div className="pm-shop-toolbar">
            <span id="catalog-title">
              <strong>{visibleProducts.length}</strong>{' '}
              {visibleProducts.length > 1 ? 'produits publiés' : 'produit publié'}
            </span>
            <input
              type="search"
              value={search}
              placeholder="Rechercher un article…"
              aria-label="Rechercher dans les produits publiés"
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>

          {loadState === null ? (
            <div className="pm-prototype-empty" role="status" aria-busy="true">
              <RoadmapBadge>CATALOGUE RÉEL</RoadmapBadge>
              <h2>Chargement de la boutique…</h2>
            </div>
          ) : loadState.error ? (
            <div className="pm-prototype-empty" role="alert">
              <RoadmapBadge>INDISPONIBLE</RoadmapBadge>
              <h2>Impossible de charger la boutique.</h2>
              <p>{loadState.error}</p>
            </div>
          ) : products.length === 0 ? (
            <div className="pm-prototype-empty" role="status">
              <RoadmapBadge>CATALOGUE RÉEL</RoadmapBadge>
              <h2>Aucun produit publié pour le moment.</h2>
              <p>
                Aucun article fictif n’est injecté : la vitrine se remplira
                lorsque l’administration publiera de vrais produits.
              </p>
            </div>
          ) : visibleProducts.length === 0 ? (
            <div className="pm-prototype-empty" role="status">
              <h2>Aucun produit ne correspond à ces filtres.</h2>
              <button
                className="pm-button pm-button--outline"
                type="button"
                onClick={() => {
                  setCategory('');
                  setSearch('');
                }}
              >
                Réinitialiser les filtres
              </button>
            </div>
          ) : (
            <div className="pm-real-product-grid">
              {visibleProducts.map((product) => (
                <article className="pm-real-product-card" key={product.id}>
                  <Link
                    href={`/boutique/produit/${encodeURIComponent(product.slug)}`}
                    aria-label={`Voir ${product.name}`}
                  >
                    <ProductVisual product={product} />
                  </Link>
                  <div className="pm-real-product-card__body">
                    <small>{product.category}</small>
                    <h2>
                      <Link
                        href={`/boutique/produit/${encodeURIComponent(product.slug)}`}
                      >
                        {product.name}
                      </Link>
                    </h2>
                    <p>{product.description}</p>
                    <div className="pm-real-product-card__footer">
                      <strong>
                        {money(product.fromPriceCents, product.currency)}
                      </strong>
                      <span
                        className={
                          product.availableStock > 0
                            ? 'pm-stock pm-stock--available'
                            : 'pm-stock'
                        }
                      >
                        {product.availableStock > 0
                          ? `${product.availableStock} en stock`
                          : 'Rupture de stock'}
                      </span>
                    </div>
                    <Link
                      className="pm-button pm-button--orange"
                      href={`/boutique/produit/${encodeURIComponent(product.slug)}`}
                    >
                      Voir le produit
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export function ProductDetail({
  slug,
}: {
  slug: string;
}) {
  const {
    authenticated,
    getToken,
    login,
  } = useAuth();
  const [selection, setSelection] = useState<{
    productId: string;
    variantId: string;
  } | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [cartBusy, setCartBusy] = useState(false);
  const [cartFeedback, setCartFeedback] = useState<{
    kind: 'success' | 'error';
    message: string;
  } | null>(null);
  const [state, setState] = useState<{
    product: Product | null;
    error: string | null;
    notFound: boolean;
  } | null>(null);

  useEffect(() => {
    let active = true;

    void productsApi
      .publicBySlug(slug)
      .then((product) => {
        if (active) {
          setState({
            product,
            error: null,
            notFound: false,
          });
        }
      })
      .catch((reason: unknown) => {
        if (!active) {
          return;
        }

        if (reason instanceof ApiError && reason.status === 404) {
          setState({
            product: null,
            error: null,
            notFound: true,
          });
          return;
        }

        setState({
          product: null,
          error:
            reason instanceof Error
              ? reason.message
              : 'Impossible de charger ce produit.',
          notFound: false,
        });
      });

    return () => {
      active = false;
    };
  }, [slug]);

  if (state === null) {
    return (
      <div className="pm-prototype-page">
        <div className="pm-prototype-empty" role="status" aria-busy="true">
          <h1>Chargement du produit…</h1>
        </div>
      </div>
    );
  }

  if (state.notFound) {
    return (
      <div className="pm-prototype-page">
        <div className="pm-prototype-empty">
          <RoadmapBadge>PRODUIT INTROUVABLE</RoadmapBadge>
          <h1>Ce produit n’est pas publié.</h1>
          <p>
            Il a peut-être été archivé ou n’a jamais été rendu public.
          </p>
          <Link className="pm-button pm-button--outline" href="/boutique">
            Retour à la boutique
          </Link>
        </div>
      </div>
    );
  }

  if (state.error || !state.product) {
    return (
      <div className="pm-prototype-page">
        <div className="pm-prototype-empty" role="alert">
          <h1>Impossible d’ouvrir cette fiche.</h1>
          <p>{state.error ?? 'Une erreur inattendue est survenue.'}</p>
          <Link className="pm-button pm-button--outline" href="/boutique">
            Retour à la boutique
          </Link>
        </div>
      </div>
    );
  }

  const product = state.product;
  const selectedVariant =
    product.variants.find(
      (variant) =>
        selection?.productId === product.id &&
        selection.variantId === variant.id,
    ) ??
    product.variants.find((variant) => variant.stock > 0) ??
    product.variants[0] ??
    null;
  const maxQuantity = selectedVariant
    ? Math.min(selectedVariant.stock, 99)
    : 0;
  const safeQuantity = Math.min(
    Math.max(quantity, 1),
    Math.max(maxQuantity, 1),
  );

  async function addToCart() {
    if (!selectedVariant || selectedVariant.stock < 1 || cartBusy) {
      return;
    }

    if (!authenticated) {
      await login();
      return;
    }

    setCartBusy(true);
    setCartFeedback(null);

    try {
      const token = await getToken();
      await cartApi.add(token, {
        productId: product.id,
        variantId: selectedVariant.id,
        quantity: safeQuantity,
      });
      setCartFeedback({
        kind: 'success',
        message: 'Produit ajouté à votre panier.',
      });
    } catch (reason) {
      setCartFeedback({
        kind: 'error',
        message:
          reason instanceof Error
            ? reason.message
            : 'Impossible d’ajouter ce produit au panier.',
      });
    } finally {
      setCartBusy(false);
    }
  }

  return (
    <div className="pm-prototype-page">
      <nav className="pm-breadcrumbs" aria-label="Fil d’Ariane">
        <Link href="/">Accueil</Link>
        <span aria-hidden="true">›</span>
        <Link href="/boutique">Boutique</Link>
        <span aria-hidden="true">›</span>
        <strong>{product.name}</strong>
      </nav>

      <div className="pm-real-product-detail">
        <ProductGallery product={product} />

        <section className="pm-real-product-detail__info">
          <span className="pm-overline">{product.category}</span>
          <h1>{product.name}</h1>
          <div className="pm-product-placeholder__price">
            À partir de {money(product.fromPriceCents, product.currency)}
          </div>
          <div className="pm-product-placeholder__availability">
            {product.availableStock > 0
              ? `${product.availableStock} unité(s) disponibles`
              : 'Rupture de stock'}
          </div>
          <p>{product.description}</p>

          <fieldset
            className="pm-product-variants"
            aria-label="Variantes disponibles"
          >
            <legend>Choisissez une variante</legend>
            {product.variants.map((variant) => {
              const selected =
                selectedVariant?.id === variant.id;

              return (
                <label
                  className={
                    selected
                      ? 'pm-product-variant pm-product-variant--selected'
                      : 'pm-product-variant'
                  }
                  key={variant.id}
                >
                  <input
                    type="radio"
                    name="product-variant"
                    checked={selected}
                    disabled={variant.stock < 1}
                    onChange={() => {
                      setSelection({
                        productId: product.id,
                        variantId: variant.id,
                      });
                      setQuantity(1);
                      setCartFeedback(null);
                    }}
                  />
                  <div>
                    <strong>{variant.label}</strong>
                    <small>Réf. {variant.sku}</small>
                  </div>
                  <div>
                    <strong>
                      {money(
                        variant.priceCents,
                        product.currency,
                      )}
                    </strong>
                    <span>
                      {variant.stock > 0
                        ? `${variant.stock} en stock`
                        : 'Indisponible'}
                    </span>
                  </div>
                </label>
              );
            })}
          </fieldset>

          <div className="pm-product-cart-action">
            <label>
              <span>Quantité</span>
              <select
                value={safeQuantity}
                disabled={maxQuantity < 1 || cartBusy}
                onChange={(event) => {
                  setQuantity(Number(event.target.value));
                  setCartFeedback(null);
                }}
              >
                {Array.from(
                  { length: maxQuantity },
                  (_, index) => index + 1,
                ).map((value) => (
                  <option value={value} key={value}>
                    {value}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="pm-button pm-button--orange"
              type="button"
              disabled={maxQuantity < 1 || cartBusy}
              onClick={() => void addToCart()}
            >
              {!authenticated
                ? 'Se connecter pour ajouter'
                : cartBusy
                  ? 'Ajout…'
                  : 'Ajouter au panier'}
            </button>

            <Link
              className="pm-button pm-button--outline"
              href="/panier"
            >
              Voir mon panier
            </Link>
          </div>

          {cartFeedback ? (
            <p
              className={
                cartFeedback.kind === 'success'
                  ? 'notice notice--success'
                  : 'notice notice--error'
              }
              role={cartFeedback.kind === 'error' ? 'alert' : 'status'}
            >
              {cartFeedback.message}
            </p>
          ) : null}

          <div className="pm-info-notice">
            Le panier est réel et lié au compte. L’ajout ne réserve pas le
            stock ; la réservation intervient à la commande et le paiement
            utilise Stripe Checkout en mode test.
          </div>
        </section>
      </div>
    </div>
  );
}
