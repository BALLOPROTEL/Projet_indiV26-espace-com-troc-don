/* eslint-disable @next/next/no-img-element */
'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type FormEvent,
} from 'react';
import { listingsApi } from '../lib/api';
import { canEditListing } from '../lib/presentation';
import {
  createBlankListingInput,
  MAX_IMAGES,
  MAX_WISHES,
  MIN_WISHES,
  normalizedListingInput,
  padWishes,
  validatePublicationDraft,
} from '../lib/publication';
import type {
  Listing,
  ListingInput,
  ListingOperationType,
} from '../lib/types';
import { useAuth } from './auth-provider';
import { EmptyState } from './empty-state';
import { ListingCard } from './listing-card';

export function PersonalSpace() {
  const {
    ready,
    authenticated,
    username,
    login,
    getToken,
  } = useAuth();

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<ListingInput>(createBlankListingInput);
  const [createImages, setCreateImages] = useState<File[]>([]);
  const [editing, setEditing] = useState<Listing | null>(null);
  const [editForm, setEditForm] =
    useState<ListingInput>(createBlankListingInput);
  const [editImages, setEditImages] = useState<File[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadMine = useCallback(async () => {
    if (!authenticated) {
      return;
    }

    setLoading(true);

    try {
      const token = await getToken();
      const data = await listingsApi.mine(token);
      setListings(data);
      setError(null);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : 'Impossible de charger vos annonces.',
      );
    } finally {
      setLoading(false);
    }
  }, [authenticated, getToken]);

  useEffect(() => {
    if (!ready || !authenticated) {
      return;
    }

    let active = true;

    void getToken()
      .then((token) => listingsApi.mine(token))
      .then((data) => {
        if (active) {
          setListings(data);
          setError(null);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(
            reason instanceof Error
              ? reason.message
              : 'Impossible de charger vos annonces.',
          );
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [ready, authenticated, getToken]);

  async function createListing(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    setError(null);

    const validationError = validatePublicationDraft(
      form,
      createImages,
      0,
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    let created: Listing | null = null;

    try {
      const token = await getToken();
      created = await listingsApi.create(
        token,
        normalizedListingInput(form),
      );
      await listingsApi.replaceImages(
        token,
        created.id,
        createImages,
      );
      setForm(createBlankListingInput());
      setCreateImages([]);
      setFeedback(
        'Annonce complète déposée. Elle attend maintenant la relecture de la réserve.',
      );
      await loadMine();
    } catch (reason) {
      if (created) {
        await loadMine();
        setError(
          'La fiche a été créée mais la galerie n’a pas été enregistrée complètement. Corrigez la fiche avant modération.',
        );
      } else {
        setError(
          reason instanceof Error
            ? reason.message
            : 'Impossible de déposer cette annonce.',
        );
      }
    } finally {
      setSaving(false);
    }
  }

  function startEditing(listing: Listing) {
    const labels = listing.tradeWishes.map((wish) => wish.label);

    setEditing(listing);
    setEditForm({
      title: listing.title,
      description: listing.description,
      operationType: listing.operationType,
      tradeWishes:
        listing.operationType === 'TRADE'
          ? padWishes(labels)
          : [],
    });
    setEditImages([]);
    setFeedback(null);
    setError(null);
  }

  async function saveEdit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!editing) {
      return;
    }

    setFeedback(null);
    setError(null);

    const validationError = validatePublicationDraft(
      editForm,
      editImages,
      editing.images.length,
    );

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);

    try {
      const token = await getToken();
      await listingsApi.update(
        token,
        editing.id,
        normalizedListingInput(editForm),
      );

      if (editImages.length > 0) {
        await listingsApi.replaceImages(
          token,
          editing.id,
          editImages,
        );
      }

      setEditing(null);
      setEditImages([]);
      setFeedback(
        'Modification enregistrée. L’annonce repasse en relecture avec ses éléments enrichis.',
      );
      await loadMine();
    } catch (reason) {
      const mutationError =
        reason instanceof Error
          ? reason.message
          : 'Impossible de modifier cette annonce.';
      await loadMine();
      setError(mutationError);
    } finally {
      setSaving(false);
    }
  }

  if (!ready) {
    return <PageLoading label="Ouverture de votre étagère…" />;
  }

  if (!authenticated) {
    return (
      <section className="gate-card">
        <span className="eyebrow">Espace membre</span>
        <h1>Votre étagère vous attend.</h1>
        <p>
          Connectez-vous pour déposer un objet, suivre sa relecture
          et corriger une annonce refusée.
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

  return (
    <div className="workspace">
      <section className="workspace-intro">
        <div>
          <span className="eyebrow">Mon étagère</span>
          <h1>Bonjour {username ?? 'vous'}.</h1>
        </div>
        <p>
          Chaque fiche complète comporte 5 à 8 photos. Pour un troc,
          précisez aussi au moins 5 objets ou familles d’objets qui
          pourraient vous intéresser.
        </p>
      </section>

      <div className="workspace-grid">
        <section className="form-panel">
          <span className="form-panel__index">01</span>
          <div className="form-panel__heading">
            <span className="eyebrow">Nouvelle fiche</span>
            <h2>Proposer un objet</h2>
            <p>
              Décrivez l’objet, ajoutez sa galerie et précisez vos
              souhaits si vous proposez un troc.
            </p>
          </div>

          <ListingForm
            value={form}
            images={createImages}
            existingImageCount={0}
            submitLabel={
              saving ? 'Dépôt en cours…' : 'Déposer pour relecture'
            }
            disabled={saving}
            onChange={setForm}
            onImagesChange={setCreateImages}
            onSubmit={createListing}
          />
        </section>

        <section className="shelf-panel">
          <div className="section-heading section-heading--compact">
            <div>
              <span className="eyebrow">Suivi</span>
              <h2>Mes annonces</h2>
            </div>
            <span className="counter">
              {listings.length.toString().padStart(2, '0')}
            </span>
          </div>

          <div className="feedback-stack" aria-live="polite">
            {feedback ? (
              <div className="notice notice--success">{feedback}</div>
            ) : null}
            {error ? (
              <div className="notice notice--error">{error}</div>
            ) : null}
          </div>

          {loading ? (
            <PageLoading label="Classement des fiches…" compact />
          ) : null}

          {!loading && listings.length === 0 ? (
            <EmptyState
              eyebrow="Étagère vide"
              title="Aucune fiche à votre nom."
              text="Votre première proposition apparaîtra ici avec son statut de relecture."
            />
          ) : null}

          <div className="personal-list">
            {listings.map((listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                showStatus
                footer={
                  canEditListing(listing.status) ? (
                    <button
                      className="text-button text-button--strong"
                      type="button"
                      onClick={() => startEditing(listing)}
                    >
                      Corriger la fiche
                    </button>
                  ) : (
                    <span className="quiet-note">
                      Cette fiche publiée est verrouillée.
                    </span>
                  )
                }
              />
            ))}
          </div>
        </section>
      </div>

      {editing ? (
        <div className="dialog-backdrop">
          <section
            className="edit-dialog edit-dialog--wide"
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-listing-title"
          >
            <button
              className="dialog-close"
              type="button"
              aria-label="Fermer la modification"
              onClick={() => setEditing(null)}
            >
              ×
            </button>
            <span className="eyebrow">Révision</span>
            <h2 id="edit-listing-title">Corriger la fiche</h2>
            <p>
              Une modification remet automatiquement l’annonce en
              relecture. Si vous choisissez de nouvelles photos, le
              lot complet précédent sera remplacé.
            </p>

            <ListingForm
              value={editForm}
              images={editImages}
              existingImageCount={editing.images.length}
              submitLabel={
                saving
                  ? 'Enregistrement…'
                  : 'Enregistrer la correction'
              }
              disabled={saving}
              onChange={setEditForm}
              onImagesChange={setEditImages}
              onSubmit={saveEdit}
            />
          </section>
        </div>
      ) : null}
    </div>
  );
}

function ListingForm({
  value,
  images,
  existingImageCount,
  submitLabel,
  disabled,
  onChange,
  onImagesChange,
  onSubmit,
}: {
  value: ListingInput;
  images: File[];
  existingImageCount: number;
  submitLabel: string;
  disabled: boolean;
  onChange: (value: ListingInput) => void;
  onImagesChange: (images: File[]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const previews = useImagePreviews(images);

  function changeOperation(operationType: ListingOperationType) {
    onChange({
      ...value,
      operationType,
      tradeWishes:
        operationType === 'TRADE'
          ? padWishes(value.tradeWishes)
          : [],
    });
  }

  function changeWish(index: number, label: string) {
    onChange({
      ...value,
      tradeWishes: value.tradeWishes.map((wish, wishIndex) =>
        wishIndex === index ? label : wish,
      ),
    });
  }

  function addWish() {
    if (value.tradeWishes.length >= MAX_WISHES) {
      return;
    }

    onChange({
      ...value,
      tradeWishes: [...value.tradeWishes, ''],
    });
  }

  function removeWish(index: number) {
    if (value.tradeWishes.length <= MIN_WISHES) {
      return;
    }

    onChange({
      ...value,
      tradeWishes: value.tradeWishes.filter(
        (_, wishIndex) => wishIndex !== index,
      ),
    });
  }

  return (
    <form className="listing-form" onSubmit={onSubmit}>
      <fieldset className="choice-group">
        <legend>Je souhaite</legend>
        <label
          className={
            value.operationType === 'TRADE'
              ? 'choice-card is-selected'
              : 'choice-card'
          }
        >
          <input
            type="radio"
            name="operationType"
            value="TRADE"
            checked={value.operationType === 'TRADE'}
            onChange={() => changeOperation('TRADE')}
          />
          <strong>Troquer</strong>
          <span>contre un autre objet</span>
        </label>
        <label
          className={
            value.operationType === 'DONATION'
              ? 'choice-card is-selected'
              : 'choice-card'
          }
        >
          <input
            type="radio"
            name="operationType"
            value="DONATION"
            checked={value.operationType === 'DONATION'}
            onChange={() => changeOperation('DONATION')}
          />
          <strong>Donner</strong>
          <span>sans contrepartie</span>
        </label>
      </fieldset>

      <label className="field">
        <span>Titre de la fiche</span>
        <input
          required
          minLength={3}
          maxLength={120}
          value={value.title}
          placeholder="Ex. Lot de romans fantastiques"
          onChange={(event) =>
            onChange({ ...value, title: event.target.value })
          }
        />
        <small>{value.title.length}/120</small>
      </label>

      <label className="field">
        <span>Description</span>
        <textarea
          required
          minLength={10}
          maxLength={2000}
          rows={7}
          value={value.description}
          placeholder="État, particularités, dimensions, accessoires inclus…"
          onChange={(event) =>
            onChange({
              ...value,
              description: event.target.value,
            })
          }
        />
        <small>{value.description.length}/2000</small>
      </label>

      {value.operationType === 'TRADE' ? (
        <fieldset className="wish-editor">
          <legend>Ce qui pourrait vous intéresser</legend>
          <p>
            Indiquez entre 5 et 10 souhaits distincts. Ils seront
            affichés sur la fiche publique.
          </p>
          <div className="wish-editor__list">
            {value.tradeWishes.map((wish, index) => (
              <div className="wish-editor__row" key={index}>
                <label className="field field--compact">
                  <span>Souhait {index + 1}</span>
                  <input
                    required
                    maxLength={120}
                    value={wish}
                    placeholder={
                      index === 0
                        ? 'Ex. Nintendo Switch'
                        : 'Autre objet recherché'
                    }
                    onChange={(event) =>
                      changeWish(index, event.target.value)
                    }
                  />
                </label>
                {value.tradeWishes.length > MIN_WISHES ? (
                  <button
                    className="text-button"
                    type="button"
                    onClick={() => removeWish(index)}
                  >
                    Retirer
                  </button>
                ) : null}
              </div>
            ))}
          </div>
          {value.tradeWishes.length < MAX_WISHES ? (
            <button
              className="button button--quiet button--small"
              type="button"
              onClick={addWish}
            >
              Ajouter un souhait
            </button>
          ) : null}
        </fieldset>
      ) : null}

      <fieldset className="image-editor">
        <legend>Galerie de l’objet</legend>
        <p>
          5 à 8 images JPEG, PNG ou WEBP, 5 MiB maximum chacune.
        </p>

        {existingImageCount > 0 && images.length === 0 ? (
          <div className="asset-summary">
            {existingImageCount} image
            {existingImageCount > 1 ? 's' : ''} déjà enregistrée
            {existingImageCount > 1 ? 's' : ''}. Choisissez un
            nouveau lot uniquement pour les remplacer.
          </div>
        ) : null}

        <label className="file-picker">
          <span>Choisir 5 à 8 images</span>
          <input
            type="file"
            multiple
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) =>
              onImagesChange(
                Array.from(event.target.files ?? []).slice(
                  0,
                  MAX_IMAGES,
                ),
              )
            }
          />
        </label>

        {images.length > 0 ? (
          <>
            <div className="asset-summary">
              {images.length}/{MAX_IMAGES} image
              {images.length > 1 ? 's' : ''} sélectionnée
              {images.length > 1 ? 's' : ''}
            </div>
            <div className="upload-gallery">
              {previews.map((preview, index) => (
                <figure key={preview.url}>
                  <img
                    src={preview.url}
                    alt={`Aperçu ${index + 1} : ${preview.name}`}
                  />
                  <figcaption>{index + 1}</figcaption>
                </figure>
              ))}
            </div>
          </>
        ) : null}
      </fieldset>

      <button
        className="button button--full"
        type="submit"
        disabled={disabled}
      >
        {submitLabel}
      </button>
    </form>
  );
}

function useImagePreviews(files: File[]) {
  const previews = useMemo(
    () =>
      files.map((file) => ({
        name: file.name,
        url: URL.createObjectURL(file),
      })),
    [files],
  );

  useEffect(
    () => () => {
      for (const preview of previews) {
        URL.revokeObjectURL(preview.url);
      }
    },
    [previews],
  );

  return previews;
}

function PageLoading({
  label,
  compact = false,
}: {
  label: string;
  compact?: boolean;
}) {
  return (
    <div className={compact ? 'page-loading is-compact' : 'page-loading'}>
      <span className="page-loading__mark" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
