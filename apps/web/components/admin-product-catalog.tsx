'use client';

import Link from 'next/link';
import {
  useEffect,
  useState,
  type FormEvent,
} from 'react';
import { adminApi } from '../lib/api';
import { canAccessAdmin } from '../lib/admin-dashboard';
import type {
  AdminProduct,
  AdminProductCreateInput,
} from '../lib/types';
import { AccountShell } from './account-shell';
import { useAuth } from './auth-provider';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; products: AdminProduct[] }
  | { status: 'error'; message: string };

type VariantDraft = {
  sku: string;
  label: string;
  price: string;
  stock: string;
  active: boolean;
};

const emptyVariant = (): VariantDraft => ({
  sku: '',
  label: 'Standard',
  price: '',
  stock: '0',
  active: true,
});

function euros(cents: number) {
  return new Intl.NumberFormat('fr-FR', {
    style: 'currency',
    currency: 'EUR',
  }).format(cents / 100);
}

function centsFromInput(value: string) {
  const normalized = value.replace(',', '.').trim();
  const parsed = Number(normalized);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    throw new Error('Le prix doit être un nombre strictement positif.');
  }

  return Math.round(parsed * 100);
}

function stockFromInput(value: string) {
  const parsed = Number(value);

  if (!Number.isSafeInteger(parsed) || parsed < 0) {
    throw new Error('Le stock doit être un entier positif ou nul.');
  }

  return parsed;
}

function StatusBadge({
  status,
}: {
  status: AdminProduct['status'];
}) {
  const label = {
    DRAFT: 'Brouillon',
    PUBLISHED: 'Publié',
    ARCHIVED: 'Archivé',
  }[status];

  return (
    <span className={`admin-products__status admin-products__status--${status.toLowerCase()}`}>
      {label}
    </span>
  );
}

export function AdminProductCatalog() {
  const {
    ready,
    authenticated,
    roles,
    username,
    getToken,
    login,
    logout,
  } = useAuth();
  const authorized = canAccessAdmin(authenticated, roles);
  const [state, setState] = useState<LoadState>({ status: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [confirmArchiveId, setConfirmArchiveId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [createError, setCreateError] = useState<string | null>(null);
  const [variants, setVariants] = useState<VariantDraft[]>([emptyVariant()]);

  useEffect(() => {
    if (!ready || !authorized) {
      return;
    }

    let active = true;

    void getToken()
      .then((token) => adminApi.products(token))
      .then((products) => {
        if (active) {
          setState({ status: 'ready', products });
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setState({
            status: 'error',
            message:
              reason instanceof Error
                ? reason.message
                : 'Catalogue produits indisponible.',
          });
        }
      });

    return () => {
      active = false;
    };
  }, [ready, authorized, attempt, getToken]);

  function replaceProduct(product: AdminProduct) {
    setState((current) => {
      if (current.status !== 'ready') {
        return current;
      }

      return {
        status: 'ready',
        products: current.products.map((item) =>
          item.id === product.id ? product : item,
        ),
      };
    });
  }

  function updateImages(
    productId: string,
    images: AdminProduct['images'],
  ) {
    setState((current) => {
      if (current.status !== 'ready') {
        return current;
      }

      return {
        status: 'ready',
        products: current.products.map((item) =>
          item.id === productId
            ? { ...item, images }
            : item,
        ),
      };
    });
  }

  async function createProduct(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();
    setCreateError(null);

    const formElement = event.currentTarget;
    const form = new FormData(formElement);

    try {
      const input: AdminProductCreateInput = {
        slug: String(form.get('slug') ?? '').trim(),
        name: String(form.get('name') ?? '').trim(),
        description: String(form.get('description') ?? '').trim(),
        category: String(form.get('category') ?? '').trim(),
        currency: 'EUR',
        variants: variants.map((variant) => ({
          sku: variant.sku.trim().toUpperCase(),
          label: variant.label.trim(),
          priceCents: centsFromInput(variant.price),
          stock: stockFromInput(variant.stock),
          active: variant.active,
        })),
      };

      setBusy('create');
      const token = await getToken();
      const product = await adminApi.createProduct(token, input);

      setState((current) =>
        current.status === 'ready'
          ? {
              status: 'ready',
              products: [product, ...current.products],
            }
          : current,
      );
      formElement.reset();
      setVariants([emptyVariant()]);
    } catch (reason) {
      setCreateError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de créer ce produit.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function updateMetadata(
    event: FormEvent<HTMLFormElement>,
    productId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(`meta:${productId}`);
    setActionError(null);

    try {
      const token = await getToken();
      const product = await adminApi.updateProduct(
        token,
        productId,
        {
          slug: String(form.get('slug') ?? '').trim(),
          name: String(form.get('name') ?? '').trim(),
          category: String(form.get('category') ?? '').trim(),
          description: String(form.get('description') ?? '').trim(),
        },
      );
      replaceProduct(product);
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : 'Modification du produit impossible.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function updateVariant(
    event: FormEvent<HTMLFormElement>,
    productId: string,
    variantId: string,
  ) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setBusy(`variant:${variantId}`);
    setActionError(null);

    try {
      const token = await getToken();
      const product = await adminApi.updateProductVariant(
        token,
        productId,
        variantId,
        {
          label: String(form.get('label') ?? '').trim(),
          priceCents: centsFromInput(
            String(form.get('price') ?? ''),
          ),
          stock: stockFromInput(
            String(form.get('stock') ?? ''),
          ),
          active: form.get('active') === 'on',
        },
      );
      replaceProduct(product);
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : 'Modification de la variante impossible.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function uploadImages(
    event: FormEvent<HTMLFormElement>,
    productId: string,
  ) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    const files = form
      .getAll('images')
      .filter(
        (value): value is File =>
          value instanceof File && value.size > 0,
      );

    if (files.length === 0) {
      setActionError('Sélectionnez au moins une image.');
      return;
    }

    setBusy(`images:${productId}`);
    setActionError(null);

    try {
      const token = await getToken();
      const images = await adminApi.replaceProductImages(
        token,
        productId,
        files,
      );
      updateImages(productId, images);
      formElement.reset();
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : 'Téléversement des images impossible.',
      );
    } finally {
      setBusy(null);
    }
  }

  async function transition(
    product: AdminProduct,
    action: 'publish' | 'archive',
  ) {
    setBusy(`${action}:${product.id}`);
    setActionError(null);

    try {
      const token = await getToken();
      const updated =
        action === 'publish'
          ? await adminApi.publishProduct(token, product.id)
          : await adminApi.archiveProduct(token, product.id);
      replaceProduct(updated);
      setConfirmArchiveId(null);
    } catch (reason) {
      setActionError(
        reason instanceof Error
          ? reason.message
          : 'Transition du produit impossible.',
      );
    } finally {
      setBusy(null);
    }
  }

  if (!ready) {
    return (
      <div className="page-loading" role="status">
        <span className="page-loading__mark" aria-hidden="true" />
        <span>Vérification des droits catalogue…</span>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <section className="gate-card">
        <span className="eyebrow">Catalogue protégé</span>
        <h1>Connectez-vous comme administrateur.</h1>
        <p>
          La création et la publication des produits nécessitent le rôle ADMIN.
        </p>
        <button
          className="button"
          type="button"
          onClick={() => void login()}
        >
          Se connecter
        </button>
      </section>
    );
  }

  if (!authorized) {
    return (
      <section className="gate-card gate-card--denied" role="alert">
        <span className="eyebrow">Accès refusé</span>
        <h1>Catalogue réservé aux administrateurs.</h1>
        <p>
          Votre session Keycloak ne possède pas le rôle ADMIN.
        </p>
        <Link className="button" href="/espace">
          Revenir à mon espace
        </Link>
      </section>
    );
  }

  const products =
    state.status === 'ready' ? state.products : [];

  return (
    <AccountShell
      username={username}
      active="admin"
      canModerate
      isAdmin
      onLogout={() => void logout()}
    >
      <section className="admin-products" aria-labelledby="admin-products-title">
        <header className="admin-products__hero">
          <div>
            <span>Administration · Boutique</span>
            <h1 id="admin-products-title">Catalogue produits</h1>
            <p>
              Créez les produits commerciaux, gérez leurs variantes et images,
              puis publiez-les dans la Boutique.
            </p>
          </div>
          <Link className="admin-products__back" href="/admin">
            ← Tableau de bord
          </Link>
        </header>

        <section className="admin-products__create">
          <div className="admin-products__section-heading">
            <div>
              <span>Nouveau produit</span>
              <h2>Créer un brouillon</h2>
            </div>
            <small>
              La publication exige au moins une variante active et une image.
            </small>
          </div>

          <form onSubmit={(event) => void createProduct(event)}>
            <div className="admin-products__form-grid">
              <label>
                <span>Nom</span>
                <input name="name" required minLength={3} maxLength={160} />
              </label>
              <label>
                <span>Slug</span>
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
                  placeholder="nom-du-produit"
                />
              </label>
              <label>
                <span>Catégorie</span>
                <input name="category" required maxLength={120} />
              </label>
              <label className="admin-products__wide">
                <span>Description</span>
                <textarea
                  name="description"
                  required
                  minLength={10}
                  maxLength={4000}
                  rows={4}
                />
              </label>
            </div>

            <div className="admin-products__variants">
              <div className="admin-products__section-heading">
                <div>
                  <span>Variantes</span>
                  <h3>Prix et stocks initiaux</h3>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setVariants((current) => [
                      ...current,
                      emptyVariant(),
                    ])
                  }
                >
                  + Ajouter une variante
                </button>
              </div>

              {variants.map((variant, index) => (
                <div className="admin-products__variant-draft" key={index}>
                  <label>
                    <span>SKU</span>
                    <input
                      value={variant.sku}
                      required
                      placeholder="REF-001"
                      onChange={(event) =>
                        setVariants((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  sku: event.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Libellé</span>
                    <input
                      value={variant.label}
                      required
                      onChange={(event) =>
                        setVariants((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  label: event.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Prix €</span>
                    <input
                      value={variant.price}
                      required
                      inputMode="decimal"
                      placeholder="29,90"
                      onChange={(event) =>
                        setVariants((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  price: event.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label>
                    <span>Stock</span>
                    <input
                      value={variant.stock}
                      required
                      type="number"
                      min={0}
                      step={1}
                      onChange={(event) =>
                        setVariants((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  stock: event.target.value,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                  </label>
                  <label className="admin-products__check">
                    <input
                      type="checkbox"
                      checked={variant.active}
                      onChange={(event) =>
                        setVariants((current) =>
                          current.map((item, itemIndex) =>
                            itemIndex === index
                              ? {
                                  ...item,
                                  active: event.target.checked,
                                }
                              : item,
                          ),
                        )
                      }
                    />
                    <span>Active</span>
                  </label>
                  {variants.length > 1 ? (
                    <button
                      className="admin-products__danger-link"
                      type="button"
                      onClick={() =>
                        setVariants((current) =>
                          current.filter(
                            (_, itemIndex) => itemIndex !== index,
                          ),
                        )
                      }
                    >
                      Retirer
                    </button>
                  ) : null}
                </div>
              ))}
            </div>

            {createError ? (
              <p className="admin-products__error" role="alert">
                {createError}
              </p>
            ) : null}

            <button
              className="pm-button pm-button--navy"
              type="submit"
              disabled={busy === 'create'}
            >
              {busy === 'create'
                ? 'Création…'
                : 'Créer le brouillon'}
            </button>
          </form>
        </section>

        <div className="admin-products__list-heading">
          <div>
            <span>Catalogue</span>
            <h2>{products.length} produit(s)</h2>
          </div>
          <button
            type="button"
            disabled={state.status === 'loading'}
            onClick={() => {
              setState({ status: 'loading' });
              setAttempt((current) => current + 1);
            }}
          >
            Actualiser
          </button>
        </div>

        {actionError ? (
          <p className="admin-products__error" role="alert">
            {actionError}
          </p>
        ) : null}

        {state.status === 'loading' ? (
          <div className="admin-products__loading" role="status">
            Chargement du catalogue réel…
          </div>
        ) : null}

        {state.status === 'error' ? (
          <div className="admin-products__error" role="alert">
            <strong>Catalogue indisponible.</strong>
            <p>{state.message}</p>
            <button
              type="button"
              onClick={() => {
                setState({ status: 'loading' });
                setAttempt((current) => current + 1);
              }}
            >
              Réessayer
            </button>
          </div>
        ) : null}

        {state.status === 'ready' && products.length === 0 ? (
          <div className="admin-products__empty" role="status">
            Aucun produit commercial n’a encore été créé.
          </div>
        ) : null}

        {state.status === 'ready' ? (
          <div className="admin-products__list">
            {products.map((product) => (
              <article
                className="admin-products__card"
                key={product.id}
              >
                <header>
                  <div>
                    <StatusBadge status={product.status} />
                    <h2>{product.name}</h2>
                    <p>
                      {product.category} · {product.slug} ·{' '}
                      {product.images.length} image(s)
                    </p>
                  </div>
                  {product.status === 'PUBLISHED' ? (
                    <Link
                      href={`/boutique/produit/${encodeURIComponent(product.slug)}`}
                    >
                      Voir la fiche ↗
                    </Link>
                  ) : null}
                </header>

                {product.status !== 'ARCHIVED' ? (
                  <form
                    className="admin-products__metadata"
                    onSubmit={(event) =>
                      void updateMetadata(event, product.id)
                    }
                  >
                    <label>
                      <span>Nom</span>
                      <input
                        name="name"
                        defaultValue={product.name}
                        required
                      />
                    </label>
                    <label>
                      <span>Slug</span>
                      <input
                        name="slug"
                        defaultValue={product.slug}
                        required
                      />
                    </label>
                    <label>
                      <span>Catégorie</span>
                      <input
                        name="category"
                        defaultValue={product.category}
                        required
                      />
                    </label>
                    <label className="admin-products__wide">
                      <span>Description</span>
                      <textarea
                        name="description"
                        rows={3}
                        defaultValue={product.description}
                        required
                      />
                    </label>
                    <button
                      type="submit"
                      disabled={busy === `meta:${product.id}`}
                    >
                      Enregistrer les informations
                    </button>
                  </form>
                ) : null}

                <div className="admin-products__existing-variants">
                  <h3>Variantes</h3>
                  {product.variants.map((variant) => (
                    <form
                      key={variant.id}
                      onSubmit={(event) =>
                        void updateVariant(
                          event,
                          product.id,
                          variant.id,
                        )
                      }
                    >
                      <div>
                        <strong>{variant.sku}</strong>
                        <small>
                          Actuel : {euros(variant.priceCents)} ·{' '}
                          {variant.stock} en stock
                        </small>
                      </div>
                      <label>
                        <span>Libellé</span>
                        <input
                          name="label"
                          defaultValue={variant.label}
                          disabled={product.status === 'ARCHIVED'}
                        />
                      </label>
                      <label>
                        <span>Prix €</span>
                        <input
                          name="price"
                          defaultValue={(variant.priceCents / 100).toFixed(2)}
                          inputMode="decimal"
                          disabled={product.status === 'ARCHIVED'}
                        />
                      </label>
                      <label>
                        <span>Stock</span>
                        <input
                          name="stock"
                          type="number"
                          min={0}
                          step={1}
                          defaultValue={variant.stock}
                          disabled={product.status === 'ARCHIVED'}
                        />
                      </label>
                      <label className="admin-products__check">
                        <input
                          name="active"
                          type="checkbox"
                          defaultChecked={variant.active}
                          disabled={product.status === 'ARCHIVED'}
                        />
                        <span>Active</span>
                      </label>
                      {product.status !== 'ARCHIVED' ? (
                        <button
                          type="submit"
                          disabled={busy === `variant:${variant.id}`}
                        >
                          Mettre à jour
                        </button>
                      ) : null}
                    </form>
                  ))}
                </div>

                {product.status !== 'ARCHIVED' ? (
                  <form
                    className="admin-products__images"
                    onSubmit={(event) =>
                      void uploadImages(event, product.id)
                    }
                  >
                    <div>
                      <strong>Images produit</strong>
                      <small>
                        1 à 8 JPEG, PNG ou WEBP. Un nouvel upload remplace
                        toute la galerie.
                      </small>
                    </div>
                    <input
                      name="images"
                      type="file"
                      accept="image/jpeg,image/png,image/webp"
                      multiple
                      required
                    />
                    <button
                      type="submit"
                      disabled={busy === `images:${product.id}`}
                    >
                      {busy === `images:${product.id}`
                        ? 'Téléversement…'
                        : 'Remplacer les images'}
                    </button>
                  </form>
                ) : null}

                <footer>
                  {product.status === 'DRAFT' ? (
                    <button
                      className="pm-button pm-button--teal"
                      type="button"
                      disabled={
                        product.images.length === 0 ||
                        !product.variants.some((variant) => variant.active) ||
                        busy === `publish:${product.id}`
                      }
                      onClick={() =>
                        void transition(product, 'publish')
                      }
                    >
                      Publier
                    </button>
                  ) : null}
                  {product.status !== 'ARCHIVED' ? (
                    confirmArchiveId === product.id ? (
                      <div className="admin-products__archive-confirm" role="group" aria-label="Confirmation d’archivage">
                        <strong>Retirer définitivement ce produit de la vitrine ?</strong>
                        <button
                          className="pm-button pm-button--outline"
                          type="button"
                          disabled={busy === `archive:${product.id}`}
                          onClick={() =>
                            void transition(product, 'archive')
                          }
                        >
                          Confirmer l’archivage
                        </button>
                        <button
                          type="button"
                          disabled={busy === `archive:${product.id}`}
                          onClick={() => setConfirmArchiveId(null)}
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <button
                        className="pm-button pm-button--outline"
                        type="button"
                        onClick={() => setConfirmArchiveId(product.id)}
                      >
                        Archiver
                      </button>
                    )
                  ) : null}
                  {product.status === 'DRAFT' &&
                  product.images.length === 0 ? (
                    <small>
                      Ajoutez au moins une image avant publication.
                    </small>
                  ) : null}
                </footer>
              </article>
            ))}
          </div>
        ) : null}
      </section>
    </AccountShell>
  );
}
