/* eslint-disable @next/next/no-img-element */
'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import Link from 'next/link';
import { listingsApi } from '../lib/api';
import { PUBLICATION_STEPS, validateWizardStep } from '../lib/publication-wizard';
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
import { MarketplaceDashboard } from './marketplace-dashboard';

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
  const [pendingCreateId, setPendingCreateId] =
    useState<string | null>(null);
  const [createImageInputKey, setCreateImageInputKey] =
    useState(0);
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
    let draftId = pendingCreateId;

    try {
      const token = await getToken();

      if (draftId) {
        await listingsApi.update(
          token,
          draftId,
          normalizedListingInput(form),
        );
      } else {
        const created = await listingsApi.create(
          token,
          normalizedListingInput(form),
        );
        draftId = created.id;
        setPendingCreateId(created.id);
      }

      await listingsApi.replaceImages(
        token,
        draftId,
        createImages,
      );

      setPendingCreateId(null);
      setForm(createBlankListingInput());
      setCreateImages([]);
      setCreateImageInputKey((current) => current + 1);
      setFeedback(
        'Annonce complète déposée. Elle attend maintenant la relecture de la réserve.',
      );
      await loadMine();
    } catch (reason) {
      if (draftId) {
        await loadMine();
        setError(
          'La fiche existe déjà mais sa galerie n’a pas été enregistrée complètement. Corrigez si nécessaire puis réessayez : le même brouillon sera réutilisé.',
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

    if (pendingCreateId === listing.id) {
      setPendingCreateId(null);
      setForm(createBlankListingInput());
      setCreateImages([]);
      setCreateImageInputKey((current) => current + 1);
    }

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

      if (editImages.length > 0) {
        await listingsApi.deleteImages(
          token,
          editing.id,
        );
      }

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
    <div className="workspace workspace-v3">
      <section className="workspace-intro">
        <div>
          <span className="eyebrow">Mon étagère</span>
          <h1>Votre étagère, {username ?? 'bienvenue'}.</h1>
        </div>
        <p>Déposez une annonce en quelques étapes et suivez vos objets et leur statut au même endroit.</p>
      </section>

      <div className="workspace-grid">
        <section className="form-panel">
          <span className="form-panel__index">PUBLIER</span>
          <div className="form-panel__heading">
            <span className="eyebrow">Nouvelle fiche</span>
            <h2>Proposer un objet</h2>
            <p>
              Un choix à la fois. Revenez en arrière sans perdre vos réponses.
            </p>
          </div>

          <ListingForm
            key={createImageInputKey}
            wizard
            value={form}
            images={createImages}
            existingImageCount={0}
            imageInputKey={createImageInputKey}
            submitLabel={
              saving
                ? 'Dépôt en cours…'
                : pendingCreateId
                  ? 'Réessayer la galerie'
                  : 'Déposer pour relecture'
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

          <div className="personal-list" aria-label="Mes annonces">
            {listings.map((listing) => {
              const published = listing.status === 'APPROVED';
              const cover = published ? listing.images[0]?.contentUrl : null;
              const statusText = {
                PENDING: 'En relecture',
                APPROVED: 'Publiée',
                REJECTED: 'À corriger',
              }[listing.status] ?? listing.status;
              return (
                <article className="personal-row" key={listing.id}>
                  <div className="personal-row__thumb">
                    {cover ? <img src={cover} alt="" loading="lazy" /> : <span aria-hidden="true">⌂</span>}
                  </div>
                  <div className="personal-row__main">
                    <div className="personal-row__meta">
                      <span>{listing.operationType === 'TRADE' ? 'Troc' : 'Don'}</span>
                      <span className={'personal-row__status personal-row__status--' + listing.status.toLowerCase()}>{statusText}</span>
                    </div>
                    <h3>{published ? <Link href={'/annonces/' + listing.id}>{listing.title}</Link> : listing.title}</h3>
                    <small>Déposée le {new Date(listing.createdAt).toLocaleDateString('fr-FR')}</small>
                  </div>
                  <div className="personal-row__action">
                    {canEditListing(listing.status) ? (
                      <button className="button button--quiet button--small" type="button" onClick={() => startEditing(listing)}>Corriger</button>
                    ) : (
                      <span className="personal-row__locked">Consultable</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      </div>

      <MarketplaceDashboard />

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
  imageInputKey,
  submitLabel,
  disabled,
  onChange,
  onImagesChange,
  onSubmit,
  wizard = false,
}: {
  value: ListingInput;
  images: File[];
  existingImageCount: number;
  imageInputKey?: string | number;
  submitLabel: string;
  disabled: boolean;
  onChange: (value: ListingInput) => void;
  onImagesChange: (images: File[]) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  wizard?: boolean;
}) {
  const [step, setStep] = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);
  function advance() {
    const problem = validateWizardStep(step, value, images);
    setStepError(problem);
    if (!problem) setStep((current) => Math.min(PUBLICATION_STEPS.length - 1, current + 1));
  }
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
    <form className="listing-form" onSubmit={(event) => {
      if (wizard && step < PUBLICATION_STEPS.length - 1) {
        event.preventDefault();
        advance();
      } else onSubmit(event);
    }}>
      {wizard ? (
        <div className="publication-progress" aria-label="Étapes de publication">
          <p>Étape {step + 1} sur {PUBLICATION_STEPS.length}</p>
          <ol>
            {PUBLICATION_STEPS.map((name, index) => (
              <li key={name} className={index <= step ? 'is-current' : ''} aria-current={index === step ? 'step' : undefined}>
                <span>{index + 1}</span>{name}
              </li>
            ))}
          </ol>
        </div>
      ) : null}
      {(!wizard || step === 0) ? (
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
      ) : null}

      {(!wizard || step === 1) ? (
      <>
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
      </>
      ) : null}

      {(!wizard || step === 2) ? (
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
            key={imageInputKey}
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
              {images.map((file, index) => (
                <FileImagePreview
                  key={`${file.name}-${file.size}-${file.lastModified}-${index}`}
                  file={file}
                  index={index}
                />
              ))}
            </div>
          </>
        ) : null}
      </fieldset>
      ) : null}

      {wizard && step === 3 ? (
        <div className="publication-review">
          <span className="eyebrow">Avant l’envoi</span>
          <h3>{value.title.trim()}</h3>
          <p>{value.operationType === 'TRADE' ? 'À troquer' : 'À donner'} · {images.length} photos</p>
          <p>{value.description.trim()}</p>
          {value.operationType === 'TRADE' ? (
            <p>{value.tradeWishes.map(w => w.trim()).filter(Boolean).length} souhaits pour ce troc</p>
          ) : null}
          <small>Après l’envoi, l’annonce attendra la validation d’un modérateur.</small>
        </div>
      ) : null}
      {wizard && stepError ? <p className="notice notice--error" role="alert">{stepError}</p> : null}
      {wizard ? (
        <div className="publication-actions">
          {step > 0 ? (
            <button type="button" className="button button--quiet" disabled={disabled} onClick={() => { setStepError(null); setStep(v => Math.max(0, v - 1)); }}>Retour</button>
          ) : null}
          {step < PUBLICATION_STEPS.length - 1 ? (
            <button type="submit" className="button" disabled={disabled}>Continuer</button>
          ) : (
            <button type="submit" className="button" disabled={disabled}>{submitLabel}</button>
          )}
        </div>
      ) : (
        <button className="button button--full" type="submit" disabled={disabled}>{submitLabel}</button>
      )}
    </form>
  );
}

function FileImagePreview({
  file,
  index,
}: {
  file: File;
  index: number;
}) {
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    const image = imageRef.current;

    if (image) {
      image.src = url;
    }

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  return (
    <figure>
      <img
        ref={imageRef}
        alt={`Aperçu ${index + 1} : ${file.name}`}
      />
      <figcaption>{index + 1}</figcaption>
    </figure>
  );
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
