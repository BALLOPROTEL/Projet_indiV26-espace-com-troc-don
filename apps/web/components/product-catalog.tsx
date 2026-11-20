'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { ApiError, productsApi } from '../lib/api';
import type { Product } from '../lib/types';
import { RoadmapBadge } from './design-system';

function money(cents: number, currency: string) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency,
  }).format(cents / 100);
}

function ProductVisual() {
  return (
    <div className="pm-real-product-visual" aria-label="Image produit non encore connectée">
      <span aria-hidden="true">✦</span>
      <strong>VISUEL PRODUIT</strong>
      <small>Images prévues en L4B</small>
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
            Les prix et stocks sont issus du service Catalog. Le panier et le
            paiement restent désactivés jusqu’au lot L5.
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
                    <ProductVisual />
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
        <ProductVisual />

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

          <div className="pm-product-variants" aria-label="Variantes disponibles">
            <h2>Variantes</h2>
            {product.variants.map((variant) => (
              <div className="pm-product-variant" key={variant.id}>
                <div>
                  <strong>{variant.label}</strong>
                  <small>Réf. {variant.sku}</small>
                </div>
                <div>
                  <strong>{money(variant.priceCents, product.currency)}</strong>
                  <span>
                    {variant.stock > 0
                      ? `${variant.stock} en stock`
                      : 'Indisponible'}
                  </span>
                </div>
              </div>
            ))}
          </div>

          <div className="pm-product-placeholder__actions">
            <button
              className="pm-button pm-button--orange"
              type="button"
              disabled
            >
              Panier disponible au lot L5
            </button>
            <button
              className="pm-button pm-button--outline"
              type="button"
              disabled
            >
              Favoris produits à connecter
            </button>
          </div>

          <div className="pm-info-notice">
            Aucun achat n’est encore possible. Le prix et le stock affichés
            sont réels, mais le panier, la commande et le paiement restent
            volontairement inactifs.
          </div>
        </section>
      </div>
    </div>
  );
}
